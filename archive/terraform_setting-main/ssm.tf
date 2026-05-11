resource "aws_ssm_document" "log_pipeline_bootstrap" {
  name          = "${var.project_name}-log-pipeline-bootstrap"
  document_type = "Command"

  content = jsonencode({
    schemaVersion = "2.2"
    description   = "Bootstrap CloudWatch Agent and DB poller for the GMOK log pipeline"
    mainSteps = [
      {
        action = "aws:runShellScript"
        name   = "bootstrapLogPipeline"
        inputs = {
          runCommand = [
            "set -euo pipefail",
            "dnf install -y awscli python3 cronie amazon-cloudwatch-agent",
            "mkdir -p /opt/gmok-log-pipeline",
            "aws s3 sync s3://${aws_s3_bucket.log_pipeline_assets.id}/${local.asset_prefix} /opt/gmok-log-pipeline",
            "mkdir -p /opt/gmok-log-pipeline/config /opt/gmok-log-pipeline/.state /opt/gmok-log-pipeline/logs",
            "if [ ! -f /opt/gmok-log-pipeline/config/pipeline.env ]; then cat > /opt/gmok-log-pipeline/config/pipeline.env <<'ENVEOF'\nDEFAULT_SERVICE=${local.app_service_name}\nDEFAULT_ENVIRONMENT=${local.app_environment}\nOUTPUT_INDEX_PREFIX=${var.opensearch_index_prefix}\nERROR_LOG_POLL_LIMIT=500\nERROR_LOG_CHECKPOINT=/opt/gmok-log-pipeline/.state/error_log_checkpoint.json\nPGHOST=${aws_db_instance.main.address}\nPGPORT=${aws_db_instance.main.port}\nPGDATABASE=${aws_db_instance.main.db_name}\nPGUSER=${aws_db_instance.main.username}\nPGPASSWORD=$(aws secretsmanager get-secret-value --region ${var.aws_region} --secret-id ${aws_db_instance.main.master_user_secret[0].secret_arn} --query SecretString --output text | python3 -c \"import sys, json; print(json.load(sys.stdin)['password'])\")\nPGSSLMODE=require\nOPENSEARCH_BULK_URL=https://${aws_opensearch_domain.log_pipeline.endpoint}/_bulk\nOPENSEARCH_SEARCH_URL=https://${aws_opensearch_domain.log_pipeline.endpoint}/${var.opensearch_index_prefix}-*/_search\nINSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)\nINSTANCE_NAME=${var.project_name}-backend-ec2\nDISCORD_WEBHOOK_URL=\nALERT_WINDOW_MINUTES=5\nALERT_5XX_THRESHOLD=5\nALERT_REPEATED_ERROR_THRESHOLD=3\nALERT_P95_LATENCY_MS=1000\nALERT_DB_ERROR_THRESHOLD=5\nENVEOF\nchmod 600 /opt/gmok-log-pipeline/config/pipeline.env\nfi",
            "chmod +x /opt/gmok-log-pipeline/deploy/ec2/*.sh",
            "bash /opt/gmok-log-pipeline/deploy/ec2/install_cloudwatch_agent.sh /opt/gmok-log-pipeline/cloudwatch/amazon-cloudwatch-agent.json",
            "APP_DIR=/opt/gmok-log-pipeline ENV_FILE=/opt/gmok-log-pipeline/config/pipeline.env bash /opt/gmok-log-pipeline/deploy/ec2/install_db_poller.sh",
            "systemctl enable crond",
            "systemctl start crond",
            "APP_DIR=/opt/gmok-log-pipeline ENV_FILE=/opt/gmok-log-pipeline/config/pipeline.env bash /opt/gmok-log-pipeline/deploy/ec2/install_cron_jobs.sh",
          ]
        }
      }
    ]
  })
}

resource "aws_ssm_association" "log_pipeline_bootstrap" {
  name = aws_ssm_document.log_pipeline_bootstrap.name

  targets {
    key    = "InstanceIds"
    values = [aws_instance.backend.id]
  }

  depends_on = [
    aws_instance.backend,
    aws_s3_object.pipeline_assets,
    aws_cloudwatch_log_group.backend_out,
    aws_cloudwatch_log_group.backend_error,
  ]
}
