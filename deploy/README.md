# BSTT-Web Simple Deployment Guide

Deploy the BSTT Compliance Dashboard to Windows Server using IIS. **No Docker required. No extra costs.**

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Windows Server (Existing)                                  │
│                                                             │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │  IIS                │    │  Waitress (Python)          │ │
│  │  - React static     │───▶│  - Django REST API          │ │
│  │  - Port 80          │    │  - Port 8000                │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
│             │                           │                   │
│             └───────────┬───────────────┘                   │
│                         ▼                                   │
│                 SQL Server (Existing)                       │
│                   - BSTT Database                           │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Windows Server 2019+ | Any existing server with IIS |
| Python 3.11+ | [python.org](https://python.org) |
| Node.js 18+ | [nodejs.org](https://nodejs.org) |
| SQL Server | Your existing SQL Server |
| ODBC Driver 17 | [Microsoft Download](https://docs.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server) |

## Quick Start

### Step 1: Prepare SQL Server

Run this on your SQL Server to create the service account:

```sql
-- Create login for web application
CREATE LOGIN [svc_bstt_web] WITH PASSWORD = 'YourSecurePassword123!';

-- Create database
CREATE DATABASE [BSTT];
GO

USE [BSTT];
-- Create user
CREATE USER [svc_bstt_web] FOR LOGIN [svc_bstt_web];

-- Grant permissions (Django will create tables via migrations)
ALTER ROLE db_owner ADD MEMBER [svc_bstt_web];
```

### Step 2: Deploy to Windows Server

Copy the project to the server, then run:

```powershell
# Run as Administrator
cd BSTT-Web\deploy

.\deploy_iis.ps1 -SqlServer "your-sql-server" -SqlPassword "YourSecurePassword123!"
```

That's it! The script will:
1. Install Python packages
2. Build React frontend
3. Configure IIS
4. Create Windows service for API
5. Set up firewall rules

### Step 3: Run Database Migrations

After deployment, run migrations to create tables:

```powershell
cd C:\BSTT-Web\backend
.\.venv\Scripts\activate
python manage.py migrate
python manage.py createsuperuser  # Optional: create admin user
```

### Step 4: Import Data

Sync data from BSTT project:

```powershell
python manage.py sync_csv --year 2025
```

## Access the Application

| URL | Purpose |
|-----|---------|
| `http://server-name/` | Dashboard |
| `http://server-name:8000/api/` | REST API |
| `http://server-name/admin/` | Admin panel |

## Deployment Options

### Option A: One Server (Simplest)

Everything on one Windows Server. Use this for most cases.

```powershell
.\deploy_iis.ps1 -SqlServer "localhost" -SqlPassword "password"
```

### Option B: Separate SQL Server

Web server connects to existing SQL Server on network.

```powershell
.\deploy_iis.ps1 -SqlServer "sql-server.domain.com" -SqlPassword "password"
```

### Option C: Custom Ports

Use different ports if 80 is taken.

```powershell
.\deploy_iis.ps1 -SqlServer "sql-server" -SqlPassword "password" -Port 8080 -ApiPort 8001
```

## Configuration

### Environment Variables

The deployment creates `.env` file at `C:\BSTT-Web\backend\.env`:

```ini
SQL_SERVER_HOST=your-sql-server
SQL_SERVER_DATABASE=BSTT
SQL_SERVER_USER=svc_bstt_web
SQL_SERVER_PASSWORD=your-password
DEBUG=False
```

### Changing Settings

Edit the `.env` file and restart the API:

```powershell
# Using scheduled task
Stop-ScheduledTask -TaskName "BSTT-API"
Start-ScheduledTask -TaskName "BSTT-API"

# Or using NSSM (if installed)
nssm restart BSTT-API
```

## Troubleshooting

### API Not Responding

Check if the service is running:

```powershell
# Check scheduled task
Get-ScheduledTask -TaskName "BSTT-API" | Get-ScheduledTaskInfo

# View logs
Get-Content "C:\BSTT-Web\logs\api_stderr.log" -Tail 50
```

### Database Connection Issues

Test SQL Server connectivity:

```powershell
# Test from Python
cd C:\BSTT-Web\backend
.\.venv\Scripts\activate
python -c "from django.db import connection; connection.ensure_connection(); print('OK')"
```

### IIS Issues

```powershell
# Check IIS site
Get-Website -Name "BSTT"

# Restart IIS
iisreset
```

### Frontend 404 Errors

Make sure URL Rewrite module is installed:
- Download: https://www.iis.net/downloads/microsoft/url-rewrite

## Maintenance

### Update Application

```powershell
# Stop service
Stop-ScheduledTask -TaskName "BSTT-API"

# Re-run deployment
.\deploy_iis.ps1 -SqlServer "sql-server" -SqlPassword "password"
```

### Backup Database

```sql
BACKUP DATABASE [BSTT] TO DISK = 'C:\Backups\BSTT.bak' WITH COMPRESSION;
```

### View Logs

```powershell
# API logs
Get-Content "C:\BSTT-Web\logs\api_stdout.log" -Tail 100
Get-Content "C:\BSTT-Web\logs\api_stderr.log" -Tail 100

# IIS logs
Get-Content "C:\inetpub\logs\LogFiles\W3SVC*\*.log" -Tail 100
```

## Comparison with Docker Deployment

| Aspect | IIS Deployment | Docker Deployment |
|--------|----------------|-------------------|
| **Setup Complexity** | Lower (uses existing IIS) | Higher (needs Docker) |
| **Server Requirements** | Any Windows Server | Docker Desktop/Engine |
| **Maintenance** | Standard Windows admin | Container knowledge |
| **Resource Usage** | Lower | Higher (container overhead) |
| **Scalability** | Manual | Easier with orchestration |
| **Cost** | Zero (uses existing infra) | Potentially Docker licensing |

## Weekly Data Updates

### Option A: Automatic Sync from Production (Recommended)

Set up automatic weekly sync from FOXXSQLPROD:

```powershell
# Run after initial deployment
.\setup_weekly_sync.ps1 -ProductionUser "svc_bstt_sync" -ProductionPassword "password"
```

This creates a scheduled task that runs **every Sunday at 2 AM** to pull the latest payroll week.

### Option B: Manual Sync Commands

```powershell
cd C:\BSTT-Web\backend
.\.venv\Scripts\activate

# Sync last week
python manage.py sync_production --weeks 1

# Sync last 4 weeks
python manage.py sync_production --weeks 4

# Sync entire year
python manage.py sync_production --year 2025

# Preview (dry run)
python manage.py sync_production --dry-run
```

### Option C: CSV Import (Legacy)

If you prefer to export from Power Query first:

```powershell
# Copy CSV to data folder, then:
python manage.py sync_csv --year 2025
```

### Sync Architecture

```
┌─────────────────────┐
│   FOXXSQLPROD       │
│   (Production)      │
└─────────┬───────────┘
          │ Sunday 2 AM
          │ (Scheduled Task)
          ▼
┌─────────────────────┐
│  sync_production    │
│  Django Command     │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   BSTT Dashboard    │
│   SQL Server        │
└─────────────────────┘
```

### Service Account for Production

Create a read-only account on FOXXSQLPROD:

```sql
-- On FOXXSQLPROD
CREATE LOGIN [svc_bstt_sync] WITH PASSWORD = 'SecurePassword';
USE XLCServices1;
CREATE USER [svc_bstt_sync] FOR LOGIN [svc_bstt_sync];
GRANT EXECUTE ON dbo.spSTT_ApprovedTimeAllFTWGroupsWithClockingHistNMethods TO [svc_bstt_sync];
```

## Support

For issues:
1. Check logs at `C:\BSTT-Web\logs\`
2. Verify SQL Server connectivity
3. Ensure IIS is running: `Get-Service W3SVC`
