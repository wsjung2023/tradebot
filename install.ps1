# TradeBot 자동 설치 스크립트
# 실행 방법: PowerShell에서 .\install.ps1

$ErrorActionPreference = "Stop"
$ProjectDir = "D:\Projects\tradebot"
$StartupDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   TradeBot 자동 설치 스크립트" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- API 키 입력 ---
Write-Host "[1/5] API 키 입력" -ForegroundColor Yellow
Write-Host ""

$PG_PASSWORD     = Read-Host "PostgreSQL 비밀번호"
$OPENAI_KEY      = Read-Host "OpenAI API 키"
$GOOGLE_ID       = Read-Host "Google Client ID"
$GOOGLE_SECRET   = Read-Host "Google Client Secret"
$NAVER_ID        = Read-Host "Naver Client ID"
$NAVER_SECRET    = Read-Host "Naver Client Secret"
$KIWOOM_KEY      = Read-Host "Kiwoom API 키"
$KIWOOM_SECRET   = Read-Host "Kiwoom API 시크릿"
$AGENT_KEY       = Read-Host "Agent 인증 키 (아무 문자열이나 입력)"
$DOMAIN          = Read-Host "도메인 주소 (예: wsj-aitradebot.live)"

Write-Host ""

# --- npm install ---
Write-Host "[2/5] npm 패키지 설치 중..." -ForegroundColor Yellow
Set-Location $ProjectDir
npm install
Write-Host "완료" -ForegroundColor Green
Write-Host ""

# --- .env 파일 생성 ---
Write-Host "[3/5] .env 파일 생성 중..." -ForegroundColor Yellow

$envContent = @"
DATABASE_URL=postgresql://postgres:$PG_PASSWORD@localhost:5432/tradebot
OPENAI_API_KEY=$OPENAI_KEY
GOOGLE_CLIENT_ID=$GOOGLE_ID
GOOGLE_CLIENT_SECRET=$GOOGLE_SECRET
NAVER_CLIENT_ID=$NAVER_ID
NAVER_CLIENT_SECRET=$NAVER_SECRET
KIWOOM_APP_KEY=$KIWOOM_KEY
KIWOOM_APP_SECRET=$KIWOOM_SECRET
AGENT_KEY=$AGENT_KEY
SESSION_SECRET=$(New-Guid)
NODE_ENV=development
"@

$envContent | Out-File -FilePath "$ProjectDir\.env" -Encoding utf8
Write-Host "완료" -ForegroundColor Green

# agent/.env 생성
$agentEnv = @"
REPLIT_URL=http://localhost:5000
AGENT_KEY=$AGENT_KEY
"@
$agentEnv | Out-File -FilePath "$ProjectDir\agent\.env" -Encoding utf8
Write-Host ""

# --- PostgreSQL DB 생성 ---
Write-Host "[4/5] 데이터베이스 생성 중..." -ForegroundColor Yellow

$env:PGPASSWORD = $PG_PASSWORD
$psqlPath = (Get-Command psql -ErrorAction SilentlyContinue)?.Source
if (-not $psqlPath) {
    $psqlPath = (Get-ChildItem "C:\Program Files\PostgreSQL" -Recurse -Filter "psql.exe" -ErrorAction SilentlyContinue | Select-Object -First 1)?.FullName
}

if ($psqlPath) {
    & $psqlPath -U postgres -c "CREATE DATABASE tradebot;" 2>$null
    Write-Host "DB 생성 완료" -ForegroundColor Green

    Write-Host "테이블 생성 중..."
    & npx drizzle-kit push 2>&1
    Write-Host "테이블 생성 완료" -ForegroundColor Green
} else {
    Write-Host "psql을 찾을 수 없습니다. PostgreSQL PATH를 확인하거나 수동으로 DB를 생성하세요." -ForegroundColor Red
}
Write-Host ""

# --- 시작 프로그램 등록 ---
Write-Host "[5/5] 시작 프로그램 등록 중..." -ForegroundColor Yellow

# start-server.bat 업데이트 (현재 경로로)
@"
@echo off
cd /d $ProjectDir
npm run dev
"@ | Out-File -FilePath "$ProjectDir\start-server.bat" -Encoding ascii

@"
@echo off
cd /d $ProjectDir\agent
python kiwoom-agent.py
"@ | Out-File -FilePath "$ProjectDir\start-agent.bat" -Encoding ascii

@"
@echo off
start "" "C:\cloudflared\cloudflared.exe" tunnel --config "C:\cloudflared\config.yml" run
"@ | Out-File -FilePath "$StartupDir\start-cloudflared.bat" -Encoding ascii

Copy-Item "$ProjectDir\start-server.bat" "$StartupDir\start-server.bat" -Force
Copy-Item "$ProjectDir\start-agent.bat" "$StartupDir\start-agent.bat" -Force

Write-Host "완료" -ForegroundColor Green
Write-Host ""

# --- 완료 ---
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   설치 완료!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "다음 단계:" -ForegroundColor White
Write-Host "1. C:\cloudflared\config.yml 파일에 터널 ID와 도메인($DOMAIN)을 입력하세요." -ForegroundColor White
Write-Host "2. Google Cloud Console에서 redirect URI를 추가하세요:" -ForegroundColor White
Write-Host "   https://$DOMAIN/api/auth/google/callback" -ForegroundColor Cyan
Write-Host "3. 서버 시작: npm run dev" -ForegroundColor White
Write-Host "4. 브라우저에서 http://localhost:5000 접속 확인" -ForegroundColor White
Write-Host ""
