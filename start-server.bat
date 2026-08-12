@echo off
chcp 65001 >nul
title TradeBot-PROD (port 5000)
cd /d D:\Projects\tradebot
if not exist logs mkdir logs
set "LOG_FILE=D:\Projects\tradebot\logs\server-prod.log"

:restart
echo.>> "%LOG_FILE%"
echo [%date% %time%] Starting TradeBot PROD...>> "%LOG_FILE%"
call npm run dev >> "%LOG_FILE%" 2>&1
set "EXIT_CODE=%ERRORLEVEL%"
echo [%date% %time%] Server exited with code %EXIT_CODE%; restarting in 10 seconds...>> "%LOG_FILE%"
timeout /t 10 /nobreak >nul
goto restart
