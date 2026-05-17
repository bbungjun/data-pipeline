# GMOK 무수정 로그 파이프라인 배포 가이드

이 문서는 현재 워크스페이스에 있는 스크립트를 사용해 `GMOK 무수정 로그 파이프라인`을 실제 AWS와 EC2에 적용하는 전체 절차를 설명합니다.

이 가이드의 목표는 다음입니다.
log`를 CloudWatch로 수집
- Lambda에서 로그를 정규화해 OpenSearch로 적재
- PostgreSQL `error_log` 테이블을 별도 폴러로 읽어 OpenSearch로 적재
- OpenSearch Dashboards에서 운영 대시보드 확인
- Discord webhook으로 이상 징후 알림 발송

적용 순서는 아래와 같이 고정합니다.

1. 로컬에서 배포 파일 준비
2. AWS 콘솔에서 사전 리소스 준비
3. 로컬 PowerShell에서 AWS 리소스 생성/연결
4. EC2에 파이프라인 파일 업로드
5. EC2에서 CloudWatch Agent, DB 폴러, 알림 스크립트 설정
6. 로그 유입과 알림 동작 검증

---

## 1. 배포 전에 준비할 것

### 로컬 PC에서 필요한 것

- PowerShell
- AWS CLI
- OpenSearch 엔드포인트 정보
- Lambda에서 사용할 IAM Role ARN
- EC2 접속용 SSH 키

AWS CLI가 설치되어 있지 않다면 먼저 설치하고, 아래 명령으로 인증 상태를 확인합니다.

```powershell
aws sts get-caller-identity
```

정상이라면 계정 ID, 사용자/Role ARN이 출력됩니다.

### 운영에 필요한 값

배포 전에 아래 값들을 미리 준비해두면 이후 단계가 빨라집니다.

- AWS Region
  - 기본값: `eu-central-1`
- OpenSearch 도메인 엔드포인트
  - 예: `https://search-your-domain.eu-central-1.es.amazonaws.com`
- Lambda Role ARN
  - 예: `arn:aws:iam::<account-id>:role/gmok-transform-logs-lambda-role`
- Discord webhook URL
- PostgreSQL 접속 정보
  - `PGHOST`
  - `PGPORT`
  - `PGDATABASE`
  - `PGUSER`
  - `PGPASSWORD`

---

## 2. AWS 콘솔에서 먼저 해야 할 일

이 단계는 스크립트를 실행하기 전에 AWS 콘솔에서 확인하거나 생성해야 하는 항목입니다.

### 2-1. OpenSearch 도메인 준비

AWS 콘솔에서 `OpenSearch Service` 로 들어가서 도메인이 있는지 확인합니다.

없다면 새로 생성합니다.

- Region: `eu-central-1`
- 도메인 이름: 예: `gmok-log-search`
- Dev/Test 용도라면 작은 인스턴스로 시작해도 됩니다.
- Dashboards 접근 방식과 인증 방법을 정합니다.
  - Basic Auth
  - IAM 기반 접근

이 프로젝트 스크립트는 현재 `Basic Auth` 방식이 가장 단순합니다.

도메인 생성 후 반드시 아래 두 가지를 확보합니다.

- OpenSearch 엔드포인트
- Dashboards 접속 URL

### 2-2. Lambda 실행용 IAM Role 생성

AWS 콘솔에서 `IAM -> Roles -> Create role` 로 이동합니다.

권장 이름:

- `gmok-transform-logs-lambda-role`

최소 필요한 권한:

- Lambda 기본 실행 권한
  - `AWSLambdaBasicExecutionRole`
- OpenSearch에 쓰기 위한 권한
  - OpenSearch 도메인 액세스 정책에서 Lambda Role 허용
  - 또는 도메인에 Basic Auth를 쓰는 경우 네트워크 접근만 허용

현재 Lambda는 CloudWatch Logs에서 호출되고, OpenSearch bulk API로 문서를 보냅니다.

### 2-3. EC2 IAM Role 확인

로그 수집 대상 EC2에는 최소 다음 권한이 필요합니다.

- CloudWatch Logs 쓰기
- SSM 사용 예정이면 SSM 권한
- RDS 접속 정보가 Secrets Manager나 Parameter Store에 있으면 해당 읽기 권한

