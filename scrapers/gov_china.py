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

TRACK_KEYWORDS = {
    "核医药": ["核药", "放射性", "同位素", "核医学", "堆照", "放药", "核技术", "辐射"],
    "脑机接口": ["脑机接口", "脑科学", "神经调控", "脑电", "脑机", "侵入式", "神经接口", "假肢"],
    "AI制药": ["ai制药", "人工智能", "计算生物", "大模型", "算法制药", "虚拟筛选", "结构生物", "合成生物"],
    "医疗机器人": ["医疗机器人", "手术机器人", "康复机器人", "外骨骼", "手术导航", "智能器械", "智能装备", "智能医疗"],
    "医保政策": ["医保", "医保目录", "集中带量采购", "集采", "支付方式", "drg", "dip", "价格治理", "药品价格", "医疗保障"],
    "科技申报政策": ["申报", "奖励", "补助", "资助", "扶持", "资金", "重大专项", "专项资金", "创新平台", "揭榜挂帅", "新药创制", "高质量发展"]
}

class GovChinaScraper(BaseScraper):
    name = "gov_china"
    source_name = "中国政府网与各部委政策库"

    API_URL = "https://sousuo.www.gov.cn/search-gov/data"

    @staticmethod
    def identify_track(title: str, summary: str = "") -> str:
        """根据标题与内容自动判定所属核心赛道"""
        text = f"{title} {summary}".lower()
        for track, keywords in TRACK_KEYWORDS.items():
            for kw in keywords:
                if kw in text:
                    return track
        if any(k in text for k in ["器械", "装备", "设备"]):
            return "医疗机器人"
        if any(k in text for k in ["药", "中药", "生物"]):
            return "AI制药"
        return "科技申报政策"

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
