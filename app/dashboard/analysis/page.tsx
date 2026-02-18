'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { assessmentAPI, exchangeRateAPI, portfolioAPI, settingsAPI, getErrorMessage } from '@/lib/api';
import type { AssessmentRequest, AssessmentResponse } from '@/lib/api';
import type { Stock, PortfolioMetrics } from '@/lib/api';
import {
  getSectorRebalanceSummary,
  getConcentration,
  getSuggestedActions,
  formatRebalanceHintText,
  formatConcentrationHintText,
  formatSuggestedActionsHintText,
} from '@/lib/portfolioInsights';
import { useSectorTargetsContext } from '@/contexts/SectorTargetsContext';
import RebalanceHint from '@/components/RebalanceHint';
import RiskCard from '@/components/RiskCard';
import SuggestedActions from '@/components/SuggestedActions';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

export default function AnalysisPage() {
  const router = useRouter();
  const { targetPctBySector } = useSectorTargetsContext();

  // Portfolio context for rebalance / risk / suggested actions
  const [portfolioMetrics, setPortfolioMetrics] = useState<PortfolioMetrics | null>(null);
  const [portfolioStocks, setPortfolioStocks] = useState<Stock[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(true);

  // Single Assessment State
  const [ticker, setTicker] = useState('');
  const [isin, setIsin] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [currencies, setCurrencies] = useState<string[]>(['USD', 'EUR', 'GBP']);
  const [source, setSource] = useState<'grok' | 'deepseek' | 'perplexity' | 'chatgpt'>('grok');
  const [loading, setLoading] = useState(false);
  const [assessment, setAssessment] = useState<string>('');
  const [error, setError] = useState('');
  const [recentAssessments, setRecentAssessments] = useState<AssessmentResponse[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentResponse | null>(null);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    fetchRecentAssessments();
    fetchCurrencies();
    fetchPortfolioSummary();
  }, [router]);

  const fetchPortfolioSummary = async () => {
    try {
      setPortfolioLoading(true);
      const response = await portfolioAPI.getSummary(undefined, { forceRefresh: false });
      setPortfolioStocks(response.data.stocks || []);
      setPortfolioMetrics(response.data.summary || null);
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

  const handleAssessment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!ticker.trim()) {
      setError('Please enter a stock ticker');
      return;
    }

    setLoading(true);
    setError('');
    setAssessment('');

    try {
      const requestData: AssessmentRequest = {
        ticker: ticker.toUpperCase().trim(),
        source,
      };

      if (isin.trim()) {
        requestData.isin = isin.trim().toUpperCase();
      }

      if (companyName.trim()) {
        requestData.company_name = companyName.trim();
      }

      if (currentPrice && parseFloat(currentPrice) > 0) {
        requestData.current_price = parseFloat(currentPrice);
        requestData.currency = currency;
      }

      // Fetch portfolio summary and sector targets to send dashboard hints to the LLM
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
          if (rebalanceHint) requestData.rebalance_hint = rebalanceHint;
        }

        const activeStocks = stocks.filter((s: { shares_owned?: number }) => (s.shares_owned ?? 0) > 0);
        if (activeStocks.length > 0) {
          const conc = getConcentration(stocks);
          const concentrationHint = formatConcentrationHintText(conc);
          if (concentrationHint) requestData.concentration_hint = concentrationHint;
        }

        if (summary?.sector_weights && stocks.length > 0) {
          const actions = getSuggestedActions(summary.sector_weights, stocks, sectorTargets);
          const suggestedHint = formatSuggestedActionsHintText(actions);
          if (suggestedHint) requestData.suggested_actions_hint = suggestedHint;
        }
      } catch (hintErr) {
        console.warn('Could not fetch dashboard hints for assessment, continuing without them', hintErr);
      }

      const response = await assessmentAPI.request(requestData);

      setAssessment(response.data.assessment);
      await fetchRecentAssessments();
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Failed to generate assessment');
    } finally {
      setLoading(false);
    }
  };

  // Custom markdown components (same as before)
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

  const handleOpenAssessment = (assessment: AssessmentResponse) => {
    setSelectedAssessment(assessment);
    setShowAssessmentModal(true);
  };

  const handleCloseAssessmentModal = () => {
    setSelectedAssessment(null);
    setShowAssessmentModal(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Sector rebalance, concentration & tail risk, suggested next actions */}
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

        {/* Request Stock Assessment */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
              <h2 className="text-xl font-bold text-white mb-4">Request Stock Assessment</h2>
              
              <form onSubmit={handleAssessment} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="ticker" className="block text-sm font-medium text-gray-400 mb-2">
                      Stock Ticker *
                    </label>
                    <input
                      type="text"
                      id="ticker"
                      value={ticker}
                      onChange={(e) => setTicker(e.target.value)}
                      placeholder="e.g., AAPL, NVDA, TSLA"
                      className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                      disabled={loading}
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="isin" className="block text-sm font-medium text-gray-400 mb-2">
                      ISIN
                    </label>
                    <input
                      type="text"
                      id="isin"
                      value={isin}
                      onChange={(e) => setIsin(e.target.value.toUpperCase())}
                      placeholder="e.g., US5949181045"
                      maxLength={12}
                      className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                      disabled={loading}
                    />
                    <p className="text-xs text-gray-500 mt-1">Use ISIN for unambiguous stock identification</p>
                  </div>

                  <div>
                    <label htmlFor="companyName" className="block text-sm font-medium text-gray-400 mb-2">
                      Company Name
                    </label>
                    <input
                      type="text"
                      id="companyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g., Apple Inc."
                      className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="currentPrice" className="block text-sm font-medium text-gray-400 mb-2">
                      Current Price
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        id="currentPrice"
                        value={currentPrice}
                        onChange={(e) => setCurrentPrice(e.target.value)}
                        placeholder="e.g., 150.50"
                        step="0.01"
                        min="0"
                        className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                        disabled={loading}
                      />
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="w-24 bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                        disabled={loading}
                      >
                        {currencies.map((curr) => (
                          <option key={curr} value={curr}>{curr}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="source" className="block text-sm font-medium text-gray-400 mb-2">
                      AI Source
                    </label>
                    <select
                      id="source"
                      value={source}
                      onChange={(e) => setSource(e.target.value as 'grok' | 'deepseek' | 'perplexity' | 'chatgpt')}
                      className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                      disabled={loading}
                    >
                      <option value="grok">Grok AI</option>
                      <option value="deepseek">Deepseek</option>
                      <option value="perplexity">Perplexity</option>
                      <option value="chatgpt">ChatGPT</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !ticker.trim()}
                  className="flex items-center px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MagnifyingGlassIcon className="h-5 w-5 mr-2" />
                  {loading ? 'Generating Assessment...' : 'Generate Assessment'}
                </button>
              </form>
            </div>

            {error && (
              <div className="mb-6 bg-red-900 bg-opacity-50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

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

            {/* Assessment Result */}
            {assessment && (
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
                <h2 className="text-xl font-bold text-white mb-4">Assessment Result</h2>
                <div className="prose prose-invert max-w-none">
                  <div className="bg-gray-900 rounded-lg p-6 overflow-auto">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {assessment}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            )}

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

        {/* Loading State */}
        {loading && (
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
              {/* Modal Header */}
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
              
              {/* Modal Content */}
              <div className="overflow-y-auto max-h-[calc(90vh-100px)] p-6">
                <div className="prose prose-invert max-w-none">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
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
