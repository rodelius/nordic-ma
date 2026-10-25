"""Vercel Python function. Only signed internal requests may run the parser."""
from http.server import BaseHTTPRequestHandler
import hashlib
import hmac
import json
import os
from pathlib import Path
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "python"))
from corporate_parser import parse


def authenticated(body, timestamp, signature, now=None):
    secret = os.environ.get("SUPABASE_SECRET_KEY", "")
    if not secret or not timestamp.isdigit() or abs((now or time.time()) - int(timestamp)) > 60:
        return False
    # Domain-separated signing key, never sent to the function over HTTP.
    key = hashlib.sha256(("corporate-rule-parser:" + secret).encode()).digest()
    expected = hmac.new(key, timestamp.encode() + b"." + body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


class handler(BaseHTTPRequestHandler):
    def reply(self, status, value):
        body = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "private, no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 350000:
                return self.reply(413, {"error": "Invalid parser request size"})
            body = self.rfile.read(size)
            if not authenticated(body, self.headers.get("X-Parser-Time", ""), self.headers.get("X-Parser-Signature", "")):
                return self.reply(403, {"error": "Signed parser request required"})
            value = json.loads(body)
            return self.reply(200, parse(value.get("text")))
        except (ValueError, TypeError, AttributeError):
            return self.reply(400, {"error": "Invalid parser input"})

    def do_GET(self):
        self.reply(405, {"error": "POST required"})

    def log_message(self, *_args):
        pass  # Do not log article text or signed headers.
