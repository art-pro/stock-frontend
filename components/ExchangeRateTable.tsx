'use client';

import { useState, useEffect } from 'react';
import { ExchangeRate, exchangeRateAPI } from '@/lib/api';
import {
  ArrowPathIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

export default function ExchangeRateTable() {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCurrency, setNewCurrency] = useState({ code: '', rate: 0 });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    try {
      setLoading(true);
      const response = await exchangeRateAPI.getAll();
      setRates(response.data);
      setError('');
    } catch (err: any) {
      setError('Failed to fetch exchange rates');
      console.error('Error fetching rates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      const response = await exchangeRateAPI.refresh();
      if (response.data.rates) {
        setRates(response.data.rates);
      } else {
        await fetchRates();
      }
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to refresh rates');
    } finally {
      setRefreshing(false);
    }
  };

  const handleEdit = (code: string, currentRate: number) => {
    setEditingCode(code);
    setEditValue(currentRate.toString());
  };

  const handleSaveEdit = async (code: string) => {
    try {
      const rate = parseFloat(editValue);
      if (isNaN(rate) || rate <= 0) {
        setError('Invalid rate value');
        return;
      }
      
      await exchangeRateAPI.update(code, { rate, is_manual: true });
      await fetchRates();
      setEditingCode(null);
      setError('');
    } catch (err: any) {
      setError('Failed to update rate');
    }
  };

  const handleCancelEdit = () => {
    setEditingCode(null);
    setEditValue('');
  };

  const handleDelete = async (code: string) => {
    if (!confirm(`Are you sure you want to delete ${code}?`)) return;
    
    try {
      await exchangeRateAPI.delete(code);
      await fetchRates();
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete currency');
    }
  };

  const handleAdd = async () => {
    try {
      if (!newCurrency.code || newCurrency.rate <= 0) {
        setError('Please enter valid currency code and rate');
        return;
      }
      
      await exchangeRateAPI.add({
        currency_code: newCurrency.code.toUpperCase(),
        rate: newCurrency.rate,
        is_manual: true,
      });
      
      await fetchRates();
      setShowAddForm(false);
      setNewCurrency({ code: '', rate: 0 });
      setError('');
    } catch (err: any) {
      setError('Failed to add currency');
    }
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

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">Exchange Rates (Base: EUR)</h2>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            title="Fetch latest rates from API"
          >
            <ArrowPathIcon className={`h-5 w-5 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Rates
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Currency
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-900 bg-opacity-50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {showAddForm && (
        <div className="mb-4 bg-gray-700 rounded-lg p-4">
          <h3 className="text-white mb-3">Add New Currency</h3>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Currency Code (e.g., SEK)"
              value={newCurrency.code}
              onChange={(e) => setNewCurrency({ ...newCurrency, code: e.target.value })}
              className="flex-1 bg-gray-600 text-white rounded px-3 py-2"
              maxLength={3}
            />
            <input
              type="number"
              placeholder="Rate to EUR"
              value={newCurrency.rate || ''}
              onChange={(e) => setNewCurrency({ ...newCurrency, rate: parseFloat(e.target.value) || 0 })}
              className="flex-1 bg-gray-600 text-white rounded px-3 py-2"
              step="0.0001"
            />
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Add
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewCurrency({ code: '', rate: 0 });
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="pb-3 text-gray-400 font-medium">Currency</th>
              <th className="pb-3 text-gray-400 font-medium">Rate to EUR</th>
              <th className="pb-3 text-gray-400 font-medium">1 EUR =</th>
              <th className="pb-3 text-gray-400 font-medium">Last Updated</th>
              <th className="pb-3 text-gray-400 font-medium">Type</th>
              <th className="pb-3 text-gray-400 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((rate) => (
              <tr key={rate.currency_code} className="border-b border-gray-700">
                <td className="py-3">
                  <span className="text-white font-medium">{rate.currency_code}</span>
                </td>
                <td className="py-3">
                  {editingCode === rate.currency_code ? (
                    <input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="bg-gray-700 text-white rounded px-2 py-1 w-32"
                      step="0.0001"
                      autoFocus
                    />
                  ) : (
                    <span className="text-gray-300">{rate.rate.toFixed(4)}</span>
                  )}
                </td>
                <td className="py-3 text-gray-300">
                  {(1 / rate.rate).toFixed(4)} {rate.currency_code}
                </td>
                <td className="py-3 text-gray-400 text-sm">
                  {formatDate(rate.last_updated)}
                </td>
                <td className="py-3">
                  {rate.is_manual ? (
                    <span className="px-2 py-1 bg-yellow-900 bg-opacity-50 text-yellow-400 rounded text-xs">
                      Manual
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-blue-900 bg-opacity-50 text-blue-400 rounded text-xs">
                      API
                    </span>
                  )}
                </td>
                <td className="py-3 text-right">
                  {editingCode === rate.currency_code ? (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleSaveEdit(rate.currency_code)}
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
                      {rate.currency_code !== 'EUR' && (
                        <>
                          <button
                            onClick={() => handleEdit(rate.currency_code, rate.rate)}
                            className="p-1 text-gray-400 hover:text-white"
                            title="Edit rate"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          {!['USD', 'DKK', 'GBP', 'RUB'].includes(rate.currency_code) && (
                            <button
                              onClick={() => handleDelete(rate.currency_code)}
                              className="p-1 text-gray-400 hover:text-red-400"
                              title="Delete currency"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 text-sm text-gray-400">
        <p>• Base currency is EUR (€)</p>
        <p>• Rates show how many units of each currency equal 1 EUR</p>
        <p>• Manual rates are preserved when refreshing from API</p>
        <p>• USD, DKK, GBP, and RUB are protected currencies and cannot be deleted</p>
      </div>
    </div>
  );
}