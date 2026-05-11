param(
  [string]$Region = "eu-central-1",
  [string]$FunctionName = "gmok-transform-logs",
  [string]$LambdaRoleArn,
  [string]$LambdaZipPath = ".\build\transform_logs_lambda.zip",
  [string]$OpenSearchEndpoint,
  [string]$OpenSearchUsername = "",
  [string]$OpenSearchPassword = ""
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

Remove-Item -Force $JsonFile
Write-Output "AWS resources configured."
