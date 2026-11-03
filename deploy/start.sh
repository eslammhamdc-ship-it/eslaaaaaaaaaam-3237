#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
export PATH="$repo_root/.runtime/node_modules/.bin:$PATH"
if [ "$(bun --version)" != "1.3.14" ]; then
  echo "Bun 1.3.14 is required. Run bash deploy/build.sh first." >&2
  exit 1
fi
if [ "${NODE_ENV:-}" = "production" ]; then
  case "${MIDWAY_DATABASE_URL:-}" in
    file:/*) ;;
    *) echo "Set MIDWAY_DATABASE_URL to an absolute file URL on a persistent disk." >&2; exit 1 ;;
  esac
  if [ "${MIDWAY_ALLOW_SETUP:-}" = "true" ] && [ -z "${MIDWAY_SETUP_TOKEN:-}" ]; then
    echo "Set a private MIDWAY_SETUP_TOKEN before enabling first-account setup online." >&2
    exit 1
  fi
fi
exec bun packages/web/src/__server.ts
