/**
 * Executive Dashboard - BSTT Compliance Overview
 *
 * NOTE: ISO Week Number Alignment
 * Weekly data uses ISO week numbers to align offices with different week ending days:
 * - Martinsburg: Saturday week endings
 * - Other offices: Sunday week endings
 *
 * Both Saturday and Sunday of the same calendar week share the same ISO week number,
 * ensuring accurate cross-office trend comparisons. The `week_display` field shows
 * the Sunday date for each ISO week for consistent labeling.
 */
import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, ReferenceLine, Area, AreaChart
} from 'recharts';
import {
  Fingerprint, AlertTriangle, Users, Clock, Building2,
  Calendar, Activity, TrendingUp, TrendingDown, Zap, Target,
  ArrowUpRight, ArrowDownRight, RefreshCw, Shield, Eye, Hash, ExternalLink, Info
} from 'lucide-react';
import { useKPIs, useKPIsByOffice, useKPIsByWeek, useKPIsByEmployee } from '../hooks/useKPIs';
import { useFilters } from '../contexts/FilterContext';
import { COLORS, ENTRY_TYPE_COLORS, THRESHOLDS, getFingerRateStatus } from '../constants/colors';
import SmartInsights from '../components/SmartInsights';
import AnimatedNumber from '../components/AnimatedNumber';
import Sparkline from '../components/Sparkline';
import DataQualityIndicator from '../components/DataQualityIndicator';
import { SkeletonKPICard, SkeletonChart, SkeletonInsights } from '../components/Skeleton';

// Glass morphism card wrapper with enhanced styling
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

// Pulse animation for live indicator
const PulseIndicator: React.FC = () => (
  <span className="relative flex h-2 w-2">
    <span
      className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
      style={{ background: COLORS.status.success }}
    />
    <span
      className="relative inline-flex rounded-full h-2 w-2"
      style={{ background: COLORS.status.success }}
    />
  </span>
);

