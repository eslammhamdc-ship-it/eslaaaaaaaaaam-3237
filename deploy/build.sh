#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
runtime_prefix="$repo_root/.runtime"
cd "$repo_root"
if [ ! -x "$runtime_prefix/node_modules/.bin/bun" ] || [ "$("$runtime_prefix/node_modules/.bin/bun" --version)" != "1.3.14" ]; then
  npm install --prefix "$runtime_prefix" --no-audit --no-fund bun@1.3.14
fi
export PATH="$runtime_prefix/node_modules/.bin:$PATH"
NODE_ENV=development ELECTRON_SKIP_BINARY_DOWNLOAD=1 bun install --frozen-lockfile
bun run typecheck
bun run lint
bun test packages/web/src/api/workspace.test.ts
cd packages/web
bun run build
