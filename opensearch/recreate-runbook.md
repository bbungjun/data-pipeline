# OpenSearch 재생성 후 복구 런북

OpenSearch domain을 삭제 후 새로 만들면 endpoint가 바뀝니다. 이 경우 대시보드 파일만 다시 import하는 것으로는 부족하고, 로그를 보내는 Lambda와 운영 스크립트의 OpenSearch URL도 함께 갱신해야 합니다.

## 1. 새 OpenSearch 생성

Terraform 경로:

```powershell
cd C:\Users\PC\Desktop\data-pipeline\deploy\aws\opensearch-terraform
terraform init
terraform plan
terraform apply
```

출력값 확인:

```powershell
terraform output endpoint
terraform output dashboards_endpoint
terraform output bulk_url
terraform output search_url
```

## 2. Lambda endpoint 갱신

CloudWatch Logs subscription은 현재 `mmr-transform-logs` Lambda로 연결되어 있습니다.

새 OpenSearch endpoint를 Lambda 환경변수에 반영합니다.

```powershell
$tfvars = Get-Content -Raw deploy\aws\opensearch-terraform\terraform.tfvars
$password = [regex]::Match($tfvars, 'master_user_password\s*=\s*"([^"]+)"').Groups[1].Value
$bulkUrl = terraform -chdir=deploy\aws\opensearch-terraform output -raw bulk_url

$envObject = @{
  Variables = @{
    OUTPUT_INDEX_PREFIX = 'gmok-back-logs'
    DEFAULT_ENVIRONMENT = 'dev'
    DEFAULT_SERVICE = 'gmok-back'
    OPENSEARCH_BULK_URL = $bulkUrl
    OPENSEARCH_USERNAME = 'gmok_admin'
    OPENSEARCH_PASSWORD = $password
  }
}

$tmp = Join-Path $env:TEMP 'mmr-transform-logs-env.json'
$json = $envObject | ConvertTo-Json -Depth 4 -Compress
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($tmp, $json, $utf8NoBom)

aws lambda update-function-configuration `
  --region eu-central-1 `
  --function-name mmr-transform-logs `
  --environment "file://$tmp"

Remove-Item -Force $tmp

aws lambda wait function-updated `
  --region eu-central-1 `
  --function-name mmr-transform-logs
```

확인:

```powershell
aws lambda get-function-configuration `
  --region eu-central-1 `
  --function-name mmr-transform-logs `
  --query "Environment.Variables.OPENSEARCH_BULK_URL" `
  --output text
```

## 3. 인덱스 템플릿 재등록

새 OpenSearch에는 기존 index template이 없으므로 반드시 다시 등록합니다.

```powershell
$endpoint = terraform -chdir=deploy\aws\opensearch-terraform output -raw endpoint
$tfvars = Get-Content -Raw deploy\aws\opensearch-terraform\terraform.tfvars
$password = [regex]::Match($tfvars, 'master_user_password\s*=\s*"([^"]+)"').Groups[1].Value

.\deploy\aws\register_opensearch_template.ps1 `
  -OpenSearchEndpoint $endpoint `
  -Username gmok_admin `
  -Password $password
```

확인:

```powershell
$pair = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("gmok_admin:$password"))
Invoke-RestMethod `
  -Uri "$endpoint/_index_template/gmok-back-logs-template" `
  -Headers @{ Authorization = "Basic $pair" }
```

## 4. Dashboard 재import

1. `terraform output dashboards_endpoint`로 Dashboards URL을 확인합니다.
2. 브라우저에서 Dashboards에 접속합니다.
3. `gmok_admin`으로 로그인합니다.
4. `Dashboard Management > Saved Objects > Import`로 이동합니다.
5. `opensearch/dashboard.ndjson`를 import합니다.
6. `GMOK Log Observability Dashboard`를 엽니다.

데이터가 안 보이면 시간 범위를 `Last 15 minutes`, `Last 1 hour`, 또는 로그가 있는 날짜로 바꿉니다.

## 5. 실제 로그 유도 테스트

EC2 내부에서 백엔드 API를 호출하면 실제 경로로 로그가 흐릅니다.

```text
EC2 localhost API
-> /home/ec2-user/deploy/back/logs/out.log, error.log
-> CloudWatch Agent
-> /gmok/dev/back/out, /gmok/dev/back/error
-> mmr-transform-logs Lambda
-> OpenSearch
-> Dashboard
```

백엔드가 내려가 있으면 먼저 PM2로 올립니다.

