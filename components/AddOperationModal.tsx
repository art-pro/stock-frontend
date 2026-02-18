'use client';

import { useState, FormEvent, useEffect } from 'react';
import { operationsAPI, type OperationType, type CreateOperationRequest, type Operation } from '@/lib/api';
import { XMarkIcon } from '@heroicons/react/24/outline';

const OPERATION_TYPES: OperationType[] = ['Buy', 'Sell', 'Deposit', 'Withdraw', 'Dividend'];

function todayDDMMYYYY(): string {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

export interface AddOperationInitialValues {
  ticker?: string;
  isin?: string;
  company_name?: string;
  sector?: string;
  currency?: string;
  operation_type?: OperationType;
  stock_id?: number;
}

interface AddOperationModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialValues?: AddOperationInitialValues;
  /** When set, modal is in edit mode: title "Modify Operation", submit calls update(id). */
  editOperation?: Operation | null;
  portfolioId?: number;
}

export default function AddOperationModal({ onClose, onSuccess, initialValues, editOperation, portfolioId }: AddOperationModalProps) {
  const isEdit = !!editOperation;
  const [formData, setFormData] = useState({
    operation_type: (initialValues?.operation_type ?? editOperation?.operation_type ?? 'Buy') as OperationType,
    ticker: initialValues?.ticker ?? editOperation?.ticker ?? '',
    isin: initialValues?.isin ?? editOperation?.isin ?? '',
    company_name: initialValues?.company_name ?? editOperation?.company_name ?? '',
    sector: initialValues?.sector ?? editOperation?.sector ?? '',
    currency: initialValues?.currency ?? editOperation?.currency ?? 'USD',
    quantity: initialValues ? 0 : (editOperation?.quantity ?? 0),
    price: initialValues ? 0 : (editOperation?.price ?? 0),
    trade_date: initialValues ? todayDDMMYYYY() : (editOperation?.trade_date ?? todayDDMMYYYY()),
    note: initialValues ? '' : (editOperation?.note ?? ''),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editOperation) {
      setFormData(prev => ({
        ...prev,
        operation_type: editOperation.operation_type,
        ticker: editOperation.ticker ?? '',
        isin: editOperation.isin ?? '',
        company_name: editOperation.company_name ?? '',
        sector: editOperation.sector ?? '',
        currency: editOperation.currency ?? 'USD',
        quantity: editOperation.quantity ?? 0,
        price: editOperation.price ?? 0,
        trade_date: editOperation.trade_date ?? prev.trade_date,
        note: editOperation.note ?? '',
      }));
    } else if (initialValues) {
      setFormData(prev => ({
        ...prev,
        ticker: initialValues.ticker ?? prev.ticker,
        isin: initialValues.isin ?? prev.isin,
        company_name: initialValues.company_name ?? prev.company_name,
        sector: initialValues.sector ?? prev.sector,
        currency: initialValues.currency ?? prev.currency,
        operation_type: initialValues.operation_type ?? prev.operation_type,
      }));
    }
  }, [editOperation, initialValues]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const isBuySell = formData.operation_type === 'Buy' || formData.operation_type === 'Sell';
    const payload: CreateOperationRequest = {
      operation_type: formData.operation_type,
      currency: formData.currency,
      quantity: formData.quantity,
      trade_date: formData.trade_date,
      note: formData.note || undefined,
    };
    if (isBuySell) {
      payload.ticker = formData.ticker.trim() || undefined;
      payload.isin = formData.isin.trim() || undefined;
      payload.company_name = formData.company_name.trim() || undefined;
      payload.sector = formData.sector.trim() || undefined;
      payload.price = formData.price;
      if (initialValues?.stock_id || editOperation?.stock_id) payload.stock_id = initialValues?.stock_id ?? editOperation?.stock_id;
    }

    try {
      if (isEdit && editOperation) {
        await operationsAPI.update(editOperation.id, payload, portfolioId);
      } else {
        await operationsAPI.create(payload, portfolioId);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || (isEdit ? 'Failed to update operation' : 'Failed to add operation'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? 0 : parseFloat(value)) : value,
    }));
  };

  const isBuySell = formData.operation_type === 'Buy' || formData.operation_type === 'Sell';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">{isEdit ? 'Modify Operation' : 'Add New Operation'}</h2>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Operation type *</label>
              <select
                name="operation_type"
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.operation_type}
                onChange={handleChange}
              >
                {OPERATION_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Date (DD.MM.YYYY) *</label>
              <input
                type="text"
                name="trade_date"
                required
                placeholder="DD.MM.YYYY"
                pattern="\d{2}\.\d{2}\.\d{4}"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.trade_date}
                onChange={handleChange}
              />
            </div>

            {isBuySell && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Ticker Symbol *</label>
                  <input
                    type="text"
                    name="ticker"
                    required
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 uppercase"
                    value={formData.ticker}
                    onChange={handleChange}
                    placeholder="e.g., AAPL"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">ISIN</label>
                  <input
                    type="text"
                    name="isin"
                    maxLength={12}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 uppercase"
                    value={formData.isin}
                    onChange={handleChange}
                    placeholder="e.g., US0378331005"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Company Name</label>
                  <input
                    type="text"
                    name="company_name"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    value={formData.company_name}
                    onChange={handleChange}
                    placeholder="e.g., Apple Inc."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Sector</label>
                  <input
                    type="text"
                    name="sector"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    value={formData.sector}
                    onChange={handleChange}
                    placeholder="e.g., Technology"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Currency *</label>
              <select
                name="currency"
                required
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

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {isBuySell ? 'Number of Shares *' : 'Amount *'}
              </label>
              <input
                type="number"
                name="quantity"
                required
                min="0"
                step={isBuySell ? '1' : '0.01'}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.quantity || ''}
                onChange={handleChange}
              />
            </div>

            {isBuySell && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Price *</label>
                <input
                  type="number"
                  name="price"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={formData.price || ''}
                  onChange={handleChange}
                />
              </div>
            )}

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">Comment</label>
              <textarea
                name="note"
                rows={2}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.note}
                onChange={handleChange}
                placeholder="Optional note"
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
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (isEdit ? 'Saving...' : 'Adding...') : (isEdit ? 'Save Changes' : 'Add Operation')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
