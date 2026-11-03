#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
export PATH="$repo_root/.runtime/node_modules/.bin:$PATH"
node - <<'JS'
const fs=require('fs');
const text=fs.readFileSync('wrangler.jsonc','utf8');
if(text.includes('00000000-0000-0000-0000-000000000000')){
  console.error('Set the actual D1 database_id in wrangler.jsonc before remote deployment.');
  process.exit(1);
}
if(!fs.existsSync('packages/web/dist/index.html')){
  console.error('Run bash deploy/build-cloudflare.sh before deployment.');process.exit(1);
}
JS
# Run only in the user's authenticated Cloudflare account, after reviewing migrations.
WRANGLER_SEND_METRICS=false bunx wrangler d1 migrations apply midway-workspace --remote
WRANGLER_SEND_METRICS=false bunx wrangler deploy
