@echo off
chcp 65001 >nul
title TradeBot-DEV (port 5002) - logs to logs\server-dev.log
cd /d D:\Projects\tradebot-dev
set PORT=5002
if not exist logs mkdir logs
set "LOG_FILE=D:\Projects\tradebot-dev\logs\server-dev.log"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "scripts\clear-server-port.ps1" -Port 5002
if errorlevel 1 exit /b %ERRORLEVEL%

REM [STABILITY] Server stdout/stderr go straight to the LOG FILE (a file handle),
REM never to a console pipe. So clicking/selecting this window (QuickEdit) or the
REM log reader stalling can no longer back-pressure Node and freeze the server.
REM Live log view: run watch-dev-log.bat (it tails the file, fully decoupled).
echo TradeBot-DEV starting. Logs -^> %LOG_FILE%   (live view: watch-dev-log.bat)

:restart
echo.>> "%LOG_FILE%"
echo [%date% %time%] Starting TradeBot DEV...>> "%LOG_FILE%"
call npm.cmd run dev >> "%LOG_FILE%" 2>&1
echo [%date% %time%] Server exited with code %ERRORLEVEL%; restarting in 10 seconds...>> "%LOG_FILE%"
timeout /t 10 /nobreak >nul
goto restart
