# GMOK Log Pipeline Workspace

This repository is organized around the log collection and OpenSearch dashboard pipeline.

## Layout

- `log-pipeline/`: runtime pipeline assets for CloudWatch, Lambda log normalization, DB polling, alert evaluation, samples, and dashboard files.
- `infra/opensearch-terraform/`: OpenSearch-only Terraform used for the current dashboard recovery and operation flow.
- `archive/`: reference-only material that is not part of the active log pipeline path, including backend build output and full-stack Terraform.
- `reference/`: planning and project reference documents.

## Common Commands

Run these from the repository root unless noted otherwise.

```powershell
python log-pipeline\lambda\transform_logs\handler.py `
  log-pipeline\samples\raw\prefixed-json.log `
  log-pipeline\samples\normalized\normalized-prefixed-json.json

node log-pipeline\scripts\poll_error_log.mjs `
  --sample-input log-pipeline\samples\raw\error_log_rows.json `
  --output log-pipeline\samples\normalized\normalized-error-events.json

python log-pipeline\scripts\evaluate_alerts.py `
  log-pipeline\samples\normalized\normalized-prefixed-json.json `
  log-pipeline\samples\normalized\normalized-error-events.json
```

OpenSearch-only Terraform lives here:

```powershell
cd infra\opensearch-terraform
terraform init
terraform plan
terraform apply
```

Register the OpenSearch index template from the repository root:

```powershell
$endpoint = terraform -chdir=infra/opensearch-terraform output -raw endpoint
.\log-pipeline\deploy\aws\register_opensearch_template.ps1 `
  -OpenSearchEndpoint $endpoint `
  -Username gmok_admin `
  -Password "<password>"
```

Sync the recreated OpenSearch endpoint and password to the EC2 poller/alert env:

```powershell
.\log-pipeline\deploy\aws\sync_ec2_opensearch_env.ps1
```

Discord alert links use `DASHBOARD_URL` to build a Discover deep link for the alert window. Set it to the OpenSearch Dashboards base URL, for example `https://...eu-central-1.es.amazonaws.com/_dashboards`. If the imported data view id changes, set `DASHBOARD_DATA_VIEW_ID`; the default is `gmok-back-logs-pattern`.

## Notes

- `archive/terraform_setting-main` is intentionally not the active OpenSearch recovery path. It can touch EC2/RDS/VPC resources.
- Runtime state, Terraform state, `.tfvars`, build outputs, and `__pycache__` files should stay untracked.
