<#
.SYNOPSIS
    BSTT-Web IIS Deployment Script
    Deploys Django backend + React frontend to IIS on Windows Server.

.DESCRIPTION
    This script deploys BSTT-Web to a Windows Server using:
    - IIS for serving React static files
    - Waitress (Python WSGI server) for Django API
    - NSSM for running Waitress as a Windows Service

    NO Docker required. NO extra licensing costs.

.PARAMETER InstallDir
    Installation directory (default: C:\BSTT-Web)

.PARAMETER SqlServer
    SQL Server hostname

.PARAMETER SqlPassword
    Password for svc_bstt_web account

.PARAMETER Port
    HTTP port for the application (default: 80)

.PARAMETER ApiPort
    Port for Django API (default: 8000)

.PARAMETER SiteName
    IIS Site name (default: BSTT)

.EXAMPLE
    .\deploy_iis.ps1 -SqlServer "sql-server" -SqlPassword "password"
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string]$InstallDir = "C:\BSTT-Web",

    [Parameter(Mandatory=$true)]
    [string]$SqlServer,

    [Parameter(Mandatory=$true)]
    [string]$SqlPassword,

    [Parameter()]
    [int]$Port = 80,

    [Parameter()]
    [int]$ApiPort = 8000,

    [Parameter()]
    [string]$SiteName = "BSTT"
)

$ErrorActionPreference = "Stop"

# Script location
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Get-Item $ScriptDir).Parent.FullName

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "BSTT-Web IIS Deployment" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project Root: $ProjectRoot"
Write-Host "Install Dir: $InstallDir"
Write-Host "SQL Server: $SqlServer"
Write-Host "HTTP Port: $Port"
Write-Host "API Port: $ApiPort"
Write-Host ""

# Check if running as Administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: This script must be run as Administrator" -ForegroundColor Red
    exit 1
}

# Step 1: Check Prerequisites
Write-Host "Step 1: Checking Prerequisites..." -ForegroundColor Cyan

# Check Python
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Host "  ERROR: Python not found. Please install Python 3.11+" -ForegroundColor Red
    exit 1
}
$pythonVersion = python --version
Write-Host "  Python: $pythonVersion" -ForegroundColor Green

# Check Node.js
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "  ERROR: Node.js not found. Please install Node.js 18+" -ForegroundColor Red
    exit 1
}
$nodeVersion = node --version
Write-Host "  Node.js: $nodeVersion" -ForegroundColor Green

# Check IIS
$iis = Get-WindowsFeature -Name Web-Server -ErrorAction SilentlyContinue
if (-not $iis -or -not $iis.Installed) {
    Write-Host "  IIS not installed. Installing..." -ForegroundColor Yellow
    Install-WindowsFeature -Name Web-Server -IncludeManagementTools
}
Write-Host "  IIS: Installed" -ForegroundColor Green

# Check URL Rewrite Module
$urlRewrite = Get-WebGlobalModule -Name "RewriteModule" -ErrorAction SilentlyContinue
if (-not $urlRewrite) {
    Write-Host "  WARNING: URL Rewrite module not installed." -ForegroundColor Yellow
    Write-Host "  Download from: https://www.iis.net/downloads/microsoft/url-rewrite" -ForegroundColor Yellow
}

# Step 2: Create Installation Directory
Write-Host ""
Write-Host "Step 2: Creating Installation Directory..." -ForegroundColor Cyan

if (Test-Path $InstallDir) {
    Write-Host "  Cleaning existing installation..." -ForegroundColor Yellow
    # Stop service if running
    $service = Get-Service -Name "BSTT-API" -ErrorAction SilentlyContinue
    if ($service) {
        Stop-Service -Name "BSTT-API" -Force -ErrorAction SilentlyContinue
    }
}

