resource "aws_s3_bucket" "log_pipeline_assets" {
  bucket        = local.asset_bucket_name
  force_destroy = true

  tags = {
    Name = local.asset_bucket_name
  }
}

resource "aws_s3_bucket_public_access_block" "log_pipeline_assets" {
  bucket = aws_s3_bucket.log_pipeline_assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "log_pipeline_assets" {
  bucket = aws_s3_bucket.log_pipeline_assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_object" "pipeline_assets" {
  for_each = fileset("${path.module}/assets", "**")

  bucket = aws_s3_bucket.log_pipeline_assets.id
  key    = "${local.asset_prefix}/${each.value}"
  source = "${path.module}/assets/${each.value}"
  etag   = filemd5("${path.module}/assets/${each.value}")
}
