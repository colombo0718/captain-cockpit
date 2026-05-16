# Captain Cockpit - Install Windows taskbar shortcut
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File install-taskbar-shortcut.ps1
#
# After running, find "Captain Cockpit.lnk" on your Desktop.
# Right-click it -> "Show more options" (Win11) -> "Pin to taskbar"

$shortcutName = "Captain Cockpit.lnk"
$shortcutPath = Join-Path $env:USERPROFILE "Desktop\$shortcutName"

# VS Code executable (user install default)
$vscodeExe = Join-Path $env:LOCALAPPDATA "Programs\Microsoft VS Code\Code.exe"
if (-not (Test-Path $vscodeExe)) {
    $vscodeExe = "C:\Program Files\Microsoft VS Code\Code.exe"
}

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($shortcutPath)

# Use explorer.exe to launch the URI - Windows routes it to VS Code without flashing a console
$Shortcut.TargetPath = "explorer.exe"
$Shortcut.Arguments = '"vscode://leaflune.captain-cockpit/"'

# Icon: BIG ROCKET .ico (generated from Segoe UI Emoji)
$rocketIco = Join-Path $PSScriptRoot "..\media\rocket.ico" | Resolve-Path -ErrorAction SilentlyContinue
if ($rocketIco) {
    $Shortcut.IconLocation = "$($rocketIco.Path),0"
} elseif (Test-Path $vscodeExe) {
    # Fallback to VS Code icon if rocket.ico missing
    $Shortcut.IconLocation = "$vscodeExe,0"
}

$Shortcut.Description = "Captain Cockpit - LL driver seat"
$Shortcut.Save()

Write-Host ""
Write-Host "OK: Shortcut created at $shortcutPath" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps (manual):" -ForegroundColor Yellow
Write-Host "  1. Find 'Captain Cockpit.lnk' on your Desktop"
Write-Host "  2. Right-click -> 'Show more options' (Win11) -> 'Pin to taskbar'"
Write-Host "  3. Click the taskbar icon to launch the cockpit"
Write-Host ""
Write-Host "Prerequisites:" -ForegroundColor Yellow
Write-Host "  - VS Code must have captain-cockpit Extension installed (vsix or F5 dev mode)"
Write-Host "  - First click: VS Code will ask to allow the URI - click Allow"
