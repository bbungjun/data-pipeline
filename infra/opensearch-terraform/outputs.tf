output "domain_name" {
  description = "OpenSearch domain name."
  value       = aws_opensearch_domain.logs.domain_name
}

output "domain_arn" {
  description = "OpenSearch domain ARN."
  value       = aws_opensearch_domain.logs.arn
}

output "endpoint" {
  description = "OpenSearch HTTPS endpoint."
  value       = "https://${aws_opensearch_domain.logs.endpoint}"
}

output "dashboards_endpoint" {
  description = "OpenSearch Dashboards URL."
  value       = "https://${aws_opensearch_domain.logs.dashboard_endpoint}"
}

output "bulk_url" {
  description = "Bulk API URL for Lambda and DB poller."
  value       = "https://${aws_opensearch_domain.logs.endpoint}/_bulk"
}

output "search_url" {
  description = "Search URL for alert evaluator."
  value       = "https://${aws_opensearch_domain.logs.endpoint}/gmok-back-logs-*/_search"
}
