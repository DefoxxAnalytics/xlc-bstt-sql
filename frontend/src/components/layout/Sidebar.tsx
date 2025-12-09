import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  FileType,
  Users,
  TrendingUp,
  Timer,
  Database,
  ChevronLeft,
  ChevronRight,
  Fingerprint,
  Settings,
  ExternalLink,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { COLORS } from '../../constants/colors';
import { getAdminUrl } from '../../api/client';
import xlcLogo from '../../assets/xlc_logo.png';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const navItems: NavItem[] = [
  { path: '/', label: 'Executive Dashboard', icon: <LayoutDashboard size={20} />, description: 'Overview & KPIs' },
  { path: '/office-analysis', label: 'Office Analysis', icon: <Building2 size={20} />, description: 'Site performance' },
  { path: '/entry-types', label: 'Entry Type Analysis', icon: <FileType size={20} />, description: 'Entry breakdown' },
  { path: '/employees', label: 'Employee Analysis', icon: <Users size={20} />, description: 'Staff compliance' },
  { path: '/trends', label: 'Weekly Trends', icon: <TrendingUp size={20} />, description: 'Historical data' },
  { path: '/clock-behavior', label: 'Clock Behavior', icon: <Timer size={20} />, description: 'Clock attempts' },
  { path: '/data-explorer', label: 'Data Explorer', icon: <Database size={20} />, description: 'Browse records' },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed = false, onToggle }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const location = useLocation();

  const showExpanded = !collapsed || isHovered;

  return (
    <aside
      className="fixed left-0 top-0 h-screen z-40 transition-all duration-300 ease-in-out"
      style={{
        width: showExpanded ? '260px' : '72px',
        background: `linear-gradient(180deg, ${COLORS.background.secondary}f8 0%, ${COLORS.background.primary}f8 100%)`,
        borderRight: `1px solid ${COLORS.border.subtle}`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Subtle gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(135deg, ${COLORS.accent.primary}05 0%, transparent 50%, ${COLORS.accent.secondary}05 100%)`,
        }}
      />

      {/* Logo Section */}
      <div
        className="relative flex items-center gap-3 px-4 py-5 border-b"
        style={{ borderColor: COLORS.border.subtle }}
      >
        <div
          className="relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300"
          style={{
            background: `linear-gradient(135deg, ${COLORS.accent.primary} 0%, ${COLORS.accent.secondary} 100%)`,
            boxShadow: `0 4px 20px ${COLORS.accent.primary}50, 0 0 40px ${COLORS.accent.primary}20`,
          }}
        >
          <Fingerprint size={22} color={COLORS.text.inverse} strokeWidth={2.5} />
          {/* Pulse animation ring */}
          <div
            className="absolute inset-0 rounded-xl animate-ping"
            style={{
              background: `linear-gradient(135deg, ${COLORS.accent.primary} 0%, ${COLORS.accent.secondary} 100%)`,
              opacity: 0.2,
              animationDuration: '3s',
            }}
          />
        </div>
        {showExpanded && (
          <div className="overflow-hidden whitespace-nowrap">
            <div className="flex items-center gap-1.5">
              <h1
                className="text-lg font-bold tracking-tight"
                style={{ color: COLORS.text.primary }}
              >
                BSTT
              </h1>
              <Sparkles size={14} style={{ color: COLORS.accent.primary }} />
            </div>
            <p
              className="text-xs tracking-wide"
              style={{ color: COLORS.text.muted }}
            >
              Compliance Dashboard
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="relative py-4 px-3 flex-1">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const isItemHovered = hoveredItem === item.path;

            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group overflow-hidden"
                  style={{
                    background: isActive
                      ? `linear-gradient(90deg, ${COLORS.accent.primary}25 0%, ${COLORS.accent.primary}10 50%, transparent 100%)`
                      : isItemHovered
                      ? `linear-gradient(90deg, ${COLORS.background.tertiary}80 0%, transparent 100%)`
                      : 'transparent',
                    color: isActive ? COLORS.text.primary : COLORS.text.secondary,
                  }}
                  onMouseEnter={() => setHoveredItem(item.path)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  {/* Active indicator bar */}
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full transition-all duration-300"
                    style={{
                      height: isActive ? '60%' : '0%',
                      background: `linear-gradient(180deg, ${COLORS.accent.primary} 0%, ${COLORS.accent.secondary} 100%)`,
                      boxShadow: isActive ? `0 0 10px ${COLORS.accent.primary}80` : 'none',
                    }}
                  />

                  {/* Icon container with glow */}
                  <span
                    className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200"
                    style={{
                      background: isActive
                        ? `linear-gradient(135deg, ${COLORS.accent.primary}30 0%, ${COLORS.accent.secondary}20 100%)`
                        : isItemHovered
                        ? `${COLORS.background.tertiary}80`
                        : 'transparent',
                      color: isActive ? COLORS.accent.primary : 'inherit',
                      boxShadow: isActive ? `0 0 15px ${COLORS.accent.primary}30` : 'none',
                    }}
                  >
                    {item.icon}
                  </span>

                  {showExpanded && (
                    <div className="flex-1 min-w-0">
                      <span
                        className="block text-sm font-medium whitespace-nowrap overflow-hidden"
                        style={{
                          color: isActive ? COLORS.text.primary : COLORS.text.secondary,
                        }}
                      >
                        {item.label}
                      </span>
                      <span
                        className="block text-[10px] whitespace-nowrap overflow-hidden transition-all duration-200"
                        style={{
                          color: COLORS.text.muted,
                          opacity: isActive || isItemHovered ? 1 : 0,
                          maxHeight: isActive || isItemHovered ? '20px' : '0px',
                        }}
                      >
                        {item.description}
                      </span>
                    </div>
                  )}

                  {/* Hover shimmer effect */}
                  {isItemHovered && !isActive && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: `linear-gradient(90deg, transparent 0%, ${COLORS.text.primary}05 50%, transparent 100%)`,
                        animation: 'shimmer 1.5s infinite',
                      }}
                    />
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>

        {/* Admin Section */}
        <div
          className="mt-6 pt-4 border-t"
          style={{ borderColor: COLORS.border.subtle }}
        >
          {showExpanded && (
            <p
              className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest flex items-center gap-2"
              style={{ color: COLORS.text.muted }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: COLORS.status.warning }}
              />
              Admin Only
            </p>
          )}
          {/* Admin Panel Link */}
          <a
            href={getAdminUrl('/')}
            target="_blank"
            rel="noopener noreferrer"
            className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group overflow-hidden"
            style={{
              color: COLORS.text.secondary,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `linear-gradient(90deg, ${COLORS.status.warning}20 0%, ${COLORS.status.warning}05 50%, transparent 100%)`;
              const icon = e.currentTarget.querySelector('.admin-icon') as HTMLElement;
              if (icon) icon.style.background = `${COLORS.status.warning}25`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              const icon = e.currentTarget.querySelector('.admin-icon') as HTMLElement;
              if (icon) icon.style.background = 'transparent';
            }}
          >
            <span
              className="admin-icon flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200"
            >
              <Settings size={20} />
            </span>
            {showExpanded && (
              <>
                <span className="text-sm font-medium whitespace-nowrap overflow-hidden flex-1">
                  Admin Panel
                </span>
                <ExternalLink size={14} style={{ color: COLORS.text.muted }} />
              </>
            )}
          </a>

          {/* Upload Data Link */}
          <a
            href={getAdminUrl('/core/dataupload/add/')}
            target="_blank"
            rel="noopener noreferrer"
            className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group overflow-hidden"
            style={{
              color: COLORS.text.secondary,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `linear-gradient(90deg, ${COLORS.status.success}20 0%, ${COLORS.status.success}05 50%, transparent 100%)`;
              const icon = e.currentTarget.querySelector('.upload-icon') as HTMLElement;
              if (icon) icon.style.background = `${COLORS.status.success}25`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              const icon = e.currentTarget.querySelector('.upload-icon') as HTMLElement;
              if (icon) icon.style.background = 'transparent';
            }}
          >
            <span
              className="upload-icon flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200"
            >
              <Upload size={20} />
            </span>
            {showExpanded && (
              <>
                <span className="text-sm font-medium whitespace-nowrap overflow-hidden flex-1">
                  Upload Data
                </span>
                <ExternalLink size={14} style={{ color: COLORS.text.muted }} />
              </>
            )}
          </a>

          {/* Database Management Link */}
          <a
            href={getAdminUrl('/database-management/')}
            target="_blank"
            rel="noopener noreferrer"
            className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group overflow-hidden"
            style={{
              color: COLORS.text.secondary,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `linear-gradient(90deg, ${COLORS.status.danger}20 0%, ${COLORS.status.danger}05 50%, transparent 100%)`;
              const icon = e.currentTarget.querySelector('.db-icon') as HTMLElement;
              if (icon) icon.style.background = `${COLORS.status.danger}25`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              const icon = e.currentTarget.querySelector('.db-icon') as HTMLElement;
              if (icon) icon.style.background = 'transparent';
            }}
          >
            <span
              className="db-icon flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200"
            >
              <Trash2 size={20} />
            </span>
            {showExpanded && (
              <>
                <span className="text-sm font-medium whitespace-nowrap overflow-hidden flex-1">
                  Database Mgmt
                </span>
                <ExternalLink size={14} style={{ color: COLORS.text.muted }} />
              </>
            )}
          </a>
        </div>
      </nav>

      {/* Powered by XLC Services Footer */}
      <div
        className="relative px-4 py-3 border-t"
        style={{ borderColor: COLORS.border.subtle }}
      >
        {showExpanded ? (
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] tracking-wide"
              style={{ color: COLORS.text.muted }}
            >
              Powered by
            </span>
            <img
              src={xlcLogo}
              alt="XLC Services"
              className="h-5 w-auto"
              style={{ filter: 'brightness(0) invert(1)' }}
            />
          </div>
        ) : (
          <div className="flex justify-center">
            <img
              src={xlcLogo}
              alt="XLC"
              className="h-4 w-auto opacity-60"
              style={{ filter: 'brightness(0) invert(1)' }}
            />
          </div>
        )}
      </div>

      {/* Collapse Toggle */}
      {onToggle && (
        <button
          onClick={onToggle}
          className="absolute bottom-16 right-0 translate-x-1/2 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 group"
          style={{
            background: `linear-gradient(135deg, ${COLORS.background.elevated} 0%, ${COLORS.background.tertiary} 100%)`,
            border: `1px solid ${COLORS.border.default}`,
            color: COLORS.text.secondary,
            boxShadow: `0 2px 10px ${COLORS.background.primary}80`,
          }}
        >
          <span
            className="transition-all duration-200 group-hover:text-white"
            style={{ color: COLORS.text.muted }}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </span>
        </button>
      )}

      {/* Bottom Glow Effect - Enhanced */}
      <div
        className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% 100%, ${COLORS.accent.primary}15 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 30% 100%, ${COLORS.accent.secondary}10 0%, transparent 50%)
          `,
        }}
      />

      {/* Top subtle glow */}
      <div
        className="absolute top-0 left-0 right-0 h-20 pointer-events-none"
        style={{
          background: `linear-gradient(180deg, ${COLORS.accent.primary}08 0%, transparent 100%)`,
        }}
      />

      {/* Shimmer animation styles */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </aside>
  );
};

export default Sidebar;
