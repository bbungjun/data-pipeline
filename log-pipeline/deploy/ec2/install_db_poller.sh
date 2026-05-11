#!/bin/bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/gmok-log-pipeline}"
ENV_FILE="${ENV_FILE:-${APP_DIR}/config/pipeline.env}"

mkdir -p "${APP_DIR}/scripts" "${APP_DIR}/config" "${APP_DIR}/.state"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required but not found." >&2
  exit 1
fi

if [[ ! -f "${APP_DIR}/poller/package.json" ]]; then
  echo "Missing poller/package.json under ${APP_DIR}" >&2
  exit 1
fi

cd "${APP_DIR}/poller"
npm install --omit=dev

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing environment file: $ENV_FILE" >&2
  exit 1
fi

echo "DB poller dependencies installed."
