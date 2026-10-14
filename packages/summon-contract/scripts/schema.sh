#!/bin/sh
# Regenerate openapi.json from the Django Summon views (needs Docker; runs in the backend test image).
# `--fail-on-warn` makes an undocumented or untyped Summon endpoint a generation error.
set -eu
root="$(git rev-parse --show-toplevel)"
cd "$root"
# The schema comes back on stdout so the host user writes the file: a file the container writes into the
# bind mount is owned by its root user on Linux, and the formatter below then can't rewrite it.
# Build first with its log on stderr: a build inside `run` prints its progress to stdout, ahead of the schema.
docker compose -f docker-compose-test.yml build api-tests >&2
docker compose -f docker-compose-test.yml run --rm --no-deps -T -e ENABLE_DRF_SPECTACULAR=1 api-tests \
  python manage.py spectacular \
  --custom-settings plane.summon.openapi.settings.SUMMON_SPECTACULAR_SETTINGS \
  --format openapi-json --validate --fail-on-warn > packages/summon-contract/openapi.json
# The repo's formatter, so the committed file and a fresh one only differ when the schema does.
bunx oxfmt packages/summon-contract/openapi.json
