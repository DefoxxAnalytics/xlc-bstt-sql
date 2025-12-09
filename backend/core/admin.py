from django.contrib import admin, messages
from django.contrib.auth.models import User, Group
from django.contrib.auth.admin import UserAdmin, GroupAdmin
from django.utils.html import format_html
from django.urls import path
from django.shortcuts import render, redirect
from django.http import HttpResponseRedirect
from django.contrib.admin.views.decorators import staff_member_required
from django.utils.decorators import method_decorator
from django.views import View
from .models import TimeEntry, ETLHistory, DataUpload
from .services import process_uploaded_file


@admin.register(TimeEntry)
class TimeEntryAdmin(admin.ModelAdmin):
    list_display = ['full_name', 'xlc_operation', 'entry_type', 'dt_end_cli_work_week', 'total_hours']
    list_filter = ['year', 'xlc_operation', 'entry_type', 'dt_end_cli_work_week']
    search_fields = ['full_name', 'last_name', 'first_name', 'applicant_id']
    date_hierarchy = 'dt_end_cli_work_week'
    readonly_fields = ['full_name']

    fieldsets = (
        ('Employee', {
            'fields': ('applicant_id', 'full_name', 'first_name', 'last_name', 'employee_type_id')
        }),
        ('Location', {
            'fields': ('xlc_operation', 'ofc_name', 'bu_dept_name', 'shift_number')
        }),
        ('Time Period', {
            'fields': ('year', 'dt_end_cli_work_week', 'work_date', 'date_range')
        }),
        ('Hours', {
            'fields': ('reg_hours', 'ot_hours', 'dt_hours', 'hol_wrk_hours', 'total_hours')
        }),
        ('Clock Details', {
            'fields': ('dt_time_start', 'dt_time_end', 'clock_in_method', 'clock_out_method',
                      'clock_in_tries', 'clock_out_tries'),
            'classes': ('collapse',)
        }),
        ('Classification', {
            'fields': ('entry_type', 'allocation_method')
        }),
    )


@admin.register(ETLHistory)
class ETLHistoryAdmin(admin.ModelAdmin):
    list_display = ['year', 'run_date', 'status', 'records_processed', 'duration_seconds']
    list_filter = ['year', 'status']
    readonly_fields = ['run_date', 'records_processed', 'status', 'message', 'duration_seconds']


@admin.register(DataUpload)
class DataUploadAdmin(admin.ModelAdmin):
    list_display = ['id', 'filename_display', 'year', 'file_type', 'status_display',
                   'records_processed', 'records_skipped', 'uploaded_at', 'uploaded_by']
    list_filter = ['year', 'status', 'file_type', 'uploaded_at']
    readonly_fields = ['status', 'records_processed', 'records_skipped', 'records_in_file',
                      'error_message', 'processing_time', 'uploaded_at', 'uploaded_by']
    actions = ['process_uploads']

    # Use custom template with upload progress indicator
    change_form_template = 'admin/core/dataupload/change_form.html'
    add_form_template = 'admin/core/dataupload/change_form.html'

    fieldsets = (
        ('Upload File', {
            'fields': ('file', 'file_type', 'year', 'replace_existing'),
            'description': 'Upload a CSV or Excel file with time entry data. '
                          'The file should have columns matching the expected format '
                          '(e.g., FullName, XLC Operation, EntryType, dtEndCliWorkWeek, etc.)'
        }),
        ('Processing Status', {
            'fields': ('status', 'records_in_file', 'records_processed', 'records_skipped',
                      'processing_time', 'error_message'),
            'classes': ('collapse',)
        }),
        ('Audit', {
            'fields': ('uploaded_at', 'uploaded_by'),
            'classes': ('collapse',)
        }),
    )

    def filename_display(self, obj):
        return obj.filename
    filename_display.short_description = 'File'

    def status_display(self, obj):
        colors = {
            'pending': '#f0ad4e',
            'processing': '#5bc0de',
            'success': '#5cb85c',
            'failed': '#d9534f',
        }
        color = colors.get(obj.status, '#777')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color, obj.get_status_display()
        )
    status_display.short_description = 'Status'

    def save_model(self, request, obj, form, change):
        if not change:  # New upload
            obj.uploaded_by = request.user
        super().save_model(request, obj, form, change)

        # Auto-process if this is a new upload
        if not change and obj.status == 'pending':
            self._process_single_upload(request, obj)

    def _process_single_upload(self, request, upload):
        """Process a single upload and show result message."""
        upload.status = 'processing'
        upload.save()

        success, message, records, skipped = process_uploaded_file(upload)

        upload.records_processed = records
        upload.records_skipped = skipped
        if success:
            upload.status = 'success'
            upload.error_message = ''
            messages.success(request, f'Successfully processed: {message}')
        else:
            upload.status = 'failed'
            upload.error_message = message
            messages.error(request, f'Processing failed: {message}')

        upload.save()

    @admin.action(description='Process selected uploads')
    def process_uploads(self, request, queryset):
        """Admin action to process selected uploads."""
        processed = 0
        failed = 0
        total_skipped = 0

        for upload in queryset.filter(status__in=['pending', 'failed']):
            upload.status = 'processing'
            upload.save()

            success, message, records, skipped = process_uploaded_file(upload)

            upload.records_processed = records
            upload.records_skipped = skipped
            if success:
                upload.status = 'success'
                upload.error_message = ''
                processed += 1
                total_skipped += skipped
            else:
                upload.status = 'failed'
                upload.error_message = message
                failed += 1

            upload.save()

        if processed:
            msg = f'Successfully processed {processed} upload(s)'
            if total_skipped > 0:
                msg += f' ({total_skipped} duplicate records skipped)'
            messages.success(request, msg)
        if failed:
            messages.error(request, f'Failed to process {failed} upload(s)')


