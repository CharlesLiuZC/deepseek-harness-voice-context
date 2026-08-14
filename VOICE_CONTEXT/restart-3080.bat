@echo off
setlocal
chcp 65001 >nul
title DeepSeek Harness Web (3080)

echo ============================================
echo   DeepSeek Harness Web 一键重启 (端口 3080)
echo ============================================
echo.

REM 1) 停掉占用 3080 的旧进程
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c = Get-NetTCPConnection -LocalPort 3080 -State Listen -ErrorAction SilentlyContinue; if ($c) { $c | ForEach-Object { Write-Host ('  Stopping PID ' + $_.OwningProcess + ' ...'); Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } } else { Write-Host '  No process on 3080.' }"

echo.
echo   Waiting for the port to release ...
timeout /t 2 /nobreak >nul

REM 2) 在新窗口启动服务（关闭该窗口即停止服务）
start "DeepSeek Harness Web (3080)" cmd /k "cd /d D:\deepseek-harness && pnpm dsh web"

REM 3) 等启动后自动打开浏览器
echo.
echo   Starting the server, the browser will open in ~10s ...
timeout /t 10 /nobreak >nul
start "" http://127.0.0.1:3080

echo.
echo   Done. The server runs in its own window; close that window to stop it.
echo   If the page has not loaded yet, refresh http://127.0.0.1:3080 .
timeout /t 3 /nobreak >nul
endlocal
