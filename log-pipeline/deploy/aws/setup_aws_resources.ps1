param(
  [string]$Region = "eu-central-1",
  [string]$FunctionName = "gmok-transform-logs",
  [string]$LambdaRoleArn,
  [string]$LambdaZipPath = ".\build\transform_logs_lambda.zip",
  [string]$OpenSearchEndpoint,
  [string]$OpenSearchUsername = "",
  [string]$OpenSearchPassword = "",
  [switch]$EnableSqsBuffer,
  [string]$QueueName = "gmok-log-ingest-queue",
  [string]$DlqName = "gmok-log-ingest-dlq",
  [int]$MaxReceiveCount = 3,
  [int]$VisibilityTimeoutSeconds = 180,
  [int]$WorkerBatchSize = 500
)

$ErrorActionPreference = "Stop"

if (-not $LambdaRoleArn) {
  throw "LambdaRoleArn is required."
}

aws logs create-log-group --region $Region --log-group-name "/gmok/dev/back/out" 2>$null
aws logs create-log-group --region $Region --log-group-name "/gmok/dev/back/error" 2>$null
aws logs put-retention-policy --region $Region --log-group-name "/gmok/dev/back/out" --retention-in-days 14
aws logs put-retention-policy --region $Region --log-group-name "/gmok/dev/back/error" --retention-in-days 14

$FunctionExists = $false
try {
  aws lambda get-function --region $Region --function-name $FunctionName | Out-Null
  $FunctionExists = $true
} catch {
  $FunctionExists = $false
}

if ($FunctionExists) {
  aws lambda update-function-code `
    --region $Region `
    --function-name $FunctionName `
    --zip-file "fileb://$LambdaZipPath"
} else {
  aws lambda create-function `
    --region $Region `
    --function-name $FunctionName `
    --runtime python3.12 `
    --handler handler.lambda_handler `
    --role $LambdaRoleArn `
    --zip-file "fileb://$LambdaZipPath"
}

$EnvVars = @{
  DEFAULT_SERVICE = "gmok-back"
  DEFAULT_ENVIRONMENT = "dev"
  OUTPUT_INDEX_PREFIX = "gmok-back-logs"
  BULK_MAX_DOCUMENTS = "3000"
  BULK_MAX_BYTES = "5242880"
  LOG_INGEST_MODE = "direct"
  SCHEMA_VERSION = "1"
}

$QueueUrl = ""
$QueueArn = ""
$DlqArn = ""

if ($EnableSqsBuffer) {
  $DlqCreate = aws sqs create-queue `
    --region $Region `
    --queue-name $DlqName `
    --attributes "VisibilityTimeout=$VisibilityTimeoutSeconds" | ConvertFrom-Json
  $DlqUrl = $DlqCreate.QueueUrl
  $DlqArn = aws sqs get-queue-attributes `
    --region $Region `
    --queue-url $DlqUrl `
    --attribute-names QueueArn `
    --query "Attributes.QueueArn" `
    --output text

  $QueueCreate = aws sqs create-queue `
    --region $Region `
    --queue-name $QueueName `
    --attributes "VisibilityTimeout=$VisibilityTimeoutSeconds" | ConvertFrom-Json
  $QueueUrl = $QueueCreate.QueueUrl
  $QueueArn = aws sqs get-queue-attributes `
    --region $Region `
    --queue-url $QueueUrl `
    --attribute-names QueueArn `
    --query "Attributes.QueueArn" `
    --output text

  $RedrivePolicy = @{
    deadLetterTargetArn = $DlqArn
    maxReceiveCount = $MaxReceiveCount
  } | ConvertTo-Json -Compress
  aws sqs set-queue-attributes `
    --region $Region `
    --queue-url $QueueUrl `
    --attributes "RedrivePolicy=$RedrivePolicy" | Out-Null

  $EnvVars["LOG_INGEST_MODE"] = "sqs"
  $EnvVars["SQS_QUEUE_URL"] = $QueueUrl
}

if ($OpenSearchEndpoint) {
  $EnvVars["OPENSEARCH_BULK_URL"] = "$OpenSearchEndpoint/_bulk"
}
if ($OpenSearchUsername) {
  $EnvVars["OPENSEARCH_USERNAME"] = $OpenSearchUsername
}
if ($OpenSearchPassword) {
  $EnvVars["OPENSEARCH_PASSWORD"] = $OpenSearchPassword
}

