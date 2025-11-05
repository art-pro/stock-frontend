'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Stock } from '@/lib/api';
import { TrashIcon, ArrowPathIcon, PencilIcon } from '@heroicons/react/24/outline';

interface StockTableProps {
  stocks: Stock[];
  onDelete: (id: number) => void;
  onUpdate: (id: number) => void;
  onPriceUpdate: (id: number, newPrice: number) => void;
  updatingStockIds?: number[];
}

export default function StockTable({ stocks, onDelete, onUpdate, onPriceUpdate, updatingStockIds = [] }: StockTableProps) {
  const [sortField, setSortField] = useState<keyof Stock>('ticker');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filter, setFilter] = useState('');
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState('');

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

  const handleEditPrice = (stock: Stock) => {
    setEditingPriceId(stock.id);
    setEditPrice(stock.current_price.toString());
  };

  const handleSavePrice = (stockId: number) => {
    const newPrice = parseFloat(editPrice);
    if (!isNaN(newPrice) && newPrice > 0) {
      onPriceUpdate(stockId, newPrice);
      setEditingPriceId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingPriceId(null);
    setEditPrice('');
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
              <th
                className="px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-700 whitespace-nowrap"
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
                onClick={() => handleSort('avg_price_local')}
                title="Your average entry/purchase price"
              >
                Avg Price
              </th>
              <th
                className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-700 whitespace-nowrap"
                onClick={() => handleSort('current_price')}
                title="Current market price in local currency"
              >
                Current Price
              </th>
              <th
                className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider whitespace-nowrap"
                title="Total position value (Current Price × Shares)"
              >
                Total Value
              </th>
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
              <th
                className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-700 whitespace-nowrap"
                onClick={() => handleSort('shares_owned')}
              >
                Shares
              </th>
              <th
                className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-700 whitespace-nowrap"
                onClick={() => handleSort('weight')}
              >
                Weight %
              </th>
              <th
                className="px-3 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-700 whitespace-nowrap"
                onClick={() => handleSort('unrealized_pnl')}
              >
                P&L
              </th>
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
              const isUpdating = updatingStockIds.includes(stock.id);
              return (
                <tr key={stock.id} className={`${getRowClass(stock.assessment)} ${isUpdating ? 'opacity-60' : ''}`}>
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-primary-400">
                    <div className="flex items-center gap-2">
                      {stock.ticker}
                      {isUpdating && (
                        <ArrowPathIcon className="h-4 w-4 animate-spin text-primary-400" />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm">
                    <Link
                      href={`/stocks/${stock.id}`}
                      className="text-primary-400 hover:text-primary-300 hover:underline"
                    >
                      {stock.company_name}
                    </Link>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm">
                    {stock.sector}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-right">
                    {formatNumber(stock.avg_price_local)} {stock.avg_price_local > 0 ? stock.currency : ''}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-right">
                    {editingPriceId === stock.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-24 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSavePrice(stock.id);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                        />
                        <button
                          onClick={() => handleSavePrice(stock.id)}
                          className="text-green-400 hover:text-green-300 text-xs"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <span>{formatNumber(stock.current_price)} {stock.current_price > 0 ? stock.currency : ''}</span>
                        {stock.current_price > 0 && (
                          <button
                            onClick={() => handleEditPrice(stock)}
                            className="text-gray-400 hover:text-primary-400 transition-colors"
                            title="Edit price manually"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-right font-semibold">
                    {stock.current_price > 0 ? `${formatNumber(stock.current_price * stock.shares_owned)} ${stock.currency}` : 'N/A'}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-right">
                    {formatNumber(stock.fair_value)} {stock.fair_value > 0 ? stock.currency : ''}
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
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-right">
                    {formatPercentage(stock.kelly_fraction, 1)}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-right">
                    {formatPercentage(stock.half_kelly_suggested, 1)}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-right">
                    {stock.shares_owned || 'N/A'}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-right">
                    {formatPercentage(stock.weight, 1)}
                  </td>
                  <td className={`px-3 py-4 whitespace-nowrap text-sm text-right font-semibold ${
                    stock.unrealized_pnl === 0 ? 'text-gray-400' :
                    stock.unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {formatCurrency(stock.unrealized_pnl)}
                  </td>
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
                        onClick={() => onUpdate(stock.id)}
                        disabled={isUpdating}
                        className="text-primary-400 hover:text-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Update stock data"
                      >
                        <ArrowPathIcon className={`h-5 w-5 ${isUpdating ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        onClick={() => onDelete(stock.id)}
                        disabled={isUpdating}
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
          <p>No stocks found. Add your first stock to get started.</p>
        </div>
      )}
    </div>
  );
}

