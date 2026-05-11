param(
  [string]$Region = "eu-central-1",
  [string]$InstanceId = "i-0172a05bbc0bd40f6",
  [int]$HealthCount = 12,
  [int]$GenericErrorCount = 0,
  [int]$DatabaseErrorCount = 0,
  [int]$ValidationErrorCount = 0,
  [int]$StatusDemoCount = 2,
  [int]$StructuredErrorDemoCount = 2
)

$ErrorActionPreference = "Stop"

$remoteCommand = @"
set -e
cd /home/ec2-user/deploy/back

pm2 start ecosystem.config.cjs --only app-dev --no-color >/tmp/gmok-demo-pm2.log 2>&1 || pm2 restart app-dev --no-color >/tmp/gmok-demo-pm2.log 2>&1 || true
sleep 5

BOT_SECRET=`$(node -e "const cfg=require('./ecosystem.config.cjs'); process.stdout.write(cfg.apps[0].env.DISCORD_BOT_SECRET)")

echo "Generating dashboard demo traffic at `$(date -u)"

for i in `$(seq 1 $HealthCount); do
  curl -s -o /dev/null -w "health:%{http_code}\n" --max-time 10 http://127.0.0.1:19901/api/health
done

for i in `$(seq 1 $GenericErrorCount); do
  curl -s -o /dev/null -w "generic:%{http_code}\n" --max-time 10 \
    -H "x-discord-bot: `$BOT_SECRET" \
    http://127.0.0.1:19901/api/test/error/generic || true
done

for i in `$(seq 1 $DatabaseErrorCount); do
  curl -s -o /dev/null -w "database:%{http_code}\n" --max-time 10 \
    -H "x-discord-bot: `$BOT_SECRET" \
    http://127.0.0.1:19901/api/test/error/database || true
done

for i in `$(seq 1 $ValidationErrorCount); do
  curl -s -o /dev/null -w "validation:%{http_code}\n" --max-time 10 \
    -H "x-discord-bot: `$BOT_SECRET" \
    http://127.0.0.1:19901/api/test/error/validation || true
done

echo "Appending synthetic status-code demo lines to out.log"
for i in `$(seq 1 $StatusDemoCount); do
  ts=`$(date -u +%Y-%m-%dT%H:%M:%S)
  {
    echo "`$ts: GET /api/health 200 12 ms - 128"
    echo "`$ts: POST /api/replays 201 42 ms - 512"
    echo "`$ts: POST /api/auth/logout 204 8 ms - -"
    echo "`$ts: GET /api/auth/login 302 6 ms - 64"
    echo "`$ts: POST /api/replays/web 400 31 ms - 240"
    echo "`$ts: GET /api/auth/me 401 13 ms - 180"
    echo "`$ts: POST /api/replays/web 403 18 ms - 220"
    echo "`$ts: GET /api/replays/not-found 404 21 ms - 200"
    echo "`$ts: POST /api/replays 409 35 ms - 260"
    echo "`$ts: POST /api/replays/web 429 25 ms - 210"
    echo "`$ts: GET /api/test/error/database 500 136 ms - 360"
    echo "`$ts: GET /api/test/error/generic 502 98 ms - 300"
    echo "`$ts: POST /api/replays 503 160 ms - 340"
  } >> logs/out.log
done

echo "Appending synthetic structured error_event demo lines to out.log"
STRUCTURED_ERROR_DEMO_COUNT=$StructuredErrorDemoCount python3 - <<'PY'
import json
import os
from datetime import datetime, timezone
from pathlib import Path

count = int(os.environ.get("STRUCTURED_ERROR_DEMO_COUNT", "1"))
out_log = Path("logs/out.log")

