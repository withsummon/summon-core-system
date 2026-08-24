import json
import os
import tempfile
from http.server import BaseHTTPRequestHandler, HTTPServer

MAX_BYTES = int(os.environ.get("TRANSCRIPTION_MAX_BYTES", 262_144_000))
_model = None


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


class Handler(BaseHTTPRequestHandler):
    def _json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self._json(200, {"status": "ok"}) if self.path == "/health" else self._json(
            404, {"error": "not_found"}
        )

    def do_POST(self):
        if self.path != "/transcribe":
            self._json(404, {"error": "not_found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if not 0 < length <= MAX_BYTES:
            self._json(413, {"error": "invalid_audio_size"})
            return

        path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".audio") as audio:
                path = audio.name
                remaining = length
                while remaining:
                    chunk = self.rfile.read(min(remaining, 1024 * 1024))
                    if not chunk:
                        raise ValueError("incomplete_audio")
                    audio.write(chunk)
                    remaining -= len(chunk)
            result = transcribe_file(get_model(), path)
            if not result["text"]:
                self._json(422, {"error": "empty_transcript"})
                return
            self._json(200, result)
        except Exception:
            self._json(500, {"error": "transcription_failed"})
        finally:
            if path:
                try:
                    os.unlink(path)
                except FileNotFoundError:
                    pass

    def log_message(self, _format, *_args):
        return


if __name__ == "__main__":
    # ponytail: one model process serializes jobs; add workers only when meeting uploads overlap in practice.
    HTTPServer(
        ("0.0.0.0", int(os.environ.get("PORT", "8091"))), Handler
    ).serve_forever()
