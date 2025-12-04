'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Stock } from '@/lib/api';
import { TrashIcon, ArrowPathIcon, PencilIcon } from '@heroicons/react/24/outline';
import EditTickerModal from './EditTickerModal';

interface StockTableProps {
  stocks: Stock[];
  onDelete: (id: number) => void;
  onUpdate: (id: number, source?: 'grok' | 'alphavantage') => void;
  onPriceUpdate: (id: number, newPrice: number) => void;
  onFieldUpdate: (id: number, field: string, value: number) => void;
  updatingStocks?: Array<{ stockId: number; source: 'grok' | 'alphavantage' }>;
  selectedStockIds?: number[];
  onSelectStock?: (id: number) => void;
  onSelectAll?: (selected: boolean) => void;
  isWatchlist?: boolean;
  onTickerUpdate?: () => void;
}

export default function StockTable({ stocks, onDelete, onUpdate, onPriceUpdate, onFieldUpdate, updatingStocks = [], selectedStockIds = [], onSelectStock, onSelectAll, isWatchlist = false, onTickerUpdate }: StockTableProps) {
  const [sortField, setSortField] = useState<keyof Stock>('ticker');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filter, setFilter] = useState('');
  const [editingField, setEditingField] = useState<{ stockId: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editingTicker, setEditingTicker] = useState<Stock | null>(null);

  const handleSort = (field: keyof Stock) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredStocks = (stocks || []).filter(
    (stock) =>
      stock.ticker.toLowerCase().includes(filter.toLowerCase()) ||
      stock.company_name.toLowerCase().includes(filter.toLowerCase()) ||
      stock.sector.toLowerCase().includes(filter.toLowerCase())
  );

  const sortedStocks = [...filteredStocks].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc' 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    return 0;
  });

  const getRowClass = (assessment: string) => {
    switch (assessment.toLowerCase()) {
      case 'add':
        return 'assessment-add hover:bg-green-900 hover:bg-opacity-20';
      case 'trim':
        return 'assessment-trim hover:bg-orange-900 hover:bg-opacity-20';
      case 'sell':
        return 'assessment-sell hover:bg-red-900 hover:bg-opacity-20';
      default:
        return 'assessment-hold hover:bg-gray-800';
    }
  };

  const formatNumber = (num: number, decimals: number = 2) => {
    if (num === 0 || num === null || num === undefined) {
      return 'N/A';
    }
    return num?.toFixed(decimals) || 'N/A';
  };

  const formatCurrency = (num: number) => {
    if (num === 0 || num === null || num === undefined) {
      return 'N/A';
    }
    return `${formatNumber(num, 2)}`;
  };

  const formatPercentage = (num: number, decimals: number = 1) => {
    if (num === 0 || num === null || num === undefined) {
      return 'N/A';
    }
    return `${formatNumber(num, decimals)}%`;
  };

  const handleEditField = (stock: Stock, field: string, currentValue: number) => {
    setEditingField({ stockId: stock.id, field });
    setEditValue(currentValue.toString());
  };

  const handleSaveField = () => {
    if (!editingField) return;
    
    const newValue = parseFloat(editValue);
    if (!isNaN(newValue) && newValue >= 0) {
      if (editingField.field === 'current_price') {
        onPriceUpdate(editingField.stockId, newValue);
      } else {
        onFieldUpdate(editingField.stockId, editingField.field, newValue);
      }
      setEditingField(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const isEditing = (stockId: number, field: string) => {
    return editingField?.stockId === stockId && editingField?.field === field;
  };

  return (
    <div className="stock-table">
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by ticker, company, or sector..."
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider whitespace-nowrap checkbox-column">
                {onSelectAll && (
                  <input
                    type="checkbox"
                    checked={stocks.length > 0 && selectedStockIds.length === stocks.length}
                    onChange={(e) => onSelectAll(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-primary-600 focus:ring-primary-500 focus:ring-offset-gray-800 cursor-pointer"
                    title={selectedStockIds.length === stocks.length ? "Unselect all" : "Select all"}
                  />
                )}
              </th>
              <th
                className="px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-700 whitespace-nowrap ticker-column"
                onClick={() => handleSort('ticker')}
              >
                Ticker
              </th>
              <th
                className="px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-700 whitespace-nowrap"
                onClick={() => handleSort('company_name')}
              >
                Company
              </th>
              <th
                className="px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-700 whitespace-nowrap"
                onClick={() => handleSort('sector')}
              >
                Sector
              </th>
              <th
                className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-700 whitespace-nowrap"
                onClick={() => handleSort('beta')}
                title="Beta coefficient (market sensitivity)"
              >
                Beta
              </th>
              {!isWatchlist && (
                <th
                  className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-700 whitespace-nowrap"
                  onClick={() => handleSort('avg_price_local')}
                  title="Your average entry/purchase price"
                >
                  Avg Price
                </th>
              )}
              <th
                className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-700 whitespace-nowrap"
                onClick={() => handleSort('current_price')}
                title="Current market price in local currency"
              >
                Current Price
              </th>
              {!isWatchlist && (
                <th
                  className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider whitespace-nowrap"
                  title="Total position value (Current Price × Shares)"
                >
                  Total Value
                </th>
              )}
              <th
                className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-700 whitespace-nowrap"
                onClick={() => handleSort('fair_value')}
                title="Consensus analyst target price"
              >
                Fair Value
              </th>
              <th
                className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-700 whitespace-nowrap"
                onClick={() => handleSort('upside_potential')}
                title="Potential gain to fair value: ((FV - Price) / Price) × 100"
              >
                Upside %
              </th>
              <th
                className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-700 whitespace-nowrap"
                onClick={() => handleSort('expected_value')}
                title="Expected Value: (p × Upside) + ((1-p) × Downside)"
              >
                EV %
              </th>
              <th
                className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-700 whitespace-nowrap"
                onClick={() => handleSort('probability_positive')}
                title="Probability of positive outcome (0-1), default 0.65"
              >
                p
              </th>
              <th
                className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-700 whitespace-nowrap"
                onClick={() => handleSort('downside_risk')}
                title="Downside risk % (calibrated by beta)"
              >
                Downside %
              </th>
              <th
                className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-700 whitespace-nowrap"
                onClick={() => handleSort('kelly_fraction')}
                title="Optimal position size: ((b×p) - (1-p)) / b"
              >
                Kelly F* %
              </th>
              <th
                className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-700 whitespace-nowrap"
                onClick={() => handleSort('half_kelly_suggested')}
                title="Conservative position size (capped at 15%)"
              >
                ½-Kelly %
              </th>
              {!isWatchlist && (
                <th
                  className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-700 whitespace-nowrap"
                  onClick={() => handleSort('shares_owned')}
                >
                  Shares
                </th>
              )}
              {!isWatchlist && (
                <th
                  className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-700 whitespace-nowrap"
                  onClick={() => handleSort('weight')}
                >
                  Weight %
                </th>
              )}
              {!isWatchlist && (
                <th
                  className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-700 whitespace-nowrap"
                  onClick={() => handleSort('unrealized_pnl')}
                >
                  P&L
                </th>
              )}
              <th
                className="px-3 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-700 whitespace-nowrap"
                onClick={() => handleSort('assessment')}
              >
                Assessment
              </th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider whitespace-nowrap">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {sortedStocks.map((stock) => {
              const isUpdatingAlphaVantage = updatingStocks.some(u => u.stockId === stock.id && u.source === 'alphavantage');
              const isUpdatingGrok = updatingStocks.some(u => u.stockId === stock.id && u.source === 'grok');
              const isAnyUpdating = isUpdatingAlphaVantage || isUpdatingGrok;
              
              return (
                <tr key={stock.id} className={`${getRowClass(stock.assessment)} ${isAnyUpdating ? 'opacity-60' : ''}`}>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-center checkbox-column">
                    {onSelectStock && (
                      <input
                        type="checkbox"
                        checked={selectedStockIds.includes(stock.id)}
                        onChange={() => onSelectStock(stock.id)}
                        className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-primary-600 focus:ring-primary-500 focus:ring-offset-gray-800 cursor-pointer"
                        disabled={isAnyUpdating}
                      />
                    )}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-primary-400 ticker-column">
                    <div className="flex items-center gap-2">
                      <span title={`Data Source: ${stock.data_source || 'N/A'}\nLast Updated: ${stock.last_updated ? new Date(stock.last_updated).toLocaleString() : 'Never'}`}>
                        {stock.ticker}
                      </span>
                      {onTickerUpdate && (
                        <button
                          onClick={() => setEditingTicker(stock)}
                          className="text-gray-400 hover:text-primary-400 transition-colors"
                          title="Edit ticker symbol"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                      )}
                      {isAnyUpdating && (
                        <ArrowPathIcon className="h-4 w-4 animate-spin text-primary-400" />
                      )}
                      {stock.data_source && (
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            stock.data_source.includes('Alpha Vantage')
                              ? 'bg-blue-900 text-blue-200 border border-blue-700'
                              : stock.data_source.includes('Grok')
                              ? 'bg-purple-900 text-purple-200 border border-purple-700'
                              : 'bg-gray-700 text-gray-300 border border-gray-600'
                          }`}
                          title={`Data Source: ${stock.data_source}\nLast Updated: ${stock.last_updated ? new Date(stock.last_updated).toLocaleString() : 'Never'}`}
                        >
                          {stock.data_source.includes('Alpha Vantage') ? '📊 AV' :
                           stock.data_source.includes('Grok') ? '🤖 Grok' :
                           stock.data_source || 'N/A'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm">
                    <Link
                      href={`/stocks/${stock.id}`}
                      prefetch={false}
                      className="text-primary-400 hover:text-primary-300 hover:underline"
                    >
                      {stock.company_name}
                    </Link>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm">
                    {stock.sector}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-right" title={`Beta: ${formatNumber(stock.beta, 2)}`}>
                    {formatNumber(stock.beta, 2)}
                  </td>
                  {!isWatchlist && (
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-right">
                      {isEditing(stock.id, 'avg_price_local') ? (
                        <div className="flex items-center justify-end gap-2">
                          <input
                            type="number"
                            step="0.01"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-24 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveField();
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                          />
                          <button onClick={handleSaveField} className="text-green-400 hover:text-green-300 text-xs">Save</button>
                          <button onClick={handleCancelEdit} className="text-red-400 hover:text-red-300 text-xs">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <span>{formatNumber(stock.avg_price_local)} {stock.avg_price_local > 0 ? stock.currency : ''}</span>
                          <button
                            onClick={() => handleEditField(stock, 'avg_price_local', stock.avg_price_local)}
                            className="text-gray-400 hover:text-primary-400 transition-colors"
                            title="Edit average price"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-right">
                    {isEditing(stock.id, 'current_price') ? (
                      <div className="flex items-center justify-end gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-24 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveField();
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                        />
                        <button onClick={handleSaveField} className="text-green-400 hover:text-green-300 text-xs">Save</button>
                        <button onClick={handleCancelEdit} className="text-red-400 hover:text-red-300 text-xs">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <span>{formatNumber(stock.current_price)} {stock.current_price > 0 ? stock.currency : ''}</span>
                        {stock.current_price > 0 && (
                          <button
                            onClick={() => handleEditField(stock, 'current_price', stock.current_price)}
                            className="text-gray-400 hover:text-primary-400 transition-colors"
                            title="Edit current price"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  {!isWatchlist && (
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-right font-semibold">
                      {stock.current_price > 0 ? `${formatNumber(stock.current_price * stock.shares_owned)} ${stock.currency}` : 'N/A'}
                    </td>
                  )}
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-right">
                    {isEditing(stock.id, 'fair_value') ? (
                      <div className="flex items-center justify-end gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-24 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveField();
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                        />
                        <button onClick={handleSaveField} className="text-green-400 hover:text-green-300 text-xs">Save</button>
                        <button onClick={handleCancelEdit} className="text-red-400 hover:text-red-300 text-xs">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2" title={`Source: ${stock.fair_value_source || 'Not available'}`}>
                        <span>{formatNumber(stock.fair_value)} {stock.fair_value > 0 ? stock.currency : ''}</span>
                        <button
                          onClick={() => handleEditField(stock, 'fair_value', stock.fair_value)}
                          className="text-gray-400 hover:text-primary-400 transition-colors"
                          title="Edit fair value"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className={`px-3 py-4 whitespace-nowrap text-sm text-right font-semibold ${
                    stock.upside_potential === 0 ? 'text-gray-400' :
                    stock.upside_potential > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {formatPercentage(stock.upside_potential, 1)}
                  </td>
                  <td className={`px-3 py-4 whitespace-nowrap text-sm text-right font-semibold ${
                    stock.expected_value === 0 ? 'text-gray-400' :
                    stock.expected_value > 7 ? 'text-green-400' : 
                    stock.expected_value > 0 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {formatPercentage(stock.expected_value, 1)}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-right" title={`Probability: ${formatNumber(stock.probability_positive, 2)}`}>
                    {stock.probability_positive === 0 ? 'N/A' : formatNumber(stock.probability_positive, 2)}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-right text-red-400">
                    {formatPercentage(stock.downside_risk, 1)}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-right">
                    {formatPercentage(stock.kelly_fraction, 1)}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-right">
                    {formatPercentage(stock.half_kelly_suggested, 1)}
                  </td>
                  {!isWatchlist && (
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-right">
                      {isEditing(stock.id, 'shares_owned') ? (
                        <div className="flex items-center justify-end gap-2">
                          <input
                            type="number"
                            step="1"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveField();
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                          />
                          <button onClick={handleSaveField} className="text-green-400 hover:text-green-300 text-xs">Save</button>
                          <button onClick={handleCancelEdit} className="text-red-400 hover:text-red-300 text-xs">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <span>{stock.shares_owned || 'N/A'}</span>
                          <button
                            onClick={() => handleEditField(stock, 'shares_owned', stock.shares_owned)}
                            className="text-gray-400 hover:text-primary-400 transition-colors"
                            title="Edit shares owned"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                  {!isWatchlist && (
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-right">
                      {formatPercentage(stock.weight, 1)}
                    </td>
                  )}
                  {!isWatchlist && (
                    <td className={`px-3 py-4 whitespace-nowrap text-sm text-right font-semibold ${
                      stock.unrealized_pnl === 0 ? 'text-gray-400' :
                      stock.unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {formatCurrency(stock.unrealized_pnl)}
                    </td>
                  )}
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      stock.assessment === 'N/A' ? 'bg-gray-700 text-gray-400' :
                      stock.assessment === 'Add' ? 'bg-green-900 text-green-200' :
                      stock.assessment === 'Hold' ? 'bg-gray-700 text-gray-200' :
                      stock.assessment === 'Trim' ? 'bg-orange-900 text-orange-200' :
                      'bg-red-900 text-red-200'
                    }`}>
                      {stock.assessment}
                    </span>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-center">
                    <div className="flex justify-center space-x-2">
                      <button
                        onClick={() => onUpdate(stock.id, 'alphavantage')}
                        disabled={isUpdatingAlphaVantage}
                        className="text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Update from Alpha Vantage (raw financial data)"
                      >
                        <div className="flex flex-col items-center">
                          <ArrowPathIcon className={`h-5 w-5 ${isUpdatingAlphaVantage ? 'animate-spin' : ''}`} />
                          <span className="text-xs mt-0.5">📊</span>
                        </div>
                      </button>
                      <button
                        onClick={() => onUpdate(stock.id, 'grok')}
                        disabled={isUpdatingGrok}
                        className="text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Update from Grok AI (analytical data)"
                      >
                        <div className="flex flex-col items-center">
                          <ArrowPathIcon className={`h-5 w-5 ${isUpdatingGrok ? 'animate-spin' : ''}`} />
                          <span className="text-xs mt-0.5">🤖</span>
                        </div>
                      </button>
                      <button
                        onClick={() => onDelete(stock.id)}
                        disabled={isAnyUpdating}
                        className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete stock"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sortedStocks.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p>
            {isWatchlist 
              ? 'No stocks in watchlist. Add stocks with 0 shares to watch them.'
              : 'No stocks in portfolio. Add stocks with shares to track your investments.'}
          </p>
        </div>
      )}

      {/* Edit Ticker Modal */}
      {editingTicker && (
        <EditTickerModal
          stock={editingTicker}
          allStocks={stocks}
          onClose={() => setEditingTicker(null)}
          onSuccess={() => {
            setEditingTicker(null);
            onTickerUpdate?.();
          }}
        />
      )}
    </div>
  );
}

