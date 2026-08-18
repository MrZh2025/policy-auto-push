"""
国家药品监督管理局 (NMPA) 与国家医疗保障局 (NHSA) 官方专栏抓取器
覆盖：
1. 国家药监局政策法规、药品/医疗器械监管通知、放射性药品审评指导原则
2. 国家医保局医保目录调整、集中带量采购、DRG/DIP支付改革
"""
from bs4 import BeautifulSoup
from typing import List, Dict, Any
import logging
import re
from datetime import datetime
from scrapers.base import BaseScraper
import config

logger = logging.getLogger(__name__)

class NmpaNhsaScraper(BaseScraper):
    name = "nmpa_nhsa"
    source_name = "国家药监局与国家医保局政策专栏"

    # 中国政府网部委直连数据接口，精确过滤发文机关
    API_URL = "https://sousuo.www.gov.cn/search-gov/data"

    def scrape(self) -> List[Dict[str, Any]]:
        results = []
        headers = {
            "User-Agent": config.USER_AGENT,
            "Referer": "https://sousuo.www.gov.cn/",
            "Accept": "application/json, text/plain, */*"
        }

        # 针对国家药监局与医保局的精准查询
        queries = [
            ("国家药品监督管理局 药品 放射性 医疗器械", "国家药监局"),
            ("国家医疗保障局 医保 药品 支付 采购", "国家医保局"),
            ("国家卫生健康委 医疗 科技 转化 临床", "国家卫健委"),
        ]

        for query_str, default_source in queries:
            params = {
                "t": "zhengce_bmwj",
                "q": query_str,
                "timetype": "timeFolder",
                "sort": "pubtime",
                "sortType": "1",
                "page": "1",
                "n": "15"
            }
            try:
                resp = self.session.get(self.API_URL, params=params, headers=headers, timeout=8)
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
                        dept = item.get("puborg", "") or default_source
                        summary = self.clean_text(BeautifulSoup(item.get("summary", ""), "html.parser").get_text())

                        if not title or not url:
                            continue

                        # 赛道精准判定
                        category = self._classify_track(title, summary)

                        results.append({
                            "title": title,
                            "url": url,
                            "source": dept,
                            "pub_date": pub_date,
                            "category": category,
                            "summary": summary[:220] if summary else f"【{dept}】发布关于《{title}》的官方政策文件。"
                        })
            except Exception as e:
                logger.warning(f"[{self.source_name}] 请求 [{query_str}] 异常: {e}")

        logger.info(f"[{self.source_name}] 采集完成，获取官方政策 {len(results)} 条")
        return results

    def _classify_track(self, title: str, summary: str) -> str:
        text = f"{title} {summary}".lower()
        if any(k in text for k in ["核药", "同位素", "放射性", "堆照", "核医疗", "放药"]):
            return "核医药"
        if any(k in text for k in ["脑机接口", "脑科学", "神经调控", "侵入式"]):
            return "脑机接口"
        if any(k in text for k in ["ai制药", "人工智能", "计算生物", "大模型", "算法"]):
            return "AI制药"
        if any(k in text for k in ["机器人", "手术机器人", "外骨骼", "器械装备"]):
            return "医疗机器人"
        if any(k in text for k in ["医保", "集采", "带量采购", "支付方式", "drg", "dip"]):
            return "医保政策"
        return "科技申报政策"
