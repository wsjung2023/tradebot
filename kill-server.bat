@echo off
chcp 65001 >nul
echo 서버 종료 중 (port 5000)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000" ^| findstr "LISTENING"') do (
    echo PID %%a 종료 중...
    taskkill /PID %%a /F
)
echo 완료!
