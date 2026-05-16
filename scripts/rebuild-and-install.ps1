# Captain Cockpit - rebuild .vsix and reinstall to main VS Code
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/rebuild-and-install.ps1
#
# Run this whenever you change extension source and want the change reflected
# in your main VS Code (not just F5 dev mode).

$ErrorActionPreference = "Stop"

$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

Write-Host "[1/3] TypeScript compile..." -ForegroundColor Cyan
npm run compile

Write-Host "[2/3] Package vsix..." -ForegroundColor Cyan
npx vsce package --skip-license --allow-missing-repository

$vsix = Get-ChildItem -Path . -Filter "captain-cockpit-*.vsix" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $vsix) {
    Write-Host "ERROR: No vsix file found after packaging" -ForegroundColor Red
    exit 1
}

Write-Host "[3/3] Install to VS Code..." -ForegroundColor Cyan
$codeCmd = Join-Path $env:LOCALAPPDATA "Programs\Microsoft VS Code\bin\code.cmd"
& $codeCmd --install-extension $vsix.FullName

Write-Host ""
Write-Host "OK Done. $($vsix.Name) installed." -ForegroundColor Green
Write-Host "   Reload VS Code window: Ctrl+Shift+P -> 'Developer: Reload Window'" -ForegroundColor Yellow
