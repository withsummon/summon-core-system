#!/usr/bin/env bash
set -euo pipefail

read_secret() {
  local path="${!1:-}"
  test -n "$path" && test -r "$path" || { echo "Missing required secret: $1" >&2; exit 1; }
  tr -d '\r\n' < "$path"
}

secret_key="$(read_secret SECRET_KEY_FILE)"
summon_credential_key="$(read_secret SUMMON_CREDENTIAL_KEY_FILE)"
minio_password="$(read_secret AWS_SECRET_ACCESS_KEY_FILE)"
db_password="$(read_secret POSTGRES_PASSWORD_FILE)"
rabbitmq_password="$(read_secret RABBITMQ_PASSWORD_FILE)"
live_server_secret_key="$(read_secret LIVE_SERVER_SECRET_KEY_FILE)"

export SECRET_KEY="$secret_key"
export SUMMON_CREDENTIAL_KEY="$summon_credential_key"
export AWS_SECRET_ACCESS_KEY="$minio_password"
export DATABASE_URL="postgresql://${POSTGRES_USER}:${db_password}@plane-db:5432/${POSTGRES_DB}"
export AMQP_URL="amqp://${RABBITMQ_USER}:${rabbitmq_password}@plane-mq:5672/${RABBITMQ_VHOST}"
export LIVE_SERVER_SECRET_KEY="$live_server_secret_key"

exec "$@"
