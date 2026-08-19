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

    # 强排斥负向关键词（排除完全不相干或非医药核心领域政策）
    EXCLUDE_KEYWORDS = [
        "林草", "林业", "森林", "草原", "地质", "矿产", "煤炭", "交通运输",
        "航海", "船舶", "水利", "防汛", "气象", "殡葬", "海关总署关于印发",
        "农机", "化肥", "农药", "生猪", "畜牧", "水产养殖", "航空口岸",
        "农村改革", "乡村振兴", "救助管理机构", "安全生产责任保险",
        "旅行服务出口", "入境消费", "贸易标准化", "互助性养老", "养老机构突发事件"
    ]

    # 核心医药强特征词（必须属于医药健康/器械/科技创新领域）
    CORE_PHARMA_KEYWORDS = [
        "药", "医", "卫健", "卫生", "疾控", "临床", "器械", "中药",
        "生物", "病", "诊疗", "制药", "脑机", "同位素", "放药", "核医疗",
        "手术机器人", "集采", "带量采购", "处方", "罕见病", "健康", "医疗器械"
    ]

    @staticmethod
    def classify_policy(title: str, summary: str = "", source: str = "") -> str:
        """
        医药健康产业高精度政策分类引擎（严格杜绝泛关键词误判）：
        1. ⚛️ 核医药与放射性药物
        2. 🧠 脑机接口与神经工程
        3. 🧬 AI制药与前沿算法 (必须是 AI + 药物研发/分子设计/靶点/计算生物/药品监管)
        4. 🤖 医疗机器人与智能器械 (必须是 手术/康复/医疗机器人 或 创新/智能医疗器械)
        5. 🧪 合成生物与先进制造 (合成生物学、底盘细胞、生物制造、细胞工厂)
        6. 💳 医保政策与集采支付 (医保、集采、带量采购、双通道、DRG/DIP、目录、支付)
        7. 📑 科技申报政策 (科技重大专项、申报通知、研发补助、创新平台等综合科技支持政策)
        """
        t = f"{title} {summary}".lower()
        title_lower = title.lower()

        # 1. 核医药与放射性药物 (优先级最高，特征明确)
        if any(k in t for k in ["核药", "放射性药", "放射性物", "医用同位素", "核医学", "放药", "同位素标记", "核技术医疗", "放射性体内"]):
            return "核医药"

        # 2. 脑机接口与神经工程 (优先级次之，特征明确)
        if any(k in t for k in ["脑机接口", "脑机", "神经工程", "神经调控", "类脑智能", "脑电", "脑起搏器", "神经假体"]):
            return "脑机接口"

        # 3. 合成生物与先进制造
        if any(k in t for k in ["合成生物", "生物制造", "底盘细胞", "细胞工厂", "生物催化", "合成生物学", "基因编辑合成"]):
            return "合成生物"

        # 4. 医保政策与集采支付 (医保支付、集采、目录、挂网)
        if any(k in t for k in ["医保", "集采", "带量采购", "集中采购", "医保目录", "药品目录", "双通道", "挂网", "drg", "dip", "医疗保障", "谈判药"]):
            return "医保政策"

        # 5. AI制药与前沿算法 (严谨判定：必须是 AI + 药品/制药/研发/靶点/化合物/药品监管)
        has_ai = any(k in t for k in ["ai制药", "计算生物", "算法制药", "虚拟筛选", "靶点发现", "分子生成", "蛋白质结构预测", "计算药理", "计算化学生物"])
        if has_ai:
            return "AI制药"
        if any(k in t for k in ["人工智能", "大模型", "算法", "深度学习", "机器学习"]):
            if any(k in t for k in ["新药", "制药", "药品研发", "药物研发", "生物医药", "药品监管", "药物设计", "靶点", "化合物", "临床试验", "药理", "药效"]):
                if not any(ex in title_lower for ex in ["养老", "贸易", "旅游", "消费", "交通", "金融保险"]):
                    return "AI制药"

        # 6. 医疗机器人与智能器械 (严谨判定：必须是医疗机器人或医用智能/高端器械)
        has_robot = any(k in t for k in ["医疗机器人", "手术机器人", "康复机器人", "外骨骼机器人", "骨科机器人", "内窥镜机器人", "血管介入机器人", "手术导航"])
        if has_robot:
            return "医疗机器人"
        if "机器人" in t and any(k in t for k in ["医疗", "手术", "康复", "诊疗", "病房", "医用", "患者"]):
            return "医疗机器人"
        if "医疗器械" in title_lower and any(k in title_lower for k in ["生产质量", "注册", "审评", "备案", "出口销售", "质量管理", "临床评价", "分类目录"]):
            return "医疗机器人"

        # 7. 科技申报与资金奖补 (默认归入科技创新申报与综合政策)
        return "科技申报政策"

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
