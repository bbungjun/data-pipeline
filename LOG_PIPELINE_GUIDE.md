# GMOK 로그 파이프라인 가이드

이 프로젝트는 기존 백엔드 코드와 PM2 설정을 크게 바꾸지 않고, EC2 로그와 PostgreSQL `error_log` 테이블을 OpenSearch로 모아 운영 상태를 확인하고 Discord로 알림을 보내기 위한 배포 패키지입니다.

AWS 리전은 공유 계정 운영 기준에 맞춰 `eu-central-1`로 고정합니다.

## 목표

- EC2의 기존 백엔드 로그 파일을 수집합니다.
  - `/home/ec2-user/deploy/back/logs/out.log`
  - `/home/ec2-user/deploy/back/logs/error.log`
- PostgreSQL `error_log` 테이블을 주기적으로 읽어 상세 에러 이벤트를 수집합니다.
- 모든 로그를 OpenSearch에 적재하기 좋은 공통 스키마로 정규화합니다.
- OpenSearch Dashboards와 Discord 알림에서 사용할 수 있는 운영 데이터를 만듭니다.
- 대량 로그 유입 시 OpenSearch Bulk API payload를 일정 크기로 나눠 적재합니다.

## 데이터 흐름

```text
EC2 out.log/error.log
  -> CloudWatch Agent
  -> CloudWatch Logs subscription
  -> lambda/transform_logs/handler.py
  -> OpenSearch

PostgreSQL error_log table
  -> scripts/poll_error_log.mjs
  -> OpenSearch

OpenSearch or normalized sample files
  -> scripts/evaluate_alerts.py
  -> Discord webhook
```

## 주요 구성 파일

- `cloudwatch/amazon-cloudwatch-agent.json`: EC2 로그 파일 수집 설정
- `lambda/transform_logs/handler.py`: CloudWatch 로그를 OpenSearch 문서로 정규화하는 Lambda
- `scripts/poll_error_log.mjs`: PostgreSQL `error_log` 테이블 poller
- `scripts/evaluate_alerts.py`: OpenSearch 문서를 평가해 Discord 알림을 보내는 스크립트
- `opensearch/index-template.json`: OpenSearch 인덱스 템플릿
- `opensearch/dashboard-spec.md`: Dashboard와 알림 쿼리 명세
- `config/pipeline.env.example`: 운영 환경변수 예시
- `deploy/aws/*.ps1`: 로컬 PowerShell에서 AWS 리소스를 구성하는 스크립트
- `deploy/ec2/*.sh`: EC2에서 CloudWatch Agent, poller, cron을 설치하는 스크립트

## 공통 문서 필드

OpenSearch에는 대체로 아래 필드로 적재됩니다.

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
- `latency_ms`
- `client_ip`
- `error_name`
- `error_message`
- `error_code`
- `severity`
- `meta`
- `raw`

## 대량 로그 처리

CloudWatch Logs subscription이 여러 로그 이벤트를 한 번에 Lambda로 전달하면, Lambda는 이벤트를 공통 문서 스키마로 정규화한 뒤 OpenSearch `_bulk` 요청으로 적재합니다.

대량 유입 상황에서 하나의 bulk payload가 과도하게 커지는 것을 막기 위해 아래 기준으로 문서를 chunking합니다.

- `BULK_MAX_DOCUMENTS`: 한 번의 bulk 요청에 포함할 최대 문서 수, 기본값 `3000`
- `BULK_MAX_BYTES`: 한 번의 bulk 요청 payload 최대 크기, 기본값 `5242880` bytes

OpenSearch Bulk API는 HTTP 200을 반환해도 일부 문서만 실패할 수 있으므로, Lambda는 bulk 응답의 item별 status를 요약해 실패 문서 수와 실패 유형을 반환합니다.

## SQS/DLQ 기반 재처리 전략

기본 배포는 `CloudWatch Logs -> Lambda -> OpenSearch` 직접 적재 방식입니다. OpenSearch 적재 실패 로그를 보존하고 재처리해야 하는 운영 시나리오에서는 `LOG_INGEST_MODE=sqs`로 전환해 아래 흐름을 사용합니다.

```text
CloudWatch Logs
  -> Ingest Lambda
  -> SQS Standard Queue
  -> Worker Lambda
  -> OpenSearch Bulk API
       반복 실패 -> DLQ
```

설계 trade-off는 다음 기준으로 잡았습니다.

- FIFO Queue 대신 Standard Queue를 사용합니다. 로그 분석은 큐 입력 순서보다 `@timestamp` 기준 조회와 처리량이 더 중요하기 때문입니다.
- SQS의 at-least-once delivery는 허용하되, CloudWatch `log_event_id`와 DB `error_log.id` 기반 OpenSearch `_id`로 idempotency를 확보합니다.
- Worker batch size는 기본 `500`으로 두어 bulk 효율과 실패 격리 사이의 균형을 잡습니다.
- Worker timeout을 60초로 둘 경우 visibility timeout은 `180`초처럼 더 길게 설정해 처리 중 메시지가 중복 수신될 가능성을 줄입니다.
- `maxReceiveCount=3` 이후에도 실패하는 poison message는 DLQ로 격리해 정상 로그 적재 흐름을 막지 않도록 합니다.
- 문서에는 `schema_version`을 저장하고, 변동성이 큰 값은 `meta`에 둬 mapping 변경에 대응합니다.

## 로컬 검증

CloudWatch/PM2 로그 정규화:

```powershell
python lambda\transform_logs\handler.py `
  samples\prefixed-json.log `
  samples\normalized-prefixed-json.json
```

DB `error_log` 샘플 정규화:

```powershell
node scripts\poll_error_log.mjs `
  --sample-input samples\error_log_rows.json `
  --output samples\normalized-error-events.json
```

정규화된 파일 기준 알림 평가:

```powershell
python scripts\evaluate_alerts.py `
  samples\normalized-prefixed-json.json `
  samples\normalized-error-events.json
```

## 운영 메모

- `config/pipeline.env`에는 DB, OpenSearch, Discord webhook 값이 들어가므로 커밋하지 않습니다.
- `config/pipeline.env.example`을 복사해 EC2에서 실제 값을 채웁니다.
- `scripts/poll_error_log.mjs`와 `scripts/evaluate_alerts.py`는 cron으로 1분마다 실행하는 구성을 기본으로 합니다.
- `.state/error_log_checkpoint.json`은 DB poller의 중복 수집 방지 상태 파일입니다.
- `.state/discord_alert_state.json`은 Discord 중복 알림 방지 상태 파일입니다.
- Lambda와 EC2 설정은 모두 `eu-central-1` 기준입니다.
