'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { invalidateCache, stockAPI, assessmentAPI, Stock, StockHistory, FairValueHistoryEntry, AssessmentResponse, AssessmentCompareRow } from '@/lib/api';
import { getDistanceToBuyZone, getDistanceToSellZone, getKellyHint } from '@/lib/portfolioInsights';
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
  const [fairValueHistory, setFairValueHistory] = useState<FairValueHistoryEntry[]>([]);
  const [assessments, setAssessments] = useState<AssessmentResponse[]>([]);
  const [assessmentCompareRows, setAssessmentCompareRows] = useState<AssessmentCompareRow[]>([]);
  const [assessmentCompareLoading, setAssessmentCompareLoading] = useState(false);
  const [assessmentCompareError, setAssessmentCompareError] = useState<string | null>(null);
  const [assessmentApplyKey, setAssessmentApplyKey] = useState<string | null>(null);
  const [assessmentRefreshing, setAssessmentRefreshing] = useState(false);
  const [assessmentRequestPrice, setAssessmentRequestPrice] = useState('');
  const [assessmentAskingSource, setAssessmentAskingSource] = useState<'grok' | 'deepseek' | 'alphavantage' | 'all' | null>(null);
  const [assessmentAskError, setAssessmentAskError] = useState<string | null>(null);
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
        const stockRes = await stockAPI.getById(id);
        const [historyRes, fairValueHistoryRes, assessmentsRes] = await Promise.all([
          stockAPI.getHistory(id),
          stockAPI.getFairValueHistory(id),
          assessmentAPI.getByTicker(stockRes.data.ticker, undefined, 30),
        ]);
        setStock(stockRes.data);
        setAssessmentRequestPrice(stockRes.data.current_price > 0 ? String(stockRes.data.current_price) : '');
        setHistory(historyRes.data);
        setFairValueHistory(fairValueHistoryRes.data);
        setAssessments(assessmentsRes.data || []);
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
      if (!isStringField) {
        const numValue = parseFloat(editValue);
        if (isNaN(numValue)) {
          alert('Invalid number');
          return;
        }
      }
      
      const response = await stockAPI.updateField(id, field, isStringField ? editValue : parseFloat(editValue));
      setStock(response.data);
      invalidateCache('portfolio');
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
      invalidateCache('portfolio');
      
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
                defaultValue={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1 bg-gray-700 text-white rounded px-2 py-1 text-sm min-h-[60px] resize-y notes-textarea"
                dir="auto"
                style={{
                  textAlign: 'start'
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
            <p className={`text-white ${multiline ? 'text-sm break-words whitespace-pre-wrap flex-1 min-w-0' : 'text-lg font-semibold'}`}>
              {isString ? ((value ?? '') || (multiline ? 'Not specified' : '')) : (typeof value === 'number' ? value.toFixed(2) : 'N/A')} {!multiline ? suffix : ''}
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

  const latestBySource = assessments.reduce<{ grok?: AssessmentResponse; deepseek?: AssessmentResponse }>((acc, item) => {
    const src = (item.source || '').toLowerCase();
    if (src === 'grok' && !acc.grok) acc.grok = item;
    if (src === 'deepseek' && !acc.deepseek) acc.deepseek = item;
    return acc;
  }, {});
  const grokAssessmentText = latestBySource.grok?.assessment || '';
  const deepseekAssessmentText = latestBySource.deepseek?.assessment || '';

  const refreshAssessments = async () => {
    if (!stock?.ticker) return;
    try {
      setAssessmentRefreshing(true);
      const response = await assessmentAPI.getByTicker(stock.ticker, undefined, 30);
      const items = response.data || [];
      // Keep UI responsive if backend persistence is slightly delayed.
      if (items.length > 0) {
        setAssessments(items);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Failed to refresh assessments');
    } finally {
      setAssessmentRefreshing(false);
    }
  };

  const upsertLocalAssessment = (source: 'grok' | 'deepseek', assessmentText: string) => {
    if (!stock || !assessmentText) return;
    const nextEntry: AssessmentResponse = {
      id: Date.now() + (source === 'grok' ? 1 : 2),
      ticker: stock.ticker,
      source,
      assessment: assessmentText,
      created_at: new Date().toISOString(),
      status: 'completed',
    };
    setAssessments((prev) => {
      const filtered = prev.filter((a) => (a.source || '').toLowerCase() !== source);
      return [nextEntry, ...filtered];
    });
  };

  const buildAssessmentPayload = (source: 'grok' | 'deepseek') => {
    if (!stock) return null;
    const requestPrice = Number.parseFloat(assessmentRequestPrice.replace(',', '.'));
    const payload: any = {
      ticker: stock.ticker,
      isin: stock.isin || undefined,
      company_name: stock.company_name || undefined,
      source,
    };
    if (Number.isFinite(requestPrice) && requestPrice > 0) {
      payload.current_price = requestPrice;
      payload.currency = stock.currency;
    }
    return payload;
  };

  const askAssessmentFromStockPage = async (source: 'grok' | 'deepseek') => {
    if (!stock) return;
    try {
      setAssessmentAskingSource(source);
      setAssessmentAskError(null);
      const payload = buildAssessmentPayload(source);
      if (!payload) return;

      const response = await assessmentAPI.request(payload);
      const assessmentText = response.data?.assessment || '';
      upsertLocalAssessment(source, assessmentText);

      // Let backend commit/update persisted records, then reload canonical data.
      await new Promise((resolve) => setTimeout(resolve, 300));
      await refreshAssessments();
    } catch (err: any) {
      setAssessmentAskError(err.response?.data?.error || err.message || 'Failed to request assessment');
    } finally {
      setAssessmentAskingSource(null);
    }
  };

  const askAlphaVantageFromStockPage = async () => {
    if (!stock) return;
    try {
      setAssessmentAskingSource('alphavantage');
      setAssessmentAskError(null);
      const response = await stockAPI.updateSingle(stock.id, 'alphavantage');
      setStock(response.data);
      invalidateCache('portfolio');
    } catch (err: any) {
      setAssessmentAskError(err.response?.data?.error || err.message || 'Failed to request Alpha Vantage update');
    } finally {
      setAssessmentAskingSource(null);
    }
  };

  const askAllFromStockPage = async () => {
    if (!stock) return;
    try {
      setAssessmentAskingSource('all');
      setAssessmentAskError(null);

      const grokPayload = buildAssessmentPayload('grok');
      const deepseekPayload = buildAssessmentPayload('deepseek');
      if (!grokPayload || !deepseekPayload) return;

      const [grokResponse, deepseekResponse, alphaResponse] = await Promise.all([
        assessmentAPI.request(grokPayload),
        assessmentAPI.request(deepseekPayload),
        stockAPI.updateSingle(stock.id, 'alphavantage'),
      ]);

      upsertLocalAssessment('grok', grokResponse.data?.assessment || '');
      upsertLocalAssessment('deepseek', deepseekResponse.data?.assessment || '');
      setStock(alphaResponse.data);
      invalidateCache('portfolio');

      // Let backend commit/update persisted records and diff, then refresh canonical data.
      await new Promise((resolve) => setTimeout(resolve, 400));
      await refreshAssessments();
    } catch (err: any) {
      setAssessmentAskError(err.response?.data?.error || err.message || 'Failed to request all sources');
    } finally {
      setAssessmentAskingSource(null);
    }
  };

  useEffect(() => {
    const ticker = stock?.ticker;
    if (!ticker || !grokAssessmentText || !deepseekAssessmentText) {
      setAssessmentCompareRows([]);
      setAssessmentCompareError(null);
      return;
    }

    let cancelled = false;
    const runCompare = async () => {
      try {
        setAssessmentCompareLoading(true);
        setAssessmentCompareError(null);
        let response = await assessmentAPI.getDiffByTicker(ticker);
        if (!response.data.rows || response.data.rows.length === 0) {
          // Fallback: regenerate persisted diff if missing.
          response = await assessmentAPI.compare({
            ticker,
            grok_assessment: grokAssessmentText,
            deepseek_assessment: deepseekAssessmentText,
          });
        }
        if (!cancelled) {
          setAssessmentCompareRows(response.data.rows || []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setAssessmentCompareRows([]);
          setAssessmentCompareError(err.response?.data?.error || err.message || 'Failed to compare assessments');
        }
      } finally {
        if (!cancelled) setAssessmentCompareLoading(false);
      }
    };

    runCompare();
    return () => {
      cancelled = true;
    };
  }, [stock?.ticker, grokAssessmentText, deepseekAssessmentText]);

  const parseMetricValue = (value: string) => {
    const raw = (value || '').trim();
    const upperRaw = raw.toUpperCase();
    const hasPercent = raw.includes('%');
    const hasMultiple = /\bx\b/i.test(raw);
    const codeMatch = upperRaw.match(/\b(USD|EUR|GBP|DKK|RUB|JPY|CHF|CAD|AUD|NOK|SEK)\b/);
    const symbolMatch = raw.match(/[$€£¥]/);

    const numberMatch = raw.match(/-?\d[\d,]*\.?\d*/);
    if (!numberMatch) {
      return {
        hasNumeric: false,
        normalizedText: upperRaw.replace(/\s+/g, ' ').trim(),
      };
    }

    let numericToken = numberMatch[0];
    if (numericToken.includes(',') && numericToken.includes('.')) {
      numericToken = numericToken.replace(/,/g, '');
    } else {
      numericToken = numericToken.replace(/,/g, '.');
    }
    const numericValue = Number.parseFloat(numericToken);
    if (!Number.isFinite(numericValue)) {
      return {
        hasNumeric: false,
        normalizedText: upperRaw.replace(/\s+/g, ' ').trim(),
      };
    }

    const unitType = hasPercent
      ? 'percent'
      : (codeMatch || symbolMatch)
        ? 'currency'
        : hasMultiple
          ? 'multiple'
          : 'plain';

    return {
      hasNumeric: true,
      numericValue,
      unitType,
      currencyCode: codeMatch?.[1],
      currencySymbol: symbolMatch?.[0],
      normalizedText: upperRaw.replace(/\s+/g, ' ').trim(),
    };
  };

  const isMissingMetric = (value: string) => {
    const normalized = (value || '').trim().toUpperCase();
    return normalized === '' || normalized === 'N/A' || normalized === '—' || normalized === '-';
  };

  const compareMetricValues = (left: string, right: string) => {
    const a = parseMetricValue(left);
    const b = parseMetricValue(right);

    if (a.hasNumeric && b.hasNumeric) {
      const sameUnitType = a.unitType === b.unitType || (a.unitType === 'plain' || b.unitType === 'plain');
      if (!sameUnitType) return false;
      return Math.abs((a.numericValue || 0) - (b.numericValue || 0)) < 0.0001;
    }
    return (a.normalizedText || '') === (b.normalizedText || '');
  };

  const formatAverageMetric = (rowKey: string, values: string[]) => {
    if (rowKey === 'current_price') return '—';
    const parsedValues = values.map(parseMetricValue).filter((v) => v.hasNumeric);
    if (parsedValues.length === 0) return 'N/A';

    const avg = parsedValues.reduce((acc, item) => acc + (item.numericValue || 0), 0) / parsedValues.length;
    const preferredUnit = parsedValues.find((v) => v.unitType !== 'plain')?.unitType || 'plain';
    const preferredCode = parsedValues.find((v) => v.currencyCode)?.currencyCode;
    const preferredSymbol = parsedValues.find((v) => v.currencySymbol)?.currencySymbol;

    if (preferredUnit === 'percent') return `${avg.toFixed(2)}%`;
    if (preferredUnit === 'multiple') return `${avg.toFixed(2)}x`;
    if (preferredUnit === 'currency') {
      const code = preferredCode;
      const symbol = preferredSymbol;
      if (code) return `${avg.toFixed(2)} ${code}`;
      if (symbol) return `${symbol}${avg.toFixed(2)}`;
    }
    return avg.toFixed(2);
  };

  const averageNumericMetric = (rowKey: string, values: string[]): number | null => {
    if (rowKey === 'current_price') return null;
    const parsedValues = values.map(parseMetricValue).filter((v) => v.hasNumeric);
    if (parsedValues.length === 0) return null;
    return parsedValues.reduce((acc, item) => acc + (item.numericValue || 0), 0) / parsedValues.length;
  };

  const rowKeyToStockField: Record<string, string> = {
    downside_risk: 'downside_risk',
    probability_positive: 'probability_positive',
    beta: 'beta',
    volatility: 'volatility',
    forward_pe_ratio: 'pe_ratio',
    eps_growth: 'eps_growth_rate',
    debt_to_ebitda_ttm: 'debt_to_ebitda',
    dividend_yield: 'dividend_yield',
  };

  const parseNumericString = (raw: unknown): number | null => {
    if (typeof raw !== 'string') return null;
    const normalized = raw.trim().replace(/,/g, '.');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const getAlphaVantageValueForRow = (rowKey: string): string => {
    if (!stock?.alpha_vantage_raw_json) return 'N/A';

    let parsed: any = null;
    try {
      parsed = JSON.parse(stock.alpha_vantage_raw_json);
    } catch {
      return 'N/A';
    }

    const overview = parsed?.overview || {};
    const quote = parsed?.quote?.['Global Quote'] || {};
    const currency = stock.currency || 'USD';

    const price = parseNumericString(quote['05. price']);
    const target = parseNumericString(overview['AnalystTargetPrice']);
    const beta = parseNumericString(overview['Beta']);
    const forwardPE = parseNumericString(overview['ForwardPE'] || overview['PERatio']);
    const epsGrowthYoy = parseNumericString(overview['QuarterlyEarningsGrowthYOY']);
    const dividendYield = parseNumericString(overview['DividendYield']);
    const evToEbitda = parseNumericString(overview['EVToEBITDA']);

    switch (rowKey) {
      case 'current_price':
        return price !== null ? `${price.toFixed(2)} ${currency}` : 'N/A';
      case 'fair_value_estimate':
        return target !== null ? `${target.toFixed(2)} ${currency}` : 'N/A';
      case 'upside_potential':
        if (price !== null && target !== null && price > 0) {
          return `${(((target - price) / price) * 100).toFixed(1)}%`;
        }
        return 'N/A';
      case 'beta':
        return beta !== null ? beta.toFixed(2) : 'N/A';
      case 'downside_risk':
        return Number.isFinite(stock.downside_risk) ? `${stock.downside_risk.toFixed(1)}%` : 'N/A';
      case 'probability_positive':
        return Number.isFinite(stock.probability_positive) ? stock.probability_positive.toFixed(2) : 'N/A';
      case 'volatility':
        return Number.isFinite(stock.volatility) ? `${stock.volatility.toFixed(1)}%` : 'N/A';
      case 'forward_pe_ratio':
        return forwardPE !== null ? `${forwardPE.toFixed(2)}x` : 'N/A';
      case 'eps_growth':
        return epsGrowthYoy !== null ? `${(epsGrowthYoy * 100).toFixed(1)}%` : 'N/A';
      case 'debt_to_ebitda_ttm':
        return evToEbitda !== null ? `${evToEbitda.toFixed(1)}x` : 'N/A';
      case 'dividend_yield':
        return dividendYield !== null ? `${(dividendYield * 100).toFixed(2)}%` : 'N/A';
      case 'expected_value_calculation':
        return Number.isFinite(stock.expected_value) ? `${stock.expected_value.toFixed(2)}%` : 'N/A';
      case 'kelly_criterion_sizing':
        return Number.isFinite(stock.kelly_fraction) ? `${stock.kelly_fraction.toFixed(2)}%` : 'N/A';
      case 'buy_zone':
        if (stock.buy_zone_min > 0 && stock.buy_zone_max > 0) {
          return `${stock.buy_zone_min.toFixed(2)}-${stock.buy_zone_max.toFixed(2)} ${currency}`;
        }
        return 'N/A';
      case 'final_assessment':
        return (stock.assessment || 'N/A').toUpperCase();
      default:
        return 'N/A';
    }
  };

  const applyAverageToStock = async (row: AssessmentCompareRow) => {
    if (!stock) return;
    const targetField = rowKeyToStockField[row.key];
    if (!targetField) return;
    const alphaValue = getAlphaVantageValueForRow(row.key);
    const avgNumeric = averageNumericMetric(row.key, [row.grok || '', row.deepseek || '', alphaValue]);
    if (avgNumeric === null) {
      alert('Average value is not numeric and cannot be applied.');
      return;
    }

    try {
      setAssessmentApplyKey(row.key);
      const response = await stockAPI.updateField(stock.id, targetField, avgNumeric);
      if (response?.data) {
        setStock(response.data);
      }
      invalidateCache('portfolio');
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Failed to apply average value');
    } finally {
      setAssessmentApplyKey(null);
    }
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

  const now = new Date();
  const currentMonthFairValueHistory = fairValueHistory.filter((entry) => {
    const d = new Date(entry.recorded_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });

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

        {/* Fair Value Source */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
          <EditableField 
            field="fair_value_source" 
            label="Fair Value Source" 
            value={stock.fair_value_source || ''} 
            isString={true}
            multiline={true}
            tooltip="Source of the fair value estimate (e.g., analyst consensus, DCF model, URL)."
          />
        </div>

        {/* Fair Value Source History */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Fair Value History</h2>
          {currentMonthFairValueHistory.length === 0 ? (
            <p className="text-sm text-gray-400">No current data for this month.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-700">
                    <th className="py-2 pr-4 text-gray-400 font-medium">Date</th>
                    <th className="py-2 pr-4 text-gray-400 font-medium">Fair Value</th>
                    <th className="py-2 text-gray-400 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {currentMonthFairValueHistory.map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-800">
                      <td className="py-2 pr-4 text-gray-300">{new Date(entry.recorded_at).toLocaleDateString()}</td>
                      <td className="py-2 pr-4 text-white">{entry.fair_value.toFixed(2)} {stock.currency}</td>
                      <td className="py-2 text-gray-300 break-words">{entry.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Data Source Information */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Data Sources</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

            <div className="flex items-start space-x-3 p-3 rounded-lg border border-gray-700 bg-gray-900/20">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
                  </svg>
                </div>
              </div>
              <div className="flex-grow">
                <h3 className="text-sm font-medium text-gray-300 mb-1">Deepseek AI</h3>
                <p className="text-xs text-gray-500 mb-2">Analysis & predictions</p>
                {latestBySource.deepseek?.created_at ? (
                  <div>
                    <p className="text-sm text-white">
                      {new Date(latestBySource.deepseek.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(latestBySource.deepseek.created_at).toLocaleTimeString('en-US', {
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
            </div>
          </div>
        </div>

        {/* Assessment Information */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Assessment</h2>
            <button
              onClick={refreshAssessments}
              disabled={assessmentRefreshing}
              className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Fetch latest Grok and Deepseek assessments for this ticker"
            >
              {assessmentRefreshing ? 'Refreshing...' : 'Refresh Assessment'}
            </button>
          </div>

          <div className="mb-4 p-3 rounded-lg border border-gray-700 bg-gray-900/30">
            <p className="text-xs text-gray-400 mb-3">Request a fresh assessment directly for this stock.</p>
            <div className="flex flex-col md:flex-row gap-2 md:items-center">
              <input
                type="text"
                inputMode="decimal"
                value={assessmentRequestPrice}
                onChange={(e) => setAssessmentRequestPrice(e.target.value)}
                placeholder={`Current price (${stock.currency})`}
                className="w-full md:w-56 bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none text-sm"
              />
              <button
                onClick={() => askAssessmentFromStockPage('grok')}
                disabled={assessmentAskingSource !== null}
                className="px-3 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assessmentAskingSource === 'grok' ? 'Asking Grok...' : 'Ask Grok'}
              </button>
              <button
                onClick={() => askAssessmentFromStockPage('deepseek')}
                disabled={assessmentAskingSource !== null}
                className="px-3 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assessmentAskingSource === 'deepseek' ? 'Asking Deepseek...' : 'Ask Deepseek'}
              </button>
              <button
                onClick={askAlphaVantageFromStockPage}
                disabled={assessmentAskingSource !== null}
                className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assessmentAskingSource === 'alphavantage' ? 'Asking Alpha Vantage...' : 'Ask Alpha Vantage'}
              </button>
              <button
                onClick={askAllFromStockPage}
                disabled={assessmentAskingSource !== null}
                className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assessmentAskingSource === 'all' ? 'Asking All...' : 'Ask All'}
              </button>
            </div>
            {assessmentAskError && (
              <p className="text-xs text-red-300 mt-2">{assessmentAskError}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-3 rounded-lg border border-gray-700 bg-gray-900/30">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-200">Grok</h3>
                {latestBySource.grok?.created_at && (
                  <span className="text-xs text-gray-500">
                    {new Date(latestBySource.grok.created_at).toLocaleString()}
                  </span>
                )}
              </div>
              {latestBySource.grok ? (
                <p className="text-sm text-gray-300 whitespace-pre-wrap max-h-56 overflow-y-auto">
                  {latestBySource.grok.assessment}
                </p>
              ) : (
                <p className="text-sm text-gray-500 italic">No Grok assessment yet.</p>
              )}
            </div>

            <div className="p-3 rounded-lg border border-gray-700 bg-gray-900/30">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-200">Deepseek</h3>
                {latestBySource.deepseek?.created_at && (
                  <span className="text-xs text-gray-500">
                    {new Date(latestBySource.deepseek.created_at).toLocaleString()}
                  </span>
                )}
              </div>
              {latestBySource.deepseek ? (
                <p className="text-sm text-gray-300 whitespace-pre-wrap max-h-56 overflow-y-auto">
                  {latestBySource.deepseek.assessment}
                </p>
              ) : (
                <p className="text-sm text-gray-500 italic">No Deepseek assessment yet.</p>
              )}
            </div>
          </div>

          {(grokAssessmentText && deepseekAssessmentText) && (
            <div className="mt-6 pt-4 border-t border-gray-700">
              <h3 className="text-sm font-semibold text-gray-200 mb-3">Assessment Diff (LLM Extracted)</h3>
              {assessmentCompareLoading ? (
                <p className="text-sm text-gray-400">Comparing Grok and Deepseek summaries...</p>
              ) : assessmentCompareError ? (
                <p className="text-sm text-red-300">{assessmentCompareError}</p>
              ) : assessmentCompareRows.length === 0 ? (
                <p className="text-sm text-gray-500">No comparison data available.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-gray-700">
                        <th className="py-2 pr-4 text-gray-400 font-medium">Parameter</th>
                        <th className="py-2 pr-4 text-gray-400 font-medium">Grok</th>
                        <th className="py-2 pr-4 text-gray-400 font-medium">Deepseek</th>
                        <th className="py-2 pr-4 text-gray-400 font-medium">Alpha Vantage</th>
                        <th className="py-2 pr-4 text-gray-400 font-medium">Average</th>
                        <th className="py-2 text-gray-400 font-medium">Diff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assessmentCompareRows.map((row) => {
                        const alphaValue = getAlphaVantageValueForRow(row.key);
                        const comparableValues = [row.grok || '', row.deepseek || '', alphaValue].filter((v) => !isMissingMetric(v));
                        const same =
                          comparableValues.length <= 1 ||
                          comparableValues.every((value) => compareMetricValues(comparableValues[0], value));
                        const averageValue = formatAverageMetric(row.key, [row.grok || '', row.deepseek || '', alphaValue]);
                        const averageNumeric = averageNumericMetric(row.key, [row.grok || '', row.deepseek || '', alphaValue]);
                        const canApply = Boolean(rowKeyToStockField[row.key] && averageNumeric !== null);
                        return (
                          <tr key={row.key} className="border-b border-gray-800 align-top">
                            <td className="py-2 pr-4 text-gray-200 font-medium">{row.label}</td>
                            <td className="py-2 pr-4 text-gray-300 whitespace-pre-wrap">{row.grok || 'N/A'}</td>
                            <td className="py-2 pr-4 text-gray-300 whitespace-pre-wrap">{row.deepseek || 'N/A'}</td>
                            <td className="py-2 pr-4 text-gray-300 whitespace-pre-wrap">{alphaValue}</td>
                            <td className="py-2 pr-4 text-gray-300 whitespace-pre-wrap">
                              <div className="flex items-center gap-2">
                                <span>{averageValue}</span>
                                {canApply && (
                                  <button
                                    onClick={() => applyAverageToStock(row)}
                                    disabled={assessmentApplyKey !== null}
                                    className="px-1.5 py-0.5 text-[11px] rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Apply averaged value to this stock field"
                                  >
                                    {assessmentApplyKey === row.key ? 'Applying...' : 'Apply'}
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className={`py-2 font-semibold ${same ? 'text-emerald-300' : 'text-amber-300'}`}>
                              {same ? 'Same' : 'Different'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
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
                <TooltipIcon text="The total current market value of your position in US Dollars (shares owned × current price converted through EUR base rates)." />
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
              <p className="text-xs text-gray-600 mt-1">
                {getKellyHint(stock) ?? 'Calculated'}
              </p>
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
              <p className="text-sm text-gray-400 mb-1 flex items-center">
                Buy Zone Status
                <TooltipIcon text="Status derived from current price versus buy-zone thresholds: EV >> 15%, within buy zone, outside buy zone, or no buy zone available." />
              </p>
              <p className={`text-lg font-semibold ${
                (stock.buy_zone_status || '') === 'EV >> 15%'
                  ? 'text-emerald-400'
                  : (stock.buy_zone_status || '') === 'within buy zone'
                    ? 'text-green-400'
                    : (stock.buy_zone_status || '') === 'outside buy zone'
                      ? 'text-gray-300'
                      : 'text-gray-400'
              }`}>
                {stock.buy_zone_status || 'N/A'}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {getDistanceToBuyZone(stock) !== 'N/A' ? `Distance: ${getDistanceToBuyZone(stock)}` : 'Calculated'}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-400 mb-1 flex items-center">
                Sell Zone (Min)
                <TooltipIcon text="Trim zone start price where EV approaches 3%. Consider reducing exposure above this level." />
              </p>
              <p className="text-lg font-semibold text-white">
                {(stock.sell_zone_lower_bound || 0).toFixed(2)} {stock.currency}
              </p>
              <p className="text-xs text-gray-600 mt-1">Calculated</p>
            </div>

            <div>
              <p className="text-sm text-gray-400 mb-1 flex items-center">
                Sell Zone (Max)
                <TooltipIcon text="Sell zone start price where EV reaches 0%. Above this level, probabilistic edge is no longer favorable." />
              </p>
              <p className="text-lg font-semibold text-white">
                {(stock.sell_zone_upper_bound || 0).toFixed(2)} {stock.currency}
              </p>
              <p className="text-xs text-gray-600 mt-1">Calculated</p>
            </div>

            <div>
              <p className="text-sm text-gray-400 mb-1 flex items-center">
                Sell Zone Status
                <TooltipIcon text="Status derived from current EV versus sell-zone thresholds: Below sell zone, In trim zone, or In sell zone." />
              </p>
              <p className={`text-lg font-semibold ${
                (stock.sell_zone_status || '') === 'In sell zone'
                  ? 'text-red-400'
                  : (stock.sell_zone_status || '') === 'In trim zone'
                    ? 'text-orange-400'
                    : 'text-emerald-400'
              }`}>
                {stock.sell_zone_status || 'N/A'}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {getDistanceToSellZone(stock) !== 'N/A' ? getDistanceToSellZone(stock) : 'Calculated'}
              </p>
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

