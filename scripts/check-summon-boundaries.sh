#!/bin/sh
set -eu
if git ls-files | grep -Eq '(^|/)next\.config\.(js|mjs|ts)$'; then
  echo "Forbidden Next.js runtime config detected" >&2
  exit 1
fi
for forbidden in summon_tasks summon_projects summon_users summon_sessions summon_notifications @nestjs/ drizzle-orm; do
  if git grep -n "$forbidden" -- ':!docs/**' ':!scripts/check-summon-boundaries.sh' ':!packages/constants/src/summon.ts' ':!packages/i18n/src/locales/en/power-k.json' ':!apps/web/core/components/power-k/config/navigation/**'; then
    echo "Forbidden duplicate runtime detected: $forbidden" >&2
    exit 1
  fi
done
