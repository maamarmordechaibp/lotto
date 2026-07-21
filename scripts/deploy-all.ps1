param(
  [Parameter(Mandatory = $true)][string]$Token,
  [Parameter(Mandatory = $true)][string]$Ref,
  [string]$Dir = "supabase",
  [switch]$Seed
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "== Applying migrations =="
& "$here/apply-migrations.ps1" -Token $Token -Ref $Ref -Dir $Dir @(if ($Seed) { "-Seed" })

Write-Host "== Setting secrets =="
$envFile = Join-Path $Dir "functions/.env"
if (Test-Path $envFile) {
  & "$here/set-secrets.ps1" -Token $Token -Ref $Ref -EnvFile $envFile
}

Write-Host "== Deploying Edge Functions =="
$functionsDir = Join-Path $Dir "functions"
$slugs = Get-ChildItem $functionsDir -Directory |
  Where-Object { $_.Name -ne "_shared" -and $_.Name -ne "tests" } |
  Select-Object -ExpandProperty Name
foreach ($slug in $slugs) {
  & "$here/deploy-function.ps1" -Token $Token -Ref $Ref -FunctionsDir $functionsDir -Slug $slug
}

Write-Host "== DONE =="
