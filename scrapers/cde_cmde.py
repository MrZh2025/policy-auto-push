"""
国家药监局药审中心 (CDE) 与器械审评中心 (CMDE) 专职高阶技术爬虫
专门攻关：
1. CDE 技术指导原则、仿制药/创新药药学要求、征求意见稿、先锐计划、ICH 指导原则
2. CMDE 医疗器械技术审评要点、脑机接口器械、手术机器人与创新医疗器械审批
"""
from bs4 import BeautifulSoup
from typing import List, Dict, Any
import logging
from scrapers.base import BaseScraper
import config

logger = logging.getLogger(__name__)

class CdeCmdeScraper(BaseScraper):
    name = "cde_cmde"
    source_name = "国家药监局药审(CDE)与器审(CMDE)中心"

    API_URL = "https://sousuo.www.gov.cn/search-gov/data"

    def scrape(self) -> List[Dict[str, Any]]:
        queries = [
            ("药品审评中心 药学研究 征求意见", "国家药监局药品审评中心（CDE）"),
            ("医疗器械技术审评中心 技术审评要点", "国家药监局医疗器械技术审评中心（CMDE）"),
            ("脑机接口 医疗器械 审评要点", "国家药监局医疗器械技术审评中心（CMDE）"),
            ("放射性药物 镥177 仿制药 CDE", "国家药监局药品审评中心（CDE）"),
            ("ICH 模型引导的药物研发 M15", "国家药监局药品审评中心（CDE）"),
            ("细胞与基因治疗 先锐计划 CDE", "国家药监局药品审评中心（CDE）")
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
                    try:
                        data = resp.json()
                    except Exception:
                        data = {}
                    if isinstance(data, dict):
                        search_vo = data.get("searchVO") or {}
                        list_vo = search_vo.get("listVO") or []
                        for item in list_vo:
                            if not isinstance(item, dict): continue
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
        logger.info(f"[{self.source_name}] 采集完成，获取技术审评重点政策 {len(res_list)} 条")
        return res_list
