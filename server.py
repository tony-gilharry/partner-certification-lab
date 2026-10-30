#!/usr/bin/env python3
"""Serve the Partner Certification Lab locally with Python's standard library."""

import argparse
import os
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


STATIC_DIR = Path(__file__).resolve().parent / "static"


class LabRequestHandler(SimpleHTTPRequestHandler):
    """Serve static files with local-development safety headers."""

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        super().end_headers()

    def do_POST(self):
        self.send_error(405, "This static server accepts GET and HEAD requests only")


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1", help="Bind address")
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("PORT", "8765")),
        help="Listen port, default: 8765",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    handler = partial(LabRequestHandler, directory=str(STATIC_DIR))
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Partner Certification Lab: http://{args.host}:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
