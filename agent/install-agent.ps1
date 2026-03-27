# install-agent.ps1 - 키움 에이전트 원클릭 설치 스크립트
# 새 PC에서 이 파일 하나만 실행하면 모든 설정 완료

$REPLIT_URLS = "https://kiwoom-stock-ai-mainstop3.replit.app,https://1c838101-cb18-45bf-91c0-01f8a4836e2e-00-r6x4z40uc9yn.spock.replit.dev"
$AGENT_KEY   = "Password1qaz@WSX"
$INSTALL_DIR = "C:\kiwoom-agent"

Write-Host "=== 키움 에이전트 설치 ===" -ForegroundColor Cyan

# 1. 폴더 생성
New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null

# 2. Python 설치 (없으면 winget으로 설치)
if (-not (Get-Command python -ErrorAction SilentlyContinue) -and 
    -not (Test-Path "$env:USERPROFILE\scoop\apps\python\current\python.exe")) {
    Write-Host "Python 설치 중..." -ForegroundColor Yellow
    winget install Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements
}

# Python 경로 확인
$python = (Get-Command python -ErrorAction SilentlyContinue)?.Source
if (-not $python) { $python = "$env:USERPROFILE\scoop\apps\python\current\python.exe" }
Write-Host "Python: $python" -ForegroundColor Green

# 3. pip 패키지 설치
& $python -m pip install requests python-dotenv websocket-client --quiet

# 4. .env 파일 생성
@"
REPLIT_URLS=$REPLIT_URLS
AGENT_KEY=$AGENT_KEY
"@ | Set-Content "$INSTALL_DIR\.env" -Encoding UTF8

# 5. 에이전트 다운로드
Write-Host "에이전트 최신버전 다운로드..." -ForegroundColor Yellow
$headers = @{"x-agent-key" = $AGENT_KEY}
$baseUrl = ($REPLIT_URLS -split ",")[0]
Invoke-WebRequest "$baseUrl/api/kiwoom-agent/download" -Headers $headers -OutFile "$INSTALL_DIR\kiwoom-agent.py"

# 6. 실행 배치파일 생성
@"
@echo off
cd /d "$INSTALL_DIR"
"$python" kiwoom-agent.py
pause
"@ | Set-Content "$INSTALL_DIR\start.bat" -Encoding UTF8

# 7. Windows 시작프로그램 등록 (Task Scheduler)
$action  = New-ScheduledTaskAction -Execute $python -Argument "$INSTALL_DIR\kiwoom-agent.py" -WorkingDirectory $INSTALL_DIR
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -RestartCount 99 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName "KiwoomAgent" -Action $action -Trigger $trigger -Settings $settings -RunLevel Highest -Force | Out-Null

Write-Host ""
Write-Host "=== 설치 완료 ===" -ForegroundColor Green
Write-Host "에이전트 위치: $INSTALL_DIR" -ForegroundColor White
Write-Host "PC 시작 시 자동실행 등록됨" -ForegroundColor White
Write-Host ""
Write-Host "지금 바로 실행하려면 엔터..." -ForegroundColor Yellow
Read-Host
Start-Process $python -ArgumentList "$INSTALL_DIR\kiwoom-agent.py" -WorkingDirectory $INSTALL_DIR
