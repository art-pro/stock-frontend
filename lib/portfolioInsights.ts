/**
 * Portfolio insights for Phase 1: rebalance hints, concentration, distance to zones.
 * Display-only; no backend changes. Uses existing sector_weights and sectorTargets.
 */
import { Stock } from '@/lib/api';
import { SECTOR_TARGET_PCT } from '@/lib/sectorTargets';

export type SectorDeviation = {
  sector: string;
  currentPct: number;
  targetMin: number;
  targetMax: number;
};

export type RebalanceSummary = {
  over: SectorDeviation[];
  at: SectorDeviation[];
  under: SectorDeviation[];
  noTarget: { sector: string; currentPct: number }[];
};

/** Normalize sector weight to percentage (backend may send 0-1 or 0-100). */
function toPct(weight: number): number {
  if (weight > 0 && weight <= 1) return weight * 100;
  return weight;
}

type TargetMap = Record<string, { min: number; max: number }>;

/** Get target min/max for sector (case-insensitive). */
function getTarget(sectorName: string, targets: TargetMap): { min: number; max: number } | null {
  const key = Object.keys(targets).find(
    (k) => k.toLowerCase() === (sectorName || '').toLowerCase()
  );
  return key ? targets[key] : null;
}

/**
 * Classify sectors vs targets. Uses equity-only sector_weights (0-1 or 0-100).
 * Pass optional targets (e.g. from persisted settings); otherwise uses default SECTOR_TARGET_PCT.
 */
export function getSectorRebalanceSummary(
  sectorWeights: Record<string, number>,
  customTargets?: TargetMap
): RebalanceSummary {
  const targets = customTargets ?? SECTOR_TARGET_PCT;
  const over: SectorDeviation[] = [];
  const at: SectorDeviation[] = [];
  const under: SectorDeviation[] = [];
  const noTarget: { sector: string; currentPct: number }[] = [];

  for (const [sector, weight] of Object.entries(sectorWeights)) {
    const currentPct = toPct(weight);
    const target = getTarget(sector, targets);
    if (!target) {
      noTarget.push({ sector, currentPct });
      continue;
    }
    const dev: SectorDeviation = {
      sector,
      currentPct,
      targetMin: target.min,
      targetMax: target.max,
    };
    if (currentPct > target.max) over.push(dev);
    else if (currentPct >= target.min) at.push(dev);
    else under.push(dev);
  }

  return { over, at, under, noTarget };
}

export type ConcentrationSummary = {
  top1Pct: number;
  top3Pct: number;
  top5Pct: number;
  maxPositionPct: number;
  maxPositionTicker: string;
};

/**
 * Concentration from equity positions (stocks with shares_owned > 0).
 * Weights are 0-1 fractions; we report percentages.
 */
export function getConcentration(stocks: Stock[]): ConcentrationSummary {
  const withShares = stocks
    .filter((s) => s.shares_owned > 0 && s.weight != null)
    .map((s) => ({ ticker: s.ticker, weight: s.weight! }))
    .sort((a, b) => b.weight - a.weight);

  const totalWeight = withShares.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight <= 0) {
    return {
      top1Pct: 0,
      top3Pct: 0,
      top5Pct: 0,
      maxPositionPct: 0,
      maxPositionTicker: '—',
    };
  }

  const w1 = withShares[0]?.weight ?? 0;
  const w3 = withShares.slice(0, 3).reduce((s, x) => s + x.weight, 0);
  const w5 = withShares.slice(0, 5).reduce((s, x) => s + x.weight, 0);
  const pct = (w: number) => (w / totalWeight) * 100;

  return {
    top1Pct: pct(w1),
    top3Pct: pct(w3),
    top5Pct: pct(w5),
    maxPositionPct: pct(w1),
    maxPositionTicker: withShares[0]?.ticker ?? '—',
  };
}

/**
 * Distance to buy zone: text for tooltip/display.
 * Compares current_price to buy_zone_min / buy_zone_max.
 */
