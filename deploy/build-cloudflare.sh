#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
# Reuse the pinned toolchain, tests and frontend build; no cloud resources are created.
bash deploy/build.sh
export PATH="$repo_root/.runtime/node_modules/.bin:$PATH"
bunx tsc -p cloudflare/tsconfig.json
bun test packages/web/src/api/password.test.ts packages/web/src/api/native-migration.test.ts
WRANGLER_SEND_METRICS=false bunx wrangler deploy --dry-run --outdir .cache/cloudflare-build
