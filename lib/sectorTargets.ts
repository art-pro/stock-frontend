/**
 * Desired sector exposure (equity portfolio) from core philosophy.
 * Used in Active Positions to show target ranges alongside current allocation.
 * Cash buffer 8–12% is separate (not a sector).
 */
export const SECTOR_TARGET_PCT: Record<string, { min: number; max: number }> = {
  Healthcare: { min: 30, max: 35 },
  Technology: { min: 15, max: 15 },
  'Communication Services': { min: 10, max: 15 },
  Financials: { min: 10, max: 15 },
  Industrials: { min: 10, max: 15 },
  Energy: { min: 5, max: 10 },
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
