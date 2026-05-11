variable "cloudwatch_log_retention_days" {
  description = "Retention period for backend CloudWatch log groups"
  type        = number
  default     = 14
}

variable "transform_lambda_runtime" {
  description = "Runtime for the log transform Lambda function"
  type        = string
  default     = "python3.12"
}

variable "transform_lambda_timeout" {
  description = "Timeout for the log transform Lambda function in seconds"
  type        = number
  default     = 30
}

variable "transform_lambda_memory_size" {
  description = "Memory size for the log transform Lambda function in MB"
  type        = number
  default     = 256
}

variable "opensearch_engine_version" {
  description = "Amazon OpenSearch Service engine version"
  type        = string
  default     = "OpenSearch_2.17"
}

variable "opensearch_instance_type" {
  description = "Instance type for the OpenSearch domain"
  type        = string
  default     = "t3.small.search"
}

variable "opensearch_instance_count" {
  description = "Instance count for the OpenSearch domain"
  type        = number
  default     = 1
}

variable "opensearch_volume_size" {
  description = "EBS volume size in GB for the OpenSearch domain"
  type        = number
  default     = 10
}

variable "opensearch_index_prefix" {
  description = "Index prefix used by the transform Lambda when writing to OpenSearch"
  type        = string
  default     = "gmok-back-logs"
}
