'use client';

import { useState, useEffect, useRef } from 'react';
import { ColumnConfig, DEFAULT_COLUMNS } from '@/components/ColumnSettings';
import { settingsAPI } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';

export function useColumnSettings() {
  const [columnSettings, setColumnSettings] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [isLoading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadColumnSettings();
  }, []);

  const loadColumnSettings = async () => {
    if (!isAuthenticated()) {
        // Fallback to local storage if not authenticated
        loadFromLocalStorage();
        setLoading(false);
        return;
    }

    try {
      const response = await settingsAPI.getColumnSettings();
      if (response.data.settings) {
        const parsedColumns = JSON.parse(response.data.settings);
        mergeAndSetSettings(parsedColumns);
        // Also update local storage to keep it in sync
        localStorage.setItem('stock-table-columns', response.data.settings);
      } else {
        // If no settings on server, try local storage
        loadFromLocalStorage();
      }
    } catch (err) {
      console.error('Failed to load column settings from API:', err);
      loadFromLocalStorage();
    } finally {
        setLoading(false);
    }
  };

  const loadFromLocalStorage = () => {
      try {
        const saved = localStorage.getItem('stock-table-columns');
        if (saved) {
            const parsedColumns = JSON.parse(saved);
            mergeAndSetSettings(parsedColumns);
        } else {
            setColumnSettings(DEFAULT_COLUMNS);
        }
      } catch (err) {
          console.error('Failed to load from local storage:', err);
          setColumnSettings(DEFAULT_COLUMNS);
      }
  }

  const mergeAndSetSettings = (parsedColumns: any[]) => {
        // Merge with defaults to handle any new columns added
        const mergedColumns = DEFAULT_COLUMNS.map(defaultCol => {
          const savedCol = parsedColumns.find((col: ColumnConfig) => col.id === defaultCol.id);
          return savedCol ? { ...defaultCol, ...savedCol } : defaultCol;
        });
        setColumnSettings(mergedColumns);
  }

  const saveColumnSettings = async (newSettings: ColumnConfig[]) => {
      setColumnSettings(newSettings);
      const settingsJson = JSON.stringify(newSettings);
      
      // Save to local storage immediately
      try {
        localStorage.setItem('stock-table-columns', settingsJson);
      } catch (e) {
        console.error("Failed to save to local storage", e);
      }

      if (isAuthenticated()) {
          setSaveStatus('saving');
          setSaveError(null);

          if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
          }

          saveTimerRef.current = setTimeout(async () => {
            try {
                await settingsAPI.saveColumnSettings(settingsJson);
                setSaveStatus('success');
                // Reset to idle after a delay to clear message
                setTimeout(() => setSaveStatus('idle'), 3000);
            } catch (err: any) {
                console.error('Failed to save column settings to API:', err);
                setSaveStatus('error');
                setSaveError(err.response?.data?.error || 'Failed to save settings');
            }
          }, 1000);
      } else {
          // If not authenticated, treat local storage save as success
          setSaveStatus('success');
          setTimeout(() => setSaveStatus('idle'), 3000);
      }
  };

  const getVisibleColumns = (isWatchlist: boolean = false) => {
    return columnSettings
      .filter(col => {
        // Filter out portfolio-only columns for watchlist view
        if (isWatchlist && col.portfolioOnly) {
          return false;
        }
        return col.visible;
      })
      .sort((a, b) => a.order - b.order);
  };

  const isColumnVisible = (columnId: string, isWatchlist: boolean = false) => {
    const column = columnSettings.find(col => col.id === columnId);
    if (!column) return false;

    if (isWatchlist && column.portfolioOnly) {
      return false;
    }

    return column.visible;
  };

  return {
    columnSettings,
    getVisibleColumns,
    isColumnVisible,
    refreshSettings: loadColumnSettings,
    saveSettings: saveColumnSettings,
    isLoading,
    saveStatus,
    saveError
  };
}
