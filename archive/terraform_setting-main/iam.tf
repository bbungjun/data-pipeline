data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "transform_logs_lambda" {
  name               = "${var.project_name}-transform-logs-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json

  tags = {
    Name = "${var.project_name}-transform-logs-lambda-role"
  }
}

resource "aws_iam_role_policy_attachment" "transform_logs_lambda_basic" {
  role       = aws_iam_role.transform_logs_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "transform_logs_lambda_vpc" {
  role       = aws_iam_role.transform_logs_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

data "aws_iam_policy_document" "ec2_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "backend_ec2_log_pipeline" {
  name               = "${var.project_name}-ec2-log-pipeline-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume_role.json

  tags = {
    Name = "${var.project_name}-ec2-log-pipeline-role"
  }
}

resource "aws_iam_role_policy_attachment" "backend_ec2_cloudwatch_agent" {
  role       = aws_iam_role.backend_ec2_log_pipeline.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

resource "aws_iam_role_policy_attachment" "backend_ec2_ssm" {
  role       = aws_iam_role.backend_ec2_log_pipeline.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

data "aws_iam_policy_document" "backend_ec2_secret_access" {
  statement {
    effect = "Allow"
    actions = [
      "secretsmanager:DescribeSecret",
      "secretsmanager:GetSecretValue",
    ]
    resources = [aws_db_instance.main.master_user_secret[0].secret_arn]
  }
}

resource "aws_iam_role_policy" "backend_ec2_secret_access" {
  name   = "${var.project_name}-ec2-rds-secret-access"
  role   = aws_iam_role.backend_ec2_log_pipeline.id
  policy = data.aws_iam_policy_document.backend_ec2_secret_access.json
}

data "aws_iam_policy_document" "backend_ec2_asset_bucket_access" {
  statement {
    effect = "Allow"
    actions = [
      "s3:GetObject",
    ]
    resources = ["${aws_s3_bucket.log_pipeline_assets.arn}/${local.asset_prefix}/*"]
  }

  statement {
    effect = "Allow"
    actions = [
      "s3:ListBucket",
    ]
    resources = [aws_s3_bucket.log_pipeline_assets.arn]

    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values   = ["${local.asset_prefix}/*"]
    }
  }
}

resource "aws_iam_role_policy" "backend_ec2_asset_bucket_access" {
  name   = "${var.project_name}-ec2-pipeline-assets-access"
  role   = aws_iam_role.backend_ec2_log_pipeline.id
  policy = data.aws_iam_policy_document.backend_ec2_asset_bucket_access.json
}

resource "aws_iam_instance_profile" "backend_ec2_log_pipeline" {
  name = "${var.project_name}-ec2-log-pipeline-profile"
  role = aws_iam_role.backend_ec2_log_pipeline.name
}
