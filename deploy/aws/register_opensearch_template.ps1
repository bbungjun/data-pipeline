param(
  [string]$OpenSearchEndpoint,
  [string]$Username = "",
  [string]$Password = ""
)

$ErrorActionPreference = "Stop"

if (-not $OpenSearchEndpoint) {
  throw "OpenSearchEndpoint is required."
}

$Root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$TemplatePath = Join-Path $Root "opensearch\index-template.json"
$Body = Get-Content $TemplatePath -Raw -Encoding UTF8

$Headers = @{
  "Content-Type" = "application/json"
}

if ($Username -and $Password) {
  $Pair = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${Username}:${Password}"))
  $Headers["Authorization"] = "Basic $Pair"
}

Invoke-RestMethod `
  -Method Put `
  -Uri "$OpenSearchEndpoint/_index_template/gmok-back-logs-template" `
  -Headers $Headers `
  -Body $Body

Write-Output "OpenSearch index template registered."
