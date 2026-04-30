# GMOK 무수정 로그 파이프라인

이 워크스페이스는 GMOK 백엔드 코드와 PM2 설정을 변경하지 않고 로그 파이프라인을 구축하기 위한 작업물입니다.

## 목표

- 기존 백엔드 로그 파일을 읽습니다.
  - `/home/ec2-user/deploy/back/logs/out.log`
  - `/home/ec2-user/deploy/back/logs/error.log`
- PostgreSQL `error_log` 테이블을 읽어 상세 에러 추적 정보를 수집합니다.
- 두 소스를 OpenSearch에 적재하기 좋은 공통 스키마로 정규화합니다.
- 대시보드용 문서와 Discord 알림용 요약 정보를 만듭니다.

## 파이프라인 구조

```text
EC2 out.log/error.log
  -> CloudWatch Agent
  -> CloudWatch Logs subscription
  -> lambda/transform_logs/handler.py
  -> OpenSearch

RDS error_log table
  -> scripts/poll_error_log.mjs
  -> OpenSearch

OpenSearch or normalized files
  -> scripts/evaluate_alerts.py
  -> Discord webhook
```

## 이번 프로젝트에서 추가한 파일

- `cloudwatch/amazon-cloudwatch-agent.json`
  `out.log`, `error.log` 수집용 CloudWatch Agent 설정
- `lambda/transform_logs/handler.py`
  CloudWatch 또는 로컬 로그 파일을 OpenSearch 문서 형태로 정규화
- `scripts/poll_error_log.mjs`
  `error_log` 테이블을 주기적으로 읽고, 체크포인트를 기록하며, 선택적으로 OpenSearch에 적재
- `scripts/evaluate_alerts.py`
  알림 임계치를 평가하고, 선택적으로 Discord webhook 알림 전송
- `opensearch/index-template.json`
  요청 로그와 DB 에러 이벤트용 인덱스 매핑
- `opensearch/dashboard-spec.md`
  대시보드와 알림 쿼리 명세
- `samples/error_log_rows.json`
  `error_log` 테스트용 로컬 샘플 데이터

## 공통 문서 필드

- `@timestamp`
- `service`
- `environment`
- `source_log`
- `instance_id`
- `instance_name`
- `level`
- `event_type`
- `message`
- `method`
- `route`
- `status_code`
- `status_group`
- `latency_ms`
- `content_length`
- `client_ip`
- `user_agent`
- `error_name`
- `error_message`
- `error_code`
- `severity`
- `raw`

## 로컬 검증

기존 샘플 로그 정규화:

```powershell
C:\Users\young\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe `
  lambda\transform_logs\handler.py `
  samples\prefixed-json.log `
  samples\normalized-prefixed-json.json
```

샘플 DB 에러 로그 정규화:

```powershell
node scripts\poll_error_log.mjs `
  --sample-input samples\error_log_rows.json `
  --output samples\normalized-error-events.json
```

정규화된 파일 기준으로 로컬 알림 평가:

```powershell
C:\Users\young\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe `
  scripts\evaluate_alerts.py `
  samples\normalized-prefixed-json.json `
  samples\normalized-error-events.json
```

## 배포 메모

- 백엔드 코드에는 손대지 않습니다.
- CloudWatch Agent 설정을 EC2에 배포합니다.
- `scripts/poll_error_log.mjs` 는 cron, systemd timer, 또는 SSM으로 1분마다 실행합니다.
- Discord 알림은 레포 밖에 저장된 webhook URL을 사용합니다.
- EC2 인스턴스가 늘어나면 수동 멀티 터미널 대신 SSM Run Command로 Agent 설정을 배포합니다.
