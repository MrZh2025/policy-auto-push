"""
微信消息推送模块
支持 PushPlus 个人微信、企业微信群机器人 Webhook 等通道
"""
import requests
import json
import logging
from typing import Dict, Any, Optional
import config

logger = logging.getLogger(__name__)

class WeChatNotifier:
    """微信通知分发器"""

    def __init__(self):
        self.target_mode = config.PUSH_TARGET.lower()

    def dispatch(self, title: str, content: str) -> bool:
        """根据配置分发消息"""
        success_flags = []

        # 1. 优先发送到 PushPlus 个人微信
        if self.target_mode in ["personal", "all"]:
            p_res = self._send_via_pushplus(title, content)
            success_flags.append(p_res)

        # 2. 发送到企业微信群机器人 Webhook
        if self.target_mode in ["group_wecom", "all"] and config.WECHAT_WORK_WEBHOOK:
            w_res = self.send_to_wecom_group(title, content)
            success_flags.append(w_res)

        return any(success_flags) if success_flags else False

    def _send_via_pushplus(self, title: str, content: str) -> bool:
        token = config.PUSHPLUS_TOKEN
        if not token or "在此填入" in token:
            logger.warning("[PushPlus 未配置 Token]")
            return False

        url = "http://www.pushplus.plus/send"
        payload = {
            "token": token,
            "title": title[:50],
            "content": content,
            "template": "markdown",
            "channel": "wechat"
        }
        if config.PUSHPLUS_TOPIC:
            payload["topic"] = config.PUSHPLUS_TOPIC

        try:
            resp = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=10)
            res_json = resp.json()
            if res_json.get("code") == 200:
                logger.info(f"✅ [PushPlus 个人微信] 政策早报推送成功: {title}")
                return True
            else:
                logger.error(f"❌ [PushPlus] 推送失败: {res_json.get('msg')} (code={res_json.get('code')})")
                return False
        except Exception as e:
            logger.error(f"❌ [PushPlus] 请求异常: {e}")
            return False

    def send_to_wecom_group(self, title: str, content: str) -> bool:
        webhook_url = config.WECHAT_WORK_WEBHOOK
        if not webhook_url:
            return False

        payload = {
            "msgtype": "markdown",
            "markdown": {
                "content": f"## {title}\n\n{content}"
            }
        }
        try:
            resp = requests.post(webhook_url, json=payload, headers={"Content-Type": "application/json"}, timeout=10)
            res_json = resp.json()
            if res_json.get("errcode") == 0:
                logger.info(f"✅ [企业微信群] 推送成功: {title}")
                return True
            else:
                logger.error(f"❌ [企业微信群] 推送失败: {res_json.get('errmsg')}")
                return False
        except Exception as e:
            logger.error(f"❌ [企业微信群] 网络异常: {e}")
            return False
