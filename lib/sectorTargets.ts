/**
 * Desired sector exposure (equity portfolio) from core philosophy.
 * Used in Active Positions to show target ranges alongside current allocation.
 * Cash buffer 8–12% is separate (not a sector).
 * See CLAUDE.md "Sector exposure targets and rationale" for full table and rationale.
 */
export const SECTOR_TARGET_PCT: Record<string, { min: number; max: number }> = {
  Technology: { min: 15, max: 15 },
  Insurance: { min: 10, max: 15 },
  Industrials: { min: 10, max: 15 },
  Healthcare: { min: 30, max: 35 },
  Financials: { min: 10, max: 15 },
  'Financial Services': { min: 10, max: 15 },
  Energy: { min: 5, max: 10 },
  Crypto: { min: 2, max: 5 },
  'Consumer Defensive': { min: 10, max: 15 },
  'Consumer Cyclical': { min: 5, max: 10 },
  'Communication Services': { min: 10, max: 15 },
  'Basic Materials': { min: 5, max: 10 },
};

/** Format target range for display, e.g. "30–35%" or "15%" (lookup is case-insensitive) */
export function formatSectorTarget(sectorName: string): string | null {
  const key = Object.keys(SECTOR_TARGET_PCT).find(
    (k) => k.toLowerCase() === (sectorName || '').toLowerCase()
  );
  const target = key ? SECTOR_TARGET_PCT[key] : undefined;
  if (!target) return null;
  if (target.min === target.max) return `target ${target.min}%`;
  return `target ${target.min}–${target.max}%`;
}
