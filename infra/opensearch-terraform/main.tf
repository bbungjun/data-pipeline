terraform {
  required_version = ">= 1.4.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

data "aws_caller_identity" "current" {}

locals {
  domain_arn = "arn:aws:es:${var.region}:${data.aws_caller_identity.current.account_id}:domain/${var.domain_name}"

  base_access_statement = {
    Effect    = "Allow"
    Principal = "*"
    Action    = "es:*"
    Resource  = "${local.domain_arn}/*"
  }

  base_access_statement_json = jsonencode(local.base_access_statement)

  source_ip_statement_jsons = length(var.allowed_source_ips) > 0 ? [
    jsonencode(merge(local.base_access_statement, {
      Condition = {
        IpAddress = {
          "aws:SourceIp" = var.allowed_source_ips
        }
      }
    }))
  ] : []

  principal_statement_jsons = [
    for principal_arn in var.allowed_principal_arns : jsonencode({
      Effect = "Allow"
      Principal = {
        AWS = principal_arn
      }
      Action   = "es:*"
      Resource = "${local.domain_arn}/*"
    })
  ]

  configured_access_statement_jsons = concat(local.source_ip_statement_jsons, local.principal_statement_jsons)
  access_statement_jsons            = length(local.configured_access_statement_jsons) > 0 ? local.configured_access_statement_jsons : [local.base_access_statement_json]

  common_tags = merge(
    {
      Project     = "gmok-log-pipeline"
      Environment = var.environment
      ManagedBy   = "terraform"
    },
    var.tags
  )
}

resource "aws_opensearch_domain" "logs" {
  domain_name    = var.domain_name
  engine_version = var.engine_version

  cluster_config {
    instance_type          = var.instance_type
    instance_count         = var.instance_count
    zone_awareness_enabled = false
  }

  ebs_options {
    ebs_enabled = true
    volume_type = var.ebs_volume_type
    volume_size = var.ebs_volume_size
  }

  encrypt_at_rest {
    enabled = true
  }

  node_to_node_encryption {
    enabled = true
  }

  domain_endpoint_options {
    enforce_https       = true
    tls_security_policy = "Policy-Min-TLS-1-2-2019-07"
  }

  advanced_security_options {
    enabled                        = true
    internal_user_database_enabled = true

    master_user_options {
      master_user_name     = var.master_user_name
      master_user_password = var.master_user_password
    }
  }

  access_policies = jsonencode({
    Version   = "2012-10-17"
    Statement = [for statement in local.access_statement_jsons : jsondecode(statement)]
  })

  tags = local.common_tags
}
