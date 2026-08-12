#Requires -RunAsAdministrator

[CmdletBinding()]
param(
    [switch]$SettingsOnly,
    [switch]$NoStart
)

$ErrorActionPreference = 'Stop'

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances IgnoreNew

$definitions = @(
    [pscustomobject]@{
        TaskName = 'TradeBot-Server'
        Title = 'TradeBot-PROD (port 5000)'
        BatFile = 'D:\Projects\tradebot\start-server.bat'
        Delay = $null
    },
    [pscustomobject]@{
        TaskName = 'TradeBot-Dev-Server'
        Title = 'TradeBot-DEV (port 5002)'
        BatFile = 'D:\Projects\tradebot-dev\start-dev-server.bat'
        Delay = 'PT30S'
    }
)

function New-ServerTriggers {
    param(
        [pscustomobject]$Definition,
        [string]$UserId
    )

    $logonTrigger = New-ScheduledTaskTrigger -AtLogOn -User $UserId
    if ($Definition.Delay) {
        $logonTrigger.Delay = $Definition.Delay
    }

    $watchdogTrigger = New-ScheduledTaskTrigger -Once `
        -At (Get-Date).AddMinutes(1) `
        -RepetitionInterval (New-TimeSpan -Minutes 1)
    $watchdogTrigger.Repetition.StopAtDurationEnd = $false

    return @($logonTrigger, $watchdogTrigger)
}

$userId = "$env:USERDOMAIN\$env:USERNAME"

if ($SettingsOnly) {
    foreach ($definition in $definitions) {
        $task = Get-ScheduledTask -TaskName $definition.TaskName -ErrorAction SilentlyContinue
        if (-not $task) {
            throw "Scheduled task not found: $($definition.TaskName)"
        }

        $triggers = New-ServerTriggers -Definition $definition -UserId $userId

        Set-ScheduledTask `
            -TaskName $definition.TaskName `
            -Trigger $triggers `
            -Settings $settings | Out-Null
        Write-Host "Updated restart policy: $($definition.TaskName)" -ForegroundColor Green
    }
    return
}

$principal = New-ScheduledTaskPrincipal `
    -UserId $userId `
    -LogonType Interactive `
    -RunLevel Highest

foreach ($definition in $definitions) {
    if (-not (Test-Path -LiteralPath $definition.BatFile)) {
        throw "Launcher not found: $($definition.BatFile)"
    }

    $arguments = "/c `"title $($definition.Title) && $($definition.BatFile)`""
    $action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument $arguments
    $triggers = New-ServerTriggers -Definition $definition -UserId $userId

    Register-ScheduledTask `
        -TaskName $definition.TaskName `
        -Action $action `
        -Trigger $triggers `
        -Principal $principal `
        -Settings $settings `
        -Description 'TradeBot visible server console with automatic restart' `
        -Force | Out-Null

    Write-Host "Registered: $($definition.TaskName)" -ForegroundColor Green
    if (-not $NoStart) {
        Start-ScheduledTask -TaskName $definition.TaskName
    }
}