CloudWatch Agent를 가장 쉽게 붙이려면 아래 정책 계열이 필요합니다.

- `CloudWatchAgentServerPolicy`

### 2-4. 보안 그룹 / 네트워크 확인

아래 연결이 가능한지 확인합니다.

- EC2 -> CloudWatch Logs
- Lambda -> OpenSearch
- EC2 -> RDS
- EC2 또는 실행 환경 -> Discord webhook 외부 HTTPS

특히 OpenSearch가 VPC 내부 도메인이라면 Lambda도 같은 VPC 또는 연결 가능한 네트워크에 있어야 합니다.

---

## 3. 로컬 PowerShell에서 실행할 작업

아래 명령은 반드시 프로젝트 루트에서 실행합니다.

```powershell
cd "C:\Users\young\OneDrive\바탕 화면\log_pipeline"
```

### 3-1. Lambda 배포 ZIP 생성

```powershell
.\deploy\aws\package_lambda.ps1
```

정상 결과:

- `build\transform_logs_lambda.zip` 생성

확인:

```powershell
Get-ChildItem .\build
```

### 3-2. OpenSearch 인덱스 템플릿 등록

Basic Auth가 없는 경우:

```powershell
.\deploy\aws\register_opensearch_template.ps1 -OpenSearchEndpoint https://your-opensearch-endpoint
```

Basic Auth가 있는 경우:

```powershell
.\deploy\aws\register_opensearch_template.ps1 `
  -OpenSearchEndpoint https://your-opensearch-endpoint `
  -Username your_username `
  -Password your_password
```

이 단계는 [../opensearch/index-template.json](../opensearch/index-template.json) 의 내용을 OpenSearch에 등록합니다.

### 3-3. Lambda, CloudWatch Logs, Subscription Filter 구성

Basic Auth가 없는 경우:

```powershell
.\deploy\aws\setup_aws_resources.ps1 `
  -LambdaRoleArn arn:aws:iam::<account-id>:role/<lambda-role> `
  -OpenSearchEndpoint https://your-opensearch-endpoint
```

Basic Auth가 있는 경우:

```powershell
.\deploy\aws\setup_aws_resources.ps1 `
  -LambdaRoleArn arn:aws:iam::<account-id>:role/<lambda-role> `
  -OpenSearchEndpoint https://your-opensearch-endpoint `
  -OpenSearchUsername your_username `
  -OpenSearchPassword your_password
```

이 스크립트가 하는 일:

- Lambda 함수 생성 또는 업데이트
- 로그 그룹 생성
  - `/gmok/dev/back/out`
  - `/gmok/dev/back/error`
- 로그 보존 기간 14일 설정
- Lambda 환경변수 설정
- CloudWatch Logs -> Lambda subscription filter 연결

배포 후 AWS 콘솔에서 확인할 것:

- Lambda 함수 `gmok-transform-logs` 생성 여부
- CloudWatch 로그 그룹 생성 여부
- 각 로그 그룹에 subscription filter 연결 여부

---

## 4. EC2에 업로드할 폴더

EC2의 적당한 작업 디렉터리 하나를 정합니다.

권장 경로:

```text
/opt/gmok-log-pipeline
```

로컬에서 아래 폴더들을 EC2로 업로드합니다.

- `cloudwatch/`
- `scripts/`
- `config/`
- `poller/`
- `deploy/ec2/`

예를 들어 `scp` 또는 `WinSCP`를 사용해 업로드할 수 있습니다.

업로드 후 EC2 쪽 구조 예시:

```text
/opt/gmok-log-pipeline
├─ cloudwatch/
├─ config/
├─ deploy/ec2/
├─ poller/
└─ scripts/
```

---

## 5. EC2에서 해야 할 작업

EC2에 SSH로 접속한 뒤 아래 순서대로 실행합니다.

### 5-1. 작업 디렉터리 이동

```bash
cd /opt/gmok-log-pipeline
```

### 5-2. 운영용 환경파일 생성

샘플 파일을 복사합니다.

```bash
cp config/pipeline.env.example config/pipeline.env
```

그 다음 `config/pipeline.env` 내용을 실제 값으로 채웁니다.

반드시 채워야 하는 항목:

