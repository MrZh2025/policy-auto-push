"""
四川省科技创新与生物医药资金申报专栏抓取器
覆盖：
1. 四川省科学技术厅 科技奖补、重大专项申报通知
2. 四川省发展和改革委员会 核医疗产业扶持、重大工程
3. 成都市经信局 / 科技局 生物医药建圈强链与研发补助
"""
from bs4 import BeautifulSoup
from typing import List, Dict, Any
import logging
from concurrent.futures import ThreadPoolExecutor
from scrapers.base import BaseScraper
import config

logger = logging.getLogger(__name__)

class SichuanTechScraper(BaseScraper):
    name = "sichuan_tech"
    source_name = "四川省科技与生物医药申报专栏"

    API_URL = "https://sousuo.www.gov.cn/search-gov/data"

    def _fetch_single_query(self, query_str: str, default_source: str) -> List[Dict[str, Any]]:
        headers = {
            "User-Agent": config.USER_AGENT,
            "Referer": "https://sousuo.www.gov.cn/",
            "Accept": "application/json, text/plain, */*"
        }
        params = {
            "t": "zhengce_bmwj",
            "q": query_str,
            "timetype": "timeFolder",
            "sort": "pubtime",
            "sortType": "1",
            "page": 1,
            "n": 15
        }
        items = []
        try:
            resp = self.session.get(self.API_URL, params=params, headers=headers, timeout=config.REQUEST_TIMEOUT)
            if resp.status_code == 200:
                data = resp.json() or {}
                list_vo = data.get("searchVO", {}).get("listVO", []) or []
                for item in list_vo:
                    raw_title = item.get("title", "")
                    title = self.clean_text(BeautifulSoup(raw_title, "html.parser").get_text())
                    url = item.get("url", "")
                    pub_time = item.get("pubtimeStr", "") or item.get("pubtime", "")
                    pub_date = self.extract_date(pub_time) or self.extract_date(url)
                    dept = item.get("puborg", "") or default_source
                    raw_summary = item.get("summary", "")
                    summary = self.clean_text(BeautifulSoup(raw_summary, "html.parser").get_text()) if raw_summary else f"【{dept}】{title}"

                    if not title or not url or not (url.startswith("http://") or url.startswith("https://")):
                        continue

                    if not self.filter_by_keywords(title, summary):
                        continue

                    category = self._classify_track(title, summary)
                    items.append({
                        "title": title,
                        "url": url,
                        "source": dept,
                        "pub_date": pub_date,
                        "category": category,
                        "summary": summary[:200]
                    })
        except Exception as e:
            logger.warning(f"[{self.source_name}] 请求 [{query_str}] 异常: {e}")
        return items

    def scrape(self) -> List[Dict[str, Any]]:
        queries = [
            ("四川 生物医药 科技 奖补 申报", "四川省科技厅"),
            ("四川 核医疗 放射性 产业 扶持", "四川省发展改革委"),
            ("成都市 生物医药 创新 资助 研发", "成都市经信局"),
            ("四川 药品 医疗器械 专项 实施方案", "四川省相关部门"),
        ]

        all_results = []
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = [executor.submit(self._fetch_single_query, q, src) for q, src in queries]
            for f in futures:
                all_results.extend(f.result())

        unique = {}
        for r in all_results:
            key = (r["title"], r["url"])
            if key not in unique:
                unique[key] = r

        res_list = list(unique.values())
        logger.info(f"[{self.source_name}] 采集完成，获取四川重点政策 {len(res_list)} 条")
        return res_list

    def _classify_track(self, title: str, summary: str) -> str:
        return BaseScraper.classify_policy(title, summary)
