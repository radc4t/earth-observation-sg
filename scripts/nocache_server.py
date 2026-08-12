import http.server
import os
import socketserver

os.chdir(os.path.join(os.path.dirname(__file__), ".."))


class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def log_message(self, *a):
        pass


with socketserver.TCPServer(("127.0.0.1", 8000), H) as httpd:
    httpd.serve_forever()
