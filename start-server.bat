@echo off
chcp 65001 >nul
title TradeBot-PROD (port 5000)
cd /d D:\Projects\tradebot
npm run dev
