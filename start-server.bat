@echo off
chcp 65001 >nul
title TradeBot-PROD (port 5000)
cd /d D:\Projects\tradebot
if not exist logs mkdir logs
set "LOG_FILE=D:\Projects\tradebot\logs\server-prod.log"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "scripts\clear-server-port.ps1" -Port 5000
if errorlevel 1 exit /b %ERRORLEVEL%

:restart
echo.>> "%LOG_FILE%"
echo [%date% %time%] Starting TradeBot PROD...
echo [%date% %time%] Starting TradeBot PROD...>> "%LOG_FILE%"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "scripts\run-server-with-log.ps1" -LogFile "%LOG_FILE%"
set "EXIT_CODE=%ERRORLEVEL%"
echo [%date% %time%] Server exited with code %EXIT_CODE%; restarting in 10 seconds...
echo [%date% %time%] Server exited with code %EXIT_CODE%; restarting in 10 seconds...>> "%LOG_FILE%"
timeout /t 10 /nobreak >nul
goto restart
