output "backend_instance_profile_name" {
  description = "IAM instance profile name attached to backend EC2"
  value       = aws_iam_instance_profile.backend_ec2_log_pipeline.name
}

output "transform_logs_lambda_name" {
  description = "Name of the log transform Lambda function"
  value       = aws_lambda_function.transform_logs.function_name
}

output "transform_logs_lambda_role_arn" {
  description = "IAM role ARN used by the log transform Lambda"
  value       = aws_iam_role.transform_logs_lambda.arn
}

output "cloudwatch_log_group_out" {
  description = "CloudWatch log group for out.log"
  value       = aws_cloudwatch_log_group.backend_out.name
}

output "cloudwatch_log_group_error" {
  description = "CloudWatch log group for error.log"
  value       = aws_cloudwatch_log_group.backend_error.name
}

output "opensearch_domain_name" {
  description = "OpenSearch domain name for the log pipeline"
  value       = aws_opensearch_domain.log_pipeline.domain_name
}

output "opensearch_endpoint" {
  description = "OpenSearch endpoint hostname"
  value       = aws_opensearch_domain.log_pipeline.endpoint
}

output "opensearch_dashboard_endpoint" {
  description = "OpenSearch Dashboards endpoint hostname"
  value       = aws_opensearch_domain.log_pipeline.dashboard_endpoint
}

output "log_pipeline_assets_bucket" {
  description = "S3 bucket used to distribute log pipeline assets to EC2"
  value       = aws_s3_bucket.log_pipeline_assets.id
}
