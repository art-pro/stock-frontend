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

/** Format target range for display, e.g. "30–35%" or "15%" */
export function formatSectorTarget(sectorName: string): string | null {
  const target = SECTOR_TARGET_PCT[sectorName];
  if (!target) return null;
  if (target.min === target.max) return `Target ${target.min}%`;
  return `Target ${target.min}–${target.max}%`;
}
