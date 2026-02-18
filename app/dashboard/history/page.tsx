'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { operationsAPI, invalidateCache, type Operation } from '@/lib/api';
import AddOperationModal from '@/components/AddOperationModal';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function HistoryPage() {
  const router = useRouter();
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editOperation, setEditOperation] = useState<Operation | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    fetchOperations();
  }, [router]);

  const fetchOperations = async () => {
    try {
      setLoading(true);
      const res = await operationsAPI.list();
      setOperations(res.data || []);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (op: Operation) => {
    if (!confirm(`Delete this ${op.operation_type} operation (${op.trade_date}, ${op.amount} ${op.currency})? Cash and positions will be recalculated.`)) return;
    try {
      setDeletingId(op.id);
      await operationsAPI.delete(op.id);
      invalidateCache('portfolio');
      await fetchOperations();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete operation');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditSuccess = () => {
    invalidateCache('portfolio');
    fetchOperations();
  };

  const assetLabel = (op: Operation) => {
    if (op.ticker) return op.company_name ? `${op.ticker} (${op.company_name})` : op.ticker;
    return '—';
  };

  const formatAmount = (op: Operation) => {
    const amt = op.amount;
    if (amt === 0 && (op.operation_type === 'Buy' || op.operation_type === 'Sell')) {
      return (op.quantity * op.price).toFixed(2);
    }
    return amt.toFixed(2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-xl font-bold text-white mb-6">History</h1>
      {error && (
        <div className="mb-4 bg-red-900 bg-opacity-50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-800 text-left">
            <tr>
              <th className="px-4 py-3 text-gray-300 font-medium">Asset</th>
              <th className="px-4 py-3 text-gray-300 font-medium">Operation</th>
              <th className="px-4 py-3 text-gray-300 font-medium">Trade date</th>
              <th className="px-4 py-3 text-gray-300 font-medium text-right">Quantity</th>
              <th className="px-4 py-3 text-gray-300 font-medium text-right">Price</th>
              <th className="px-4 py-3 text-gray-300 font-medium text-right">Amount</th>
              <th className="px-4 py-3 text-gray-300 font-medium">Note</th>
              <th className="px-4 py-3 text-gray-300 font-medium w-28">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {operations.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  No operations yet. Add a Buy, Sell, Deposit, Withdraw, or Dividend from Portfolio or Watchlist.
                </td>
              </tr>
            ) : (
              operations.map((op) => (
                <tr key={op.id} className="bg-gray-800/50 hover:bg-gray-800">
                  <td className="px-4 py-3 text-gray-200">{assetLabel(op)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      op.operation_type === 'Buy' ? 'bg-green-900/50 text-green-300' :
                      op.operation_type === 'Sell' ? 'bg-red-900/50 text-red-300' :
                      op.operation_type === 'Deposit' ? 'bg-blue-900/50 text-blue-300' :
                      op.operation_type === 'Withdraw' ? 'bg-amber-900/50 text-amber-300' :
                      'bg-purple-900/50 text-purple-300'
                    }`}>
                      {op.operation_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{op.trade_date}</td>
                  <td className="px-4 py-3 text-gray-300 text-right">{op.quantity}</td>
                  <td className="px-4 py-3 text-gray-300 text-right">{op.price > 0 ? op.price.toFixed(2) : '—'}</td>
                  <td className="px-4 py-3 text-white text-right">{formatAmount(op)} {op.currency}</td>
                  <td className="px-4 py-3 text-gray-400 max-w-xs truncate" title={op.note || ''}>{op.note || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditOperation(op)}
                        className="p-1.5 text-gray-400 hover:text-primary-400 hover:bg-gray-700 rounded transition-colors"
                        title="Modify"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(op)}
                        disabled={deletingId === op.id}
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editOperation && (
        <AddOperationModal
          editOperation={editOperation}
          onClose={() => setEditOperation(null)}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
}
