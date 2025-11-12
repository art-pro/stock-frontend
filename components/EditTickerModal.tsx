'use client';

import { useState, FormEvent, useEffect } from 'react';
import { Stock, stockAPI } from '@/lib/api';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface EditTickerModalProps {
  stock: Stock;
  allStocks: Stock[];
  onClose: () => void;
  onSuccess: () => void;
}

interface MergeCandidate {
  stock: Stock;
  filledFields: number;
  emptyFields: string[];
}

export default function EditTickerModal({ stock, allStocks, onClose, onSuccess }: EditTickerModalProps) {
  const [newTicker, setNewTicker] = useState(stock.ticker);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [duplicateStock, setDuplicateStock] = useState<Stock | null>(null);
  const [mergePreview, setMergePreview] = useState<{
    target: MergeCandidate;
    source: MergeCandidate;
  } | null>(null);

  // Count filled fields in a stock
  const countFilledFields = (stock: Stock): { count: number; emptyFields: string[] } => {
    const fields = [
      'company_name', 'sector', 'isin', 'current_price', 'fair_value', 
      'beta', 'volatility', 'pe_ratio', 'eps_growth_rate', 'debt_to_ebitda',
      'dividend_yield', 'shares_owned', 'avg_price_local', 'comment'
    ];
    
    const emptyFields: string[] = [];
    let filledCount = 0;
    
    fields.forEach(field => {
      const value = stock[field as keyof Stock];
      if (value === null || value === undefined || value === '' || value === 0) {
        emptyFields.push(field);
      } else {
        filledCount++;
      }
    });
    
    return { count: filledCount, emptyFields };
  };

  // Check for duplicates when ticker changes
  useEffect(() => {
    if (newTicker && newTicker !== stock.ticker) {
      const duplicate = allStocks.find(s => 
        s.id !== stock.id && 
        s.ticker.toUpperCase() === newTicker.toUpperCase()
      );
      
      if (duplicate) {
        setDuplicateStock(duplicate);
        
        // Analyze which stock should be the merge target
        const currentStockAnalysis = countFilledFields(stock);
        const duplicateAnalysis = countFilledFields(duplicate);
        
        // The stock with more filled fields becomes the target
        if (currentStockAnalysis.count >= duplicateAnalysis.count) {
          setMergePreview({
            target: { 
              stock: stock, 
              filledFields: currentStockAnalysis.count,
              emptyFields: currentStockAnalysis.emptyFields
            },
            source: { 
              stock: duplicate, 
              filledFields: duplicateAnalysis.count,
              emptyFields: duplicateAnalysis.emptyFields
            }
          });
        } else {
          setMergePreview({
            target: { 
              stock: duplicate, 
              filledFields: duplicateAnalysis.count,
              emptyFields: duplicateAnalysis.emptyFields
            },
            source: { 
              stock: stock, 
              filledFields: currentStockAnalysis.count,
              emptyFields: currentStockAnalysis.emptyFields
            }
          });
        }
      } else {
        setDuplicateStock(null);
        setMergePreview(null);
      }
    } else {
      setDuplicateStock(null);
      setMergePreview(null);
    }
  }, [newTicker, stock, allStocks]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (duplicateStock && mergePreview) {
        // Perform merge operation
        await performMerge();
      } else {
        // Simple ticker update
        await stockAPI.updateField(stock.id, 'ticker', newTicker.toUpperCase());
      }
      
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error updating ticker:', err.response?.data || err);
      setError(err.response?.data?.error || 'Failed to update ticker');
    } finally {
      setLoading(false);
    }
  };

  const performMerge = async () => {
    if (!mergePreview) return;
    
    const { target, source } = mergePreview;
    
    // Prepare merge data - fill empty fields in target with data from source
    const mergeData: Partial<Stock> = { ticker: newTicker.toUpperCase() };
    
    target.emptyFields.forEach(field => {
      const sourceValue = source.stock[field as keyof Stock];
      if (sourceValue !== null && sourceValue !== undefined && sourceValue !== '' && sourceValue !== 0) {
        (mergeData as any)[field] = sourceValue;
      }
    });
    
    // Update the target stock with merged data
    await stockAPI.update(target.stock.id, mergeData);
    
    // Delete the source stock
    await stockAPI.delete(source.stock.id, `Merged into ${target.stock.ticker} (${target.stock.company_name})`);
  };

  const formatFieldName = (field: string): string => {
    return field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Edit Ticker Symbol</h2>
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

          {/* Current Stock Info */}
          <div className="mb-6 bg-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-2">Current Stock</h3>
            <p className="text-gray-300">
              <span className="font-medium">{stock.ticker}</span> - {stock.company_name} ({stock.sector})
            </p>
          </div>

          {/* Ticker Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              New Ticker Symbol
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 uppercase"
              value={newTicker}
              onChange={(e) => setNewTicker(e.target.value)}
              placeholder="Enter new ticker"
              required
            />
          </div>

          {/* Duplicate Detection Warning */}
          {duplicateStock && mergePreview && (
            <div className="mb-6 bg-amber-900 bg-opacity-30 border border-amber-700 rounded-lg p-4">
              <div className="flex items-start">
                <ExclamationTriangleIcon className="h-6 w-6 text-amber-400 mt-0.5 mr-3 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-amber-200 mb-2">
                    Duplicate Ticker Detected - Merge Required
                  </h3>
                  <p className="text-amber-100 mb-4">
                    A stock with ticker <strong>{duplicateStock.ticker}</strong> already exists. 
                    The stocks will be automatically merged based on data completeness.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Target Stock (More Complete) */}
                    <div className="bg-green-900 bg-opacity-30 border border-green-700 rounded p-3">
                      <h4 className="font-semibold text-green-200 mb-2">
                        Target Stock (Will be kept)
                      </h4>
                      <p className="text-sm text-green-100 mb-2">
                        <strong>{mergePreview.target.stock.ticker}</strong> - {mergePreview.target.stock.company_name}
                      </p>
                      <p className="text-xs text-green-200">
                        Filled fields: {mergePreview.target.filledFields}
                      </p>
                      {mergePreview.target.emptyFields.length > 0 && (
                        <p className="text-xs text-green-300 mt-1">
                          Will be filled with data from source stock
                        </p>
                      )}
                    </div>

                    {/* Source Stock (Less Complete) */}
                    <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded p-3">
                      <h4 className="font-semibold text-red-200 mb-2">
                        Source Stock (Will be merged and deleted)
                      </h4>
                      <p className="text-sm text-red-100 mb-2">
                        <strong>{mergePreview.source.stock.ticker}</strong> - {mergePreview.source.stock.company_name}
                      </p>
                      <p className="text-xs text-red-200">
                        Filled fields: {mergePreview.source.filledFields}
                      </p>
                      <p className="text-xs text-red-300 mt-1">
                        Data will be transferred to target stock
                      </p>
                    </div>
                  </div>

                  {/* Fields to be merged */}
                  {mergePreview.target.emptyFields.length > 0 && (
                    <div className="mt-4">
                      <h5 className="text-sm font-medium text-amber-200 mb-2">
                        Fields to be merged from source to target:
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {mergePreview.target.emptyFields.map(field => {
                          const sourceValue = mergePreview.source.stock[field as keyof Stock];
                          if (sourceValue !== null && sourceValue !== undefined && sourceValue !== '' && sourceValue !== 0) {
                            return (
                              <span
                                key={field}
                                className="bg-amber-800 text-amber-200 px-2 py-1 rounded text-xs"
                              >
                                {formatFieldName(field)}
                              </span>
                            );
                          }
                          return null;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !newTicker.trim()}
              className={`px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                duplicateStock 
                  ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                  : 'bg-primary-600 hover:bg-primary-700 text-white'
              }`}
            >
              {loading 
                ? 'Processing...' 
                : duplicateStock 
                  ? 'Merge Stocks' 
                  : 'Update Ticker'
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}