#!/bin/sh
# Regenerate openapi.json from the Django Summon views (needs Docker; runs in the backend test image).
# `--fail-on-warn` makes an undocumented or untyped Summon endpoint a generation error.
set -eu
root="$(git rev-parse --show-toplevel)"
cd "$root"
docker compose -f docker-compose-test.yml run --rm --no-deps -e ENABLE_DRF_SPECTACULAR=1 api-tests \
  python manage.py spectacular \
  --custom-settings plane.summon.openapi.settings.SUMMON_SPECTACULAR_SETTINGS \
  --format openapi-json --validate --fail-on-warn --file /code/.summon-openapi.json
mv apps/api/.summon-openapi.json packages/summon-contract/openapi.json
# The repo's formatter, so the committed file and a fresh one only differ when the schema does.
bunx oxfmt packages/summon-contract/openapi.json
