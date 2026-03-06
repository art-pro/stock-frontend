'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { assessmentAPI, analyticsAPI, exchangeRateAPI, portfolioAPI, settingsAPI, stockAPI, getErrorMessage } from '@/lib/api';
import type { AssessmentRequest, AssessmentResponse, AssessmentCompareRow, TopLoser, MoverData } from '@/lib/api';
import type { Stock, PortfolioMetrics, PortfolioUnits } from '@/lib/api';
import {
  getSectorRebalanceSummary,
  getConcentration,
  getSuggestedActions,
  formatRebalanceHintText,
  formatConcentrationHintText,
  formatSuggestedActionsHintText,
} from '@/lib/portfolioInsights';
import { useSectorTargetsContext } from '@/contexts/SectorTargetsContext';
import PortfolioOverviewSection from '@/components/PortfolioOverviewSection';
import RebalanceHint from '@/components/RebalanceHint';
import RiskCard from '@/components/RiskCard';
import SuggestedActions from '@/components/SuggestedActions';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

type AskingSource = 'grok' | 'deepseek' | 'perplexity' | 'chatgpt' | 'alphavantage' | 'all' | null;

function MoverCard({ title, items, valueKey, positive }: { title: string; items: MoverData[]; valueKey: 'price' | 'ev'; positive: boolean }) {
  const arrow = positive ? '▲' : '▼';
  const color = positive ? 'text-emerald-400' : 'text-red-400';
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">{title}</h3>
        <p className="text-gray-500 text-xs text-center py-4">No data available. Historical snapshots will appear after the next scheduled update.</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">{title}</h3>
      <div className="space-y-2">
        {items.map((m) => {
          const changePct = valueKey === 'price' ? m.price_change_percent : m.ev_change;
          const changeAbs = valueKey === 'price' ? m.price_change : m.ev_change;
          const unit = valueKey === 'price' ? '' : ' pp';
          const assessChanged = m.current_assessment !== m.previous_assessment;
          const assessColor = m.current_assessment === 'Add' ? 'text-emerald-300'
            : m.current_assessment === 'Sell' ? 'text-red-300'
            : m.current_assessment === 'Trim' ? 'text-orange-300'
            : 'text-blue-300';
          return (
            <div key={m.stock_id} className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-b-0">
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-primary-400">{m.ticker}</span>
                {m.company_name && <span className="ml-2 text-xs text-gray-500 truncate">{m.company_name}</span>}
              </div>
              <div className="flex items-center gap-4 text-sm shrink-0">
                <span className={color}>
                  {arrow} {Math.abs(changePct).toFixed(1)}%{unit}
                  {valueKey === 'price' && <span className="text-gray-500 text-xs ml-1">({changeAbs >= 0 ? '+' : ''}{changeAbs.toFixed(2)})</span>}
                </span>
                <span className={`text-xs ${assessColor}`}>
                  {assessChanged ? `${m.previous_assessment} → ${m.current_assessment}` : m.current_assessment}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AnalysisPage() {
  const router = useRouter();
  const { targetPctBySector } = useSectorTargetsContext();

  const [portfolioMetrics, setPortfolioMetrics] = useState<PortfolioMetrics | null>(null);
  const [portfolioStocks, setPortfolioStocks] = useState<Stock[]>([]);
  const [portfolioUnits, setPortfolioUnits] = useState<PortfolioUnits | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(true);

  const [ticker, setTicker] = useState('');
  const [isin, setIsin] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [currencies, setCurrencies] = useState<string[]>(['USD', 'EUR', 'GBP']);

  const [assessments, setAssessments] = useState<AssessmentResponse[]>([]);
  const [assessmentCompareRows, setAssessmentCompareRows] = useState<AssessmentCompareRow[]>([]);
  const [assessmentCompareLoading, setAssessmentCompareLoading] = useState(false);
  const [assessmentCompareError, setAssessmentCompareError] = useState<string | null>(null);
  const [assessmentRefreshing, setAssessmentRefreshing] = useState(false);
  const [assessmentAskingSource, setAssessmentAskingSource] = useState<AskingSource>(null);
  const [assessmentAskError, setAssessmentAskError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [recentAssessments, setRecentAssessments] = useState<AssessmentResponse[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentResponse | null>(null);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);

  const [topLosers, setTopLosers] = useState<TopLoser[]>([]);
  const [topLosersLoading, setTopLosersLoading] = useState(false);
  const [topLosersError, setTopLosersError] = useState<string | null>(null);
  const [topLosersLimit, setTopLosersLimit] = useState(10);
  const [topLosersMinShares, setTopLosersMinShares] = useState(1);

  const [topMovers, setTopMovers] = useState<{ topGainers: MoverData[]; topLosers: MoverData[]; biggestEVRises: MoverData[]; biggestEVDrops: MoverData[] }>({ topGainers: [], topLosers: [], biggestEVRises: [], biggestEVDrops: [] });
  const [topMoversLoading, setTopMoversLoading] = useState(false);
  const [topMoversError, setTopMoversError] = useState<string | null>(null);
  const [topMoversTimeframe, setTopMoversTimeframe] = useState<'24h' | '7d' | '30d'>('24h');
  const [topMoversLimit, setTopMoversLimit] = useState(5);
  const [topMoversGeneratedAt, setTopMoversGeneratedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    fetchRecentAssessments();
    fetchCurrencies();
    fetchPortfolioSummary();
    fetchTopLosers();
    fetchTopMovers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const fetchPortfolioSummary = async () => {
    try {
      setPortfolioLoading(true);
      const response = await portfolioAPI.getSummary(undefined, { forceRefresh: false });
      setPortfolioStocks(response.data.stocks || []);
      setPortfolioMetrics(response.data.summary || null);
      setPortfolioUnits(response.data.units || null);
    } catch (err) {
      console.warn('Failed to fetch portfolio for analysis context:', err);
    } finally {
      setPortfolioLoading(false);
    }
  };

  const fetchCurrencies = async () => {
    try {
      const response = await exchangeRateAPI.getAll();
      const currencyCodes = response.data.map((rate: any) => rate.currency_code);
      setCurrencies(['USD', 'EUR', ...currencyCodes.filter((c: string) => c !== 'USD' && c !== 'EUR')]);
    } catch (err) {
      console.warn('Failed to fetch currencies, using defaults:', err);
    }
  };

  const fetchRecentAssessments = async () => {
    try {
      const response = await assessmentAPI.getRecent();
      setRecentAssessments(response.data);
    } catch (err) {
      console.warn('Failed to fetch recent assessments:', err);
    }
  };

  const fetchTopLosers = async (limit?: number, minShares?: number) => {
    const l = limit ?? topLosersLimit;
    const ms = minShares ?? topLosersMinShares;
    try {
      setTopLosersLoading(true);
      setTopLosersError(null);
      const response = await analyticsAPI.getTopLosers(l, ms);
      setTopLosers(response.data.losers || []);
    } catch (err) {
      setTopLosersError(getErrorMessage(err));
    } finally {
      setTopLosersLoading(false);
    }
  };

  const fetchTopMovers = async (timeframe?: '24h' | '7d' | '30d', limit?: number) => {
    const tf = timeframe ?? topMoversTimeframe;
    const l = limit ?? topMoversLimit;
    try {
      setTopMoversLoading(true);
      setTopMoversError(null);
      const response = await analyticsAPI.getTopMovers(tf, l);
      setTopMovers({
        topGainers: response.data.top_gainers || [],
        topLosers: response.data.top_losers || [],
        biggestEVRises: response.data.biggest_ev_rises || [],
        biggestEVDrops: response.data.biggest_ev_drops || [],
      });
      setTopMoversGeneratedAt(response.data.generated_at || null);
    } catch (err) {
      setTopMoversError(getErrorMessage(err));
    } finally {
      setTopMoversLoading(false);
    }
  };

  const latestBySource = assessments.reduce<{
    grok?: AssessmentResponse;
    deepseek?: AssessmentResponse;
    perplexity?: AssessmentResponse;
    chatgpt?: AssessmentResponse;
  }>((acc, item) => {
    const src = (item.source || '').toLowerCase();
    if (src === 'grok' && !acc.grok) acc.grok = item;
    if (src === 'deepseek' && !acc.deepseek) acc.deepseek = item;
    if (src === 'perplexity' && !acc.perplexity) acc.perplexity = item;
    if (src === 'chatgpt' && !acc.chatgpt) acc.chatgpt = item;
    return acc;
  }, {});
  const grokAssessmentText = latestBySource.grok?.assessment || '';
  const deepseekAssessmentText = latestBySource.deepseek?.assessment || '';
  const perplexityAssessmentText = latestBySource.perplexity?.assessment || '';
  const chatgptAssessmentText = latestBySource.chatgpt?.assessment || '';

  const refreshAssessments = async () => {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    try {
      setAssessmentRefreshing(true);
      const response = await assessmentAPI.getByTicker(t, undefined, 30);
      const items = response.data || [];
      if (items.length > 0) setAssessments(items);
    } catch (err: any) {
      console.warn('Failed to refresh assessments', err);
    } finally {
      setAssessmentRefreshing(false);
    }
  };

  const upsertLocalAssessment = (source: 'grok' | 'deepseek' | 'perplexity' | 'chatgpt', assessmentText: string) => {
    if (!assessmentText) return;
    const t = ticker.trim().toUpperCase();
    const idOffset = source === 'grok' ? 1 : source === 'deepseek' ? 2 : source === 'perplexity' ? 3 : 4;
    const nextEntry: AssessmentResponse = {
      id: Date.now() + idOffset,
      ticker: t,
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

  const validateFields = (): boolean => {
    if (!ticker.trim()) {
      setValidationError('Ticker is required');
      return false;
    }
    if (!isin.trim()) {
      setValidationError('ISIN is required');
      return false;
    }
    const priceVal = Number.parseFloat(currentPrice.replace(',', '.'));
    if (!Number.isFinite(priceVal) || priceVal <= 0) {
      setValidationError('Current Price must be a positive number');
      return false;
    }
    setValidationError(null);
    return false || true;
  };

  const buildDashboardHints = async (): Promise<Partial<AssessmentRequest>> => {
    const hints: Partial<AssessmentRequest> = {};
    try {
      const [summaryRes, sectorTargetsRes] = await Promise.all([
        portfolioAPI.getSummary(),
        settingsAPI.getSectorTargets(),
      ]);
      const summary = summaryRes.data?.summary;
      const stocks = summaryRes.data?.stocks ?? [];
      const rows = sectorTargetsRes.data?.rows;
      const sectorTargets: Record<string, { min: number; max: number }> | undefined =
        Array.isArray(rows) && rows.length > 0
          ? rows
              .filter((r: { sector: string }) => (r.sector || '').toLowerCase() !== 'cash')
              .reduce(
                (acc: Record<string, { min: number; max: number }>, r: { sector: string; min: number; max: number }) => ({
                  ...acc,
                  [r.sector]: { min: r.min, max: r.max },
                }),
                {}
              )
          : undefined;

      if (summary?.sector_weights && Object.keys(summary.sector_weights).length > 0) {
        const rebalanceSummary = getSectorRebalanceSummary(summary.sector_weights, sectorTargets);
        const rebalanceHint = formatRebalanceHintText(rebalanceSummary);
        if (rebalanceHint) hints.rebalance_hint = rebalanceHint;
      }

      const activeStocks = stocks.filter((s: { shares_owned?: number }) => (s.shares_owned ?? 0) > 0);
      if (activeStocks.length > 0) {
        const conc = getConcentration(stocks);
        const concentrationHint = formatConcentrationHintText(conc);
        if (concentrationHint) hints.concentration_hint = concentrationHint;
      }

      if (summary?.sector_weights && stocks.length > 0) {
        const actions = getSuggestedActions(summary.sector_weights, stocks, sectorTargets);
        const suggestedHint = formatSuggestedActionsHintText(actions);
        if (suggestedHint) hints.suggested_actions_hint = suggestedHint;
      }
    } catch (hintErr) {
      console.warn('Could not fetch dashboard hints for assessment, continuing without them', hintErr);
    }
    return hints;
  };

  const buildPayload = (source: 'grok' | 'deepseek' | 'perplexity' | 'chatgpt'): AssessmentRequest | null => {
    const t = ticker.trim().toUpperCase();
    if (!t) return null;
    const requestPrice = Number.parseFloat(currentPrice.replace(',', '.'));
    const payload: AssessmentRequest = {
      ticker: t,
      source,
      isin: isin.trim().toUpperCase() || undefined,
      company_name: companyName.trim() || undefined,
    };
    if (Number.isFinite(requestPrice) && requestPrice > 0) {
      payload.current_price = requestPrice;
      payload.currency = currency;
    }
    return payload;
  };

  const askSource = async (source: 'grok' | 'deepseek' | 'perplexity' | 'chatgpt') => {
    if (!validateFields()) return;
    try {
      setAssessmentAskingSource(source);
      setAssessmentAskError(null);
      const payload = buildPayload(source);
      if (!payload) return;
      const hints = await buildDashboardHints();
      Object.assign(payload, hints);
      const response = await assessmentAPI.request(payload);
      const text = response.data?.assessment || '';
      upsertLocalAssessment(source, text);
      await fetchRecentAssessments();
      await new Promise((resolve) => setTimeout(resolve, 300));
      await refreshAssessments();
    } catch (err: any) {
      setAssessmentAskError(err.response?.data?.error || err.message || 'Failed to request assessment');
    } finally {
      setAssessmentAskingSource(null);
    }
  };

  const askAlphaVantage = async () => {
    if (!validateFields()) return;
    setAssessmentAskingSource('alphavantage');
    setAssessmentAskError(null);
    setAssessmentAskError('Alpha Vantage is only available on a stock page (requires a saved stock).');
    setAssessmentAskingSource(null);
  };

  const askAll = async () => {
    if (!validateFields()) return;
    try {
      setAssessmentAskingSource('all');
      setAssessmentAskError(null);
      const grokPayload = buildPayload('grok');
      const deepseekPayload = buildPayload('deepseek');
      const perplexityPayload = buildPayload('perplexity');
      const chatgptPayload = buildPayload('chatgpt');
      if (!grokPayload || !deepseekPayload || !perplexityPayload || !chatgptPayload) return;
      const hints = await buildDashboardHints();
      Object.assign(grokPayload, hints);
      Object.assign(deepseekPayload, hints);
      Object.assign(perplexityPayload, hints);
      Object.assign(chatgptPayload, hints);

      const [grokRes, deepseekRes, perplexityRes, chatgptRes] = await Promise.all([
        assessmentAPI.request(grokPayload),
        assessmentAPI.request(deepseekPayload),
        assessmentAPI.request(perplexityPayload),
        assessmentAPI.request(chatgptPayload),
      ]);
      upsertLocalAssessment('grok', grokRes.data?.assessment || '');
      upsertLocalAssessment('deepseek', deepseekRes.data?.assessment || '');
      upsertLocalAssessment('perplexity', perplexityRes.data?.assessment || '');
      upsertLocalAssessment('chatgpt', chatgptRes.data?.assessment || '');
      await fetchRecentAssessments();
      await new Promise((resolve) => setTimeout(resolve, 400));
      await refreshAssessments();
    } catch (err: any) {
      setAssessmentAskError(err.response?.data?.error || err.message || 'Failed to request all sources');
    } finally {
      setAssessmentAskingSource(null);
    }
  };

  useEffect(() => {
    const t = ticker.trim().toUpperCase();
    if (!t || !grokAssessmentText || !deepseekAssessmentText) {
      setAssessmentCompareRows([]);
      setAssessmentCompareError(null);
      return;
    }
    let cancelled = false;
    const runCompare = async () => {
      try {
        setAssessmentCompareLoading(true);
        setAssessmentCompareError(null);
        let response = await assessmentAPI.getDiffByTicker(t);
        if (!response.data.rows || response.data.rows.length === 0) {
          response = await assessmentAPI.compare({
            ticker: t,
            grok_assessment: grokAssessmentText,
            deepseek_assessment: deepseekAssessmentText,
            ...(perplexityAssessmentText ? { perplexity_assessment: perplexityAssessmentText } : {}),
            ...(chatgptAssessmentText ? { chatgpt_assessment: chatgptAssessmentText } : {}),
          });
        }
        if (!cancelled) setAssessmentCompareRows(response.data.rows || []);
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
    return () => { cancelled = true; };
  }, [ticker, grokAssessmentText, deepseekAssessmentText, perplexityAssessmentText, chatgptAssessmentText]);

  const parseMetricValue = (value: string) => {
    const raw = (value || '').trim();
    const upperRaw = raw.toUpperCase();
    const hasPercent = raw.includes('%');
    const hasMultiple = /\bx\b/i.test(raw);
    const codeMatch = upperRaw.match(/\b(USD|EUR|GBP|DKK|RUB|JPY|CHF|CAD|AUD|NOK|SEK)\b/);
    const symbolMatch = raw.match(/[$€£¥]/);
    const numberMatch = raw.match(/-?\d[\d,]*\.?\d*/);
    if (!numberMatch) return { hasNumeric: false, normalizedText: upperRaw.replace(/\s+/g, ' ').trim() };
    let numericToken = numberMatch[0];
    if (numericToken.includes(',') && numericToken.includes('.')) {
      numericToken = numericToken.replace(/,/g, '');
    } else if (numericToken.includes(',')) {
      const afterComma = numericToken.split(',').pop() ?? '';
      if (afterComma.length === 3 && /^\d{3}$/.test(afterComma)) numericToken = numericToken.replace(/,/g, '');
      else numericToken = numericToken.replace(/,/g, '.');
    }
    const numericValue = Number.parseFloat(numericToken);
    if (!Number.isFinite(numericValue)) return { hasNumeric: false, normalizedText: upperRaw.replace(/\s+/g, ' ').trim() };
    const unitType = hasPercent ? 'percent' : (codeMatch || symbolMatch) ? 'currency' : hasMultiple ? 'multiple' : 'plain';
    return { hasNumeric: true, numericValue, unitType, currencyCode: codeMatch?.[1], currencySymbol: symbolMatch?.[0], normalizedText: upperRaw.replace(/\s+/g, ' ').trim() };
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

  const TRIMMED_MEAN_ROW_KEYS = new Set<string>(['beta', 'volatility']);

  const medianOfNumbers = (nums: number[]): number => {
    if (nums.length === 0) return 0;
    const sorted = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  };

  const trimmedMeanOfNumbers = (nums: number[]): number => {
    if (nums.length === 0) return 0;
    if (nums.length <= 2) return nums.reduce((a, b) => a + b, 0) / nums.length;
    const sorted = [...nums].sort((a, b) => a - b);
    const trimmed = sorted.slice(1, -1);
    return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  };

  const formatResultMetric = (rowKey: string, values: string[]) => {
    if (rowKey === 'current_price') return '—';
    const parsedValues = values.map(parseMetricValue).filter((v) => v.hasNumeric);
    if (parsedValues.length === 0) return 'N/A';
    const nums = parsedValues.map((v) => v.numericValue ?? 0);
    const value = TRIMMED_MEAN_ROW_KEYS.has(rowKey) ? trimmedMeanOfNumbers(nums) : medianOfNumbers(nums);
    const preferredUnit = parsedValues.find((v) => v.unitType !== 'plain')?.unitType || 'plain';
    const preferredCode = parsedValues.find((v) => v.currencyCode)?.currencyCode;
    const preferredSymbol = parsedValues.find((v) => v.currencySymbol)?.currencySymbol;
    if (preferredUnit === 'percent') return `${value.toFixed(2)}%`;
    if (preferredUnit === 'multiple') return `${value.toFixed(2)}x`;
    if (preferredUnit === 'currency') {
      if (preferredCode) return `${value.toFixed(2)} ${preferredCode}`;
      if (preferredSymbol) return `${preferredSymbol}${value.toFixed(2)}`;
    }
    return value.toFixed(2);
  };

  const markdownComponents = {
    h1: ({ children }: any) => <h1 className="text-2xl font-bold text-white mt-8 mb-4 border-b border-gray-600 pb-2">{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-xl font-bold text-white mt-6 mb-3">{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-lg font-bold text-blue-300 mt-5 mb-3">{children}</h3>,
    h4: ({ children }: any) => <h4 className="text-md font-semibold text-green-400 mt-4 mb-2">{children}</h4>,
    h5: ({ children }: any) => <h5 className="text-sm font-semibold text-yellow-400 mt-3 mb-2">{children}</h5>,
    h6: ({ children }: any) => <h6 className="text-sm font-medium text-gray-300 mt-3 mb-2">{children}</h6>,
    p: ({ children }: any) => <p className="text-gray-300 mb-3 leading-relaxed">{children}</p>,
    strong: ({ children }: any) => <strong className="text-white font-semibold">{children}</strong>,
    em: ({ children }: any) => <em className="text-gray-200 italic">{children}</em>,
    ul: ({ children }: any) => <ul className="list-disc list-inside mb-4 ml-4 space-y-1">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal list-inside mb-4 ml-4 space-y-1">{children}</ol>,
    li: ({ children }: any) => <li className="text-gray-300">{children}</li>,
    blockquote: ({ children }: any) => <blockquote className="border-l-4 border-blue-500 pl-4 py-2 mb-4 bg-gray-800 rounded-r">{children}</blockquote>,
    code: ({ children }: any) => <code className="bg-gray-800 text-green-400 px-1 py-0.5 rounded text-sm font-mono">{children}</code>,
    pre: ({ children }: any) => <pre className="bg-gray-800 text-gray-300 p-4 rounded-lg mb-4 overflow-x-auto">{children}</pre>,
    table: ({ children }: any) => <table className="min-w-full border border-gray-600 mb-4">{children}</table>,
    thead: ({ children }: any) => <thead className="bg-gray-700">{children}</thead>,
    tbody: ({ children }: any) => <tbody>{children}</tbody>,
    tr: ({ children }: any) => <tr className="border-b border-gray-600">{children}</tr>,
    th: ({ children }: any) => <th className="px-4 py-2 text-left text-gray-300 font-semibold">{children}</th>,
    td: ({ children }: any) => <td className="px-4 py-2 text-gray-300">{children}</td>,
    a: ({ children, href }: any) => <a href={href} className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">{children}</a>,
    hr: () => <hr className="border-gray-600 my-6" />,
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-400" />;
      case 'failed':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />;
      default:
        return <ClockIcon className="h-5 w-5 text-yellow-400" />;
    }
  };

  const handleOpenAssessment = (a: AssessmentResponse) => {
    setSelectedAssessment(a);
    setShowAssessmentModal(true);
  };

  const handleCloseAssessmentModal = () => {
    setSelectedAssessment(null);
    setShowAssessmentModal(false);
  };

  const activeStocks = portfolioStocks.filter((s) => (s.shares_owned ?? 0) > 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {!portfolioLoading && portfolioMetrics && (
        <PortfolioOverviewSection metrics={portfolioMetrics} units={portfolioUnits} stocks={activeStocks} />
      )}

      {!portfolioLoading && portfolioMetrics && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 items-stretch">
            <div className="min-h-0 flex">
              <RebalanceHint metrics={portfolioMetrics} sectorTargets={targetPctBySector} />
            </div>
            <div className="min-h-0 flex">
              <RiskCard stocks={portfolioStocks} />
            </div>
          </div>
          <div className="mb-8">
            <SuggestedActions metrics={portfolioMetrics} stocks={portfolioStocks} sectorTargets={targetPctBySector} />
          </div>
        </>
      )}

      {/* Top Losers */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold text-white">Top Losers</h2>
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-400">
              Limit
              <select
                value={topLosersLimit}
                onChange={(e) => { const v = Number(e.target.value); setTopLosersLimit(v); fetchTopLosers(v, topLosersMinShares); }}
                className="ml-1 bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-600"
              >
                {[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-400">
              Min shares
              <input
                type="number"
                min={0}
                value={topLosersMinShares}
                onChange={(e) => { const v = Math.max(0, Number(e.target.value)); setTopLosersMinShares(v); fetchTopLosers(topLosersLimit, v); }}
                className="ml-1 w-16 bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-600"
              />
            </label>
            <button
              onClick={() => fetchTopLosers()}
              disabled={topLosersLoading}
              className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {topLosersLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {topLosersError && (
          <p className="text-red-400 text-sm mb-3">{topLosersError}</p>
        )}

        {topLosersLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
          </div>
        ) : topLosers.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-6">No losing positions found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700 text-left">
                  <th className="py-2 pr-3">Ticker</th>
                  <th className="py-2 pr-3">Company</th>
                  <th className="py-2 pr-3">Sector</th>
                  <th className="py-2 pr-3 text-right">P&amp;L (USD)</th>
                  <th className="py-2 pr-3 text-right">P&amp;L %</th>
                  <th className="py-2 pr-3 text-right">Price</th>
                  <th className="py-2 pr-3 text-right">Shares</th>
                  <th className="py-2 pr-3 text-right">Weight</th>
                  <th className="py-2 pr-3 text-right">EV</th>
                  <th className="py-2 pr-3">Assessment</th>
                </tr>
              </thead>
              <tbody>
                {topLosers.map((loser) => {
                  const weightPct = loser.weight <= 1 ? loser.weight * 100 : loser.weight;
                  const assessColor = loser.assessment === 'Sell' ? 'bg-red-900 text-red-300'
                    : loser.assessment === 'Trim' ? 'bg-orange-900 text-orange-300'
                    : loser.assessment === 'Add' ? 'bg-green-900 text-green-300'
                    : 'bg-blue-900 text-blue-300';
                  return (
                    <tr key={loser.ticker} className="border-b border-gray-800 hover:bg-gray-750">
                      <td className="py-2 pr-3 font-medium text-primary-400">{loser.ticker}</td>
                      <td className="py-2 pr-3 text-gray-300 max-w-[120px] truncate" title={loser.company_name}>{loser.company_name}</td>
                      <td className="py-2 pr-3"><span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">{loser.sector || '—'}</span></td>
                      <td className="py-2 pr-3 text-right text-red-400 font-medium">${loser.unrealized_pnl.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                      <td className="py-2 pr-3 text-right text-red-400">{loser.unrealized_pnl_pct.toFixed(1)}%</td>
                      <td className="py-2 pr-3 text-right text-gray-300">{loser.current_price.toFixed(2)} {loser.currency}</td>
                      <td className="py-2 pr-3 text-right text-gray-300">{loser.shares_owned}</td>
                      <td className="py-2 pr-3 text-right text-gray-300" title={`Buy zone: ${loser.buy_zone_status} · Sell zone: ${loser.sell_zone_status}`}>{weightPct.toFixed(1)}%</td>
                      <td className="py-2 pr-3 text-right text-gray-300">{loser.expected_value.toFixed(1)}%</td>
                      <td className="py-2 pr-3"><span className={`text-xs px-2 py-0.5 rounded ${assessColor}`}>{loser.assessment}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Movers */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white">Top Movers</h2>
            {topMoversGeneratedAt && (
              <span className="text-xs text-gray-500">as of {new Date(topMoversGeneratedAt).toLocaleString()}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-400">
              Timeframe
              <select
                value={topMoversTimeframe}
                onChange={(e) => { const v = e.target.value as '24h' | '7d' | '30d'; setTopMoversTimeframe(v); fetchTopMovers(v, topMoversLimit); }}
                className="ml-1 bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-600"
              >
                <option value="24h">24 h</option>
                <option value="7d">7 d</option>
                <option value="30d">30 d</option>
              </select>
            </label>
            <label className="text-xs text-gray-400">
              Limit
              <select
                value={topMoversLimit}
                onChange={(e) => { const v = Number(e.target.value); setTopMoversLimit(v); fetchTopMovers(topMoversTimeframe, v); }}
                className="ml-1 bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-600"
              >
                {[5, 10, 20].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button
              onClick={() => fetchTopMovers()}
              disabled={topMoversLoading}
              className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {topMoversLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {topMoversError && (
          <p className="text-red-400 text-sm mb-3">{topMoversError}</p>
        )}

        {topMoversLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Gainers (price) */}
            <MoverCard title="Top Gainers" items={topMovers.topGainers} valueKey="price" positive />
            {/* Top Losers (price) */}
            <MoverCard title="Top Losers" items={topMovers.topLosers} valueKey="price" positive={false} />
            {/* Biggest EV Rises */}
            <MoverCard title="Biggest EV Rises" items={topMovers.biggestEVRises} valueKey="ev" positive />
            {/* Biggest EV Drops */}
            <MoverCard title="Biggest EV Drops" items={topMovers.biggestEVDrops} valueKey="ev" positive={false} />
          </div>
        )}
      </div>

      {/* Assessment Pane */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Assessment</h2>
          <button
            onClick={refreshAssessments}
            disabled={assessmentRefreshing || !ticker.trim()}
            className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Fetch latest assessments for this ticker"
          >
            {assessmentRefreshing ? 'Refreshing...' : 'Refresh Assessment'}
          </button>
        </div>

        {/* Input fields */}
        <div className="mb-4 p-3 rounded-lg border border-gray-700 bg-gray-900/30">
          <p className="text-xs text-gray-400 mb-3">Enter stock details and request assessments from multiple sources.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Ticker *</label>
              <input
                type="text"
                value={ticker}
                onChange={(e) => { setTicker(e.target.value.toUpperCase()); setValidationError(null); }}
                placeholder="e.g., AAPL"
                className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none text-sm"
                disabled={assessmentAskingSource !== null}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">ISIN *</label>
              <input
                type="text"
                value={isin}
                onChange={(e) => { setIsin(e.target.value.toUpperCase()); setValidationError(null); }}
                placeholder="e.g., US0378331005"
                maxLength={12}
                className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none text-sm uppercase"
                disabled={assessmentAskingSource !== null}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Current Price *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={currentPrice}
                  onChange={(e) => { setCurrentPrice(e.target.value); setValidationError(null); }}
                  placeholder="e.g., 150.50"
                  className="flex-1 bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none text-sm"
                  disabled={assessmentAskingSource !== null}
                />
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-20 bg-gray-700 text-white rounded-lg px-2 py-2 border border-gray-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none text-sm"
                  disabled={assessmentAskingSource !== null}
                >
                  {currencies.map((curr) => (
                    <option key={curr} value={curr}>{curr}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g., Apple Inc."
                className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none text-sm"
                disabled={assessmentAskingSource !== null}
              />
            </div>
          </div>

          {validationError && (
            <p className="text-xs text-red-300 mb-3">{validationError}</p>
          )}

          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            <button
              onClick={() => askSource('grok')}
              disabled={assessmentAskingSource !== null}
              className="px-3 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {assessmentAskingSource === 'grok' ? 'Asking Grok...' : 'Ask Grok'}
            </button>
            <button
              onClick={() => askSource('deepseek')}
              disabled={assessmentAskingSource !== null}
              className="px-3 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {assessmentAskingSource === 'deepseek' ? 'Asking Deepseek...' : 'Ask Deepseek'}
            </button>
            <button
              onClick={() => askSource('perplexity')}
              disabled={assessmentAskingSource !== null}
              className="px-3 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {assessmentAskingSource === 'perplexity' ? 'Asking Perplexity...' : 'Ask Perplexity'}
            </button>
            <button
              onClick={() => askSource('chatgpt')}
              disabled={assessmentAskingSource !== null}
              className="px-3 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {assessmentAskingSource === 'chatgpt' ? 'Asking ChatGPT...' : 'Ask ChatGPT'}
            </button>
            <button
              onClick={askAlphaVantage}
              disabled={assessmentAskingSource !== null}
              className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {assessmentAskingSource === 'alphavantage' ? 'Asking Alpha Vantage...' : 'Ask Alpha Vantage'}
            </button>
            <button
              onClick={askAll}
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

        {/* Assessment cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {(['grok', 'deepseek', 'perplexity', 'chatgpt'] as const).map((src) => {
            const entry = latestBySource[src];
            const labels: Record<string, string> = { grok: 'Grok', deepseek: 'Deepseek', perplexity: 'Perplexity', chatgpt: 'ChatGPT' };
            return (
              <div key={src} className="p-3 rounded-lg border border-gray-700 bg-gray-900/30">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-200">{labels[src]}</h3>
                  {entry?.created_at && (
                    <span className="text-xs text-gray-500">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  )}
                </div>
                {entry ? (
                  <p className="text-sm text-gray-300 whitespace-pre-wrap max-h-56 overflow-y-auto">{entry.assessment}</p>
                ) : (
                  <p className="text-sm text-gray-500 italic">No {labels[src]} assessment yet.</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Assessment Diff */}
        {(grokAssessmentText && deepseekAssessmentText) && (
          <div className="mt-6 pt-4 border-t border-gray-700">
            <h3 className="text-sm font-semibold text-gray-200 mb-3">Assessment Diff (LLM Extracted)</h3>
            {assessmentCompareLoading ? (
              <p className="text-sm text-gray-400">Comparing LLM summaries...</p>
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
                      <th className="py-2 pr-4 text-gray-400 font-medium">Perplexity</th>
                      <th className="py-2 pr-4 text-gray-400 font-medium">ChatGPT</th>
                      <th className="py-2 pr-4 text-gray-400 font-medium">Result</th>
                      <th className="py-2 text-gray-400 font-medium">Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessmentCompareRows.map((row) => {
                      const values = [row.grok || '', row.deepseek || '', row.perplexity || '', row.chatgpt || ''];
                      const comparableValues = values.filter((v) => !isMissingMetric(v));
                      const same =
                        comparableValues.length <= 1 ||
                        comparableValues.every((value) => compareMetricValues(comparableValues[0]!, value));
                      const resultValue = formatResultMetric(row.key, values);
                      return (
                        <tr key={row.key} className="border-b border-gray-800 align-top">
                          <td className="py-2 pr-4 text-gray-200 font-medium">{row.label}</td>
                          <td className="py-2 pr-4 text-gray-300 whitespace-pre-wrap">{row.grok || 'N/A'}</td>
                          <td className="py-2 pr-4 text-gray-300 whitespace-pre-wrap">{row.deepseek || 'N/A'}</td>
                          <td className="py-2 pr-4 text-gray-300 whitespace-pre-wrap">{row.perplexity ?? 'N/A'}</td>
                          <td className="py-2 pr-4 text-gray-300 whitespace-pre-wrap">{row.chatgpt ?? 'N/A'}</td>
                          <td className="py-2 pr-4 text-gray-300 whitespace-pre-wrap">{resultValue}</td>
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

      {/* Strategy Description */}
      <div className="bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg p-6 mb-8">
        <h3 className="text-lg font-bold text-blue-300 mb-3">Assessment Strategy</h3>
        <div className="text-sm text-blue-200 space-y-2">
          <p><strong>Probabilistic Framework:</strong> Each assessment follows a 6-step process:</p>
          <ol className="list-decimal list-inside space-y-1 ml-4">
            <li>Data collection (price, fair value, fundamentals)</li>
            <li>Expected Value calculation: EV = (p × upside) + ((1-p) × downside)</li>
            <li>Kelly Criterion sizing: ½-Kelly position sizing (capped at 15%)</li>
            <li>Assessment: Add (EV &gt;7%), Hold (EV &gt;0%), Trim (EV &lt;3%), Sell (EV &lt;0%)</li>
            <li>Buy zone recommendations for optimal entry points</li>
            <li>Sector allocation and risk management notes</li>
          </ol>
          <p className="mt-3"><strong>Philosophy:</strong> Conservative probability estimates, mathematical position sizing, and disciplined sector allocation targeting 11-13% portfolio volatility with 10-11% expected returns.</p>
        </div>
      </div>

      {/* Recent Assessments */}
      {recentAssessments.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-bold text-white mb-4">Recent Assessments</h2>
          <div className="space-y-3">
            {recentAssessments.map((item, index) => (
              <div
                key={index}
                onClick={() => item.status === 'completed' && handleOpenAssessment(item)}
                className={`flex items-center justify-between bg-gray-700 rounded-lg p-4 ${
                  item.status === 'completed' ? 'cursor-pointer hover:bg-gray-600 transition-colors' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  {getStatusIcon(item.status)}
                  <div>
                    <span className="text-white font-medium">{item.ticker}</span>
                    <span className="text-gray-400 ml-2">via {item.source}</span>
                    {item.status === 'completed' && (
                      <span className="text-xs text-blue-400 ml-2">(Click to view)</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-400">{formatDate(item.created_at)}</div>
                  <div className={`text-xs px-2 py-1 rounded ${
                    item.status === 'completed' ? 'bg-green-900 text-green-300' :
                    item.status === 'failed' ? 'bg-red-900 text-red-300' :
                    'bg-yellow-900 text-yellow-300'
                  }`}>
                    {item.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {assessmentAskingSource !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
              <div>
                <p className="text-white font-medium">Processing...</p>
                <p className="text-gray-400 text-sm">Please wait while we handle your request.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assessment Detail Modal */}
      {showAssessmentModal && selectedAssessment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg border border-gray-700 max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Assessment: {selectedAssessment.ticker}
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  Generated via {selectedAssessment.source} on {formatDate(selectedAssessment.created_at)}
                </p>
              </div>
              <button
                onClick={handleCloseAssessmentModal}
                className="text-gray-400 hover:text-white transition-colors p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(90vh-100px)] p-6">
              <div className="prose prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {selectedAssessment.assessment}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
