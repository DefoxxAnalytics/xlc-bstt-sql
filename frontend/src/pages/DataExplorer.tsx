import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Database, Download, RefreshCw, Search, ChevronLeft, ChevronRight,
  Filter, FileSpreadsheet, Settings, BarChart3,
  Clock, Building2, Users, Hash, FileText, Zap, Fingerprint, Layers, ChevronUp, ChevronDown
} from 'lucide-react';
import { COLORS, ENTRY_TYPE_COLORS } from '../constants/colors';
import { useFilters } from '../contexts/FilterContext';
import { fetchTimeEntries, downloadFullReport } from '../api/client';
import { TimeEntry } from '../types';
import AnimatedNumber from '../components/AnimatedNumber';

type TabType = 'browse' | 'summary' | 'export';
type SortField = 'full_name' | 'applicant_id' | 'xlc_operation' | 'bu_dept_name' | 'shift_number' | 'dt_end_cli_work_week' | 'entry_type' | 'total_hours';
type SortDirection = 'asc' | 'desc';

// GlassCard component for consistent styling
const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  glow?: string;
  gradient?: string;
}> = ({ children, className = '', glow, gradient }) => (
  <div
    className={`rounded-xl backdrop-blur-sm overflow-hidden transition-all duration-300 hover:translate-y-[-2px] ${className}`}
    style={{
      background: gradient || `linear-gradient(145deg, ${COLORS.background.secondary}95 0%, ${COLORS.background.tertiary}95 100%)`,
      border: `1px solid ${COLORS.border.subtle}`,
      boxShadow: glow
        ? `0 4px 20px ${glow}20, 0 0 40px ${glow}10, inset 0 1px 0 rgba(255,255,255,0.05)`
        : `0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)`,
    }}
  >
    {children}
  </div>
);

// Progress bar component
const ProgressBar: React.FC<{ value: number; max?: number; color: string }> = ({ value, max = 100, color }) => (
  <div className="h-2 rounded-full overflow-hidden" style={{ background: COLORS.background.tertiary }}>
    <div
      className="h-full rounded-full transition-all duration-1000 ease-out"
      style={{ width: `${Math.min((value / max) * 100, 100)}%`, background: color }}
    />
  </div>
);

// Sortable header component
const SortableHeader: React.FC<{
  field: SortField;
  label: string;
  icon?: React.ReactNode;
  currentSort: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  align?: 'left' | 'right' | 'center';
}> = ({ field, label, icon, currentSort, sortDirection, onSort, align = 'left' }) => {
  const isActive = currentSort === field;
  const alignClass = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';

  return (
    <th
      className={`py-3 px-3 text-xs font-semibold uppercase tracking-wide cursor-pointer transition-colors hover:bg-opacity-50`}
      style={{ color: isActive ? COLORS.accent.primary : COLORS.text.secondary }}
      onClick={() => onSort(field)}
    >
      <div className={`flex items-center gap-1.5 ${alignClass}`}>
        {icon}
        {label}
        <div className="flex flex-col ml-1">
          <ChevronUp
            size={10}
            style={{
              color: isActive && sortDirection === 'asc' ? COLORS.accent.primary : COLORS.text.muted,
              marginBottom: -3,
            }}
          />
          <ChevronDown
            size={10}
            style={{
              color: isActive && sortDirection === 'desc' ? COLORS.accent.primary : COLORS.text.muted,
            }}
          />
        </div>
      </div>
    </th>
  );
};

