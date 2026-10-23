# Runs the BeatMarker test suite against the installed EffectCraft CLI.
#   powershell -ExecutionPolicy Bypass -File test\run.ps1
# Optional: -Cli "C:\path\to\effectcraft-cli.exe"

param(
  [string]$Cli = "C:\Program Files\EffectCraft\effectcraft-cli.exe"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $Cli)) {
  throw "EffectCraft CLI not found at '$Cli'. Pass -Cli <path>."
}

$testDir = $PSScriptRoot
$root = Split-Path -Parent $testDir
$plugin = Join-Path $root "BeatMarker.jsx"
$copy = Join-Path $testDir ".BeatMarker.test.jsx"

if (-not (Test-Path $plugin)) {
  throw "BeatMarker.jsx not found at $plugin"
}

Copy-Item $plugin $copy -Force

$failed = 0
$results = @()

Push-Location $root
try {
  foreach ($name in @("analysis", "markers", "footage")) {
    $file = Join-Path $testDir "$name.test.jsx"
    Write-Host ""
    Write-Host "=== $name ===" -ForegroundColor Cyan
    $out = & $Cli script $file --empty 2>&1
    $code = $LASTEXITCODE
    if ($code -ne 0) {
      $failed++
      $results += [pscustomobject]@{ Test = $name; Result = "FAIL" }
      Write-Host ($out | Out-String).Trim() -ForegroundColor Red
    } else {
      $results += [pscustomobject]@{ Test = $name; Result = "PASS" }
      Write-Host ($out | Out-String).Trim() -ForegroundColor Green
    }
  }
} finally {
  Remove-Item $copy -ErrorAction SilentlyContinue
  Pop-Location
}

Write-Host ""
$results | Format-Table -AutoSize | Out-String | Write-Host

if ($failed -gt 0) {
  Write-Host "$failed test(s) failed." -ForegroundColor Red
  exit 1
}
Write-Host "All tests passed." -ForegroundColor Green
