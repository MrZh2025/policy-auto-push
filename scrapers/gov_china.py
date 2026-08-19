"""
中国政府网与各部委政策检索接口模块 (支持 6 大赛道精准打标与多线程并发抓取)
覆盖赛道：
1. ⚛️ 核医药与放药监管
2. 🧠 脑机接口与前沿器械
3. 🧬 AI制药与算法模型
4. 🤖 医疗机器人与智能装备
5. 💳 医保政策与集采支付
6. 📑 科技创新与资金申报
"""
from bs4 import BeautifulSoup
from typing import List, Dict, Any
import logging
from concurrent.futures import ThreadPoolExecutor
from scrapers.base import BaseScraper
import config

logger = logging.getLogger(__name__)

class GovChinaScraper(BaseScraper):
    name = "gov_china"
    source_name = "中国政府网与各部委政策库"

    API_URL = "https://sousuo.www.gov.cn/search-gov/data"

    @staticmethod
    def identify_track(title: str, summary: str = "") -> str:
        """根据标题与内容通过统一的高精度产业分类引擎进行打标"""
        return BaseScraper.classify_policy(title, summary)

    def _fetch_single_topic(self, topic: str) -> List[Dict[str, Any]]:
        headers = {
            "User-Agent": config.USER_AGENT,
            "Referer": "https://sousuo.www.gov.cn/",
            "Accept": "application/json, text/plain, */*"
        }
        params = {
            "t": "zhengce_bmwj",
            "q": topic,
            "timetype": "timeFolder",
            "sort": "pubtime",
            "sortType": "1",
            "page": 1,
            "n": 15
        }
        items_found = []
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
                    dept = item.get("puborg", "") or item.get("source", "国家部委")
                    raw_summary = item.get("summary", "")
                    summary = self.clean_text(BeautifulSoup(raw_summary, "html.parser").get_text()) if raw_summary else f"【{dept}】{title}"

                    if not title or not url or not (url.startswith("http://") or url.startswith("https://")):
                        continue

                    # 医药相关性关键词过滤
                    if not self.filter_by_keywords(title, summary):
                        continue

                    track_tag = self.identify_track(title, summary)
                    items_found.append({
                        "title": title,
                        "url": url,
                        "source": dept if dept else "中国政府网",
                        "pub_date": pub_date,
                        "category": track_tag,
                        "summary": summary[:200]
                    })
        except Exception as e:
            logger.warning(f"[{self.source_name}] 请求主题 [{topic}] 异常: {e}")
        return items_found

    def scrape(self) -> List[Dict[str, Any]]:
        search_topics = [
            "医疗保障 医保 药品",
            "国家药监局 药品 医疗器械",
            "核医疗 放射性 药品 同位素",
            "脑机接口 脑科学 医疗",
            "人工智能 医药 制药",
            "医疗机器人 手术机器人 装备",
            "四川 生物医药 医药",
            "成都市 医药 科技",
            "重大新药创制 申报 奖补"
        ]

        all_results = []
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(self._fetch_single_topic, topic) for topic in search_topics]
            for f in futures:
                all_results.extend(f.result())

        # 去重
        unique = {}
        for r in all_results:
            key = (r["title"], r["url"])
            if key not in unique:
                unique[key] = r

        res_list = list(unique.values())
        logger.info(f"[{self.source_name}] 采集完成，获取有效官方政策 {len(res_list)} 条")
        return res_list
