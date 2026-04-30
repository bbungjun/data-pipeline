#!/bin/bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/gmok-log-pipeline}"
ENV_FILE="${ENV_FILE:-${APP_DIR}/config/pipeline.env}"
PYTHON_BIN="${PYTHON_BIN:-/usr/bin/python3}"

cd "${APP_DIR}"
set -a
source "${ENV_FILE}"
set +a

mkdir -p "${APP_DIR}/logs" "${APP_DIR}/.state"
"${PYTHON_BIN}" scripts/evaluate_alerts.py >> "${APP_DIR}/logs/alerts.log" 2>&1