export function getDistanceToBuyZone(stock: Stock): string {
  const p = stock.current_price;
  const min = stock.buy_zone_min;
  const max = stock.buy_zone_max;
  if (p <= 0 || max <= 0) return 'N/A';
  if (min > 0 && p >= min && p <= max) return 'Within buy zone';
  if (p > max) {
    const pctAbove = ((p - max) / max) * 100;
    return `${pctAbove.toFixed(1)}% above Buy Zone Max`;
  }
  if (min > 0 && p < min) {
    const pctBelow = ((min - p) / min) * 100;
    return `${pctBelow.toFixed(1)}% below Buy Zone Min`;
  }
  return 'N/A';
}

/**
 * Distance to sell zone: text for tooltip/display.
 * Uses sell_zone_status when available; else compares price to bounds.
 */
export function getDistanceToSellZone(stock: Stock): string {
  const status = stock.sell_zone_status;
  if (status) return status;
  const p = stock.current_price;
  const lower = stock.sell_zone_lower_bound;
  const upper = stock.sell_zone_upper_bound;
  if (p <= 0) return 'N/A';
  if (lower != null && upper != null && lower > 0) {
    if (p >= upper) return 'In sell zone';
    if (p >= lower) return 'In trim zone';
    return 'Below sell zone';
  }
  return 'N/A';
}

/** Kelly hint: position size vs half-Kelly suggested (ratio). Display e.g. "0.9× ½-Kelly". */
export function getKellyHint(stock: Stock): string | null {
  const weight = stock.weight;
  const halfKelly = stock.half_kelly_suggested;
  if (weight == null || weight <= 0 || halfKelly == null || halfKelly <= 0)
    return null;
  const suggestedFraction = halfKelly / 100;
  const ratio = suggestedFraction > 0 ? weight / suggestedFraction : null;
  if (ratio == null || !Number.isFinite(ratio)) return null;
  return `${ratio.toFixed(2)}× ½-Kelly`;
}

export type SuggestedAction =
  | { type: 'sector_over'; sector: string; currentPct: number; targetMin: number; targetMax: number }
  | { type: 'sell_zone'; stock: Stock }
  | { type: 'trim_zone'; stock: Stock }
  | { type: 'buy_zone_add'; stock: Stock }
  | { type: 'high_ev_underweight'; stock: Stock };

/**
 * Suggested next actions from current data (read-only). No backend changes.
 * Rules: sectors over target; stocks in sell/trim zone; stocks Add + in buy zone; optional high EV + underweight.
 */
export function getSuggestedActions(
  sectorWeights: Record<string, number>,
  stocks: Stock[],
  customTargets?: TargetMap
): SuggestedAction[] {
  const actions: SuggestedAction[] = [];
  const rebalance = getSectorRebalanceSummary(sectorWeights, customTargets);
  for (const d of rebalance.over) {
    actions.push({
      type: 'sector_over',
      sector: d.sector,
      currentPct: d.currentPct,
      targetMin: d.targetMin,
      targetMax: d.targetMax,
    });
  }
  const activeStocks = stocks.filter((s) => s.shares_owned > 0);
  for (const stock of activeStocks) {
    const sellStatus = (stock.sell_zone_status || '').trim();
    if (sellStatus === 'In sell zone') {
      actions.push({ type: 'sell_zone', stock });
      continue;
    }
    if (sellStatus === 'In trim zone') {
      actions.push({ type: 'trim_zone', stock });
      continue;
    }
    const assessment = (stock.assessment || '').trim();
    const buyStatus = (stock.buy_zone_status || '').trim();
    const inBuyZone = buyStatus === 'within buy zone' || buyStatus === 'EV >> 15%';
    if (assessment === 'Add' && inBuyZone) {
      actions.push({ type: 'buy_zone_add', stock });
      continue;
    }
    const ev = stock.expected_value;
    const weightPct = stock.weight != null ? (stock.weight <= 1 ? stock.weight * 100 : stock.weight) : 0;
    const halfKelly = stock.half_kelly_suggested ?? 0;
    if (ev != null && ev > 15 && halfKelly > 0 && weightPct < halfKelly) {
      actions.push({ type: 'high_ev_underweight', stock });
    }
  }
  return actions;
}