// Circular progress indicator
const CircularProgress: React.FC<{ value: number; size?: number; strokeWidth?: number; color: string }> = ({
  value, size = 80, strokeWidth = 6, color
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={COLORS.background.tertiary}
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-1000 ease-out"
      />
    </svg>
  );
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { filters, updateFilter } = useFilters();
  const { kpis, loading: kpisLoading } = useKPIs(filters);
  const { officeKPIs, loading: officesLoading } = useKPIsByOffice(filters);
  const { weeklyKPIs, loading: weeklyLoading } = useKPIsByWeek(filters);
  const { employeeKPIs, loading: employeesLoading } = useKPIsByEmployee(filters);

  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Drill-down navigation handlers
  const handleOfficeClick = (officeName: string) => {
    updateFilter('xlc_operation', officeName);
    navigate('/office-analysis');
  };

  const handleWeekClick = (week: string) => {
    updateFilter('dt_end_cli_work_week', week);
    navigate('/trends');
  };

  const handleEmployeesClick = () => {
    navigate('/employees');
  };

  // Handle drill-through from SmartInsights
  const handleInsightDrillThrough = (path: string, params?: Record<string, string>) => {
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        updateFilter(key as keyof typeof filters, value);
      });
    }
    navigate(path);
  };

  useEffect(() => {
    if (!kpisLoading && kpis) {
      setLastUpdated(new Date());
    }
  }, [kpis, kpisLoading]);

  // Prepare data for entry type pie chart
  const entryTypeData = useMemo(() => {
    if (!kpis) return [];
    return [
      { name: 'Finger', value: kpis.finger_rate, color: ENTRY_TYPE_COLORS['Finger'] },
      { name: 'Provisional', value: kpis.provisional_rate, color: ENTRY_TYPE_COLORS['Provisional Entry'] },
      { name: 'Write-In', value: kpis.write_in_rate, color: ENTRY_TYPE_COLORS['Write-In'] },
      { name: 'Missing C/O', value: kpis.missing_co_rate, color: ENTRY_TYPE_COLORS['Missing c/o'] },
    ];
  }, [kpis]);

  // Prepare sorted office data
  const sortedOfficeData = useMemo(() => {
    if (!officeKPIs || officeKPIs.length === 0) return [];
    return [...officeKPIs]
      .sort((a, b) => b.finger_rate - a.finger_rate)
      .map(office => ({
        ...office,
        fill: getFingerRateStatus(office.finger_rate)
      }));
  }, [officeKPIs]);

  // Week-over-week change
  const weeklyChange = useMemo(() => {
    if (!weeklyKPIs || weeklyKPIs.length < 2) return null;
    const current = weeklyKPIs[weeklyKPIs.length - 1];
    const previous = weeklyKPIs[weeklyKPIs.length - 2];
    return {
      finger_rate: current.finger_rate - previous.finger_rate,
      total_entries: ((current.total_entries - previous.total_entries) / previous.total_entries) * 100,
    };
  }, [weeklyKPIs]);

  // Sparkline data
  const fingerTrendData = useMemo(() => {
    if (!weeklyKPIs) return [];
    return weeklyKPIs.map(w => w.finger_rate);
  }, [weeklyKPIs]);

  // Calculate alerts
  const alerts = useMemo(() => {
    if (!officeKPIs) return [];
    return officeKPIs
      .filter(o => o.finger_rate < THRESHOLDS.finger_rate.good)
      .sort((a, b) => a.finger_rate - b.finger_rate);
  }, [officeKPIs]);

  // Custom tooltip with drill-down hint
  const OfficeTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div
          className="p-3 rounded-lg shadow-xl backdrop-blur-md"
          style={{
            background: `${COLORS.background.elevated}f0`,
            border: `1px solid ${COLORS.border.default}`,
          }}
        >
          <p className="font-semibold mb-1 text-sm" style={{ color: COLORS.text.primary }}>{data.office}</p>
          <div className="space-y-0.5 text-xs">
            <p className="flex justify-between gap-4">
              <span style={{ color: COLORS.text.secondary }}>Finger Rate:</span>
              <span className="font-medium" style={{ color: getFingerRateStatus(data.finger_rate) }}>
                {data.finger_rate}%
              </span>
            </p>
            <p className="flex justify-between gap-4">
              <span style={{ color: COLORS.text.secondary }}>Entries:</span>
              <span style={{ color: COLORS.text.primary }}>{data.total_entries?.toLocaleString()}</span>
            </p>
          </div>
          <div
            className="mt-2 pt-2 flex items-center gap-1 text-xs"
            style={{ borderTop: `1px solid ${COLORS.border.subtle}`, color: COLORS.accent.primary }}
          >
            <ExternalLink size={10} />
            <span>Click to view details</span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Loading state
  if (kpisLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg animate-pulse" style={{ background: COLORS.background.tertiary }} />
            <div className="w-48 h-6 rounded animate-pulse" style={{ background: COLORS.background.tertiary }} />
          </div>
        </div>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-5"><SkeletonKPICard /></div>
          <div className="col-span-12 lg:col-span-7"><SkeletonChart height={200} /></div>
          <div className="col-span-6 lg:col-span-3"><SkeletonKPICard /></div>
          <div className="col-span-6 lg:col-span-3"><SkeletonKPICard /></div>
          <div className="col-span-6 lg:col-span-3"><SkeletonKPICard /></div>
          <div className="col-span-6 lg:col-span-3"><SkeletonKPICard /></div>
        </div>
      </div>
    );
  }

  if (!kpis) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p style={{ color: COLORS.text.secondary }}>No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-xl"
            style={{
              background: `linear-gradient(135deg, ${COLORS.accent.primary}30 0%, ${COLORS.accent.primary}10 100%)`,
              border: `1px solid ${COLORS.accent.primary}30`
            }}
          >
            <Activity size={20} style={{ color: COLORS.accent.primary }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: COLORS.text.primary }}>
              Executive Dashboard
            </h1>
            <p className="text-xs" style={{ color: COLORS.text.muted }}>
              BSTT Compliance Overview
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <DataQualityIndicator compact />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: `${COLORS.status.success}15` }}>
            <PulseIndicator />
            <span className="text-xs font-medium" style={{ color: COLORS.status.success }}>Live</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: COLORS.text.muted }}>
            <RefreshCw size={12} />
            <span>{lastUpdated.toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* Main Grid - Row 1: Hero Section */}
      <div className="grid grid-cols-12 gap-4">

        {/* Hero Card - Finger Rate with Circular Gauge */}
        <GlassCard
          className="col-span-12 lg:col-span-5"
          glow={getFingerRateStatus(kpis.finger_rate)}
        >
          <div className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Shield size={14} style={{ color: COLORS.text.muted }} />
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: COLORS.text.secondary }}>
                    Compliance Rate
                  </span>
                </div>
                <div className="flex items-baseline gap-3 mb-3">
                  <AnimatedNumber
                    value={kpis.finger_rate}
                    decimals={1}
                    suffix="%"
                    className="text-5xl font-bold tracking-tight"
                    style={{ color: getFingerRateStatus(kpis.finger_rate) }}
                  />
                  {weeklyChange && (
                    <span
                      className="flex items-center text-sm font-semibold px-2 py-1 rounded-lg"
                      style={{
                        background: weeklyChange.finger_rate >= 0 ? `${COLORS.status.success}20` : `${COLORS.status.danger}20`,
                        color: weeklyChange.finger_rate >= 0 ? COLORS.status.success : COLORS.status.danger,
                      }}
                    >
                      {weeklyChange.finger_rate >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      {Math.abs(weeklyChange.finger_rate).toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <Target size={12} style={{ color: COLORS.text.muted }} />
                    <span className="text-xs" style={{ color: COLORS.text.muted }}>
                      Target: <span style={{ color: COLORS.status.success }}>{THRESHOLDS.finger_rate.excellent}%</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Eye size={12} style={{ color: COLORS.text.muted }} />
                    <span className="text-xs" style={{ color: COLORS.text.muted }}>
                      Min: <span style={{ color: COLORS.status.warning }}>{THRESHOLDS.finger_rate.good}%</span>
                    </span>
                  </div>
                </div>
              </div>
              <div className="relative">
                <CircularProgress
                  value={kpis.finger_rate}
                  size={90}
                  strokeWidth={8}
                  color={getFingerRateStatus(kpis.finger_rate)}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Fingerprint size={28} style={{ color: getFingerRateStatus(kpis.finger_rate) }} />
                </div>
              </div>
            </div>

            {/* Mini Trend */}
            <div
              className="mt-4 pt-4 flex items-center justify-between"
              style={{ borderTop: `1px solid ${COLORS.border.subtle}` }}
            >
              <span className="text-xs" style={{ color: COLORS.text.muted }}>8-Week Trend</span>
              <Sparkline
                data={fingerTrendData}
                width={150}
                height={36}
                color={getFingerRateStatus(kpis.finger_rate)}
                showArea
                showDots
              />
            </div>
          </div>
        </GlassCard>

        {/* Smart Insights - Takes more space */}
        <div className="col-span-12 lg:col-span-7">
          <SmartInsights
            data={{ kpis, weeklyKPIs, officeKPIs, employeeKPIs }}
            maxInsights={4}
            onDrillThrough={handleInsightDrillThrough}
          />
        </div>
      </div>

      {/* Row 2: Entry Type KPIs - 4 equal cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Finger Entries */}
        <GlassCard glow={ENTRY_TYPE_COLORS['Finger']}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div
                className="p-2 rounded-lg"
                style={{ background: `${ENTRY_TYPE_COLORS['Finger']}20` }}
              >
                <Fingerprint size={16} style={{ color: ENTRY_TYPE_COLORS['Finger'] }} />
              </div>
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: `${COLORS.status.success}15`,
                  color: COLORS.status.success
                }}
              >
                Primary
              </span>
            </div>
            <p className="text-xs mb-1" style={{ color: COLORS.text.secondary }}>Finger Entries</p>
            <AnimatedNumber
              value={kpis.finger_rate}
              decimals={1}
              suffix="%"
              className="text-2xl font-bold"
              style={{ color: ENTRY_TYPE_COLORS['Finger'] }}
            />
            <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: COLORS.background.tertiary }}>
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${kpis.finger_rate}%`, background: ENTRY_TYPE_COLORS['Finger'] }}
              />
            </div>
          </div>
        </GlassCard>

        {/* Provisional */}
        <GlassCard glow={ENTRY_TYPE_COLORS['Provisional Entry']}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div
                className="p-2 rounded-lg"
                style={{ background: `${ENTRY_TYPE_COLORS['Provisional Entry']}20` }}
              >
                <AlertTriangle size={16} style={{ color: ENTRY_TYPE_COLORS['Provisional Entry'] }} />
              </div>
              <span className="text-xs" style={{ color: COLORS.text.muted }}>Max {THRESHOLDS.provisional_max}%</span>
            </div>
            <p className="text-xs mb-1" style={{ color: COLORS.text.secondary }}>Provisional</p>
            <AnimatedNumber
              value={kpis.provisional_rate}
              decimals={2}
              suffix="%"
              className="text-2xl font-bold"
              style={{ color: ENTRY_TYPE_COLORS['Provisional Entry'] }}
            />
            <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: COLORS.background.tertiary }}>
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${Math.min(kpis.provisional_rate * 20, 100)}%`, background: ENTRY_TYPE_COLORS['Provisional Entry'] }}
              />
            </div>
          </div>
        </GlassCard>

        {/* Write-In */}
        <GlassCard glow={ENTRY_TYPE_COLORS['Write-In']}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div
                className="p-2 rounded-lg"
                style={{ background: `${ENTRY_TYPE_COLORS['Write-In']}20` }}
              >
                <Zap size={16} style={{ color: ENTRY_TYPE_COLORS['Write-In'] }} />
              </div>
              <span className="text-xs" style={{ color: COLORS.text.muted }}>Max {THRESHOLDS.write_in_max}%</span>
            </div>
            <p className="text-xs mb-1" style={{ color: COLORS.text.secondary }}>Write-In</p>
            <AnimatedNumber
              value={kpis.write_in_rate}
              decimals={2}
              suffix="%"
              className="text-2xl font-bold"
              style={{ color: ENTRY_TYPE_COLORS['Write-In'] }}
            />
            <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: COLORS.background.tertiary }}>
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${Math.min(kpis.write_in_rate * 10, 100)}%`, background: ENTRY_TYPE_COLORS['Write-In'] }}
              />
            </div>
          </div>
        </GlassCard>

        {/* Missing C/O */}
        <GlassCard glow={ENTRY_TYPE_COLORS['Missing c/o']}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div
                className="p-2 rounded-lg"
                style={{ background: `${ENTRY_TYPE_COLORS['Missing c/o']}20` }}
              >
                <Clock size={16} style={{ color: ENTRY_TYPE_COLORS['Missing c/o'] }} />
              </div>
              <span className="text-xs" style={{ color: COLORS.text.muted }}>Max {THRESHOLDS.missing_co_max}%</span>
            </div>
            <p className="text-xs mb-1" style={{ color: COLORS.text.secondary }}>Missing C/O</p>
            <AnimatedNumber
              value={kpis.missing_co_rate}
              decimals={2}
              suffix="%"
              className="text-2xl font-bold"
              style={{ color: ENTRY_TYPE_COLORS['Missing c/o'] }}
            />
            <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: COLORS.background.tertiary }}>
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${Math.min(kpis.missing_co_rate * 20, 100)}%`, background: ENTRY_TYPE_COLORS['Missing c/o'] }}
              />
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Row 3: Charts */}
      <div className="grid grid-cols-12 gap-4">
        {/* Office Performance Chart */}
        <GlassCard className="col-span-12 lg:col-span-8">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Building2 size={16} style={{ color: COLORS.accent.primary }} />
                <h3 className="text-sm font-semibold" style={{ color: COLORS.text.primary }}>
                  Office Performance Ranking
                </h3>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: COLORS.status.success }} />
                  <span style={{ color: COLORS.text.muted }}>≥95%</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: COLORS.status.warning }} />
                  <span style={{ color: COLORS.text.muted }}>90-95%</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: COLORS.status.danger }} />
                  <span style={{ color: COLORS.text.muted }}>&lt;90%</span>
                </span>
              </div>
            </div>

            {officesLoading ? (
              <div className="flex items-center justify-center h-[200px]">
                <RefreshCw size={24} className="animate-spin" style={{ color: COLORS.text.muted }} />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={sortedOfficeData}
                  layout="vertical"
                  margin={{ left: 10, right: 20 }}
                  onClick={(data: any) => {
                    if (data && data.activePayload && data.activePayload[0]) {
                      handleOfficeClick(data.activePayload[0].payload.office);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke={COLORS.chart.grid} />
                  <XAxis
                    type="number"
                    domain={[(dataMin: number) => Math.floor(Math.min(dataMin, 75) / 5) * 5, 100]}
                    tick={{ fontSize: 10, fill: COLORS.text.muted }}
                  />
                  <YAxis
                    dataKey="office"
                    type="category"
                    width={90}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: COLORS.text.secondary }}
                  />
                  <Tooltip content={<OfficeTooltip />} />
                  <ReferenceLine x={95} stroke={COLORS.status.success} strokeDasharray="4 4" strokeWidth={1.5} />
                  <ReferenceLine x={90} stroke={COLORS.status.warning} strokeDasharray="4 4" strokeWidth={1.5} />
                  <Bar dataKey="finger_rate" radius={[0, 6, 6, 0]} maxBarSize={24} style={{ cursor: 'pointer' }}>
                    {sortedOfficeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </GlassCard>

        {/* Entry Distribution Pie */}
        <GlassCard className="col-span-12 lg:col-span-4">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Hash size={16} style={{ color: COLORS.accent.primary }} />
              <h3 className="text-sm font-semibold" style={{ color: COLORS.text.primary }}>
                Entry Distribution
              </h3>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={entryTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {entryTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: COLORS.background.elevated,
                    border: `1px solid ${COLORS.border.default}`,
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                  formatter={(value: number) => `${value.toFixed(2)}%`}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {entryTypeData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
                  <span className="text-xs truncate" style={{ color: COLORS.text.muted }}>{entry.name}</span>
                  <span className="text-xs font-medium ml-auto" style={{ color: entry.color }}>
                    {entry.value.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Row 4: Trend & Stats */}
      <div className="grid grid-cols-12 gap-4">
        {/* Weekly Trend */}
        <GlassCard className="col-span-12 lg:col-span-7">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} style={{ color: COLORS.accent.primary }} />
                <h3 className="text-sm font-semibold" style={{ color: COLORS.text.primary }}>
                  Weekly Compliance Trend
                </h3>
                {/* ISO Week Info Tooltip */}
                <div className="relative group">
                  <Info
                    size={14}
                    className="cursor-help"
                    style={{ color: COLORS.text.muted }}
                  />
                  <div
                    className="absolute left-0 top-6 z-50 w-64 p-3 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200"
                    style={{
                      background: COLORS.background.elevated,
                      border: `1px solid ${COLORS.border.default}`,
                    }}
                  >
                    <p className="text-xs font-semibold mb-1" style={{ color: COLORS.text.primary }}>
                      ISO Week Alignment
                    </p>
                    <p className="text-xs" style={{ color: COLORS.text.secondary }}>
                      Weekly data uses ISO week numbers to align offices with different week endings:
                    </p>
                    <ul className="text-xs mt-1 space-y-0.5" style={{ color: COLORS.text.muted }}>
                      <li>• Martinsburg: Saturday endings</li>
                      <li>• Other offices: Sunday endings</li>
                    </ul>
                    <p className="text-xs mt-1" style={{ color: COLORS.text.secondary }}>
                      Both align to the same ISO week for accurate cross-office comparison.
                    </p>
                  </div>
                </div>
              </div>
              {weeklyChange && (
                <span
                  className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg"
                  style={{
                    background: weeklyChange.finger_rate >= 0 ? `${COLORS.status.success}15` : `${COLORS.status.danger}15`,
                    color: weeklyChange.finger_rate >= 0 ? COLORS.status.success : COLORS.status.danger,
                  }}
                >
                  {weeklyChange.finger_rate >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {weeklyChange.finger_rate >= 0 ? '+' : ''}{weeklyChange.finger_rate.toFixed(1)}% WoW
                </span>
              )}
            </div>
            {weeklyLoading ? (
              <div className="flex items-center justify-center h-[180px]">
                <RefreshCw size={24} className="animate-spin" style={{ color: COLORS.text.muted }} />
              </div>
            ) : weeklyKPIs && weeklyKPIs.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart
                  data={weeklyKPIs.slice(-10)}
                  margin={{ left: 0, right: 10, top: 10, bottom: 0 }}
                  onClick={(data: any) => {
                    if (data && data.activePayload && data.activePayload[0]) {
                      handleWeekClick(data.activePayload[0].payload.week);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <defs>
                    <linearGradient id="fingerGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.accent.primary} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={COLORS.accent.primary} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.chart.grid} />
                  <XAxis
                    dataKey="week_display"
                    tick={{ fontSize: 10, fill: COLORS.text.muted }}
                    tickFormatter={(value) => {
                      // Add T12:00:00 to avoid UTC-to-local timezone shift
                      const date = new Date(value + 'T12:00:00');
                      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }}
                  />
                  <YAxis domain={[85, 100]} tick={{ fontSize: 10, fill: COLORS.text.muted }} />
                  <Tooltip
                    contentStyle={{
                      background: COLORS.background.elevated,
                      border: `1px solid ${COLORS.border.default}`,
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                    formatter={(value: number) => [`${value}%`, 'Finger Rate']}
                    labelFormatter={(label) => {
                      // Add T12:00:00 to avoid UTC-to-local timezone shift
                      const date = new Date(label + 'T12:00:00');
                      return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - Click to view`;
                    }}
                  />
                  <ReferenceLine y={95} stroke={COLORS.status.success} strokeDasharray="4 4" />
                  <Area
                    type="monotone"
                    dataKey="finger_rate"
                    stroke={COLORS.accent.primary}
                    strokeWidth={2.5}
                    fill="url(#fingerGradient)"
                    dot={{ fill: COLORS.accent.primary, r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: COLORS.accent.primary, strokeWidth: 2, stroke: '#fff', cursor: 'pointer' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[180px] text-sm" style={{ color: COLORS.text.muted }}>
                No trend data available
              </div>
            )}
          </div>
        </GlassCard>

        {/* Volume Stats */}
        <GlassCard className="col-span-12 lg:col-span-5">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={16} style={{ color: COLORS.accent.primary }} />
              <h3 className="text-sm font-semibold" style={{ color: COLORS.text.primary }}>
                Period Statistics
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div
                className="p-3 rounded-xl text-center cursor-pointer transition-all duration-200 hover:scale-105"
                style={{ background: `linear-gradient(135deg, ${COLORS.accent.primary}15 0%, transparent 100%)` }}
                onClick={handleEmployeesClick}
                title="View Employee Analysis"
              >
                <Users size={18} className="mx-auto mb-2" style={{ color: COLORS.accent.primary }} />
                <AnimatedNumber
                  value={kpis.unique_employees}
                  className="text-2xl font-bold block"
                  style={{ color: COLORS.text.primary }}
                />
                <p className="text-xs" style={{ color: COLORS.text.muted }}>Employees</p>
              </div>
              <div
                className="p-3 rounded-xl text-center cursor-pointer transition-all duration-200 hover:scale-105"
                style={{ background: `linear-gradient(135deg, ${COLORS.accent.secondary}15 0%, transparent 100%)` }}
                onClick={() => navigate('/data-explorer')}
                title="View Data Explorer"
              >
                <Hash size={18} className="mx-auto mb-2" style={{ color: COLORS.accent.secondary }} />
                <AnimatedNumber
                  value={kpis.total_entries}
                  className="text-2xl font-bold block"
                  style={{ color: COLORS.text.primary }}
                />
                <p className="text-xs" style={{ color: COLORS.text.muted }}>Total Entries</p>
              </div>
              <div
                className="p-3 rounded-xl text-center cursor-pointer transition-all duration-200 hover:scale-105"
                style={{ background: `linear-gradient(135deg, ${COLORS.status.info}15 0%, transparent 100%)` }}
                onClick={() => navigate('/office-analysis')}
                title="View Office Analysis"
              >
                <Building2 size={18} className="mx-auto mb-2" style={{ color: COLORS.status.info }} />
                <AnimatedNumber
                  value={kpis.unique_offices}
                  className="text-2xl font-bold block"
                  style={{ color: COLORS.text.primary }}
                />
                <p className="text-xs" style={{ color: COLORS.text.muted }}>Offices</p>
              </div>
              <div
                className="p-3 rounded-xl text-center cursor-pointer transition-all duration-200 hover:scale-105"
                style={{ background: `linear-gradient(135deg, ${COLORS.status.success}15 0%, transparent 100%)` }}
                onClick={() => navigate('/trends')}
                title="View Weekly Trends"
              >
                <Calendar size={18} className="mx-auto mb-2" style={{ color: COLORS.status.success }} />
                <AnimatedNumber
                  value={kpis.unique_weeks}
                  className="text-2xl font-bold block"
                  style={{ color: COLORS.text.primary }}
                />
                <p className="text-xs" style={{ color: COLORS.text.muted }}>Weeks</p>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Row 5: Alerts (if any) */}
      {alerts.length > 0 && (
        <GlassCard
          gradient={`linear-gradient(135deg, ${COLORS.status.danger}10 0%, ${COLORS.background.secondary}95 100%)`}
        >
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} style={{ color: COLORS.status.danger }} />
              <span className="text-sm font-semibold" style={{ color: COLORS.status.danger }}>
                Attention Required: {alerts.length} Office{alerts.length > 1 ? 's' : ''} Below 90% Target
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {alerts.map((alert, i) => (
                <button
                  key={i}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 hover:scale-105"
                  style={{
                    background: `${COLORS.status.danger}15`,
                    border: `1px solid ${COLORS.status.danger}30`,
                  }}
                  onClick={() => handleOfficeClick(alert.office)}
                  title={`View ${alert.office} details`}
                >
                  <Building2 size={12} style={{ color: COLORS.status.danger }} />
                  <span className="text-xs font-medium" style={{ color: COLORS.text.primary }}>
                    {alert.office}
                  </span>
                  <span
                    className="text-xs font-bold px-1.5 py-0.5 rounded"
                    style={{ background: COLORS.status.danger, color: '#fff' }}
                  >
                    {alert.finger_rate}%
                  </span>
                  <ExternalLink size={10} style={{ color: COLORS.status.danger }} />
                </button>
              ))}
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
};

export default Dashboard;
