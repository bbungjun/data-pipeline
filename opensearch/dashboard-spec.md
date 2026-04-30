# GMOK 대시보드 명세

## 인덱스 패턴

- `gmok-back-logs-*`

## 핵심 패널

1. 분당 요청 수
   - 필터: `event_type:http_request`
   - 메트릭: count
   - 간격: 1분

2. route별 지연 시간
   - 필터: `event_type:http_request`
   - 분해 기준: `route.keyword`
   - 메트릭: avg(`latency_ms`), p95(`latency_ms`)

3. 4xx / 5xx 비율
   - 필터: `event_type:http_request`
   - 분해 기준: `meta.status_group.keyword`
   - 메트릭: count

4. 최근 에러 Top N
   - 필터: `source_log:error OR event_type:error_event`
   - 분해 기준: `error_message.keyword` 또는 `message.keyword`
   - 메트릭: count

5. DB error_log 활동량
   - 필터: `source_log:db_error_log`
   - 분해 기준: `severity.keyword`, `status`
   - 메트릭: count

6. 인스턴스별 상태
   - 분해 기준: `instance_name.keyword`
   - 메트릭: count, 5xx count, avg latency

## 자주 쓰는 필터

- `source_log:out`
- `source_log:error`
- `source_log:db_error_log`
- `route.keyword:"/api/auth/me"`
- `status_code:[500 TO *]`
- `severity:error`
- `event_type:http_request`
- `event_type:error_event`

## 알림 쿼리

### 5xx 급증

- 필터: `event_type:http_request AND status_code:[500 TO *]`
- 조건: 최근 5분 count >= 5

### 동일 에러 반복

- 필터: `source_log:error OR event_type:error_event`
- 그룹 기준: `error_message.keyword`, 없으면 `message.keyword`
- 조건: 최근 5분 동일 메시지 count >= 3

### 높은 지연 시간

- 필터: `event_type:http_request`
- 메트릭: p95(`latency_ms`)
- 조건: 최근 5분 p95 > 1000

### DB 에러 급증

- 필터: `source_log:db_error_log AND severity:error`
- 조건: 최근 5분 count >= 5
