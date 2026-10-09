#!/bin/sh
set -eu
: "${SOURCE_REVISION:?Build must identify its reviewed source revision}"
: "${CONVEX_SELF_HOSTED_URL:?Set the approved deployment URL}"
: "${CONVEX_SELF_HOSTED_ADMIN_KEY:?Set the deployment credential privately at runtime}"
exec node node_modules/convex/bin/main.js deploy \
  --typecheck disable --codegen disable \
  --message "$SOURCE_REVISION: reviewed one-shot server deployment"
