"""
中国政府网与各部委政策检索接口模块 (支持 6 大赛道精准打标)
分类赛道：
1. ⚛️ 核医药
2. 🧠 脑机接口
3. 🧬 AI制药
4. 🤖 医疗机器人
5. 💳 医保政策
6. 📑 科技申报与资金奖补
"""
from bs4 import BeautifulSoup
from typing import List, Dict, Any
import logging
from scrapers.base import BaseScraper
import config

logger = logging.getLogger(__name__)

# 6 大赛道标签及特征词库
TRACK_KEYWORDS = {
    "核医药": ["核药", "放射性", "同位素", "核医学", "堆照", "放药", "核技术"],
    "脑机接口": ["脑机接口", "脑科学", "神经调控", "脑电", "脑机", "侵入式", "神经接口"],
    "AI制药": ["ai制药", "人工智能", "计算生物", "大模型", "算法制药", "虚拟筛选", "结构生物"],
    "医疗机器人": ["医疗机器人", "手术机器人", "康复机器人", "外骨骼", "手术导航", "智能器械"],
    "医保政策": ["医保", "医保目录", "集中带量采购", "集采", "支付方式", "drg", "dip", "价格治理"],
    "科技申报政策": ["申报", "奖励", "补助", "资助", "扶持", "资金", "重大专项", "专项资金", "创新平台", "揭榜挂帅"]
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
        # 默认根据常规归类
        if any(k in text for k in ["器械", "装备"]):
            return "医疗机器人"
        if any(k in text for k in ["药", "中药", "生物"]):
            return "AI制药"
        return "科技申报政策"

    def scrape(self) -> List[Dict[str, Any]]:
        results = []
        headers = {
            "User-Agent": config.USER_AGENT,
            "Referer": "https://sousuo.www.gov.cn/",
            "Accept": "application/json, text/plain, */*"
        }

        # 针对 6 大赛道的检索主题词
        search_topics = [
            "医药 政策",
            "核医疗 同位素 药品",
            "脑机接口 医疗",
            "人工智能 医药 制药",
            "医疗机器人 手术机器人",
            "医疗保障 医保 药品",
            "科技创新 生物医药 申报 奖补"
        ]

        for topic in search_topics:
            params = {
                "t": "zhengce_bmwj",
                "q": topic,
                "timetype": "timeFolder",
                "sort": "pubtime",
                "sortType": "1",
                "page": "1",
                "n": "10"
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

                        # 自动计算赛道标签
                        track_tag = self.identify_track(title, summary)

                        results.append({
                            "title": title,
                            "url": url,
                            "source": dept if dept else "中国政府网",
                            "pub_date": pub_date,
                            "category": track_tag,
                            "summary": summary[:200] if summary else f"【{dept}】{title}"
                        })
            except Exception as e:
                logger.warning(f"[{self.source_name}] 请求主题 [{topic}] 异常: {e}")

        logger.info(f"[{self.source_name}] 采集完成，获取最新政策 {len(results)} 条")
        return results
