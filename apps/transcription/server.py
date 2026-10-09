import base64
import hashlib
import hmac
import json
import multiprocessing
import os
import re
import sqlite3
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

MAX_BYTES = int(os.environ.get("TRANSCRIPTION_MAX_BYTES", 262_144_000))
AUDIO_TYPES = {
    "audio/mpeg",
    "audio/mp4",
    "audio/x-m4a",
    "audio/wav",
    "audio/x-wav",
    "audio/webm",
    "audio/ogg",
}
JOB_ID = re.compile(r"[a-z0-9]{32}")
_model = None
_model_lock = threading.Lock()


def _timestamp(seconds):
    total = int(seconds)
    return f"{total // 3600:02d}:{total % 3600 // 60:02d}:{total % 60:02d}"


def transcribe_file(model, path):
    segments, info = model.transcribe(path, beam_size=5, vad_filter=True)
    lines = [
        f"[{_timestamp(segment.start)}] {segment.text.strip()}"
        for segment in segments
        if segment.text.strip()
    ]
    return {"text": "\n".join(lines), "language": info.language}


def get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel

        _model = WhisperModel(
            os.environ.get("WHISPER_MODEL", "small"),
            device=os.environ.get("WHISPER_DEVICE", "cpu"),
            compute_type=os.environ.get("WHISPER_COMPUTE_TYPE", "int8"),
            download_root=os.environ.get("WHISPER_MODEL_DIR", "/models"),
        )
    return _model


def decode_file(path, connection):
    parent = multiprocessing.parent_process()

    def watch_parent():
        while parent.is_alive():
            time.sleep(0.1)
        os._exit(1)

    threading.Thread(target=watch_parent, daemon=True).start()
    try:
        connection.send((True, transcribe_file(get_model(), path)))
    except Exception:
        connection.send((False, None))
    finally:
        connection.close()


def transcribe(path, cancelled=None, timeout=1800):
    # One decoder process at a time, including the legacy synchronous endpoint.
    # Per-job processes reload the cached model but permit hard cancellation.
    with _model_lock:
        if cancelled and cancelled():
            raise ValueError("cancelled")
        runtime = multiprocessing.get_context("spawn")
        receiver, sender = runtime.Pipe(duplex=False)
        process = runtime.Process(target=decode_file, args=(str(path), sender))
        process.start()
        sender.close()
        try:
            deadline = time.monotonic() + timeout
            while True:
                if cancelled and cancelled():
                    raise ValueError("cancelled")
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise TimeoutError("processing_timeout")
                if receiver.poll(min(0.1, remaining)):
                    succeeded, result = receiver.recv()
                    if succeeded:
                        return result
                    raise ValueError("transcription_failed")
                if not process.is_alive():
                    raise ValueError("transcription_failed")
        finally:
            if process.is_alive():
                process.terminate()
            process.join(timeout=5)
            if process.is_alive():
                process.kill()
                process.join()
            receiver.close()


