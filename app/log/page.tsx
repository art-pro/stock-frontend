'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { deletedStockAPI } from '@/lib/api';
import { ArrowLeftIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface DeletedStock {
  id: number;
  ticker: string;
  company_name: string;
  reason: string;
  deleted_at: string;
  deleted_by: string;
  restored_at: string | null;
}

export default function LogPage() {
  const router = useRouter();
  const [deletedStocks, setDeletedStocks] = useState<DeletedStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await deletedStockAPI.getAll();
      setDeletedStocks(response.data);
    } catch (err) {
      console.error(err);
      alert('Failed to load deleted stocks');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id: number) => {
    if (!confirm('Are you sure you want to restore this stock?')) {
      return;
    }

    try {
      await deletedStockAPI.restore(id);
      await fetchData();
      alert('Stock restored successfully!');
    } catch (err: any) {
      alert('Failed to restore stock: ' + (err.response?.data?.error || err.message));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading log...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center text-primary-400 hover:text-primary-300 mb-2"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold text-white">Deleted Stocks Log</h1>
          <p className="text-sm text-gray-400 mt-1">
            View and restore previously deleted stocks
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Ticker
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Company Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Reason
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Deleted By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Deleted At
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {deletedStocks.map((stock) => (
                <tr key={stock.id} className="hover:bg-gray-800">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary-400">
                    {stock.ticker}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                    {stock.company_name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300">
                    {stock.reason || 'No reason provided'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {stock.deleted_by}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {new Date(stock.deleted_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    {!stock.restored_at ? (
                      <button
                        onClick={() => handleRestore(stock.id)}
                        className="flex items-center justify-center mx-auto px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        <ArrowPathIcon className="h-4 w-4 mr-1" />
                        Restore
                      </button>
                    ) : (
                      <span className="text-gray-500">Restored</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {deletedStocks.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p>No deleted stocks found.</p>
          </div>
        )}
      </main>
    </div>
  );
}

