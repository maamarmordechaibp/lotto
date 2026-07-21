param(
  [Parameter(Mandatory = $true)][string]$Token,
  [Parameter(Mandatory = $true)][string]$Ref,
  [Parameter(Mandatory = $true)][string]$EnvFile
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Web.Extensions
$ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer

$secrets = @()
foreach ($line in Get-Content $EnvFile) {
  $t = $line.Trim()
  if ($t -eq "" -or $t.StartsWith("#")) { continue }
  $idx = $t.IndexOf("=")
  if ($idx -lt 1) { continue }
  $name = $t.Substring(0, $idx).Trim()
  $value = $t.Substring($idx + 1).Trim()
  # Skip reserved SUPABASE_* (auto-injected) and unset placeholders.
  if ($name -like "SUPABASE_*") { continue }
  if ($value -like "PASTE_*" -or $value -eq "") { continue }
  $secrets += @{ name = $name; value = $value }
}

if ($secrets.Count -eq 0) { Write-Host "No settable secrets found."; exit 0 }

$json = $ser.Serialize($secrets)
$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
$headers = @{ Authorization = "Bearer $Token" }
$uri = "https://api.supabase.com/v1/projects/$Ref/secrets"

$r = Invoke-WebRequest -Uri $uri -Method Post -Headers $headers -Body $bytes `
  -ContentType "application/json" -UseBasicParsing -TimeoutSec 60
Write-Host ("HTTP " + $r.StatusCode + " set " + $secrets.Count + " secrets:")
foreach ($s in $secrets) { Write-Host ("  " + $s.name) }
