"""
医药政策自动化监控与微信推送系统 - 主调度入口
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
from notifier import WeChatNotifier
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
    notifier = WeChatNotifier()

    scrapers = get_enabled_scrapers()
    total_fetched = 0
    new_saved = 0

    for scraper in scrapers:
        logger.info(f"[*] 正在监控源：[{scraper.source_name}] ...")
        try:
            items = scraper.scrape()
            total_fetched += len(items)
            for item in items:
                if db.save_policy(item):
                    new_saved += 1
                    logger.info(f"  [新政策入库] [{item.get('source')}] {item.get('title')}")
        except Exception as e:
            logger.error(f"[!] 抓取源 [{scraper.source_name}] 出现异常: {e}", exc_info=False)

    # 导出静态 JSON 供 GitHub Pages 网页直接读取
    try:
        data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web", "data")
        os.makedirs(data_dir, exist_ok=True)
        with db._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM policies ORDER BY pub_date DESC, id DESC LIMIT 200")
            all_policies = [dict(r) for r in cursor.fetchall()]
            cursor.execute("SELECT category, COUNT(*) as cnt FROM policies GROUP BY category")
            cat_stats = {r["category"]: r["cnt"] for r in cursor.fetchall()}
        
        with open(os.path.join(data_dir, "policies.json"), "w", encoding="utf-8") as f:
            import json
            json.dump({"code": 0, "data": all_policies, "count": len(all_policies)}, f, ensure_ascii=False, indent=2)
        with open(os.path.join(data_dir, "stats.json"), "w", encoding="utf-8") as f:
            json.dump({"code": 0, "data": {"stats": db.get_stats(), "categories": cat_stats}}, f, ensure_ascii=False, indent=2)
        logger.info("[静态数据] 已成功同步 web/data/ 供 GitHub Pages 在线访问！")
    except Exception as e:
        logger.warning(f"导出静态网页数据失败: {e}")

    unpushed_items = db.get_unpushed_policies(limit=config.MAX_PUSH_COUNT)

    if not unpushed_items:
        logger.info("[完成] 当前没有检测到需要推送的新增政策（所有政策均已推送或无更新）。")
        return

    logger.info(f"[排版] 正在打包 {len(unpushed_items)} 条新政策并推送到微信...")
    digest = PolicyFormatter.build_daily_digest(unpushed_items)

    # 自动生成一份排版精美的 Word 简报保存到桌面与归档
    try:
        saved_words = PolicyDocExporter.export(unpushed_items)
        if saved_words:
            logger.info(f"📄 [Word已生成] 已保存至: {saved_words[0]}")
    except Exception as e:
        logger.warning(f"生成 Word 简报失败: {e}")

    # 发送微信推送
    success = notifier.dispatch(
        title=digest["title"],
        content=digest["content"]
    )

    if success:
        pushed_ids = [item["id"] for item in unpushed_items]
        db.mark_as_pushed(pushed_ids)
        logger.info(f"[成功] 成功推送 {len(pushed_ids)} 条政策到微信，已完成去重标记。")
    else:
        logger.warning("[警告] 微信推送未成功，保留未推送标记待下次重试。")

    logger.info("[结束] 本轮任务执行完毕。\n")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    run_pipeline(force_push=args.force)
