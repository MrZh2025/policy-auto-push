"""
四川省药品监督管理局 (yjj.sc.gov.cn) 及省域药监专栏抓取器
监控范围：
1. 政策法规、规范性文件、通知公告
2. 药品与医疗器械审评审批改革、创新药械早期介入辅导
3. 放射性药物监管、医疗机构制剂调剂与转化备案
"""
from bs4 import BeautifulSoup
from typing import List, Dict, Any
import logging
from concurrent.futures import ThreadPoolExecutor
from scrapers.base import BaseScraper
import config

logger = logging.getLogger(__name__)

class SichuanNmpaScraper(BaseScraper):
    name = "sichuan_nmpa"
    source_name = "四川省药品监督管理局与药监专栏"

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
            ("四川 药品监管 政策 法规", "四川省药品监督管理部门"),
            ("四川 医疗器械 审评 创新", "四川省药品监督管理部门"),
            ("国家药监局 放射性 院内制剂 调剂", "国家药品监督管理局"),
            ("四川 生物医药 工业 规划", "四川省相关部门"),
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
        logger.info(f"[{self.source_name}] 采集完成，获取药监重点政策 {len(res_list)} 条")
        return res_list

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
