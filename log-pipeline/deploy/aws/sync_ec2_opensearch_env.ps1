param(
  [string]$Region = "eu-central-1",
  [string]$InstanceId = "i-0172a05bbc0bd40f6",
  [string]$TerraformDir = "",
  [string]$RemoteEnvFile = "/opt/gmok-log-pipeline/config/pipeline.env"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)))

if (-not $TerraformDir) {
  $TerraformDir = Join-Path $RepoRoot "infra\opensearch-terraform"
}

if (-not (Test-Path $TerraformDir)) {
  throw "TerraformDir does not exist: $TerraformDir"
}

$TfvarsPath = Join-Path $TerraformDir "terraform.tfvars"
if (-not (Test-Path $TfvarsPath)) {
  throw "terraform.tfvars not found: $TfvarsPath"
}

function Read-TfvarString {
  param(
    [string]$Text,
    [string]$Name
  )

  $match = [regex]::Match($Text, "$Name\s*=\s*`"([^`"]+)`"")
  if (-not $match.Success) {
    throw "Could not read $Name from terraform.tfvars"
  }
  return $match.Groups[1].Value
}

$Tfvars = Get-Content -Raw -Path $TfvarsPath
$Username = Read-TfvarString -Text $Tfvars -Name "master_user_name"
$Password = Read-TfvarString -Text $Tfvars -Name "master_user_password"

$BulkUrl = terraform -chdir="$TerraformDir" output -raw bulk_url
$SearchUrl = terraform -chdir="$TerraformDir" output -raw search_url

$RemoteEnvFileJson = $RemoteEnvFile | ConvertTo-Json -Compress
$BulkUrlJson = $BulkUrl | ConvertTo-Json -Compress
$SearchUrlJson = $SearchUrl | ConvertTo-Json -Compress
$UsernameJson = $Username | ConvertTo-Json -Compress
$PasswordJson = $Password | ConvertTo-Json -Compress

$RemoteCommand = @"
set -euo pipefail
ENV_FILE=$RemoteEnvFileJson
sudo test -f "`$ENV_FILE"
sudo cp "`$ENV_FILE" "`$ENV_FILE.bak.`$(date -u +%Y%m%dT%H%M%SZ)"

sudo python3 - <<'PY'
from pathlib import Path

env_path = Path($RemoteEnvFileJson)
updates = {
    "OPENSEARCH_BULK_URL": $BulkUrlJson,
    "OPENSEARCH_SEARCH_URL": $SearchUrlJson,
    "OPENSEARCH_USERNAME": $UsernameJson,
    "OPENSEARCH_PASSWORD": $PasswordJson,
}

lines = env_path.read_text(encoding="utf-8").splitlines()
seen = set()
new_lines = []

for line in lines:
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or "=" not in line:
        new_lines.append(line)
        continue
    key = line.split("=", 1)[0].strip()
    if key in updates:
        value = updates[key].replace("'", "'\\''")
        new_lines.append(f"{key}='{value}'")
        seen.add(key)
    else:
        new_lines.append(line)

for key, value in updates.items():
    if key not in seen:
        value = value.replace("'", "'\\''")
        new_lines.append(f"{key}='{value}'")

env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
PY

sudo chmod 600 "`$ENV_FILE"
sudo grep '^OPENSEARCH_' "`$ENV_FILE" | sed 's/OPENSEARCH_PASSWORD=.*/OPENSEARCH_PASSWORD=<redacted>/'
"@

$Params = @{ commands = @($RemoteCommand) } | ConvertTo-Json -Depth 4 -Compress
$TempFile = Join-Path $env:TEMP "gmok-sync-opensearch-env.json"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($TempFile, $Params, $Utf8NoBom)

try {
  $CommandId = aws ssm send-command `
    --region $Region `
    --instance-ids $InstanceId `
    --document-name AWS-RunShellScript `
    --parameters "file://$TempFile" `
    --query Command.CommandId `
    --output text

  aws ssm wait command-executed `
    --region $Region `
    --command-id $CommandId `
    --instance-id $InstanceId

  aws ssm get-command-invocation `
    --region $Region `
    --command-id $CommandId `
    --instance-id $InstanceId `
    --query "StandardOutputContent" `
    --output text
}
finally {
  Remove-Item -Force $TempFile -ErrorAction SilentlyContinue
}
