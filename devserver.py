"""Local dev server that never lets the browser cache files (python -m http.server lets Chrome keep stale modules).
Run:  python devserver.py [port]      then open http://localhost:8765
"""
import http.server
import os
import sys


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))   # always serve this folder
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    http.server.ThreadingHTTPServer(('127.0.0.1', port), NoCache).serve_forever()
