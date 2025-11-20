'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { Portfolio, portfolioManagementAPI, portfolioAPI, PortfolioMetrics } from '@/lib/api';
import { usePortfolio } from '@/contexts/PortfolioContext';
import {
  PencilIcon,
  TrashIcon,
  PlusIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

interface PortfolioWithStats extends Portfolio {
  stats?: PortfolioMetrics;
}

export default function PortfoliosPage() {
  const router = useRouter();
  const { selectedPortfolioId, setSelectedPortfolioId, refreshPortfolios } = usePortfolio();
  const [portfolios, setPortfolios] = useState<PortfolioWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    fetchPortfolios();
  }, [router]);

  const fetchPortfolios = async () => {
    try {
      setLoading(true);
      const response = await portfolioManagementAPI.getAllPortfolios();
      const portfoliosData = response.data;

      // Fetch stats for each portfolio
      const portfoliosWithStats = await Promise.all(
        portfoliosData.map(async (portfolio) => {
          try {
            const statsResponse = await portfolioAPI.getSummary(portfolio.id.toString());
            return {
              ...portfolio,
              stats: statsResponse.data.summary,
            };
          } catch (err) {
            return portfolio;
          }
        })
      );

      setPortfolios(portfoliosWithStats);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch portfolios');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (portfolioId: string) => {
    try {
      await portfolioManagementAPI.setDefaultPortfolio(portfolioId);
      await fetchPortfolios();
      await refreshPortfolios();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to set default portfolio');
    }
  };

  const handleDelete = async () => {
    if (!selectedPortfolio) return;

    try {
      await portfolioManagementAPI.deletePortfolio(selectedPortfolio.id.toString());
      await fetchPortfolios();
      await refreshPortfolios();
      setShowDeleteModal(false);
      setSelectedPortfolio(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete portfolio');
    }
  };

  const handleViewPortfolio = (portfolioId: string) => {
    setSelectedPortfolioId(portfolioId);
    router.push('/dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Portfolio Management</h1>
              <p className="text-gray-400">
                Manage your investment portfolios and track performance
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              <span>Create Portfolio</span>
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-900 bg-opacity-50 border border-red-700 text-red-200 px-4 py-3 rounded-lg flex items-center">
            <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}

        {/* Portfolio Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {portfolios.map((portfolio) => (
            <div
              key={portfolio.id}
              className={`bg-gray-800 rounded-lg border-2 transition-all ${
                portfolio.id.toString() === selectedPortfolioId
                  ? 'border-primary-500 shadow-lg shadow-primary-500/20'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              {/* Card Header */}
              <div className="p-6 border-b border-gray-700">
                <div className="flex items-start justify-between mb-2">
                  <h2 className="text-xl font-bold text-white">{portfolio.name}</h2>
                  <div className="flex items-center space-x-2">
                    {portfolio.is_default && (
                      <span className="px-2 py-1 bg-primary-600 text-xs rounded-full">
                        Default
                      </span>
                    )}
                    {portfolio.id.toString() === selectedPortfolioId && (
                      <CheckCircleIcon className="h-6 w-6 text-primary-400" />
                    )}
                  </div>
                </div>
                {portfolio.description && (
                  <p className="text-gray-400 text-sm">{portfolio.description}</p>
                )}
              </div>

              {/* Portfolio Stats */}
              {portfolio.stats && (
                <div className="p-6 border-b border-gray-700">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">Total Value</span>
                      <span className="text-white font-semibold">
                        ${portfolio.stats.total_value?.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }) || '0.00'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">Expected Value</span>
                      <span
                        className={`font-semibold ${
                          (portfolio.stats.overall_ev || 0) >= 0
                            ? 'text-green-400'
                            : 'text-red-400'
                        }`}
                      >
                        {portfolio.stats.overall_ev?.toFixed(2) || '0.00'}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">Sharpe Ratio</span>
                      <span className="text-white font-semibold">
                        {portfolio.stats.sharpe_ratio?.toFixed(2) || 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">Volatility</span>
                      <span className="text-white font-semibold">
                        {portfolio.stats.weighted_volatility?.toFixed(2) || 'N/A'}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Card Actions */}
              <div className="p-4 space-y-2">
                <button
                  onClick={() => handleViewPortfolio(portfolio.id.toString())}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <ChartBarIcon className="h-4 w-4" />
                  <span>View Portfolio</span>
                </button>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      setSelectedPortfolio(portfolio);
                      setShowEditModal(true);
                    }}
                    className="flex items-center justify-center px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    title="Edit portfolio"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>

                  {!portfolio.is_default && (
                    <button
                      onClick={() => handleSetDefault(portfolio.id.toString())}
                      className="flex items-center justify-center px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                      title="Set as default"
                    >
                      <CheckCircleIcon className="h-4 w-4" />
                    </button>
                  )}

                  {!portfolio.is_default && (
                    <button
                      onClick={() => {
                        setSelectedPortfolio(portfolio);
                        setShowDeleteModal(true);
                      }}
                      className="flex items-center justify-center px-3 py-2 bg-red-900 bg-opacity-50 text-red-400 rounded-lg hover:bg-red-900 hover:bg-opacity-70 transition-colors"
                      title="Delete portfolio"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Metadata */}
              <div className="px-6 pb-4 text-xs text-gray-500">
                Created: {new Date(portfolio.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {portfolios.length === 0 && (
          <div className="text-center py-12">
            <ChartBarIcon className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">
              No Portfolios Found
            </h3>
            <p className="text-gray-500 mb-4">
              Create your first portfolio to start tracking investments
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Create Portfolio
            </button>
          </div>
        )}
      </div>

      {/* Create Portfolio Modal */}
      <CreatePortfolioModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          fetchPortfolios();
          refreshPortfolios();
        }}
      />

      {/* Edit Portfolio Modal */}
      <EditPortfolioModal
        isOpen={showEditModal}
        portfolio={selectedPortfolio}
        onClose={() => {
          setShowEditModal(false);
          setSelectedPortfolio(null);
        }}
        onSuccess={() => {
          fetchPortfolios();
          refreshPortfolios();
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        portfolio={selectedPortfolio}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedPortfolio(null);
          setError('');
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}

// Create Portfolio Modal
interface CreatePortfolioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function CreatePortfolioModal({ isOpen, onClose, onSuccess }: CreatePortfolioModalProps) {
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await portfolioManagementAPI.createPortfolio(formData);
      onSuccess();
      onClose();
      setFormData({ name: '', description: '' });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create portfolio');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Create New Portfolio</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 bg-red-900 bg-opacity-50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Portfolio Name *
              </label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Growth Portfolio, Tech Stocks"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description (Optional)
              </label>
              <textarea
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this portfolio's strategy"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Portfolio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit Portfolio Modal
interface EditPortfolioModalProps {
  isOpen: boolean;
  portfolio: Portfolio | null;
  onClose: () => void;
  onSuccess: () => void;
}

function EditPortfolioModal({ isOpen, portfolio, onClose, onSuccess }: EditPortfolioModalProps) {
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (portfolio) {
      setFormData({
        name: portfolio.name,
        description: portfolio.description || '',
      });
    }
  }, [portfolio]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portfolio) return;

    setError('');
    setLoading(true);

    try {
      await portfolioManagementAPI.updatePortfolio(portfolio.id.toString(), formData);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update portfolio');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !portfolio) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Edit Portfolio</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 bg-red-900 bg-opacity-50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Portfolio Name *
              </label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Delete Confirmation Modal
interface DeleteConfirmationModalProps {
  isOpen: boolean;
  portfolio: Portfolio | null;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteConfirmationModal({
  isOpen,
  portfolio,
  onClose,
  onConfirm,
}: DeleteConfirmationModalProps) {
  if (!isOpen || !portfolio) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Delete Portfolio</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-start space-x-3 mb-4">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-400 flex-shrink-0 mt-1" />
            <div>
              <p className="text-white mb-2">
                Are you sure you want to delete the portfolio{' '}
                <strong>{portfolio.name}</strong>?
              </p>
              <p className="text-gray-400 text-sm">
                This action cannot be undone. The portfolio must be empty (no stocks) before it can
                be deleted.
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete Portfolio
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
