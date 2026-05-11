variable "region" {
  description = "AWS region for the shared project account."
  type        = string
  default     = "eu-central-1"
}

variable "domain_name" {
  description = "OpenSearch Service domain name."
  type        = string
  default     = "gmok-log-search"
}

variable "engine_version" {
  description = "OpenSearch engine version. Use an OpenSearch 2.x version supported by the target AWS region."
  type        = string
  default     = "OpenSearch_2.13"
}

variable "environment" {
  description = "Environment label used for tags and log documents."
  type        = string
  default     = "dev"
}

variable "instance_type" {
  description = "OpenSearch data node instance type for a low-cost demo/learning environment."
  type        = string
  default     = "t3.small.search"
}

variable "instance_count" {
  description = "Number of OpenSearch data nodes."
  type        = number
  default     = 1
}

variable "ebs_volume_type" {
  description = "EBS volume type for OpenSearch data nodes."
  type        = string
  default     = "gp3"
}

variable "ebs_volume_size" {
  description = "EBS volume size in GiB."
  type        = number
  default     = 10
}

variable "master_user_name" {
  description = "OpenSearch Dashboards master user name for the internal user database."
  type        = string
  default     = "gmok_admin"
}

variable "master_user_password" {
  description = "OpenSearch Dashboards master user password. Pass through terraform.tfvars or -var; do not commit it."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.master_user_password) >= 8
    error_message = "master_user_password must be at least 8 characters."
  }
}

variable "allowed_source_ips" {
  description = "Optional public CIDR allowlist for the domain access policy. Empty means the domain policy is public and fine-grained access control handles authentication."
  type        = list(string)
  default     = []
}

variable "allowed_principal_arns" {
  description = "Optional IAM principal ARNs allowed to access the domain in addition to source IPs, such as the log transform Lambda execution role."
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Additional tags to apply to the OpenSearch domain."
  type        = map(string)
  default     = {}
}
