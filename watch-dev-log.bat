@echo off
chcp 65001 >nul
title Watch DEV log (read-only tail)
REM Live view of the DEV server log. This only READS the file, so pausing/closing
REM this window (even QuickEdit selection) never affects the running server.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "Get-Content -LiteralPath 'D:\Projects\tradebot-dev\logs\server-dev.log' -Wait -Tail 60 -Encoding utf8"
