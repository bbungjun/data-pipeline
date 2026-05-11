locals {
  app_service_name       = "gmok-back"
  app_environment        = "dev"
  opensearch_domain_name = "${var.project_name}-log-search"
  transform_lambda_name  = "${var.project_name}-transform-logs"
  asset_bucket_name      = "${var.project_name}-log-pipeline-assets-${data.aws_caller_identity.current.account_id}-${var.aws_region}"
  asset_prefix           = "pipeline"

  cloudwatch_log_groups = {
    out   = "/gmok/${local.app_environment}/back/out"
    error = "/gmok/${local.app_environment}/back/error"
  }

  opensearch_allowed_cidrs = [
    local.my_ip_cidr,
    "${aws_eip.backend.public_ip}/32",
    "${aws_eip.nat.public_ip}/32",
  ]
}
