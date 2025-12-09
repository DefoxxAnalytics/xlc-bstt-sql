"""
Data processing services for BSTT Dashboard.
"""
import time
from datetime import date, timedelta
from io import BytesIO
from pathlib import Path
import pandas as pd
from django.db import transaction
from .models import TimeEntry, ETLHistory, DataUpload


def extract_week_number(date_value):
    """
    Extract ISO week number and year from a date.

    ISO week numbers ensure Saturday and Sunday of same week
    get the same week number, aligning Martinsburg (Saturday week endings)
    with other offices (Sunday week endings).

    Args:
        date_value: A date object or None

    Returns:
        Tuple of (week_number, week_year) or (None, None) if date_value is None
    """
    if date_value is None:
        return None, None
    iso_cal = date_value.isocalendar()
    return iso_cal[1], iso_cal[0]  # (week, year)


def get_week_display_date(week_year: int, week_number: int):
    """
    Get Sunday date for a given ISO week (for display purposes).

    Args:
        week_year: ISO year
        week_number: ISO week number (1-53)

    Returns:
        date object representing Sunday of that week
    """
    # ISO week starts Monday (day 1), Sunday is day 7
    # January 4th is always in week 1
    jan4 = date(week_year, 1, 4)
    iso_year_start = jan4 - timedelta(days=jan4.isoweekday() - 1)  # Monday of week 1
    return iso_year_start + timedelta(weeks=week_number - 1, days=6)  # Sunday of that week


# Column mapping from CSV to model fields (handle multiple naming conventions)
COLUMN_MAPPING = {
    # Year
    'year': 'year',
    # Office/Location
    'OfcName': 'ofc_name',
    'Ofc_Name': 'ofc_name',
    'XLC Operation': 'xlc_operation',
    'XLC_Operation': 'xlc_operation',
    # Time Period
    'dtEndCliWorkWeek': 'dt_end_cli_work_week',
    'Dt_End_CLI_Work_Week': 'dt_end_cli_work_week',
    'WorkDate': 'work_date',
    'Work_Date': 'work_date',
    'Date Range': 'date_range',
    'Date_Range': 'date_range',
    # Employee Info
    'ApplicantID': 'applicant_id',
    'Applicant_ID': 'applicant_id',
    'LastName': 'last_name',
    'Last_Name': 'last_name',
    'FirstName': 'first_name',
    'First_Name': 'first_name',
    'FullName': 'full_name',
    'Full_Name': 'full_name',
    'EmployeeTypeID': 'employee_type_id',
    'Employee_Type_ID': 'employee_type_id',
    # Shift/Department
    'ShiftNumber': 'shift_number',
    'Shift_Number': 'shift_number',
    'BUDeptName': 'bu_dept_name',
    'BU_Dept_Name': 'bu_dept_name',
    'Allocation_Method': 'allocation_method',
    # Clock Times
    'dtTimeStart': 'dt_time_start',
    'Dt_Time_Start': 'dt_time_start',
    'dtTimeEnd': 'dt_time_end',
    'Dt_Time_End': 'dt_time_end',
    # Hours
    'RegHours': 'reg_hours',
    'Reg_Hours': 'reg_hours',
    'OTHours': 'ot_hours',
    'OT_Hours': 'ot_hours',
    'DTHours': 'dt_hours',
    'DT_Hours': 'dt_hours',
    'HolWrkHours': 'hol_wrk_hours',
    'Hol_Wrk_Hours': 'hol_wrk_hours',
    'Total Hours': 'total_hours',
    'Total_Hours': 'total_hours',
    # Clock Behavior
    'ClockIn_LOcal': 'clock_in_local',
    'Clock_In_Local': 'clock_in_local',
    'ClockIn_Tries': 'clock_in_tries',
    'Clock_In_Tries': 'clock_in_tries',
    'ClockIn_Method': 'clock_in_method',
    'Clock_In_Method': 'clock_in_method',
    'ClockOut_Local': 'clock_out_local',
    'Clock_Out_Local': 'clock_out_local',
    'ClockOut_Tries': 'clock_out_tries',
    'Clock_Out_Tries': 'clock_out_tries',
    'ClockOut_Method': 'clock_out_method',
    'Clock_Out_Method': 'clock_out_method',
    # Entry Classification
    'EntryType': 'entry_type',
    'Entry_Type': 'entry_type',
}


