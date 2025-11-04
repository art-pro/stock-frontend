'use client';

import { useState, FormEvent } from 'react';
import { stockAPI } from '@/lib/api';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface AddStockModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddStockModal({ onClose, onSuccess }: AddStockModalProps) {
  const [formData, setFormData] = useState({
    ticker: '',
    company_name: '',
    sector: '',
    currency: 'USD',
    shares_owned: 0,
    avg_price_local: 0,
    update_frequency: 'daily',
    probability_positive: 0.65,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await stockAPI.create(formData);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add stock');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Add New Stock</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 bg-red-900 bg-opacity-50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Ticker */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Ticker Symbol *
              </label>
              <input
                type="text"
                name="ticker"
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.ticker}
                onChange={handleChange}
                placeholder="e.g., AAPL"
              />
            </div>

            {/* Company Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Company Name *
              </label>
              <input
                type="text"
                name="company_name"
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.company_name}
                onChange={handleChange}
                placeholder="e.g., Apple Inc."
              />
            </div>

            {/* Sector */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Sector *
              </label>
              <input
                type="text"
                name="sector"
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.sector}
                onChange={handleChange}
                placeholder="e.g., Technology"
              />
            </div>

            {/* Currency */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Currency
              </label>
              <select
                name="currency"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.currency}
                onChange={handleChange}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="DKK">DKK</option>
                <option value="SEK">SEK</option>
                <option value="NOK">NOK</option>
              </select>
            </div>

            {/* Shares Owned */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Shares Owned
              </label>
              <input
                type="number"
                name="shares_owned"
                min="0"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.shares_owned}
                onChange={handleChange}
              />
            </div>

            {/* Average Price */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Average Entry Price
              </label>
              <input
                type="number"
                name="avg_price_local"
                min="0"
                step="0.01"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.avg_price_local}
                onChange={handleChange}
              />
            </div>

            {/* Update Frequency */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Update Frequency
              </label>
              <select
                name="update_frequency"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.update_frequency}
                onChange={handleChange}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            {/* Probability Positive */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Probability of Positive Outcome (p)
              </label>
              <input
                type="number"
                name="probability_positive"
                min="0"
                max="1"
                step="0.01"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.probability_positive}
                onChange={handleChange}
              />
              <p className="text-xs text-gray-400 mt-1">
                Value between 0 and 1 (default: 0.65)
              </p>
            </div>
          </div>

          <div className="mt-6 bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-4">
            <p className="text-sm text-blue-200">
              <strong>Note:</strong> The system will automatically fetch current prices and 
              calculate metrics (EV, Kelly, etc.) using external APIs. This may take a few seconds.
            </p>
          </div>

          {/* Buttons */}
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
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Adding...' : 'Add Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

