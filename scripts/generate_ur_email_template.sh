#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TS_NODE="${REPO_ROOT}/backend/node_modules/.bin/ts-node"

if [[ ! -x "${TS_NODE}" ]]; then
  echo "ts-node not found. Run: npm --prefix backend install" >&2
  exit 1
fi

exec "${TS_NODE}" -P "${REPO_ROOT}/backend/tsconfig.json" \
  "${REPO_ROOT}/scripts/generate_ur_email_template.ts" "$@"
