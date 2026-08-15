#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "$0")/.." && pwd)"
runtime_dir="$root_dir/.tmp-runtime"
rm -rf "$runtime_dir"
mkdir -p "$runtime_dir/scripts"
cp "$root_dir/package.json" "$root_dir/pnpm-lock.yaml" "$runtime_dir/"
cp -R "$root_dir/dist" "$runtime_dir/dist"
cp "$root_dir/scripts/entrypoint.sh" "$root_dir/scripts/ensure-schema.mjs" "$root_dir/scripts/bootstrap-admin.mjs" "$runtime_dir/scripts/"

cd "$runtime_dir"
pnpm install --prod --frozen-lockfile >/tmp/marketing-hub-runtime-install.log
chmod +x ./scripts/entrypoint.sh
NODE_ENV=production PORT=4180 JWT_SECRET=runtime-smoke-secret DATABASE_URL=postgresql://localhost:5432/trade_hub STORAGE_DIR="$runtime_dir/storage" RUN_MIGRATIONS=false RUN_ADMIN_BOOTSTRAP=false bash ./scripts/entrypoint.sh >/tmp/marketing-hub-runtime.log 2>&1 &
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
printf 'Production-only entrypoint health: '; cat /tmp/marketing-hub-runtime-health.json; printf '\n'
