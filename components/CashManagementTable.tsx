'use client';

import { useState, useEffect } from 'react';
import { CashHolding, cashAPI, exchangeRateAPI, ExchangeRate } from '@/lib/api';
import {
  ArrowPathIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';

export default function CashManagementTable() {
  const [cashHoldings, setCashHoldings] = useState<CashHolding[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState({ amount: 0, description: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCash, setNewCash] = useState({ 
    currency_code: '', 
    amount: 0, 
    description: '' 
  });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cashResponse, ratesResponse] = await Promise.all([
        cashAPI.getAll(),
        exchangeRateAPI.getAll(),
      ]);
      setCashHoldings(cashResponse.data);
      setExchangeRates(ratesResponse.data);
      setError('');
    } catch (err: any) {
      // Check if it's a 500 error from missing endpoint
      if (err.response?.status === 500) {
        setError('Cash management feature not available - backend endpoint missing');
      } else {
        setError('Failed to fetch cash holdings');
      }
      console.error('Error fetching cash data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshEUR = async () => {
    try {
      setRefreshing(true);
      await cashAPI.refreshUSD();
      await fetchData();
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to refresh EUR values');
    } finally {
      setRefreshing(false);
    }
  };

  const handleEdit = (cash: CashHolding) => {
    setEditingId(cash.id);
    setEditValues({ 
      amount: cash.amount, 
      description: cash.description 
    });
  };

  const handleSaveEdit = async (id: number) => {
    try {
      if (editValues.amount < 0) {
        setError('Amount cannot be negative');
        return;
      }
      
      await cashAPI.update(id, {
        amount: editValues.amount,
        description: editValues.description,
      });
      
      await fetchData();
      setEditingId(null);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update cash holding');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValues({ amount: 0, description: '' });
  };

  const handleDelete = async (id: number, currencyCode: string) => {
    if (!confirm(`Are you sure you want to delete ${currencyCode} cash holding?`)) return;
    
    try {
      await cashAPI.delete(id);
      await fetchData();
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete cash holding');
    }
  };

  const handleAdd = async () => {
    try {
      if (!newCash.currency_code || newCash.amount < 0) {
        setError('Please enter valid currency and amount');
        return;
      }
      
      await cashAPI.create({
        currency_code: newCash.currency_code,
        amount: newCash.amount,
        description: newCash.description,
      });
      
      await fetchData();
      setShowAddForm(false);
      setNewCash({ currency_code: '', amount: 0, description: '' });
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add cash holding');
    }
  };

  const formatCurrency = (amount: number, currencyCode: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTotalEURValue = () => {
    return cashHoldings.reduce((total, cash) => total + cash.usd_value, 0);
  };

  const getAvailableCurrencies = () => {
    const usedCurrencies = cashHoldings.map(cash => cash.currency_code);
    return exchangeRates
      .filter(rate => !usedCurrencies.includes(rate.currency_code))
      .map(rate => rate.currency_code);
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <CurrencyDollarIcon className="h-6 w-6 mr-2 text-green-400" />
          <h2 className="text-xl font-bold text-white">
            Available Cash ({formatCurrency(getTotalEURValue(), 'EUR')})
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefreshEUR}
            disabled={refreshing}
            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            title="Refresh EUR values using current exchange rates"
          >
            <ArrowPathIcon className={`h-5 w-5 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh EUR
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            disabled={getAvailableCurrencies().length === 0}
            className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            title={getAvailableCurrencies().length === 0 ? 'No available currencies. Add currencies to exchange rates first.' : 'Add cash holding'}
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Cash
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-900 bg-opacity-50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {showAddForm && (
        <div className="mb-4 bg-gray-700 rounded-lg p-4 border border-gray-600">
          <h3 className="text-white mb-3">Add New Cash Holding</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select
              value={newCash.currency_code}
              onChange={(e) => setNewCash({ ...newCash, currency_code: e.target.value })}
              className="bg-gray-600 text-white rounded px-3 py-2"
            >
              <option value="">Select Currency</option>
              {getAvailableCurrencies().map(currency => (
                <option key={currency} value={currency}>{currency}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Amount"
              value={newCash.amount || ''}
              onChange={(e) => setNewCash({ ...newCash, amount: parseFloat(e.target.value) || 0 })}
              className="bg-gray-600 text-white rounded px-3 py-2"
              step="0.01"
              min="0"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={newCash.description}
              onChange={(e) => setNewCash({ ...newCash, description: e.target.value })}
              className="bg-gray-600 text-white rounded px-3 py-2"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewCash({ currency_code: '', amount: 0, description: '' });
                  setError('');
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {cashHoldings.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <CurrencyDollarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No cash holdings found.</p>
          <p className="text-sm">Add your available cash in different currencies to track your purchasing power.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="pb-3 text-gray-400 font-medium">Currency</th>
                <th className="pb-3 text-gray-400 font-medium text-right">Amount</th>
                <th className="pb-3 text-gray-400 font-medium text-right">EUR Value</th>
                <th className="pb-3 text-gray-400 font-medium">Description</th>
                <th className="pb-3 text-gray-400 font-medium">Last Updated</th>
                <th className="pb-3 text-gray-400 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cashHoldings.map((cash) => (
                <tr key={cash.id} className="border-b border-gray-700">
                  <td className="py-3">
                    <span className="text-white font-medium text-lg">
                      {cash.currency_code}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    {editingId === cash.id ? (
                      <input
                        type="number"
                        value={editValues.amount}
                        onChange={(e) => setEditValues({ 
                          ...editValues, 
                          amount: parseFloat(e.target.value) || 0 
                        })}
                        className="bg-gray-700 text-white rounded px-2 py-1 w-32 text-right"
                        step="0.01"
                        min="0"
                        autoFocus
                      />
                    ) : (
                      <span className="text-white font-semibold">
                        {formatCurrency(cash.amount, cash.currency_code)}
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <span className="text-green-400 font-semibold">
                      {formatCurrency(cash.usd_value, 'EUR')}
                    </span>
                  </td>
                  <td className="py-3">
                    {editingId === cash.id ? (
                      <input
                        type="text"
                        value={editValues.description}
                        onChange={(e) => setEditValues({ 
                          ...editValues, 
                          description: e.target.value 
                        })}
                        className="bg-gray-700 text-white rounded px-2 py-1 w-full"
                        placeholder="Description"
                      />
                    ) : (
                      <span className="text-gray-300">
                        {cash.description || '-'}
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-gray-400 text-sm">
                    {formatDate(cash.last_updated)}
                  </td>
                  <td className="py-3 text-right">
                    {editingId === cash.id ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleSaveEdit(cash.id)}
                          className="p-1 text-green-400 hover:text-green-300"
                          title="Save"
                        >
                          <CheckIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-1 text-red-400 hover:text-red-300"
                          title="Cancel"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(cash)}
                          className="p-1 text-gray-400 hover:text-white"
                          title="Edit cash holding"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(cash.id, cash.currency_code)}
                          className="p-1 text-gray-400 hover:text-red-400"
                          title="Delete cash holding"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="mt-4 text-sm text-gray-400">
        <p>• Cash holdings are converted to EUR using current exchange rates</p>
        <p>• Click &quot;Refresh EUR&quot; to update values when exchange rates change</p>
        <p>• Total purchasing power: <span className="font-semibold text-green-400">{formatCurrency(getTotalEURValue(), 'EUR')}</span></p>
      </div>
    </div>
  );
}