New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
New-Item -ItemType Directory -Path "$InstallDir\backend" -Force | Out-Null
New-Item -ItemType Directory -Path "$InstallDir\frontend" -Force | Out-Null
New-Item -ItemType Directory -Path "$InstallDir\logs" -Force | Out-Null
Write-Host "  Created: $InstallDir" -ForegroundColor Green

# Step 3: Deploy Backend
Write-Host ""
Write-Host "Step 3: Deploying Backend..." -ForegroundColor Cyan

# Copy backend files
Write-Host "  Copying backend files..." -ForegroundColor Yellow
Copy-Item -Path "$ProjectRoot\backend\*" -Destination "$InstallDir\backend" -Recurse -Force

# Create virtual environment
Write-Host "  Creating virtual environment..." -ForegroundColor Yellow
$venvPath = "$InstallDir\backend\.venv"
python -m venv $venvPath

# Install requirements
Write-Host "  Installing Python packages..." -ForegroundColor Yellow
$pipPath = "$venvPath\Scripts\pip.exe"
& $pipPath install -r "$InstallDir\backend\requirements.txt" --quiet

# Create production .env file
Write-Host "  Creating .env file..." -ForegroundColor Yellow
$envContent = @"
# BSTT-Web Production Configuration
# Generated on $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

# SQL Server Connection
SQL_SERVER_HOST=$SqlServer
SQL_SERVER_DATABASE=BSTT
SQL_SERVER_USER=svc_bstt_web
SQL_SERVER_PASSWORD=$SqlPassword

# Django Settings
DEBUG=False
SECRET_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(50))")
ALLOWED_HOSTS=localhost,127.0.0.1,$env:COMPUTERNAME

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:$Port,http://127.0.0.1:$Port
"@
Set-Content -Path "$InstallDir\backend\.env" -Value $envContent

# Collect static files
Write-Host "  Collecting static files..." -ForegroundColor Yellow
$pythonPath = "$venvPath\Scripts\python.exe"
Push-Location "$InstallDir\backend"
& $pythonPath manage.py collectstatic --noinput 2>$null
Pop-Location

Write-Host "  Backend deployed" -ForegroundColor Green

# Step 4: Deploy Frontend
Write-Host ""
Write-Host "Step 4: Deploying Frontend..." -ForegroundColor Cyan

# Build React app
Write-Host "  Building React application..." -ForegroundColor Yellow
Push-Location "$ProjectRoot\frontend"

# Create .env for build
$frontendEnv = @"
REACT_APP_API_URL=http://localhost:$ApiPort/api
"@
Set-Content -Path ".env.production.local" -Value $frontendEnv

# Install and build
npm install --silent 2>$null
npm run build 2>$null

Pop-Location

# Copy build to install directory
Write-Host "  Copying build files..." -ForegroundColor Yellow
Copy-Item -Path "$ProjectRoot\frontend\build\*" -Destination "$InstallDir\frontend" -Recurse -Force

Write-Host "  Frontend deployed" -ForegroundColor Green

# Step 5: Create Windows Service for API
Write-Host ""
Write-Host "Step 5: Creating Windows Service for API..." -ForegroundColor Cyan

# Create run script for Waitress
$runScript = @"
@echo off
cd /d "$InstallDir\backend"
call .venv\Scripts\activate.bat
set SQL_SERVER_HOST=$SqlServer
set SQL_SERVER_DATABASE=BSTT
set SQL_SERVER_USER=svc_bstt_web
set SQL_SERVER_PASSWORD=$SqlPassword
set DEBUG=False
set ALLOWED_HOSTS=localhost,127.0.0.1,$env:COMPUTERNAME
waitress-serve --host=127.0.0.1 --port=$ApiPort config.wsgi:application
"@
Set-Content -Path "$InstallDir\run_api.bat" -Value $runScript

