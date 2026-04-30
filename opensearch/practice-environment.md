# 연습용 배포 환경

이 프로젝트의 로그 파이프라인 검증 대상은 실제 운영 `dev-api.gmok.kr`가 아니라, 별도로 배포된 연습용 EC2/RDS 환경입니다.

## 기준 환경

- EC2 public IP: `52.59.124.66`
- Front URL: `http://52-59-124-66.nip.io:3000/`
- Backend Swagger URL: `http://52-59-124-66.nip.io:19901/docs/`
- Backend API base URL: `http://52-59-124-66.nip.io:19901`
- Backend internal URL on EC2: `http://127.0.0.1:19901`
- RDS database: `mmrdb`
- RDS endpoint: `mmr-postgres.cnq8sq088mw2.eu-central-1.rds.amazonaws.com:5432`
- RDS user: `mmradmin`

비밀번호, session cookie, Terraform state, tfvars 파일은 민감 정보이므로 문서에 직접 기록하지 않습니다.

## 로그 수집 대상

CloudWatch Agent는 연습용 EC2의 백엔드 로그 파일을 수집합니다.

```text
/home/ec2-user/deploy/back/logs/out.log
/home/ec2-user/deploy/back/logs/error.log
```

수집 흐름:

```text
연습용 Backend API
-> EC2 back/logs
-> CloudWatch Agent
-> CloudWatch Logs
-> mmr-transform-logs Lambda
-> OpenSearch gmok-log-search
-> Dashboard
```

## Swagger 기반 테스트

브라우저에서 아래 주소를 엽니다.

```text
http://52-59-124-66.nip.io:19901/docs/
```

인증이 필요한 API는 `session_uid` 쿠키가 필요합니다. Swagger UI에서 쿠키 인증을 넣기 어렵다면 PowerShell 스크립트를 사용합니다.

```powershell
.\scripts\run_dashboard_public_api_traffic.ps1 `
  -SessionUid "YOUR_SESSION_UID" `
  -Repeat 3
```

이 스크립트는 public backend API를 직접 호출합니다.

- `GET /api/health` -> 200
- `GET /api/guilds/?limit=2` -> 200
- `GET /api/auth/me` -> 200, session이 유효할 때
- `GET /api/auth/gmokGuilds` -> 200 또는 외부 Discord 상태에 따라 500 가능
- `POST /api/replays/` with invalid body -> 400
- `GET /api/replays/bad-guild-id?limit=abc` -> 400

## SSM 기반 테스트와 차이

public API 테스트:

```text
내 PC -> http://52-59-124-66.nip.io:19901 -> 연습용 Backend
```

SSM 내부 테스트:

```text
내 PC -> AWS SSM -> EC2 내부 curl http://127.0.0.1:19901 -> 연습용 Backend
```

둘 다 같은 백엔드 로그 파일에 기록됩니다. 발표에서는 Swagger/public API 테스트를 먼저 보여주고, 네트워크나 쿠키 이슈가 생길 때 SSM 내부 테스트를 fallback으로 사용하면 안정적입니다.

## Dashboard 확인

Dashboard에서 시간 범위를 `Last 15 minutes` 또는 `Last 1 hour`로 설정합니다.

중점 확인 패널:

- `01 Requests per Minute`
- `03 HTTP Status Distribution`
- `07 HTTP Status Code Detail`
- `08 Route x Status Breakdown`
- `06 Instance Health Detail`

실제 연습용 EC2 경유 로그는 아래 instance 값으로 들어옵니다.

```text
instance_id=i-09fc20acb21d5618d
instance_name=ip-10-0-1-138.eu-central-1.compute.internal
```
