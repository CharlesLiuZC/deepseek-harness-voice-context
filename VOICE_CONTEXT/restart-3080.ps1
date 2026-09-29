# restart-3080.ps1 — 重启 DeepSeek Harness Web 服务（默认 3080 端口）
# 在【新的终端】里、于本仓库任意位置运行（自动定位到仓库根目录）：
#   powershell -ExecutionPolicy Bypass -File <仓库根目录>\VOICE_CONTEXT\restart-3080.ps1
#
# 注意：会停掉当前监听 3080 的旧服务。若你正通过该 Web 界面与本 agent 对话，
# 那个会话会随之结束（这是预期——新服务以新构建全新启动）。

$ErrorActionPreference = "Stop"
# 仓库根目录 = 本脚本所在目录的上一级（VOICE_CONTEXT/..）
Set-Location (Split-Path -Parent $PSScriptRoot)

# 1. 停掉监听 3080 的进程
$conns = Get-NetTCPConnection -LocalPort 3080 -State Listen -ErrorAction SilentlyContinue
foreach ($c in $conns) {
  Write-Host "Stopping PID $($c.OwningProcess) on port 3080..."
  Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2

# 2. 启动新构建（SILICONFLOW_API_KEY 从 .env / User 环境变量读取）
Write-Host "Starting dsh web on 3080..."
pnpm dsh web
