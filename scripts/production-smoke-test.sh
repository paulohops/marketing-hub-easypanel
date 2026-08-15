#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
rm -rf .tmp-production-storage
mkdir -p .tmp-production-storage

NODE_ENV=production PORT=4174 JWT_SECRET=production-smoke-secret DATABASE_URL=postgresql://localhost:5432/trade_hub STORAGE_DIR="$PWD/.tmp-production-storage" node dist/index.js > /tmp/marketing-hub-production-smoke.log 2>&1 &
pid=$!
cleanup() {
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  rm -rf .tmp-production-storage
}
trap cleanup EXIT

for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:4174/health >/tmp/marketing-hub-production-health.json; then
    break
  fi
  sleep 1
done

grep -q '"ok":true' /tmp/marketing-hub-production-health.json
printf 'Production health: '; cat /tmp/marketing-hub-production-health.json; printf '\n'
