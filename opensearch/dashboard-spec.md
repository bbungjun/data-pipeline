# GMOK OpenSearch Dashboard 명세

## Import 파일

- 파일: `opensearch/dashboard.ndjson`
- Dashboard title: `GMOK Log Observability Dashboard`
- Data view: `gmok-back-logs-*`
- Time field: `@timestamp`
- 기본 시간 범위: 최근 24시간
- 기본 refresh interval: 60초

## 분석 상세형 패널

1. `01 Requests per Minute`
   - 필터: `event_type:http_request`
   - 시각화: line chart
   - metric: count
   - bucket: `@timestamp` date histogram

2. `02 Route Latency Detail`
   - 필터: `event_type:http_request and latency_ms:*`
   - 시각화: data table
   - breakdown: `route`
   - metric: count, avg(`latency_ms`), p95(`latency_ms`)

3. `03 HTTP Status Distribution`
   - 필터: `event_type:http_request and status_code:*`
   - 시각화: donut pie
   - breakdown: `status_code` range
   - ranges: 2xx, 3xx, 4xx, 5xx

4. `04 Structured Error Summary`
   - 필터: `event_type:error_event and error_message.keyword:*`
   - 시각화: data table
   - breakdown: `error_message.keyword`, `route`, `status_code`, `severity`
   - metric: count
   - 목적: 추적번호 성격의 `error_code`보다 사람이 읽을 수 있는 오류 원인을 먼저 확인

5. `05 DB error_log Trend`
   - 필터: `source_log:db_error_log`
   - 시각화: stacked bar chart
   - bucket: `@timestamp` date histogram
   - split series: `severity`

6. `06 Instance Health Detail`
   - 필터: `event_type:http_request`
   - 시각화: data table
   - breakdown: `instance_name`, `status_code` range
   - metric: count, avg(`latency_ms`)

7. `07 HTTP Status Code Detail`
   - 필터: `event_type:http_request and status_code:*`
   - 시각화: data table
   - breakdown: `status_code`, `route`
   - metric: count
   - 목적: 401, 403, 404, 500 등 정확한 상태 코드를 구분

8. `08 Route x Status Breakdown`
   - 필터: `event_type:http_request and status_code:*`
   - 시각화: data table
   - breakdown: `route`, `status_code`
   - metric: count, avg(`latency_ms`)
   - 목적: 어느 route에서 어떤 상태 코드가 반복되는지 분석

9. `09 Raw error.log Messages`
   - 필터: `source_log:error and message.keyword:* and not message.keyword:"{"`
   - 시각화: data table
   - breakdown: `message.keyword`, `event_type`, `instance_name`
   - metric: count
   - 목적: 구조화되지 않은 CloudWatch error.log 원문을 메시지 기준으로 확인

## Error log 패널 설계 메모

- CloudWatch 파일 로그(`source_log:error`)는 실제 stderr/application 로그라서 `error_code`, `error_name`이 없는 경우가 정상입니다.
- DB `error_log` poller가 적재한 문서(`source_log:db_error_log`, `event_type:error_event`)는 `error_code`, `error_name`, `severity`, `status`를 가집니다.
- 그래서 `04 Structured Error Summary`는 `error_message.keyword`, `route`, `status_code`, `severity`를 기준으로 묶어 실제 원인을 먼저 보여줍니다.
- 파일 기반 에러 로그는 Discover에서 `source_log:error`로 확인하거나 별도 메시지 Top N 패널을 추가합니다.

## 자주 쓰는 필터

- `source_log:out`
- `source_log:error`
- `source_log:db_error_log`
- `route:"/api/auth/me"`
- `status_code:[500 TO *]`
- `severity:error`
- `event_type:http_request`
- `event_type:error_event`

## 알림 조건

### 5xx 급증

- 필터: `event_type:http_request AND status_code:[500 TO *]`
- 조건: 최근 5분 count >= 5
- 스크립트 환경변수: `ALERT_5XX_THRESHOLD`

### 동일 에러 반복

- 필터: `source_log:error OR event_type:error_event`
- 그룹 기준: DB error_log는 `error_code`, `error_name`; 파일 기반 `error.log`는 `message.keyword` 또는 `error_message.keyword`
- 조건: 최근 5분 동일 메시지 count >= 3
- 스크립트 환경변수: `ALERT_REPEATED_ERROR_THRESHOLD`

### 높은 지연 시간

- 필터: `event_type:http_request`
- metric: p95(`latency_ms`)
- 조건: 최근 5분 p95 > 1000ms
- 스크립트 환경변수: `ALERT_P95_LATENCY_MS`

### DB 에러 급증

- 필터: `source_log:db_error_log AND severity:error`
- 조건: 최근 5분 count >= 5
- 스크립트 환경변수: `ALERT_DB_ERROR_THRESHOLD`
