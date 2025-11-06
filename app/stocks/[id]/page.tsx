'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { stockAPI, Stock, StockHistory } from '@/lib/api';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { ArrowLeftIcon, PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function StockDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = parseInt(params.id as string);

  const [stock, setStock] = useState<Stock | null>(null);
  const [history, setHistory] = useState<StockHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [stockRes, historyRes] = await Promise.all([
        stockAPI.getById(id),
        stockAPI.getHistory(id),
      ]);
      setStock(stockRes.data);
      setHistory(historyRes.data);
    } catch (err) {
      console.error(err);
      alert('Failed to load stock details');
    } finally {
      setLoading(false);
    }
  };

  const handleEditField = (field: string, currentValue: any) => {
    setEditingField(field);
    setEditValue(currentValue?.toString() || '');
  };

  const handleSaveField = async (field: string, isStringField: boolean = false) => {
    if (!stock) return;
    
    try {
      setSaving(true);
      
      let payload: any = { field };
      
      if (isStringField) {
        payload.string_value = editValue;
        payload.value = editValue;
      } else {
        const numValue = parseFloat(editValue);
        if (isNaN(numValue)) {
          alert('Invalid number');
          return;
        }
        payload.value = numValue;
      }
      
      const response = await stockAPI.updateField(id, field, isStringField ? editValue : parseFloat(editValue));
      setStock(response.data);
      setEditingField(null);
      setEditValue('');
    } catch (err: any) {
      console.error('Error updating field:', err);
      alert(`Failed to update ${field}: ${err.response?.data?.error || err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const EditableField = ({ 
    field, 
    label, 
    value, 
    suffix = '', 
    isString = false,
    multiline = false 
  }: { 
    field: string; 
    label: string; 
    value: any; 
    suffix?: string;
    isString?: boolean;
    multiline?: boolean;
  }) => {
    const isEditing = editingField === field;
    
    return (
      <div>
        <p className="text-sm text-gray-400 mb-1">{label}</p>
        {isEditing ? (
          <div className="flex items-center gap-2">
            {multiline ? (
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1 bg-gray-700 text-white rounded px-2 py-1 text-sm min-h-[60px]"
                autoFocus
              />
            ) : (
              <input
                type={isString ? 'text' : 'number'}
                step={isString ? undefined : 'any'}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1 bg-gray-700 text-white rounded px-2 py-1 text-sm"
                autoFocus
              />
            )}
            <button
              onClick={() => handleSaveField(field, isString)}
              disabled={saving}
              className="p-1 text-green-400 hover:text-green-300 disabled:opacity-50"
              title="Save"
            >
              <CheckIcon className="h-5 w-5" />
            </button>
            <button
              onClick={handleCancelEdit}
              disabled={saving}
              className="p-1 text-red-400 hover:text-red-300 disabled:opacity-50"
              title="Cancel"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between group">
            <p className="text-lg font-semibold text-white">
              {isString ? value : (typeof value === 'number' ? value.toFixed(2) : 'N/A')} {suffix}
            </p>
            <button
              onClick={() => handleEditField(field, value)}
              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-primary-400 transition-opacity"
              title={`Edit ${label}`}
            >
              <PencilIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading stock details...</p>
        </div>
      </div>
    );
  }

  if (!stock) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <p className="text-gray-400">Stock not found</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const chartData = {
    labels: history.map((h) => new Date(h.recorded_at).toLocaleDateString()).reverse(),
    datasets: [
      {
        label: 'Expected Value (%)',
        data: history.map((h) => h.expected_value).reverse(),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.3,
      },
      {
        label: 'Current Price',
        data: history.map((h) => h.current_price).reverse(),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.3,
        yAxisID: 'y1',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: 'rgb(209, 213, 219)',
        },
      },
      title: {
        display: true,
        text: 'Historical Performance',
        color: 'rgb(209, 213, 219)',
      },
    },
    scales: {
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'EV %',
          color: 'rgb(209, 213, 219)',
        },
        ticks: {
          color: 'rgb(209, 213, 219)',
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.3)',
        },
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Price',
          color: 'rgb(209, 213, 219)',
        },
        ticks: {
          color: 'rgb(209, 213, 219)',
        },
        grid: {
          drawOnChartArea: false,
        },
      },
      x: {
        ticks: {
          color: 'rgb(209, 213, 219)',
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.3)',
        },
      },
    },
  };

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
          <div className="flex items-center gap-3 group">
            <h1 className="text-2xl font-bold text-white">
              {stock.ticker} - {editingField === 'company_name' ? (
                <span className="inline-flex items-center gap-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="bg-gray-700 text-white rounded px-2 py-1 text-xl"
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveField('company_name', true)}
                    disabled={saving}
                    className="p-1 text-green-400 hover:text-green-300"
                    title="Save"
                  >
                    <CheckIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className="p-1 text-red-400 hover:text-red-300"
                    title="Cancel"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </span>
              ) : (
                <>
                  {stock.company_name}
                  <button
                    onClick={() => handleEditField('company_name', stock.company_name)}
                    className="ml-2 opacity-0 group-hover:opacity-100 inline-block p-1 text-gray-400 hover:text-primary-400 transition-opacity"
                    title="Edit company name"
                  >
                    <PencilIcon className="h-4 w-4 inline" />
                  </button>
                </>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-2 mt-1 group">
            {editingField === 'sector' ? (
              <span className="inline-flex items-center gap-2">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="bg-gray-700 text-white rounded px-2 py-1 text-sm"
                  autoFocus
                />
                <button
                  onClick={() => handleSaveField('sector', true)}
                  disabled={saving}
                  className="p-1 text-green-400 hover:text-green-300"
                  title="Save"
                >
                  <CheckIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="p-1 text-red-400 hover:text-red-300"
                  title="Cancel"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </span>
            ) : (
              <>
                <p className="text-sm text-gray-400">{stock.sector}</p>
                <button
                  onClick={() => handleEditField('sector', stock.sector)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-primary-400 transition-opacity"
                  title="Edit sector"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <EditableField 
              field="current_price" 
              label="Current Price" 
              value={stock.current_price} 
              suffix={stock.currency}
            />
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <EditableField 
              field="fair_value" 
              label="Fair Value" 
              value={stock.fair_value} 
              suffix={stock.currency}
            />
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Expected Value</h3>
            <p className={`text-2xl font-bold ${
              stock.expected_value > 7 ? 'text-green-400' : 
              stock.expected_value > 0 ? 'text-yellow-400' : 
              'text-red-400'
            }`}>
              {stock.expected_value.toFixed(2)}%
            </p>
            <p className="text-xs text-gray-500 mt-1">Calculated (not editable)</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Assessment</h3>
            <p className={`text-2xl font-bold ${
              stock.assessment === 'Add' ? 'text-green-400' :
              stock.assessment === 'Hold' ? 'text-gray-300' :
              stock.assessment === 'Trim' ? 'text-orange-400' :
              'text-red-400'
            }`}>
              {stock.assessment}
            </p>
            <p className="text-xs text-gray-500 mt-1">Calculated (not editable)</p>
          </div>
        </div>

        {/* Detailed Metrics */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Detailed Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Calculated field - not editable */}
            <div>
              <p className="text-sm text-gray-400 mb-1">Upside Potential</p>
              <p className="text-lg font-semibold text-green-400">
                {stock.upside_potential.toFixed(2)}%
              </p>
              <p className="text-xs text-gray-600 mt-1">Calculated</p>
            </div>
            
            <EditableField 
              field="downside_risk" 
              label="Downside Risk" 
              value={stock.downside_risk} 
              suffix="%"
            />
            
            <EditableField 
              field="probability_positive" 
              label="Probability Positive (p)" 
              value={stock.probability_positive}
            />
            
            <EditableField 
              field="beta" 
              label="Beta" 
              value={stock.beta}
            />
            
            <EditableField 
              field="volatility" 
              label="Volatility (σ)" 
              value={stock.volatility} 
              suffix="%"
            />
            
            <EditableField 
              field="pe_ratio" 
              label="P/E Ratio" 
              value={stock.pe_ratio}
            />
            
            <EditableField 
              field="eps_growth_rate" 
              label="EPS Growth Rate" 
              value={stock.eps_growth_rate} 
              suffix="%"
            />
            
            <EditableField 
              field="debt_to_ebitda" 
              label="Debt to EBITDA" 
              value={stock.debt_to_ebitda}
            />
            
            <EditableField 
              field="dividend_yield" 
              label="Dividend Yield" 
              value={stock.dividend_yield} 
              suffix="%"
            />
            
            {/* Calculated fields - not editable */}
            <div>
              <p className="text-sm text-gray-400 mb-1">b Ratio</p>
              <p className="text-lg font-semibold text-white">
                {stock.b_ratio.toFixed(2)}
              </p>
              <p className="text-xs text-gray-600 mt-1">Calculated</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-400 mb-1">Kelly f*</p>
              <p className="text-lg font-semibold text-white">
                {stock.kelly_fraction.toFixed(2)}%
              </p>
              <p className="text-xs text-gray-600 mt-1">Calculated</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-400 mb-1">½-Kelly Suggested</p>
              <p className="text-lg font-semibold text-primary-400">
                {stock.half_kelly_suggested.toFixed(2)}%
              </p>
              <p className="text-xs text-gray-600 mt-1">Calculated</p>
            </div>
          </div>
        </div>

        {/* Position Info */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Position Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <EditableField 
              field="shares_owned" 
              label="Shares Owned" 
              value={stock.shares_owned}
            />
            
            <EditableField 
              field="avg_price_local" 
              label="Average Entry Price" 
              value={stock.avg_price_local} 
              suffix={stock.currency}
            />
            
            <div>
              <p className="text-sm text-gray-400 mb-1">Current Value (USD)</p>
              <p className="text-lg font-semibold text-white">
                ${stock.current_value_usd.toFixed(2)}
              </p>
              <p className="text-xs text-gray-600 mt-1">Calculated</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-400 mb-1">Portfolio Weight</p>
              <p className="text-lg font-semibold text-white">
                {stock.weight.toFixed(2)}%
              </p>
              <p className="text-xs text-gray-600 mt-1">Calculated</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-400 mb-1">Unrealized P&L</p>
              <p className={`text-lg font-semibold ${
                stock.unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                ${stock.unrealized_pnl.toFixed(2)}
              </p>
              <p className="text-xs text-gray-600 mt-1">Calculated</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-400 mb-1">Buy Zone (Min)</p>
              <p className="text-lg font-semibold text-white">
                {stock.buy_zone_min.toFixed(2)} {stock.currency}
              </p>
              <p className="text-xs text-gray-600 mt-1">Calculated</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-400 mb-1">Buy Zone (Max)</p>
              <p className="text-lg font-semibold text-white">
                {stock.buy_zone_max.toFixed(2)} {stock.currency}
              </p>
              <p className="text-xs text-gray-600 mt-1">Calculated</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-400 mb-1">Last Updated</p>
              <p className="text-lg font-semibold text-white">
                {new Date(stock.last_updated).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Comment Section */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Notes & Comments</h2>
          <EditableField 
            field="comment" 
            label="Personal notes, memos, and analysis for this stock"
            value={stock.comment || 'No comments yet. Click edit to add notes.'} 
            isString={true}
            multiline={true}
          />
        </div>

        {/* Historical Chart */}
        {history.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">Historical Data</h2>
            <div className="h-96">
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

