# OpenSearch Dashboard Import Guide

이 문서는 `opensearch/dashboard.ndjson`를 AWS OpenSearch Dashboards에 가져와 분석 패널을 확인하는 절차입니다.

## 전제

- AWS OpenSearch Service 리전은 `eu-central-1`입니다.
- OpenSearch 2.x 계열 Dashboards를 기준으로 합니다.
- 로그 인덱스 이름은 `gmok-back-logs-*`입니다.
- 인덱스 템플릿은 먼저 등록되어 있어야 합니다.

```powershell
.\deploy\aws\register_opensearch_template.ps1 `
  -OpenSearchEndpoint https://your-opensearch-endpoint `
  -Username your_username `
  -Password your_password
```

## Import 순서

1. AWS Console에서 OpenSearch Service로 이동합니다.
2. 대상 domain의 Dashboards URL을 엽니다.
3. 로그인 후 왼쪽 메뉴에서 `Stack Management` 또는 `Management`로 이동합니다.
4. `Saved Objects`를 선택합니다.
5. `Import`를 누르고 `opensearch/dashboard.ndjson` 파일을 선택합니다.
6. overwrite 확인이 나오면 허용합니다.
7. `Dashboard` 메뉴에서 `GMOK Log Observability Dashboard`를 엽니다.
8. 우측 상단 시간 범위를 `Last 24 hours` 또는 실제 로그가 들어온 시간대로 맞춥니다.

## 포함된 패널

1. `01 Requests per Minute`
   - `event_type:http_request` 기준 분당 요청량
2. `02 Route Latency Detail`
   - route별 요청 수, 평균 지연 시간, p95 지연 시간
3. `03 HTTP Status Distribution`
   - 2xx, 3xx, 4xx, 5xx 상태 코드 분포
4. `04 Structured Error Summary`
   - `event_type:error_event and error_message.keyword:*` 기준 오류 메시지, route, status code, severity 요약
5. `05 DB error_log Trend`
   - `source_log:db_error_log` 기준 DB 에러 추이와 severity 분포
6. `06 Instance Health Detail`
   - instance별 요청 수, 평균 지연 시간, 상태 코드 범위
7. `07 HTTP Status Code Detail`
   - 401, 403, 404, 500 등 정확한 status code별 요청 수
8. `08 Route x Status Breakdown`
   - route와 status code를 함께 묶어 원인 분석
9. `09 Raw error.log Messages`
   - 구조화되지 않은 CloudWatch `error.log` 원문을 메시지 기준으로 확인

## 데이터가 보이지 않을 때

- 시간 범위를 `Last 24 hours`, `Last 7 days`로 넓혀 확인합니다.
- Discover에서 data view `gmok-back-logs-*`가 있는지 확인합니다.
- Discover에서 아래 쿼리를 각각 확인합니다.

```text
event_type:http_request
source_log:db_error_log
event_type:error_event and error_message.keyword:*
source_log:error
status_code:[500 TO *]
```

- 인덱스에 문서가 없다면 먼저 Lambda 또는 DB poller가 OpenSearch에 데이터를 적재했는지 확인합니다.
- import 후 data view 필드가 비어 보이면 `Stack Management > Data Views > gmok-back-logs-* > Refresh field list`를 실행합니다.

## 버전 호환 이슈

OpenSearch Dashboards minor version에 따라 saved object import가 거절될 수 있습니다. 이 경우 같은 6개 패널 기준으로 UI에서 한 번 수동 생성한 뒤 `Saved Objects > Export`로 내보내 `opensearch/dashboard.ndjson`를 교체합니다.

## OpenSearch를 삭제 후 재생성한 경우

OpenSearch endpoint가 바뀌면 Lambda와 index template도 다시 연결해야 합니다. 자세한 절차는 `opensearch/recreate-runbook.md`를 참고합니다.

## 발표용 트래픽 생성

Dashboard가 실제로 변하는 모습을 보여주려면 `opensearch/dashboard-demo-scenario.md`의 절차를 사용합니다.

- public API 기반 스크립트: `scripts/run_dashboard_public_api_traffic.ps1`
- SSM fallback 스크립트: `scripts/run_dashboard_demo_traffic.ps1`

연습용 배포 환경 정보는 `opensearch/practice-environment.md`를 참고합니다.

## DB error_log 패널이 비어 있을 때

`05 DB error_log Trend`는 CloudWatch 파일 로그가 아니라 RDS `error_log` 테이블을 poller가 읽어 OpenSearch에 적재한 문서를 사용합니다. 새 OpenSearch를 만들었거나 엔드포인트를 바꾼 뒤에는 EC2의 `/opt/gmok-log-pipeline/config/pipeline.env`에 새 `OPENSEARCH_BULK_URL`, `OPENSEARCH_USERNAME`, `OPENSEARCH_PASSWORD`가 반영되어야 합니다.

확인용 Discover 필터:

```text
source_log:db_error_log and error_code:*
```
