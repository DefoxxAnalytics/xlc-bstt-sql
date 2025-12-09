import axios from 'axios';
import { KPIs, OfficeKPIs, WeeklyKPIs, FilterOptions, Filters, TimeEntry } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
const ADMIN_BASE_URL = process.env.REACT_APP_ADMIN_URL || '/admin';

// Helper to get admin panel URLs
export const getAdminUrl = (path: string = ''): string => {
  return `${ADMIN_BASE_URL}${path}`;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Build query string from filters
const buildQueryString = (filters: Filters): string => {
  const params = new URLSearchParams();
  if (filters.year) params.append('year', filters.year.toString());
  if (filters.xlc_operation) params.append('xlc_operation', filters.xlc_operation);
  if (filters.entry_type) params.append('entry_type', filters.entry_type);
  if (filters.dt_end_cli_work_week) params.append('dt_end_cli_work_week', filters.dt_end_cli_work_week);
  if (filters.dt_end_cli_work_week__gte) params.append('dt_end_cli_work_week__gte', filters.dt_end_cli_work_week__gte);
  if (filters.dt_end_cli_work_week__lte) params.append('dt_end_cli_work_week__lte', filters.dt_end_cli_work_week__lte);
  if (filters.bu_dept_name) params.append('bu_dept_name', filters.bu_dept_name);
  return params.toString();
};

// KPI endpoints
export const fetchKPIs = async (filters: Filters = {}): Promise<KPIs> => {
  const query = buildQueryString(filters);
  const response = await api.get(`/kpis/?${query}`);
  return response.data;
};

export const fetchKPIsByOffice = async (filters: Filters = {}): Promise<OfficeKPIs[]> => {
  const query = buildQueryString(filters);
  const response = await api.get(`/kpis/by-office/?${query}`);
  return response.data;
};

export const fetchKPIsByWeek = async (filters: Filters = {}): Promise<WeeklyKPIs[]> => {
  const query = buildQueryString(filters);
  const response = await api.get(`/kpis/by-week/?${query}`);
  return response.data;
};

export const fetchKPITrends = async (filters: Filters = {}): Promise<any> => {
  const query = buildQueryString(filters);
  const response = await api.get(`/kpis/trends/?${query}`);
  return response.data;
};

export const fetchKPIsByEmployee = async (filters: Filters = {}): Promise<any[]> => {
  const query = buildQueryString(filters);
  const response = await api.get(`/kpis/by-employee/?${query}`);
  return response.data;
};

export const fetchClockBehavior = async (filters: Filters = {}): Promise<any> => {
  const query = buildQueryString(filters);
  const response = await api.get(`/kpis/clock-behavior/?${query}`);
  return response.data;
};

export const fetchKPIsByDepartment = async (filters: Filters = {}): Promise<any[]> => {
  const query = buildQueryString(filters);
  const response = await api.get(`/kpis/by-department/?${query}`);
  return response.data;
};

export const fetchKPIsByShift = async (filters: Filters = {}): Promise<any[]> => {
  const query = buildQueryString(filters);
  const response = await api.get(`/kpis/by-shift/?${query}`);
  return response.data;
};

// Filter options
export const fetchFilterOptions = async (): Promise<FilterOptions> => {
  const response = await api.get('/filters/options/');
  return response.data;
};

// Time entries
export const fetchTimeEntries = async (
  filters: Filters = {},
  page: number = 1,
  pageSize: number = 100
): Promise<{
  count: number;
  results: TimeEntry[];
}> => {
  const query = buildQueryString(filters);
  const response = await api.get(`/time-entries/?${query}&page=${page}&page_size=${pageSize}`);
  return response.data;
};

export const fetchTimeEntrySummary = async (filters: Filters = {}): Promise<any> => {
  const query = buildQueryString(filters);
  const response = await api.get(`/time-entries/summary/?${query}`);
  return response.data;
};

// Reports
export const downloadFullReport = (filters: Filters = {}): string => {
  const query = buildQueryString(filters);
  return `${API_BASE_URL}/reports/full/?${query}`;
};

export const downloadWeeklySummary = (filters: Filters = {}): string => {
  const query = buildQueryString(filters);
  return `${API_BASE_URL}/reports/weekly-summary/?${query}`;
};

// Data quality
export interface DataQuality {
  total_records: number;
  min_date: string | null;
  max_date: string | null;
  data_freshness: 'current' | 'recent' | 'stale' | 'outdated' | 'unknown';
  last_etl_run: string | null;
  last_etl_status: string | null;
  last_etl_records: number;
  years_data: Array<{ year: number; count: number }>;
}

export const fetchDataQuality = async (): Promise<DataQuality> => {
  const response = await api.get('/data-quality/');
  return response.data;
};

export default api;
