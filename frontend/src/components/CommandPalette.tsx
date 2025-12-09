import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Command, LayoutDashboard, Building2, FileType,
  Users, TrendingUp, Database, Download, Calendar, RefreshCw,
  ArrowRight, X, GitCompare
} from 'lucide-react';
import { COLORS } from '../constants/colors';
import { useFilters } from '../contexts/FilterContext';
import { downloadFullReport } from '../api/client';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  category: 'navigation' | 'action' | 'filter';
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenComparison?: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onOpenComparison }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { filters, updateFilter, clearFilters, filterOptions } = useFilters();

  const commands: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [
      // Navigation
      {
        id: 'nav-dashboard',
        label: 'Go to Dashboard',
        description: 'Executive overview',
        icon: <LayoutDashboard size={16} />,
        category: 'navigation',
        action: () => { navigate('/'); onClose(); },
        keywords: ['home', 'main', 'overview', 'executive'],
      },
      {
        id: 'nav-office',
        label: 'Go to Office Analysis',
        description: 'Compare office performance',
        icon: <Building2 size={16} />,
        category: 'navigation',
        action: () => { navigate('/office-analysis'); onClose(); },
        keywords: ['site', 'location', 'compare'],
      },
      {
        id: 'nav-entry-types',
        label: 'Go to Entry Type Analysis',
        description: 'Finger, provisional, write-in breakdown',
        icon: <FileType size={16} />,
        category: 'navigation',
        action: () => { navigate('/entry-types'); onClose(); },
        keywords: ['finger', 'provisional', 'write-in', 'types'],
      },
      {
        id: 'nav-employees',
        label: 'Go to Employee Analysis',
        description: 'Individual compliance tracking',
        icon: <Users size={16} />,
        category: 'navigation',
        action: () => { navigate('/employees'); onClose(); },
        keywords: ['staff', 'people', 'workers', 'enrollment'],
      },
      {
        id: 'nav-trends',
        label: 'Go to Weekly Trends',
        description: 'Historical analysis',
        icon: <TrendingUp size={16} />,
        category: 'navigation',
        action: () => { navigate('/trends'); onClose(); },
        keywords: ['weekly', 'history', 'time', 'chart'],
      },
      {
        id: 'nav-explorer',
        label: 'Go to Data Explorer',
        description: 'Browse raw data',
        icon: <Database size={16} />,
        category: 'navigation',
        action: () => { navigate('/data-explorer'); onClose(); },
        keywords: ['data', 'table', 'browse', 'search', 'export'],
      },

      // Actions
      {
        id: 'action-export',
        label: 'Export Full Report',
        description: 'Download Excel report',
        icon: <Download size={16} />,
        category: 'action',
        action: () => {
          // Trigger download with current filters
          const link = document.createElement('a');
          link.href = downloadFullReport(filters);
          link.download = 'BSTT-Report.xlsx';
          link.click();
          onClose();
        },
        keywords: ['download', 'excel', 'report'],
      },
      {
        id: 'action-reset',
        label: 'Reset All Filters',
        description: 'Clear all active filters',
        icon: <RefreshCw size={16} />,
        category: 'action',
        action: () => { clearFilters(); onClose(); },
        keywords: ['clear', 'reset', 'default'],
      },
      {
        id: 'action-compare',
        label: 'Compare Mode',
        description: 'Compare offices or weeks side-by-side',
        icon: <GitCompare size={16} />,
        category: 'action',
        action: () => { onOpenComparison?.(); onClose(); },
        keywords: ['compare', 'versus', 'vs', 'diff', 'office', 'week'],
      },

      // Filter shortcuts
      {
        id: 'filter-ytd',
        label: 'Filter: Year to Date',
        description: 'Show YTD data',
        icon: <Calendar size={16} />,
        category: 'filter',
        action: () => {
          const now = new Date();
          updateFilter('dt_end_cli_work_week__gte', `${now.getFullYear()}-01-01`);
          updateFilter('dt_end_cli_work_week__lte', now.toISOString().split('T')[0]);
          onClose();
        },
        keywords: ['year', 'ytd', 'date'],
      },
      {
        id: 'filter-last-month',
        label: 'Filter: Last 30 Days',
        description: 'Show recent data',
        icon: <Calendar size={16} />,
        category: 'filter',
        action: () => {
          const now = new Date();
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          updateFilter('dt_end_cli_work_week__gte', thirtyDaysAgo.toISOString().split('T')[0]);
          updateFilter('dt_end_cli_work_week__lte', now.toISOString().split('T')[0]);
          onClose();
        },
        keywords: ['month', 'recent', '30', 'days'],
      },
    ];

    // Add dynamic office filters
    if (filterOptions?.offices) {
      filterOptions.offices.forEach((office: string) => {
        items.push({
          id: `filter-office-${office}`,
          label: `Filter: ${office}`,
          description: 'Show only this office',
          icon: <Building2 size={16} />,
          category: 'filter',
          action: () => {
            updateFilter('xlc_operation', office);
            onClose();
          },
          keywords: ['office', 'site', office.toLowerCase()],
        });
      });
    }

    return items;
  }, [navigate, onClose, clearFilters, updateFilter, filterOptions]);

  const filteredCommands = useMemo(() => {
    if (!query) return commands;

    const lowerQuery = query.toLowerCase();
    return commands.filter((cmd) => {
      const matchesLabel = cmd.label.toLowerCase().includes(lowerQuery);
      const matchesDescription = cmd.description?.toLowerCase().includes(lowerQuery);
      const matchesKeywords = cmd.keywords?.some((k) => k.includes(lowerQuery));
      return matchesLabel || matchesDescription || matchesKeywords;
    });
  }, [commands, query]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      navigation: [],
      action: [],
      filter: [],
    };
    filteredCommands.forEach((cmd) => {
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const categoryLabels: Record<string, string> = {
    navigation: 'Navigation',
    action: 'Actions',
    filter: 'Filters',
  };

  let globalIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ background: 'rgba(0, 0, 0, 0.5)' }}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg rounded-xl shadow-2xl overflow-hidden"
        style={{
          background: COLORS.background.primary,
          border: `1px solid ${COLORS.border.default}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: `1px solid ${COLORS.border.subtle}` }}
        >
          <Search size={18} style={{ color: COLORS.text.muted }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: COLORS.text.primary }}
          />
          <div
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs"
            style={{
              background: COLORS.background.tertiary,
              color: COLORS.text.muted,
            }}
          >
            <Command size={10} />
            <span>K</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-opacity-50 transition-colors"
            style={{ color: COLORS.text.muted }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm" style={{ color: COLORS.text.muted }}>
                No commands found
              </p>
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, items]) => {
              if (items.length === 0) return null;
              return (
                <div key={category} className="mb-2">
                  <p
                    className="px-2 py-1 text-xs font-medium"
                    style={{ color: COLORS.text.muted }}
                  >
                    {categoryLabels[category]}
                  </p>
                  {items.map((cmd) => {
                    const currentIndex = globalIndex++;
                    const isSelected = currentIndex === selectedIndex;
                    return (
                      <button
                        key={cmd.id}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-150"
                        style={{
                          background: isSelected ? COLORS.background.tertiary : 'transparent',
                        }}
                        onClick={cmd.action}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                      >
                        <span
                          className="p-1.5 rounded-md"
                          style={{
                            background: isSelected ? `${COLORS.accent.primary}20` : COLORS.background.secondary,
                            color: isSelected ? COLORS.accent.primary : COLORS.text.secondary,
                          }}
                        >
                          {cmd.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-medium truncate"
                            style={{ color: COLORS.text.primary }}
                          >
                            {cmd.label}
                          </p>
                          {cmd.description && (
                            <p
                              className="text-xs truncate"
                              style={{ color: COLORS.text.muted }}
                            >
                              {cmd.description}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <ArrowRight size={14} style={{ color: COLORS.accent.primary }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-4 py-2 text-xs"
          style={{
            borderTop: `1px solid ${COLORS.border.subtle}`,
            background: COLORS.background.secondary,
            color: COLORS.text.muted,
          }}
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded" style={{ background: COLORS.background.tertiary }}>↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded" style={{ background: COLORS.background.tertiary }}>↵</kbd>
              select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded" style={{ background: COLORS.background.tertiary }}>esc</kbd>
              close
            </span>
          </div>
          <span>{filteredCommands.length} commands</span>
        </div>
      </div>
    </div>
  );
};

// Hook to manage command palette state
export const useCommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
  };
};

export default CommandPalette;
