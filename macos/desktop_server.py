#!/usr/bin/env python3

import json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


WEB_DIR = Path(__file__).resolve().parent / "web"
PORT = 8766


class LabRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        super().end_headers()

    def do_GET(self):
        if self.path == "/api/health":
            payload = json.dumps({"service": "partner-readiness-lab", "version": 1}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        super().do_GET()

    def do_POST(self):
        self.send_error(405, "This static server accepts GET and HEAD requests only")


def main():
    handler = partial(LabRequestHandler, directory=str(WEB_DIR))
    server = ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    print(f"Partner Readiness Lab: http://127.0.0.1:{PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
