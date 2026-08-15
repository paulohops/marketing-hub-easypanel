#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${RUN_MIGRATIONS:-true}" == "true" ]]; then
  node scripts/ensure-schema.mjs
else
  echo "[Database] RUN_MIGRATIONS=false; migrations ignoradas."
fi

if [[ "${RUN_ADMIN_BOOTSTRAP:-true}" == "true" && -n "${ADMIN_EMAIL:-}" && -n "${ADMIN_PASSWORD:-}" ]]; then
  node scripts/bootstrap-admin.mjs
else
  echo "[Database] Bootstrap administrativo ignorado; defina ADMIN_EMAIL e ADMIN_PASSWORD no primeiro deploy."
fi

exec node dist/index.js
