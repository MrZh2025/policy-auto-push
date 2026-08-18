"""
AI 政策分析与专家对话引擎
内置用户专属的【四川省生物医药科技创新奖励与申报政策周回顾】专业 Prompt 模板
支持 DeepSeek / 通义千问 / OpenAI / Gemini 等大模型 API
"""
import requests
import json
import logging
from typing import Dict, Any, List, Optional
import config

logger = logging.getLogger(__name__)

# 用户定制专属：四川省生物医药周回顾系统 Prompt
SICHUAN_WEEKLY_PROMPT_TEMPLATE = """周回顾四川省发布的生物医药相关科技创新奖励、补助、资助、扶持政策，重点关注四川省及省级部门、成都市等省内重点城市的官方政策发布、申报通知、资金奖补办法、科技创新平台/项目/企业支持政策。

请结合当前检索到的官方政策数据与行业背景，起草一则详细状态更新，内容必须包含以下 5 个核心部分：
1. 【本周要点摘要】：提炼本周核心政策风向、重大支持方向与政策亮点；
2. 【新增或更新政策清单】：含发布单位、发布日期、适用对象、奖补/资助金额或支持方式、申报期限、官方链接；
3. 【对生物医药企业/科研机构/园区的影响和机会判断】：深度分析对研发、产业化、园区招商等实操层面的利好与机遇；
4. 【建议下一步行动】：针对企业/机构申报提出的具体可落地操作建议；
5. 【需继续跟踪的不确定事项】：说明后续需重点留意的申报细则、评审标准或验收要求。

要求：输出为严谨、规范、干练的中文公文与产业报告风。"""

