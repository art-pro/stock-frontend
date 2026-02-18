'use client';

import { useState, useEffect, useRef } from 'react';
import { PortfolioMetrics, PortfolioUnits, Stock, cashAPI, exchangeRateAPI } from '@/lib/api';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

interface PortfolioOverviewSectionProps {
  metrics: PortfolioMetrics;
  units?: PortfolioUnits | null;
  /** Active positions (shares_owned > 0) for sector drill-down */
  stocks: Stock[];
}

export default function PortfolioOverviewSection({ metrics, units, stocks }: PortfolioOverviewSectionProps) {
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
        if (!isMountedRef.current) return;
        const usdRate = ratesResponse.data.find((rate) => rate.currency_code === 'USD')?.rate || 0;
        const totalCash = response.data.reduce((total, cash) => {
          if (cash.currency_code === 'EUR') return total + cash.amount;
          if (usdRate <= 0) return total;
          return total + (cash.usd_value / usdRate);
        }, 0);
        setTotalCashValue(totalCash);
      } catch (err) {
        if (isMountedRef.current) setTotalCashValue(0);
        console.warn('Failed to fetch cash holdings:', err);
      }
    };
    fetchCashData();
    return () => { isMountedRef.current = false; };
  }, []);

  const formatCurrency = (num: number) => {
    if (num === 0 || num === null || num === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: units?.summary_total_value === 'USD' ? 'USD' : 'EUR',
    }).format(num);
  };

  const formatPercent = (num: number, decimals: number = 2) => {
    if (num === 0 || num === null || num === undefined) return 'N/A';
    return `${num?.toFixed(decimals) || 'N/A'}%`;
  };

  const totalPortfolioValue = metrics.total_value + totalCashValue;
  const cashFraction = totalPortfolioValue > 0 ? totalCashValue / totalPortfolioValue : 0;

  const SECTOR_BASE_RGB: Record<string, [number, number, number]> = {
    Healthcare: [16, 185, 129],
    Technology: [59, 130, 246],
    'Financial Services': [245, 158, 11],
    Financials: [245, 158, 11],
    Industrials: [20, 184, 166],
    Energy: [239, 68, 68],
    'Consumer Defensive': [34, 197, 94],
    'Consumer Cyclical': [236, 72, 153],
    'Communication Services': [139, 92, 246],
    'Basic Materials': [107, 114, 128],
    Insurance: [6, 182, 212],
    Crypto: [251, 191, 36],
  };
  const fallbackRGB: [number, number, number][] = [[59, 130, 246], [16, 185, 129], [245, 158, 11], [239, 68, 68], [139, 92, 246]];
  const getSectorRGB = (sector: string): [number, number, number] => {
    const key = Object.keys(SECTOR_BASE_RGB).find((k) => k.toLowerCase() === sector.trim().toLowerCase());
    if (key) return SECTOR_BASE_RGB[key];
    const hash = sector.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return fallbackRGB[hash % fallbackRGB.length];
  };
  const rgbToRgba = (r: number, g: number, b: number, a: number) => `rgba(${r},${g},${b},${a})`;
  const getShades = (r: number, g: number, b: number, count: number): string[] => {
    if (count <= 0) return [];
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      const t = (i + 1) / (count + 1);
      const a = 0.5 + 0.5 * t;
      out.push(rgbToRgba(r, g, b, a));
    }
    return out;
  };

  const weightToFraction = (w: number) => (w <= 1 && w > 0 ? w : w / 100);
  const sortedStocks = [...stocks]
    .filter((s) => s.shares_owned > 0 && weightToFraction(s.weight) > 0)
    .sort((a, b) => {
      const sa = (a.sector || '').toLowerCase();
      const sb = (b.sector || '').toLowerCase();
      if (sa !== sb) return sa.localeCompare(sb);
      return weightToFraction(b.weight) - weightToFraction(a.weight);
    });

  const chartLabels: string[] = [];
  const chartValues: number[] = [];
  const sectorByIndex: (string | null)[] = [];
  const chartBackgroundColors: string[] = [];

  sortedStocks.forEach((stock) => {
    const sector = stock.sector?.trim() || 'Other';
    const fraction = totalPortfolioValue > 0
      ? (weightToFraction(stock.weight) * metrics.total_value) / totalPortfolioValue
      : 0;
    chartLabels.push(stock.ticker);
    chartValues.push(fraction);
    sectorByIndex.push(sector);
    const [r, g, b] = getSectorRGB(sector);
    const sectorStocks = sortedStocks.filter((s) => (s.sector || '').trim().toLowerCase() === sector.toLowerCase());
    const shades = getShades(r, g, b, sectorStocks.length);
    const shadeIndex = sectorStocks.findIndex((s) => s.id === stock.id);
    chartBackgroundColors.push(shades[shadeIndex] ?? rgbToRgba(r, g, b, 0.8));
  });
  if (cashFraction > 0) {
    chartLabels.push('Cash');
    chartValues.push(cashFraction);
    sectorByIndex.push('Cash');
    chartBackgroundColors.push('rgba(107, 114, 128, 0.8)');
  }

  const highlight = (sector: string | null) => sector != null;
  const chartBorderWidths = sectorByIndex.map((s) => (highlight(selectedSector) && s === selectedSector ? 4 : 2));
  const chartHighlightColors = sectorByIndex.map((s, i) => {
    if (!selectedSector || s !== selectedSector) return chartBackgroundColors[i];
    const c = chartBackgroundColors[i];
    const match = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) return `rgba(${match[1]},${match[2]},${match[3]},1)`;
    return c;
  });
  const finalColors = selectedSector ? chartHighlightColors : chartBackgroundColors;

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        data: chartValues,
        backgroundColor: finalColors,
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
      const sector = sectorByIndex[index] ?? null;
      setSelectedSector((prev) => (prev === sector ? null : sector));
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { color: 'rgb(209, 213, 219)', padding: 8, boxWidth: 12, font: { size: 11 } },
      },
      tooltip: {
        callbacks: {
          label: function(context: { label: string; parsed: number; dataIndex: number }) {
            const pct = (context.parsed * 100).toFixed(1);
            const sector = sectorByIndex[context.dataIndex];
            if (sector && sector !== 'Cash') return `${context.label} (${sector}): ${pct}%`;
            return `${context.label}: ${pct}%`;
          },
        },
      },
    },
    maintainAspectRatio: false,
  };

  const weightToPct = (w: number) => (w <= 1 && w > 0 ? w * 100 : w);
  const stocksInSector = selectedSector && selectedSector !== 'Cash'
    ? stocks.filter((s) => s.sector && s.sector.trim().toLowerCase() === selectedSector.trim().toLowerCase())
    : [];

  const MILESTONES_EUR = [25_000, 50_000, 100_000];
  const maxMilestone = 100_000;
  const fillPercent = Math.min(100, (totalPortfolioValue / maxMilestone) * 100);
  const formatMilestone = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 }).replace(/,/g, ' ');

  return (
    <>
      <div className="mb-6 bg-gray-800 rounded-lg p-5 border border-gray-700">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Portfolio milestones</h3>
        <p className="text-xs text-gray-500 mb-3">
          Total value: <span className="text-white font-semibold">{formatCurrency(totalPortfolioValue)}</span>
        </p>
        <div className="relative h-8 bg-gray-700 rounded-lg overflow-visible">
          <div
            className="absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r from-primary-600 to-primary-500 transition-all duration-500"
            style={{ width: `${fillPercent}%` }}
          />
          {MILESTONES_EUR.map((milestone) => {
            const posPercent = (milestone / maxMilestone) * 100;
            return (
              <div
                key={milestone}
                className="absolute top-0 bottom-0 w-0.5 bg-gray-500 -translate-x-px z-10"
                style={{ left: `${posPercent}%` }}
                title={`${formatMilestone(milestone)} Euro`}
              >
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-medium whitespace-nowrap text-gray-400">
                  {formatMilestone(milestone)} €
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-6 text-xs text-gray-500">
          <span>0 €</span>
          <span>{formatMilestone(maxMilestone)} €</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
                <p className="text-gray-400 text-sm">Cash is not broken down by holding here. Use Cash Management for details.</p>
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
    </>
  );
}
