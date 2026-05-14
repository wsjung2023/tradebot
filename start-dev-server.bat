@echo off
chcp 65001 >nul
title TradeBot-DEV (port 5002)
cd /d D:\Projects\tradebot-dev
set PORT=5002
npm run dev
