'use client';

import { PortfolioMetrics } from '@/lib/api';
import { getSectorRebalanceSummary } from '@/lib/portfolioInsights';
import type { SectorTargetPct } from '@/hooks/useSectorTargets';

interface RebalanceHintProps {
  metrics: PortfolioMetrics;
  sectorTargets?: SectorTargetPct;
}

export default function RebalanceHint({ metrics, sectorTargets }: RebalanceHintProps) {
  const summary = getSectorRebalanceSummary(metrics.sector_weights, sectorTargets);
  const { over, at, under, noTarget } = summary;
  const total = over.length + at.length + under.length;
  if (total === 0 && noTarget.length === 0) return null;

  return (
    <div className="mb-6 bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-200 mb-2">
        Sector rebalance hint
      </h3>
      <p className="text-xs text-gray-400 mb-3">
        Equity allocation vs target ranges. Consider trimming over-weight sectors and adding to under-weight.
      </p>
      <div className="flex flex-wrap gap-4 text-sm">
        {over.length > 0 && (
          <div>
            <span className="text-amber-400 font-medium">{over.length} over target</span>
            <ul className="mt-1 text-gray-300 list-disc list-inside">
              {over.slice(0, 5).map((d) => (
                <li key={d.sector}>
                  {d.sector}: {d.currentPct.toFixed(1)}% (target {d.targetMin}–{d.targetMax}%)
                </li>
              ))}
              {over.length > 5 && <li className="text-gray-500">+{over.length - 5} more</li>}
            </ul>
          </div>
        )}
        {under.length > 0 && (
          <div>
            <span className="text-emerald-400 font-medium">{under.length} under target</span>
            <ul className="mt-1 text-gray-300 list-disc list-inside">
              {under.slice(0, 5).map((d) => (
                <li key={d.sector}>
                  {d.sector}: {d.currentPct.toFixed(1)}% (target {d.targetMin}–{d.targetMax}%)
                </li>
              ))}
              {under.length > 5 && <li className="text-gray-500">+{under.length - 5} more</li>}
            </ul>
          </div>
        )}
        {at.length > 0 && (
          <div>
            <span className="text-gray-400 font-medium">{at.length} at target</span>
            <span className="text-gray-500 ml-1">
              {at.map((d) => d.sector).join(', ')}
            </span>
          </div>
        )}
        {noTarget.length > 0 && (
          <div>
            <span className="text-gray-500 font-medium">{noTarget.length} no target</span>
            <span className="text-gray-500 ml-1">
              {noTarget.map((d) => `${d.sector} (${d.currentPct.toFixed(1)}%)`).join(', ')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
