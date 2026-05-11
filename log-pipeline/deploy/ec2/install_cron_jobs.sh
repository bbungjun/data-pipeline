#!/bin/bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/gmok-log-pipeline}"
ENV_FILE="${ENV_FILE:-${APP_DIR}/config/pipeline.env}"

CRON_FILE="$(mktemp)"
crontab -l 2>/dev/null > "${CRON_FILE}" || true

grep -v "poll_error_log.mjs" "${CRON_FILE}" | grep -v "evaluate_alerts.py" > "${CRON_FILE}.filtered" || true
mv "${CRON_FILE}.filtered" "${CRON_FILE}"

cat >> "${CRON_FILE}" <<EOF
* * * * * APP_DIR=${APP_DIR} ENV_FILE=${ENV_FILE} bash ${APP_DIR}/deploy/ec2/run_db_poller.sh
* * * * * APP_DIR=${APP_DIR} ENV_FILE=${ENV_FILE} bash ${APP_DIR}/deploy/ec2/run_alert_evaluator.sh
EOF

mkdir -p "${APP_DIR}/logs"
crontab "${CRON_FILE}"
rm -f "${CRON_FILE}"

echo "Cron jobs installed."
