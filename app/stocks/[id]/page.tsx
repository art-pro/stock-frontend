'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { stockAPI, Stock, StockHistory } from '@/lib/api';
import DataSourceModal from '@/components/DataSourceModal';
import TooltipIcon from '@/components/Tooltip';
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
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSource, setModalSource] = useState<'alphavantage' | 'grok'>('alphavantage');
  const [updatingAlphaVantage, setUpdatingAlphaVantage] = useState(false);
  const [updatingGrok, setUpdatingGrok] = useState(false);

  useEffect(() => {
    // Ensure LTR direction for the entire document
    document.documentElement.setAttribute('dir', 'ltr');
    document.documentElement.setAttribute('lang', 'en');
    document.body.setAttribute('dir', 'ltr');
    
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    
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
    
    fetchData();
  }, [id, router]);

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

  const openDataSourceModal = (source: 'alphavantage' | 'grok') => {
    setModalSource(source);
    setModalOpen(true);
  };

  const handleUpdateFromSource = async (source: 'alphavantage' | 'grok') => {
    if (!stock) return;
    
    try {
      if (source === 'alphavantage') {
        setUpdatingAlphaVantage(true);
      } else {
        setUpdatingGrok(true);
      }
      
      const response = await stockAPI.updateSingle(stock.id, source);
      setStock(response.data);
      
      // Show success message
      const sourceName = source === 'alphavantage' ? 'Alpha Vantage' : 'Grok AI';
      alert(`Successfully updated from ${sourceName}`);
    } catch (err: any) {
      console.error('Error updating stock:', err);
      const sourceName = source === 'alphavantage' ? 'Alpha Vantage' : 'Grok AI';
      alert(`Failed to update from ${sourceName}: ${err.response?.data?.error || err.message}`);
    } finally {
      if (source === 'alphavantage') {
        setUpdatingAlphaVantage(false);
      } else {
        setUpdatingGrok(false);
      }
    }
  };

  const EditableField = ({ 
    field, 
    label, 
    value, 
    suffix = '', 
    isString = false,
    multiline = false,
    tooltip = ''
  }: { 
    field: string; 
    label: string; 
    value: any; 
    suffix?: string;
    isString?: boolean;
    multiline?: boolean;
    tooltip?: string;
  }) => {
    const isEditing = editingField === field;
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    
    useEffect(() => {
      // Force LTR on mount when editing multiline
      if (isEditing && multiline && textareaRef.current) {
        textareaRef.current.style.direction = 'ltr';
        textareaRef.current.setAttribute('dir', 'ltr');
        textareaRef.current.style.textAlign = 'left';
        textareaRef.current.style.unicodeBidi = 'embed';
      }
    }, [isEditing, multiline]);
    
    return (
      <div dir="ltr" style={{ direction: 'ltr' }}>
        <p className="text-sm text-gray-400 mb-1 flex items-center">
          {label}
          {tooltip && <TooltipIcon text={tooltip} />}
        </p>
        {isEditing ? (
          <div className="flex items-center gap-2" dir="ltr">
            {multiline ? (
              <textarea
                ref={textareaRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1 bg-gray-700 text-white rounded px-2 py-1 text-sm min-h-[60px] resize-y ltr-textarea"
                dir="ltr"
                style={{
                  direction: 'ltr',
                  textAlign: 'left',
                  unicodeBidi: 'plaintext'
                }}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                autoFocus
                onKeyDown={(e) => {
                  // Allow Ctrl/Cmd+Enter to save
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleSaveField(field, isString);
                  }
                  // Allow Escape key to cancel
                  if (e.key === 'Escape') {
                    handleCancelEdit();
                  }
                }}
              />
            ) : (
              <input
                type="text"  // Changed from conditional to always text to handle comma input
                inputMode={isString ? 'text' : 'decimal'}
                value={editValue}
                onChange={(e) => {
                  let value = e.target.value;
                  // For numeric fields, allow comma as decimal separator
                  if (!isString) {
                    // Replace comma with point for decimal numbers
                    value = value.replace(',', '.');
                    // Allow valid number patterns including trailing decimal point
                    // This regex allows: negative sign, digits, decimal point, and combinations
                    // Examples: "5", "5.", "5.0", "-5", "-.5", ".5", etc.
                    const isValidNumber = /^-?(\d*\.?\d*)?$/.test(value);
                    const isSpecialCase = value === '-' || value === '.' || value === '-.';
                    
                    if (!isValidNumber && !isSpecialCase) {
                      return; // Don't update if invalid format
                    }
                  }
                  setEditValue(value);
                }}
                onKeyDown={(e) => {
                  // Allow Enter key to save
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveField(field, isString);
                  }
                  // Allow Escape key to cancel
                  if (e.key === 'Escape') {
                    handleCancelEdit();
                  }
                }}
                className="flex-1 bg-gray-700 text-white rounded px-2 py-1 text-sm"
                dir="ltr"
                style={{ direction: 'ltr', textAlign: 'left' }}
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
      {/* Data Source Modal */}
      {stock && (
        <DataSourceModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          source={modalSource}
          data={{
            ticker: stock.ticker,
            companyName: stock.company_name,
            fetchedAt: modalSource === 'alphavantage' ? stock.alpha_vantage_fetched_at : stock.grok_fetched_at,
            dataSource: stock.data_source,
            fairValueSource: stock.fair_value_source,
            currentPrice: stock.current_price,
            fairValue: stock.fair_value,
            currency: stock.currency,
            lastUpdated: stock.last_updated,
            rawJson: modalSource === 'alphavantage' ? stock.alpha_vantage_raw_json : stock.grok_raw_json
          }}
        />
      )}
      
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
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveField('company_name', true);
                      }
                      if (e.key === 'Escape') {
                        handleCancelEdit();
                      }
                    }}
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveField('sector', true);
                    }
                    if (e.key === 'Escape') {
                      handleCancelEdit();
                    }
                  }}
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
          {/* ISIN */}
          <div className="flex items-center gap-2 mt-1 group">
            <span className="text-xs text-gray-500">ISIN:</span>
            {editingField === 'isin' ? (
              <span className="inline-flex items-center gap-2">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value.toUpperCase())}
                  maxLength={12}
                  className="bg-gray-700 text-white rounded px-2 py-1 text-xs uppercase"
                  placeholder="US0378331005"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveField('isin', true);
                    }
                    if (e.key === 'Escape') {
                      handleCancelEdit();
                    }
                  }}
                />
                <button
                  onClick={() => handleSaveField('isin', true)}
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
                <p className="text-xs text-gray-400 font-mono">{stock.isin || 'Not set'}</p>
                <button
                  onClick={() => handleEditField('isin', stock.isin || '')}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-primary-400 transition-opacity"
                  title="Edit ISIN"
                >
                  <PencilIcon className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Update Buttons */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => handleUpdateFromSource('alphavantage')}
            disabled={updatingAlphaVantage || updatingGrok}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
            title="Fetch latest data from Alpha Vantage"
          >
            <svg className={`w-5 h-5 ${updatingAlphaVantage ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{updatingAlphaVantage ? 'Updating...' : 'Update from Alpha Vantage'}</span>
          </button>
          
          <button
            onClick={() => handleUpdateFromSource('grok')}
            disabled={updatingGrok || updatingAlphaVantage}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
            title="Fetch latest analysis from Grok AI"
          >
            <svg className={`w-5 h-5 ${updatingGrok ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>{updatingGrok ? 'Updating...' : 'Update from Grok AI'}</span>
          </button>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <EditableField 
              field="current_price" 
              label="Current Price" 
              value={stock.current_price} 
              suffix={stock.currency}
              tooltip="The current market price of the stock. This is what you would pay to buy one share right now."
            />
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <EditableField 
              field="fair_value" 
              label="Fair Value" 
              value={stock.fair_value} 
              suffix={stock.currency}
              tooltip="The estimated true value of the stock based on analysis. If the current price is below this, the stock might be undervalued."
            />
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center">
              Expected Value
              <TooltipIcon text="The probability-weighted average return. Combines upside potential, downside risk, and probability of success. Above 7% is attractive." />
            </h3>
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
            <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center">
              Assessment
              <TooltipIcon text="Action recommendation based on Expected Value. Add: EV > 7% (buy more), Hold: EV 0-7% (keep position), Trim: EV 0 to -3% (reduce position), Sell: EV < -3% (exit position)." />
            </h3>
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

        {/* Data Source Information */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Data Sources</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div 
              className="flex items-start space-x-3 p-3 rounded-lg cursor-pointer hover:bg-gray-700/50 transition-colors"
              onClick={() => openDataSourceModal('alphavantage')}
            >
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <div className="flex-grow">
                <h3 className="text-sm font-medium text-gray-300 mb-1 group-hover:text-white">Alpha Vantage</h3>
                <p className="text-xs text-gray-500 mb-2">Market data & financials</p>
                {stock.alpha_vantage_fetched_at ? (
                  <div>
                    <p className="text-sm text-white">
                      {new Date(stock.alpha_vantage_fetched_at).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(stock.alpha_vantage_fetched_at).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 italic">No data fetched yet</p>
                )}
              </div>
            </div>

            <div 
              className="flex items-start space-x-3 p-3 rounded-lg cursor-pointer hover:bg-gray-700/50 transition-colors"
              onClick={() => openDataSourceModal('grok')}
            >
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div className="flex-grow">
                <h3 className="text-sm font-medium text-gray-300 mb-1 group-hover:text-white">Grok AI</h3>
                <p className="text-xs text-gray-500 mb-2">Analysis & predictions</p>
                {stock.grok_fetched_at ? (
                  <div>
                    <p className="text-sm text-white">
                      {new Date(stock.grok_fetched_at).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(stock.grok_fetched_at).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 italic">No data fetched yet</p>
                )}
              </div>
            </div>
          </div>
          
          {/* Additional data source info */}
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Primary Source:</span>
                <span className="ml-2 text-white">{stock.data_source || 'Not specified'}</span>
              </div>
              <div>
                <span className="text-gray-400">Fair Value Source:</span>
                <span className="ml-2 text-white">{stock.fair_value_source || 'Not specified'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Metrics */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Detailed Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Calculated field - not editable */}
            <div>
              <p className="text-sm text-gray-400 mb-1 flex items-center">
                Upside Potential
                <TooltipIcon text="The potential percentage gain if the stock reaches its fair value. Calculated as (Fair Value - Current Price) / Current Price." />
              </p>
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
              tooltip="The estimated percentage loss if things go badly. A -20% downside risk means you could lose 20% of your investment in a worst-case scenario."
            />
            
            <EditableField 
              field="probability_positive" 
              label="Probability Positive (p)" 
              value={stock.probability_positive}
              tooltip="The likelihood (0 to 1) that this investment will be profitable. 0.7 means 70% chance of making money."
            />
            
            <EditableField 
              field="beta" 
              label="Beta" 
              value={stock.beta}
              tooltip="Measures how volatile the stock is compared to the market. Beta > 1 means more volatile than market, < 1 means less volatile."
            />
            
            <EditableField 
              field="volatility" 
              label="Volatility (σ)" 
              value={stock.volatility} 
              suffix="%"
              tooltip="How much the stock price typically moves up and down. Higher volatility means bigger price swings and more risk."
            />
            
            <EditableField 
              field="pe_ratio" 
              label="P/E Ratio" 
              value={stock.pe_ratio}
              tooltip="Price-to-Earnings ratio. Shows how much investors pay for each dollar of earnings. Lower might mean undervalued."
            />
            
            <EditableField 
              field="eps_growth_rate" 
              label="EPS Growth Rate" 
              value={stock.eps_growth_rate} 
              suffix="%"
              tooltip="How fast the company's earnings per share are growing annually. Higher growth often justifies higher stock prices."
            />
            
            <EditableField 
              field="debt_to_ebitda" 
              label="Debt to EBITDA" 
              value={stock.debt_to_ebitda}
              tooltip="Company's debt relative to earnings. Lower is better - shows how easily the company can pay off its debts."
            />
            
            <EditableField 
              field="dividend_yield" 
              label="Dividend Yield" 
              value={stock.dividend_yield} 
              suffix="%"
              tooltip="Annual dividend payment as a percentage of stock price. A 3% yield means you get $3 yearly for every $100 invested."
            />
            
            {/* Calculated fields - not editable */}
            <div>
              <p className="text-sm text-gray-400 mb-1 flex items-center">
                b Ratio
                <TooltipIcon text="The reward-to-risk ratio. Compares potential upside to downside risk. Higher is better - means more upside than downside." />
              </p>
              <p className="text-lg font-semibold text-white">
                {stock.b_ratio.toFixed(2)}
              </p>
              <p className="text-xs text-gray-600 mt-1">Calculated</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-400 mb-1 flex items-center">
                Kelly f*
                <TooltipIcon text="The Kelly Criterion optimal bet size. Mathematically optimal percentage of portfolio to invest for maximum long-term growth." />
              </p>
              <p className="text-lg font-semibold text-white">
                {stock.kelly_fraction.toFixed(2)}%
              </p>
              <p className="text-xs text-gray-600 mt-1">Calculated</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-400 mb-1 flex items-center">
                ½-Kelly Suggested
                <TooltipIcon text="Half of the Kelly fraction, capped at 15%. A more conservative position size that reduces volatility while maintaining good returns." />
              </p>
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
              tooltip="The number of shares you currently own of this stock."
            />
            
            <EditableField 
              field="avg_price_local" 
              label="Average Entry Price" 
              value={stock.avg_price_local} 
              suffix={stock.currency}
              tooltip="Your average purchase price per share. Used to calculate your profit or loss."
            />
            
            <div>
              <p className="text-sm text-gray-400 mb-1 flex items-center">
                Current Value (USD)
                <TooltipIcon text="The total current market value of your position in US dollars (shares owned × current price × exchange rate)." />
              </p>
              <p className="text-lg font-semibold text-white">
                ${stock.current_value_usd.toFixed(2)}
              </p>
              <p className="text-xs text-gray-600 mt-1">Calculated</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-400 mb-1 flex items-center">
                Portfolio Weight
                <TooltipIcon text="What percentage of your total portfolio this stock represents. Helps track diversification." />
              </p>
              <p className="text-lg font-semibold text-white">
                {stock.weight.toFixed(2)}%
              </p>
              <p className="text-xs text-gray-600 mt-1">Calculated</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-400 mb-1 flex items-center">
                Unrealized P&L
                <TooltipIcon text="Your profit or loss if you sold now. Green means profit, red means loss. Unrealized until you actually sell." />
              </p>
              <p className={`text-lg font-semibold ${
                stock.unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                ${stock.unrealized_pnl.toFixed(2)}
              </p>
              <p className="text-xs text-gray-600 mt-1">Calculated</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-400 mb-1 flex items-center">
                Buy Zone (Min)
                <TooltipIcon text="The lower bound of the attractive buying range. Consider adding to position if price falls to this level." />
              </p>
              <p className="text-lg font-semibold text-white">
                {stock.buy_zone_min.toFixed(2)} {stock.currency}
              </p>
              <p className="text-xs text-gray-600 mt-1">Calculated</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-400 mb-1 flex items-center">
                Buy Zone (Max)
                <TooltipIcon text="The upper bound of the attractive buying range. Above this, the stock may be too expensive for good returns." />
              </p>
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