# Create PowerShell service script
$serviceScript = @"
`$env:SQL_SERVER_HOST = "$SqlServer"
`$env:SQL_SERVER_DATABASE = "BSTT"
`$env:SQL_SERVER_USER = "svc_bstt_web"
`$env:SQL_SERVER_PASSWORD = "$SqlPassword"
`$env:DEBUG = "False"
`$env:ALLOWED_HOSTS = "localhost,127.0.0.1,$env:COMPUTERNAME"

Set-Location "$InstallDir\backend"
& "$InstallDir\backend\.venv\Scripts\python.exe" -m waitress --host=127.0.0.1 --port=$ApiPort config.wsgi:application
"@
Set-Content -Path "$InstallDir\run_api.ps1" -Value $serviceScript

# Check if NSSM is available, otherwise use native Windows service
$nssm = Get-Command nssm -ErrorAction SilentlyContinue
if ($nssm) {
    Write-Host "  Using NSSM for service management..." -ForegroundColor Yellow

    # Remove existing service
    & nssm stop BSTT-API 2>$null
    & nssm remove BSTT-API confirm 2>$null

    # Install new service
    & nssm install BSTT-API powershell.exe
    & nssm set BSTT-API AppParameters "-ExecutionPolicy Bypass -File `"$InstallDir\run_api.ps1`""
    & nssm set BSTT-API AppDirectory "$InstallDir\backend"
    & nssm set BSTT-API DisplayName "BSTT Compliance Dashboard API"
    & nssm set BSTT-API Description "Django REST API for BSTT Compliance Dashboard"
    & nssm set BSTT-API Start SERVICE_AUTO_START
    & nssm set BSTT-API AppStdout "$InstallDir\logs\api_stdout.log"
    & nssm set BSTT-API AppStderr "$InstallDir\logs\api_stderr.log"

    # Start service
    & nssm start BSTT-API
} else {
    Write-Host "  NSSM not found. Creating scheduled task instead..." -ForegroundColor Yellow

    # Create scheduled task to run at startup
    $action = New-ScheduledTaskAction -Execute "powershell.exe" `
        -Argument "-ExecutionPolicy Bypass -File `"$InstallDir\run_api.ps1`"" `
        -WorkingDirectory "$InstallDir\backend"

    $trigger = New-ScheduledTaskTrigger -AtStartup
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

    Unregister-ScheduledTask -TaskName "BSTT-API" -Confirm:$false -ErrorAction SilentlyContinue
    Register-ScheduledTask -TaskName "BSTT-API" -Action $action -Trigger $trigger -Settings $settings -Principal $principal

    # Start the task now
    Start-ScheduledTask -TaskName "BSTT-API"

    Write-Host "  NOTE: For better service management, install NSSM:" -ForegroundColor Yellow
    Write-Host "        https://nssm.cc/download" -ForegroundColor Yellow
}

Write-Host "  API service created" -ForegroundColor Green

# Step 6: Configure IIS
Write-Host ""
Write-Host "Step 6: Configuring IIS..." -ForegroundColor Cyan

Import-Module WebAdministration

# Remove existing site if present
$existingSite = Get-Website -Name $SiteName -ErrorAction SilentlyContinue
if ($existingSite) {
    Write-Host "  Removing existing IIS site..." -ForegroundColor Yellow
    Remove-Website -Name $SiteName
}

# Create application pool
$appPool = "BSTT-AppPool"
$existingPool = Get-IISAppPool -Name $appPool -ErrorAction SilentlyContinue
if (-not $existingPool) {
    New-WebAppPool -Name $appPool
}
Set-ItemProperty "IIS:\AppPools\$appPool" -Name "managedRuntimeVersion" -Value ""

