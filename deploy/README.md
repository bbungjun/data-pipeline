# GMOK 로그 파이프라인 배포 가이드

이 문서는 현재 저장소의 스크립트를 사용해 AWS와 EC2에 로그 파이프라인을 적용하는 절차입니다. AWS 리전은 공유 계정 기준에 맞춰 `eu-central-1`로 고정합니다.

## 1. 사전 준비

로컬 PC:

- PowerShell
- AWS CLI
- AWS CLI 인증 설정
- OpenSearch endpoint
- Lambda 실행 Role ARN
- EC2 SSH 접근 권한

EC2/운영 환경:

- PostgreSQL 접속 정보
- OpenSearch 인증 정보
- Discord webhook URL

AWS CLI 인증 확인:

```powershell
aws sts get-caller-identity
```

## 2. AWS에서 먼저 확인할 것

### OpenSearch

- 리전: `eu-central-1`
- 인덱스 패턴: `gmok-back-logs-*`
- endpoint 예시: `https://search-your-domain.eu-central-1.es.amazonaws.com`
- Basic Auth를 사용할 경우 username/password를 준비합니다.
- Terraform으로 새 domain을 만들 경우 `deploy/aws/opensearch-terraform/README.md`를 먼저 진행합니다.

### Lambda Role

권장 이름:

- `gmok-transform-logs-lambda-role`

필요 권한:

- `AWSLambdaBasicExecutionRole`
- Lambda에서 OpenSearch endpoint에 접근 가능한 네트워크/인증 설정

### EC2 Role

CloudWatch Agent가 로그를 쓸 수 있어야 합니다.

- `CloudWatchAgentServerPolicy`

## 3. 로컬 PowerShell 배포

프로젝트 루트에서 실행합니다.

```powershell
cd "C:\Users\PC\Desktop\data-pipeline"
```

Lambda ZIP 생성:

```powershell
.\deploy\aws\package_lambda.ps1
```

OpenSearch 인덱스 템플릿 등록:

```powershell
.\deploy\aws\register_opensearch_template.ps1 `
  -OpenSearchEndpoint https://your-opensearch-endpoint `
  -Username your_username `
  -Password your_password
```

Lambda, CloudWatch Log Group, subscription filter 구성:

```powershell
.\deploy\aws\setup_aws_resources.ps1 `
  -LambdaRoleArn arn:aws:iam::<account-id>:role/<lambda-role> `
  -OpenSearchEndpoint https://your-opensearch-endpoint `
  -OpenSearchUsername your_username `
  -OpenSearchPassword your_password
```

위 스크립트가 구성하는 리소스:

- Lambda 함수: `gmok-transform-logs`
- CloudWatch Log Group:
  - `/gmok/dev/back/out`
  - `/gmok/dev/back/error`
- 로그 보존 기간: 14일
- CloudWatch Logs subscription filter
- Lambda 환경변수:
  - `DEFAULT_SERVICE`
  - `DEFAULT_ENVIRONMENT`
  - `OUTPUT_INDEX_PREFIX`
  - `OPENSEARCH_BULK_URL`
  - `OPENSEARCH_USERNAME`
  - `OPENSEARCH_PASSWORD`

## 4. EC2 업로드

권장 작업 디렉터리:

```text
/opt/gmok-log-pipeline
```

EC2로 업로드할 폴더:

- `cloudwatch/`
- `config/`
- `deploy/ec2/`
- `poller/`
- `scripts/`

예상 구조:

```text
/opt/gmok-log-pipeline
├── cloudwatch/
├── config/
├── deploy/ec2/
├── poller/
└── scripts/
```

## 5. EC2 설정

작업 디렉터리 이동:

```bash
cd /opt/gmok-log-pipeline
```

환경 파일 생성:

```bash
cp config/pipeline.env.example config/pipeline.env
```

`config/pipeline.env`에 실제 값을 입력합니다.

필수 값:

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

CloudWatch Agent 설치 및 시작:

```bash
bash deploy/ec2/install_cloudwatch_agent.sh /opt/gmok-log-pipeline/cloudwatch/amazon-cloudwatch-agent.json
```

DB poller 의존성 설치:

```bash
APP_DIR=/opt/gmok-log-pipeline bash deploy/ec2/install_db_poller.sh
```

cron 등록:

```bash
APP_DIR=/opt/gmok-log-pipeline ENV_FILE=/opt/gmok-log-pipeline/config/pipeline.env bash deploy/ec2/install_cron_jobs.sh
```

등록되는 작업:

- 매분 `error_log` 테이블 poll
- 매분 OpenSearch 기반 Discord 알림 평가

관련 로그:

- `/opt/gmok-log-pipeline/logs/poller.log`
- `/opt/gmok-log-pipeline/logs/alerts.log`

상태 파일:

- `/opt/gmok-log-pipeline/.state/error_log_checkpoint.json`
- `/opt/gmok-log-pipeline/.state/discord_alert_state.json`

## 6. 배포 후 확인

CloudWatch Agent:

```bash
sudo systemctl status amazon-cloudwatch-agent
```

cron:

```bash
crontab -l
```

poller 로그:

```bash
tail -f /opt/gmok-log-pipeline/logs/poller.log
```

알림 평가 로그:

```bash
tail -f /opt/gmok-log-pipeline/logs/alerts.log
```

CloudWatch Logs에서 확인할 로그 그룹:

- `/gmok/dev/back/out`
- `/gmok/dev/back/error`

OpenSearch에서 확인할 대표 필터:

- `source_log:out`
- `source_log:error`
- `source_log:db_error_log`
- `event_type:http_request`
- `event_type:error_event`
- `status_code:[500 TO *]`

## 7. 자주 보는 문제

### CloudWatch에는 들어오는데 OpenSearch에 안 들어옴

- Lambda 환경변수 `OPENSEARCH_BULK_URL` 확인
- OpenSearch 인증 정보 확인
- Lambda에서 OpenSearch endpoint 네트워크 접근 가능 여부 확인
- Lambda CloudWatch Logs의 에러 확인

### EC2 로그가 CloudWatch에 안 들어옴

- EC2 Role에 `CloudWatchAgentServerPolicy`가 있는지 확인
- 실제 로그 파일 경로가 `/home/ec2-user/deploy/back/logs/*.log`와 맞는지 확인
- CloudWatch Agent config 경로 확인
- `sudo systemctl status amazon-cloudwatch-agent` 확인

### DB poller가 실패함

- `config/pipeline.env`의 DB 값 확인
- RDS 보안 그룹이 EC2 접근을 허용하는지 확인
- `/opt/gmok-log-pipeline/logs/poller.log` 확인
- `poller/node_modules/pg` 설치 여부 확인

### Discord 알림이 오지 않음

- `DISCORD_WEBHOOK_URL` 확인
- `OPENSEARCH_SEARCH_URL` 확인
- `/opt/gmok-log-pipeline/logs/alerts.log` 확인
- 알림 임계치가 너무 높지 않은지 확인
