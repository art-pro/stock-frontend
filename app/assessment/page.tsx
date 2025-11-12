'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { stockAPI, assessmentAPI } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  MagnifyingGlassIcon,
  ChartBarIcon,
  ArrowLeftIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface AssessmentRequest {
  ticker: string;
  source: 'grok' | 'deepseek';
}

interface AssessmentResponse {
  ticker: string;
  source: string;
  assessment: string;
  created_at: string;
  status: 'pending' | 'completed' | 'failed';
}

export default function AssessmentPage() {
  const router = useRouter();
  const [ticker, setTicker] = useState('');
  const [source, setSource] = useState<'grok' | 'deepseek'>('grok');
  const [loading, setLoading] = useState(false);
  const [assessment, setAssessment] = useState<string>('');
  const [error, setError] = useState('');
  const [recentAssessments, setRecentAssessments] = useState<AssessmentResponse[]>([]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    fetchRecentAssessments();
  }, [router]);

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
      const response = await assessmentAPI.request({
        ticker: ticker.toUpperCase().trim(),
        source,
      });

      setAssessment(response.data.assessment);
      await fetchRecentAssessments();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate assessment');
    } finally {
      setLoading(false);
    }
  };

  // Custom markdown components for proper styling
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

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/dashboard')}
                className="mr-4 p-2 text-gray-400 hover:text-white transition-colors"
                title="Back to Dashboard"
              >
                <ArrowLeftIcon className="h-6 w-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">Stock Assessment</h1>
                <p className="text-sm text-gray-400 mt-1">
                  Probabilistic Analysis using Kelly Criterion Strategy
                </p>
              </div>
            </div>
            <ChartBarIcon className="h-8 w-8 text-primary-500" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Assessment Form */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Request Stock Assessment</h2>
          
          <form onSubmit={handleAssessment} className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label htmlFor="ticker" className="block text-sm font-medium text-gray-400 mb-2">
                  Stock Ticker
                </label>
                <input
                  type="text"
                  id="ticker"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  placeholder="e.g., AAPL, NVDA, TSLA"
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  disabled={loading}
                />
              </div>
              
              <div className="w-48">
                <label htmlFor="source" className="block text-sm font-medium text-gray-400 mb-2">
                  AI Source
                </label>
                <select
                  id="source"
                  value={source}
                  onChange={(e) => setSource(e.target.value as 'grok' | 'deepseek')}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  disabled={loading}
                >
                  <option value="grok">Grok AI</option>
                  <option value="deepseek">Deepseek</option>
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
                <div key={index} className="flex items-center justify-between bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(item.status)}
                    <div>
                      <span className="text-white font-medium">{item.ticker}</span>
                      <span className="text-gray-400 ml-2">via {item.source}</span>
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
                  <p className="text-white font-medium">Generating Assessment</p>
                  <p className="text-gray-400 text-sm">This may take 30-60 seconds...</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}