class Jobs:
    def __init__(self, directory):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.directory.chmod(0o700)
        self.lock = threading.RLock()
        self.wake = threading.Event()
        self.db = sqlite3.connect(self.directory / "jobs.sqlite3", check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.retention = int(os.environ.get("TRANSCRIPTION_RETENTION_SECONDS", 86400))
        self.max_pending = int(os.environ.get("TRANSCRIPTION_MAX_PENDING", 16))
        self.processing_timeout = int(os.environ.get("TRANSCRIPTION_PROCESSING_TIMEOUT_SECONDS", 1800))
        if (
            not 1 <= self.retention <= 604800
            or not 1 <= self.max_pending <= 64
            or not 1 <= self.processing_timeout <= 1800
        ):
            raise ValueError("Invalid transcription job limits")
        self.upload_slots = threading.BoundedSemaphore(self.max_pending)
        with self.db:
            self.db.execute("""CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY, digest TEXT NOT NULL, size INTEGER NOT NULL,
                content_type TEXT NOT NULL, status TEXT NOT NULL, created_at REAL NOT NULL,
                updated_at REAL NOT NULL, text TEXT, language TEXT, error TEXT)""")
            self.db.execute("UPDATE jobs SET status='queued' WHERE status='running'")
        os.chmod(self.directory / "jobs.sqlite3", 0o600)
        self.cleanup(startup=True)

    def path(self, job_id):
        return self.directory / f"{job_id}.audio"

    def cleanup(self, startup=False):
        with self.lock, self.db:
            self.db.execute(
                "UPDATE jobs SET status='failed',error='processing_timeout',updated_at=? "
                "WHERE status='running' AND updated_at < ?",
                (time.time(), time.time() - self.processing_timeout),
            )
            self.db.execute(
                "DELETE FROM jobs WHERE (status NOT IN ('running','cancelled') AND updated_at < ?) "
                "OR (status='cancelled' AND updated_at < ?)",
                (time.time() - self.retention, time.time() - max(self.retention, 86400)),
            )
            active = {row[0] for row in self.db.execute("SELECT id FROM jobs WHERE status IN ('queued','running')")}
            for path in self.directory.glob("*.audio"):
                if not path.name.startswith("upload-") and path.stem not in active:
                    path.unlink(missing_ok=True)
            if startup:
                for path in self.directory.glob("upload-*"):
                    path.unlink(missing_ok=True)

    def maintain(self):
        while True:
            time.sleep(30)
            self.cleanup()

    def get(self, job_id):
        with self.lock:
            row = self.db.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
            if not row:
                return None
            result = {"id": row["id"], "status": row["status"], "error": row["error"]}
            if row["status"] == "completed":
                result.update(text=row["text"], language=row["language"])
            return result

    def submit(self, job_id, digest, size, content_type, temporary):
        with self.lock, self.db:
            previous = self.db.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
            if previous:
                if previous["status"] == "cancelled":
                    return 200, self.get(job_id)
                if (previous["digest"], previous["size"], previous["content_type"]) != (digest, size, content_type):
                    return 409, {"error": "job_input_conflict"}
                return 200, self.get(job_id)
            count = self.db.execute("SELECT COUNT(*) FROM jobs WHERE status IN ('queued','running')").fetchone()[0]
            if count >= self.max_pending:
                return 429, {"error": "queue_full"}
            os.replace(temporary, self.path(job_id))
            directory_fd = os.open(self.directory, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(directory_fd)
            finally:
                os.close(directory_fd)
            now = time.time()
            self.db.execute(
                "INSERT INTO jobs(id,digest,size,content_type,status,created_at,updated_at) "
                "VALUES(?,?,?,?,'queued',?,?)",
                (job_id, digest, size, content_type, now, now),
            )
            self.wake.set()
            return 202, self.get(job_id)

    def cancel(self, job_id):
        with self.lock, self.db:
            now = time.time()
            # Unknown IDs retain cancellation intent while an upload is in flight.
            self.db.execute(
                "INSERT INTO jobs(id,digest,size,content_type,status,created_at,updated_at,error) "
                "VALUES(?,'',0,'','cancelled',?,?,'cancelled') "
                "ON CONFLICT(id) DO UPDATE SET status='cancelled',error='cancelled',updated_at=? "
                "WHERE status IN ('queued','running')",
                (job_id, now, now, now),
            )
            result = self.get(job_id)
            if result["status"] == "cancelled":
                self.path(job_id).unlink(missing_ok=True)
            return result

    def worker(self):
        while True:
            self.cleanup()
            with self.lock, self.db:
                job = self.db.execute(
                    "SELECT id,created_at FROM jobs WHERE status='queued' ORDER BY created_at LIMIT 1"
                ).fetchone()
                if job:
                    self.db.execute(
                        "UPDATE jobs SET status='running',updated_at=? WHERE id=?",
                        (time.time(), job["id"]),
                    )
            if not job:
                self.wake.wait(30)
                self.wake.clear()
                continue
            job_id = job["id"]
            started_at = time.time()
            try:
                result = transcribe(
                    self.path(job_id),
                    cancelled=lambda: self.get(job_id)["status"] != "running",
                    timeout=self.processing_timeout,
                )
                if not result["text"] or len(result["text"]) > 120000 or len(result["language"]) > 100:
                    raise ValueError("invalid_transcript")
                if time.time() - started_at > self.processing_timeout:
                    result = {"text": None, "language": None}
                    status, error = "failed", "processing_timeout"
                else:
                    status, error = "completed", None
            except Exception as failure:
                result = {"text": None, "language": None}
                status = "failed"
                error = "processing_timeout" if isinstance(failure, TimeoutError) else "transcription_failed"
            with self.lock, self.db:
                self.db.execute(
                    "UPDATE jobs SET status=?,text=?,language=?,error=?,updated_at=? "
                    "WHERE id=? AND created_at=? AND status='running'",
                    (status, result["text"], result["language"], error, time.time(), job_id, job["created_at"]),
                )
                current = self.db.execute("SELECT created_at FROM jobs WHERE id=?", (job_id,)).fetchone()
                if not current or current["created_at"] == job["created_at"]:
                    self.path(job_id).unlink(missing_ok=True)


class Handler(BaseHTTPRequestHandler):
    def _json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _job_id(self):
        key = os.environ.get("TRANSCRIPTION_API_KEY", "")
        if not key:
            self._json(503, {"error": "provider_unconfigured"})
            return None
        if not hmac.compare_digest(self.headers.get("Authorization", "").encode(), f"Bearer {key}".encode()):
            self._json(401, {"error": "authentication_required"})
            return None
        job_id = self.path.removeprefix("/jobs/")
        if not JOB_ID.fullmatch(job_id):
            self._json(400, {"error": "invalid_job_id"})
            return None
        return job_id

    def do_GET(self):
        if self.path == "/health":
            self._json(200, {"status": "ok"})
        elif self.path.startswith("/jobs/"):
            job_id = self._job_id()
            if job_id:
                self.server.jobs.cleanup()
                result = self.server.jobs.get(job_id)
                self._json(200, result) if result else self._json(404, {"error": "not_found"})
        else:
            self._json(404, {"error": "not_found"})

    def do_DELETE(self):
        if not self.path.startswith("/jobs/"):
            self._json(404, {"error": "not_found"})
            return
        job_id = self._job_id()
        if job_id:
            result = self.server.jobs.cancel(job_id)
            self._json(200, result) if result else self._json(404, {"error": "not_found"})

    def do_POST(self):
        asynchronous = self.path.startswith("/jobs/")
        if self.path != "/transcribe" and not asynchronous:
            self._json(404, {"error": "not_found"})
            return
        job_id = self._job_id() if asynchronous else None
        if asynchronous and not job_id:
            return
        lengths = self.headers.get_all("Content-Length", [])
        try:
            length = (
                int(lengths[0])
                if (
                    len(lengths) == 1
                    and re.fullmatch(r"[0-9]+", lengths[0])
                    and not self.headers.get("Transfer-Encoding")
                )
                else 0
            )
        except ValueError:
            length = 0
        if not 0 < length <= MAX_BYTES:
            self._json(413, {"error": "invalid_audio_size"})
            return
        content_type = self.headers.get("Content-Type", "").split(";")[0].strip().lower()
        digest = self.headers.get("X-Content-SHA256", "")
        if asynchronous:
            try:
                decoded = base64.b64decode(digest, validate=True)
                valid_digest = len(decoded) == 32 and base64.b64encode(decoded).decode() == digest
            except ValueError:
                valid_digest = False
            if content_type not in AUDIO_TYPES or not valid_digest:
                self._json(400, {"error": "invalid_audio_metadata"})
                return
        if asynchronous:
            previous = self.server.jobs.get(job_id)
            if previous and previous["status"] == "cancelled":
                self._json(200, previous)
                return
        if asynchronous and not self.server.jobs.upload_slots.acquire(blocking=False):
            self._json(429, {"error": "queue_full"})
            return
        path = None
        try:
            self.connection.settimeout(int(os.environ.get("TRANSCRIPTION_UPLOAD_TIMEOUT_SECONDS", 300)))
            with tempfile.NamedTemporaryFile(
                delete=False,
                suffix=".audio",
                prefix="upload-",
                dir=self.server.jobs.directory if asynchronous else None,
            ) as audio:
                path = audio.name
                remaining = length
                hasher = hashlib.sha256()
                while remaining:
                    chunk = self.rfile.read(min(remaining, 1024 * 1024))
                    if not chunk:
                        raise ValueError("incomplete_audio")
                    audio.write(chunk)
                    hasher.update(chunk)
                    remaining -= len(chunk)
                audio.flush()
                os.fsync(audio.fileno())
            if asynchronous:
                if not hmac.compare_digest(base64.b64encode(hasher.digest()).decode(), digest):
                    self._json(422, {"error": "audio_digest_mismatch"})
                    return
                self.server.jobs.cleanup()
                status, result = self.server.jobs.submit(job_id, digest, length, content_type, path)
                self._json(status, result)
            else:
                result = transcribe(path, timeout=self.server.jobs.processing_timeout)
                self._json(200, result) if result["text"] else self._json(422, {"error": "empty_transcript"})
        except Exception:
            self._json(500, {"error": "transcription_failed"})
        finally:
            if path:
                Path(path).unlink(missing_ok=True)
            if asynchronous:
                self.server.jobs.upload_slots.release()

    def log_message(self, _format, *_args):
        return


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", int(os.environ.get("PORT", "8091"))), Handler)
    server.jobs = Jobs(os.environ.get("TRANSCRIPTION_DATA_DIR", "/data"))
    threading.Thread(target=server.jobs.worker, daemon=True).start()
    threading.Thread(target=server.jobs.maintain, daemon=True).start()
    server.serve_forever()
