'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, removeToken } from '@/lib/auth';
import { stockAPI, portfolioAPI, versionAPI, invalidateCache, Stock, PortfolioMetrics, PortfolioUnits } from '@/lib/api';
import { FRONTEND_VERSION } from '@/lib/version';
import StockTable from '@/components/StockTable';
import PortfolioSummary from '@/components/PortfolioSummary';
import AddStockModal from '@/components/AddStockModal';
import JsonUploadModal from '@/components/JsonUploadModal';
import ExchangeRateTable from '@/components/ExchangeRateTable';
import CashManagementTable from '@/components/CashManagementTable';
import {
  PlusIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  DocumentArrowUpIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

export default function DashboardPage() {
  const router = useRouter();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [units, setUnits] = useState<PortfolioUnits | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showJsonUploadModal, setShowJsonUploadModal] = useState(false);
  const [error, setError] = useState('');
  const [apiStatus, setApiStatus] = useState<any>(null);
  const [checkingAPI, setCheckingAPI] = useState(false);
  const [updatingStocks, setUpdatingStocks] = useState<Array<{ stockId: number; source: 'grok' | 'alphavantage' }>>([]);
  const [updateProgress, setUpdateProgress] = useState({ current: 0, total: 0 });
  const [backendVersion, setBackendVersion] = useState<string>('...');
  const [selectedStockIds, setSelectedStockIds] = useState<number[]>([]);
  const [collectingFairValues, setCollectingFairValues] = useState(false);
  const [collectNotice, setCollectNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [collectAbortController, setCollectAbortController] = useState<AbortController | null>(null);
  const [calculatorTicker, setCalculatorTicker] = useState('');
  const [calculatorCurrentPrice, setCalculatorCurrentPrice] = useState('');
  const [calculatorTargetPercent, setCalculatorTargetPercent] = useState('');

  const showCollectNotice = (type: 'success' | 'error' | 'info', message: string) => {
    setCollectNotice({ type, message });
  };

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    fetchData();
    checkAPIStatus();
    fetchBackendVersion();
  }, [router]);

  const fetchBackendVersion = async () => {
    try {
      const response = await versionAPI.getBackendVersion();
      setBackendVersion(response.data.version);
    } catch (err) {
      setBackendVersion('unknown');
    }
  };

  const checkAPIStatus = async () => {
    try {
      const response = await portfolioAPI.getAPIStatus();
      setApiStatus(response.data);
      console.log('API Status:', response.data);
    } catch (err: any) {
      console.error('Failed to check API status:', err);
    }
  };

  const handleTestAPI = async () => {
    setCheckingAPI(true);
    await checkAPIStatus();
    setTimeout(() => setCheckingAPI(false), 1000);
  };

  const fetchData = async (forceRefresh: boolean = false) => {
    try {
      setLoading(true);

      // Fetch portfolio summary (includes stocks and metrics)
      const response = await portfolioAPI.getSummary(undefined, { forceRefresh });

      const stocksData = response.data.stocks || [];
      setStocks(stocksData);
      setMetrics(response.data.summary || null);
      setUnits(response.data.units || null);
      setError('');
    } catch (err: any) {
      setError('Failed to load portfolio data');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAll = async (source: 'grok' | 'alphavantage') => {
    // Get stocks to update - either selected ones or all if none selected
    const stocksToUpdate = selectedStockIds.length > 0
      ? stocks.filter(s => selectedStockIds.includes(s.id))
      : stocks;

    if (stocksToUpdate.length === 0) {
      alert('No stocks to update. Please select at least one stock.');
      return;
    }

    try {
      setUpdating(true);
      setUpdateProgress({ current: 0, total: stocksToUpdate.length });

      // Update stocks sequentially to show progress
      for (let i = 0; i < stocksToUpdate.length; i++) {
        const stock = stocksToUpdate[i];
        setUpdatingStocks([{ stockId: stock.id, source }]);
        setUpdateProgress({ current: i + 1, total: stocksToUpdate.length });

        try {
          await stockAPI.updateSingle(stock.id, source);
          // Small delay to ensure backend has processed
          await new Promise(resolve => setTimeout(resolve, 500));
          // Refresh data after each update to show progress
          await fetchData(true);
        } catch (err) {
          console.error(`Failed to update ${stock.ticker}:`, err);
        }
      }

      setUpdatingStocks([]);
      const message = selectedStockIds.length > 0
        ? `${stocksToUpdate.length} selected stock(s) updated successfully from ${source === 'grok' ? 'Grok AI' : 'Alpha Vantage'}!`
        : `All stocks updated successfully from ${source === 'grok' ? 'Grok AI' : 'Alpha Vantage'}!`;
      alert(message);
    } catch (err: any) {
      alert('Failed to update stocks: ' + (err.response?.data?.error || err.message));
    } finally {
      setUpdating(false);
      setUpdateProgress({ current: 0, total: 0 });
      setUpdatingStocks([]);
    }
  };

  const handleUpdateSingle = async (id: number, source?: 'grok' | 'alphavantage') => {
    if (!source) return;

    console.log(`🔄 Starting update for stock ${id} from ${source}`);
    try {
      setUpdatingStocks(prev => [...prev, { stockId: id, source }]);
      const response = await stockAPI.updateSingle(id, source);
      console.log(`✅ Update response:`, response.data);
      invalidateCache('portfolio'); // Invalidate cache
      // Small delay to ensure backend has processed
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log(`📊 Fetching fresh data...`);
      await fetchData(true);
      console.log(`✅ Data refresh complete`);
    } catch (err: any) {
      console.error(`❌ Update failed:`, err);
      if (err.response?.status === 404) {
        alert('Stock not found. The database may have been reset. Refreshing the page...');
        await fetchData();
      } else {
        alert('Failed to update stock: ' + (err.response?.data?.error || err.message));
      }
    } finally {
      setUpdatingStocks(prev => prev.filter(item => !(item.stockId === id && item.source === source)));
      console.log(`🏁 Update complete for stock ${id} from ${source}`);
    }
  };

  const handlePriceUpdate = async (id: number, newPrice: number) => {
    try {
      await stockAPI.updatePrice(id, newPrice);
      invalidateCache('portfolio'); // Invalidate cache
      await fetchData(true);
    } catch (err: any) {
      alert('Failed to update price: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleFieldUpdate = async (id: number, field: string, value: number) => {
    try {
      await stockAPI.updateField(id, field, value);
      invalidateCache('portfolio'); // Invalidate cache
      await fetchData(true);
    } catch (err: any) {
      alert('Failed to update field: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSelectStock = (id: number) => {
    setSelectedStockIds(prev =>
      prev.includes(id)
        ? prev.filter(stockId => stockId !== id)
        : [...prev, id]
    );
  };

  const handleSelectAllPortfolio = (selected: boolean) => {
    if (selected) {
      const stockIds = stocks.filter(s => s.shares_owned > 0).map(s => s.id);
      setSelectedStockIds(prev => [...new Set([...prev, ...stockIds])]);
    } else {
      const stockIds = stocks.filter(s => s.shares_owned > 0).map(s => s.id);
      setSelectedStockIds(prev => prev.filter(id => !stockIds.includes(id)));
    }
  };

  const handleSelectAllWatchlist = (selected: boolean) => {
    if (selected) {
      const watchlistIds = stocks.filter(s => s.shares_owned === 0 || !s.shares_owned).map(s => s.id);
      setSelectedStockIds(prev => [...new Set([...prev, ...watchlistIds])]);
    } else {
      const watchlistIds = stocks.filter(s => s.shares_owned === 0 || !s.shares_owned).map(s => s.id);
      setSelectedStockIds(prev => prev.filter(id => !watchlistIds.includes(id)));
    }
  };

  const handleDelete = async (id: number) => {
    const reason = prompt('Enter reason for deletion (optional):');
    if (reason === null) return; // User cancelled

    try {
      await stockAPI.delete(id, reason);
      invalidateCache('portfolio'); // Invalidate cache
      await fetchData(true);
      alert('Stock deleted successfully!');
    } catch (err: any) {
      if (err.response?.status === 404) {
        alert('Stock not found. It may have been already deleted. Refreshing the page...');
      await fetchData(true);
      } else {
        alert('Failed to delete stock: ' + (err.response?.data?.error || err.message));
      }
    }
  };

  const handleCollectFairValuesForActive = async () => {
    const activeIds = new Set(stocks.filter((s) => s.shares_owned > 0).map((s) => s.id));
    const selectedActiveIds = selectedStockIds.filter((id) => activeIds.has(id));

    if (selectedActiveIds.length === 0) {
      showCollectNotice('info', 'Select at least one stock in Active Positions to collect fair values.');
      return;
    }

    try {
      setCollectingFairValues(true);
      const controller = new AbortController();
      setCollectAbortController(controller);

      const response = await stockAPI.collectFairValues(selectedActiveIds, undefined, controller.signal);
      invalidateCache('portfolio');
      await fetchData(true);

      const data = response.data || {};
      const updated = data.updated ?? 0;
      const entriesSaved = data.entries_saved ?? data.trusted_entries_saved ?? 0;
      const errors = data.errors ?? 0;
      const details = Array.isArray(data.error_details) ? data.error_details : [];
      const detailText = details.length > 0 ? ` ${details.slice(0, 2).join(' | ')}` : '';
      showCollectNotice(
        errors > 0 ? 'error' : 'success',
        `Fair value sync complete. Updated: ${updated}. Entries saved: ${entriesSaved}. Errors: ${errors}.${detailText}`
      );
    } catch (err: any) {
      if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
        showCollectNotice('info', 'Fair value sync cancelled.');
      } else {
        showCollectNotice('error', 'Failed to collect fair values: ' + (err.response?.data?.error || err.message));
      }
    } finally {
      setCollectingFairValues(false);
      setCollectAbortController(null);
    }
  };

  const handleCancelFairValueSync = () => {
    if (collectAbortController) {
      collectAbortController.abort();
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

      const exportData = selectedStocks.map((stock) => ({
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

      const fileContents = JSON.stringify(exportData, null, 2);
      const url = window.URL.createObjectURL(new Blob([fileContents], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `portfolio-selected-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to export JSON: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleLogout = () => {
    removeToken();
    router.push('/login');
  };

  const parseNumericInput = (value: string): number => {
    const normalized = value.replace(',', '.').trim();
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatNumber = (value: number, decimals: number = 2): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading portfolio...</p>
        </div>
      </div>
    );
  }

  const portfolioTotalEur = metrics?.total_value || 0;
  const currentPriceValue = parseNumericInput(calculatorCurrentPrice);
  const targetPercentValue = parseNumericInput(calculatorTargetPercent);
  const calculatorReady = portfolioTotalEur > 0 && currentPriceValue > 0 && targetPercentValue > 0;
  const targetSpendEur = calculatorReady ? (portfolioTotalEur * targetPercentValue) / 100 : 0;
  const sharesToBuy = calculatorReady ? Math.floor(targetSpendEur / currentPriceValue) : 0;
  const estimatedSpendForWholeShares = calculatorReady ? sharesToBuy * currentPriceValue : 0;
  const unallocatedRemainder = calculatorReady ? Math.max(0, targetSpendEur - estimatedSpendForWholeShares) : 0;

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-white">Portfolio Dashboard</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Kelly Criterion Analysis • v{FRONTEND_VERSION} / v{backendVersion}
              </p>
            </div>

            <div className="flex items-center space-x-3">
              {/* Compact API Status */}
              {apiStatus && (
                <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-gray-700/50 backdrop-blur-sm border border-gray-600">
                  {/* Alpha Vantage */}
                  <div className="flex items-center space-x-1.5" title={`Alpha Vantage: ${apiStatus.alpha_vantage?.status || 'unknown'}`}>
                    <span className="text-xs">📊</span>
                    <div className={`h-2 w-2 rounded-full ${
                      apiStatus.alpha_vantage?.status === 'connected' ? 'bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500' :
                      apiStatus.alpha_vantage?.status === 'error' ? 'bg-red-500' : 'bg-gray-500'
                    }`}></div>
                  </div>

                  <div className="h-3 w-px bg-gray-600"></div>

                  {/* Grok */}
                  <div className="flex items-center space-x-1.5" title={`Grok AI: ${apiStatus.grok.status}`}>
                    <span className="text-xs">🤖</span>
                    <div className={`h-2 w-2 rounded-full ${
                      apiStatus.grok.status === 'connected' ? 'bg-violet-500 animate-pulse shadow-sm shadow-violet-500' :
                      apiStatus.grok.status === 'error' ? 'bg-red-500' : 'bg-amber-500'
                    }`}></div>
                  </div>

                  <button
                    onClick={handleTestAPI}
                    disabled={checkingAPI}
                    className="text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50 ml-1"
                    title="Refresh API status"
                  >
                    {checkingAPI ? '⟳' : '↻'}
                  </button>
                </div>
              )}

              {/* Navigation Group */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => router.push('/assessment')}
                  className="p-2 bg-gray-700/50 text-gray-300 rounded-lg hover:bg-indigo-600 hover:text-white transition-all"
                  title="Stock Assessment"
                >
                  <ChartBarIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => router.push('/settings')}
                  className="p-2 bg-gray-700/50 text-gray-300 rounded-lg hover:bg-gray-600 hover:text-white transition-all"
                  title="Settings"
                >
                  <Cog6ToothIcon className="h-5 w-5" />
                </button>
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center px-3 py-2 bg-red-600/90 text-white rounded-lg hover:bg-red-600 transition-all shadow-sm"
                title="Logout"
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 bg-red-900 bg-opacity-50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Portfolio Summary */}
        {metrics && <PortfolioSummary metrics={metrics} units={units} />}

        {/* Compact Status Bar */}
        <div className="mb-4 flex items-center justify-between text-xs px-1">
          <span className="text-gray-400">{stocks.length} positions tracked</span>

          {apiStatus && (apiStatus.alpha_vantage?.status === 'not_configured' || apiStatus.grok.status === 'not_configured' ||
                        apiStatus.alpha_vantage?.status === 'error' || apiStatus.grok.status === 'error') && (
            <div className="flex items-center space-x-2 text-gray-400">
              <span className="text-amber-500">⚠️</span>
              <span>API configuration needed</span>
              <a
                href="https://www.alphavantage.co/support/#api-key"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 underline ml-2"
              >
                Alpha Vantage
              </a>
              <span>•</span>
              <a
                href="https://console.x.ai/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-400 hover:text-violet-300 underline"
              >
                Grok AI
              </a>
            </div>
          )}
        </div>

        {/* Selection Info */}
        {selectedStockIds.length > 0 && (
          <div className="mb-4 bg-indigo-900/20 border border-indigo-700/50 rounded-lg px-3 py-2 flex items-center justify-between backdrop-blur-sm">
            <span className="text-sm text-indigo-200">
              ✓ {selectedStockIds.length} selected
            </span>
            <button
              onClick={() => setSelectedStockIds([])}
              className="text-xs text-indigo-300 hover:text-indigo-100 underline"
            >
              Clear
            </button>
          </div>
        )}

        {/* Action Toolbar - Organized by Purpose */}
        <div className="mb-6 flex flex-wrap gap-3">
          {/* Primary Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-md hover:shadow-lg"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Position
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

          {/* Data Source Updates */}
          <div className="flex gap-2 pl-3 border-l border-gray-700">
            <button
              onClick={() => handleUpdateAll('alphavantage')}
              disabled={updating || stocks.length === 0}
              className="flex items-center px-3 py-2 bg-emerald-600/90 text-white rounded-lg hover:bg-emerald-600 transition-all disabled:opacity-50 shadow-sm"
              title={selectedStockIds.length > 0 ? `Update ${selectedStockIds.length} selected positions` : "Update all positions from Alpha Vantage"}
            >
              <span className="text-sm">📊</span>
              <span className="ml-1.5 text-sm font-medium">
                {updating ? `${updateProgress.current}/${updateProgress.total}` : selectedStockIds.length > 0 ? `(${selectedStockIds.length})` : 'Market Data'}
              </span>
            </button>
            <button
              onClick={() => handleUpdateAll('grok')}
              disabled={updating || stocks.length === 0}
              className="flex items-center px-3 py-2 bg-violet-600/90 text-white rounded-lg hover:bg-violet-600 transition-all disabled:opacity-50 shadow-sm"
              title={selectedStockIds.length > 0 ? `Update ${selectedStockIds.length} selected positions` : "Update all positions from Grok AI"}
            >
              <span className="text-sm">🤖</span>
              <span className="ml-1.5 text-sm font-medium">
                {updating ? `${updateProgress.current}/${updateProgress.total}` : selectedStockIds.length > 0 ? `(${selectedStockIds.length})` : 'AI Analysis'}
              </span>
            </button>
          </div>

          {/* Import/Export */}
          <div className="flex gap-2 pl-3 border-l border-gray-700">
            <button
              onClick={() => setShowJsonUploadModal(true)}
              className="flex items-center px-3 py-2 bg-teal-600/90 text-white rounded-lg hover:bg-teal-600 transition-all shadow-sm"
              title="Import portfolio"
            >
              <ArrowUpTrayIcon className="h-4 w-4 mr-1.5" />
              <span className="text-sm font-medium">Import</span>
            </button>
            <button
              onClick={handleExportJSON}
              className="flex items-center px-3 py-2 bg-teal-600/90 text-white rounded-lg hover:bg-teal-600 transition-all shadow-sm"
              title={selectedStockIds.length > 0 ? `Export ${selectedStockIds.length} selected stock(s)` : 'Select stocks to export'}
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-1.5" />
              <span className="text-sm font-medium">
                {selectedStockIds.length > 0 ? `Export (${selectedStockIds.length})` : 'Export'}
              </span>
            </button>
          </div>
        </div>

        {/* Position Size Calculator */}
        <div className="mb-6 bg-gray-800 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Position Size Calculator</h3>
            <span className="text-xs text-gray-400">
              Portfolio Total: {portfolioTotalEur > 0 ? `${formatNumber(portfolioTotalEur)} EUR` : 'N/A'}
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Enter stock name, current price, and target portfolio %. The calculator shows the EUR amount to allocate and how many shares you can buy.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <input
              type="text"
              value={calculatorTicker}
              onChange={(e) => setCalculatorTicker(e.target.value)}
              placeholder="Stock name or ticker (e.g., MSFT)"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input
              type="text"
              inputMode="decimal"
              value={calculatorCurrentPrice}
              onChange={(e) => setCalculatorCurrentPrice(e.target.value)}
              placeholder="Current price (local currency)"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input
              type="text"
              inputMode="decimal"
              value={calculatorTargetPercent}
              onChange={(e) => setCalculatorTargetPercent(e.target.value)}
              placeholder="Target weight % (e.g., 5)"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {calculatorReady ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="bg-gray-700/60 rounded-lg p-3 border border-gray-600">
                <div className="text-gray-400 mb-1">Target spend (EUR)</div>
                <div className="text-emerald-300 font-semibold">{formatNumber(targetSpendEur)} EUR</div>
              </div>
              <div className="bg-gray-700/60 rounded-lg p-3 border border-gray-600">
                <div className="text-gray-400 mb-1">Shares you can buy</div>
                <div className="text-white font-semibold">{sharesToBuy}</div>
                <div className="text-xs text-gray-500 mt-1">Based on whole shares only</div>
              </div>
              <div className="bg-gray-700/60 rounded-lg p-3 border border-gray-600">
                <div className="text-gray-400 mb-1">Estimated spend / remainder</div>
                <div className="text-white font-semibold">{formatNumber(estimatedSpendForWholeShares)} / {formatNumber(unallocatedRemainder)} EUR</div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-amber-300 bg-amber-900/20 border border-amber-700/40 rounded-lg px-3 py-2">
              Enter valid current price and target % (greater than 0), and ensure portfolio total is loaded.
            </div>
          )}
        </div>

        {/* Update Progress Bar */}
        {updating && updateProgress.total > 0 && (
          <div className="mb-4 bg-gradient-to-r from-gray-800 to-gray-800/50 rounded-lg p-3 border border-gray-700/50 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-300 font-medium">
                Processing {updateProgress.current} / {updateProgress.total}
              </span>
              <span className="text-xs text-indigo-400 font-semibold">
                {Math.round((updateProgress.current / updateProgress.total) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 to-violet-500 h-2 rounded-full transition-all duration-300 shadow-sm"
                style={{ width: `${(updateProgress.current / updateProgress.total) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Portfolio Section (Owned Stocks) */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-white flex items-center">
              <span className="text-emerald-500 mr-2">●</span>
              Active Positions
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCollectFairValuesForActive}
                disabled={collectingFairValues}
                className="flex items-center px-3 py-1.5 bg-amber-600/90 text-white rounded-lg hover:bg-amber-600 transition-all disabled:opacity-50 shadow-sm text-xs font-medium"
                title="Collect trusted fair values via Grok and Deepseek for selected active positions"
              >
                {collectingFairValues ? 'Collecting...' : `Fair Value Sync (${selectedStockIds.filter(id => stocks.some(s => s.id === id && s.shares_owned > 0)).length})`}
              </button>
              {collectingFairValues && (
                <button
                  onClick={handleCancelFairValueSync}
                  className="flex items-center px-3 py-1.5 bg-red-700/90 text-white rounded-lg hover:bg-red-700 transition-all shadow-sm text-xs font-medium"
                  title="Cancel current fair value sync request"
                >
                  Cancel
                </button>
              )}
              <span className="text-xs text-gray-400 bg-gray-800/50 px-2 py-1 rounded">
                {stocks.filter(s => s.shares_owned > 0).length}
              </span>
            </div>
          </div>
          {collectNotice && (
            <div
              className={`mb-3 rounded-lg px-3 py-2 text-sm border ${
                collectNotice.type === 'success'
                  ? 'bg-emerald-900/30 border-emerald-700 text-emerald-200'
                  : collectNotice.type === 'error'
                    ? 'bg-red-900/30 border-red-700 text-red-200'
                    : 'bg-blue-900/30 border-blue-700 text-blue-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="whitespace-pre-wrap">{collectNotice.message}</span>
                <button
                  onClick={() => setCollectNotice(null)}
                  className="text-lg leading-none opacity-80 hover:opacity-100"
                  title="Close notification"
                >
                  x
                </button>
              </div>
            </div>
          )}
          <StockTable
            stocks={stocks.filter(s => s.shares_owned > 0)}
            onDelete={handleDelete}
            onUpdate={handleUpdateSingle}
            onPriceUpdate={handlePriceUpdate}
            onFieldUpdate={handleFieldUpdate}
            updatingStocks={updatingStocks}
            selectedStockIds={selectedStockIds}
            onSelectStock={handleSelectStock}
            onSelectAll={handleSelectAllPortfolio}
            onTickerUpdate={fetchData}
            units={units}
          />
        </div>

        {/* Divider */}
        {stocks.filter(s => s.shares_owned > 0).length > 0 && stocks.filter(s => s.shares_owned === 0 || !s.shares_owned).length > 0 && (
          <div className="my-8 border-t border-gray-700"></div>
        )}

        {/* Watchlist Section (Non-Owned Stocks) */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-white flex items-center">
              <span className="text-amber-500 mr-2">○</span>
              Watchlist
            </h2>
            <span className="text-xs text-gray-400 bg-gray-800/50 px-2 py-1 rounded">
              {stocks.filter(s => s.shares_owned === 0 || !s.shares_owned).length}
            </span>
          </div>
          <StockTable
            stocks={stocks.filter(s => s.shares_owned === 0 || !s.shares_owned)}
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
          />
        </div>

        {/* Additional Tools - Collapsible Sections */}
        <div className="mt-10 pt-8 border-t border-gray-700/50">
          <details className="group mb-6">
            <summary className="cursor-pointer list-none hover:opacity-80 transition-opacity">
              <div className="flex items-center justify-between mb-3 select-none">
                <h2 className="text-lg font-bold text-white inline-flex items-center">
                  <span className="text-teal-500 mr-2">💰</span>
                  Cash Management
                  <span className="ml-2 text-xs text-gray-500 group-open:rotate-180 transition-transform duration-200">▼</span>
                </h2>
              </div>
            </summary>
            <div className="mt-3 animate-in fade-in duration-200">
              <CashManagementTable />
            </div>
          </details>

          <details className="group">
            <summary className="cursor-pointer list-none hover:opacity-80 transition-opacity">
              <div className="flex items-center justify-between mb-3 select-none">
                <h2 className="text-lg font-bold text-white inline-flex items-center">
                  <span className="text-blue-500 mr-2">💱</span>
                  Exchange Rates
                  <span className="ml-2 text-xs text-gray-500 group-open:rotate-180 transition-transform duration-200">▼</span>
                </h2>
              </div>
            </summary>
            <div className="mt-3 animate-in fade-in duration-200">
              <ExchangeRateTable />
            </div>
          </details>
        </div>
      </main>

      {/* Add Stock Modal */}
      {showAddModal && (
        <AddStockModal
          onClose={() => setShowAddModal(false)}
          onSuccess={async () => {
            console.log('Stock added successfully, refreshing data...');
            setShowAddModal(false);
            invalidateCache('portfolio');
            // Add a small delay to ensure backend has processed the stock
            await new Promise(resolve => setTimeout(resolve, 500));
            await fetchData(true);
          }}
        />
      )}

      {/* JSON Upload Modal */}
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

