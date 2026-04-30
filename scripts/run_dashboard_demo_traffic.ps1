param(
  [string]$Region = "eu-central-1",
  [string]$InstanceId = "i-09fc20acb21d5618d",
  [int]$HealthCount = 12,
  [int]$GenericErrorCount = 5,
  [int]$DatabaseErrorCount = 3,
  [int]$ValidationErrorCount = 3
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

echo "Recent backend out.log"
tail -n 8 logs/out.log
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
