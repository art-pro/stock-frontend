/**
 * Desired sector exposure (equity portfolio) — revised targets and rationale.
 * Cash buffer 8–12% is separate (not a sector).
 * Used in Active Positions, rebalance hints, Settings sector targets table.
 */

export const SECTOR_TARGET_PCT: Record<string, { min: number; max: number }> = {
  Healthcare: { min: 25, max: 30 },
  Technology: { min: 15, max: 18 },
  Insurance: { min: 10, max: 12 },
  Industrials: { min: 12, max: 15 },
  Financials: { min: 12, max: 15 },
  'Financial Services': { min: 12, max: 15 }, // merged into Financials; same range for display
  'Consumer Defensive': { min: 10, max: 15 },
  'Communication Services': { min: 12, max: 15 },
  Energy: { min: 5, max: 8 },
  'Consumer Cyclical': { min: 5, max: 10 },
  'Basic Materials': { min: 7, max: 10 },
  Crypto: { min: 2, max: 5 },
};

/** Cash (separate from sectors): dry powder for opportunities */
export const CASH_TARGET_PCT = { min: 8, max: 12 };

export type SectorTargetTableRow = {
  sector: string;
  min: number;
  max: number;
  rationale: string;
};

/** Order and rationale for Settings table and display */
export const SECTOR_TARGET_TABLE: SectorTargetTableRow[] = [
  { sector: 'Healthcare', min: 25, max: 30, rationale: 'Trim from original to reduce concentration; resilient EV +8–10% but regulatory risks.' },
  { sector: 'Technology', min: 15, max: 18, rationale: 'Modest raise for AI infrastructure ($650B spend); cap volatility (EV +15–20%).' },
  { sector: 'Insurance', min: 10, max: 12, rationale: 'Under Financials; stable yield but financials weak (EV +5–7%).' },
  { sector: 'Industrials', min: 12, max: 15, rationale: 'Increase for defense/geopolitical ($1.5T budget); EV +7–10%.' },
  { sector: 'Financials', min: 12, max: 15, rationale: 'Merged with Financial Services; undervalued dispersion opportunities (EV +6–9%).' },
  { sector: 'Consumer Defensive', min: 10, max: 15, rationale: 'Unchanged; steady in value rotation (EV +4–6%).' },
  { sector: 'Communication Services', min: 12, max: 15, rationale: 'Increase for Outperform/ad stability (EV +7–9%).' },
  { sector: 'Energy', min: 5, max: 8, rationale: 'Lower for surplus/oil decline ($58/b outlook); EV +4–6%.' },
  { sector: 'Consumer Cyclical', min: 5, max: 10, rationale: 'Unchanged; moderate growth (EV +8–10%).' },
  { sector: 'Basic Materials', min: 7, max: 10, rationale: 'Increase for EM/mining boost in rotation (EV +3–5%).' },
  { sector: 'Crypto', min: 2, max: 5, rationale: 'Unchanged; asymmetric but high vol cap.' },
];

export const CASH_TARGET_ROW = {
  sector: 'Cash',
  min: CASH_TARGET_PCT.min,
  max: CASH_TARGET_PCT.max,
  rationale: 'Dry powder for opportunities (separate from equity sectors).',
};

/** Format target range for display (lookup is case-insensitive). Use custom targets when provided (e.g. from persisted settings). */
export function formatSectorTarget(
  sectorName: string,
  customTargets?: Record<string, { min: number; max: number }>
): string | null {
  if (!sectorName || sectorName.trim() === '') return null;
  const source = customTargets ?? SECTOR_TARGET_PCT;
  const key = Object.keys(source).find(
    (k) => k.toLowerCase() === sectorName.trim().toLowerCase()
  );
  const target = key ? source[key] : undefined;
  if (!target) return null;
  if (target.min === target.max) return `target ${target.min}%`;
  return `target ${target.min}–${target.max}%`;
}
