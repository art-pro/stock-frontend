'use client';

import { Stock } from '@/lib/api';
import { getConcentration } from '@/lib/portfolioInsights';

interface RiskCardProps {
  stocks: Stock[];
}

export default function RiskCard({ stocks }: RiskCardProps) {
  const active = stocks.filter((s) => s.shares_owned > 0);
  const conc = getConcentration(active);
  if (active.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h3 className="text-sm font-medium text-gray-400 mb-2">
        Concentration & tail risk
      </h3>
      <p className="text-xs text-gray-500 mb-3">
        Top positions as % of equity (no cash). High concentration increases tail risk.
      </p>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500 block">Largest position</span>
          <span className="text-white font-semibold">{conc.maxPositionTicker}</span>
          <span className="text-gray-400 ml-1">{conc.maxPositionPct.toFixed(1)}%</span>
        </div>
        <div>
          <span className="text-gray-500 block">Top 3</span>
          <span className="text-white font-semibold">{conc.top3Pct.toFixed(1)}%</span>
        </div>
        <div>
          <span className="text-gray-500 block">Top 5</span>
          <span className="text-white font-semibold">{conc.top5Pct.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}
