$ErrorActionPreference = 'Stop'
$out = Join-Path $PSScriptRoot 'http-check.log'
$lines = @()
try {
  $r = Invoke-WebRequest -Uri 'http://localhost:4173/' -UseBasicParsing -TimeoutSec 20
  $lines += 'STATUS=' + $r.StatusCode
  $lines += 'HAS_ROOT=' + ($r.Content -match 'id="root"')
  $lines += 'HAS_JS=' + ($r.Content -match 'assets/index-.*\.js')
} catch {
  $lines += 'ERROR=' + $_.Exception.Message
}

# SPA route check
try {
  $r2 = Invoke-WebRequest -Uri 'http://localhost:4173/tim-kiem' -UseBasicParsing -TimeoutSec 20
  $lines += 'ROUTE_STATUS=' + $r2.StatusCode
} catch {
  $lines += 'ROUTE_ERROR=' + $_.Exception.Message
}

$lines | Out-File -FilePath $out -Encoding utf8
