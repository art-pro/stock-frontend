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
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

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
          <h1 className="text-2xl font-bold text-white">
            {stock.ticker} - {stock.company_name}
          </h1>
          <p className="text-sm text-gray-400 mt-1">{stock.sector}</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Current Price</h3>
            <p className="text-2xl font-bold text-white">
              {stock.current_price.toFixed(2)} {stock.currency}
            </p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Fair Value</h3>
            <p className="text-2xl font-bold text-white">
              {stock.fair_value.toFixed(2)} {stock.currency}
            </p>
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
          </div>
        </div>

        {/* Detailed Metrics */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Detailed Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-400">Upside Potential</p>
              <p className="text-lg font-semibold text-green-400">
                {stock.upside_potential.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Downside Risk</p>
              <p className="text-lg font-semibold text-red-400">
                {stock.downside_risk.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Probability Positive (p)</p>
              <p className="text-lg font-semibold text-white">
                {stock.probability_positive.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Beta</p>
              <p className="text-lg font-semibold text-white">
                {stock.beta.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Volatility (σ)</p>
              <p className="text-lg font-semibold text-white">
                {stock.volatility.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">P/E Ratio</p>
              <p className="text-lg font-semibold text-white">
                {stock.pe_ratio.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">EPS Growth Rate</p>
              <p className="text-lg font-semibold text-white">
                {stock.eps_growth_rate.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Debt to EBITDA</p>
              <p className="text-lg font-semibold text-white">
                {stock.debt_to_ebitda.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Dividend Yield</p>
              <p className="text-lg font-semibold text-white">
                {stock.dividend_yield.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">b Ratio</p>
              <p className="text-lg font-semibold text-white">
                {stock.b_ratio.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Kelly f*</p>
              <p className="text-lg font-semibold text-white">
                {stock.kelly_fraction.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">½-Kelly Suggested</p>
              <p className="text-lg font-semibold text-primary-400">
                {stock.half_kelly_suggested.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>

        {/* Position Info */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Position Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-400">Shares Owned</p>
              <p className="text-lg font-semibold text-white">
                {stock.shares_owned}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Average Entry Price</p>
              <p className="text-lg font-semibold text-white">
                {stock.avg_price_local.toFixed(2)} {stock.currency}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Current Value (USD)</p>
              <p className="text-lg font-semibold text-white">
                ${stock.current_value_usd.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Portfolio Weight</p>
              <p className="text-lg font-semibold text-white">
                {stock.weight.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Unrealized P&L</p>
              <p className={`text-lg font-semibold ${
                stock.unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                ${stock.unrealized_pnl.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Buy Zone (Min)</p>
              <p className="text-lg font-semibold text-white">
                {stock.buy_zone_min.toFixed(2)} {stock.currency}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Buy Zone (Max)</p>
              <p className="text-lg font-semibold text-white">
                {stock.buy_zone_max.toFixed(2)} {stock.currency}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Last Updated</p>
              <p className="text-lg font-semibold text-white">
                {new Date(stock.last_updated).toLocaleDateString()}
              </p>
            </div>
          </div>
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

