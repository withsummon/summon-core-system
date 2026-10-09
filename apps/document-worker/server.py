import base64
import hmac
import ipaddress
import json
import multiprocessing
import os
import socket
import sys
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
from urllib.parse import unquote

import requests

from plane.utils.url_security import pinned_fetch, pinned_fetch_following_redirects

from summon_documents.context import DOCUMENT_TYPES, MAX_UPLOAD_BYTES, extract_context_document
from summon_documents.renderer import render_document_files
from summon_documents.exporter import export_workspace

MAX_RESPONSE_BYTES = 20 * 1024 * 1024
TIMEOUT_SECONDS = 30
_slots = threading.BoundedSemaphore(2)


def send_webhook(data):
    try:
        response = pinned_fetch("POST", data["url"],
            allowed_ips=[ipaddress.ip_network(value.strip(), strict=False)
                for value in os.environ.get("WEBHOOK_ALLOWED_IPS", "").split(",") if value.strip()],
            allowed_hosts=[value.strip().rstrip(".").lower()
                for value in os.environ.get("WEBHOOK_ALLOWED_HOSTS", "").split(",") if value.strip()],
            headers={"Content-Type": "application/json", "User-Agent": "Autopilot",
                "X-Plane-Delivery": data["delivery_id"], "X-Plane-Event": "issue",
                "X-Plane-Signature": data["signature"]},
            data=data["body"].encode("utf-8"), timeout=30, stream=True)
        try:
            return {"kind": "http", "status": response.status_code}
        finally:
            response.close()
    except requests.RequestException:
        return {"kind": "transport"}
    except ValueError:
        return {"kind": "blocked"}


def import_avatar(data):
    response, _ = pinned_fetch_following_redirects("GET", data["url"], timeout=10, max_redirects=5, stream=True,
        reject_url_credentials=True)
    try:
        if response.status_code != 200:
            raise ValueError("Avatar is unavailable.")
        content_type = response.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
        if content_type not in {"image/png", "image/jpeg", "image/gif", "image/webp"}:
            raise ValueError("Unsupported avatar type.")
        length = response.headers.get("Content-Length")
        if length is not None and (not length.isdigit() or int(length) > data["max_bytes"]):
            raise ValueError("Avatar exceeds the image limit.")
        chunks = []
        size = 0
        for chunk in response.iter_content(chunk_size=8192):
            size += len(chunk)
            if size > data["max_bytes"]:
                raise ValueError("Avatar exceeds the image limit.")
            chunks.append(chunk)
        if not size:
            raise ValueError("Avatar is empty.")
        return {"contentType": content_type, "base64": base64.b64encode(b"".join(chunks)).decode("ascii")}
    finally:
        response.close()


def execute(path, data, name, connection):
    try:
        if sys.platform == "linux":
            import resource

            resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024,) * 2)
            resource.setrlimit(resource.RLIMIT_CPU, (TIMEOUT_SECONDS,) * 2)
        if path == "/extract":
            upload = BytesIO(data)
            upload.name = name
            upload.size = len(data)
            result = extract_context_document(upload)
        elif path == "/import-avatar":
            result = import_avatar(data)
        elif path == "/webhook":
            result = send_webhook(data)
        elif path == "/export":
            result = export_workspace(data)
        else:
            result = {
                "artifacts": [
                    {
                        "name": file.filename,
                        "contentType": file.content_type,
                        "format": file.format,
                        "base64": base64.b64encode(file.data).decode("ascii"),
                    }
                    for file in render_document_files(data["document_type"], data["title"], data["content"])
                ]
            }
        encoded = json.dumps(result, ensure_ascii=False).encode("utf-8")
        if len(encoded) > MAX_RESPONSE_BYTES:
            raise ValueError("Generated document exceeds the output limit.")
        connection.send((200, encoded))
    except ValueError as error:
        connection.send((400, json.dumps({"error": str(error)}).encode("utf-8")))
    except Exception:
        connection.send((422, b'{"error":"Document could not be processed."}'))
    finally:
        connection.close()


def process_document(path, data, name):
    runtime = multiprocessing.get_context("spawn")
    receiver, sender = runtime.Pipe(duplex=False)
    process = runtime.Process(target=execute, args=(path, data, name, sender))
    process.start()
    sender.close()
    try:
        if not receiver.poll(TIMEOUT_SECONDS):
            return 504, b'{"error":"Document processing timed out."}'
        try:
            return receiver.recv()
        except EOFError:
            return 422, b'{"error":"Document could not be processed."}'
    finally:
        if process.is_alive():
            process.terminate()
        process.join(timeout=5)
        if process.is_alive():
            process.kill()
            process.join()
        receiver.close()


