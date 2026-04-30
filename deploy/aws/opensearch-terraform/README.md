# OpenSearch Terraform Deployment

이 Terraform 구성은 GMOK 로그 파이프라인용 AWS OpenSearch Service domain을 생성합니다.

## 기본값

- Region: `eu-central-1`
- Domain: `gmok-log-search`
- Engine: `OpenSearch_2.13`
- Instance: `t3.small.search`
- Node count: `1`
- EBS: `gp3`, `10 GiB`
- Fine-grained access control: enabled
- Internal user database: enabled
- HTTPS only, node-to-node encryption, encryption at rest: enabled

## 1. 변수 파일 생성

```powershell
cd C:\Users\PC\Desktop\data-pipeline\deploy\aws\opensearch-terraform
Copy-Item terraform.tfvars.example terraform.tfvars
```

`terraform.tfvars`에서 `master_user_password`를 강한 비밀번호로 바꿉니다. 가능하면 `allowed_source_ips`도 현재 공인 IP `/32`로 제한합니다.
CloudWatch subscription Lambda가 이 domain에 로그를 보낼 경우 `allowed_principal_arns`에 Lambda 실행 role ARN도 넣습니다.

현재 공인 IP 확인 예시:

```powershell
(Invoke-RestMethod https://checkip.amazonaws.com).Trim()
```

예시:

```hcl
allowed_source_ips = ["203.0.113.10/32"]
allowed_principal_arns = ["arn:aws:iam::827913617635:role/mmr-transform-logs-lambda-role"]
```

## 2. 배포

AWS 인증이 먼저 잡혀 있어야 합니다.

```powershell
aws sts get-caller-identity
```

위 명령이 실패하면 `aws configure`, SSO login, 또는 프로젝트에서 사용하는 공유 계정 인증 절차를 먼저 완료합니다.

```powershell
terraform init
terraform plan
terraform apply
```

OpenSearch domain 생성은 보통 수 분 이상 걸립니다.

## 3. 출력값 확인

```powershell
terraform output endpoint
terraform output dashboards_endpoint
terraform output bulk_url
terraform output search_url
```

이 값들을 `config/pipeline.env`와 AWS Lambda 환경변수에 반영합니다.

```env
OPENSEARCH_BULK_URL=https://your-domain/_bulk
OPENSEARCH_SEARCH_URL=https://your-domain/gmok-back-logs-*/_search
OPENSEARCH_USERNAME=gmok_admin
OPENSEARCH_PASSWORD=your_password
```

## 4. 인덱스 템플릿과 대시보드

도메인이 생성된 뒤 프로젝트 루트에서 인덱스 템플릿을 등록합니다.

```powershell
.\deploy\aws\register_opensearch_template.ps1 `
  -OpenSearchEndpoint https://your-domain `
  -Username gmok_admin `
  -Password your_password
```

그 다음 OpenSearch Dashboards에서 `opensearch/dashboard.ndjson`를 import합니다.

자세한 절차는 `opensearch/dashboard-import-guide.md`를 참고합니다.

OpenSearch domain을 삭제 후 재생성한 경우에는 Lambda endpoint 갱신까지 필요합니다. `opensearch/recreate-runbook.md`를 먼저 확인합니다.

## 보안 메모

- `terraform.tfvars`와 `terraform.tfstate`에는 민감 정보가 포함될 수 있으므로 커밋하지 않습니다.
- `allowed_source_ips = []`는 public domain policy를 생성합니다. Fine-grained access control이 인증을 담당하지만, 공유 AWS 계정에서는 가능하면 IP allowlist를 사용합니다.
- 운영/장기 사용 목적이면 단일 노드 대신 multi-AZ와 적절한 retention 정책을 별도로 설계합니다.
