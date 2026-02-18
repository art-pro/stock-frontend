'use client';

import { useState, useEffect } from 'react';
import { EyeIcon, EyeSlashIcon, ArrowUpIcon, ArrowDownIcon, Bars3Icon } from '@heroicons/react/24/outline';

// Define the column configuration structure
export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  order: number;
  required?: boolean; // Cannot be hidden (like Ticker, Actions)
  portfolioOnly?: boolean; // Only shown in portfolio view, not watchlist
}

export interface ColumnSettingsProps {
  onSettingsChange: (columns: ColumnConfig[]) => void;
  initialColumns?: ColumnConfig[];
}

const sortByOrder = (cols: ColumnConfig[]): ColumnConfig[] => {
  return [...cols].sort((a, b) => a.order - b.order);
};

const normalizeFromOrderField = (cols: ColumnConfig[]): ColumnConfig[] => {
  return sortByOrder(cols).map((col, index) => ({ ...col, order: index }));
};

const reindexInCurrentOrder = (cols: ColumnConfig[]): ColumnConfig[] => {
  return cols.map((col, index) => ({ ...col, order: index }));
};

// Default column configuration based on StockTable structure
export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'checkbox', label: 'Select', visible: true, order: 0, required: true, portfolioOnly: false },
  { id: 'ticker', label: 'Ticker', visible: true, order: 1, required: true },
  { id: 'company_name', label: 'Company', visible: true, order: 2 },
  { id: 'sector', label: 'Sector', visible: true, order: 3 },
  { id: 'beta', label: 'Beta', visible: true, order: 4 },
  { id: 'avg_price_local', label: 'Avg Price', visible: true, order: 5, portfolioOnly: true },
  { id: 'current_price', label: 'Current Price', visible: true, order: 6 },
  { id: 'total_value', label: 'Total Value', visible: true, order: 7, portfolioOnly: true },
  { id: 'fair_value', label: 'Fair Value', visible: true, order: 8 },
  { id: 'buy_zone_min', label: 'Buy Zone Min', visible: true, order: 9 },
  { id: 'buy_zone_max', label: 'Buy Zone Max', visible: true, order: 10 },
  { id: 'buy_zone_status', label: 'Buy Zone Status', visible: true, order: 11 },
  { id: 'sell_zone_lower_bound', label: 'Sell Zone Min', visible: true, order: 12 },
  { id: 'sell_zone_upper_bound', label: 'Sell Zone Max', visible: true, order: 13 },
  { id: 'sell_zone_status', label: 'Sell Zone Status', visible: true, order: 14 },
  { id: 'upside_potential', label: 'Upside %', visible: true, order: 15 },
  { id: 'expected_value', label: 'EV %', visible: true, order: 16 },
  { id: 'probability_positive', label: 'Probability', visible: true, order: 17 },
  { id: 'downside_risk', label: 'Downside %', visible: true, order: 18 },
  { id: 'kelly_fraction', label: 'Kelly F* %', visible: true, order: 19 },
  { id: 'half_kelly_suggested', label: '½-Kelly %', visible: true, order: 20 },
  { id: 'shares_owned', label: 'Shares', visible: true, order: 21, portfolioOnly: true },
  { id: 'weight', label: 'Weight %', visible: true, order: 22, portfolioOnly: true },
  { id: 'unrealized_pnl', label: 'P&L', visible: true, order: 23, portfolioOnly: true },
  { id: 'comment', label: 'Notes', visible: true, order: 24 },
  { id: 'assessment', label: 'Assessment', visible: true, order: 25 },
  { id: 'action', label: 'Action', visible: true, order: 26 },
];

