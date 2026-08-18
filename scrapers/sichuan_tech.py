"""
四川省科技创新与生物医药资金申报专栏抓取器
覆盖：
1. 四川省科学技术厅 (kjt.sc.gov.cn) 科技奖补、重大专项申报通知
2. 四川省发展和改革委员会 (fgw.sc.gov.cn) 核医疗产业扶持、重大工程
3. 成都市经济和信息化局 / 科技局 生物医药建圈强链与研发补助
"""
from bs4 import BeautifulSoup
from typing import List, Dict, Any
import logging
import re
from scrapers.base import BaseScraper
import config

logger = logging.getLogger(__name__)

class SichuanTechScraper(BaseScraper):
    name = "sichuan_tech"
    source_name = "四川省科技与生物医药申报专栏"

    API_URL = "https://sousuo.www.gov.cn/search-gov/data"

    def scrape(self) -> List[Dict[str, Any]]:
        results = []
        headers = {
            "User-Agent": config.USER_AGENT,
            "Referer": "https://sousuo.www.gov.cn/",
            "Accept": "application/json, text/plain, */*"
        }

        # 精确检索四川省及成都市生物医药科技奖补政策
        queries = [
            ("四川省 生物医药 科技创新 奖补 申报", "四川省科学技术厅"),
            ("四川省 核医疗 同位素 产业 扶持", "四川省发改委"),
            ("成都市 生物医药 建圈强链 研发 资助", "成都市经信局"),
            ("四川省 医药 脑机接口 医疗机器人 专项", "四川省科技厅"),
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
                            "source": dept,
                            "pub_date": pub_date,
                            "category": category,
                            "summary": summary[:220] if summary else f"【{dept}】发布关于《{title}》的科技申报与奖补政策。"
                        })
            except Exception as e:
                logger.warning(f"[{self.source_name}] 请求 [{query_str}] 异常: {e}")

        logger.info(f"[{self.source_name}] 采集完成，获取四川重点政策 {len(results)} 条")
        return results

    def _classify_track(self, title: str, summary: str) -> str:
        text = f"{title} {summary}".lower()
        if any(k in text for k in ["核药", "同位素", "放射性", "堆照", "核医疗", "放药"]):
            return "核医药"
        if any(k in text for k in ["脑机接口", "脑科学", "神经调控"]):
            return "脑机接口"
        if any(k in text for k in ["ai制药", "人工智能", "计算生物", "大模型"]):
            return "AI制药"
        if any(k in text for k in ["机器人", "手术机器人", "装备"]):
            return "医疗机器人"
        if any(k in text for k in ["医保", "集采", "带量采购"]):
            return "医保政策"
        return "科技申报政策"
