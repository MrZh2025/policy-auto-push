"""
中国政府网与各部委政策检索接口模块
"""
from bs4 import BeautifulSoup
from typing import List, Dict, Any
import logging
from scrapers.base import BaseScraper
import config

logger = logging.getLogger(__name__)

class GovChinaScraper(BaseScraper):
    name = "gov_china"
    source_name = "中国政府网与各部委政策库"

    API_URL = "https://sousuo.www.gov.cn/search-gov/data"

    def scrape(self) -> List[Dict[str, Any]]:
        results = []
        headers = {
            "User-Agent": config.USER_AGENT,
            "Referer": "https://sousuo.www.gov.cn/",
            "Accept": "application/json, text/plain, */*"
        }

        query_configs = [
            ("zhengce_bmwj", "部委最新政策"),
            ("zhengce_gwydoc", "国务院最新文件")
        ]

        for doc_type, category_name in query_configs:
            params = {
                "t": doc_type,
                "q": "医药",
                "timetype": "timeFolder",
                "sort": "pubtime",
                "sortType": "1",
                "page": "1",
                "n": "15"
            }
            try:
                resp = self.session.get(self.API_URL, params=params, headers=headers, timeout=6)
                if resp.status_code == 200:
                    data = resp.json()
                    list_vo = data.get("searchVO", {}).get("listVO", [])
                    for item in list_vo:
                        raw_title = item.get("title", "")
                        soup_t = BeautifulSoup(raw_title, "html.parser")
                        title = self.clean_text(soup_t.get_text())
                        
                        url = item.get("url", "")
                        pub_time = item.get("pubtimeStr", "") or item.get("pubtime", "")
                        pub_date = self.extract_date(pub_time) or self.extract_date(url)
                        dept = item.get("puborg", "") or item.get("source", "国家部委")
                        summary = self.clean_text(BeautifulSoup(item.get("summary", ""), "html.parser").get_text())

                        if not title or not url:
                            continue

                        if not self.filter_by_keywords(title, summary):
                            continue

                        results.append({
                            "title": title,
                            "url": url,
                            "source": dept if dept else "中国政府网",
                            "pub_date": pub_date,
                            "category": category_name,
                            "summary": summary[:200] if summary else f"【{dept}】{title}"
                        })
            except Exception as e:
                logger.warning(f"[{self.source_name}] 请求 [{category_name}] 异常: {e}")

        logger.info(f"[{self.source_name}] 采集完成，获取最新政策 {len(results)} 条")
        return results