# Create website
Write-Host "  Creating IIS website..." -ForegroundColor Yellow
New-Website -Name $SiteName `
    -PhysicalPath "$InstallDir\frontend" `
    -Port $Port `
    -ApplicationPool $appPool

# Create web.config for URL rewriting (SPA support + API proxy)
$webConfig = @"
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <system.webServer>
        <rewrite>
            <rules>
                <!-- API Proxy Rule -->
                <rule name="API Proxy" stopProcessing="true">
                    <match url="^api/(.*)" />
                    <action type="Rewrite" url="http://127.0.0.1:$ApiPort/api/{R:1}" />
                </rule>
                <!-- React SPA Fallback -->
                <rule name="React Routes" stopProcessing="true">
                    <match url=".*" />
                    <conditions logicalGrouping="MatchAll">
                        <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
                        <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
                    </conditions>
                    <action type="Rewrite" url="/index.html" />
                </rule>
            </rules>
        </rewrite>
        <staticContent>
            <mimeMap fileExtension=".json" mimeType="application/json" />
        </staticContent>
        <httpErrors errorMode="Custom" existingResponse="PassThrough" />
    </system.webServer>
</configuration>
"@
Set-Content -Path "$InstallDir\frontend\web.config" -Value $webConfig

# Enable ARR proxy if URL Rewrite is available
try {
    Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' `
        -filter "system.webServer/proxy" -name "enabled" -value "True" -ErrorAction SilentlyContinue
} catch {
    Write-Host "  NOTE: ARR Proxy not configured. API calls may need direct port access." -ForegroundColor Yellow
}

Write-Host "  IIS site created: $SiteName" -ForegroundColor Green

# Step 7: Configure Firewall
Write-Host ""
Write-Host "Step 7: Configuring Firewall..." -ForegroundColor Cyan

# Remove existing rules
Remove-NetFirewallRule -DisplayName "BSTT HTTP" -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "BSTT API" -ErrorAction SilentlyContinue

# Add new rules
New-NetFirewallRule -Name "BSTT-HTTP" -DisplayName "BSTT HTTP" `
    -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow | Out-Null

New-NetFirewallRule -Name "BSTT-API" -DisplayName "BSTT API" `
    -Direction Inbound -Protocol TCP -LocalPort $ApiPort -Action Allow | Out-Null

Write-Host "  Firewall rules created" -ForegroundColor Green

# Step 8: Verify Deployment
Write-Host ""
Write-Host "Step 8: Verifying Deployment..." -ForegroundColor Cyan

Start-Sleep -Seconds 3

# Check API
try {
    $apiResponse = Invoke-WebRequest -Uri "http://127.0.0.1:$ApiPort/api/health/" -UseBasicParsing -TimeoutSec 10
    if ($apiResponse.StatusCode -eq 200) {
        Write-Host "  API: OK (http://127.0.0.1:$ApiPort)" -ForegroundColor Green
    }
} catch {
    Write-Host "  API: Starting... (may take a moment)" -ForegroundColor Yellow
}

# Check Frontend
try {
    $frontendResponse = Invoke-WebRequest -Uri "http://127.0.0.1:$Port" -UseBasicParsing -TimeoutSec 10
    if ($frontendResponse.StatusCode -eq 200) {
        Write-Host "  Frontend: OK (http://127.0.0.1:$Port)" -ForegroundColor Green
    }
} catch {
    Write-Host "  Frontend: Check IIS status" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "DEPLOYMENT COMPLETE" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Application URLs:" -ForegroundColor Cyan
Write-Host "  Frontend:  http://localhost:$Port"
Write-Host "  API:       http://localhost:$ApiPort/api/"
Write-Host "  API Docs:  http://localhost:$ApiPort/api/docs/"
Write-Host ""
Write-Host "Installation:" -ForegroundColor Cyan
Write-Host "  Directory: $InstallDir"
Write-Host "  IIS Site:  $SiteName"
Write-Host "  Service:   BSTT-API"
Write-Host ""
Write-Host "Commands:" -ForegroundColor Cyan
Write-Host "  Restart API:  Restart-ScheduledTask -TaskName 'BSTT-API'"
Write-Host "  View logs:    Get-Content '$InstallDir\logs\*.log' -Tail 50"
Write-Host "  IIS Manager:  inetmgr"
Write-Host ""