export default function ColumnSettings({ onSettingsChange, initialColumns = DEFAULT_COLUMNS }: ColumnSettingsProps) {
  const [columns, setColumns] = useState<ColumnConfig[]>(normalizeFromOrderField(initialColumns));
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  // Sort columns by order for display
  const sortedColumns = sortByOrder(columns);

  useEffect(() => {
    setColumns(normalizeFromOrderField(initialColumns));
  }, [initialColumns]);

  const applyColumns = (nextColumns: ColumnConfig[]) => {
    const normalized = reindexInCurrentOrder(nextColumns);
    setColumns(normalized);
    onSettingsChange(normalized);
  };

  const toggleVisibility = (columnId: string) => {
    applyColumns(
      columns.map(col =>
        col.id === columnId ? { ...col, visible: !col.visible } : col
      )
    );
  };

  const moveColumn = (columnId: string, direction: 'up' | 'down') => {
    const sortedCols = sortByOrder(columns);
    const currentIndex = sortedCols.findIndex(col => col.id === columnId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sortedCols.length) return;

    const reordered = [...sortedCols];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    applyColumns(reordered);
  };

  const handleDrop = (targetColumnId: string, sourceColumnId?: string) => {
    const sourceId = sourceColumnId || draggedItem;
    if (!sourceId || sourceId === targetColumnId) return;

    const sortedCols = sortByOrder(columns);
    const fromIndex = sortedCols.findIndex(col => col.id === sourceId);
    const toIndex = sortedCols.findIndex(col => col.id === targetColumnId);
    if (fromIndex === -1 || toIndex === -1) {
      setDraggedItem(null);
      return;
    }

    const reordered = [...sortedCols];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    applyColumns(reordered);
    setDraggedItem(null);
  };

  const resetToDefaults = () => {
    applyColumns(DEFAULT_COLUMNS);
  };

  const showAllColumns = () => {
    applyColumns(columns.map(col => ({ ...col, visible: true })));
  };

  const hideOptionalColumns = () => {
    applyColumns(
      columns.map(col => ({
        ...col,
        visible: col.required || ['ticker', 'company_name', 'current_price', 'assessment'].includes(col.id)
      }))
    );
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h2 className="text-xl font-bold text-white mb-4">Column Visibility & Order</h2>

      <div className="mb-6">
        <p className="text-sm text-gray-400 mb-4">
          Configure which columns are visible in your stock table and their display order.
          Drag items or use the arrow buttons to reorder columns.
        </p>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={showAllColumns}
            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
          >
            Show All
          </button>
          <button
            type="button"
            onClick={hideOptionalColumns}
            className="px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700 transition-colors"
          >
            Essential Only
          </button>
          <button
            type="button"
            onClick={resetToDefaults}
            className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
          >
            Reset to Default
          </button>
        </div>
      </div>

      {/* Column List */}
      <div className="space-y-2">
        {sortedColumns.map((column, index) => (
          <div
            key={column.id}
            className={`flex items-center justify-between p-3 rounded-lg border ${
              column.visible
                ? 'bg-gray-700 border-gray-600'
                : 'bg-gray-800 border-gray-700 opacity-60'
            } ${draggedItem === column.id ? 'scale-105 shadow-lg' : ''} transition-all`}
            onDragOver={(e) => {
              if (draggedItem && draggedItem !== column.id) {
                e.preventDefault();
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              const droppedId = e.dataTransfer.getData('text/plain');
              handleDrop(column.id, droppedId || undefined);
            }}
          >
            <div className="flex items-center space-x-3">
              {/* Drag Handle */}
              <div
                className={`text-gray-400 ${column.required ? 'cursor-not-allowed opacity-40' : 'cursor-move'}`}
                draggable={!column.required}
                onDragStart={(e) => {
                  if (column.required) return;
                  setDraggedItem(column.id);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', column.id);
                }}
                onDragEnd={() => setDraggedItem(null)}
                title={column.required ? 'Required columns cannot be moved' : 'Drag to reorder'}
              >
                <Bars3Icon className="h-4 w-4" />
              </div>

              {/* Column Info */}
              <div>
                <div className="flex items-center space-x-2">
                  <span className={`font-medium ${column.visible ? 'text-white' : 'text-gray-400'}`}>
                    {column.label}
                  </span>
                  {column.required && (
                    <span className="text-xs bg-primary-600 text-primary-100 px-2 py-0.5 rounded">
                      Required
                    </span>
                  )}
                  {column.portfolioOnly && (
                    <span className="text-xs bg-blue-600 text-blue-100 px-2 py-0.5 rounded">
                      Portfolio Only
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">Order: {index + 1}</p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center space-x-2">
              {/* Move buttons */}
              <button
                type="button"
                onClick={() => moveColumn(column.id, 'up')}
                disabled={index === 0}
                className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                title="Move up"
              >
                <ArrowUpIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => moveColumn(column.id, 'down')}
                disabled={index === sortedColumns.length - 1}
                className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                title="Move down"
              >
                <ArrowDownIcon className="h-4 w-4" />
              </button>

              {/* Visibility toggle */}
              <button
                type="button"
                onClick={() => toggleVisibility(column.id)}
                disabled={column.required}
                className={`p-1 ${
                  column.required
                    ? 'text-gray-600 cursor-not-allowed'
                    : column.visible
                      ? 'text-green-400 hover:text-green-300'
                      : 'text-gray-400 hover:text-white'
                } transition-colors`}
                title={column.required ? 'Required column' : column.visible ? 'Hide column' : 'Show column'}
              >
                {column.visible ? (
                  <EyeIcon className="h-4 w-4" />
                ) : (
                  <EyeSlashIcon className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-6 p-4 bg-gray-700 rounded-lg">
        <div className="flex justify-between text-sm">
          <span className="text-gray-300">
            Visible Columns: <span className="text-white font-semibold">
              {columns.filter(col => col.visible).length}
            </span> / {columns.length}
          </span>
          <span className="text-gray-400">
            Drag to reorder • Click eye to show/hide
          </span>
        </div>
      </div>
    </div>
  );
}