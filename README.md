# BSTT Compliance Dashboard

A modern web application for tracking and analyzing biometric time tracking compliance across multiple XLC offices. Built with Django REST Framework and React TypeScript, deployed via Docker.

## Features

### Dashboard & Analytics
- **Executive Dashboard**: Real-time KPIs including finger scan rates, provisional entries, write-ins, and missing clock-outs
- **Office Analysis**: Compare compliance metrics across offices with ranking, department, and shift breakdowns
- **Entry Type Analysis**: Visualize distribution of entry types with weekly trends
- **Employee Analysis**: Track individual employee compliance and identify enrollment needs
- **Weekly Trends**: Historical compliance data with week-over-week comparisons (ISO week aligned)
- **Clock Behavior**: Analyze clock-in/out attempts and identify training needs
- **Data Explorer**: Browse and export raw time entry data
- **ISO Week Alignment**: Properly counts unique weeks across offices with different week endings (Martinsburg Saturday, others Sunday)

### Admin Features
- **Data Upload**: Upload CSV/Excel files with visual progress monitoring (3-stage workflow with progress bar)
- **Database Management**: Clear data by year or reset entire database with confirmation dialogs
- **User Management**: Django auth with User/Group administration
- **Excel Report Generation**: Export comprehensive reports matching BSTT-rpt.xlsx format (12+ sheets)

## Tech Stack

### Backend
- Python 3.11+
- Django 4.2+
- Django REST Framework
- SQLite (development) / PostgreSQL (production)
- Pandas for data processing
- OpenPyXL for Excel generation
- WhiteNoise for static files

### Frontend
- React 18 with TypeScript
- Recharts for data visualization
- Tailwind CSS for styling
- Axios for API communication
- Lucide React for icons

### Infrastructure
- Docker & Docker Compose
- Nginx reverse proxy
- Gunicorn WSGI server

## Quick Start

### Using Docker (Recommended)

1. Clone the repository:
```bash
git clone https://github.com/your-org/bstt-web.git
cd bstt-web
```

2. Build and run:
```bash
docker-compose up --build
```

3. Create admin user:
```bash
docker-compose exec backend python manage.py createsuperuser
```

4. Access the application:
- **Frontend Dashboard**: http://localhost/
- **Admin Panel**: http://localhost/admin/
- **Upload Data**: http://localhost/admin/core/dataupload/add/
- **Database Management**: http://localhost/admin/database-management/
- **API**: http://localhost/api/

### Local Development

#### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Create admin user
python manage.py createsuperuser

# Load initial data (if available)
python manage.py sync_csv --year 2025

# Start development server
python manage.py runserver 8000
```

#### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

## Project Structure

```
BSTT-Web/
├── backend/                 # Django backend
│   ├── config/             # Django project settings
│   ├── core/               # Core app (models, admin, services)
│   │   ├── models.py       # TimeEntry, DataUpload, ETLHistory
│   │   ├── admin.py        # Custom BSTTAdminSite
│   │   ├── services.py     # File upload processing
│   │   └── templates/      # Admin templates (upload progress UI)
│   ├── kpis/               # KPI calculations and API
│   │   └── calculator.py   # 35+ KPI calculations
│   ├── reports/            # Excel report generation
│   │   └── generators.py   # Multi-sheet report generator
│   ├── manage.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/               # React frontend
│   ├── src/
│   │   ├── api/           # Axios API client
│   │   ├── components/    # Reusable components
│   │   │   └── layout/    # AppLayout, Sidebar, FilterBar
│   │   ├── contexts/      # FilterContext
│   │   ├── pages/         # Dashboard, OfficeAnalysis, etc.
│   │   ├── constants/     # Colors, thresholds
│   │   └── types/         # TypeScript interfaces
│   ├── package.json
│   ├── Dockerfile
│   └── nginx.conf         # Nginx reverse proxy config
├── docker-compose.yml
├── CLAUDE.md              # Development guidelines
└── README.md
```

## API Endpoints

### KPIs
| Endpoint | Description |
|----------|-------------|
| `GET /api/kpis/` | Aggregate KPIs with filters |
| `GET /api/kpis/by-office/` | KPIs grouped by office |
| `GET /api/kpis/by-week/` | Weekly KPI trends |
| `GET /api/kpis/by-department/` | KPIs by department |
| `GET /api/kpis/by-shift/` | KPIs by shift |
| `GET /api/kpis/by-employee/` | Employee-level metrics |
| `GET /api/kpis/clock-behavior/` | Clock attempt analysis |

### Data
| Endpoint | Description |
|----------|-------------|
| `GET /api/time-entries/` | Paginated time entries |
| `GET /api/filters/options/` | Available filter options |
| `GET /api/data-quality/` | Data freshness indicators |
| `GET /api/health/` | Health check endpoint |

### Reports
| Endpoint | Description |
|----------|-------------|
| `GET /api/reports/full/` | Download full Excel report |

## Admin Panel Features

### Data Upload (`/admin/core/dataupload/add/`)
Visual upload interface with:
- Real-time upload progress bar (0-100%)
- File name and size display
- 3-stage workflow indicator (Upload → Process → Complete)
- Processing animation during database import
- Success/error messages

### Database Management (`/admin/database-management/`)
- View record counts by model and year
- Clear time entries for a specific year
- Reset entire database (with confirmation)
- Delete confirmation dialogs with typed confirmation

### User Management
- Create/edit users and groups
- Manage staff and superuser permissions
- Session management

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEBUG` | Django debug mode | `False` |
| `SECRET_KEY` | Django secret key | Required |
| `ALLOWED_HOSTS` | Comma-separated hosts | `localhost` |
| `CORS_ALLOWED_ORIGINS` | CORS origins | `http://localhost:3000` |

### KPI Thresholds

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| Finger Rate | ≥95% | 90-95% | <90% |
| Provisional Rate | <1% | 1-3% | >3% |
| Write-In Rate | <3% | 3-5% | >5% |
| Missing C/O Rate | <2% | 2-5% | >5% |

## Data Import

### Via Django Admin
1. Navigate to Admin Panel → Data uploads → Add
2. Select CSV or Excel file
3. Choose year and file type
4. Click Save to upload and process

### Via Command Line
```bash
# From CSV files in output directory
python manage.py sync_csv --year 2025

# In Docker
docker-compose exec backend python manage.py sync_csv --year 2025
```

## Development

### Running Tests

```bash
# Backend
cd backend
python manage.py test

# Frontend
cd frontend
npm test
```

### Code Style

- **Backend**: PEP 8, docstrings for functions
- **Frontend**: ESLint + Prettier, TypeScript strict mode

### Docker Commands

```bash
# Start containers
docker-compose up -d

# View logs
docker-compose logs -f

# Rebuild specific service
docker-compose up -d --build backend

# Execute commands in container
docker-compose exec backend python manage.py migrate

# Stop containers
docker-compose down
```

## Deployment

### Production Checklist

1. Set `DEBUG=False`
2. Generate a strong `SECRET_KEY`
3. Configure `ALLOWED_HOSTS`
4. Set up HTTPS/SSL (configure nginx)
5. Configure database (PostgreSQL recommended)
6. Set up monitoring and logging
7. Configure backup strategy
8. Run `collectstatic`

### Docker Production Build

```bash
docker-compose up --build -d
```

## Troubleshooting

### Port Conflict
If localhost:8000 times out:
```powershell
netstat -ano | findstr ":8000.*LISTENING"
taskkill /PID <pid> /F
```

### Docker Issues
```bash
# Rebuild everything
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

## License

Proprietary - XLC Services

## Support

For issues and feature requests, contact the development team.