def process_uploaded_file(upload: DataUpload) -> tuple[bool, str, int, int]:
    """
    Process an uploaded data file and import records into the database.

    Handles duplicate detection based on unique constraint:
    (applicant_id, xlc_operation, dt_end_cli_work_week, dt_time_start)

    Args:
        upload: DataUpload instance to process

    Returns:
        Tuple of (success, message, records_processed, records_skipped)
    """
    start_time = time.time()
    records_skipped = 0

    try:
        # Read file based on type
        file_path = upload.file.path

        if upload.file_type == 'csv':
            df = pd.read_csv(file_path)
        else:  # excel
            df = pd.read_excel(file_path)

        if df.empty:
            return False, "Uploaded file is empty", 0, 0

        year = upload.year
        total_in_file = len(df)

        # Create ETL history record
        etl = ETLHistory.objects.create(
            year=year,
            status='running',
            message=f"Processing uploaded file: {upload.filename} ({total_in_file} records)"
        )

        # Process the data
        with transaction.atomic():
            # Clear existing data if requested
            if upload.replace_existing:
                deleted, _ = TimeEntry.objects.filter(year=year).delete()

            # Rename columns
            df_renamed = df.rename(columns=COLUMN_MAPPING)

            # Keep only columns that exist in model
            model_fields = [f.name for f in TimeEntry._meta.get_fields() if hasattr(f, 'column')]
            valid_cols = [c for c in df_renamed.columns if c in model_fields]
            df_clean = df_renamed[valid_cols].copy()

            # Parse dates
            date_cols = ['dt_end_cli_work_week', 'work_date']
            for col in date_cols:
                if col in df_clean.columns:
                    df_clean[col] = pd.to_datetime(df_clean[col], errors='coerce').dt.date

            datetime_cols = ['dt_time_start', 'dt_time_end']
            for col in datetime_cols:
                if col in df_clean.columns:
                    df_clean[col] = pd.to_datetime(df_clean[col], errors='coerce')

            # Handle numeric columns
            numeric_cols = ['reg_hours', 'ot_hours', 'dt_hours', 'hol_wrk_hours', 'total_hours',
                          'clock_in_tries', 'clock_out_tries']
            for col in numeric_cols:
                if col in df_clean.columns:
                    df_clean[col] = pd.to_numeric(df_clean[col], errors='coerce').fillna(0)

            # Fill NaN for string columns
            str_cols = ['ofc_name', 'xlc_operation', 'date_range', 'applicant_id',
                       'last_name', 'first_name', 'full_name', 'employee_type_id',
                       'shift_number', 'bu_dept_name', 'allocation_method',
                       'clock_in_local', 'clock_in_method', 'clock_out_local',
                       'clock_out_method', 'entry_type']
            for col in str_cols:
                if col in df_clean.columns:
                    df_clean[col] = df_clean[col].fillna('')

            # Ensure year column exists
            if 'year' not in df_clean.columns:
                df_clean['year'] = year

            # Extract ISO week numbers from dt_end_cli_work_week
            if 'dt_end_cli_work_week' in df_clean.columns:
                df_clean['week_number'] = df_clean['dt_end_cli_work_week'].apply(
                    lambda d: d.isocalendar()[1] if d else None
                )
                df_clean['week_year'] = df_clean['dt_end_cli_work_week'].apply(
                    lambda d: d.isocalendar()[0] if d else None
                )

            # Remove duplicates within the file itself first
            # Based on unique key: applicant_id + xlc_operation + dt_end_cli_work_week + dt_time_start
            unique_cols = ['applicant_id', 'xlc_operation', 'dt_end_cli_work_week', 'dt_time_start']
            if all(col in df_clean.columns for col in unique_cols):
                before_dedup = len(df_clean)
                df_clean = df_clean.drop_duplicates(subset=unique_cols, keep='first')
                in_file_dupes = before_dedup - len(df_clean)
                if in_file_dupes > 0:
                    records_skipped += in_file_dupes

            # Create TimeEntry objects
            records = df_clean.to_dict('records')
            entries = [TimeEntry(**record) for record in records]

            # Bulk create with ignore_conflicts to skip duplicates against existing DB records
            # This uses the unique constraint we added to the model
            created_entries = TimeEntry.objects.bulk_create(
                entries,
                batch_size=5000,
                ignore_conflicts=True
            )

            # Calculate how many were actually inserted vs skipped
            # Note: bulk_create with ignore_conflicts doesn't return PKs for skipped records
            # We need to count the difference
            records_count = len(created_entries)

            # If not replacing, some may have been skipped due to DB duplicates
            if not upload.replace_existing:
                # Count actual records in DB after insert for this upload's data
                # This is an approximation - we count what was supposed to be inserted
                db_skipped = len(entries) - records_count
                records_skipped += db_skipped

        # Update ETL history
        elapsed = time.time() - start_time
        etl.status = 'success'
        etl.records_processed = records_count
        etl.duration_seconds = elapsed

        if records_skipped > 0:
            etl.message = f"Imported {records_count} records, skipped {records_skipped} duplicates"
        else:
            etl.message = f"Successfully imported {records_count} records from upload"
        etl.save()

        # Update upload record with detailed stats
        upload.records_in_file = total_in_file
        upload.records_skipped = records_skipped
        upload.save(update_fields=['records_in_file', 'records_skipped'])

        if records_skipped > 0:
            return True, f"Imported {records_count} records, skipped {records_skipped} duplicates", records_count, records_skipped
        return True, f"Successfully imported {records_count} records", records_count, records_skipped

    except Exception as e:
        elapsed = time.time() - start_time
        error_msg = str(e)

        # Update ETL history if it was created
        try:
            if 'etl' in locals():
                etl.status = 'failed'
                etl.message = error_msg
                etl.duration_seconds = elapsed
                etl.save()
        except:
            pass

        return False, f"Error processing file: {error_msg}", 0, 0
