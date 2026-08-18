"""
爬虫包初始化与注册工厂
"""
from typing import List, Type
from scrapers.base import BaseScraper
from scrapers.gov_china import GovChinaScraper
from scrapers.nmpa_nhsa import NmpaNhsaScraper
from scrapers.sichuan_tech import SichuanTechScraper
import config

__all__ = ["GovChinaScraper", "NmpaNhsaScraper", "SichuanTechScraper"]

ALL_SCRAPERS: List[Type[BaseScraper]] = [
    GovChinaScraper,
    NmpaNhsaScraper,
    SichuanTechScraper,
]

def get_all_scrapers():
    """获取所有启用的爬虫实例"""
    return [
        NmpaNhsaScraper(),
        SichuanTechScraper(),
        GovChinaScraper(),
    ]

def get_enabled_scrapers() -> List[BaseScraper]:
    return [cls() for cls in ALL_SCRAPERS]
