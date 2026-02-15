'use client';

import { useState, useEffect, useRef } from 'react';
import { PortfolioMetrics, PortfolioUnits, Stock, cashAPI, exchangeRateAPI } from '@/lib/api';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

interface PortfolioSummaryProps {
  metrics: PortfolioMetrics;
  units?: PortfolioUnits | null;
  /** Active positions (shares_owned > 0) for sector drill-down: show stocks and % when a sector is selected */
  stocks?: Stock[];
}

export default function PortfolioSummary({ metrics, units, stocks = [] }: PortfolioSummaryProps) {
  const [totalCashValue, setTotalCashValue] = useState(0);
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const fetchCashData = async () => {
      try {
        const [response, ratesResponse] = await Promise.all([
          cashAPI.getAll(),
          exchangeRateAPI.getAll(),
        ]);

        // Check if component is still mounted before updating state
        if (!isMountedRef.current) return;

        const usdRate = ratesResponse.data.find((rate) => rate.currency_code === 'USD')?.rate || 0;
        const totalCash = response.data.reduce((total, cash) => {
          if (cash.currency_code === 'EUR') {
            return total + cash.amount;
          }
          // usd_value is in USD; convert to EUR using EUR->USD rate.
          if (usdRate <= 0) {
            return total;
          }
          return total + (cash.usd_value / usdRate);
        }, 0);
        setTotalCashValue(totalCash);
      } catch (err) {
        // If cash API fails, set to 0 (cash management might not be enabled)
        if (isMountedRef.current) {
          setTotalCashValue(0);
        }
        console.warn('Failed to fetch cash holdings:', err);
      }
    };

    fetchCashData();

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  const formatCurrency = (num: number) => {
    if (num === 0 || num === null || num === undefined) {
      return 'N/A';
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: units?.summary_total_value === 'USD' ? 'USD' : 'EUR',
    }).format(num);
  };

  const formatPercent = (num: number, decimals: number = 2) => {
    if (num === 0 || num === null || num === undefined) {
      return 'N/A';
    }
    return `${num?.toFixed(decimals) || 'N/A'}%`;
  };

  // Prepare chart data including cash. Use fractions (0–1) for all segments so the pie proportions are correct.
  const totalPortfolioValue = metrics.total_value + totalCashValue;
  const cashFraction = totalPortfolioValue > 0 ? totalCashValue / totalPortfolioValue : 0;

  // Sector weights from backend are 0–1 (fraction of equity). Scale to fraction of (stocks + cash).
  const adjustedSectorWeights = Object.fromEntries(
    Object.entries(metrics.sector_weights).map(([sector, weight]) => [
      sector,
      totalPortfolioValue > 0 ? (weight * metrics.total_value) / totalPortfolioValue : weight,
    ])
  );

  const chartLabels = [...Object.keys(adjustedSectorWeights)];
  const chartValues = [...Object.values(adjustedSectorWeights)] as number[];

  if (cashFraction > 0) {
    chartLabels.push('Cash');
    chartValues.push(cashFraction);
  }

  const baseColors = [
    'rgba(59, 130, 246, 0.8)',   // blue
    'rgba(16, 185, 129, 0.8)',   // green
    'rgba(245, 158, 11, 0.8)',   // amber
    'rgba(239, 68, 68, 0.8)',    // red
    'rgba(139, 92, 246, 0.8)',   // purple
    'rgba(236, 72, 153, 0.8)',   // pink
    'rgba(20, 184, 166, 0.8)',   // teal
    'rgba(107, 114, 128, 0.8)',  // gray for cash
  ];
  const highlightColors = [
    'rgba(59, 130, 246, 1)',
    'rgba(16, 185, 129, 1)',
    'rgba(245, 158, 11, 1)',
    'rgba(239, 68, 68, 1)',
    'rgba(139, 92, 246, 1)',
    'rgba(236, 72, 153, 1)',
    'rgba(20, 184, 166, 1)',
    'rgba(107, 114, 128, 1)',
  ];
  const chartBackgroundColors = chartLabels.map((label, i) =>
    label === selectedSector ? highlightColors[i % highlightColors.length] : baseColors[i % baseColors.length]
  );
  const chartBorderWidths = chartLabels.map((label) => (label === selectedSector ? 4 : 2));

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        data: chartValues,
        backgroundColor: chartBackgroundColors,
        borderColor: 'rgba(31, 41, 55, 1)',
        borderWidth: chartBorderWidths,
        hoverBorderWidth: 3,
      },
    ],
  };

  const chartOptions = {
    onClick: (event: unknown, elements: { index: number }[]) => {
      if (elements.length === 0) return;
      const index = elements[0].index;
      const label = chartLabels[index];
      setSelectedSector((prev) => (prev === label ? null : label));
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: 'rgb(209, 213, 219)',
          padding: 15,
        },
      },
      tooltip: {
        callbacks: {
          label: function(context: { label: string; parsed: number }) {
            const pct = (context.parsed * 100).toFixed(1);
            return `${context.label}: ${pct}%`;
          }
        }
      }
    },
    maintainAspectRatio: false,
  };

  // Weight as percentage: backend may send 0–1 or 0–100
  const weightToPct = (w: number) => (w <= 1 && w > 0 ? w * 100 : w);
  const stocksInSector = selectedSector && selectedSector !== 'Cash'
    ? stocks.filter((s) => s.sector && s.sector.trim().toLowerCase() === selectedSector.trim().toLowerCase())
    : [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* Total Portfolio Value */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-sm font-medium text-gray-400 mb-2">
          Total Portfolio Value {totalCashValue > 0 ? '(Stocks + Cash)' : ''}
        </h3>
        <p className="text-2xl font-bold text-white">
          {formatCurrency(metrics.total_value + totalCashValue)}
        </p>
        {totalCashValue > 0 && (
          <p className="text-xs text-gray-400 mt-1">
            Stocks: {formatCurrency(metrics.total_value)} + Cash: {formatCurrency(totalCashValue)}
          </p>
        )}
      </div>

      {/* Overall EV */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-sm font-medium text-gray-400 mb-2 tooltip">
          Overall Expected Value
          <span className="tooltiptext">Weighted average EV across all positions</span>
        </h3>
        <p className={`text-2xl font-bold ${
          metrics.overall_ev > 7 ? 'text-green-400' : 
          metrics.overall_ev > 0 ? 'text-yellow-400' : 
          'text-red-400'
        }`}>
          {formatPercent(metrics.overall_ev, 1)}
        </p>
      </div>

      {/* Sharpe Ratio */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-sm font-medium text-gray-400 mb-2 tooltip">
          Sharpe Ratio
          <span className="tooltiptext">Risk-adjusted return: (Portfolio Return - Risk-free Rate) / Volatility</span>
        </h3>
        <p className="text-2xl font-bold text-white">
          {metrics.sharpe_ratio.toFixed(2)}
        </p>
      </div>

      {/* Volatility */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-sm font-medium text-gray-400 mb-2 tooltip">
          Portfolio Volatility
          <span className="tooltiptext">Weighted average volatility (target: 11-13%)</span>
        </h3>
        <p className={`text-2xl font-bold ${
          metrics.weighted_volatility > 13 ? 'text-red-400' : 
          metrics.weighted_volatility < 11 ? 'text-yellow-400' : 
          'text-green-400'
        }`}>
          {formatPercent(metrics.weighted_volatility, 1)}
        </p>
      </div>

      {/* Kelly Utilization */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-sm font-medium text-gray-400 mb-2 tooltip">
          Kelly Utilization
          <span className="tooltiptext">Sum of position weights vs. suggested allocations. Target band: 75–85%.</span>
        </h3>
        <p className="text-2xl font-bold text-white">
          {formatPercent(metrics.kelly_utilization, 1)}
        </p>
        <p className="text-xs text-gray-500 mt-1">Target 75–85%</p>
      </div>

      {/* Sector Allocation Chart */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 col-span-1 md:col-span-2 lg:col-span-3">
        <h3 className="text-sm font-medium text-gray-400 mb-4">
          Sector Allocation {selectedSector && <span className="text-primary-400">— click a sector to see stocks</span>}
        </h3>
        <div className="h-64">
          <Pie data={chartData} options={chartOptions} />
        </div>
        {selectedSector && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            {selectedSector === 'Cash' ? (
              <p className="text-gray-400 text-sm">Cash is not broken down by holding here. Use Cash Management below for details.</p>
            ) : stocksInSector.length > 0 ? (
              <>
                <p className="text-gray-400 text-sm font-medium mb-2">
                  {selectedSector} — {stocksInSector.length} position{stocksInSector.length !== 1 ? 's' : ''}
                </p>
                <ul className="space-y-1 text-sm">
                  {stocksInSector
                    .slice()
                    .sort((a, b) => weightToPct(b.weight) - weightToPct(a.weight))
                    .map((s) => (
                      <li key={s.id} className="flex justify-between text-gray-300">
                        <span>{s.ticker}</span>
                        <span>{weightToPct(s.weight).toFixed(1)}%</span>
                      </li>
                    ))}
                </ul>
              </>
            ) : (
              <p className="text-gray-400 text-sm">
                No positions in {selectedSector}. {stocks.length === 0 ? 'Stock list not available.' : ''}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

