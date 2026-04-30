# Dashboard 발표 시나리오

이 문서는 실제 API 호출로 로그를 발생시키고 OpenSearch Dashboard가 변하는 모습을 보여주기 위한 발표용 절차입니다. 기준 환경은 별도로 배포된 연습용 EC2/RDS입니다.

## 핵심 메시지

대시보드에 보이는 데이터는 임의 그래프가 아니라 아래 실제 운영 경로를 통과한 로그입니다.

```text
연습용 Backend API 호출
-> EC2 /home/ec2-user/deploy/back/logs/out.log, error.log
-> CloudWatch Agent
-> CloudWatch Logs
-> mmr-transform-logs Lambda
-> OpenSearch
-> GMOK Log Observability Dashboard
```

## 연습용 Swagger/API로 보여줄 수 있는 것

Swagger URL:

```text
http://52-59-124-66.nip.io:19901/docs/
```

공개 API 예시:

```text
GET http://52-59-124-66.nip.io:19901/api/health
```

이 API는 연습용 EC2 백엔드에 직접 연결되므로 CloudWatch Agent 수집 대상 로그 파일을 갱신합니다.

PowerShell로 public API 호출을 반복하려면 아래 스크립트를 사용합니다.

```powershell
.\scripts\run_dashboard_public_api_traffic.ps1 `
  -SessionUid "YOUR_SESSION_UID" `
  -Repeat 3
```

SSM 방식은 네트워크나 쿠키 이슈가 있을 때 fallback으로 사용합니다.

## 실제 대시보드 변화 유도

프로젝트 루트에서 실행합니다.

```powershell
.\scripts\run_dashboard_demo_traffic.ps1
```

기본 동작:

- `/api/health` 200 요청 생성
- `/api/test/error/generic` 500 에러 생성
- `/api/test/error/database` 500 에러 생성
- `/api/test/error/validation` 400 에러 생성

요청 수를 바꾸고 싶으면:

```powershell
.\scripts\run_dashboard_demo_traffic.ps1 `
  -HealthCount 20 `
  -GenericErrorCount 8 `
  -DatabaseErrorCount 4 `
  -ValidationErrorCount 4
```

## Dashboard에서 볼 패널

시간 범위를 `Last 15 minutes` 또는 `Last 1 hour`로 맞춘 뒤 새로고침합니다.

확인 순서:

1. `01 Requests per Minute`
   - 요청량 spike 확인
2. `03 HTTP Status Distribution`
   - 200, 400, 500 비율 변화 확인
3. `07 HTTP Status Code Detail`
   - 400과 500을 정확히 분리해서 확인
4. `08 Route x Status Breakdown`
   - `/api/health`, `/api/test/error/generic`, `/api/test/error/database`, `/api/test/error/validation`별 상태 코드 확인
5. `06 Instance Health Detail`
   - `ip-10-0-1-138.eu-central-1.compute.internal` 인스턴스 기준 이벤트 확인
6. `04 Structured Error Summary`
   - `Database connection failed`, `Unknown error`처럼 사람이 읽을 수 있는 오류 원인과 route/status 확인
7. `09 Raw error.log Messages`
   - 구조화되지 않은 CloudWatch `error.log` 원문 메시지 확인

## unknown_instance가 보일 때

`unknown_instance`는 실제 CloudWatch 경유 로그가 아니라, 예전에 샘플/직접 적재한 문서처럼 `instance_name`이 없는 문서에서 나타납니다.

실제 EC2 로그 경유 문서는 아래처럼 들어와야 합니다.

```text
instance_id=i-09fc20acb21d5618d
instance_name=ip-10-0-1-138.eu-central-1.compute.internal
source_log=out 또는 error
```

Dashboard에서 `unknown_instance`가 거슬리면 시간 범위를 최신 시연 시간으로 맞추거나, Discover에서 `instance_name:*` 필터를 사용합니다.

## 적재 확인 쿼리

OpenSearch count 확인:

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
  -Body '{"query":{"wildcard":{"route":"/api/test/*"}}}'
```

5xx만 확인:

```powershell
Invoke-RestMethod `
  -Uri "$endpoint/gmok-back-logs-*/_count" `
  -Headers @{ Authorization = "Basic $pair" } `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"query":{"range":{"status_code":{"gte":500}}}}'
```
