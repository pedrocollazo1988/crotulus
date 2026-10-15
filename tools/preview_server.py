#!/usr/bin/env python3
"""Servidor de vista previa: sirve SOLO los archivos estaticos publicos.

No expone app/, api/, admin/, deploy/ ni la configuracion. Las llamadas a
/api/* devuelven un JSON minimo para que el front se vea igual que en
produccion aunque el backend PHP no este disponible en este entorno.
"""
import http.server, socketserver, os, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALLOW_FILES = {"index.html", "empresa.html", "404.html", "robots.txt", "sitemap.xml"}
ALLOW_DIRS = {"css", "js", "assets", "preview"}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def translate_path(self, path):
        p = path.split("?", 1)[0].split("#", 1)[0]
        rel = p.lstrip("/")
        if rel == "" or rel.endswith("/"):
            rel = (rel + "index.html").lstrip("/")
        first = rel.split("/", 1)[0]
        if first not in ALLOW_DIRS and rel not in ALLOW_FILES:
            return os.path.join(ROOT, "__blocked__")
        return os.path.join(ROOT, rel)

    def do_GET(self):
        if self.path.startswith("/api/"):
            return self._api()
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/"):
            return self._api()
        self.send_error(405)

    def _api(self):
        q = self.path.split("?", 1)[1] if "?" in self.path else ""
        params = dict(kv.split("=", 1) for kv in q.split("&") if "=" in kv)
        if params.get("action") == "csrf":
            body = {"ok": True, "csrf_token": "preview-csrf"}
        elif params.get("action") == "captcha":
            body = {"ok": True, "challenge": "7 + 5 = ?", "token": "preview.token"}
        elif params.get("resource") == "session":
            body = {"ok": True, "logged_in": False}
        elif params.get("resource") == "settings":
            body = {"ok": True, "settings": {}}
        else:
            body = {"ok": True, "items": []}
        data = json.dumps(body).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *a):
        pass


class Reusable(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


with Reusable(("0.0.0.0", 12000), Handler) as httpd:
    print("Vista previa en :12000", flush=True)
    httpd.serve_forever()
