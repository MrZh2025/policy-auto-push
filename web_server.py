"""
医药政策自动化平台 - 轻量 Web 后端服务
提供 RESTful API 与静态页面托管，支持浏览器即开即用
"""
import http.server
import socketserver
import json
import os
import sys
import io
import urllib.parse
from datetime import datetime

# 安全配置 Windows 控制台输出编码
if sys.platform == 'win32' and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from database import PolicyDatabase
from ai_analyst import AIAnalyst, SICHUAN_WEEKLY_PROMPT_TEMPLATE
from doc_exporter import PolicyDocExporter
from notifier import WeChatNotifier
from main import run_pipeline
import config

PORT = 8080
WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")

_IP_LOCATION_CACHE = {}

def resolve_ip_location(ip: str) -> str:
    """智能解析客户端 IP 地理位置（支持本地专线、内网及公网多重容灾查询）"""
    if not ip or ip in ("127.0.0.1", "localhost", "::1", "0.0.0.0"):
        return "四川省成都市 (本地控制台)"
    
    # 局域网内网识别
    if ip.startswith("192.168.") or ip.startswith("10.") or ip.startswith("172.16.") or ip.startswith("172.17.") or ip.startswith("172.18.") or ip.startswith("172.19.") or ip.startswith("172.2") or ip.startswith("172.3"):
        return "企业专线网络 (四川·成都)"
        
    if ip in _IP_LOCATION_CACHE:
        return _IP_LOCATION_CACHE[ip]

    location = "中国 · 专网接入"
    try:
        import urllib.request
        req = urllib.request.Request(
            f"http://ip-api.com/json/{ip}?lang=zh-CN",
            headers={"User-Agent": "Mozilla/5.0"}
        )
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if data.get("status") == "success":
                country = data.get("country", "")
                region = data.get("regionName", "")
                city = data.get("city", "")
                parts = [p for p in [region, city] if p]
                if parts:
                    location = "".join(parts) if country in ("中国", "China") else f"{country} {region} {city}".strip()
                elif country:
                    location = country
    except Exception:
        try:
            import urllib.request
            req = urllib.request.Request(
                f"http://whois.pconline.com.cn/ipJson.jsp?ip={ip}&json=true",
                headers={"User-Agent": "Mozilla/5.0"}
            )
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                content = resp.read().decode('gbk', errors='ignore')
                data = json.loads(content)
                addr = data.get("addr", "").strip()
                if addr:
                    location = addr
        except Exception:
            pass

    _IP_LOCATION_CACHE[ip] = location
    return location

def safe_log(msg: str):
    try:
        print(msg, flush=True)
    except Exception:
        pass

class PolicyWebHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def log_message(self, format, *args):
        # 简化日志，避免控制台报错
        pass

    def get_client_ip(self) -> str:
        """获取客户端真实 IP 地址"""
        forwarded = self.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        real_ip = self.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
        return self.client_address[0] if self.client_address else "127.0.0.1"

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/policies":
            self.handle_get_policies(parsed)
        elif path == "/api/stats":
            self.handle_get_stats()
        elif path == "/api/visitor-stats":
            self.handle_get_visitor_stats()
        elif path == "/api/bci-enterprises":
            self.handle_get_bci_enterprises()
        elif path == "/api/bci-experts":
            self.handle_get_bci_experts()
        elif path == "/api/config":
            self.handle_get_config()
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
        body = json.loads(post_data) if post_data else {}

        if path == "/api/visit":
            self.handle_record_visit(body)
        elif path == "/api/chat":
            self.handle_ai_chat(body)
        elif path == "/api/weekly-report":
            self.handle_weekly_report(body)
        elif path == "/api/scrape-now":
            self.handle_scrape_now()
        elif path == "/api/export-word":
            self.handle_export_word()
        elif path == "/api/push-wechat":
            self.handle_push_wechat()
        else:
            self.send_error(404, "Endpoint Not Found")

    def _json_response(self, data, status=200):
        try:
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))
        except Exception as e:
            safe_log(f"Response error: {e}")

    def handle_get_policies(self, parsed):
        db = PolicyDatabase()
        query_params = urllib.parse.parse_qs(parsed.query)
        category = query_params.get("category", ["all"])[0]
        keyword = query_params.get("q", [""])[0]

        with db._get_connection() as conn:
            cursor = conn.cursor()
            sql = "SELECT * FROM policies WHERE 1=1"
            params = []
            if category and category != "all":
                sql += " AND (category = ? OR category LIKE ?)"
                params.extend([category, f"%{category}%"])
            if keyword:
                sql += " AND (title LIKE ? OR summary LIKE ? OR source LIKE ?)"
                params.extend([f"%{keyword}%", f"%{keyword}%", f"%{keyword}%"])
            sql += " ORDER BY pub_date DESC, id DESC LIMIT 100"
            cursor.execute(sql, params)
            rows = [dict(r) for r in cursor.fetchall()]
        self._json_response({"code": 0, "data": rows, "count": len(rows)})

    def handle_get_stats(self):
        db = PolicyDatabase()
        stats = db.get_stats()
        with db._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT category, COUNT(*) as cnt FROM policies GROUP BY category")
            categories = {row["category"]: row["cnt"] for row in cursor.fetchall()}
        self._json_response({"code": 0, "data": {"stats": stats, "categories": categories}})

    def handle_get_visitor_stats(self):
        """获取访客人数、时间、地点及地域分布统计"""
        client_ip = self.get_client_ip()
        curr_loc = resolve_ip_location(client_ip)
        db = PolicyDatabase()
        visitor_stats = db.get_visitor_stats()
        visitor_stats["current_client"] = {
            "ip": client_ip,
            "location": curr_loc,
            "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        self._json_response({"code": 0, "data": visitor_stats})

    def handle_record_visit(self, body):
        """记录访客一次访问打点"""
        client_ip = self.get_client_ip()
        visitor_id = body.get("visitor_id", "")
        reported_loc = body.get("location", "")
        path = body.get("path", "/")
        user_agent = self.headers.get("User-Agent", "")

        # 优先使用传入地点，若无则服务端智能解析
        location = reported_loc if (reported_loc and reported_loc != "未知地点") else resolve_ip_location(client_ip)

        db = PolicyDatabase()
        visitor_stats = db.record_visit(
            ip=client_ip,
            location=location,
            visitor_id=visitor_id,
            user_agent=user_agent,
            path=path
        )
        visitor_stats["current_client"] = {
            "ip": client_ip,
            "location": location,
            "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        self._json_response({"code": 0, "msg": "访问记录成功", "data": visitor_stats})

    def handle_get_bci_enterprises(self):
        """获取脑机接口全国企业投资地图数据"""
        json_path = os.path.join(WEB_DIR, "data", "bci_enterprises.json")
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self._json_response(data)
        except Exception as e:
            self._json_response({"code": -1, "msg": str(e)}, status=500)

    def handle_get_bci_experts(self):
        """获取脑机接口全国专家智库地图数据"""
        json_path = os.path.join(WEB_DIR, "data", "bci_experts.json")
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self._json_response(data)
        except Exception as e:
            self._json_response({"code": -1, "msg": str(e)}, status=500)

    def handle_get_config(self):
        self._json_response({
            "code": 0,
            "data": {
                "push_target": config.PUSH_TARGET,
                "has_pushplus": bool(config.PUSHPLUS_TOKEN and "在此填入" not in config.PUSHPLUS_TOKEN),
                "has_ai_key": bool(config.AI_API_KEY),
                "ai_model": config.AI_MODEL,
                "weekly_prompt": SICHUAN_WEEKLY_PROMPT_TEMPLATE
            }
        })

    def handle_ai_chat(self, body):
        prompt = body.get("prompt", "")
        api_key = body.get("api_key", "")
        base_url = body.get("base_url", "")
        model = body.get("model", "")
        db = PolicyDatabase()
        with db._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM policies ORDER BY id DESC LIMIT 10")
            recent_policies = [dict(r) for r in cursor.fetchall()]

        reply = AIAnalyst.chat(prompt, api_key=api_key, base_url=base_url, model=model, context_policies=recent_policies)
        self._json_response({"code": 0, "reply": reply})

    def handle_weekly_report(self, body):
        api_key = body.get("api_key", "")
        base_url = body.get("base_url", "")
        model = body.get("model", "")
        db = PolicyDatabase()
        with db._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM policies ORDER BY id DESC LIMIT 15")
            recent_policies = [dict(r) for r in cursor.fetchall()]

        report = AIAnalyst.generate_sichuan_weekly_report(api_key=api_key, base_url=base_url, model=model, policies=recent_policies)
        self._json_response({"code": 0, "report": report})

    def handle_scrape_now(self):
        try:
            run_pipeline(force_push=False)
            self._json_response({"code": 0, "msg": "全网政策采集与去重已完成！"})
        except Exception as e:
            self._json_response({"code": -1, "msg": str(e)}, status=500)

    def handle_export_word(self):
        try:
            db = PolicyDatabase()
            with db._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM policies ORDER BY pub_date DESC, id DESC LIMIT 100")
                all_policies = [dict(r) for r in cursor.fetchall()]
            
            # 严格筛选本周政策
            now = datetime.now()
            now_year = now.year
            week_policies = []
            for p in all_policies:
                d_str = p.get("pub_date", "")
                if not d_str:
                    continue
                m = re.search(r"(\d{4})[-.\/年](\d{1,2})[-.\/月](\d{1,2})", d_str)
                if not m:
                    continue
                p_year = int(m.group(1))
                if p_year != now_year:
                    continue
                p_date = datetime(p_year, int(m.group(2)), int(m.group(3)))
                diff = (now - p_date).days
                if -1 <= diff <= 7:
                    week_policies.append(p)

            export_list = week_policies if week_policies else all_policies[:8]
            paths = PolicyDocExporter.export(export_list)
            self._json_response({"code": 0, "paths": paths, "count": len(export_list), "msg": f"已将本周 {len(export_list)} 篇政策公文简报成功保存到桌面！"})
        except Exception as e:
            self._json_response({"code": -1, "msg": str(e)}, status=500)

    def handle_push_wechat(self):
        try:
            db = PolicyDatabase()
            unpushed = db.get_unpushed_policies(limit=8)
            if not unpushed:
                with db._get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute("SELECT * FROM policies ORDER BY id DESC LIMIT 8")
                    unpushed = [dict(r) for r in cursor.fetchall()]
            from formatter import PolicyFormatter
            digest = PolicyFormatter.build_daily_digest(unpushed)
            notifier = WeChatNotifier()
            success = notifier.dispatch(digest["title"], digest["content"])
            if success:
                self._json_response({"code": 0, "msg": "微信推送成功！已送达您的手机微信。"})
            else:
                self._json_response({"code": -1, "msg": "微信推送未成功，请检查 Token 配置。"})
        except Exception as e:
            self._json_response({"code": -1, "msg": str(e)}, status=500)

class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

def start_server():
    os.makedirs(WEB_DIR, exist_ok=True)
    # 允许端口快速重用
    socketserver.TCPServer.allow_reuse_address = True
    
    server_address = ("", PORT)
    with ThreadingHTTPServer(server_address, PolicyWebHandler) as httpd:
        safe_log("=" * 60)
        safe_log(f"🚀 医药健康产业集团政策监测信息系统 Web 服务已启动！")
        safe_log(f"👉 本地访问地址: http://127.0.0.1:{PORT}")
        safe_log("=" * 60)
        
        try:
            import webbrowser
            webbrowser.open(f"http://127.0.0.1:{PORT}")
        except Exception:
            pass
            
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            safe_log("\n正在停止服务...")
            httpd.server_close()

if __name__ == "__main__":
    start_server()