```powershell
$cmd = @'
cd /home/ec2-user/deploy/back
pm2 start ecosystem.config.cjs --only app-dev --no-color || pm2 restart app-dev --no-color || true
sleep 5
curl -s -i --max-time 10 http://127.0.0.1:19901/api/health | head
'@

$params = @{ commands = @($cmd) } | ConvertTo-Json -Depth 4 -Compress
$tmp = Join-Path $env:TEMP 'ssm-params.json'
[System.IO.File]::WriteAllText($tmp, $params, (New-Object System.Text.UTF8Encoding($false)))

aws ssm send-command `
  --region eu-central-1 `
  --instance-ids i-09fc20acb21d5618d `
  --document-name AWS-RunShellScript `
  --parameters "file://$tmp"

Remove-Item -Force $tmp
```

요청/에러 트래픽 발생은 스크립트로 실행할 수 있습니다.

```powershell
.\scripts\run_dashboard_demo_traffic.ps1
```

직접 명령을 보낼 경우:

```powershell
$cmd = @'
cd /home/ec2-user/deploy/back
BOT_SECRET=$(node -e "const cfg=require('./ecosystem.config.cjs'); process.stdout.write(cfg.apps[0].env.DISCORD_BOT_SECRET)")

for i in $(seq 1 10); do
  curl -s -o /dev/null -w "health:%{http_code}\n" --max-time 10 http://127.0.0.1:19901/api/health
done

for i in $(seq 1 5); do
  curl -s -o /dev/null -w "generic:%{http_code}\n" --max-time 10 \
    -H "x-discord-bot: $BOT_SECRET" \
    http://127.0.0.1:19901/api/test/error/generic || true
done

for i in $(seq 1 2); do
  curl -s -o /dev/null -w "database:%{http_code}\n" --max-time 10 \
    -H "x-discord-bot: $BOT_SECRET" \
    http://127.0.0.1:19901/api/test/error/database || true
done
'@

$params = @{ commands = @($cmd) } | ConvertTo-Json -Depth 4 -Compress
$tmp = Join-Path $env:TEMP 'ssm-params.json'
[System.IO.File]::WriteAllText($tmp, $params, (New-Object System.Text.UTF8Encoding($false)))

aws ssm send-command `
  --region eu-central-1 `
  --instance-ids i-09fc20acb21d5618d `
  --document-name AWS-RunShellScript `
  --parameters "file://$tmp"

Remove-Item -Force $tmp
```

## 6. 적재 확인

OpenSearch 문서 수 확인:

```powershell
$endpoint = terraform -chdir=deploy\aws\opensearch-terraform output -raw endpoint
$tfvars = Get-Content -Raw deploy\aws\opensearch-terraform\terraform.tfvars
$password = [regex]::Match($tfvars, 'master_user_password\s*=\s*"([^"]+)"').Groups[1].Value
$pair = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("gmok_admin:$password"))

Invoke-RestMethod `
  -Uri "$endpoint/gmok-back-logs-*/_count" `
  -Headers @{ Authorization = "Basic $pair" } `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"query":{"term":{"event_type":"http_request"}}}'
```

5xx 확인:

```powershell
Invoke-RestMethod `
  -Uri "$endpoint/gmok-back-logs-*/_count" `
  -Headers @{ Authorization = "Basic $pair" } `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"query":{"range":{"status_code":{"gte":500}}}}'
```

Dashboard에서는 `Last 15 minutes` 또는 `Last 1 hour`로 시간 범위를 맞추고 새로고침합니다.

## 7. 자주 막히는 지점

### API 호출했는데 Dashboard가 안 변함

- `dev-api.gmok.kr` 호출이 항상 EC2 `back/logs`를 갱신한다고 가정하지 않습니다.
- 가장 확실한 시연 방식은 SSM으로 EC2 내부 `127.0.0.1:19901` API를 호출하는 것입니다.

### CloudWatch가 안 늘어남

CloudWatch Agent 상태:

```powershell
aws ssm send-command `
  --region eu-central-1 `
  --instance-ids i-09fc20acb21d5618d `
  --document-name AWS-RunShellScript `
  --parameters commands='["sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a status"]'
```

Agent tailer가 멈춘 듯하면 EC2에서 재시작합니다.

```bash
sudo systemctl restart amazon-cloudwatch-agent
```

### OpenSearch count가 안 늘어남

- Lambda `OPENSEARCH_BULK_URL`이 새 endpoint인지 확인합니다.
- Lambda에 `OPENSEARCH_USERNAME`, `OPENSEARCH_PASSWORD`가 있는지 확인합니다.
- OpenSearch access policy가 Basic Auth 접근을 막고 있지 않은지 확인합니다.
- `/aws/lambda/mmr-transform-logs` 로그 그룹에서 에러를 확인합니다.

## 현재 기준 리소스 이름

- OpenSearch domain: `gmok-log-search`
- Lambda: `mmr-transform-logs`
- Log groups:
  - `/gmok/dev/back/out`
  - `/gmok/dev/back/error`
- EC2 instance: `i-09fc20acb21d5618d`
- Backend local URL: `http://127.0.0.1:19901`
- Dashboard import file: `opensearch/dashboard.ndjson`
