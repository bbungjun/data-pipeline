param(
  [string]$Region = "eu-central-1",
  [string]$FunctionName = "de-ai-01-mmr-mmr-calculator",
  [ValidateSet("missing_payload", "missing_guild_id", "missing_custom_match_id")]
  [string]$Scenario = "missing_guild_id",
  [switch]$RequestResponse
)

$ErrorActionPreference = "Stop"

function New-SqsBody {
  param([string]$Scenario)

  switch ($Scenario) {
    "missing_payload" {
      return @{
        demo = $true
        reason = "presentation demo: missing payload wrapper"
      }
    }
    "missing_custom_match_id" {
      return @{
        payload = @{
          guild_id = "demo-guild"
        }
      }
    }
    default {
      return @{
        payload = @{
          custom_match_id = "DEMO-LAMBDA-ERROR"
        }
      }
    }
  }
}

$MessageId = [guid]::NewGuid().ToString()
$Body = New-SqsBody -Scenario $Scenario
$Payload = @{
  Records = @(
    @{
      messageId = $MessageId
      receiptHandle = "demo-receipt-handle"
      body = ($Body | ConvertTo-Json -Depth 10 -Compress)
      attributes = @{
        ApproximateReceiveCount = "1"
        SentTimestamp = ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()).ToString()
        SenderId = "demo"
        ApproximateFirstReceiveTimestamp = ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()).ToString()
      }
      messageAttributes = @{}
      md5OfBody = "demo"
      eventSource = "aws:sqs"
      eventSourceARN = "arn:aws:sqs:${Region}:827913617635:mmr-match-queue"
      awsRegion = $Region
    }
  )
}

$TempPayload = Join-Path $env:TEMP "mmr-calculator-error-demo-payload.json"
$TempOutput = Join-Path $env:TEMP "mmr-calculator-error-demo-output.json"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($TempPayload, ($Payload | ConvertTo-Json -Depth 20 -Compress), $Utf8NoBom)

try {
  $InvocationType = if ($RequestResponse) { "RequestResponse" } else { "Event" }

  $InvokeResult = aws lambda invoke `
    --region $Region `
    --function-name $FunctionName `
    --invocation-type $InvocationType `
    --cli-binary-format raw-in-base64-out `
    --payload "file://$TempPayload" `
    $TempOutput `
    --output json | ConvertFrom-Json

  $FunctionOutput = ""
  if (Test-Path $TempOutput) {
    $FunctionOutput = Get-Content -Raw -Path $TempOutput
  }

  [pscustomobject]@{
    FunctionName = $FunctionName
    Scenario = $Scenario
    InvocationType = $InvocationType
    DemoMessageId = $MessageId
    StatusCode = $InvokeResult.StatusCode
    FunctionError = $InvokeResult.FunctionError
    Output = $FunctionOutput
    DashboardFilter = "source_log:lambda and level:ERROR and service:$FunctionName"
  } | ConvertTo-Json -Depth 10
}
finally {
  Remove-Item -Force $TempPayload, $TempOutput -ErrorAction SilentlyContinue
}
