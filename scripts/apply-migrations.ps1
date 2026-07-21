param(
  [Parameter(Mandatory = $true)][string]$Token,
  [Parameter(Mandatory = $true)][string]$Ref,
  [Parameter(Mandatory = $true)][string]$Dir,
  [switch]$Seed
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Web.Extensions
$ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$ser.MaxJsonLength = [int]::MaxValue

$headers = @{ Authorization = "Bearer $Token" }
$uri = "https://api.supabase.com/v1/projects/$Ref/database/query"

function Invoke-Sql([string]$sql, [string]$label) {
  # JavaScriptSerializer escapes non-ASCII to \uXXXX => pure-ASCII, safe JSON.
  $json = $ser.Serialize(@{ query = $sql })
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  try {
    $r = Invoke-WebRequest -Uri $uri -Method Post -Headers $headers -Body $bytes `
      -ContentType "application/json" -UseBasicParsing -TimeoutSec 120
    Write-Host "OK   $label -> $($r.StatusCode)"
    return $true
  }
  catch {
    Write-Host "FAIL $label"
    if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
    else { Write-Host $_.Exception.Message }
    return $false
  }
}

$files = Get-ChildItem (Join-Path $Dir "migrations/*.sql") | Sort-Object Name
foreach ($f in $files) {
  $sql = Get-Content $f.FullName -Raw -Encoding UTF8
  if (-not (Invoke-Sql $sql $f.Name)) { exit 1 }
}

if ($Seed) {
  $seedPath = Join-Path $Dir "seed/seed.sql"
  if (Test-Path $seedPath) {
    $sql = Get-Content $seedPath -Raw -Encoding UTF8
    Invoke-Sql $sql "seed.sql" | Out-Null
  }
}

Write-Host "DONE"
