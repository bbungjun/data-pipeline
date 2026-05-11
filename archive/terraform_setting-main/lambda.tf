data "archive_file" "transform_logs" {
  type        = "zip"
  source_file = "${path.module}/assets/lambda/handler.py"
  output_path = "${path.module}/transform_logs_lambda.zip"
}

resource "aws_lambda_function" "transform_logs" {
  function_name = local.transform_lambda_name
  description   = "Normalize GMOK backend logs from CloudWatch and push them to OpenSearch"
  role          = aws_iam_role.transform_logs_lambda.arn
  runtime       = var.transform_lambda_runtime
  handler       = "handler.lambda_handler"
  filename      = data.archive_file.transform_logs.output_path

  source_code_hash = data.archive_file.transform_logs.output_base64sha256
  timeout          = var.transform_lambda_timeout
  memory_size      = var.transform_lambda_memory_size

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      DEFAULT_SERVICE     = local.app_service_name
      DEFAULT_ENVIRONMENT = local.app_environment
      OUTPUT_INDEX_PREFIX = var.opensearch_index_prefix
      OPENSEARCH_BULK_URL = "https://${aws_opensearch_domain.log_pipeline.endpoint}/_bulk"
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.transform_logs_lambda_basic,
    aws_iam_role_policy_attachment.transform_logs_lambda_vpc,
    aws_opensearch_domain.log_pipeline,
  ]

  tags = {
    Name = local.transform_lambda_name
  }
}
