@echo off
chcp 65001 >nul
echo ====================================
echo  TradeBot 운영 배포
echo  dev -> prod 파일 복사 + 서버 재시작
echo ====================================
echo.

set DEV=D:\Projects\tradebot-dev
set PROD=D:\Projects\tradebot

echo [1] 코드 복사 중 (dev -> prod)...
robocopy %DEV%\server   %PROD%\server   /E /XD node_modules /NFL /NDL /NJS
robocopy %DEV%\client   %PROD%\client   /E /XD node_modules /NFL /NDL /NJS
robocopy %DEV%\shared   %PROD%\shared   /E /NFL /NDL /NJS
robocopy %DEV%\migrations %PROD%\migrations /E /NFL /NDL /NJS
echo [OK] 코드 복사 완료
echo.

echo [2] GitHub에도 올리기 (git push)...
cd /d %DEV%
git add -A
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "deploy: %date% %time%"
  git push origin dev
  echo [OK] GitHub dev 브랜치 push 완료
) else (
  echo [스킵] 변경된 파일 없음, push 생략
)
echo.

echo [2-5] SW 타임스탬프 주입 (prod 파일만 수정)...
set TS=%date:~0,4%%date:~5,2%%date:~8,2%-%time:~0,2%%time:~3,2%%time:~6,2%
powershell -Command "(Get-Content '%PROD%\client\public\sw.js') -replace 'BUILD_TIMESTAMP: .*', 'BUILD_TIMESTAMP: %TS%' | Set-Content '%PROD%\client\public\sw.js'"
echo [OK] SW 버전: %TS%
echo.

echo [3] 운영 서버 재시작 중...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000 " ^| findstr "LISTENING"') do (
  taskkill /PID %%a /F >nul 2>&1
)
schtasks /End /TN "TradeBot-Server" >nul 2>&1
ping -n 4 127.0.0.1 >nul
schtasks /Run /TN "TradeBot-Server"
if errorlevel 1 (
  echo [오류] TradeBot-Server 시작 실패
  pause
  exit /b 1
)
echo [OK] 운영 서버 재시작 완료
echo.

echo ====================================
echo  배포 완료!
echo  운영: http://localhost:5000
echo  개발: http://localhost:5002
echo ====================================
ping -n 4 127.0.0.1 >nul
