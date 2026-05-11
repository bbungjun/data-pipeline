# Infrastructure

Active infrastructure for the log dashboard should use `opensearch-terraform/`.

The full-stack Terraform has been moved to `archive/terraform_setting-main/` because it can plan changes to EC2, RDS, VPC, and other resources outside the OpenSearch dashboard scope.
