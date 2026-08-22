"""
系统全局配置文件
用于管理微信推送渠道 Token、监控网站列表、关键词过滤与调度参数
"""
import os
from pathlib import Path

# 项目根目录
BASE_DIR = Path(__file__).resolve().parent

# 数据库文件路径（用于政策去重）
DB_PATH = os.path.join(BASE_DIR, "policy_records.db")

# ==========================================
# 1. 微信推送配置 (支持个人微信 & 微信群 & 云端 Actions)
# ==========================================

# 【推送目标选择】
# 'personal'       : 【云端与个人推荐】通过 PushPlus 发送到个人微信公众号 (支持 GitHub Actions 云端免开机)
# 'group_wecom'    : 发送到企业微信群/互通群机器人 Webhook (支持 GitHub Actions 云端免开机)
# 'all'            : 同时推送到群和个人微信
PUSH_TARGET = os.getenv("PUSH_TARGET", "personal")

# -----------------
# 渠道 A：PushPlus (个人微信推送)
# -----------------
# 用户配置的 PushPlus Token
PUSHPLUS_TOKEN = os.getenv("PUSHPLUS_TOKEN", "be87fdcbcef94066ab9132f5e8575005")
PUSHPLUS_TOPIC = os.getenv("PUSHPLUS_TOPIC", "")

# -----------------
# 渠道 B：企业微信群机器人 (推送到企微群/互通群)
# -----------------
WECHAT_WORK_WEBHOOK = os.getenv("WECHAT_WORK_WEBHOOK", "")

# -----------------
# 渠道 C：备选渠道 (Server酱 / WxPusher)
# -----------------
SERVERCHAN_KEY = os.getenv("SERVERCHAN_KEY", "")
WXPUSHER_APP_TOKEN = os.getenv("WXPUSHER_APP_TOKEN", "")
WXPUSHER_UIDS = os.getenv("WXPUSHER_UIDS", "")

# 默认个人渠道
DEFAULT_PUSH_CHANNEL = "pushplus"

# ==========================================
# 2. 政策采集与过滤配置
# ==========================================

# 每次执行最多推送的新增政策条数
MAX_PUSH_COUNT = 8

# 是否开启医药关键词过滤
ENABLE_KEYWORD_FILTER = True

# 医药集团重点关注的政策关键词
KEYWORDS = [
    "药品", "医疗", "医保", "药监", "中药", "生物医药", "器械", "医疗器械",
    "集采", "集中带量采购", "仿制药", "创新药", "医保目录", "支付方式", "DRG", "DIP",
    "医院", "卫健", "公立医院", "临床", "制药", "四川", "成渝", "产业基金",
    "中医药", "处方药", "罕见病", "国企改革", "医药工业",
    "同位素", "放射性", "核药", "核医疗", "脑机接口", "神经调控",
    "AI制药", "人工智能", "计算生物", "手术机器人", "医疗机器人", "智能康复",
    "重大新药创制", "科技专项", "科技创新", "研发补助", "资金申报"
]

# 监控源开关配置
ENABLED_SOURCES = {
    "gov_china": True,      # 中国政府网与各部委政策库 (国家政策与6大赛道)
    "nhsa": True,           # 国家药品监督管理局与医疗保障局 (NMPA/NHSA)
    "nmpa": True,           # 四川省药品监督管理局 (Sichuan NMPA)
    "sichuan_gov": True,    # 四川省科技创新与生物医药奖补专栏
}

# ==========================================
# 3. 智能 AI 摘要与深度解读配置 (Gemini 中转默认)
# ==========================================
AI_SUMMARY_ENABLED = True
AI_API_KEY = os.getenv("AI_API_KEY", "sk-016208dae3e5e97ef884aeaa5ce8bb04ac64e805cfa289fc22292541e600d17a")
AI_BASE_URL = os.getenv("AI_BASE_URL", "https://api.ailodsh.men/v1")
AI_MODEL = os.getenv("AI_MODEL", "gemini-2.5-flash")
# AI 请求超时（秒）与最大输出 token 数（设大避免长文被截断）
AI_REQUEST_TIMEOUT = int(os.getenv("AI_REQUEST_TIMEOUT", "180"))
AI_MAX_TOKENS = int(os.getenv("AI_MAX_TOKENS", "8192"))

# 爬虫通用网络请求配置
REQUEST_TIMEOUT = 12
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
