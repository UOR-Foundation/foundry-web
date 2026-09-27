#!/usr/bin/env bash
# PP-01: publish only bytes exported and verified by the locked PrismPM SDK.
set -euo pipefail
if [[ $# != 1 ]]; then
  printf '%s\n' 'usage: scripts/export_browser.sh NEW_OUTPUT_DIRECTORY' >&2
  exit 64
fi
exec node "$(dirname -- "${BASH_SOURCE[0]}")/export-browser.mjs" "$1"
