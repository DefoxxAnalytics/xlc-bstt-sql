"""
Django models for BSTT Compliance Dashboard.
"""
from django.db import models


class TimeEntry(models.Model):
    """Main fact table for time entries."""
    year = models.IntegerField(db_index=True)

    # Office/Location
    ofc_name = models.CharField(max_length=200, blank=True)
    xlc_operation = models.CharField(max_length=200, db_index=True)

    # Time Period
    dt_end_cli_work_week = models.DateField(db_index=True)
    work_date = models.DateField(null=True, blank=True)
    date_range = models.CharField(max_length=100, blank=True)

    # ISO Week Number (for cross-office alignment)
    # Martinsburg uses Saturday week endings, others use Sunday
    # ISO week numbers align both to the same week
    week_number = models.PositiveSmallIntegerField(db_index=True, null=True, blank=True)
    week_year = models.PositiveSmallIntegerField(db_index=True, null=True, blank=True)

    # Employee Info
    applicant_id = models.CharField(max_length=50, db_index=True)
    last_name = models.CharField(max_length=100, blank=True)
    first_name = models.CharField(max_length=100, blank=True)
    full_name = models.CharField(max_length=200, blank=True)
    employee_type_id = models.CharField(max_length=50, blank=True)

    # Shift/Department
    shift_number = models.CharField(max_length=20, blank=True)
    bu_dept_name = models.CharField(max_length=200, blank=True)
    allocation_method = models.CharField(max_length=100, blank=True)

    # Clock Times
    dt_time_start = models.DateTimeField(null=True, blank=True)
    dt_time_end = models.DateTimeField(null=True, blank=True)

    # Hours
    reg_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    ot_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    dt_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    hol_wrk_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    total_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)

    # Clock Behavior
    clock_in_local = models.CharField(max_length=100, blank=True)
    clock_in_tries = models.IntegerField(default=1)
    clock_in_method = models.CharField(max_length=50, blank=True)
    clock_out_local = models.CharField(max_length=100, blank=True)
    clock_out_tries = models.IntegerField(default=1)
    clock_out_method = models.CharField(max_length=50, blank=True)

    # Entry Classification
    entry_type = models.CharField(max_length=50, db_index=True)

    class Meta:
        verbose_name = "Time Entry"
        verbose_name_plural = "Time Entries"
        ordering = ['-dt_end_cli_work_week', 'xlc_operation']
        indexes = [
            models.Index(fields=['year', 'dt_end_cli_work_week']),
            models.Index(fields=['xlc_operation', 'entry_type']),
            models.Index(fields=['week_year', 'week_number']),
        ]
        constraints = [
            # Unique constraint for duplicate detection
            # A time entry is unique based on: employee + office + week + clock-in time
            models.UniqueConstraint(
                fields=['applicant_id', 'xlc_operation', 'dt_end_cli_work_week', 'dt_time_start'],
                name='unique_time_entry'
            ),
        ]

    def __str__(self):
        return f"{self.full_name} - {self.xlc_operation} - {self.dt_end_cli_work_week}"


class ETLHistory(models.Model):
    """ETL run audit log."""
    year = models.IntegerField()
    run_date = models.DateTimeField(auto_now_add=True)
    records_processed = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=[
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('running', 'Running'),
    ], default='running')
    message = models.TextField(blank=True)
    duration_seconds = models.FloatField(null=True, blank=True)

    class Meta:
        verbose_name = "ETL History"
        verbose_name_plural = "ETL History"
        ordering = ['-run_date']

    def __str__(self):
        return f"ETL {self.year} - {self.run_date.strftime('%Y-%m-%d %H:%M')} - {self.status}"


def upload_to_path(instance, filename):
    """Generate upload path for data files."""
    import datetime
    date_str = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    return f'uploads/{instance.year}/{date_str}_{filename}'


class DataUpload(models.Model):
    """Model to handle data file uploads through admin."""
    UPLOAD_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('success', 'Success'),
        ('failed', 'Failed'),
    ]

    FILE_TYPE_CHOICES = [
        ('csv', 'CSV File'),
        ('excel', 'Excel File'),
    ]

    file = models.FileField(upload_to=upload_to_path)
    file_type = models.CharField(max_length=10, choices=FILE_TYPE_CHOICES, default='csv')
    year = models.IntegerField(help_text="Year for this data (e.g., 2025)")
    uploaded_by = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='data_uploads'
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=UPLOAD_STATUS_CHOICES, default='pending')
    records_processed = models.IntegerField(default=0)
    records_skipped = models.IntegerField(default=0, help_text="Duplicate records skipped")
    records_in_file = models.IntegerField(default=0, help_text="Total records in uploaded file")
    error_message = models.TextField(blank=True)
    processing_time = models.FloatField(null=True, blank=True, help_text="Processing time in seconds")
    replace_existing = models.BooleanField(
        default=True,
        help_text="Replace existing data for this year (recommended to avoid duplicates)"
    )

    class Meta:
        verbose_name = "Data Upload"
        verbose_name_plural = "Data Uploads"
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"Upload {self.year} - {self.uploaded_at.strftime('%Y-%m-%d %H:%M')} - {self.status}"

    @property
    def filename(self):
        """Return just the filename without the path."""
        import os
        return os.path.basename(self.file.name) if self.file else ''