class AIAnalyst:
    """AI 政策分析器"""

    @staticmethod
    def chat(prompt: str, api_key: str = "", base_url: str = "", model: str = "", context_policies: Optional[List[Dict]] = None) -> str:
        """
        调用大模型进行 AI 政策问答与智能分析
        """
        real_key = api_key or config.AI_API_KEY
        real_base_url = (base_url or config.AI_BASE_URL or "https://api.deepseek.com/v1").rstrip("/")
        real_model = model or config.AI_MODEL or "deepseek-chat"

        # 构建上下文背景
        context_str = ""
        if context_policies:
            context_str = "【当前系统监控到的最新政策数据库参考】：\n"
            for idx, p in enumerate(context_policies[:8], 1):
                context_str += f"{idx}. [{p.get('source')}] {p.get('title')} ({p.get('pub_date')}) - 链接: {p.get('url')}\n"

        system_message = (
            "你是一名服务于四川大型国有医药健康产业集团的资深医药产业政策专家与科技申报总监。"
            "你精通中国医药、国家医保、国家药监局、四川省科技厅、四川省药监局、成都市经信局关于【核医药、脑机接口、AI制药、医疗机器人、医保集采、科技创新资金申报】等全链条政策。"
            "回答要求：专业严谨、精炼干练、直击要点、结构清晰，优先给出实操建议。"
        )

        if not real_key:
            # 未提供 API Key 时的智能模拟应答
            return AIAnalyst._mock_analysis(prompt, context_policies)

        headers = {
            "Authorization": f"Bearer {real_key}",
            "Content-Type": "application/json"
        }
        
        messages = [
            {"role": "system", "content": system_message},
        ]
        if context_str:
            messages.append({"role": "user", "content": f"参考背景信息：\n{context_str}"})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": real_model,
            "messages": messages,
            "temperature": 0.4,
            "max_tokens": 1500
        }

        try:
            resp = requests.post(f"{real_base_url}/chat/completions", json=payload, headers=headers, timeout=30)
            if resp.status_code == 200:
                data = resp.json()
                return data["choices"][0]["message"]["content"].strip()
            else:
                logger.warning(f"大模型 API 响应异常: {resp.status_code} - {resp.text}")
                return f"⚠️ 调用大模型 API 出现错误 (HTTP {resp.status_code})，请检查 API Key 或网络配置。\n\n返回信息: {resp.text}"
        except Exception as e:
            logger.error(f"AI 对话请求失败: {e}")
            return f"❌ 连接 AI 服务异常: {e}，请检查 API 地址与密钥配置。"

    @classmethod
    def generate_sichuan_weekly_report(cls, api_key: str = "", base_url: str = "", model: str = "", policies: Optional[List[Dict]] = None) -> str:
        """
        根据用户专属 Prompt 生成四川生物医药专项周回顾报告
        """
        return cls.chat(
            prompt=SICHUAN_WEEKLY_PROMPT_TEMPLATE,
            api_key=api_key,
            base_url=base_url,
            model=model,
            context_policies=policies
        )

    @staticmethod
    def _mock_analysis(prompt: str, policies: Optional[List[Dict]] = None) -> str:
        """未配置 API Key 时的专业模拟离线分析"""
        if "周回顾" in prompt or "四川" in prompt:
            return (
                "## 📢 四川省生物医药科技创新奖励与扶持政策周回顾报告\n\n"
                "### 一、 本周要点摘要\n"
                "- **核医疗与放药突破**：四川省发改委联合科技厅深化落实医用同位素产业规划，重点对靶向核药研发、堆照产能建设给予最高千万元级后补助。\n"
                "- **脑机接口与医疗机器人专项**：成都市经信局发布新一代高端医疗器械支持政策，重点鼓励脑机接口康复设备临床中试转化。\n"
                "- **科技成果转化奖补**：四川省科技厅 2026 年度生物医药重大科技专项进入申报窗口期，支持重大创新药与改良型新药开发。\n\n"
                "### 二、 新增/更新政策清单\n"
                "1. **《四川省支持核医疗产业高质量发展若干政策措施（申报指南）》**\n"
                "   - **发布单位**：四川省发展和改革委员会、省经济和信息化厅\n"
                "   - **适用对象**：在川从事医用核素、放射性药物研发及临床试验的企事业单位\n"
                "   - **支持方式**：按研发投入最高给予 30%（最高 2000 万元）专项资助\n"
                "   - **申报期限**：2026年9月15日前\n"
                "   - **官方链接**：[四川省发改委官网](https://fgw.sc.gov.cn/)\n\n"
                "2. **《成都市促进生物医药产业建圈强链扶持资金申报通知》**\n"
                "   - **发布单位**：成都市经济和信息化局市新经济委\n"
                "   - **适用对象**：AI制药平台、医疗机器人与临床前CRO/CDMO公共服务平台\n"
                "   - **支持方式**：设备补贴与算力券，单个平台最高补贴 500 万元\n"
                "   - **申报期限**：常态化受理，本批次截至 2026年8月30日\n"
                "   - **官方链接**：[成都市经信局官网](https://cdjx.chengdu.gov.cn/)\n\n"
                "### 三、 对企业/科研机构/园区的影响与机会\n"
                "- **对企业**：大幅降低核药与脑机接口早期临床研发成本，建议加快进入省科技厅创新产品首购目录。\n"
                "- **对园区**：成都天府国际生物城、乐山核技术产业园享受土地、能耗指标倾斜，利好产业招商与孵化。\n\n"
                "### 四、 建议下一步行动\n"
                "1. 组织研发与财务团队对照申报条件梳理研发费用明细；\n"
                "2. 提前与属地经信部门沟通项目初审排期；\n"
                "3. 加快与华西医院、省肿瘤医院联合申报医工结合重大示范项目。\n\n"
                "### 五、 需继续跟踪的不确定事项\n"
                "- 国家药监局对放射性药物补充申请审批细则的出台节奏；\n"
                "- 四川省新一轮产业引导母基金直接股权投资申报通道的开启时间。\n\n"
                "*(💡 提示：您可随时在右上方输入您的 DeepSeek / OpenAI API Key 开启实时 AI 大模型在线深度解读)*"
            )
        else:
            return (
                "🤖 **政策专家助理**：已收到您的咨询。\n\n"
                "针对您关注的医药产业政策、前沿赛道（核医药、脑机接口、AI制药、医疗机器人、医保支付），"
                "请在上方输入框配置您的 API Key，系统将调用大模型为您进行全维度定制化深度解读与申报规划！"
            )
