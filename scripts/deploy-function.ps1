param(
  [Parameter(Mandatory = $true)][string]$Token,
  [Parameter(Mandatory = $true)][string]$Ref,
  [Parameter(Mandatory = $true)][string]$FunctionsDir,  # supabase/functions
  [Parameter(Mandatory = $true)][string]$Slug,
  [bool]$VerifyJwt = $false
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http

$uri = "https://api.supabase.com/v1/projects/$Ref/functions/deploy?slug=$Slug"
$client = New-Object System.Net.Http.HttpClient
$client.Timeout = [TimeSpan]::FromSeconds(180)
$client.DefaultRequestHeaders.Authorization =
  New-Object System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", $Token)

$form = New-Object System.Net.Http.MultipartFormDataContent

# Collect files: the function's own dir + shared code + import map (deno.json).
$root = (Resolve-Path $FunctionsDir).Path
$files = @()
$files += Get-ChildItem (Join-Path $FunctionsDir "$Slug") -Recurse -File
$files += Get-ChildItem (Join-Path $FunctionsDir "_shared") -Recurse -File
$denoJson = Join-Path $FunctionsDir "deno.json"
if (Test-Path $denoJson) { $files += Get-Item $denoJson }

foreach ($f in $files) {
  $rel = $f.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
  $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
  $content = New-Object System.Net.Http.ByteArrayContent(, $bytes)
  $content.Headers.ContentType =
    [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("application/typescript")
  $form.Add($content, "file", $rel)
}

$metadata = @{
  name            = $Slug
  entrypoint_path = "$Slug/index.ts"
  import_map_path = "deno.json"
  verify_jwt      = $VerifyJwt
  static_patterns = @()
} | ConvertTo-Json -Compress

$metaContent = New-Object System.Net.Http.StringContent($metadata)
$metaContent.Headers.ContentType =
  [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("application/json")
$form.Add($metaContent, "metadata")

$resp = $client.PostAsync($uri, $form).GetAwaiter().GetResult()
$respBody = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
Write-Host "$Slug -> HTTP $([int]$resp.StatusCode)"
if ([int]$resp.StatusCode -ge 300) { Write-Host $respBody; exit 1 }
