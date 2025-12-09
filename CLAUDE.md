# BSTT Compliance Dashboard - Development Guidelines

## Project Overview

**Project**: BSTT (Biometric Security Time Tracking) Compliance Dashboard
**Purpose**: Track and analyze biometric time tracking compliance across multiple XLC offices
**Tech Stack**: Django REST Framework (backend) + React TypeScript (frontend)
**Deployment**: Docker Compose with Nginx reverse proxy

## Architecture

### Backend (Django)
- **Framework**: Django 4.2+ with Django REST Framework
- **Database**: SQLite (development) / PostgreSQL (production)
- **Apps**:
  - `core`: TimeEntry model, DataUpload, ETLHistory, admin customization
  - `kpis`: KPI calculations (35+ metrics), calculator class
  - `reports`: Excel report generation (multi-sheet BSTT-rpt.xlsx format)

### Frontend (React)
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with custom color scheme
- **Charts**: Recharts library
- **State**: React Context (FilterContext)

### Infrastructure
- Docker Compose orchestration
- Nginx reverse proxy (port 80 → frontend, /admin/ → backend)
- WhiteNoise for static file serving
- Gunicorn WSGI server

## Project Structure

```
BSTT-Web/
├── backend/
│   ├── config/             # Django settings, URLs
│   ├── core/               # Main app (models, admin, services)
│   │   ├── models.py       # TimeEntry, ETLHistory, DataUpload
│   │   ├── admin.py        # Custom BSTTAdminSite with database management
│   │   ├── services.py     # File upload processing
│   │   └── templates/      # Admin templates (upload progress)
│   ├── kpis/               # KPI calculations
│   │   ├── calculator.py   # KPICalculator class (35+ KPIs)
│   │   └── views.py        # KPI API endpoints
│   ├── reports/            # Excel report generation
│   │   └── generators.py   # BSTTReportGenerator class
│   ├── manage.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/client.ts           # Axios API client
│   │   ├── components/
│   │   │   ├── layout/             # AppLayout, Sidebar, FilterBar
│   │   │   └── KPICard.tsx         # KPI display component
│   │   ├── contexts/FilterContext.tsx
│   │   ├── pages/                  # Dashboard, OfficeAnalysis, etc.
│   │   ├── constants/colors.ts     # Color scheme
│   │   └── types/index.ts          # TypeScript interfaces
│   ├── nginx.conf          # Nginx reverse proxy config (development)
│   ├── package.json
│   └── Dockerfile
├── nginx/
│   ├── nginx.prod.conf     # Production Nginx config with SSL
│   ├── ssl/                # SSL certificates (not committed)
│   └── README.md           # SSL setup instructions
├── scripts/
│   └── backup.sh           # Database backup script
├── backups/                # Database backups (not committed)
├── docker-compose.yml      # Development Docker Compose
├── docker-compose.prod.yml # Production Docker Compose
├── .env.example            # Environment variable template
├── README.md
└── CLAUDE.md               # This file
```

## Key Files

### Backend
| File | Purpose |
|------|---------|
| `core/models.py` | TimeEntry (50+ fields with unique constraint), DataUpload, ETLHistory models |
| `core/admin.py` | Custom admin site with database management views |
| `core/services.py` | File upload processing with duplicate detection |
| `kpis/calculator.py` | KPICalculator with 35+ KPI methods |
| `reports/generators.py` | BSTTReportGenerator for Excel exports |
| `config/settings.py` | Django settings with KPI thresholds |

### Frontend
| File | Purpose |
|------|---------|
| `api/client.ts` | API endpoints for KPIs, data, reports (uses env vars) |
| `components/layout/Sidebar.tsx` | Navigation with admin links (uses getAdminUrl) |
| `components/SmartInsights.tsx` | KPI insights with drill-through navigation |
| `contexts/FilterContext.tsx` | Global filter state management |
| `pages/Dashboard.tsx` | Executive dashboard with KPIs and drill-through |
| `constants/colors.ts` | Theme colors and status colors |

## Running the Application

### Docker Development
```bash
cd BSTT-Web
docker-compose up --build

# Access:
# - Frontend: http://localhost/
# - Admin Panel: http://localhost/admin/
# - API: http://localhost/api/
```

### Docker Production
```bash
# 1. Generate secret key
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

# 2. Create .env.production (copy from .env.example, update values)
# - Set SECRET_KEY to generated value
# - Set DEBUG=False
# - Set ALLOWED_HOSTS to your domain
# - Set CORS_ALLOWED_ORIGINS to https://your-domain.com

# 3. Set up SSL certificates in nginx/ssl/ (see nginx/README.md)
# Option A: Let's Encrypt (recommended for public servers)
# Option B: Self-signed (for internal/testing)

# 4. Build and start
docker-compose -f docker-compose.prod.yml --env-file .env.production up --build -d

# 5. Create admin user
docker-compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser

# 6. Set up daily backups (add to crontab)
# 0 2 * * * /path/to/bstt-web/scripts/backup.sh
```

### Local Development
```bash
# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8000

# Frontend
cd frontend
npm install
npm start
```

## Admin Features

### Custom Admin Site (`BSTTAdminSite`)
- **Data Uploads**: Upload CSV/Excel with visual progress monitoring and duplicate detection
- **Database Management**: Clear data by year or reset entire database
- **User Management**: Django auth with User/Group administration

### Admin URLs
- `/admin/` - Main admin panel
- `/admin/core/dataupload/add/` - Upload new data file
- `/admin/database-management/` - Database management dashboard

## Duplicate Detection

