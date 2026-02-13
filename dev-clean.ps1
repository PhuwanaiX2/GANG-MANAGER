# dev-clean.ps1 — Kill old processes, clear cache, restart dev server
Write-Host "=== Stopping Node processes ===" -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Host "=== Clearing .next cache ===" -ForegroundColor Yellow
if (Test-Path "apps\web\.next") { Remove-Item -Recurse -Force "apps\web\.next" }

Write-Host "=== Starting dev server ===" -ForegroundColor Green
npm run dev -w apps/web
