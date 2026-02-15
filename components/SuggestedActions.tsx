'use client';

import Link from 'next/link';
import { Stock, PortfolioMetrics } from '@/lib/api';
import { getSuggestedActions, SuggestedAction } from '@/lib/portfolioInsights';

interface SuggestedActionsProps {
  metrics: PortfolioMetrics;
  stocks: Stock[];
}

function actionLabel(a: SuggestedAction): string {
  switch (a.type) {
    case 'sector_over':
      return `Consider trimming: ${a.sector} (current ${a.currentPct.toFixed(1)}%, target ${a.targetMin}${a.targetMin !== a.targetMax ? `–${a.targetMax}` : ''}%).`;
    case 'sell_zone':
      return `In sell zone: ${a.stock.ticker}`;
    case 'trim_zone':
      return `In trim zone: ${a.stock.ticker}`;
    case 'buy_zone_add':
      return `In buy zone and Add: ${a.stock.ticker}`;
    case 'high_ev_underweight':
      return `High EV, underweight: ${a.stock.ticker}`;
    default:
      return '';
  }
}

function actionHref(a: SuggestedAction): string | null {
  if (a.type === 'sector_over') return null;
  return `/stocks/${a.stock.id}`;
}

export default function SuggestedActions({ metrics, stocks }: SuggestedActionsProps) {
  const actions = getSuggestedActions(metrics.sector_weights, stocks);
  if (actions.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-200 mb-2">
        Suggested next actions
      </h3>
      <p className="text-xs text-gray-500 mb-3">
        Based on current data: over-target sectors, sell/trim zone, buy zone + Add, high EV and underweight. Review and act in the table or stock detail.
      </p>
      <ul className="space-y-2">
        {actions.map((a, i) => {
          const href = actionHref(a);
          const label = actionLabel(a);
          const isSector = a.type === 'sector_over';
          const itemClass = isSector
            ? 'text-amber-200'
            : a.type === 'sell_zone'
              ? 'text-red-200'
              : a.type === 'trim_zone'
                ? 'text-orange-200'
                : a.type === 'buy_zone_add'
                  ? 'text-emerald-200'
                  : 'text-blue-200';
          return (
            <li key={i} className={`text-sm ${itemClass}`}>
              {href ? (
                <Link
                  href={href}
                  className="hover:underline focus:underline focus:outline-none"
                >
                  {label}
                </Link>
              ) : (
                <span>{label}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
