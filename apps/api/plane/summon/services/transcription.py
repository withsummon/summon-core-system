import os

import requests
from botocore.exceptions import BotoCoreError, ClientError


class TranscriptionError(Exception):
    pass


def transcribe_file_asset(asset):
    try:
        asset.asset.open("rb")
        try:
            response = requests.post(
                os.environ.get("TRANSCRIPTION_URL", "http://transcription:8091/transcribe"),
                data=asset.asset,
                headers={
                    "Content-Type": asset.attributes.get("type", "application/octet-stream"),
                    "Content-Length": str(int(asset.size)),
                },
                timeout=1800,
            )
        finally:
            asset.asset.close()
        response.raise_for_status()
        payload = response.json()
        transcript = payload.get("text", "").strip()
        if not transcript:
            raise ValueError("empty transcript")
        return transcript, payload.get("language", "")
    except (
        AttributeError,
        BotoCoreError,
        ClientError,
        OSError,
        requests.RequestException,
        TypeError,
        ValueError,
    ) as error:
        raise TranscriptionError("transcription_failed") from error
