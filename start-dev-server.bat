@echo off
chcp 65001 >nul
title TradeBot-DEV (port 5002)
cd /d D:\Projects\tradebot-dev
set PORT=5002
if not exist logs mkdir logs
set "LOG_FILE=D:\Projects\tradebot-dev\logs\server-dev.log"

:restart
echo.>> "%LOG_FILE%"
echo [%date% %time%] Starting TradeBot DEV...>> "%LOG_FILE%"
call npm run dev >> "%LOG_FILE%" 2>&1
set "EXIT_CODE=%ERRORLEVEL%"
echo [%date% %time%] Server exited with code %EXIT_CODE%; restarting in 10 seconds...>> "%LOG_FILE%"
timeout /t 10 /nobreak >nul
goto restart
