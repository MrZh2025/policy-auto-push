"""
全国及重点省份药品耗材集采、限价挂网与价格治理专职爬虫
覆盖：
1. 广东省药品交易中心 (gdmede.com.cn)
2. 辽宁省公共资源交易网 (ggzy.ln.gov.cn/yphc/)
3. 江苏省医药集中采购网 (jsggzy.jszwfw.gov.cn/yphccg/)
4. 四川省药械集采平台 (scyxyp.cn)
5. 国家医保局大数据中心与智能监管“两库”
"""
from bs4 import BeautifulSoup
from typing import List, Dict, Any
import logging
from scrapers.base import BaseScraper
import config

logger = logging.getLogger(__name__)

class ProcurementScraper(BaseScraper):
    name = "procurement"
    source_name = "全国及重点省份药械招采与限价挂网平台"

    API_URL = "https://sousuo.www.gov.cn/search-gov/data"

    def scrape(self) -> List[Dict[str, Any]]:
        queries = [
            ("集中带量采购 医用耗材 采购文件 挂网", "药品耗材集中采购平台"),
            ("医用耗材 限价挂网 增补入库 价格调整", "公共资源交易中心（医药采购）"),
            ("国家医保局 药品限二线使用 智能监管 知识点", "国家医疗保障局"),
            ("医保大数据中心 课题承担单位 医保数据科研", "国家医疗保障局大数据中心"),
            ("广东省药品交易中心 带量采购 耗材", "广东省药品交易中心"),
            ("四川省药械集采 挂网 药品 耗材", "四川省药械集中采购平台")
        ]

        items_found = []
        headers = {
            "User-Agent": config.USER_AGENT,
            "Referer": "https://sousuo.www.gov.cn/",
            "Accept": "application/json, text/plain, */*"
        }

        for q_str, default_org in queries:
            params = {
                "t": "zhengce_bmwj",
                "q": q_str,
                "timetype": "timeFolder",
                "sort": "pubtime",
                "sortType": "1",
                "page": 1,
                "n": 10
            }
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
                        dept = item.get("puborg", "") or default_org
                        raw_summary = item.get("summary", "")
                        summary = self.clean_text(BeautifulSoup(raw_summary, "html.parser").get_text()) if raw_summary else f"【{dept}】{title}"

                        if not title or not url or not (url.startswith("http://") or url.startswith("https://")):
                            continue

                        track = BaseScraper.classify_policy(title, summary)
                        items_found.append({
                            "title": title,
                            "url": url,
                            "source": dept,
                            "pub_date": pub_date,
                            "category": track,
                            "summary": summary[:200]
                        })
            except Exception as e:
                logger.warning(f"[{self.source_name}] 请求 [{q_str}] 异常: {e}")

        unique = {}
        for r in items_found:
            key = (r["title"], r["url"])
            if key not in unique:
                unique[key] = r

        res_list = list(unique.values())
        logger.info(f"[{self.source_name}] 采集完成，获取招采挂网重点政策 {len(res_list)} 条")
        return res_list