```env
PGHOST=
PGPORT=5432
PGDATABASE=
PGUSER=
PGPASSWORD=
PGSSLMODE=require

OPENSEARCH_BULK_URL=https://your-opensearch-endpoint/_bulk
OPENSEARCH_SEARCH_URL=https://your-opensearch-endpoint/gmok-back-logs-*/_search
OPENSEARCH_USERNAME=
OPENSEARCH_PASSWORD=

DISCORD_WEBHOOK_URL=
INSTANCE_ID=
INSTANCE_NAME=
```

`INSTANCE_ID`, `INSTANCE_NAME` 은 수동으로 넣어도 되고, 나중에 자동화해도 됩니다.

### 5-3. CloudWatch Agent 설치 및 시작

```bash
bash deploy/ec2/install_cloudwatch_agent.sh /opt/gmok-log-pipeline/cloudwatch/amazon-cloudwatch-agent.json
```

이 스크립트가 하는 일:

- CloudWatch Agent 설치
- 로그 수집 설정 반영
- Agent 서비스 시작/재시작

수집 대상 로그:

- `/home/ec2-user/deploy/back/logs/out.log`
- `/home/ec2-user/deploy/back/logs/error.log`

### 5-4. DB 폴러 의존성 설치

```bash
APP_DIR=/opt/gmok-log-pipeline bash deploy/ec2/install_db_poller.sh
```

이 스크립트는 `poller/package.json` 기준으로 `pg` 패키지를 설치합니다.

### 5-5. cron 등록

```bash
APP_DIR=/opt/gmok-log-pipeline ENV_FILE=/opt/gmok-log-pipeline/config/pipeline.env bash deploy/ec2/install_cron_jobs.sh
```

이 작업이 등록하는 cron:

- 1분마다 `error_log` 테이블 폴링
- 1분마다 OpenSearch 데이터 기준 Discord 알림 평가

관련 로그 파일:

- `/opt/gmok-log-pipeline/logs/poller.log`
- `/opt/gmok-log-pipeline/logs/alerts.log`

상태 파일:

- `/opt/gmok-log-pipeline/.state/error_log_checkpoint.json`
- `/opt/gmok-log-pipeline/.state/discord_alert_state.json`

---

## 6. 적용 후 확인해야 할 것

### 6-1. CloudWatch Agent 상태 확인

```bash
sudo systemctl status amazon-cloudwatch-agent
```

### 6-2. cron 등록 확인

```bash
crontab -l
```

### 6-3. 폴러 로그 확인

```bash
tail -f /opt/gmok-log-pipeline/logs/poller.log
```

### 6-4. 알림 로그 확인

```bash
tail -f /opt/gmok-log-pipeline/logs/alerts.log
```

### 6-5. CloudWatch Logs 확인

AWS 콘솔에서 아래 로그 그룹에 이벤트가 들어오는지 확인합니다.

- `/gmok/dev/back/out`
- `/gmok/dev/back/error`

### 6-6. Lambda 확인

AWS 콘솔 `Lambda -> gmok-transform-logs -> Monitor` 에서 invocation이 발생하는지 확인합니다.

### 6-7. OpenSearch 확인

OpenSearch Dashboards 또는 `_search` API에서 문서가 들어오는지 확인합니다.

확인 포인트:

- `source_log=out`
- `source_log=error`
- `source_log=db_error_log`
- `event_type=http_request`
- `event_type=error_event`

---

## 7. 운영 검증 순서

### 요청 로그 검증

1. GMOK 서비스에서 실제 API 요청을 1건 발생시킵니다.
2. `out.log` 에 새 줄이 생깁니다.
3. 5초 이내 CloudWatch Logs에 보이는지 확인합니다.
4. Lambda invocation이 생기는지 확인합니다.
5. OpenSearch에서 해당 route 문서가 보이는지 확인합니다.

### 에러 로그 검증

1. 애플리케이션 에러 1건을 발생시킵니다.
2. `error.log` 에 기록되는지 확인합니다.
3. CloudWatch -> Lambda -> OpenSearch로 흘러가는지 확인합니다.
4. OpenSearch에서 `source_log:error` 문서로 보이는지 확인합니다.

### DB error_log 검증

1. `error_log` 테이블에 새 row가 생기게 합니다.
2. 1분 안에 폴러가 읽는지 확인합니다.
3. OpenSearch에서 `source_log:db_error_log` 문서가 생기는지 확인합니다.

