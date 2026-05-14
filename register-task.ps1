# TradeBot-Dev-Server Task Scheduler 등록
# 우클릭 → 관리자 권한으로 실행

$TaskName = "TradeBot-Dev-Server"
$BatFile  = "D:\Projects\tradebot-dev\start-dev-server.bat"

# 기존 태스크 있으면 삭제
schtasks /Delete /TN $TaskName /F 2>$null

# 태스크 등록 (로그인 시 자동 시작, 항상 재시작)
schtasks /Create `
  /TN $TaskName `
  /TR "cmd.exe /c `"$BatFile`"" `
  /SC ONLOGON `
  /RL HIGHEST `
  /F

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ $TaskName 등록 완료" -ForegroundColor Green
    Write-Host ""
    Write-Host "지금 바로 시작할게요..."
    schtasks /Run /TN $TaskName
    Write-Host "✅ 개발 서버 시작 (포트 5002)" -ForegroundColor Green
} else {
    Write-Host "❌ 등록 실패. 관리자 권한으로 실행했는지 확인하세요." -ForegroundColor Red
}

Write-Host ""
Write-Host "아무 키나 누르면 닫힙니다..."
pause
