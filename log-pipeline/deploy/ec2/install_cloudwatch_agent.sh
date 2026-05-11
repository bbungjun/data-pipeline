#!/bin/bash
set -euo pipefail

REGION="${AWS_REGION:-eu-central-1}"
CONFIG_PATH="${1:-/opt/gmok-log-pipeline/cloudwatch/amazon-cloudwatch-agent.json}"

sudo yum install -y amazon-cloudwatch-agent

if [[ ! -f "$CONFIG_PATH" ]]; then
  echo "CloudWatch Agent config not found: $CONFIG_PATH" >&2
  exit 1
fi

sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a stop || true

sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -c "file:${CONFIG_PATH}" \
  -s

sudo systemctl enable amazon-cloudwatch-agent
sudo systemctl restart amazon-cloudwatch-agent

echo "CloudWatch Agent configured for region ${REGION}"
