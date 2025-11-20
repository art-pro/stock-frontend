'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { Portfolio, portfolioAPI } from '@/lib/api';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  StarIcon,
  BriefcaseIcon,
} from '@heroicons/react/24/outline';

export default function PortfoliosPage() {
  const router = useRouter();
  const {
    portfolios,
    currentPortfolio,
    loading,
    setCurrentPortfolio,
    refreshPortfolios,
    createPortfolio,
    updatePortfolio,
    deletePortfolio,
    setDefaultPortfolio,
  } = usePortfolio();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);
  const [portfolioStats, setPortfolioStats] = useState<Record<number, any>>({});
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    loadPortfolioStats();
  }, [router, portfolios]);

  const loadPortfolioStats = async () => {
    if (portfolios.length === 0) return;

    setLoadingStats(true);
    const stats: Record<number, any> = {};

    for (const portfolio of portfolios) {
      try {
        const response = await portfolioAPI.getPortfolioSummary(portfolio.id);
        stats[portfolio.id] = {
          totalValue: response.data.summary?.total_value || 0,
          ev: response.data.summary?.overall_ev || 0,
          sharpe: response.data.summary?.sharpe_ratio || 0,
          volatility: response.data.summary?.weighted_volatility || 0,
          stockCount: response.data.stocks?.length || 0,
        };
      } catch (err) {
        console.error(`Failed to load stats for portfolio ${portfolio.id}:`, err);
        stats[portfolio.id] = {
          totalValue: 0,
          ev: 0,
          sharpe: 0,
          volatility: 0,
          stockCount: 0,
        };
      }
    }

    setPortfolioStats(stats);
    setLoadingStats(false);
  };

  const handleCreatePortfolio = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const isDefault = formData.get('is_default') === 'on';

    try {
      await createPortfolio({ name, description, is_default: isDefault });
      setShowCreateModal(false);
      await loadPortfolioStats();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEditPortfolio = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPortfolio) return;

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;

    try {
      await updatePortfolio(selectedPortfolio.id, { name, description });
      setShowEditModal(false);
      setSelectedPortfolio(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeletePortfolio = async () => {
    if (!selectedPortfolio) return;

    // Check if it's the default portfolio
    if (selectedPortfolio.is_default) {
      alert('Cannot delete the default portfolio. Set another portfolio as default first.');
      return;
    }

    // Check if it has stocks
    const stats = portfolioStats[selectedPortfolio.id];
    if (stats && stats.stockCount > 0) {
      alert(`Cannot delete portfolio with ${stats.stockCount} stocks. Remove all stocks first.`);
      return;
    }

    try {
      await deletePortfolio(selectedPortfolio.id);
      setShowDeleteModal(false);
      setSelectedPortfolio(null);
      await loadPortfolioStats();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSetDefault = async (portfolio: Portfolio) => {
    try {
      await setDefaultPortfolio(portfolio.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSelectPortfolio = (portfolio: Portfolio) => {
    setCurrentPortfolio(portfolio);
    router.push('/dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading portfolios...</p>
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
              <h1 className="text-2xl font-bold text-white flex items-center">
                <BriefcaseIcon className="h-8 w-8 mr-3 text-primary-500" />
                Portfolio Management
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Manage your investment portfolios
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Back to Dashboard
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Create Portfolio
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {portfolios.length === 0 ? (
          <div className="text-center py-12">
            <BriefcaseIcon className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-300 mb-2">No Portfolios Yet</h2>
            <p className="text-gray-400 mb-6">Create your first portfolio to get started</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Create Your First Portfolio
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {portfolios.map((portfolio) => {
              const stats = portfolioStats[portfolio.id] || {};
              const isSelected = currentPortfolio?.id === portfolio.id;
              const isDefault = portfolio.is_default;

              return (
                <div
                  key={portfolio.id}
                  className={`relative bg-gray-800 rounded-lg p-6 border-2 transition-all ${
                    isSelected
                      ? 'border-primary-500 shadow-lg shadow-primary-500/20'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  {/* Default Badge */}
                  {isDefault && (
                    <div className="absolute top-3 right-3">
                      <StarIcon className="h-6 w-6 text-yellow-500 fill-yellow-500" />
                    </div>
                  )}

                  {/* Portfolio Header */}
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-white mb-1 pr-8">
                      {portfolio.name}
                    </h3>
                    {portfolio.description && (
                      <p className="text-sm text-gray-400">{portfolio.description}</p>
                    )}
                  </div>

                  {/* Stats */}
                  {loadingStats ? (
                    <div className="animate-pulse space-y-2 mb-4">
                      <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-700 rounded w-1/2"></div>
                      <div className="h-4 bg-gray-700 rounded w-2/3"></div>
                    </div>
                  ) : (
                    <div className="space-y-2 mb-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Total Value:</span>
                        <span className="text-white font-medium">
                          ${stats.totalValue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Expected Value:</span>
                        <span className={`font-medium ${stats.ev >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {stats.ev >= 0 ? '+' : ''}{stats.ev?.toFixed(2) || '0.00'}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Sharpe Ratio:</span>
                        <span className="text-white font-medium">{stats.sharpe?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Volatility:</span>
                        <span className="text-white font-medium">{stats.volatility?.toFixed(2) || '0.00'}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Stocks:</span>
                        <span className="text-white font-medium">{stats.stockCount || 0}</span>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col space-y-2">
                    <button
                      onClick={() => handleSelectPortfolio(portfolio)}
                      className={`flex items-center justify-center px-4 py-2 rounded-lg transition-colors ${
                        isSelected
                          ? 'bg-primary-600 text-white hover:bg-primary-700'
                          : 'bg-gray-700 text-white hover:bg-gray-600'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <CheckCircleIcon className="h-5 w-5 mr-2" />
                          Current Portfolio
                        </>
                      ) : (
                        <>
                          <BriefcaseIcon className="h-5 w-5 mr-2" />
                          Select Portfolio
                        </>
                      )}
                    </button>

                    <div className="flex space-x-2">
                      {!isDefault && (
                        <button
                          onClick={() => handleSetDefault(portfolio)}
                          className="flex-1 flex items-center justify-center px-3 py-2 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700 transition-colors"
                          title="Set as default"
                        >
                          <StarIcon className="h-4 w-4 mr-1" />
                          Set Default
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedPortfolio(portfolio);
                          setShowEditModal(true);
                        }}
                        className="flex-1 flex items-center justify-center px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <PencilIcon className="h-4 w-4 mr-1" />
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPortfolio(portfolio);
                          setShowDeleteModal(true);
                        }}
                        className="flex-1 flex items-center justify-center px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                        disabled={isDefault || (stats.stockCount > 0)}
                      >
                        <TrashIcon className="h-4 w-4 mr-1" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create Portfolio Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-4">Create New Portfolio</h2>
            <form onSubmit={handleCreatePortfolio}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Portfolio Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="e.g., Tech Growth, Dividend Portfolio"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Optional description"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="is_default"
                    id="is_default"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-600 rounded"
                  />
                  <label htmlFor="is_default" className="ml-2 block text-sm text-gray-300">
                    Set as default portfolio
                  </label>
                </div>
              </div>
              <div className="flex space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Portfolio Modal */}
      {showEditModal && selectedPortfolio && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-4">Edit Portfolio</h2>
            <form onSubmit={handleEditPortfolio}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Portfolio Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={selectedPortfolio.name}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    rows={3}
                    defaultValue={selectedPortfolio.description}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div className="flex space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedPortfolio(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedPortfolio && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-4">Delete Portfolio</h2>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete <span className="font-semibold text-white">{selectedPortfolio.name}</span>?
              This action cannot be undone.
            </p>
            {selectedPortfolio.is_default && (
              <div className="mb-4 bg-yellow-900 bg-opacity-30 border border-yellow-700 rounded-lg p-3">
                <p className="text-sm text-yellow-200">
                  ⚠️ This is your default portfolio. Set another portfolio as default before deleting.
                </p>
              </div>
            )}
            {portfolioStats[selectedPortfolio.id]?.stockCount > 0 && (
              <div className="mb-4 bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-3">
                <p className="text-sm text-red-200">
                  ⚠️ This portfolio contains {portfolioStats[selectedPortfolio.id].stockCount} stock(s). Remove all stocks before deleting.
                </p>
              </div>
            )}
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedPortfolio(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePortfolio}
                disabled={selectedPortfolio.is_default || portfolioStats[selectedPortfolio.id]?.stockCount > 0}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
