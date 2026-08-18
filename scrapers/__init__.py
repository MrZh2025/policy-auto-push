"""
爬虫包初始化与注册工厂
"""
from typing import List, Type
from scrapers.base import BaseScraper
from scrapers.gov_china import GovChinaScraper
import config

ALL_SCRAPERS: List[Type[BaseScraper]] = [
    GovChinaScraper,
]

def get_enabled_scrapers() -> List[BaseScraper]:
    return [cls() for cls in ALL_SCRAPERS]
