#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PORT="${BACKEND_PORT:-8787}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/memo4me-dev.XXXXXX")"
BACKEND_LOG="${TMP_DIR}/backend.log"
FRONTEND_LOG="${TMP_DIR}/frontend.log"
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  local exit_code=$?

  if [[ -n "${FRONTEND_PID}" ]] && kill -0 "${FRONTEND_PID}" >/dev/null 2>&1; then
    kill "${FRONTEND_PID}" >/dev/null 2>&1 || true
  fi

  if [[ -n "${BACKEND_PID}" ]] && kill -0 "${BACKEND_PID}" >/dev/null 2>&1; then
    kill "${BACKEND_PID}" >/dev/null 2>&1 || true
  fi

  exit "${exit_code}"
}

trap cleanup INT TERM EXIT

require_command() {
  local command_name="$1"

  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command not found: ${command_name}" >&2
    exit 1
  fi
}

wait_for_url() {
  local url="$1"
  local label="$2"
  local attempts=0
  local max_attempts=60

  until curl --silent --fail "${url}" >/dev/null 2>&1; do
    attempts=$((attempts + 1))

    if [[ "${attempts}" -ge "${max_attempts}" ]]; then
      echo "${label} did not become ready in time." >&2
      echo "Backend log: ${BACKEND_LOG}" >&2
      echo "Frontend log: ${FRONTEND_LOG}" >&2
      exit 1
    fi

    sleep 1
  done
}

require_command npm
require_command curl
require_command node

if [[ ! -d "${ROOT_DIR}/frontend/node_modules" ]]; then
  echo "frontend dependencies are missing. Run 'cd frontend && npm install' first." >&2
  exit 1
fi

if [[ ! -d "${ROOT_DIR}/backend/node_modules" ]]; then
  echo "backend dependencies are missing. Run 'cd backend && npm install' first." >&2
  exit 1
fi

CHROME_PATH="$(node "${ROOT_DIR}/scripts/chrome-launcher.mjs" find)" || {
  echo "Chrome is required but was not found." >&2
  echo "This development helper requires Google Chrome to be installed." >&2
  exit 1
}

echo "Using Chrome at: ${CHROME_PATH}"
echo "Logs will be written to: ${TMP_DIR}"

(
  cd "${ROOT_DIR}/backend"
  HOST=127.0.0.1 PORT="${BACKEND_PORT}" npm run dev >"${BACKEND_LOG}" 2>&1
) &
BACKEND_PID=$!

(
  cd "${ROOT_DIR}/frontend"
  npm run dev -- --host 127.0.0.1 --port "${FRONTEND_PORT}" --strictPort >"${FRONTEND_LOG}" 2>&1
) &
FRONTEND_PID=$!

wait_for_url "http://127.0.0.1:${BACKEND_PORT}/api/health" "Backend"
wait_for_url "http://127.0.0.1:${FRONTEND_PORT}" "Frontend"

node "${ROOT_DIR}/scripts/chrome-launcher.mjs" open "http://127.0.0.1:${FRONTEND_PORT}" >/dev/null

echo "memo4me development servers are running."
echo "Frontend: http://127.0.0.1:${FRONTEND_PORT}"
echo "Backend:  http://127.0.0.1:${BACKEND_PORT}"
echo "Press Ctrl+C to stop both servers."

wait "${BACKEND_PID}" "${FRONTEND_PID}"