# =============================================================================
# Custom Admin Site with Database Management
# =============================================================================

class BSTTAdminSite(admin.AdminSite):
    """Custom admin site with database management features."""
    site_header = 'BSTT Compliance Dashboard Admin'
    site_title = 'BSTT Admin'
    index_title = 'Dashboard Administration'
    index_template = 'admin/index.html'

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('database-management/', self.admin_view(self.database_management_view),
                 name='database_management'),
            path('clear-time-entries/', self.admin_view(self.clear_time_entries_view),
                 name='clear_time_entries'),
            path('clear-all-data/', self.admin_view(self.clear_all_data_view),
                 name='clear_all_data'),
            path('clear-year-data/<int:year>/', self.admin_view(self.clear_year_data_view),
                 name='clear_year_data'),
        ]
        return custom_urls + urls

    def database_management_view(self, request):
        """Database management dashboard."""
        # Get statistics
        stats = {
            'time_entries': TimeEntry.objects.count(),
            'etl_history': ETLHistory.objects.count(),
            'data_uploads': DataUpload.objects.count(),
        }

        # Get years with data
        years = TimeEntry.objects.values_list('year', flat=True).distinct().order_by('-year')
        year_stats = []
        for year in years:
            count = TimeEntry.objects.filter(year=year).count()
            year_stats.append({'year': year, 'count': count})

        context = {
            **self.each_context(request),
            'title': 'Database Management',
            'stats': stats,
            'year_stats': year_stats,
        }
        return render(request, 'admin/core/database_management.html', context)

    def clear_time_entries_view(self, request):
        """Clear all time entries."""
        if request.method == 'POST':
            confirm = request.POST.get('confirm', '')
            if confirm == 'DELETE ALL TIME ENTRIES':
                count = TimeEntry.objects.count()
                TimeEntry.objects.all().delete()
                messages.success(request, f'Successfully deleted {count:,} time entries.')
                return redirect('admin:database_management')
            else:
                messages.error(request, 'Confirmation text did not match. No data was deleted.')
                return redirect('admin:database_management')

        context = {
            **self.each_context(request),
            'title': 'Clear All Time Entries',
            'count': TimeEntry.objects.count(),
            'confirmation_text': 'DELETE ALL TIME ENTRIES',
        }
        return render(request, 'admin/core/confirm_delete.html', context)

    def clear_all_data_view(self, request):
        """Clear all application data."""
        if request.method == 'POST':
            confirm = request.POST.get('confirm', '')
            if confirm == 'DELETE EVERYTHING':
                time_entries = TimeEntry.objects.count()
                etl_history = ETLHistory.objects.count()
                data_uploads = DataUpload.objects.count()

                TimeEntry.objects.all().delete()
                ETLHistory.objects.all().delete()
                DataUpload.objects.all().delete()

                total = time_entries + etl_history + data_uploads
                messages.success(request,
                    f'Successfully deleted all data: {time_entries:,} time entries, '
                    f'{etl_history} ETL records, {data_uploads} upload records.')
                return redirect('admin:database_management')
            else:
                messages.error(request, 'Confirmation text did not match. No data was deleted.')
                return redirect('admin:database_management')

        context = {
            **self.each_context(request),
            'title': 'Clear All Data',
            'stats': {
                'time_entries': TimeEntry.objects.count(),
                'etl_history': ETLHistory.objects.count(),
                'data_uploads': DataUpload.objects.count(),
            },
            'confirmation_text': 'DELETE EVERYTHING',
        }
        return render(request, 'admin/core/confirm_delete_all.html', context)

    def clear_year_data_view(self, request, year):
        """Clear time entries for a specific year."""
        if request.method == 'POST':
            confirm = request.POST.get('confirm', '')
            expected = f'DELETE {year}'
            if confirm == expected:
                count = TimeEntry.objects.filter(year=year).count()
                TimeEntry.objects.filter(year=year).delete()
                messages.success(request, f'Successfully deleted {count:,} time entries for year {year}.')
                return redirect('admin:database_management')
            else:
                messages.error(request, 'Confirmation text did not match. No data was deleted.')
                return redirect('admin:database_management')

        context = {
            **self.each_context(request),
            'title': f'Clear Data for Year {year}',
            'year': year,
            'count': TimeEntry.objects.filter(year=year).count(),
            'confirmation_text': f'DELETE {year}',
        }
        return render(request, 'admin/core/confirm_delete_year.html', context)


# Replace the default admin site
bstt_admin_site = BSTTAdminSite(name='bstt_admin')

# Re-register models with the custom admin site
bstt_admin_site.register(TimeEntry, TimeEntryAdmin)
bstt_admin_site.register(ETLHistory, ETLHistoryAdmin)
bstt_admin_site.register(DataUpload, DataUploadAdmin)

# Register User and Group models for authentication management
bstt_admin_site.register(User, UserAdmin)
bstt_admin_site.register(Group, GroupAdmin)