class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(10)

    def reply(self, status, data):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(data)

    def authenticated(self):
        expected = f"Bearer {self.server.token}".encode("utf-8")
        if not hmac.compare_digest(self.headers.get("Authorization", "").encode("utf-8"), expected):
            self.reply(401, b'{"error":"Authentication required."}')
            return False
        return True

    def do_GET(self):
        if self.authenticated():
            self.reply(200 if self.path == "/healthz" else 404, b'{"status":"ok"}' if self.path == "/healthz" else b'{}')

    def do_POST(self):
        if not self.authenticated():
            return
        if self.path not in {"/extract", "/render", "/export", "/import-avatar", "/webhook"}:
            self.reply(404, b'{"error":"Endpoint not found."}')
            return
        if not _slots.acquire(blocking=False):
            self.reply(429, b'{"error":"Document worker is busy. Try again."}')
            return
        try:
            lengths = self.headers.get_all("Content-Length", [])
            if self.headers.get("Transfer-Encoding") or len(lengths) != 1 or not lengths[0].isdigit():
                self.reply(400, b'{"error":"One Content-Length header is required."}')
                return
            length = int(lengths[0])
            if not 0 < length <= MAX_UPLOAD_BYTES:
                self.reply(413, b'{"error":"Document must not exceed 10 MB."}')
                return
            data = self.rfile.read(length)
            if len(data) != length:
                self.reply(400, b'{"error":"Incomplete document upload."}')
                return
            name = None
            media_type = self.headers.get_content_type()
            if self.path == "/extract":
                name = unquote(self.headers.get("X-Document-Name", ""), errors="strict")
                extension = Path(name).suffix.lower()
                if not name or len(name) > 255 or "/" in name or "\\" in name or any(ord(char) < 32 or ord(char) == 127 for char in name):
                    raise ValueError("Invalid document filename.")
                if media_type not in DOCUMENT_TYPES.get(extension, set()):
                    self.reply(415, b'{"error":"Unsupported document type."}')
                    return
            else:
                if media_type != "application/json":
                    self.reply(415, b'{"error":"Use application/json."}')
                    return
                data = json.loads(data)
                if self.path == "/webhook":
                    if not isinstance(data, dict) or set(data) != {"url", "body", "delivery_id", "signature"}:
                        raise ValueError("Invalid webhook request.")
                    if any(not isinstance(data[field], str) for field in data):
                        raise ValueError("Invalid webhook request.")
                    if not 0 < len(data["url"]) <= 1024 or not 0 < len(data["body"].encode("utf-8")) <= MAX_UPLOAD_BYTES:
                        raise ValueError("Invalid webhook request.")
                    if str(uuid.UUID(data["delivery_id"])) != data["delivery_id"]:
                        raise ValueError("Invalid webhook delivery identity.")
                    if len(data["signature"]) != 64 or any(char not in "0123456789abcdef" for char in data["signature"]):
                        raise ValueError("Invalid webhook signature.")
                if self.path == "/import-avatar":
                    if not isinstance(data, dict) or set(data) != {"url", "max_bytes"}:
                        raise ValueError("Invalid avatar import request.")
                    if not isinstance(data["url"], str) or not 0 < len(data["url"]) <= 2048:
                        raise ValueError("Invalid avatar URL.")
                    if type(data["max_bytes"]) is not int or not 0 < data["max_bytes"] <= 5 * 1024 * 1024:
                        raise ValueError("Invalid avatar image limit.")
                if self.path == "/render" and (not isinstance(data, dict) or set(data) != {"document_type", "title", "content"}):
                    raise ValueError("Invalid document render request.")
                if self.path == "/render":
                    for field, limit in {"document_type": 80, "title": 255, "content": 100000}.items():
                        if not isinstance(data[field], str) or not 0 < len(data[field]) <= limit:
                            raise ValueError("Invalid document render request.")
            status, result = process_document(self.path, data, name)
            self.reply(status, result)
        except ValueError:
            self.reply(400, b'{"error":"Invalid document request."}')
        except (socket.timeout, TimeoutError):
            self.reply(408, b'{"error":"Document upload timed out."}')
        finally:
            _slots.release()


if __name__ == "__main__":
    token = os.environ.get("DOCUMENT_WORKER_TOKEN", "")
    if len(token) < 32:
        raise ValueError("Configure DOCUMENT_WORKER_TOKEN with at least 32 characters.")
    server = ThreadingHTTPServer((os.environ.get("DOCUMENT_WORKER_HOST", "0.0.0.0"), int(os.environ.get("PORT", "8092"))), Handler)
    server.token = token
    server.serve_forever()
