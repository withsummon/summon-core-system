FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY apps/api/requirements/base.txt ./api-requirements.txt
RUN awk '/^(openpyxl|python-docx|python-pptx|pypdf|reportlab)==/ { print }' api-requirements.txt > requirements.txt \
    && pip install --no-cache-dir -r requirements.txt \
    && useradd --uid 10001 --create-home documents
COPY --chown=documents:documents apps/api/summon_documents ./summon_documents
COPY --chown=documents:documents apps/document-worker/server.py ./
USER documents
EXPOSE 8092
CMD ["python", "server.py"]
