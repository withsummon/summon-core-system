FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    WHISPER_MODEL=small \
    WHISPER_MODEL_DIR=/models

RUN pip install --no-cache-dir faster-whisper==1.2.1 \
    && useradd --create-home --uid 10001 transcription \
    && mkdir /models \
    && chown transcription:transcription /models

WORKDIR /app
COPY --chown=transcription:transcription server.py ./
USER transcription
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8', download_root='/models')"
EXPOSE 8091
CMD ["python", "server.py"]
