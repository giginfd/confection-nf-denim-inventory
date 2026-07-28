#!/usr/bin/env bash
set -euo pipefail

: "${APP_PASSWORD:?Set APP_PASSWORD in Render before starting the inventory service.}"
: "${SESSION_SECRET:?Set SESSION_SECRET in Render before starting the inventory service.}"

exec npx wrangler dev dist/server/index.js \
  --config dist/server/wrangler.json \
  --ip 0.0.0.0 \
  --port "$PORT" \
  --persist-to /var/data/wrangler \
  --var "APP_PASSWORD:$APP_PASSWORD" \
  --var "SESSION_SECRET:$SESSION_SECRET" \
  --log-level warn
