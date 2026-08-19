"""
医药政策自动化监控、公文简报生成与数据同步 - 主调度入口
"""
import sys
import io
import os
import logging
from datetime import datetime

# 跨平台控制台编码安全配置
if sys.platform == 'win32' and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from database import PolicyDatabase
from formatter import PolicyFormatter
from doc_exporter import PolicyDocExporter
from scrapers import get_enabled_scrapers
import config

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("policy_runner.log", encoding="utf-8", mode="a")
    ]
)
logger = logging.getLogger(__name__)

def run_pipeline(force_push: bool = False):
    logger.info("=" * 50)
    logger.info(f"[启动] 开始执行医药政策定时监控任务 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 50)

    db = PolicyDatabase()

    # 自动执行历史政策库治理：只保留近两年（2025-2026）的有效政策，淘汰超期陈旧数据
    db.clean_expired_policies(max_years=2)

    # 0. 融合权威高价值医药产业政策知识库 (覆盖四川专项、四川省药监局、核医药、脑机接口、AI制药等)
    try:
        from curated_policies import CURATED_POLICIES
        curated_saved = 0
        for cp in CURATED_POLICIES:
            if db.save_policy(cp):
                curated_saved += 1
        if curated_saved > 0:
            logger.info(f"[权威知识库] 成功录入/更新 {curated_saved} 篇重点高价值产业政策")
    except Exception as e:
        logger.warning(f"加载权威知识库异常: {e}")

    # 1. 执行全部官方专栏爬虫
    scrapers = get_enabled_scrapers()
    total_fetched = 0
    total_new = 0

    for scraper in scrapers:
        logger.info(f"[*] 正在监控源：[{scraper.source_name}] ...")
        try:
            policies = scraper.scrape()
            total_fetched += len(policies)
            new_count = 0
            for p in policies:
                if db.save_policy(p):
                    new_count += 1
            total_new += new_count
            logger.info(f"[{scraper.source_name}] 采集完成，获取官方政策 {len(policies)} 条")
            logger.info(f"[{scraper.source_name}] 入库新政策条数: {new_count}")
        except Exception as e:
            logger.error(f"[{scraper.source_name}] 采集异常: {e}", exc_info=True)

    # 2. 导出全量静态 JSON 供 GitHub Pages 和本地前端读取
    try:
        web_dirs = [
            os.path.join(os.path.dirname(__file__), "web", "data"),
            os.path.join(os.path.dirname(__file__), "docs", "data"),
        ]
        for data_dir in web_dirs:
            os.makedirs(data_dir, exist_ok=True)
            with db._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM policies ORDER BY pub_date DESC, id DESC LIMIT 200")
                all_policies = [dict(r) for r in cursor.fetchall()]
                cursor.execute("SELECT category, COUNT(*) as cnt FROM policies GROUP BY category")
                cat_stats = {r["category"]: r["cnt"] for r in cursor.fetchall()}
            
            import json
            with open(os.path.join(data_dir, "policies.json"), "w", encoding="utf-8") as f:
                json.dump({"code": 0, "data": all_policies, "count": len(all_policies)}, f, ensure_ascii=False, indent=2)
            with open(os.path.join(data_dir, "stats.json"), "w", encoding="utf-8") as f:
                json.dump({"code": 0, "data": {"stats": db.get_stats(), "categories": cat_stats}}, f, ensure_ascii=False, indent=2)
            with open(os.path.join(data_dir, "visitor_stats.json"), "w", encoding="utf-8") as f:
                json.dump({"code": 0, "data": db.get_visitor_stats()}, f, ensure_ascii=False, indent=2)
        logger.info("[静态数据] 已成功同步 web/data/ 和 docs/data/ 供 GitHub Pages 在线访问！")
    except Exception as e:
        logger.warning(f"导出静态网页数据失败: {e}")

    # 3. 自动生成符合 GB/T 9704-2012 国家公文标准的 Word 简报归档
    unpushed_items = db.get_unpushed_policies(limit=config.MAX_PUSH_COUNT)
    if unpushed_items:
        try:
            saved_words = PolicyDocExporter.export(unpushed_items)
            if saved_words:
                logger.info(f"📄 [公文Word已生成] 已归档至: {saved_words[0]}")
            pushed_ids = [item["id"] for item in unpushed_items]
            db.mark_as_pushed(pushed_ids)
            logger.info(f"[归档] 成功归档并标记 {len(pushed_ids)} 条新政策。")
        except Exception as e:
            logger.warning(f"生成 Word 简报失败: {e}")

    logger.info("[结束] 本轮任务执行完毕。\n")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    run_pipeline(force_push=args.force)
