@echo off
setlocal

set "AGENT_DIR=%~dp0"
set "AGENT_FILE=%AGENT_DIR%kiwoom-agent.py"
set "LOG_FILE=%AGENT_DIR%agent.log"

echo [%date% %time%] 에이전트 자동재시작 스크립트 시작 >> "%LOG_FILE%"
echo 에이전트 경로: %AGENT_FILE%

:loop
echo [%date% %time%] 에이전트 시작 중...
echo [%date% %time%] 에이전트 시작 >> "%LOG_FILE%"
python "%AGENT_FILE%"
echo [%date% %time%] 에이전트 종료됨 (종료코드: %errorlevel%) >> "%LOG_FILE%"
echo [%date% %time%] 에이전트 종료됨. 10초 후 재시작...
timeout /t 10 /nobreak > nul
echo.
goto loop
