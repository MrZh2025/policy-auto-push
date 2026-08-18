"""
政策早报排版模块
"""
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
import requests
import config

logger = logging.getLogger(__name__)

class PolicyFormatter:
    @classmethod
    def format_single_policy(cls, policy: Dict[str, Any], index: int = 1) -> str:
        title = policy.get("title", "未命名政策")
        url = policy.get("url", "#")
        source = policy.get("source", "官方发布")
        pub_date = policy.get("pub_date", "") or "近期"
        category = policy.get("category", "政策公告")

        md = []
        md.append(f"### 📌 {index}. [{source}] {title}")
        md.append(f"- **发布日期**：`{pub_date}` ｜ **分类**：`{category}`")
        md.append(f"- 🔗 [点击查看政策原文]({url})")
        return "\n".join(md)

    @classmethod
    def build_daily_digest(cls, policies: List[Dict[str, Any]]) -> Dict[str, str]:
        today_str = datetime.now().strftime("%Y年%m月%d日")
        count = len(policies)
        digest_title = f"📋 医药政策速递 ({datetime.now().strftime('%m.%d')}) | 监测到 {count} 条更新"

        header_lines = [
            f"# 📢 医药政策每日监测早报",
            f"> 📅 **监测时间**：{today_str} ｜ **新增政策**：`{count} 条`",
            f"> 🎯 **监测范围**：国务院 / 国家医保局 / 国家药监局 / 卫健委等部委政策库",
            "---",
            ""
        ]

        body_lines = []
        for i, item in enumerate(policies, 1):
            body_lines.append(cls.format_single_policy(item, i))
            body_lines.append("\n" + "─" * 20 + "\n")

        footer_lines = [
            "💡 *本早报由 政策自动化监控引擎 自动采集生成，已做去重过滤。*"
        ]

        full_content = "\n".join(header_lines + body_lines + footer_lines)
        return {
            "title": digest_title,
            "content": full_content
        }
