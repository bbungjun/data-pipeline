$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$LambdaSource = Join-Path $Root "lambda\transform_logs\handler.py"
$BuildDir = Join-Path $Root "build"
$ZipPath = Join-Path $BuildDir "transform_logs_lambda.zip"
$StageDir = Join-Path $BuildDir "transform_logs_lambda"

if (-not (Test-Path $BuildDir)) {
  New-Item -ItemType Directory -Path $BuildDir | Out-Null
}

if (Test-Path $StageDir) {
  Remove-Item -Recurse -Force $StageDir
}

New-Item -ItemType Directory -Path $StageDir | Out-Null
Copy-Item $LambdaSource (Join-Path $StageDir "handler.py")

if (Test-Path $ZipPath) {
  Remove-Item -Force $ZipPath
}

Compress-Archive -Path (Join-Path $StageDir "*") -DestinationPath $ZipPath
Write-Output "Created $ZipPath"
