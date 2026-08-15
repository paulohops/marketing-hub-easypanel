#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
rm -rf .tmp-smoke-storage
mkdir -p .tmp-smoke-storage

PORT=4173 NODE_ENV=development JWT_SECRET=smoke-test-secret STORAGE_DIR="$PWD/.tmp-smoke-storage" pnpm dev > /tmp/marketing-hub-smoke.log 2>&1 &
pid=$!
cleanup() {
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  rm -rf .tmp-smoke-storage
}
trap cleanup EXIT

for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:4173/health >/tmp/marketing-hub-health.json; then
    break
  fi
  sleep 1
done

grep -q '"ok":true' /tmp/marketing-hub-health.json
printf 'Health: '; cat /tmp/marketing-hub-health.json; printf '\n'
