@echo off
chcp 65001 >nul
title Watch PROD log (read-only tail)
REM Live view of the PROD server log. This only READS the file, so pausing/closing
REM this window (even QuickEdit selection) never affects the running server.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "Get-Content -LiteralPath 'D:\Projects\tradebot\logs\server-prod.log' -Wait -Tail 60 -Encoding utf8"
