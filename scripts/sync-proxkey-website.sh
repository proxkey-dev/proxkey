#!/usr/bin/env bash
# Mirror frontend/ into the standalone proxkey-website repo (see docs/ORGANIZATION.md).
#
# Usage:
#   bash scripts/sync-proxkey-website.sh
#   bash scripts/sync-proxkey-website.sh --dry-run
#
# Override destination (absolute or relative to repo root):
#   PROXKEY_WEBSITE_DIR=/path/to/proxkey-website bash scripts/sync-proxkey-website.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/frontend"
DST="${PROXKEY_WEBSITE_DIR:-$ROOT/../proxkey-website}"

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
  shift || true
fi

if [[ "${1:-}" != "" ]]; then
  echo "usage: sync-proxkey-website.sh [--dry-run]" >&2
  exit 1
fi

if [[ ! -d "$SRC" ]]; then
  echo "sync-proxkey-website: missing source directory: $SRC" >&2
  exit 1
fi

mkdir -p "$DST"
DST="$(cd "$DST" && pwd)"

RSYNC=(rsync -a --delete)
if [[ "$DRY_RUN" == 1 ]]; then
  RSYNC+=(-n --itemize-changes)
fi

# --delete: remove files in DST that were removed from SRC.
# These excludes apply to both sides so DST-only paths (.git, local installs, secrets)
# are not deleted when they are absent from SRC.
"${RSYNC[@]}" \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'server/node_modules/' \
  --exclude 'dist/' \
  --exclude 'server/dist/' \
  --exclude '.venv/' \
  --exclude 'supabase/.temp/' \
  --exclude '.turbo/' \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude '.env.*.local' \
  --exclude 'server/.env' \
  --exclude 'server/.env.*' \
  "$SRC/" "$DST/"

echo "sync-proxkey-website: synced $SRC/ -> $DST/"
if [[ "$DRY_RUN" == 0 ]] && [[ -d "$DST/.git" ]]; then
  echo "hint: cd \"$DST\" && git status"
fi
