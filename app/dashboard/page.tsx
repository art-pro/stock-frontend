'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, removeToken } from '@/lib/auth';
import { stockAPI, portfolioAPI, Stock, PortfolioMetrics } from '@/lib/api';
import StockTable from '@/components/StockTable';
import PortfolioSummary from '@/components/PortfolioSummary';
import AddStockModal from '@/components/AddStockModal';
import {
  PlusIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';

export default function DashboardPage() {
  const router = useRouter();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    fetchData();
  }, [router]);

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

  const handleUpdateAll = async () => {
    try {
      setUpdating(true);
      await stockAPI.updateAll();
      await fetchData();
      alert('All stocks updated successfully!');
    } catch (err: any) {
      alert('Failed to update stocks: ' + (err.response?.data?.error || err.message));
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateSingle = async (id: number) => {
    try {
      await stockAPI.updateSingle(id);
      await fetchData();
      alert('Stock updated successfully!');
    } catch (err: any) {
      alert('Failed to update stock: ' + (err.response?.data?.error || err.message));
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
      alert('Failed to delete stock: ' + (err.response?.data?.error || err.message));
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
            </div>
            <div className="flex space-x-2">
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
        
        {/* Debug Info */}
        <div className="mb-4 text-sm text-gray-400">
          Stocks loaded: {stocks.length}
        </div>

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
            onClick={handleUpdateAll}
            disabled={updating}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowPathIcon className={`h-5 w-5 mr-2 ${updating ? 'animate-spin' : ''}`} />
            {updating ? 'Updating...' : 'Update All Prices'}
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
        </div>

        {/* Stock Table */}
        <StockTable
          stocks={stocks}
          onDelete={handleDelete}
          onUpdate={handleUpdateSingle}
        />
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
    </div>
  );
}

