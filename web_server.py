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

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/policies":
            self.handle_get_policies(parsed)
        elif path == "/api/stats":
            self.handle_get_stats()
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

        if path == "/api/chat":
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
                cursor.execute("SELECT * FROM policies ORDER BY id DESC LIMIT 12")
                policies = [dict(r) for r in cursor.fetchall()]
            paths = PolicyDocExporter.export(policies)
            self._json_response({"code": 0, "paths": paths, "msg": "Word 公文简报已成功保存到您的桌面！"})
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
        safe_log(f"🚀 医药产业政策大屏 Web 服务已启动！")
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