Time entries are deduplicated based on a unique constraint:
- `applicant_id` + `xlc_operation` + `dt_end_cli_work_week` + `dt_time_start`

### How It Works
1. **In-file deduplication**: Removes duplicates within the uploaded file itself
2. **Database deduplication**: Uses `bulk_create(ignore_conflicts=True)` to skip records that already exist
3. **Tracking**: Records `records_in_file`, `records_processed`, and `records_skipped` for each upload

### Upload Statistics
The admin panel shows:
- **Records in File**: Total rows in the uploaded file
- **Records Processed**: Successfully inserted records
- **Records Skipped**: Duplicate records that were skipped

## KPI Categories

### Compliance Metrics
- Finger Rate (target: 95%)
- Provisional Entry Rate
- Write-In Rate
- Missing Clock-Out Rate
- Compliance Score

### Volume Metrics
- Total Entries
- Total Hours
- Unique Employees
- Unique Weeks (ISO week count - aligns Saturday/Sunday week endings)
- Entries per Employee

### Efficiency Metrics
- Average Clock-In Tries
- Average Clock-Out Tries
- First Attempt Success Rate

## ISO Week Alignment

The "Unique Weeks" KPI uses ISO week numbers (`week_year` + `week_number`) instead of distinct dates to properly align different week endings across offices:

- **Martinsburg**: Week ends on Saturday
- **Other offices**: Week ends on Sunday

By using ISO week numbers, Saturday (e.g., 2025-11-29) and Sunday (e.g., 2025-11-30) of the same calendar week are counted as **one week**, not two.

### Implementation
```python
# In kpis/calculator.py
unique_weeks=Count(
    Concat('week_year', Value('-'), 'week_number'),
    distinct=True
),
```

This affects: `volume_kpis()`, `by_office()`, `by_department()`, `by_shift()`

## API Endpoints

### KPIs
- `GET /api/kpis/` - Aggregate KPIs with filters
- `GET /api/kpis/by-office/` - Office breakdown
- `GET /api/kpis/by-week/` - Weekly trends
- `GET /api/kpis/by-department/` - Department breakdown
- `GET /api/kpis/by-shift/` - Shift analysis
- `GET /api/kpis/by-employee/` - Employee metrics
- `GET /api/kpis/clock-behavior/` - Clock attempt stats

### Data
- `GET /api/time-entries/` - Paginated entries
- `GET /api/filters/options/` - Filter dropdown options
- `GET /api/data-quality/` - Data freshness info

### Reports
- `GET /api/reports/full/` - Download Excel report

## Development Guidelines

### Code Style
- **Backend**: PEP 8, docstrings for functions
- **Frontend**: ESLint + Prettier, TypeScript strict mode
- **Commits**: Conventional commit messages

### Adding New Features
1. Create/update Django models if needed
2. Add API endpoint in appropriate app
3. Update TypeScript types in `types/index.ts`
4. Create/update React components
5. Add to Sidebar navigation if new page

### Database Changes
```bash
python manage.py makemigrations
python manage.py migrate
# If using Docker:
docker-compose exec backend python manage.py migrate
```

## Color Scheme

```typescript
COLORS = {
  accent: {
    primary: '#06b6d4',    // Cyan
    secondary: '#8b5cf6',  // Purple
  },
  status: {
    success: '#10b981',    // Emerald (meeting target)
    warning: '#f59e0b',    // Amber (close to target)
    danger: '#ef4444',     // Red (below target) - NOTE: use 'danger' not 'error'
    info: '#3b82f6',       // Blue (neutral info)
  }
}
```

## KPI Thresholds

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| Finger Rate | ≥95% | 90-95% | <90% |
| Provisional Rate | <1% | 1-3% | >3% |
| Write-In Rate | <3% | 3-5% | >5% |
| Missing C/O Rate | <2% | 2-5% | >5% |

## Troubleshooting

### Port Conflict
If localhost:8000 times out, check for conflicting processes:
```powershell
netstat -ano | findstr ":8000.*LISTENING"
# Kill conflicting process if needed
taskkill /PID <pid> /F
```

### Docker Issues
```bash
# Rebuild containers
docker-compose down
docker-compose up --build

# Check logs
docker-compose logs backend
docker-compose logs frontend
```

### Static Files Not Loading
```bash
docker-compose exec backend python manage.py collectstatic --noinput
```

## Production Deployment

### Key Files
| File | Purpose |
|------|---------|
| `docker-compose.prod.yml` | Production Docker Compose with SSL, health checks |
| `nginx/nginx.prod.conf` | Production Nginx with HTTPS, security headers |
| `nginx/README.md` | SSL certificate setup instructions |
| `scripts/backup.sh` | Database backup/restore script |
| `.env.example` | Environment variable template |

### Security Features (Production)
- HTTPS with TLS 1.2/1.3
- Security headers (HSTS, X-Frame-Options, X-Content-Type-Options)
- CSRF and session cookie security
- Gzip compression
- Static asset caching

### Backup Script
```bash
# Create backup
./scripts/backup.sh

# Restore from latest backup
./scripts/backup.sh --restore

# List available backups
./scripts/backup.sh --list
```

### Production Checklist
- [ ] Generate unique SECRET_KEY
- [ ] Set DEBUG=False
- [ ] Configure ALLOWED_HOSTS for your domain
- [ ] Set up SSL certificates
- [ ] Configure CORS_ALLOWED_ORIGINS
- [ ] Create admin superuser
- [ ] Set up daily backup cron job
- [ ] Test health endpoints

## License

Proprietary - XLC Services
