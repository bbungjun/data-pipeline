param(
  [string]$BaseUrl = "http://52-59-124-66.nip.io:19901",
  [string]$SessionUid = "",
  [int]$Repeat = 3
)

$ErrorActionPreference = "Stop"

function Invoke-DemoRequest {
  param(
    [string]$Method,
    [string]$Url,
    [string]$Body = ""
  )

  $args = @(
    "-sS",
    "-o", "NUL",
    "-w", "%{http_code}",
    "-X", $Method,
    "-H", "Accept: application/json"
  )

  if ($SessionUid) {
    $args += @("-H", "Cookie: session_uid=$SessionUid")
  }

  if ($Body) {
    $args += @("-H", "Content-Type: application/json", "-d", $Body)
  }

  $args += $Url
  $status = (& curl.exe @args).Trim()
  Write-Output "$Method $Url -> $status"
}

$BaseUrl = $BaseUrl.TrimEnd("/")

Write-Output "Generating public API dashboard traffic against $BaseUrl"

for ($i = 0; $i -lt $Repeat; $i += 1) {
  Invoke-DemoRequest -Method GET -Url "$BaseUrl/api/health"
  Invoke-DemoRequest -Method GET -Url "$BaseUrl/api/guilds/?limit=2"

  if ($SessionUid) {
    Invoke-DemoRequest -Method GET -Url "$BaseUrl/api/auth/me"
    Invoke-DemoRequest -Method GET -Url "$BaseUrl/api/auth/gmokGuilds"
  }

  Invoke-DemoRequest `
    -Method POST `
    -Url "$BaseUrl/api/replays/" `
    -Body '{"bad":"payload"}'

  Invoke-DemoRequest `
    -Method GET `
    -Url "$BaseUrl/api/replays/bad-guild-id?limit=abc"
}

Write-Output "Done. Wait 30-60 seconds, then refresh the Dashboard with Last 15 minutes."