$EnvObject = @{ Variables = $EnvVars }
$JsonFile = Join-Path ([System.IO.Path]::GetTempPath()) "gmok-lambda-env.json"
$EnvObject | ConvertTo-Json -Compress | Set-Content -Path $JsonFile -Encoding UTF8
aws lambda update-function-configuration `
  --region $Region `
  --function-name $FunctionName `
  --environment "file://$JsonFile"

if ($EnableSqsBuffer) {
  $LambdaRoleName = ($LambdaRoleArn -split "/")[-1]
  $SqsPolicy = @{
    Version = "2012-10-17"
    Statement = @(
      @{
        Effect = "Allow"
        Action = @("sqs:SendMessage", "sqs:SendMessageBatch", "sqs:GetQueueAttributes")
        Resource = $QueueArn
      },
      @{
        Effect = "Allow"
        Action = @("sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:DeleteMessageBatch", "sqs:ChangeMessageVisibility", "sqs:GetQueueAttributes")
        Resource = $QueueArn
      },
      @{
        Effect = "Allow"
        Action = @("sqs:GetQueueAttributes")
        Resource = $DlqArn
      }
    )
  } | ConvertTo-Json -Depth 6 -Compress
  $SqsPolicyFile = Join-Path ([System.IO.Path]::GetTempPath()) "gmok-lambda-sqs-policy.json"
  $SqsPolicy | Set-Content -Path $SqsPolicyFile -Encoding UTF8
  aws iam put-role-policy `
    --role-name $LambdaRoleName `
    --policy-name "gmok-log-pipeline-sqs-access" `
    --policy-document "file://$SqsPolicyFile"
  Remove-Item -Force $SqsPolicyFile
}

$AccountId = aws sts get-caller-identity --query Account --output text
$OutLogArn = "arn:aws:logs:${Region}:${AccountId}:log-group:/gmok/dev/back/out:*"
$ErrorLogArn = "arn:aws:logs:${Region}:${AccountId}:log-group:/gmok/dev/back/error:*"

try {
  aws lambda add-permission `
    --region $Region `
    --function-name $FunctionName `
    --statement-id "gmok-out-log-invoke" `
    --action "lambda:InvokeFunction" `
    --principal "logs.$Region.amazonaws.com" `
    --source-arn $OutLogArn | Out-Null
} catch {}

try {
  aws lambda add-permission `
    --region $Region `
    --function-name $FunctionName `
    --statement-id "gmok-error-log-invoke" `
    --action "lambda:InvokeFunction" `
    --principal "logs.$Region.amazonaws.com" `
    --source-arn $ErrorLogArn | Out-Null
} catch {}

aws logs put-subscription-filter `
  --region $Region `
  --log-group-name "/gmok/dev/back/out" `
  --filter-name "gmok-out-to-lambda" `
  --filter-pattern "" `
  --destination-arn "arn:aws:lambda:${Region}:${AccountId}:function:${FunctionName}"

aws logs put-subscription-filter `
  --region $Region `
  --log-group-name "/gmok/dev/back/error" `
  --filter-name "gmok-error-to-lambda" `
  --filter-pattern "" `
  --destination-arn "arn:aws:lambda:${Region}:${AccountId}:function:${FunctionName}"

if ($EnableSqsBuffer) {
  $ExistingMapping = aws lambda list-event-source-mappings `
    --region $Region `
    --function-name $FunctionName `
    --event-source-arn $QueueArn `
    --query "EventSourceMappings[0].UUID" `
    --output text

  if ($ExistingMapping -and $ExistingMapping -ne "None") {
    aws lambda update-event-source-mapping `
      --region $Region `
      --uuid $ExistingMapping `
      --batch-size $WorkerBatchSize `
      --maximum-batching-window-in-seconds 5 `
      --function-response-types ReportBatchItemFailures | Out-Null
  } else {
    aws lambda create-event-source-mapping `
      --region $Region `
      --function-name $FunctionName `
      --event-source-arn $QueueArn `
      --batch-size $WorkerBatchSize `
      --maximum-batching-window-in-seconds 5 `
      --function-response-types ReportBatchItemFailures | Out-Null
  }
}

Remove-Item -Force $JsonFile
Write-Output "AWS resources configured."
if ($EnableSqsBuffer) {
  Write-Output "SQS buffer enabled: $QueueUrl"
  Write-Output "DLQ configured: $DlqName"
}
