#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required but was not found."
  read -r -p "Press Enter to close..."
  exit 1
fi

node "${ROOT_DIR}/scripts/install-app.mjs"
read -r -p "Press Enter to close..."
