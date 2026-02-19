'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { stockAPI, portfolioAPI, invalidateCache, Stock, PortfolioUnits } from '@/lib/api';
import { useSectorTargetsContext } from '@/contexts/SectorTargetsContext';
import StockTable from '@/components/StockTable';
import AddOperationModal from '@/components/AddOperationModal';
import JsonUploadModal from '@/components/JsonUploadModal';
import { PlusIcon, ArrowPathIcon, ArrowDownTrayIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';

const LATEST_PRICE_QUERY_DELAY_MS = 300;

export default function WatchlistPage() {
  const router = useRouter();
  const { targetPctBySector } = useSectorTargetsContext();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [units, setUnits] = useState<PortfolioUnits | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddOperationModal, setShowAddOperationModal] = useState(false);
  const [showJsonUploadModal, setShowJsonUploadModal] = useState(false);
  const [error, setError] = useState('');
  const [updatingStocks, setUpdatingStocks] = useState<Array<{ stockId: number; source: 'grok' | 'alphavantage' }>>([]);
  const [selectedStockIds, setSelectedStockIds] = useState<number[]>([]);
  const [updatingLatestPrices, setUpdatingLatestPrices] = useState(false);
  const [latestPriceResult, setLatestPriceResult] = useState<{
    requested: number;
    updatedTickers: string[];
    failedStocks: string[];
    completedAt: string;
  } | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    fetchData();
  }, [router]);

  const fetchData = async (forceRefresh: boolean = false) => {
    try {
      setLoading(true);
      const response = await portfolioAPI.getSummary(undefined, { forceRefresh });
      setStocks(response.data.stocks || []);
      setUnits(response.data.units || null);
      setError('');
    } catch (err: any) {
      setError('Failed to load watchlist data');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const watchlistStocks = stocks.filter(s => s.shares_owned === 0 || !s.shares_owned);

  const handleUpdateSingle = async (id: number, source?: 'grok' | 'alphavantage') => {
    if (!source) return;
    try {
      setUpdatingStocks(prev => [...prev, { stockId: id, source }]);
      await stockAPI.updateSingle(id, source);
      invalidateCache('portfolio');
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchData(true);
    } catch (err: any) {
      if (err.response?.status === 404) await fetchData();
      else alert('Failed to update stock: ' + (err.response?.data?.error || err.message));
    } finally {
      setUpdatingStocks(prev => prev.filter(item => !(item.stockId === id && item.source === source)));
    }
  };

  const handlePriceUpdate = async (id: number, newPrice: number) => {
    try {
      await stockAPI.updatePrice(id, newPrice);
      invalidateCache('portfolio');
      await fetchData(true);
    } catch (err: any) {
      alert('Failed to update price: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleFieldUpdate = async (id: number, field: string, value: number) => {
    try {
      await stockAPI.updateField(id, field, value);
      invalidateCache('portfolio');
      await fetchData(true);
    } catch (err: any) {
      alert('Failed to update field: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSelectStock = (id: number) => {
    setSelectedStockIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const handleSelectAllWatchlist = (selected: boolean) => {
    const ids = watchlistStocks.map(s => s.id);
    if (selected) setSelectedStockIds(prev => [...new Set([...prev, ...ids])]);
    else setSelectedStockIds(prev => prev.filter(id => !ids.includes(id)));
  };

  const handleDelete = async (id: number) => {
    const reason = prompt('Enter reason for deletion (optional):');
    if (reason === null) return;
    try {
      await stockAPI.delete(id, reason);
      invalidateCache('portfolio');
      await fetchData(true);
      alert('Stock deleted successfully!');
    } catch (err: any) {
      if (err.response?.status === 404) await fetchData(true);
      else alert('Failed to delete stock: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleExportJSON = async () => {
    if (selectedStockIds.length === 0) {
      alert('Please select at least one stock to export.');
      return;
    }
    try {
      const response = await stockAPI.getBatch(selectedStockIds);
      const selectedStocks = response.data || [];
      const exportData = selectedStocks.map((stock: Stock) => ({
        ticker: stock.ticker,
        company_name: stock.company_name,
        isin: stock.isin,
        sector: stock.sector,
        current_price: stock.current_price,
        currency: stock.currency,
        fair_value: stock.fair_value,
        upside_potential: stock.upside_potential,
        downside_risk: stock.downside_risk,
        probability_positive: stock.probability_positive,
        expected_value: stock.expected_value,
        beta: stock.beta,
        volatility: stock.volatility,
        pe_ratio: stock.pe_ratio,
        eps_growth_rate: stock.eps_growth_rate,
        debt_to_ebitda: stock.debt_to_ebitda,
        dividend_yield: stock.dividend_yield,
        b_ratio: stock.b_ratio,
        kelly_fraction: stock.kelly_fraction,
        half_kelly_suggested: stock.half_kelly_suggested,
        shares_owned: stock.shares_owned,
        avg_price_local: stock.avg_price_local,
        buy_zone_min: stock.buy_zone_min,
        buy_zone_max: stock.buy_zone_max,
        assessment: stock.assessment,
        update_frequency: stock.update_frequency,
        data_source: 'Manual',
        fair_value_source: '',
        comment: stock.comment,
      }));
      const url = window.URL.createObjectURL(new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `watchlist-selected-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to export JSON: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleRefreshLatestPricesForWatchlist = async () => {
    const watchlistIds = new Set(watchlistStocks.map(s => s.id));
    const selectedWatchlistIds = selectedStockIds.filter(id => watchlistIds.has(id));
    if (selectedWatchlistIds.length === 0) {
      alert('Select at least one stock in Watchlist to refresh latest prices.');
      return;
    }

    try {
      setUpdatingLatestPrices(true);
      setLatestPriceResult(null);
      const selectedWatchlistStocks = watchlistStocks.filter(s => selectedWatchlistIds.includes(s.id));
      const updatedTickers: string[] = [];
      const failedStocks: string[] = [];

      for (const watchlistStock of selectedWatchlistStocks) {
        try {
          await stockAPI.latestPrice(watchlistStock.id);
          updatedTickers.push(watchlistStock.ticker);
        } catch (err: any) {
          failedStocks.push(`${watchlistStock.ticker}: ${err.response?.data?.error || err.message || 'Unknown error'}`);
        }
        await new Promise(resolve => setTimeout(resolve, LATEST_PRICE_QUERY_DELAY_MS));
      }

      invalidateCache('portfolio');
      await fetchData(true);
      setLatestPriceResult({
        requested: selectedWatchlistIds.length,
        updatedTickers,
        failedStocks,
        completedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      alert('Failed to refresh latest prices: ' + (err.response?.data?.error || err.message));
    } finally {
      setUpdatingLatestPrices(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading watchlist...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {error && (
        <div className="mb-4 bg-red-900 bg-opacity-50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {selectedStockIds.length > 0 && (
        <div className="mb-4 bg-indigo-900/20 border border-indigo-700/50 rounded-lg px-3 py-2 flex items-center justify-between backdrop-blur-sm">
          <span className="text-sm text-indigo-200">✓ {selectedStockIds.length} selected</span>
          <button onClick={() => setSelectedStockIds([])} className="text-xs text-indigo-300 hover:text-indigo-100 underline">Clear</button>
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddOperationModal(true)}
            className="flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-md hover:shadow-lg"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Operation
          </button>
          <button
            onClick={() => fetchData(true)}
            disabled={loading}
            className="p-2 bg-gray-700/50 text-gray-300 rounded-lg hover:bg-gray-600 hover:text-white transition-all disabled:opacity-50"
            title="Refresh data"
          >
            <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="flex gap-2 pl-3 border-l border-gray-700">
          <button onClick={() => setShowJsonUploadModal(true)} className="flex items-center px-3 py-2 bg-teal-600/90 text-white rounded-lg hover:bg-teal-600 transition-all shadow-sm" title="Import">
            <ArrowUpTrayIcon className="h-4 w-4 mr-1.5" />
            <span className="text-sm font-medium">Import</span>
          </button>
          <button onClick={handleExportJSON} className="flex items-center px-3 py-2 bg-teal-600/90 text-white rounded-lg hover:bg-teal-600 transition-all shadow-sm" title={selectedStockIds.length > 0 ? `Export ${selectedStockIds.length} selected` : 'Select stocks to export'}>
            <ArrowDownTrayIcon className="h-4 w-4 mr-1.5" />
            <span className="text-sm font-medium">{selectedStockIds.length > 0 ? `Export (${selectedStockIds.length})` : 'Export'}</span>
          </button>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white flex items-center">
            <span className="text-amber-500 mr-2">○</span>
            Watchlist
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshLatestPricesForWatchlist}
              disabled={updatingLatestPrices}
              className="flex items-center px-3 py-1.5 bg-sky-600/90 text-white rounded-lg hover:bg-sky-600 transition-all disabled:opacity-50 shadow-sm text-xs font-medium"
              title="Refresh latest prices from Alpha Vantage for selected watchlist stocks"
            >
              {updatingLatestPrices ? 'Refreshing...' : `Get Latest Price (${selectedStockIds.filter(id => watchlistStocks.some(s => s.id === id)).length})`}
            </button>
            <span className="text-xs text-gray-400 bg-gray-800/50 px-2 py-1 rounded">{watchlistStocks.length}</span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Tip: According to Alpha Vantage, the default quote endpoint is updated at the end of each trading day for all users.
        </p>
        {latestPriceResult && (
          <div className={`mb-3 rounded-lg px-3 py-2 text-sm border ${latestPriceResult.failedStocks.length > 0 ? 'bg-red-900/30 border-red-700 text-red-200' : 'bg-emerald-900/30 border-emerald-700 text-emerald-200'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p>
                  Latest price request finished at {new Date(latestPriceResult.completedAt).toLocaleString()}.
                  Requested: {latestPriceResult.requested}, Updated: {latestPriceResult.updatedTickers.length}, Failed: {latestPriceResult.failedStocks.length}.
                </p>
                {latestPriceResult.updatedTickers.length > 0 && (
                  <p className="mt-1">
                    Updated: {latestPriceResult.updatedTickers.join(', ')}
                  </p>
                )}
                {latestPriceResult.failedStocks.length > 0 && (
                  <p className="mt-1">
                    Failed: {latestPriceResult.failedStocks.join(' | ')}
                  </p>
                )}
              </div>
              <button onClick={() => setLatestPriceResult(null)} className="text-lg leading-none opacity-80 hover:opacity-100" title="Close">x</button>
            </div>
          </div>
        )}
        <StockTable
          stocks={watchlistStocks}
          onDelete={handleDelete}
          onUpdate={handleUpdateSingle}
          onPriceUpdate={handlePriceUpdate}
          onFieldUpdate={handleFieldUpdate}
          updatingStocks={updatingStocks}
          selectedStockIds={selectedStockIds}
          onSelectStock={handleSelectStock}
          onSelectAll={handleSelectAllWatchlist}
          isWatchlist={true}
          onTickerUpdate={fetchData}
          units={units}
          sectorTargets={targetPctBySector}
        />
      </div>

      {showAddOperationModal && (
        <AddOperationModal
          onClose={() => setShowAddOperationModal(false)}
          onSuccess={async () => {
            setShowAddOperationModal(false);
            invalidateCache('portfolio');
            await new Promise(resolve => setTimeout(resolve, 500));
            await fetchData(true);
          }}
        />
      )}
      <JsonUploadModal
        isOpen={showJsonUploadModal}
        onClose={() => setShowJsonUploadModal(false)}
        onSuccess={async () => {
          setShowJsonUploadModal(false);
          invalidateCache('portfolio');
          await fetchData(true);
        }}
      />
    </div>
  );
}
