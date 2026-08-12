param(
  [Parameter(Mandatory = $true)]
  [string]$LogFile
)

$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $utf8

$logDirectory = [System.IO.Path]::GetDirectoryName($LogFile)
[System.IO.Directory]::CreateDirectory($logDirectory) | Out-Null

$startInfo = New-Object System.Diagnostics.ProcessStartInfo
$startInfo.FileName = $env:ComSpec
$startInfo.Arguments = '/d /s /c "npm.cmd run dev 2>&1"'
$startInfo.WorkingDirectory = (Get-Location).Path
$startInfo.UseShellExecute = $false
$startInfo.CreateNoWindow = $true
$startInfo.RedirectStandardOutput = $true
$startInfo.StandardOutputEncoding = $utf8

$process = New-Object System.Diagnostics.Process
$process.StartInfo = $startInfo
$writer = New-Object System.IO.StreamWriter($LogFile, $true, $utf8)
$writer.AutoFlush = $true

try {
  if (-not $process.Start()) {
    throw 'Failed to start npm.cmd'
  }

  while (-not $process.StandardOutput.EndOfStream) {
    $line = $process.StandardOutput.ReadLine()
    [Console]::WriteLine($line)
    $writer.WriteLine($line)
  }

  $process.WaitForExit()
  exit $process.ExitCode
} finally {
  $writer.Dispose()
  $process.Dispose()
}
