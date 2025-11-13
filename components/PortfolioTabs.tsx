'use client';

import { useState, useEffect } from 'react';
import { portfolioManagementAPI, stockAPI, Stock, Portfolio } from '@/lib/api';
import { 
  PlusIcon, 
  Cog6ToothIcon, 
  TrashIcon,
  StarIcon,
  PencilIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import StockTable from '@/components/StockTable';
import AddPortfolioModal from '@/components/AddPortfolioModal';
import EditPortfolioModal from '@/components/EditPortfolioModal';

interface PortfolioTabsProps {
  onStockChange?: () => void;
  selectedStockIds: number[];
  onSelectedStockIdsChange: (ids: number[]) => void;
  onStockUpdate?: (stockId: number, source?: 'grok' | 'alphavantage') => void;
  onStockDelete?: (id: number) => void;
  onPriceUpdate?: (id: number, newPrice: number) => void;
  onFieldUpdate?: (id: number, field: string, value: number) => void;
  updatingStocks?: Array<{ stockId: number; source: 'grok' | 'alphavantage' }>;
}

export default function PortfolioTabs({ 
  onStockChange, 
  selectedStockIds, 
  onSelectedStockIdsChange,
  onStockUpdate,
  onStockDelete,
  onPriceUpdate,
  onFieldUpdate,
  updatingStocks = []
}: PortfolioTabsProps) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number>(1); // Default to first portfolio
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [portfolioToEdit, setPortfolioToEdit] = useState<Portfolio | null>(null);

  useEffect(() => {
    fetchPortfolios();
  }, []);

  useEffect(() => {
    if (selectedPortfolioId) {
      fetchStocksForPortfolio(selectedPortfolioId);
    }
  }, [selectedPortfolioId]);

  const fetchPortfolios = async () => {
    try {
      const response = await portfolioManagementAPI.getAll();
      const portfolioList = response.data;
      setPortfolios(portfolioList);
      
      // Set default portfolio as selected
      const defaultPortfolio = portfolioList.find(p => p.is_default);
      if (defaultPortfolio) {
        setSelectedPortfolioId(defaultPortfolio.id);
      } else if (portfolioList.length > 0) {
        setSelectedPortfolioId(portfolioList[0].id);
      }
    } catch (err: any) {
      setError('Failed to fetch portfolios: ' + (err.response?.data?.error || err.message));
    }
  };

  const fetchStocksForPortfolio = async (portfolioId: number) => {
    setLoading(true);
    try {
      const response = await stockAPI.getAll(portfolioId);
      setStocks(response.data);
      if (onStockChange) onStockChange();
    } catch (err: any) {
      setError('Failed to fetch stocks: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePortfolio = async (portfolioData: { name: string; description?: string }) => {
    try {
      await portfolioManagementAPI.create(portfolioData);
      fetchPortfolios(); // Refresh portfolio list
      setShowAddModal(false);
    } catch (err: any) {
      alert('Failed to create portfolio: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleEditPortfolio = async (portfolioData: { name: string; description?: string; is_default?: boolean }) => {
    if (!portfolioToEdit) return;
    
    try {
      await portfolioManagementAPI.update(portfolioToEdit.id, portfolioData);
      fetchPortfolios(); // Refresh portfolio list
      setShowEditModal(false);
      setPortfolioToEdit(null);
    } catch (err: any) {
      alert('Failed to update portfolio: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeletePortfolio = async (portfolio: Portfolio) => {
    if (portfolio.id === 1) {
      alert('Cannot delete the default portfolio.');
      return;
    }

    if (!confirm(`Are you sure you want to delete "${portfolio.name}"? All stocks will be moved to the default portfolio.`)) {
      return;
    }

    try {
      await portfolioManagementAPI.delete(portfolio.id);
      fetchPortfolios(); // Refresh portfolio list
      
      // Switch to default portfolio if we deleted the current one
      if (selectedPortfolioId === portfolio.id) {
        setSelectedPortfolioId(1);
      }
    } catch (err: any) {
      alert('Failed to delete portfolio: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSetDefaultPortfolio = async (portfolioId: number) => {
    try {
      await portfolioManagementAPI.setDefault(portfolioId);
      fetchPortfolios(); // Refresh portfolio list to update default status
    } catch (err: any) {
      alert('Failed to set default portfolio: ' + (err.response?.data?.error || err.message));
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getCurrentPortfolio = () => portfolios.find(p => p.id === selectedPortfolioId);

  if (loading && portfolios.length === 0) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading portfolios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-400 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Portfolio Tabs */}
      <div className="border-b border-gray-700">
        <div className="flex flex-wrap items-center justify-between mb-4">
          <div className="flex flex-wrap items-center space-x-1">
            {portfolios.map((portfolio) => (
              <button
                key={portfolio.id}
                onClick={() => setSelectedPortfolioId(portfolio.id)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors relative group ${
                  selectedPortfolioId === portfolio.id
                    ? 'text-blue-400 border-blue-400 bg-gray-800'
                    : 'text-gray-400 border-transparent hover:text-gray-300 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center space-x-2">
                  {portfolio.is_default && (
                    <StarIconSolid className="h-4 w-4 text-yellow-400" />
                  )}
                  <span>{portfolio.name}</span>
                  <span className="text-xs opacity-70">
                    ({formatCurrency(portfolio.total_value)})
                  </span>
                </div>
                
                {/* Tab Controls */}
                <div className="absolute -right-1 -top-1 hidden group-hover:flex items-center space-x-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPortfolioToEdit(portfolio);
                      setShowEditModal(true);
                    }}
                    className="p-1 text-gray-400 hover:text-blue-400 bg-gray-800 rounded-full border border-gray-600"
                    title="Edit Portfolio"
                  >
                    <PencilIcon className="h-3 w-3" />
                  </button>
                  
                  {!portfolio.is_default && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetDefaultPortfolio(portfolio.id);
                      }}
                      className="p-1 text-gray-400 hover:text-yellow-400 bg-gray-800 rounded-full border border-gray-600"
                      title="Set as Default"
                    >
                      <StarIcon className="h-3 w-3" />
                    </button>
                  )}
                  
                  {portfolio.id !== 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePortfolio(portfolio);
                      }}
                      className="p-1 text-gray-400 hover:text-red-400 bg-gray-800 rounded-full border border-gray-600"
                      title="Delete Portfolio"
                    >
                      <TrashIcon className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </button>
            ))}
          </div>
          
          {/* Add Portfolio Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            <span>Add Portfolio</span>
          </button>
        </div>
      </div>

      {/* Current Portfolio Info */}
      {getCurrentPortfolio() && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-semibold text-white">{getCurrentPortfolio()?.name}</h2>
                {getCurrentPortfolio()?.is_default && (
                  <StarIconSolid className="h-5 w-5 text-yellow-400" title="Default Portfolio" />
                )}
              </div>
              {getCurrentPortfolio()?.description && (
                <p className="text-gray-400 text-sm mt-1">{getCurrentPortfolio()?.description}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-white">
                {formatCurrency(getCurrentPortfolio()?.total_value || 0)}
              </p>
              <p className="text-sm text-gray-400">Total Value</p>
            </div>
          </div>
        </div>
      )}

      {/* Stock Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <StockTable
          stocks={stocks}
          selectedStockIds={selectedStockIds}
          onSelectStock={(id) => {
            const newSelected = selectedStockIds.includes(id) 
              ? selectedStockIds.filter(sid => sid !== id)
              : [...selectedStockIds, id];
            onSelectedStockIdsChange(newSelected);
          }}
          onSelectAll={(selected) => {
            if (selected) {
              const allIds = stocks.map(s => s.id);
              onSelectedStockIdsChange([...new Set([...selectedStockIds, ...allIds])]);
            } else {
              const stockIds = stocks.map(s => s.id);
              onSelectedStockIdsChange(selectedStockIds.filter(id => !stockIds.includes(id)));
            }
          }}
          onUpdate={onStockUpdate || (() => {})}
          onDelete={onStockDelete || (() => {})}
          onPriceUpdate={onPriceUpdate || (() => {})}
          onFieldUpdate={onFieldUpdate || (() => {})}
          updatingStocks={updatingStocks}
        />
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddPortfolioModal
          onSave={handleCreatePortfolio}
          onCancel={() => setShowAddModal(false)}
        />
      )}

      {showEditModal && portfolioToEdit && (
        <EditPortfolioModal
          portfolio={portfolioToEdit}
          onSave={handleEditPortfolio}
          onCancel={() => {
            setShowEditModal(false);
            setPortfolioToEdit(null);
          }}
        />
      )}
    </div>
  );
}