### Discord 알림 검증

1. 같은 에러를 임계치 이상 발생시킵니다.
2. 알림 스크립트가 조건을 만족하는지 확인합니다.
3. Discord 채널에 1회만 알림이 도착하는지 확인합니다.

---

## 8. 자주 생기는 문제

### 8-1. Lambda는 생성됐는데 문서가 OpenSearch에 안 들어감

확인 항목:

- `OPENSEARCH_BULK_URL` 값이 맞는지
- OpenSearch 인증 정보가 맞는지
- Lambda에서 OpenSearch 네트워크 접근이 가능한지
- Lambda CloudWatch Logs에 에러가 찍히는지

### 8-2. CloudWatch 로그 그룹은 생겼는데 이벤트가 안 들어옴

확인 항목:

- EC2 IAM Role에 `CloudWatchAgentServerPolicy` 가 있는지
- Agent 설정 파일 경로가 맞는지
- 실제 로그 파일 경로가 맞는지
- Agent 서비스가 정상 실행 중인지

### 8-3. DB 폴러가 동작하지 않음

확인 항목:

- `config/pipeline.env` 값이 비어 있지 않은지
- `pg` 패키지가 설치됐는지
- RDS 보안 그룹이 EC2를 허용하는지
- `poller.log` 에 접속 에러가 찍히는지

### 8-4. Discord 알림이 안 옴

확인 항목:

- `DISCORD_WEBHOOK_URL` 값이 맞는지
- EC2에서 외부 HTTPS 호출이 가능한지
- `alerts.log` 에 에러가 없는지
- OpenSearch 검색 URL이 맞는지

---

## 9. 관련 파일 요약

### AWS 관련

- `deploy/aws/package_lambda.ps1`
  - Lambda ZIP 생성
- `deploy/aws/register_opensearch_template.ps1`
  - OpenSearch 인덱스 템플릿 등록
- `deploy/aws/setup_aws_resources.ps1`
  - Lambda, 로그 그룹, subscription filter 구성

### EC2 관련

- `deploy/ec2/install_cloudwatch_agent.sh`
  - CloudWatch Agent 설치 및 시작
- `deploy/ec2/install_db_poller.sh`
  - DB 폴러 의존성 설치
- `deploy/ec2/install_cron_jobs.sh`
  - cron 작업 등록
- `deploy/ec2/run_db_poller.sh`
  - DB 폴러 실제 실행
- `deploy/ec2/run_alert_evaluator.sh`
  - Discord 알림 평가 실행

### 파이프라인 핵심

- `lambda/transform_logs/handler.py`
  - 로그 정규화 Lambda
- `scripts/poll_error_log.mjs`
  - PostgreSQL `error_log` 폴러
- `scripts/evaluate_alerts.py`
  - 알림 평가기
- `cloudwatch/amazon-cloudwatch-agent.json`
  - 로그 수집 설정
- `config/pipeline.env.example`
  - 운영 환경변수 예시

---

## 10. 가장 짧은 실행 순서 요약

로컬:

```powershell
cd "C:\Users\young\OneDrive\바탕 화면\log_pipeline"
.\deploy\aws\package_lambda.ps1
.\deploy\aws\register_opensearch_template.ps1 -OpenSearchEndpoint https://your-opensearch-endpoint
.\deploy\aws\setup_aws_resources.ps1 -LambdaRoleArn arn:aws:iam::<account-id>:role/<lambda-role> -OpenSearchEndpoint https://your-opensearch-endpoint
```

EC2:

```bash
cd /opt/gmok-log-pipeline
cp config/pipeline.env.example config/pipeline.env
bash deploy/ec2/install_cloudwatch_agent.sh /opt/gmok-log-pipeline/cloudwatch/amazon-cloudwatch-agent.json
APP_DIR=/opt/gmok-log-pipeline bash deploy/ec2/install_db_poller.sh
APP_DIR=/opt/gmok-log-pipeline ENV_FILE=/opt/gmok-log-pipeline/config/pipeline.env bash deploy/ec2/install_cron_jobs.sh
```

이후:

- CloudWatch Logs 확인
- Lambda invocation 확인
- OpenSearch 문서 확인
- Dashboards 확인
- Discord 알림 확인
