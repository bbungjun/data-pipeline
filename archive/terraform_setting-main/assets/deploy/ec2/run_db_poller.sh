#!/bin/bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/gmok-log-pipeline}"
ENV_FILE="${ENV_FILE:-${APP_DIR}/config/pipeline.env}"
NODE_BIN="${NODE_BIN:-/usr/bin/node}"
export NODE_PATH="${NODE_PATH:-${APP_DIR}/poller/node_modules}"

cd "${APP_DIR}"
set -a
source "${ENV_FILE}"
set +a

mkdir -p "${APP_DIR}/logs" "${APP_DIR}/.state"
"${NODE_BIN}" scripts/poll_error_log.mjs --env-file "${ENV_FILE}" --push-opensearch >> "${APP_DIR}/logs/poller.log" 2>&1
