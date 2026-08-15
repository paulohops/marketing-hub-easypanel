#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "$0")/.." && pwd)"
runtime_dir="$root_dir/.tmp-runtime"
rm -rf "$runtime_dir"
mkdir -p "$runtime_dir"
cp "$root_dir/package.json" "$root_dir/pnpm-lock.yaml" "$runtime_dir/"
cp -R "$root_dir/dist" "$runtime_dir/dist"

cd "$runtime_dir"
pnpm install --prod --frozen-lockfile >/tmp/marketing-hub-runtime-install.log
NODE_ENV=production PORT=4180 JWT_SECRET=runtime-smoke-secret DATABASE_URL=postgresql://localhost:5432/trade_hub STORAGE_DIR="$runtime_dir/storage" node dist/index.js >/tmp/marketing-hub-runtime.log 2>&1 &
pid=$!
cleanup() {
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  rm -rf "$runtime_dir"
}
trap cleanup EXIT

for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:4180/health >/tmp/marketing-hub-runtime-health.json; then
    break
  fi
  sleep 1
done

grep -q '"ok":true' /tmp/marketing-hub-runtime-health.json
printf 'Production-only runtime health: '; cat /tmp/marketing-hub-runtime-health.json; printf '\n'
