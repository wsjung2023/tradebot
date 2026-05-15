@echo off
chcp 65001 >nul
echo TradeBot 전체 재시작 중...

echo [1] 포트 5000 프로세스 강제 종료...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000 " ^| findstr "LISTENING"') do (
  echo   PID %%a 종료 중...
  taskkill /PID %%a /F >nul 2>&1
)

echo [2] 스케줄러 태스크 종료...
schtasks /End /TN "TradeBot-Server" >nul 2>&1
schtasks /End /TN "TradeBot-Agent" >nul 2>&1
timeout /t 3 /nobreak >nul

echo [3] 서버 시작...
schtasks /Run /TN "TradeBot-Server"
if errorlevel 1 (
  echo [오류] TradeBot-Server 시작 실패. 작업 스케줄러에 등록되어 있는지 확인하세요.
) else (
  echo [OK] TradeBot-Server 시작
)

timeout /t 30 /nobreak >nul

echo [4] 에이전트 시작...
schtasks /Run /TN "TradeBot-Agent"
if errorlevel 1 (
  echo [오류] TradeBot-Agent 시작 실패.
) else (
  echo [OK] TradeBot-Agent 시작
)

echo.
echo 완료! 이 창은 자동으로 닫힙니다...
timeout /t 5 /nobreak >nul