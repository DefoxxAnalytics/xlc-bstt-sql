import React, { useMemo } from 'react';
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  Lightbulb, ArrowRight, Sparkles, AlertCircle
} from 'lucide-react';
import { COLORS, THRESHOLDS } from '../constants/colors';

interface InsightData {
  kpis: any;
  weeklyKPIs?: any[];
  officeKPIs?: any[];
  employeeKPIs?: any[];
}

interface Insight {
  id: string;
  type: 'success' | 'warning' | 'danger' | 'info';
  icon: React.ReactNode;
  title: string;
  description: string;
  metric?: string;
  action?: string;
  drillThrough?: string; // Navigation path for drill-through
  drillThroughParams?: Record<string, string>; // Optional filter params
}

interface SmartInsightsProps {
  data: InsightData;
  maxInsights?: number;
  onDrillThrough?: (path: string, params?: Record<string, string>) => void;
}

const SmartInsights: React.FC<SmartInsightsProps> = ({ data, maxInsights = 4, onDrillThrough }) => {
  const insights = useMemo(() => {
    const allInsights: Insight[] = [];
    const { kpis, weeklyKPIs, officeKPIs, employeeKPIs } = data;

    if (!kpis) return [];

    // 1. Finger rate status
    if (kpis.finger_rate >= THRESHOLDS.finger_rate.excellent) {
      allInsights.push({
        id: 'finger-excellent',
        type: 'success',
        icon: <CheckCircle size={16} />,
        title: 'Excellent Compliance',
        description: `Finger rate at ${kpis.finger_rate}% exceeds ${THRESHOLDS.finger_rate.excellent}% target`,
        metric: `${kpis.finger_rate}%`,
        drillThrough: '/office-analysis',
      });
    } else if (kpis.finger_rate < THRESHOLDS.finger_rate.good) {
      allInsights.push({
        id: 'finger-critical',
        type: 'danger',
        icon: <AlertCircle size={16} />,
        title: 'Critical: Low Finger Rate',
        description: `Finger rate at ${kpis.finger_rate}% is below minimum ${THRESHOLDS.finger_rate.good}% threshold`,
        metric: `${kpis.finger_rate}%`,
        action: 'Review non-compliant offices',
        drillThrough: '/office-analysis',
      });
    }

    // 2. Week-over-week trend
    if (weeklyKPIs && weeklyKPIs.length >= 2) {
      const lastWeek = weeklyKPIs[weeklyKPIs.length - 1];
      const prevWeek = weeklyKPIs[weeklyKPIs.length - 2];
      const change = lastWeek.finger_rate - prevWeek.finger_rate;

      if (change > 1) {
        allInsights.push({
          id: 'wow-improvement',
          type: 'success',
          icon: <TrendingUp size={16} />,
          title: 'Week-over-Week Improvement',
          description: `Finger rate improved by ${change.toFixed(1)} points this week`,
          metric: `+${change.toFixed(1)}%`,
          drillThrough: '/trends',
        });
      } else if (change < -1) {
        allInsights.push({
          id: 'wow-decline',
          type: 'warning',
          icon: <TrendingDown size={16} />,
          title: 'Week-over-Week Decline',
          description: `Finger rate dropped by ${Math.abs(change).toFixed(1)} points this week`,
          metric: `${change.toFixed(1)}%`,
          action: 'Investigate recent changes',
          drillThrough: '/trends',
        });
      }
    }

    // 3. Office performance gaps
    if (officeKPIs && officeKPIs.length > 1) {
      const sorted = [...officeKPIs].sort((a, b) => b.finger_rate - a.finger_rate);
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      const gap = best.finger_rate - worst.finger_rate;

      if (gap > 5) {
        allInsights.push({
          id: 'office-gap',
          type: 'warning',
          icon: <AlertTriangle size={16} />,
          title: 'Large Office Performance Gap',
          description: `${gap.toFixed(1)} point gap between ${best.office} (${best.finger_rate}%) and ${worst.office} (${worst.finger_rate}%)`,
          metric: `${gap.toFixed(1)}pt gap`,
          action: `Focus on ${worst.office}`,
          drillThrough: '/office-analysis',
          drillThroughParams: { xlc_operation: worst.office },
        });
      }

      // Offices below target
      const belowTarget = officeKPIs.filter(o => o.finger_rate < THRESHOLDS.finger_rate.good);
      if (belowTarget.length > 0) {
        allInsights.push({
          id: 'offices-below',
          type: 'danger',
          icon: <AlertCircle size={16} />,
          title: `${belowTarget.length} Office${belowTarget.length > 1 ? 's' : ''} Below Target`,
          description: `${belowTarget.map(o => o.office).join(', ')} need${belowTarget.length === 1 ? 's' : ''} attention`,
          metric: `${belowTarget.length} offices`,
          action: 'View Office Analysis',
          drillThrough: '/office-analysis',
        });
      }
    }

    // 4. Employee enrollment needed
    if (employeeKPIs) {
      const needsEnrollment = employeeKPIs.filter(e => e.provisional_count >= 3);
      if (needsEnrollment.length > 0) {
        allInsights.push({
          id: 'enrollment-needed',
          type: 'warning',
          icon: <AlertTriangle size={16} />,
          title: 'Fingerprint Enrollment Needed',
          description: `${needsEnrollment.length} employee${needsEnrollment.length > 1 ? 's' : ''} with 3+ provisional entries`,
          metric: `${needsEnrollment.length} employees`,
          action: 'View Enrollment List',
          drillThrough: '/employees',
        });
      }
    }

    // 5. Provisional rate check
    if (kpis.provisional_rate > THRESHOLDS.provisional_max * 2) {
      allInsights.push({
        id: 'provisional-high',
        type: 'warning',
        icon: <AlertTriangle size={16} />,
        title: 'High Provisional Rate',
        description: `Provisional entries at ${kpis.provisional_rate.toFixed(2)}% - check biometric equipment`,
        metric: `${kpis.provisional_rate.toFixed(2)}%`,
        drillThrough: '/employees',
      });
    }

    // 6. Write-in rate check
    if (kpis.write_in_rate > THRESHOLDS.write_in_max) {
      allInsights.push({
        id: 'write-in-high',
        type: 'info',
        icon: <Lightbulb size={16} />,
        title: 'Elevated Write-In Rate',
        description: `Manual entries at ${kpis.write_in_rate.toFixed(2)}% - review approval process`,
        metric: `${kpis.write_in_rate.toFixed(2)}%`,
        drillThrough: '/data-explorer',
      });
    }

    // 7. Volume insights
    if (kpis.total_entries > 0) {
      const avgEntriesPerEmployee = kpis.entries_per_employee || (kpis.total_entries / kpis.unique_employees);
      if (avgEntriesPerEmployee > 50) {
        allInsights.push({
          id: 'high-volume',
          type: 'info',
          icon: <Sparkles size={16} />,
          title: 'High Activity Period',
          description: `${avgEntriesPerEmployee.toFixed(0)} entries per employee on average`,
          metric: `${avgEntriesPerEmployee.toFixed(0)} avg`,
          drillThrough: '/data-explorer',
        });
      }
    }

    // Sort by priority: danger > warning > info > success
    const priority = { danger: 0, warning: 1, info: 2, success: 3 };
    return allInsights.sort((a, b) => priority[a.type] - priority[b.type]).slice(0, maxInsights);
  }, [data, maxInsights]);

  const getTypeStyles = (type: Insight['type']) => {
    switch (type) {
      case 'success':
        return {
          bg: `${COLORS.status.success}15`,
          border: `${COLORS.status.success}40`,
          icon: COLORS.status.success,
        };
      case 'warning':
        return {
          bg: `${COLORS.status.warning}15`,
          border: `${COLORS.status.warning}40`,
          icon: COLORS.status.warning,
        };
      case 'danger':
        return {
          bg: `${COLORS.status.danger}15`,
          border: `${COLORS.status.danger}40`,
          icon: COLORS.status.danger,
        };
      case 'info':
      default:
        return {
          bg: `${COLORS.accent.primary}15`,
          border: `${COLORS.accent.primary}40`,
          icon: COLORS.accent.primary,
        };
    }
  };

  if (insights.length === 0) {
    return null;
  }

  return (
    <div
      className="rounded-lg p-3 backdrop-blur-sm"
      style={{
        background: `linear-gradient(135deg, ${COLORS.background.secondary}80 0%, ${COLORS.background.tertiary}80 100%)`,
        border: `1px solid ${COLORS.border.subtle}`,
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className="p-1.5 rounded-md"
          style={{ background: `${COLORS.accent.primary}20` }}
        >
          <Sparkles size={14} style={{ color: COLORS.accent.primary }} />
        </div>
        <h3 className="text-sm font-semibold" style={{ color: COLORS.text.primary }}>
          Smart Insights
        </h3>
        <span
          className="ml-auto text-xs px-2 py-0.5 rounded-full"
          style={{
            background: COLORS.background.tertiary,
            color: COLORS.text.muted,
          }}
        >
          {insights.length} insights
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {insights.map((insight) => {
          const styles = getTypeStyles(insight.type);
          const isClickable = !!insight.drillThrough && !!onDrillThrough;
          return (
            <div
              key={insight.id}
              className={`p-2.5 rounded-md transition-all duration-200 group ${
                isClickable ? 'hover:scale-[1.01] cursor-pointer' : ''
              }`}
              style={{
                background: styles.bg,
                border: `1px solid ${styles.border}`,
              }}
              onClick={() => {
                if (isClickable) {
                  onDrillThrough(insight.drillThrough!, insight.drillThroughParams);
                }
              }}
              role={isClickable ? 'button' : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onKeyDown={(e) => {
                if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onDrillThrough(insight.drillThrough!, insight.drillThroughParams);
                }
              }}
            >
              <div className="flex items-start gap-2">
                <span style={{ color: styles.icon }} className="mt-0.5 flex-shrink-0">
                  {insight.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4
                      className="text-xs font-semibold truncate"
                      style={{ color: COLORS.text.primary }}
                    >
                      {insight.title}
                    </h4>
                    {insight.metric && (
                      <span
                        className="text-xs font-bold flex-shrink-0"
                        style={{ color: styles.icon }}
                      >
                        {insight.metric}
                      </span>
                    )}
                  </div>
                  <p
                    className="text-xs mt-0.5 line-clamp-2"
                    style={{ color: COLORS.text.secondary }}
                  >
                    {insight.description}
                  </p>
                  {insight.action && isClickable && (
                    <div
                      className="flex items-center gap-1 mt-1.5 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: styles.icon }}
                    >
                      {insight.action}
                      <ArrowRight size={10} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SmartInsights;
