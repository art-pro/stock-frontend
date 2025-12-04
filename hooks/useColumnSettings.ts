'use client';

import { useState, useEffect } from 'react';
import { ColumnConfig, DEFAULT_COLUMNS } from '@/components/ColumnSettings';

export function useColumnSettings() {
  const [columnSettings, setColumnSettings] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);

  useEffect(() => {
    loadColumnSettings();
  }, []);

  const loadColumnSettings = () => {
    try {
      const saved = localStorage.getItem('stock-table-columns');
      if (saved) {
        const parsedColumns = JSON.parse(saved);
        // Merge with defaults to handle any new columns added
        const mergedColumns = DEFAULT_COLUMNS.map(defaultCol => {
          const savedCol = parsedColumns.find((col: ColumnConfig) => col.id === defaultCol.id);
          return savedCol ? { ...defaultCol, ...savedCol } : defaultCol;
        });
        setColumnSettings(mergedColumns);
      }
    } catch (err) {
      console.error('Failed to load column settings:', err);
      setColumnSettings(DEFAULT_COLUMNS);
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
    refreshSettings: loadColumnSettings
  };
}