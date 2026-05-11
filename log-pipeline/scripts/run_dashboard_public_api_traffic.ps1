param(
  [string]$BaseUrl = "http://52.59.124.66:19901",
  [string]$SessionUid = "3f47a4d9-b115-4e04-82bd-acb3cebb36e9",
  [int]$Repeat = 20,
  [int]$DelayMs = 150,
  [switch]$SkipErrorTraffic
)

$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd("/")

function Invoke-DemoRequest {
  param(
    [string]$Label,
    [string]$Method,
    [string]$Path,
    [string]$Body = ""
  )

  $url = if ($Path.StartsWith("http")) { $Path } else { "$BaseUrl$Path" }

  $args = @(
    "-sS",
    "-o", "NUL",
    "-w", "%{http_code}",
    "-X", $Method,
    "-H", "Accept: application/json",
    "-H", "User-Agent: gmok-dashboard-load-test/1.0"
  )

  if ($SessionUid) {
    $args += @("-H", "Cookie: session_uid=$SessionUid")
  }

  if ($Body) {
    $args += @("-H", "Content-Type: application/json", "-d", $Body)
  }

  $args += $url

  try {
    $status = (& curl.exe @args).Trim()
    if ($LASTEXITCODE -ne 0) {
      throw "curl.exe exited with code $LASTEXITCODE"
    }

    Write-Output ("{0,-7} {1,-6} {2} -> {3}" -f $Label, $Method, $Path, $status)
  }
  catch {
    Write-Warning ("{0,-7} {1,-6} {2} -> failed: {3}" -f $Label, $Method, $Path, $_.Exception.Message)
  }

  if ($DelayMs -gt 0) {
    Start-Sleep -Milliseconds $DelayMs
  }
}

$normalRequests = @(
  @{ Label = "normal"; Method = "GET"; Path = "/api/health" },
  @{ Label = "normal"; Method = "GET"; Path = "/api/auth/me" },
  @{ Label = "normal"; Method = "GET"; Path = "/api/auth/login" }
)

$errorRequests = @(
  @{
    Label = "error"
    Method = "POST"
    Path = "/api/replays/"
    Body = '{"bad":"payload"}'
  },
  @{
    Label = "error"
    Method = "POST"
    Path = "/api/replays/web"
    Body = '{"gameType":"1"}'
  }
)

$maskedSession = if ($SessionUid.Length -gt 8) {
  "$($SessionUid.Substring(0, 4))...$($SessionUid.Substring($SessionUid.Length - 4))"
} else {
  "(empty)"
}

Write-Output "Generating Swagger API dashboard traffic against $BaseUrl"
Write-Output "session_uid=$maskedSession, repeat=$Repeat, delay_ms=$DelayMs"

for ($i = 0; $i -lt $Repeat; $i += 1) {
  Write-Output "Round $($i + 1)/$Repeat"

  foreach ($request in $normalRequests) {
    Invoke-DemoRequest @request
  }

  if (-not $SkipErrorTraffic) {
    foreach ($request in $errorRequests) {
      Invoke-DemoRequest @request
    }
  }
}

Write-Output "Done. Wait 30-60 seconds, then refresh the Dashboard with Last 15 minutes."
