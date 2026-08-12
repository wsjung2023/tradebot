param(
  [Parameter(Mandatory = $true)]
  [ValidateSet(5000, 5002)]
  [int]$Port
)

$ErrorActionPreference = 'Stop'
$connections = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
$processIds = @($connections | Select-Object -ExpandProperty OwningProcess -Unique)

foreach ($processId in $processIds) {
  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if (-not $process) {
    continue
  }

  if ($process.ProcessName -ne 'node') {
    throw "Port $Port is owned by unexpected process $($process.ProcessName) (PID $processId)"
  }

  Write-Host "[WATCHDOG] Stopping orphaned Node process on port $Port (PID $processId)..."
  Stop-Process -Id $processId -Force
  Wait-Process -Id $processId -Timeout 10 -ErrorAction SilentlyContinue
}
