"""
爬虫包初始化与注册工厂
"""
from typing import List, Type
from scrapers.base import BaseScraper
from scrapers.gov_china import GovChinaScraper
from scrapers.nmpa_nhsa import NmpaNhsaScraper
from scrapers.sichuan_tech import SichuanTechScraper
from scrapers.sichuan_nmpa import SichuanNmpaScraper

__all__ = ["GovChinaScraper", "NmpaNhsaScraper", "SichuanTechScraper", "SichuanNmpaScraper"]

ALL_SCRAPERS = [
    SichuanNmpaScraper,
    NmpaNhsaScraper,
    SichuanTechScraper,
    GovChinaScraper,
]

def get_all_scrapers():
    """获取所有启用的爬虫实例"""
    return [cls() for cls in ALL_SCRAPERS]

def get_enabled_scrapers() -> List[BaseScraper]:
    return [cls() for cls in ALL_SCRAPERS]