scenarios = [
    {
        "route": "/api/auth/me",
        "method": "GET",
        "status_code": 401,
        "severity": "warning",
        "error_name": "AuthSessionRequired",
        "error_message": "Session cookie not found",
        "error_type": "authentication",
    },
    {
        "route": "/api/replays/web",
        "method": "POST",
        "status_code": 400,
        "severity": "warning",
        "error_name": "ReplayUploadValidationError",
        "error_message": "files and nick are required for replay upload",
        "error_type": "validation",
    },
    {
        "route": "/api/replays/web",
        "method": "POST",
        "status_code": 403,
        "severity": "warning",
        "error_name": "ReplayUploadPermissionDenied",
        "error_message": "Forbidden: insufficient upload permission",
        "error_type": "authorization",
    },
    {
        "route": "/api/replays/not-found",
        "method": "GET",
        "status_code": 404,
        "severity": "warning",
        "error_name": "ReplayNotFound",
        "error_message": "Replay not found for requested id",
        "error_type": "not_found",
    },
    {
        "route": "/api/replays/bad-query",
        "method": "GET",
        "status_code": 400,
        "severity": "warning",
        "error_name": "ReplayListQueryValidationError",
        "error_message": "Limit must be between 1 and 10",
        "error_type": "validation",
    },
    {
        "route": "/api/replays",
        "method": "POST",
        "status_code": 409,
        "severity": "warning",
        "error_name": "DuplicateReplayUpload",
        "error_message": "Replay file has already been uploaded",
        "error_type": "conflict",
    },
    {
        "route": "/api/replays/web",
        "method": "POST",
        "status_code": 429,
        "severity": "warning",
        "error_name": "ReplayUploadRateLimited",
        "error_message": "Too many replay upload attempts from this client",
        "error_type": "rate_limit",
    },
    {
        "route": "/api/test/error/database",
        "method": "GET",
        "status_code": 500,
        "severity": "error",
        "error_name": "DatabaseQueryFailed",
        "error_message": "Failed to run dashboard demo database query",
        "error_type": "database",
    },
    {
        "route": "/api/test/error/generic",
        "method": "GET",
        "status_code": 502,
        "severity": "error",
        "error_name": "UpstreamGatewayError",
        "error_message": "Upstream service returned an invalid response",
        "error_type": "upstream",
    },
    {
        "route": "/api/replays",
        "method": "POST",
        "status_code": 503,
        "severity": "error",
        "error_name": "ReplayStorageUnavailable",
        "error_message": "Replay storage service is temporarily unavailable",
        "error_type": "storage",
    },
]

with out_log.open("a", encoding="utf-8") as file:
    for repeat in range(count):
        for index, scenario in enumerate(scenarios, start=1):
            now = datetime.now(timezone.utc)
            timestamp = now.isoformat().replace("+00:00", "Z")
            prefix_timestamp = now.strftime("%Y-%m-%dT%H:%M:%S")
            error_code = f"DEMO-{now.strftime('%y%m%d%H%M%S')}-{repeat + 1:02d}-{index:02d}"
            payload = {
                "timestamp": timestamp,
                "level": "ERROR" if scenario["status_code"] >= 500 else "WARN",
                "service": "gmok-back",
                "environment": "dev",
                "source_log": "db_error_log",
                "event_type": "error_event",
                "message": f"{error_code} {scenario['error_message']}",
                "method": scenario["method"],
                "route": scenario["route"],
                "status_code": scenario["status_code"],
                "error_code": error_code,
                "severity": scenario["severity"],
                "error": {
                    "name": scenario["error_name"],
                    "message": scenario["error_message"],
                    "errorType": scenario["error_type"],
                },
                "meta": {
                    "demo_source": "swagger_status_error_demo",
                    "swagger_route": scenario["route"],
                    "error_type": scenario["error_type"],
                },
                "raw": {
                    "demo": True,
                    "route": scenario["route"],
                    "status_code": scenario["status_code"],
                },
            }
            file.write(f"{prefix_timestamp}: {json.dumps(payload, ensure_ascii=False)}\n")
PY

echo "Recent backend out.log"
tail -n 30 logs/out.log
"@

$params = @{ commands = @($remoteCommand) } | ConvertTo-Json -Depth 4 -Compress
$tmp = Join-Path $env:TEMP "gmok-dashboard-demo-traffic.json"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($tmp, $params, $utf8NoBom)

try {
  $commandId = aws ssm send-command `
    --region $Region `
    --instance-ids $InstanceId `
    --document-name AWS-RunShellScript `
    --parameters "file://$tmp" `
    --query Command.CommandId `
    --output text

  Start-Sleep -Seconds 12

  aws ssm get-command-invocation `
    --region $Region `
    --command-id $commandId `
    --instance-id $InstanceId `
    --query "StandardOutputContent" `
    --output text
}
finally {
  Remove-Item -Force $tmp -ErrorAction SilentlyContinue
}
