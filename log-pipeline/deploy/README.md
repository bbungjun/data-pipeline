# GMOK 濡쒓렇 ?뚯씠?꾨씪??諛고룷 媛?대뱶

??臾몄꽌???꾩옱 ??μ냼???ㅽ겕由쏀듃瑜??ъ슜??AWS? EC2??濡쒓렇 ?뚯씠?꾨씪?몄쓣 ?곸슜?섎뒗 ?덉감?낅땲?? AWS 由ъ쟾? 怨듭쑀 怨꾩젙 湲곗???留욎떠 `eu-central-1`濡?怨좎젙?⑸땲??

## 1. ?ъ쟾 以鍮?
濡쒖뺄 PC:

- PowerShell
- AWS CLI
- AWS CLI ?몄쬆 ?ㅼ젙
- OpenSearch endpoint
- Lambda ?ㅽ뻾 Role ARN
- EC2 SSH ?묎렐 沅뚰븳

EC2/?댁쁺 ?섍꼍:

- PostgreSQL ?묒냽 ?뺣낫
- OpenSearch ?몄쬆 ?뺣낫
- Discord webhook URL

AWS CLI ?몄쬆 ?뺤씤:

```powershell
aws sts get-caller-identity
```

## 2. AWS?먯꽌 癒쇱? ?뺤씤??寃?
### OpenSearch

- 由ъ쟾: `eu-central-1`
- ?몃뜳???⑦꽩: `gmok-back-logs-*`
- endpoint ?덉떆: `https://search-your-domain.eu-central-1.es.amazonaws.com`
- Basic Auth瑜??ъ슜??寃쎌슦 username/password瑜?以鍮꾪빀?덈떎.
- Terraform?쇰줈 ??domain??留뚮뱾 寃쎌슦 `infra/opensearch-terraform/README.md`瑜?癒쇱? 吏꾪뻾?⑸땲??

### Lambda Role

沅뚯옣 ?대쫫:

- `gmok-transform-logs-lambda-role`

?꾩슂 沅뚰븳:

- `AWSLambdaBasicExecutionRole`
- Lambda?먯꽌 OpenSearch endpoint???묎렐 媛?ν븳 ?ㅽ듃?뚰겕/?몄쬆 ?ㅼ젙

### EC2 Role

CloudWatch Agent媛 濡쒓렇瑜??????덉뼱???⑸땲??

- `CloudWatchAgentServerPolicy`

## 3. 濡쒖뺄 PowerShell 諛고룷

?꾨줈?앺듃 猷⑦듃?먯꽌 ?ㅽ뻾?⑸땲??

```powershell
cd "C:\Users\PC\Desktop\data-pipeline"
```

Lambda ZIP ?앹꽦:

```powershell
.\log-pipeline\deploy\aws\package_lambda.ps1
```

OpenSearch ?몃뜳???쒗뵆由??깅줉:

```powershell
.\log-pipeline\deploy\aws\register_opensearch_template.ps1 `
  -OpenSearchEndpoint https://your-opensearch-endpoint `
  -Username your_username `
  -Password your_password
```

Lambda, CloudWatch Log Group, subscription filter 援ъ꽦:

```powershell
.\log-pipeline\deploy\aws\setup_aws_resources.ps1 `
  -LambdaRoleArn arn:aws:iam::<account-id>:role/<lambda-role> `
  -OpenSearchEndpoint https://your-opensearch-endpoint `
  -OpenSearchUsername your_username `
  -OpenSearchPassword your_password
```

???ㅽ겕由쏀듃媛 援ъ꽦?섎뒗 由ъ냼??

- Lambda ?⑥닔: `gmok-transform-logs`
- CloudWatch Log Group:
  - `/gmok/dev/back/out`
  - `/gmok/dev/back/error`
- 濡쒓렇 蹂댁〈 湲곌컙: 14??- CloudWatch Logs subscription filter
- Lambda ?섍꼍蹂??
  - `DEFAULT_SERVICE`
  - `DEFAULT_ENVIRONMENT`
  - `OUTPUT_INDEX_PREFIX`
  - `OPENSEARCH_BULK_URL`
  - `OPENSEARCH_USERNAME`
  - `OPENSEARCH_PASSWORD`

## 4. EC2 ?낅줈??
沅뚯옣 ?묒뾽 ?붾젆?곕━:

```text
/opt/gmok-log-pipeline
```

EC2濡??낅줈?쒗븷 ?대뜑:

- `cloudwatch/`
- `config/`
- `deploy/ec2/`
- `poller/`
- `scripts/`

?덉긽 援ъ“:

```text
/opt/gmok-log-pipeline
?쒋?? cloudwatch/
?쒋?? config/
?쒋?? deploy/ec2/
?쒋?? poller/
?붴?? scripts/
```

## 5. EC2 ?ㅼ젙

?묒뾽 ?붾젆?곕━ ?대룞:

```bash
cd /opt/gmok-log-pipeline
```

?섍꼍 ?뚯씪 ?앹꽦:

```bash
cp config/pipeline.env.example config/pipeline.env
```

`config/pipeline.env`???ㅼ젣 媛믪쓣 ?낅젰?⑸땲??

?꾩닔 媛?

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

CloudWatch Agent ?ㅼ튂 諛??쒖옉:

```bash
bash deploy/ec2/install_cloudwatch_agent.sh /opt/gmok-log-pipeline/cloudwatch/amazon-cloudwatch-agent.json
```

DB poller ?섏〈???ㅼ튂:

```bash
APP_DIR=/opt/gmok-log-pipeline bash deploy/ec2/install_db_poller.sh
```

cron ?깅줉:

```bash
APP_DIR=/opt/gmok-log-pipeline ENV_FILE=/opt/gmok-log-pipeline/config/pipeline.env bash deploy/ec2/install_cron_jobs.sh
```

?깅줉?섎뒗 ?묒뾽:

- 留ㅻ텇 `error_log` ?뚯씠釉?poll
- 留ㅻ텇 OpenSearch 湲곕컲 Discord ?뚮┝ ?됯?

愿??濡쒓렇:

- `/opt/gmok-log-pipeline/logs/poller.log`
- `/opt/gmok-log-pipeline/logs/alerts.log`

?곹깭 ?뚯씪:

- `/opt/gmok-log-pipeline/.state/error_log_checkpoint.json`
- `/opt/gmok-log-pipeline/.state/discord_alert_state.json`

## 6. 諛고룷 ???뺤씤

CloudWatch Agent:

```bash
sudo systemctl status amazon-cloudwatch-agent
```

cron:

```bash
crontab -l
```

poller 濡쒓렇:

```bash
tail -f /opt/gmok-log-pipeline/logs/poller.log
```

?뚮┝ ?됯? 濡쒓렇:

```bash
tail -f /opt/gmok-log-pipeline/logs/alerts.log
```

CloudWatch Logs?먯꽌 ?뺤씤??濡쒓렇 洹몃９:

- `/gmok/dev/back/out`
- `/gmok/dev/back/error`

OpenSearch?먯꽌 ?뺤씤??????꾪꽣:

- `source_log:out`
- `source_log:error`
- `source_log:db_error_log`
- `event_type:http_request`
- `event_type:error_event`
- `status_code:[500 TO *]`

## 7. ?먯＜ 蹂대뒗 臾몄젣

### CloudWatch?먮뒗 ?ㅼ뼱?ㅻ뒗??OpenSearch?????ㅼ뼱??
- Lambda ?섍꼍蹂??`OPENSEARCH_BULK_URL` ?뺤씤
- OpenSearch ?몄쬆 ?뺣낫 ?뺤씤
- Lambda?먯꽌 OpenSearch endpoint ?ㅽ듃?뚰겕 ?묎렐 媛???щ? ?뺤씤
- Lambda CloudWatch Logs???먮윭 ?뺤씤

### EC2 濡쒓렇媛 CloudWatch?????ㅼ뼱??
- EC2 Role??`CloudWatchAgentServerPolicy`媛 ?덈뒗吏 ?뺤씤
- ?ㅼ젣 濡쒓렇 ?뚯씪 寃쎈줈媛 `/home/ec2-user/deploy/back/logs/*.log`? 留욌뒗吏 ?뺤씤
- CloudWatch Agent config 寃쎈줈 ?뺤씤
- `sudo systemctl status amazon-cloudwatch-agent` ?뺤씤

### DB poller媛 ?ㅽ뙣??
- `config/pipeline.env`??DB 媛??뺤씤
- RDS 蹂댁븞 洹몃９??EC2 ?묎렐???덉슜?섎뒗吏 ?뺤씤
- `/opt/gmok-log-pipeline/logs/poller.log` ?뺤씤
- `poller/node_modules/pg` ?ㅼ튂 ?щ? ?뺤씤

### Discord ?뚮┝???ㅼ? ?딆쓬

- `DISCORD_WEBHOOK_URL` ?뺤씤
- `OPENSEARCH_SEARCH_URL` ?뺤씤
- `/opt/gmok-log-pipeline/logs/alerts.log` ?뺤씤
- ?뚮┝ ?꾧퀎移섍? ?덈Т ?믪? ?딆?吏 ?뺤씤
