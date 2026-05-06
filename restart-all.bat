@echo off
echo TradeBot 전체 재시작 중...
schtasks /End /TN "TradeBot-Server" 2>nul
schtasks /End /TN "TradeBot-Agent" 2>nul
schtasks /End /TN "TradeBot-Caddy" 2>nul
timeout /t 2 /nobreak >nul
schtasks /Run /TN "TradeBot-Server"
timeout /t 30 /nobreak >nul
schtasks /Run /TN "TradeBot-Agent"
schtasks /Run /TN "TradeBot-Caddy"
echo 완료!
