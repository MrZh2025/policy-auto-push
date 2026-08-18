"""
四川省药品监督管理局 (yjj.sc.gov.cn) 官方专栏抓取器
监控范围：
1. 政策法规、规范性文件、通知公告
2. 药品与医疗器械审评审批改革、创新药械早期介入辅导
3. 放射性药物监管、医疗机构制剂调剂与转化备案
"""
from bs4 import BeautifulSoup
from typing import List, Dict, Any
import logging
from scrapers.base import BaseScraper
import config

logger = logging.getLogger(__name__)

class SichuanNmpaScraper(BaseScraper):
    name = "sichuan_nmpa"
    source_name = "四川省药品监督管理局"

    API_URL = "https://sousuo.www.gov.cn/search-gov/data"

    def scrape(self) -> List[Dict[str, Any]]:
        results = []
        headers = {
            "User-Agent": config.USER_AGENT,
            "Referer": "https://sousuo.www.gov.cn/",
            "Accept": "application/json, text/plain, */*"
        }

        # 针对四川省药品监督管理局的精准查询
        queries = [
            ("四川省药品监督管理局 政策 法规 通知 药品", "四川省药品监督管理局"),
            ("四川省药监局 医疗器械 创新 审评", "四川省药品监督管理局"),
            ("四川省 药品监管 放射性 院内制剂", "四川省药品监督管理局"),
        ]

        for query_str, default_source in queries:
            params = {
                "t": "zhengce",
                "q": query_str,
                "timetype": "timeFolder",
                "sort": "pubtime",
                "sortType": "1",
                "page": "1",
                "n": "12"
            }
            try:
                resp = self.session.get(self.API_URL, params=params, headers=headers, timeout=8)
                if resp.status_code == 200:
                    data = resp.json() or {}
                    search_vo = data.get("searchVO") or {}
                    list_vo = search_vo.get("listVO") or []
                    for item in list_vo:
                        raw_title = item.get("title", "")
                        soup_t = BeautifulSoup(raw_title, "html.parser")
                        title = self.clean_text(soup_t.get_text())

                        url = item.get("url", "")
                        pub_time = item.get("pubtimeStr", "") or item.get("pubtime", "")
                        pub_date = self.extract_date(pub_time) or self.extract_date(url)
                        dept = item.get("puborg", "") or default_source
                        summary = self.clean_text(BeautifulSoup(item.get("summary", ""), "html.parser").get_text())

                        if not title or not url:
                            continue

                        category = self._classify_track(title, summary)

                        results.append({
                            "title": title,
                            "url": url,
                            "source": "四川省药品监督管理局",
                            "pub_date": pub_date,
                            "category": category,
                            "summary": summary[:220] if summary else f"【四川省药品监督管理局】发布关于《{title}》的官方监管与申报指导文件。"
                        })
            except Exception as e:
                logger.warning(f"[{self.source_name}] 请求 [{query_str}] 异常: {e}")

        logger.info(f"[{self.source_name}] 采集完成，获取四川省药监局政策 {len(results)} 条")
        return results

    def _classify_track(self, title: str, summary: str) -> str:
        text = f"{title} {summary}".lower()
        if any(k in text for k in ["核药", "同位素", "放射性", "堆照", "核医疗"]):
            return "核医药"
        if any(k in text for k in ["脑机接口", "脑科学", "神经调控"]):
            return "脑机接口"
        if any(k in text for k in ["ai制药", "人工智能", "计算生物", "算法"]):
            return "AI制药"
        if any(k in text for k in ["机器人", "手术机器人", "医疗器械"]):
            return "医疗机器人"
        if any(k in text for k in ["医保", "集采", "支付"]):
            return "医保政策"
        return "科技申报政策"
