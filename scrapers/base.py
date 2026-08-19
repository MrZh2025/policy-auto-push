"""
爬虫基类模块
"""
import requests
from bs4 import BeautifulSoup
import logging
import re
from typing import List, Dict, Any, Optional
from abc import ABC, abstractmethod
from urllib.parse import urljoin
import urllib3
import config

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
logger = logging.getLogger(__name__)

from urllib3.util import Retry
from requests.adapters import HTTPAdapter

class BaseScraper(ABC):
    """政策抓取器基类"""

    name: str = "Base"
    source_name: str = "官方部门"

    def __init__(self):
        self.session = requests.Session()
        self.session.trust_env = False  # 直连国内政务网站，绕过本地代理干扰
        self.session.verify = False
        
        # 配置具备自动重试与高并发连接池的 HTTPAdapter
        retries = Retry(
            total=3,
            backoff_factor=0.5,
            status_forcelist=[500, 502, 503, 504],
            raise_on_status=False
        )
        adapter = HTTPAdapter(pool_connections=20, pool_maxsize=20, max_retries=retries)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

        self.session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json, text/html, application/xhtml+xml, application/xml;q=0.9, */*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
        })

    def fetch_url(self, url: str, encoding: Optional[str] = None, timeout: int = config.REQUEST_TIMEOUT) -> Optional[str]:
        try:
            resp = self.session.get(url, timeout=timeout)
            resp.raise_for_status()
            if encoding:
                resp.encoding = encoding
            else:
                if resp.encoding == 'ISO-8859-1' or not resp.encoding:
                    resp.encoding = resp.apparent_encoding or 'utf-8'
            return resp.text
        except Exception as e:
            logger.warning(f"[{self.source_name}] 请求 URL 失败: {url}, 错误: {e}")
            return None

    # 强排斥负向关键词（排除完全不相干领域）
    EXCLUDE_KEYWORDS = [
        "林草", "林业", "森林", "草原", "地质", "矿产", "煤炭", "交通运输",
        "航海", "船舶", "水利", "防汛", "气象", "殡葬", "海关总署关于印发",
        "农机", "化肥", "农药", "生猪", "畜牧", "水产养殖"
    ]

    # 核心医药强特征词（标题或摘要中必须包含）
    CORE_PHARMA_KEYWORDS = [
        "药", "医", "卫健", "卫生", "疾控", "临床", "器械", "中药",
        "生物", "病", "诊疗", "制药", "脑机", "同位素", "放药", "核医疗",
        "手术机器人", "集采", "带量采购", "处方", "罕见病", "健康", "养老"
    ]

    def filter_by_keywords(self, title: str, summary: str = "") -> bool:
        if not config.ENABLE_KEYWORD_FILTER:
            return True
        
        # 1. 负向关键词硬性排除（若标题包含排斥词且不含核心药/医词）
        for ex in self.EXCLUDE_KEYWORDS:
            if ex in title:
                # 除非标题明确包含核心药品/医疗词汇
                if not any(k in title for k in ["药品", "医疗", "医保", "药监", "生物医药", "中医药"]):
                    return False

        # 2. 正向关键词匹配
        text_to_check = f"{title} {summary}".lower()
        has_core = any(ck in text_to_check for ck in self.CORE_PHARMA_KEYWORDS)
        if not has_core:
            return False

        for kw in config.KEYWORDS:
            if kw.lower() in text_to_check:
                return True
        return False

    @staticmethod
    def clean_text(text: str) -> str:
        if not text:
            return ""
        return re.sub(r"\s+", " ", text).strip()

    @staticmethod
    def extract_date(text: str) -> str:
        if not text:
            return ""
        match = re.search(r"(\d{4})[-/年\.](\d{1,2})[-/月\.](\d{1,2})", text)
        if match:
            y, m, d = match.group(1), match.group(2), match.group(3)
            return f"{y}-{int(m):02d}-{int(d):02d}"
        
        match_ym = re.search(r"/(\d{4})(\d{2})/", text)
        if match_ym:
            return f"{match_ym.group(1)}-{match_ym.group(2)}"

        match_short = re.search(r"(\d{4})[-/年\.](\d{1,2})", text)
        if match_short:
            return f"{match_short.group(1)}-{int(match_short.group(2)):02d}"
        return ""

    @abstractmethod
    def scrape(self) -> List[Dict[str, Any]]:
        pass
