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

class BaseScraper(ABC):
    """政策抓取器基类"""

    name: str = "Base"
    source_name: str = "官方部门"

    def __init__(self):
        self.session = requests.Session()
        self.session.verify = False
        self.session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Connection": "close"
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

    def filter_by_keywords(self, title: str, summary: str = "") -> bool:
        if not config.ENABLE_KEYWORD_FILTER:
            return True
        text_to_check = f"{title} {summary}".lower()
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
