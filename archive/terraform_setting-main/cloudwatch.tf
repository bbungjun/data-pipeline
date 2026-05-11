resource "aws_cloudwatch_log_group" "backend_out" {
  name              = local.cloudwatch_log_groups.out
  retention_in_days = var.cloudwatch_log_retention_days
}

resource "aws_cloudwatch_log_group" "backend_error" {
  name              = local.cloudwatch_log_groups.error
  retention_in_days = var.cloudwatch_log_retention_days
}

resource "aws_lambda_permission" "allow_cloudwatch_out" {
  statement_id  = "AllowExecutionFromCloudWatchOut"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.transform_logs.function_name
  principal     = "logs.${var.aws_region}.amazonaws.com"
  source_arn    = "${aws_cloudwatch_log_group.backend_out.arn}:*"
}

resource "aws_lambda_permission" "allow_cloudwatch_error" {
  statement_id  = "AllowExecutionFromCloudWatchError"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.transform_logs.function_name
  principal     = "logs.${var.aws_region}.amazonaws.com"
  source_arn    = "${aws_cloudwatch_log_group.backend_error.arn}:*"
}

resource "aws_cloudwatch_log_subscription_filter" "backend_out_to_lambda" {
  name            = "${var.project_name}-backend-out-to-lambda"
  log_group_name  = aws_cloudwatch_log_group.backend_out.name
  filter_pattern  = ""
  destination_arn = aws_lambda_function.transform_logs.arn

  depends_on = [aws_lambda_permission.allow_cloudwatch_out]
}

resource "aws_cloudwatch_log_subscription_filter" "backend_error_to_lambda" {
  name            = "${var.project_name}-backend-error-to-lambda"
  log_group_name  = aws_cloudwatch_log_group.backend_error.name
  filter_pattern  = ""
  destination_arn = aws_lambda_function.transform_logs.arn

  depends_on = [aws_lambda_permission.allow_cloudwatch_error]
}
