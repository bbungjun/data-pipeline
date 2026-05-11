param(
  [string]$TerraformDir = "infra\opensearch-terraform",
  [string]$Service = "de-ai-01-mmr-mmr-calculator",
  [string]$DemoId = "presentation-lambda-errors",
  [switch]$Cleanup
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$TerraformPath = Join-Path $RepoRoot $TerraformDir
if (-not (Test-Path $TerraformPath)) {
  throw "Terraform directory not found: $TerraformPath"
}

$Endpoint = terraform -chdir="$TerraformPath" output -raw endpoint
$TfvarsPath = Join-Path $TerraformPath "terraform.tfvars"
$Tfvars = Get-Content -Raw -Path $TfvarsPath
$Username = ([regex]::Match($Tfvars, 'master_user_name\s*=\s*"([^"]+)"')).Groups[1].Value
$Password = ([regex]::Match($Tfvars, 'master_user_password\s*=\s*"([^"]+)"')).Groups[1].Value

if (-not $Username -or -not $Password) {
  throw "Could not read OpenSearch credentials from $TfvarsPath"
}

$Basic = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("$Username`:$Password"))
$Headers = @{
  Authorization = "Basic $Basic"
}

if ($Cleanup) {
  $DeleteBody = @{
    query = @{
      query_string = @{
        query = "_id:demo-$DemoId-*"
      }
    }
  } | ConvertTo-Json -Depth 20 -Compress

  $Result = Invoke-RestMethod `
    -Method Post `
    -Uri "$Endpoint/gmok-back-logs-*/_delete_by_query?refresh=true&conflicts=proceed" `
    -Headers $Headers `
    -ContentType "application/json" `
    -Body $DeleteBody

  [pscustomobject]@{
    Action = "cleanup"
    DemoId = $DemoId
    Deleted = $Result.deleted
  } | ConvertTo-Json -Depth 10
  exit 0
}

$Now = [DateTimeOffset]::UtcNow
$Scenarios = @(
  @{
    error_name = "AppError"
    message = "Invalid SQS message payload: missing guild_id"
    event = "MMR_CALCULATION_FAILED"
    stage = "parse_message"
    retryable = $false
  },
  @{
    error_name = "KeyError"
    message = "Missing required SQS payload key: custom_match_id"
    event = "MMR_CALCULATION_FAILED"
    stage = "parse_message"
    retryable = $false
  },
  @{
    error_name = "psycopg.errors.DeadlockDetected"
    message = "DB UPDATE failed: deadlock detected while updating player_mmr"
    event = "MMR_CALCULATION_FAILED"
    stage = "db_update"
    retryable = $true
  },
  @{
    error_name = "psycopg.OperationalError"
    message = "RDS connection failed while opening transaction"
    event = "MMR_CALCULATION_FAILED"
    stage = "db_connect"
    retryable = $true
  },
  @{
    error_name = "TimeoutError"
    message = "MMR calculation exceeded processing time budget"
    event = "MMR_CALCULATION_FAILED"
    stage = "calculate_mmr"
    retryable = $true
  },
  @{
    error_name = "ValueError"
    message = "Invalid match participant count for MMR calculation"
    event = "MMR_CALCULATION_FAILED"
    stage = "validate_match"
    retryable = $false
  }
)

$Lines = New-Object System.Collections.Generic.List[string]
$Created = @()

for ($i = 0; $i -lt $Scenarios.Count; $i++) {
  $Scenario = $Scenarios[$i]
  $Timestamp = $Now.AddSeconds(-1 * ($Scenarios.Count - $i)).UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
  $RequestId = [guid]::NewGuid().ToString()
  $MessageId = [guid]::NewGuid().ToString()
  $DocId = "demo-$DemoId-$($Scenario.error_name -replace '[^A-Za-z0-9_.-]', '-')"

  $Document = [ordered]@{
    "@timestamp" = $Timestamp
    level = "ERROR"
    service = $Service
    environment = "dev"
    source_log = "lambda"
    instance_id = $null
    instance_name = $null
    event_type = "lambda_error"
    message = $Scenario.message
    request_id = $RequestId
    user_id = $null
    match_id = "DEMO-MATCH-$($i + 1)"
    route = $null
    method = $null
    status_code = $null
    latency_ms = $null
    client_ip = $null
    error_name = $Scenario.error_name
    error_message = $Scenario.message
    error_code = $null
    severity = "error"
    meta = [ordered]@{
      demo = $true
      demo_id = $DemoId
      lambda_function = $Service
      event = $Scenario.event
      stage = $Scenario.stage
      retryable = $Scenario.retryable
      sqs_message_id = $MessageId
      receive_count = 1
      custom_match_id = "DEMO-MATCH-$($i + 1)"
      guild_id = "demo-guild"
    }
    raw = [ordered]@{
      demo = $true
      error_name = $Scenario.error_name
      message = $Scenario.message
    }
  }

  $IndexName = "gmok-back-logs-$($Timestamp.Substring(0, 10))"
  $Lines.Add((@{ index = @{ _index = $IndexName; _id = $DocId } } | ConvertTo-Json -Depth 10 -Compress))
  $Lines.Add(($Document | ConvertTo-Json -Depth 20 -Compress))
  $Created += [pscustomobject]@{
    error_name = $Scenario.error_name
    stage = $Scenario.stage
    retryable = $Scenario.retryable
  }
}

$Payload = ($Lines -join "`n") + "`n"
$Response = Invoke-RestMethod `
  -Method Post `
  -Uri "$Endpoint/_bulk?refresh=true" `
  -Headers $Headers `
  -ContentType "application/x-ndjson" `
  -Body $Payload

$FailedItems = @()
if ($Response.errors) {
  foreach ($Item in $Response.items) {
    $IndexResult = $Item.index
    if ($IndexResult.error) {
      $FailedItems += [pscustomobject]@{
        Id = $IndexResult._id
        Status = $IndexResult.status
        ErrorType = $IndexResult.error.type
        Reason = $IndexResult.error.reason
      }
    }
  }
}

[pscustomobject]@{
  Action = "seed"
  DemoId = $DemoId
  Created = $Created.Count
  BulkErrors = $Response.errors
  DashboardFilter = "source_log:lambda and level:ERROR and meta.demo:true"
  FailedItems = $FailedItems
  ErrorNames = $Created
} | ConvertTo-Json -Depth 10
