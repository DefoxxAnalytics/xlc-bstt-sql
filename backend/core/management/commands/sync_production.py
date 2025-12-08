"""
Sync data directly from FOXXSQLPROD production database.

This command connects to the production SQL Server and pulls the latest
time entry data, replicating the Power Query logic.

Usage:
    python manage.py sync_production                    # Sync latest week
    python manage.py sync_production --year 2025       # Sync full year
    python manage.py sync_production --weeks 4         # Sync last 4 weeks
    python manage.py sync_production --dry-run         # Preview only

Environment Variables (set in .env.production):
    PROD_SQL_SERVER     - Production server (FOXXSQLPROD)
    PROD_SQL_DATABASE   - Production database (XLCServices1)
    PROD_SQL_USER       - Service account username
    PROD_SQL_PASSWORD   - Service account password
"""

import os
import logging
from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.db import transaction
import pyodbc
import pandas as pd

from core.models import TimeEntry

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Sync time entry data from FOXXSQLPROD production database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--year',
            type=int,
            help='Sync all data for a specific year'
        )
        parser.add_argument(
            '--weeks',
            type=int,
            default=1,
            help='Number of weeks to sync (default: 1)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview what would be synced without saving'
        )
        parser.add_argument(
            '--replace',
            action='store_true',
            help='Replace existing data for the period'
        )

    def get_production_connection(self):
        """Get connection to FOXXSQLPROD."""
        server = os.environ.get('PROD_SQL_SERVER', 'FOXXSQLPROD')
        database = os.environ.get('PROD_SQL_DATABASE', 'XLCServices1')
        user = os.environ.get('PROD_SQL_USER', '')
        password = os.environ.get('PROD_SQL_PASSWORD', '')

        if not user or not password:
            raise ValueError(
                "Production credentials not configured. "
                "Set PROD_SQL_SERVER, PROD_SQL_USER, PROD_SQL_PASSWORD in environment."
            )

        conn_str = (
            f"DRIVER={{ODBC Driver 17 for SQL Server}};"
            f"SERVER={server};"
            f"DATABASE={database};"
            f"UID={user};"
            f"PWD={password};"
            f"TrustServerCertificate=yes;"
        )

        self.stdout.write(f"Connecting to {server}/{database}...")
        return pyodbc.connect(conn_str)

    def calculate_date_range(self, year=None, weeks=1):
        """Calculate the date range to sync."""
        today = datetime.now().date()

        if year:
            # Full year
            start_date = datetime(year, 1, 1).date()
            end_date = datetime(year, 12, 31).date()
        else:
            # Calculate last N payroll weeks (ending on Sunday)
            # Find last Sunday
            days_since_sunday = (today.weekday() + 1) % 7
            last_sunday = today - timedelta(days=days_since_sunday)

            # Go back N weeks
            start_date = last_sunday - timedelta(weeks=weeks - 1, days=6)
            end_date = last_sunday

        return start_date, end_date

    def get_entry_type(self, clock_in_method, clock_out_method):
        """
        Replicate FnEntryType logic from Power Query.
        """
        ci = clock_in_method or "NULL"
        co = clock_out_method or "NULL"

        # Normalize
        ci = ci.upper() if ci != "NULL" else ci
        co = co.upper() if co != "NULL" else co

        if ci == "FINGER" and co == "FINGER":
            return "Finger"
        if ci == "FINGER" and co == "REASSIGN":
            return "Finger"
        if ci == "REASSIGN" and co == "FINGER":
            return "Finger"
        if ci == "NULL" and co == "NULL":
            return "Write-In"
        if ci == "EMPID" or co == "EMPID":
            return "Provisional Entry"
        if ci == "NO SUCCESSFUL FINGERPRINT" or co == "NO SUCCESSFUL FINGERPRINT":
            return "NO SUCCESSFUL FINGERPRINT"
        if ci == "NULL":
            return "Missing c/in"
        if ci == "NULL" or co in ("MISSING C/O MNGR SUPPLIED", "NULL"):
            return "Missing c/o"
        if ci == "SWAP" or co == "SWAP":
            return "Time-Swap"
        if ci == "RAW CLOCK PAIR SPLIT" or co == "RAW CLOCK PAIR SPLIT":
            return "Raw Clock Pair Split"
        if ci == "WKEND RAW PAIR SPLT" or co == "WKEND RAW PAIR SPLT":
            return "Programming or Wk End Rw Pair Split"
        if ci == "REASSIGN" or co == "REASSIGN":
            return "Manager FTW Reassignment"

        return "Programming Issue"

    def get_xlc_operation(self, ofc_name):
        """Replicate office consolidation from Power Query."""
        if ofc_name in ("Blue Ash", "Cincinnati", "St. Bernard"):
            return "P&G Cincinnati"
        return ofc_name

    def fetch_production_data(self, conn, start_date, end_date):
        """
        Execute the production stored procedure to get time entries.
        Uses the same procedure that Power Query calls.
        """
        self.stdout.write(f"Fetching data from {start_date} to {end_date}...")

        # Call the same stored procedure Power Query uses
        sql = """
        EXEC spSTT_ApprovedTimeAllFTWGroupsWithClockingHistNMethods
            @dtReportStart = ?,
            @dtReportEnd = ?
        """

        cursor = conn.cursor()
        cursor.execute(sql, (start_date, end_date))

        # Get column names
        columns = [column[0] for column in cursor.description]

        # Fetch all rows
        rows = cursor.fetchall()
        self.stdout.write(f"Fetched {len(rows)} records from production")

        # Convert to DataFrame
        df = pd.DataFrame.from_records(rows, columns=columns)

        return df

    def transform_data(self, df):
        """Apply Power Query transformations."""
        self.stdout.write("Transforming data...")

        # Handle null values for clock methods
        df['ClockIn_Method'] = df['ClockIn_Method'].fillna('NULL')
        df['ClockOut_Method'] = df['ClockOut_Method'].fillna('NULL')

        # Calculate EntryType
        df['entry_type'] = df.apply(
            lambda row: self.get_entry_type(row['ClockIn_Method'], row['ClockOut_Method']),
            axis=1
        )

        # Calculate XLC Operation
        df['xlc_operation'] = df['OfcName'].apply(self.get_xlc_operation)

        # Calculate FullName
        df['full_name'] = df['LastName'].fillna('') + ', ' + df['FirstName'].fillna('')

        # Calculate Total Hours
        df['total_hours'] = (
            df['RegHours'].fillna(0) +
            df['OTHours'].fillna(0) +
            df['DTHours'].fillna(0) +
            df['HolWrkHours'].fillna(0)
        )

        # Parse dates
        df['dt_end_cli_work_week'] = pd.to_datetime(df['dtEndCliWorkWeek'])
        df['work_date'] = pd.to_datetime(df['WorkDate'])

        # Add ISO week fields
        df['week_number'] = df['dt_end_cli_work_week'].apply(
            lambda d: d.isocalendar()[1] if pd.notna(d) else None
        )
        df['week_year'] = df['dt_end_cli_work_week'].apply(
            lambda d: d.isocalendar()[0] if pd.notna(d) else None
        )
        df['year'] = df['dt_end_cli_work_week'].dt.year

        # Filter to compliance-relevant entry types only
        valid_types = ['Finger', 'Missing c/o', 'Provisional Entry', 'Write-In']
        df = df[df['entry_type'].isin(valid_types)]

        # Filter out NOT_REQ_TO_CLOCK
        if 'Allocation_Method' in df.columns:
            df = df[df['Allocation_Method'] != 'NOT_REQ_TO_CLOCK']

        # Remove duplicates
        df = df.drop_duplicates()

        self.stdout.write(f"After transformations: {len(df)} records")

        return df

    def save_to_database(self, df, replace=False, dry_run=False):
        """Save transformed data to Django database."""
        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN - No data saved"))
            self.stdout.write(f"Would save {len(df)} records")
            # Show sample
            self.stdout.write("\nSample records:")
            for _, row in df.head(5).iterrows():
                self.stdout.write(
                    f"  {row['xlc_operation']} | {row['dt_end_cli_work_week'].date()} | "
                    f"{row['full_name']} | {row['entry_type']}"
                )
            return 0

        # Get date range for replacement
        min_date = df['dt_end_cli_work_week'].min()
        max_date = df['dt_end_cli_work_week'].max()

        with transaction.atomic():
            if replace:
                # Delete existing records in this date range
                deleted, _ = TimeEntry.objects.filter(
                    dt_end_cli_work_week__gte=min_date,
                    dt_end_cli_work_week__lte=max_date
                ).delete()
                self.stdout.write(f"Deleted {deleted} existing records")

            # Prepare records for bulk insert
            records = []
            for _, row in df.iterrows():
                records.append(TimeEntry(
                    year=row.get('year'),
                    week_number=row.get('week_number'),
                    week_year=row.get('week_year'),
                    dt_end_cli_work_week=row.get('dt_end_cli_work_week'),
                    applicant_id=str(row.get('ApplicantID', '')),
                    last_name=row.get('LastName'),
                    first_name=row.get('FirstName'),
                    full_name=row.get('full_name'),
                    employee_type=row.get('EmployeeTypeID'),
                    xlc_operation=row.get('xlc_operation'),
                    bu_dept_name=row.get('BUDeptName'),
                    shift_number=str(row.get('ShiftNumber', '')),
                    work_date=row.get('work_date'),
                    dt_time_start=row.get('dtTimeStart'),
                    dt_time_end=row.get('dtTimeEnd'),
                    entry_type=row.get('entry_type'),
                    regular_hours=row.get('RegHours', 0) or 0,
                    overtime_hours=row.get('OTHours', 0) or 0,
                    double_time_hours=row.get('DTHours', 0) or 0,
                    holiday_hours=row.get('HolWrkHours', 0) or 0,
                    total_hours=row.get('total_hours', 0) or 0,
                    clock_in_tries=row.get('ClockIn_Tries', 1) or 1,
                    clock_out_tries=row.get('ClockOut_Tries', 1) or 1,
                ))

            # Bulk insert
            TimeEntry.objects.bulk_create(records, batch_size=1000)
            self.stdout.write(self.style.SUCCESS(f"Saved {len(records)} records"))

            return len(records)

    def handle(self, *args, **options):
        year = options.get('year')
        weeks = options.get('weeks')
        dry_run = options.get('dry_run')
        replace = options.get('replace')

        self.stdout.write("=" * 60)
        self.stdout.write("BSTT Production Data Sync")
        self.stdout.write("=" * 60)

        try:
            # Calculate date range
            start_date, end_date = self.calculate_date_range(year, weeks)
            self.stdout.write(f"Date range: {start_date} to {end_date}")

            # Connect to production
            conn = self.get_production_connection()

            # Fetch data
            df = self.fetch_production_data(conn, start_date, end_date)

            if df.empty:
                self.stdout.write(self.style.WARNING("No data found for the specified period"))
                return

            # Transform
            df = self.transform_data(df)

            # Save
            count = self.save_to_database(df, replace=replace, dry_run=dry_run)

            self.stdout.write("=" * 60)
            self.stdout.write(self.style.SUCCESS(f"Sync complete! {count} records processed"))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Sync failed: {e}"))
            raise
        finally:
            if 'conn' in locals():
                conn.close()
