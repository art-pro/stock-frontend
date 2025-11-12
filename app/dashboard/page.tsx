'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, removeToken } from '@/lib/auth';
import { stockAPI, portfolioAPI, versionAPI, Stock, PortfolioMetrics } from '@/lib/api';
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

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Try portfolio summary first
      const response = await portfolioAPI.getSummary();
      console.log('Portfolio API Response:', response.data);
      console.log('Stocks received:', response.data.stocks);
      
      // Also try fetching stocks directly to check if there's a difference
      const directStocksResponse = await stockAPI.getAll();
      console.log('Direct stocks API response:', directStocksResponse.data);
      
      // Use direct stocks if portfolio doesn't return them
      const stocksData = response.data.stocks || directStocksResponse.data || [];
      console.log('Final stocks to display:', stocksData);
      
      setStocks(stocksData);
      setMetrics(response.data.summary || null);
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
          await fetchData();
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
      // Small delay to ensure backend has processed
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log(`📊 Fetching fresh data...`);
      await fetchData();
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
      await fetchData();
    } catch (err: any) {
      alert('Failed to update price: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleFieldUpdate = async (id: number, field: string, value: number) => {
    try {
      await stockAPI.updateField(id, field, value);
      await fetchData();
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
      const portfolioIds = stocks.filter(s => s.shares_owned > 0).map(s => s.id);
      setSelectedStockIds(prev => [...new Set([...prev, ...portfolioIds])]);
    } else {
      const portfolioIds = stocks.filter(s => s.shares_owned > 0).map(s => s.id);
      setSelectedStockIds(prev => prev.filter(id => !portfolioIds.includes(id)));
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
      await fetchData();
      alert('Stock deleted successfully!');
    } catch (err: any) {
      if (err.response?.status === 404) {
        alert('Stock not found. It may have been already deleted. Refreshing the page...');
        await fetchData();
      } else {
        alert('Failed to delete stock: ' + (err.response?.data?.error || err.message));
      }
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await stockAPI.exportCSV();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `stocks-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      alert('Failed to export CSV: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await stockAPI.importCSV(file);
      await fetchData();
      alert('CSV imported successfully!');
    } catch (err: any) {
      alert('Failed to import CSV: ' + (err.response?.data?.error || err.message));
    }
    e.target.value = ''; // Reset file input
  };

  const handleLogout = () => {
    removeToken();
    router.push('/login');
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

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">Stock Portfolio Tracker</h1>
              <p className="text-sm text-gray-400 mt-1">
                Kelly Criterion & Expected Value Analysis
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Frontend: v{FRONTEND_VERSION} | Backend: v{backendVersion}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {/* API Status Indicators */}
              {apiStatus && (
                <div className="flex items-center space-x-3">
                  {/* Alpha Vantage Status */}
                  <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-gray-700">
                    <span className="text-xs">📊</span>
                    {apiStatus.alpha_vantage?.status === 'connected' && (
                      <>
                        <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
                        <span className="text-sm text-blue-400 font-medium">Alpha Vantage</span>
                      </>
                    )}
                    {apiStatus.alpha_vantage?.status === 'not_configured' && (
                      <>
                        <div className="h-2 w-2 rounded-full bg-gray-500"></div>
                        <span className="text-sm text-gray-400 font-medium">AV Off</span>
                      </>
                    )}
                    {apiStatus.alpha_vantage?.status === 'error' && (
                      <>
                        <div className="h-2 w-2 rounded-full bg-red-500"></div>
                        <span className="text-sm text-red-400 font-medium">AV Error</span>
                      </>
                    )}
                  </div>

                  {/* Grok Status */}
                  <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-gray-700">
                    <span className="text-xs">🤖</span>
                    {apiStatus.grok.status === 'connected' && (
                      <>
                        <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse"></div>
                        <span className="text-sm text-purple-400 font-medium">Grok AI</span>
                      </>
                    )}
                    {apiStatus.grok.status === 'not_configured' && (
                      <>
                        <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                        <span className="text-sm text-yellow-400 font-medium">Mock</span>
                      </>
                    )}
                    {apiStatus.grok.status === 'error' && (
                      <>
                        <div className="h-2 w-2 rounded-full bg-red-500"></div>
                        <span className="text-sm text-red-400 font-medium">Grok Error</span>
                      </>
                    )}
                  </div>
                  
                  <button
                    onClick={handleTestAPI}
                    disabled={checkingAPI}
                    className="text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50 px-2 py-1 bg-gray-700 rounded"
                    title="Test API connections"
                  >
                    {checkingAPI ? '...' : 'Test'}
                  </button>
                </div>
              )}
              
              <button
                onClick={() => router.push('/assessment')}
                className="flex items-center px-3 py-2 bg-primary-700 text-white rounded-lg hover:bg-primary-600 transition-colors"
                title="Stock Assessment"
              >
                <ChartBarIcon className="h-5 w-5 mr-2" />
                <span className="hidden sm:inline">Assessment</span>
              </button>
              <button
                onClick={() => router.push('/settings')}
                className="flex items-center px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                title="Settings"
              >
                <Cog6ToothIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => router.push('/log')}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                View Log
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5 mr-2" />
                Logout
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
        {metrics && <PortfolioSummary metrics={metrics} />}
        
        {/* API Status Info */}
        <div className="mb-4 space-y-3">
          <div className="text-sm text-gray-400">
            Stocks loaded: {stocks.length}
          </div>
          
          {/* Alpha Vantage Status Messages */}
          {apiStatus && apiStatus.alpha_vantage?.status === 'not_configured' && (
            <div className="flex items-center space-x-2 px-3 py-2 bg-gray-900 bg-opacity-30 border border-gray-700 rounded-lg">
              <span className="text-sm text-gray-300">
                📊 Alpha Vantage not configured. Add <code className="px-1 py-0.5 bg-gray-800 rounded">ALPHA_VANTAGE_API_KEY</code> for real-time financial data.
              </span>
              <a
                href="https://www.alphavantage.co/support/#api-key"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 underline"
              >
                Get Free Key
              </a>
            </div>
          )}
          {apiStatus && apiStatus.alpha_vantage?.status === 'connected' && (
            <div className="flex items-center space-x-2 px-3 py-2 bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg">
              <span className="text-sm text-blue-300">
                ✓ Alpha Vantage Connected - Real-time financial data active
              </span>
            </div>
          )}
          {apiStatus && apiStatus.alpha_vantage?.status === 'error' && (
            <div className="flex items-center space-x-2 px-3 py-2 bg-red-900 bg-opacity-30 border border-red-700 rounded-lg">
              <span className="text-sm text-red-300">
                ⚠️ Alpha Vantage Error: {apiStatus.alpha_vantage.error || 'Connection failed'}
              </span>
            </div>
          )}

          {/* Grok Status Messages */}
          {apiStatus && apiStatus.grok.status === 'not_configured' && (
            <div className="flex items-center space-x-2 px-3 py-2 bg-yellow-900 bg-opacity-30 border border-yellow-700 rounded-lg">
              <span className="text-sm text-yellow-300">
                🤖 Using mock data. Add <code className="px-1 py-0.5 bg-gray-800 rounded">XAI_API_KEY</code> to .env for Grok AI analytics.
              </span>
              <a
                href="https://console.x.ai/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-yellow-400 hover:text-yellow-300 underline"
              >
                Get API Key
              </a>
            </div>
          )}
          {apiStatus && apiStatus.grok.status === 'connected' && (
            <div className="flex items-center space-x-2 px-3 py-2 bg-purple-900 bg-opacity-30 border border-purple-700 rounded-lg">
              <span className="text-sm text-purple-300">
                ✓ Grok AI Connected - Analytical data active
              </span>
            </div>
          )}
          {apiStatus && apiStatus.grok.status === 'error' && (
            <div className="flex items-center space-x-2 px-3 py-2 bg-red-900 bg-opacity-30 border border-red-700 rounded-lg">
              <span className="text-sm text-red-300">
                ⚠️ Grok API Error: {apiStatus.grok.error || 'Connection failed'}
              </span>
            </div>
          )}
        </div>

        {/* Selection Info */}
        {selectedStockIds.length > 0 && (
          <div className="mb-4 bg-primary-900 bg-opacity-30 border border-primary-700 rounded-lg p-3 flex items-center justify-between">
            <span className="text-sm text-primary-200">
              ✓ {selectedStockIds.length} stock{selectedStockIds.length > 1 ? 's' : ''} selected - Updates will only apply to selected stocks
            </span>
            <button
              onClick={() => setSelectedStockIds([])}
              className="text-xs text-primary-300 hover:text-primary-100 underline"
            >
              Clear selection
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Stock
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh stock list"
          >
            <ArrowPathIcon className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => handleUpdateAll('alphavantage')}
            disabled={updating || stocks.length === 0}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={selectedStockIds.length > 0 
              ? `Update ${selectedStockIds.length} selected stock(s) from Alpha Vantage`
              : "Update all stocks from Alpha Vantage (or select specific stocks first)"}
          >
            <ArrowPathIcon className={`h-5 w-5 mr-2 ${updating ? 'animate-spin' : ''}`} />
            📊 {updating 
              ? `Updating (${updateProgress.current}/${updateProgress.total})...` 
              : selectedStockIds.length > 0 
                ? `Update ${selectedStockIds.length} from Alpha Vantage`
                : 'Update from Alpha Vantage'}
          </button>
          <button
            onClick={() => handleUpdateAll('grok')}
            disabled={updating || stocks.length === 0}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={selectedStockIds.length > 0 
              ? `Update ${selectedStockIds.length} selected stock(s) from Grok AI`
              : "Update all stocks from Grok AI (or select specific stocks first)"}
          >
            <ArrowPathIcon className={`h-5 w-5 mr-2 ${updating ? 'animate-spin' : ''}`} />
            🤖 {updating 
              ? `Updating (${updateProgress.current}/${updateProgress.total})...` 
              : selectedStockIds.length > 0 
                ? `Update ${selectedStockIds.length} from Grok AI`
                : 'Update from Grok AI'}
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
            Export CSV
          </button>
          <label className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
            <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
            Import CSV
            <input
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              className="hidden"
            />
          </label>
          <button
            onClick={() => setShowJsonUploadModal(true)}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <DocumentArrowUpIcon className="h-5 w-5 mr-2" />
            Upload JSON
          </button>
          <button
            onClick={() => router.push('/assessment')}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <ChartBarIcon className="h-5 w-5 mr-2" />
            Stock Assessment
          </button>
        </div>
        
        {/* Update Progress Bar */}
        {updating && updateProgress.total > 0 && (
          <div className="mb-6 bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-300">
                Updating stocks from Grok... {updateProgress.current} of {updateProgress.total}
              </span>
              <span className="text-sm text-gray-400">
                {Math.round((updateProgress.current / updateProgress.total) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <div
                className="bg-primary-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${(updateProgress.current / updateProgress.total) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Info Card */}
        <div className="mb-6 bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg p-4">
          <p className="text-sm text-blue-200 mb-3">
            <span className="font-semibold">💡 Tip:</span> Your stocks are organized into two sections:
            <span className="font-medium ml-1">Portfolio</span> shows stocks you own (shares &gt; 0), and
            <span className="font-medium ml-1">Watchlist</span> shows stocks you&rsquo;re tracking (0 shares).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-blue-100">
            <div className="bg-blue-950 bg-opacity-40 rounded p-3">
              <div className="font-semibold mb-1">📊 Alpha Vantage (Raw Data)</div>
              <div className="text-blue-200">Current price, beta, P/E ratio, EPS growth, dividend yield, analyst targets</div>
            </div>
            <div className="bg-purple-950 bg-opacity-40 rounded p-3">
              <div className="font-semibold mb-1">🤖 Grok AI (Analytical)</div>
              <div className="text-purple-200">Probability (p), EV, Kelly sizing, assessments, downside risk, recommendations</div>
            </div>
          </div>
        </div>

        {/* Cash Management Section */}
        <div className="mb-8">
          <CashManagementTable />
        </div>

        {/* Portfolio Section (Owned Stocks) */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">📈 Portfolio (Owned Stocks)</h2>
            <span className="text-sm text-gray-400">
              {stocks.filter(s => s.shares_owned > 0).length} stocks
            </span>
          </div>
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
          />
        </div>

        {/* Divider */}
        {stocks.filter(s => s.shares_owned > 0).length > 0 && stocks.filter(s => s.shares_owned === 0 || !s.shares_owned).length > 0 && (
          <div className="my-8 border-t border-gray-700"></div>
        )}

        {/* Watchlist Section (Non-Owned Stocks) */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">👁️ Watchlist</h2>
            <span className="text-sm text-gray-400">
              {stocks.filter(s => s.shares_owned === 0 || !s.shares_owned).length} stocks
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
          />
        </div>
        
        {/* Exchange Rates Section */}
        <div className="my-8">
          <ExchangeRateTable />
        </div>
      </main>

      {/* Add Stock Modal */}
      {showAddModal && (
        <AddStockModal
          onClose={() => setShowAddModal(false)}
          onSuccess={async () => {
            console.log('Stock added successfully, refreshing data...');
            setShowAddModal(false);
            // Add a small delay to ensure backend has processed the stock
            await new Promise(resolve => setTimeout(resolve, 500));
            await fetchData();
          }}
        />
      )}

      {/* JSON Upload Modal */}
      <JsonUploadModal
        isOpen={showJsonUploadModal}
        onClose={() => setShowJsonUploadModal(false)}
        onSuccess={async () => {
          setShowJsonUploadModal(false);
          await fetchData();
        }}
      />
    </div>
  );
}

