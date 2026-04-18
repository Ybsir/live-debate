# 在项目根目录运行：同时启动 backend(8000) 与 gateway(8080)（新窗口）
$root = Split-Path -Parent $PSScriptRoot
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; npm start"
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\gateway\live-gateway-main'; npm start"
Write-Host "已在新窗口启动 backend :8000 与 gateway :8080"