const DataExplorer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('browse');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TimeEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [quickFilter, setQuickFilter] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortField, setSortField] = useState<SortField>('full_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const { filters } = useFilters();

  // Load data
  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setLoading(true);

    try {
      const response = await fetchTimeEntries(filters, page, pageSize);
      setData(response.results);
      setTotalCount(response.count);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle sorting
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Apply quick filter
    if (quickFilter) {
      const search = quickFilter.toLowerCase();
      result = result.filter(row =>
        row.full_name?.toLowerCase().includes(search) ||
        row.applicant_id?.toLowerCase().includes(search) ||
        row.xlc_operation?.toLowerCase().includes(search) ||
        row.bu_dept_name?.toLowerCase().includes(search) ||
        row.entry_type?.toLowerCase().includes(search)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      // Handle nulls
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';

      // Numeric comparison for hours
      if (sortField === 'total_hours') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      }

      // String comparison
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, quickFilter, sortField, sortDirection]);

  // Export to CSV
  const exportToCsv = useCallback(() => {
    const headers = ['Employee', 'ID', 'Office', 'Department', 'Shift', 'Week Ending', 'Entry Type', 'Total Hours'];
    const rows = filteredAndSortedData.map(row => [
      row.full_name,
      row.applicant_id,
      row.xlc_operation,
      row.bu_dept_name,
      row.shift_number,
      row.dt_end_cli_work_week,
      row.entry_type,
      row.total_hours?.toFixed(2),
    ]);

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell || ''}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bstt_data_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }, [filteredAndSortedData]);

  // Calculate total pages
  const totalPages = Math.ceil(totalCount / pageSize);

  // Summary stats
  const summaryStats = useMemo(() => {
    if (!data || data.length === 0) return null;

    const totalHours = data.reduce((sum, row) => sum + (Number(row.total_hours) || 0), 0);
    const avgHours = totalHours / data.length;
    const entryTypes = data.reduce((acc, row) => {
      acc[row.entry_type] = (acc[row.entry_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const offices = Array.from(new Set(data.map(row => row.xlc_operation)));
    const employees = Array.from(new Set(data.map(row => row.applicant_id)));

    return {
      totalEntries: data.length,
      totalHours: Number(totalHours),
      avgHours: Number(avgHours),
      uniqueOffices: offices.length,
      uniqueEmployees: employees.length,
      entryTypes,
    };
  }, [data]);

  const tabs = [
    { id: 'browse' as TabType, label: 'Browse Data', icon: <Database size={14} /> },
    { id: 'summary' as TabType, label: 'Summary', icon: <BarChart3 size={14} /> },
    { id: 'export' as TabType, label: 'Export', icon: <Download size={14} /> },
  ];

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatWeekEnding = (value: string | null) => {
    if (!value) return '';
    // Add T12:00:00 to avoid UTC-to-local timezone shift
    const date = new Date(value + 'T12:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading && data.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div
              className="w-16 h-16 rounded-full border-4 border-t-transparent animate-spin"
              style={{ borderColor: `${COLORS.accent.primary} transparent ${COLORS.accent.primary}30 transparent` }}
            />
            <Database
              size={24}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ color: COLORS.accent.primary }}
            />
          </div>
          <p className="text-sm" style={{ color: COLORS.text.secondary }}>Loading data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="p-2.5 rounded-xl"
            style={{
              background: `linear-gradient(135deg, ${COLORS.accent.primary}20 0%, ${COLORS.accent.primary}10 100%)`,
              border: `1px solid ${COLORS.accent.primary}30`,
            }}
          >
            <Database size={22} style={{ color: COLORS.accent.primary }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: COLORS.text.primary }}>
              Data Explorer
            </h1>
            <p className="text-xs" style={{ color: COLORS.text.muted }}>
              Browse, filter, and export time entry data
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
            style={{ background: COLORS.background.secondary, color: COLORS.text.muted }}
          >
            <Clock size={12} />
            <span>Updated {formatTime(lastUpdated)}</span>
          </div>
          <button
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:scale-105"
            style={{
              background: COLORS.background.secondary,
              color: COLORS.text.secondary,
              border: `1px solid ${COLORS.border.subtle}`,
            }}
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <div
            className="px-3 py-2 rounded-lg text-xs font-bold"
            style={{
              background: `linear-gradient(135deg, ${COLORS.accent.primary}20 0%, ${COLORS.accent.primary}10 100%)`,
              color: COLORS.accent.primary,
              border: `1px solid ${COLORS.accent.primary}30`,
            }}
          >
            <AnimatedNumber value={totalCount} /> records
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 p-1 rounded-xl"
        style={{
          background: COLORS.background.secondary,
          border: `1px solid ${COLORS.border.subtle}`,
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-300"
            style={{
              background: activeTab === tab.id
                ? `linear-gradient(135deg, ${COLORS.accent.primary}20 0%, ${COLORS.accent.primary}10 100%)`
                : 'transparent',
              color: activeTab === tab.id ? COLORS.accent.primary : COLORS.text.secondary,
              border: activeTab === tab.id ? `1px solid ${COLORS.accent.primary}30` : '1px solid transparent',
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <GlassCard>
        <div className="p-4">
          {activeTab === 'browse' && (
            <div className="space-y-4">
              {/* Controls */}
              <div
                className="flex flex-wrap items-center gap-3 p-3 rounded-lg"
                style={{ background: COLORS.background.tertiary }}
              >
                <div className="relative flex-1 min-w-[200px]">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: COLORS.text.muted }}
                  />
                  <input
                    type="text"
                    placeholder="Search by name, ID, office, department..."
                    value={quickFilter}
                    onChange={(e) => setQuickFilter(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
                    style={{
                      background: COLORS.background.secondary,
                      border: `1px solid ${COLORS.border.subtle}`,
                      color: COLORS.text.primary,
                    }}
                  />
                </div>
                {quickFilter && (
                  <button
                    onClick={() => setQuickFilter('')}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
                    style={{
                      background: COLORS.background.secondary,
                      color: COLORS.text.secondary,
                      border: `1px solid ${COLORS.border.subtle}`,
                    }}
                  >
                    <Filter size={14} />
                    Clear
                  </button>
                )}
                <button
                  onClick={exportToCsv}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
                  style={{
                    background: `linear-gradient(135deg, ${COLORS.accent.primary} 0%, ${COLORS.accent.secondary} 100%)`,
                    color: '#ffffff',
                  }}
                >
                  <Download size={14} />
                  Export CSV
                </button>
                <span
                  className="px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{ background: COLORS.background.secondary, color: COLORS.text.muted }}
                >
                  {filteredAndSortedData.length} of {data.length}
                </span>
              </div>

              {/* Data Table */}
              <div
                className="overflow-auto rounded-lg"
                style={{
                  maxHeight: '480px',
                  border: `1px solid ${COLORS.border.subtle}`,
                }}
              >
                <table className="w-full">
                  <thead
                    className="sticky top-0 z-10"
                    style={{ background: COLORS.background.tertiary }}
                  >
                    <tr style={{ borderBottom: `2px solid ${COLORS.border.default}` }}>
                      <SortableHeader
                        field="full_name"
                        label="Employee"
                        icon={<Users size={12} />}
                        currentSort={sortField}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        field="applicant_id"
                        label="ID"
                        currentSort={sortField}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        field="xlc_operation"
                        label="Office"
                        icon={<Building2 size={12} />}
                        currentSort={sortField}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        field="bu_dept_name"
                        label="Department"
                        icon={<Layers size={12} />}
                        currentSort={sortField}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        field="shift_number"
                        label="Shift"
                        currentSort={sortField}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        align="center"
                      />
                      <SortableHeader
                        field="dt_end_cli_work_week"
                        label="Week End"
                        currentSort={sortField}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        field="entry_type"
                        label="Entry Type"
                        icon={<Fingerprint size={12} />}
                        currentSort={sortField}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        field="total_hours"
                        label="Hours"
                        icon={<Clock size={12} />}
                        currentSort={sortField}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        align="right"
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedData.map((row, index) => {
                      const entryTypeColor = ENTRY_TYPE_COLORS[row.entry_type as keyof typeof ENTRY_TYPE_COLORS] || COLORS.text.primary;
                      return (
                        <tr
                          key={`${row.applicant_id}-${row.dt_end_cli_work_week}-${index}`}
                          className="transition-colors"
                          style={{
                            background: index % 2 === 0 ? 'transparent' : `${COLORS.background.tertiary}40`,
                            borderBottom: `1px solid ${COLORS.border.subtle}`,
                          }}
                        >
                          <td className="py-2.5 px-3">
                            <span className="text-sm font-medium" style={{ color: COLORS.text.primary }}>
                              {row.full_name}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-xs" style={{ color: COLORS.text.muted }}>
                            {row.applicant_id}
                          </td>
                          <td className="py-2.5 px-3 text-xs" style={{ color: COLORS.text.secondary }}>
                            {row.xlc_operation}
                          </td>
                          <td className="py-2.5 px-3 text-xs" style={{ color: COLORS.text.secondary }}>
                            {row.bu_dept_name}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-center" style={{ color: COLORS.text.muted }}>
                            {row.shift_number}
                          </td>
                          <td className="py-2.5 px-3 text-xs" style={{ color: COLORS.text.secondary }}>
                            {formatWeekEnding(row.dt_end_cli_work_week)}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
                              style={{
                                background: `${entryTypeColor}20`,
                                color: entryTypeColor,
                              }}
                            >
                              {row.entry_type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-sm text-right font-medium" style={{ color: COLORS.text.primary }}>
                            {Number(row.total_hours || 0).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div
                className="flex items-center justify-between p-3 rounded-xl"
                style={{
                  background: COLORS.background.tertiary,
                  border: `1px solid ${COLORS.border.subtle}`,
                }}
              >
                <div className="flex items-center gap-4">
                  <span className="text-xs" style={{ color: COLORS.text.secondary }}>
                    Page <span className="font-bold" style={{ color: COLORS.text.primary }}>{page}</span> of {totalPages}
                  </span>
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                    style={{
                      background: COLORS.background.secondary,
                      border: `1px solid ${COLORS.border.subtle}`,
                      color: COLORS.text.primary,
                    }}
                  >
                    <option value={50}>50 / page</option>
                    <option value={100}>100 / page</option>
                    <option value={200}>200 / page</option>
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 transition-colors"
                    style={{ background: COLORS.background.secondary, color: COLORS.text.secondary }}
                  >
                    First
                  </button>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex items-center px-2 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 transition-colors"
                    style={{ background: COLORS.background.secondary, color: COLORS.text.secondary }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span
                    className="px-4 py-1.5 rounded-lg text-xs font-bold"
                    style={{
                      background: `linear-gradient(135deg, ${COLORS.accent.primary} 0%, ${COLORS.accent.secondary} 100%)`,
                      color: '#ffffff',
                    }}
                  >
                    {page}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="flex items-center px-2 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 transition-colors"
                    style={{ background: COLORS.background.secondary, color: COLORS.text.secondary }}
                  >
                    <ChevronRight size={14} />
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page >= totalPages}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 transition-colors"
                    style={{ background: COLORS.background.secondary, color: COLORS.text.secondary }}
                  >
                    Last
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'summary' && summaryStats && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={16} style={{ color: COLORS.accent.primary }} />
                <h3 className="text-sm font-semibold" style={{ color: COLORS.text.primary }}>
                  Page Statistics
                </h3>
                <span
                  className="px-2 py-0.5 rounded-full text-xs"
                  style={{ background: COLORS.background.tertiary, color: COLORS.text.muted }}
                >
                  {data.length} records
                </span>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <GlassCard glow={COLORS.accent.primary}>
                  <div className="p-4 text-center relative overflow-hidden">
                    <div className="absolute top-2 right-2 opacity-10">
                      <Hash size={32} style={{ color: COLORS.accent.primary }} />
                    </div>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Hash size={14} style={{ color: COLORS.accent.primary }} />
                      <p className="text-xs font-medium" style={{ color: COLORS.text.secondary }}>Entries</p>
                    </div>
                    <p className="text-2xl font-bold" style={{ color: COLORS.text.primary }}>
                      <AnimatedNumber value={summaryStats.totalEntries} />
                    </p>
                  </div>
                </GlassCard>

                <GlassCard glow={COLORS.accent.secondary}>
                  <div className="p-4 text-center relative overflow-hidden">
                    <div className="absolute top-2 right-2 opacity-10">
                      <Clock size={32} style={{ color: COLORS.accent.secondary }} />
                    </div>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Clock size={14} style={{ color: COLORS.accent.secondary }} />
                      <p className="text-xs font-medium" style={{ color: COLORS.text.secondary }}>Total Hours</p>
                    </div>
                    <p className="text-2xl font-bold" style={{ color: COLORS.text.primary }}>
                      <AnimatedNumber value={summaryStats.totalHours} decimals={1} />
                    </p>
                  </div>
                </GlassCard>

                <GlassCard>
                  <div className="p-4 text-center relative overflow-hidden">
                    <div className="absolute top-2 right-2 opacity-10">
                      <Zap size={32} style={{ color: COLORS.text.muted }} />
                    </div>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Zap size={14} style={{ color: COLORS.text.secondary }} />
                      <p className="text-xs font-medium" style={{ color: COLORS.text.secondary }}>Avg Hours</p>
                    </div>
                    <p className="text-2xl font-bold" style={{ color: COLORS.text.primary }}>
                      <AnimatedNumber value={summaryStats.avgHours} decimals={2} />
                    </p>
                  </div>
                </GlassCard>

                <GlassCard>
                  <div className="p-4 text-center relative overflow-hidden">
                    <div className="absolute top-2 right-2 opacity-10">
                      <Building2 size={32} style={{ color: COLORS.text.muted }} />
                    </div>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Building2 size={14} style={{ color: COLORS.text.secondary }} />
                      <p className="text-xs font-medium" style={{ color: COLORS.text.secondary }}>Offices</p>
                    </div>
                    <p className="text-2xl font-bold" style={{ color: COLORS.text.primary }}>
                      <AnimatedNumber value={summaryStats.uniqueOffices} />
                    </p>
                  </div>
                </GlassCard>

                <GlassCard>
                  <div className="p-4 text-center relative overflow-hidden">
                    <div className="absolute top-2 right-2 opacity-10">
                      <Users size={32} style={{ color: COLORS.text.muted }} />
                    </div>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Users size={14} style={{ color: COLORS.text.secondary }} />
                      <p className="text-xs font-medium" style={{ color: COLORS.text.secondary }}>Employees</p>
                    </div>
                    <p className="text-2xl font-bold" style={{ color: COLORS.text.primary }}>
                      <AnimatedNumber value={summaryStats.uniqueEmployees} />
                    </p>
                  </div>
                </GlassCard>
              </div>

              {/* Entry Type Breakdown */}
              <GlassCard>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText size={16} style={{ color: COLORS.accent.primary }} />
                    <h4 className="text-sm font-semibold" style={{ color: COLORS.text.primary }}>
                      Entry Type Distribution
                    </h4>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(summaryStats.entryTypes)
                      .sort(([, a], [, b]) => b - a)
                      .map(([type, count]) => {
                        const percentage = ((count / summaryStats.totalEntries) * 100);
                        const color = ENTRY_TYPE_COLORS[type as keyof typeof ENTRY_TYPE_COLORS] || COLORS.text.secondary;
                        return (
                          <div key={type}>
                            <div className="flex justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                                <span className="text-sm font-medium" style={{ color }}>{type}</span>
                              </div>
                              <span className="text-sm" style={{ color: COLORS.text.muted }}>
                                <span className="font-semibold" style={{ color: COLORS.text.primary }}>{count.toLocaleString()}</span> ({percentage.toFixed(1)}%)
                              </span>
                            </div>
                            <ProgressBar value={percentage} max={100} color={color} />
                          </div>
                        );
                      })}
                  </div>
                </div>
              </GlassCard>
            </div>
          )}

          {activeTab === 'export' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Download size={16} style={{ color: COLORS.accent.primary }} />
                <h3 className="text-sm font-semibold" style={{ color: COLORS.text.primary }}>
                  Export Options
                </h3>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {/* CSV Export */}
                <GlassCard glow={COLORS.accent.primary}>
                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="p-2.5 rounded-xl"
                        style={{
                          background: `${COLORS.accent.primary}20`,
                          border: `1px solid ${COLORS.accent.primary}30`,
                        }}
                      >
                        <FileSpreadsheet size={20} style={{ color: COLORS.accent.primary }} />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold" style={{ color: COLORS.text.primary }}>
                          CSV Export
                        </h4>
                        <p className="text-xs" style={{ color: COLORS.text.muted }}>
                          Current page data
                        </p>
                      </div>
                    </div>
                    <p className="text-xs mb-4" style={{ color: COLORS.text.secondary }}>
                      Export current page to CSV format with all visible columns. Perfect for quick data analysis.
                    </p>
                    <button
                      onClick={exportToCsv}
                      className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all hover:scale-[1.02]"
                      style={{
                        background: `linear-gradient(135deg, ${COLORS.accent.primary} 0%, ${COLORS.accent.secondary} 100%)`,
                        color: '#ffffff',
                      }}
                    >
                      Download CSV
                    </button>
                  </div>
                </GlassCard>

                {/* Full Report */}
                <GlassCard glow={COLORS.accent.secondary}>
                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="p-2.5 rounded-xl"
                        style={{
                          background: `${COLORS.accent.secondary}20`,
                          border: `1px solid ${COLORS.accent.secondary}30`,
                        }}
                      >
                        <Database size={20} style={{ color: COLORS.accent.secondary }} />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold" style={{ color: COLORS.text.primary }}>
                          Full Excel Report
                        </h4>
                        <p className="text-xs" style={{ color: COLORS.text.muted }}>
                          Comprehensive analysis
                        </p>
                      </div>
                    </div>
                    <p className="text-xs mb-4" style={{ color: COLORS.text.secondary }}>
                      Complete Excel workbook with KPIs, pivots, and analysis sheets. Includes all filtered data.
                    </p>
                    <a
                      href={downloadFullReport(filters)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full py-2.5 rounded-lg text-sm font-semibold text-center transition-all hover:scale-[1.02]"
                      style={{
                        background: `linear-gradient(135deg, ${COLORS.accent.secondary} 0%, ${COLORS.status.info} 100%)`,
                        color: '#ffffff',
                      }}
                    >
                      Download Excel
                    </a>
                  </div>
                </GlassCard>
              </div>

              {/* Export Tip */}
              <div
                className="flex items-start gap-3 p-4 rounded-xl"
                style={{
                  background: `linear-gradient(135deg, ${COLORS.status.info}15 0%, ${COLORS.status.info}05 100%)`,
                  border: `1px solid ${COLORS.status.info}30`,
                }}
              >
                <Settings size={18} style={{ color: COLORS.status.info, marginTop: 2 }} />
                <div>
                  <p className="text-sm font-semibold mb-1" style={{ color: COLORS.status.info }}>
                    Pro Tip
                  </p>
                  <p className="text-xs" style={{ color: COLORS.text.secondary }}>
                    Use the sidebar filters to narrow down data before exporting. The Excel report will include only filtered data, making it easier to analyze specific offices or time periods.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
};

export default DataExplorer;
