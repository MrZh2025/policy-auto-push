"""
政策去重与本地 SQLite 存储数据库模块
负责记录已抓取、已推送的政策，防止重复推送
"""
import sqlite3
import hashlib
import logging
from typing import List, Dict, Optional, Any
from datetime import datetime
import config

logger = logging.getLogger(__name__)

class PolicyDatabase:
    """政策数据存储与去重管理器"""

    def __init__(self, db_path: str = config.DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        """初始化 SQLite 数据库表结构"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS policies (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    fingerprint TEXT UNIQUE NOT NULL,    -- 唯一特征指纹 (MD5)
                    title TEXT NOT NULL,                -- 政策标题
                    url TEXT NOT NULL,                  -- 原文链接
                    source TEXT NOT NULL,               -- 发布部门/来源
                    pub_date TEXT,                      -- 官方发布日期
                    category TEXT,                      -- 分类/栏目
                    summary TEXT,                       -- 提炼摘要
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 入库时间
                    pushed_at TIMESTAMP,                -- 推送时间
                    is_pushed INTEGER DEFAULT 0         -- 是否已推送到微信 (0: 否, 1: 是)
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_fingerprint ON policies(fingerprint)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_is_pushed ON policies(is_pushed)")
            conn.commit()

    @staticmethod
    def generate_fingerprint(title: str, url: str) -> str:
        """根据标题和URL生成唯一特征MD5指纹"""
        raw = f"{title.strip()}|{url.strip()}"
        return hashlib.md5(raw.encode("utf-8")).hexdigest()

    def is_exists(self, title: str, url: str) -> bool:
        """检查某条政策是否已经在数据库中记录"""
        fp = self.generate_fingerprint(title, url)
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM policies WHERE fingerprint = ? LIMIT 1", (fp,))
            return cursor.fetchone() is not None

    def save_policy(self, policy: Dict[str, Any]) -> bool:
        """
        保存一条新抓取的政策记录
        :param policy: 包含 title, url, source, pub_date 等键的字典
        :return: bool 是否保存成功（如果已存在则返回 False）
        """
        title = policy.get("title", "").strip()
        url = policy.get("url", "").strip()
        if not title or not url:
            return False

        pub_date = policy.get("pub_date", "")
        # 严格过滤：仅允许近两年的政策入库（如 2025、2026 年）
        if pub_date:
            try:
                import re
                m = re.search(r'(\d{4})', pub_date)
                if m:
                    p_year = int(m.group(1))
                    curr_year = datetime.now().year
                    if p_year < (curr_year - 1): # 早于去年的历史数据直接拦截
                        return False
            except Exception:
                pass

        fp = self.generate_fingerprint(title, url)
        source = policy.get("source", "官方发布")
        category = policy.get("category", "")
        summary = policy.get("summary", "")

        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO policies (fingerprint, title, url, source, pub_date, category, summary)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (fp, title, url, source, pub_date, category, summary))
                conn.commit()
                return True
        except sqlite3.IntegrityError:
            return False
        except Exception as e:
            logger.error(f"保存政策数据失败: {e}")
            return False

    def clean_expired_policies(self, max_years: int = 2) -> int:
        """
        自动清理超出近两年的历史陈旧政策，保证政策库只存放近两年有效数据
        """
        curr_year = datetime.now().year
        cutoff_year = curr_year - (max_years - 1) # 例如 2026 - (2 - 1) = 2025
        cutoff_date_str = f"{cutoff_year}-01-01"

        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    DELETE FROM policies 
                    WHERE (pub_date != '' AND pub_date < ?)
                       OR (pub_date LIKE '2024%' OR pub_date LIKE '2023%' OR pub_date LIKE '2022%' OR pub_date LIKE '2021%')
                """, (cutoff_date_str,))
                deleted_count = cursor.rowcount
                conn.commit()
                if deleted_count > 0:
                    logger.info(f"[历史库治理] 已自动淘汰并清理 {deleted_count} 条超过两年的陈旧历史政策文件（截止年份: {cutoff_year} 年前）")
                return deleted_count
        except Exception as e:
            logger.error(f"清理过期政策数据失败: {e}")
            return 0

    def get_unpushed_policies(self, limit: int = config.MAX_PUSH_COUNT) -> List[Dict[str, Any]]:
        """获取尚未推送到微信的最新政策列表"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM policies 
                WHERE is_pushed = 0 
                ORDER BY pub_date DESC, id DESC 
                LIMIT ?
            """, (limit,))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    def mark_as_pushed(self, policy_ids: List[int]):
        """将指定的政策记录标记为已推送"""
        if not policy_ids:
            return
        placeholders = ",".join("?" for _ in policy_ids)
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"""
                UPDATE policies 
                SET is_pushed = 1, pushed_at = ? 
                WHERE id IN ({placeholders})
            """, [now] + policy_ids)
            conn.commit()

    def get_stats(self) -> Dict[str, int]:
        """获取政策库统计信息"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM policies")
            total = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM policies WHERE is_pushed = 1")
            pushed = cursor.fetchone()[0]
            return {
                "total": total,
                "pushed": pushed,
                "unpushed": total - pushed
            }
