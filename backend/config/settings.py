"""
Django settings for BSTT Compliance Dashboard.

This is a self-contained Django + React application.
Data is loaded from the original BSTT project's output directory.
"""
import os
from pathlib import Path
import dj_database_url

# Build paths
BASE_DIR = Path(__file__).resolve().parent.parent

# Original BSTT project (for data access) - only used in development
BSTT_PROJECT_DIR = Path(os.environ.get('BSTT_PROJECT_DIR', 'c:/Users/MLawali/Documents/Projects/XLC-Projects/BSTT'))

# Security
SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-change-this-in-production')
DEBUG = os.environ.get('DEBUG', 'True').lower() in ('true', '1', 'yes')
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party
    'rest_framework',
    'django_filters',
    'corsheaders',
    # Local apps
    'core',
    'kpis',
    'reports',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'core' / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Database Configuration
# Priority: SQL_SERVER_HOST > DATABASE_URL (PaaS) > DATABASE_PATH (Docker) > Default SQLite
SQL_SERVER_HOST = os.environ.get('SQL_SERVER_HOST')
DATABASE_URL = os.environ.get('DATABASE_URL')

if SQL_SERVER_HOST:
    # SQL Server for production (connects to existing SQL Server)
    DATABASES = {
        'default': {
            'ENGINE': 'mssql',
            'NAME': os.environ.get('SQL_SERVER_DATABASE', 'BSTT'),
            'HOST': SQL_SERVER_HOST,
            'USER': os.environ.get('SQL_SERVER_USER', 'svc_bstt_web'),
            'PASSWORD': os.environ.get('SQL_SERVER_PASSWORD', ''),
            'PORT': os.environ.get('SQL_SERVER_PORT', '1433'),
            'OPTIONS': {
                'driver': 'ODBC Driver 17 for SQL Server',
                'TrustServerCertificate': 'yes',
            },
        }
    }
elif DATABASE_URL:
    # PostgreSQL for PaaS platforms (Railway, Render, Fly.io)
    DATABASES = {
        'default': dj_database_url.config(
            default=DATABASE_URL,
            conn_max_age=600,
            conn_health_checks=True,
        )
    }
else:
    # SQLite for development and Docker deployments
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': Path(os.environ.get('DATABASE_PATH', BASE_DIR / 'data' / 'db.sqlite3')),
        }
    }

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'America/New_York'
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Media files (user uploads)
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Default primary key
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# =============================================================================
# Django REST Framework
# =============================================================================
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 100,
}

# =============================================================================
# CORS Configuration (for React frontend on port 3000)
# =============================================================================
CORS_ALLOWED_ORIGINS = os.environ.get(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:3000,http://127.0.0.1:3000,http://localhost,http://localhost:80'
).split(',')
CORS_ALLOW_CREDENTIALS = True

# =============================================================================
# BSTT Application Settings
# =============================================================================
# Data directories (from original BSTT project)
DATA_DIR = BSTT_PROJECT_DIR / 'output'
WEEKLY_DUMP_DIR = BSTT_PROJECT_DIR / 'WeeklyDump'

# KPI Targets
KPI_TARGETS = {
    'finger_rate': 95.0,
    'provisional_rate': 1.0,
    'write_in_rate': 3.0,
    'missing_co_rate': 2.0,
    'manual_rate': 5.0,
}

# Entry type colors
ENTRY_TYPE_COLORS = {
    'Finger': '#28a745',
    'Provisional Entry': '#ffc107',
    'Write-In': '#17a2b8',
    'Missing c/o': '#dc3545',
}

# =============================================================================
# Logging Configuration
# =============================================================================
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'django.request': {
            'handlers': ['console'],
            'level': 'ERROR',
            'propagate': False,
        },
    },
}

# =============================================================================
# Production Security Settings
# =============================================================================
# These settings are applied when DEBUG=False (production mode)

if not DEBUG:
    # HTTPS/SSL Settings
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'SAMEORIGIN'

    # Cookie Security (require HTTPS)
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_SECURE = True

    # Trust X-Forwarded-Proto header from nginx
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

    # HSTS (HTTP Strict Transport Security)
    # Uncomment after confirming HTTPS works correctly
    # SECURE_HSTS_SECONDS = 31536000  # 1 year
    # SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    # SECURE_HSTS_PRELOAD = True

    # Redirect HTTP to HTTPS (handled by nginx, but keep as fallback)
    # SECURE_SSL_REDIRECT = True
