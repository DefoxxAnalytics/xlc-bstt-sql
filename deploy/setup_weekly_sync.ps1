<#
.SYNOPSIS
    Sets up automatic weekly data sync from FOXXSQLPROD.

.DESCRIPTION
    Creates a Windows Scheduled Task that runs every Sunday at 2 AM
    to pull the latest payroll week data from production.

.PARAMETER ProductionServer
    Production SQL Server (default: FOXXSQLPROD)

.PARAMETER ProductionUser
    Service account for production access

.PARAMETER ProductionPassword
    Password for production service account

.PARAMETER InstallDir
    BSTT-Web installation directory (default: C:\BSTT-Web)

.EXAMPLE
    .\setup_weekly_sync.ps1 -ProductionUser "svc_bstt_sync" -ProductionPassword "password"
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string]$ProductionServer = "FOXXSQLPROD",

    [Parameter()]
    [string]$ProductionDatabase = "XLCServices1",

    [Parameter(Mandatory=$true)]
    [string]$ProductionUser,

    [Parameter(Mandatory=$true)]
    [string]$ProductionPassword,

    [Parameter()]
    [string]$InstallDir = "C:\BSTT-Web"
)

$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "BSTT Weekly Data Sync Setup" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Create sync script
$syncScriptPath = "$InstallDir\scripts\sync_weekly.ps1"
New-Item -ItemType Directory -Path "$InstallDir\scripts" -Force | Out-Null
New-Item -ItemType Directory -Path "$InstallDir\logs" -Force | Out-Null

$syncScript = @"
# BSTT Weekly Data Sync Script
# Runs every Sunday at 2 AM to pull latest payroll data

`$ErrorActionPreference = "Stop"
`$logFile = "$InstallDir\logs\sync_`$(Get-Date -Format 'yyyyMMdd_HHmmss').log"

function Write-Log {
    param([string]`$Message)
    `$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "`$timestamp - `$Message" | Tee-Object -FilePath `$logFile -Append
}

Write-Log "Starting weekly data sync..."

# Set environment variables for production access
`$env:PROD_SQL_SERVER = "$ProductionServer"
`$env:PROD_SQL_DATABASE = "$ProductionDatabase"
`$env:PROD_SQL_USER = "$ProductionUser"
`$env:PROD_SQL_PASSWORD = "$ProductionPassword"

# Activate virtual environment and run sync
Set-Location "$InstallDir\backend"

try {
    # Sync last week's data
    & "$InstallDir\backend\.venv\Scripts\python.exe" manage.py sync_production --weeks 1 --replace 2>&1 | ForEach-Object {
        Write-Log `$_
    }

    Write-Log "Sync completed successfully"
} catch {
    Write-Log "ERROR: `$_"
    exit 1
}

# Cleanup old logs (keep 30 days)
Get-ChildItem "$InstallDir\logs" -Filter "sync_*.log" |
    Where-Object { `$_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
    Remove-Item -Force

Write-Log "Done"
"@

Set-Content -Path $syncScriptPath -Value $syncScript
Write-Host "Created sync script: $syncScriptPath" -ForegroundColor Green

# Create scheduled task
Write-Host ""
Write-Host "Creating scheduled task..." -ForegroundColor Cyan

$taskName = "BSTT-Weekly-Sync"
$taskPath = "\BSTT\"

# Remove existing task
Unregister-ScheduledTask -TaskName $taskName -TaskPath $taskPath -Confirm:$false -ErrorAction SilentlyContinue

# Create new task
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -File `"$syncScriptPath`"" `
    -WorkingDirectory "$InstallDir\backend"

# Run every Sunday at 2 AM
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 2am

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1)

$principal = New-ScheduledTaskPrincipal `
    -UserId "SYSTEM" `
    -LogonType ServiceAccount `
    -RunLevel Highest

Register-ScheduledTask `
    -TaskName $taskName `
    -TaskPath $taskPath `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Weekly sync of time entry data from FOXXSQLPROD to BSTT dashboard"

Write-Host "Scheduled task created: $taskPath$taskName" -ForegroundColor Green

# Test connectivity
Write-Host ""
Write-Host "Testing production connection..." -ForegroundColor Cyan

$testScript = @"
import pyodbc
conn_str = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=$ProductionServer;"
    "DATABASE=$ProductionDatabase;"
    "UID=$ProductionUser;"
    "PWD=$ProductionPassword;"
    "TrustServerCertificate=yes;"
)
try:
    conn = pyodbc.connect(conn_str)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES")
    row = cursor.fetchone()
    print(f"Connected to {row[0]} tables")
    conn.close()
except Exception as e:
    print(f"ERROR: {e}")
    exit(1)
"@

$result = & "$InstallDir\backend\.venv\Scripts\python.exe" -c $testScript 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  $result" -ForegroundColor Green
} else {
    Write-Host "  Connection failed: $result" -ForegroundColor Red
    Write-Host "  Check credentials and network access to $ProductionServer" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "WEEKLY SYNC SETUP COMPLETE" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Schedule:" -ForegroundColor Cyan
Write-Host "  Task: $taskPath$taskName"
Write-Host "  Runs: Every Sunday at 2:00 AM"
Write-Host "  Logs: $InstallDir\logs\"
Write-Host ""
Write-Host "Manual Commands:" -ForegroundColor Cyan
Write-Host "  Run now:     Start-ScheduledTask -TaskName '$taskName' -TaskPath '$taskPath'"
Write-Host "  Check status: Get-ScheduledTask -TaskName '$taskName' -TaskPath '$taskPath' | Get-ScheduledTaskInfo"
Write-Host "  View logs:   Get-Content '$InstallDir\logs\sync_*.log' -Tail 50"
Write-Host ""
Write-Host "Django Commands:" -ForegroundColor Cyan
Write-Host "  Sync manually:  python manage.py sync_production --weeks 1"
Write-Host "  Sync full year: python manage.py sync_production --year 2025"
Write-Host "  Dry run:        python manage.py sync_production --dry-run"
Write-Host ""
