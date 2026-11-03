#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
# This explicitly selected demo uses ephemeral storage, never a production database.
demo_directory="${MIDWAY_DEMO_DIRECTORY:-/tmp/midway-demo}"
mkdir -p -- "$demo_directory"
chmod 700 -- "$demo_directory"
export NODE_ENV=production
export MIDWAY_DEMO_MODE=true
export MIDWAY_DATABASE_URL="file:$demo_directory/workspace.db"
export MIDWAY_ALLOW_SETUP=true
export MIDWAY_SECURE_COOKIES="${MIDWAY_SECURE_COOKIES:-true}"
exec bash deploy/start.sh
