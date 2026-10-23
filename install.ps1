# Installs BeatMarker AE into EffectCraft's ScriptUI Panels folder.
#   powershell -ExecutionPolicy Bypass -File install.ps1
#   powershell -ExecutionPolicy Bypass -File install.ps1 -Uninstall

param(
  [switch]$Uninstall,
  [string]$Destination
)

$ErrorActionPreference = "Stop"

if (-not $Destination) {
  if (-not $env:APPDATA) {
    throw "APPDATA is not set; pass -Destination <folder>."
  }
  $Destination = Join-Path $env:APPDATA "EffectCraft\Scripts\ScriptUI Panels"
}

$target = Join-Path $Destination "BeatMarker.jsx"
$source = Join-Path $PSScriptRoot "BeatMarker.jsx"

if ($Uninstall) {
  if (Test-Path $target) {
    Remove-Item $target -Force
    Write-Host "Removed $target" -ForegroundColor Yellow
    Write-Host "Restart EffectCraft to unload the panel."
  } else {
    Write-Host "BeatMarker is not installed at $target."
  }
  exit 0
}

if (-not (Test-Path $source)) {
  throw "BeatMarker.jsx not found next to this script."
}

New-Item -ItemType Directory -Force -Path $Destination | Out-Null
Copy-Item $source $target -Force

Write-Host "Installed BeatMarker AE to:" -ForegroundColor Green
Write-Host "  $target"
Write-Host ""
Write-Host "Restart EffectCraft, then open Window > BeatMarker.jsx."
