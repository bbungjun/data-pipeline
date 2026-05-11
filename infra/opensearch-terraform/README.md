# OpenSearch Terraform Deployment

??Terraform 援ъ꽦? GMOK 濡쒓렇 ?뚯씠?꾨씪?몄슜 AWS OpenSearch Service domain???앹꽦?⑸땲??

## 湲곕낯媛?
- Region: `eu-central-1`
- Domain: `gmok-log-search`
- Engine: `OpenSearch_2.13`
- Instance: `t3.small.search`
- Node count: `1`
- EBS: `gp3`, `10 GiB`
- Fine-grained access control: enabled
- Internal user database: enabled
- HTTPS only, node-to-node encryption, encryption at rest: enabled

## 1. 蹂???뚯씪 ?앹꽦

```powershell
cd C:\Users\PC\Desktop\data-pipeline\infra\opensearch-terraform
Copy-Item terraform.tfvars.example terraform.tfvars
```

`terraform.tfvars`?먯꽌 `master_user_password`瑜?媛뺥븳 鍮꾨?踰덊샇濡?諛붽퓠?덈떎. 媛?ν븯硫?`allowed_source_ips`???꾩옱 怨듭씤 IP `/32`濡??쒗븳?⑸땲??
CloudWatch subscription Lambda媛 ??domain??濡쒓렇瑜?蹂대궪 寃쎌슦 `allowed_principal_arns`??Lambda ?ㅽ뻾 role ARN???ｌ뒿?덈떎.

?꾩옱 怨듭씤 IP ?뺤씤 ?덉떆:

```powershell
(Invoke-RestMethod https://checkip.amazonaws.com).Trim()
```

?덉떆:

```hcl
allowed_source_ips = ["203.0.113.10/32"]
allowed_principal_arns = ["arn:aws:iam::827913617635:role/mmr-transform-logs-lambda-role"]
```

## 2. 諛고룷

AWS ?몄쬆??癒쇱? ?≫? ?덉뼱???⑸땲??

```powershell
aws sts get-caller-identity
```

??紐낅졊???ㅽ뙣?섎㈃ `aws configure`, SSO login, ?먮뒗 ?꾨줈?앺듃?먯꽌 ?ъ슜?섎뒗 怨듭쑀 怨꾩젙 ?몄쬆 ?덉감瑜?癒쇱? ?꾨즺?⑸땲??

```powershell
terraform init
terraform plan
terraform apply
```

OpenSearch domain ?앹꽦? 蹂댄넻 ??遺??댁긽 嫄몃┰?덈떎.

## 3. 異쒕젰媛??뺤씤

```powershell
terraform output endpoint
terraform output dashboards_endpoint
terraform output bulk_url
terraform output search_url
```

??媛믩뱾??`log-pipeline/config/pipeline.env`? AWS Lambda ?섍꼍蹂?섏뿉 諛섏쁺?⑸땲??

```env
OPENSEARCH_BULK_URL=https://your-domain/_bulk
OPENSEARCH_SEARCH_URL=https://your-domain/gmok-back-logs-*/_search
OPENSEARCH_USERNAME=gmok_admin
OPENSEARCH_PASSWORD=your_password
```

## 4. ?몃뜳???쒗뵆由욧낵 ??쒕낫??
?꾨찓?몄씠 ?앹꽦?????꾨줈?앺듃 猷⑦듃?먯꽌 ?몃뜳???쒗뵆由우쓣 ?깅줉?⑸땲??

```powershell
.\log-pipeline\deploy\aws\register_opensearch_template.ps1 `
  -OpenSearchEndpoint https://your-domain `
  -Username gmok_admin `
  -Password your_password
```

洹??ㅼ쓬 OpenSearch Dashboards?먯꽌 `log-pipeline/opensearch/dashboard.ndjson`瑜?import?⑸땲??

?먯꽭???덉감??`opensearch/dashboard-import-guide.md`瑜?李멸퀬?⑸땲??

OpenSearch domain????젣 ???ъ깮?깊븳 寃쎌슦?먮뒗 Lambda endpoint 媛깆떊源뚯? ?꾩슂?⑸땲?? `opensearch/recreate-runbook.md`瑜?癒쇱? ?뺤씤?⑸땲??

## 蹂댁븞 硫붾え

- `terraform.tfvars`? `terraform.tfstate`?먮뒗 誘쇨컧 ?뺣낫媛 ?ы븿?????덉쑝誘濡?而ㅻ컠?섏? ?딆뒿?덈떎.
- `allowed_source_ips = []`??public domain policy瑜??앹꽦?⑸땲?? Fine-grained access control???몄쬆???대떦?섏?留? 怨듭쑀 AWS 怨꾩젙?먯꽌??媛?ν븯硫?IP allowlist瑜??ъ슜?⑸땲??
- ?댁쁺/?κ린 ?ъ슜 紐⑹쟻?대㈃ ?⑥씪 ?몃뱶 ???multi-AZ? ?곸젅??retention ?뺤콉??蹂꾨룄濡??ㅺ퀎?⑸땲??
