#!/bin/sh
set -e
# Secrets arrive as files (Compose secrets or a Swarm bind mount); the app reads environment variables.
export SUMMON_AI_INTERNAL_TOKEN="$(cat "${SUMMON_AI_INTERNAL_TOKEN_FILE:-/run/secrets/summon_ai_internal_token}")"
export APP_VERSION="$(cat VERSION)"
exec bun dist/main.js
