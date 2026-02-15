import {
  formatSectorTarget,
  SECTOR_TARGET_PCT,
  CASH_TARGET_PCT,
  SECTOR_TARGET_TABLE,
  CASH_TARGET_ROW,
} from './sectorTargets';

describe('sectorTargets', () => {
  describe('formatSectorTarget', () => {
    it('returns null for empty or whitespace sector', () => {
      expect(formatSectorTarget('')).toBeNull();
      expect(formatSectorTarget('   ')).toBeNull();
    });

    it('uses default targets when customTargets not provided', () => {
      expect(formatSectorTarget('Healthcare')).toBe('target 25–30%');
      expect(formatSectorTarget('Technology')).toBe('target 15–18%');
      expect(formatSectorTarget('Crypto')).toBe('target 2–5%');
    });

    it('lookup is case-insensitive', () => {
      expect(formatSectorTarget('healthcare')).toBe('target 25–30%');
      expect(formatSectorTarget('HEALTHCARE')).toBe('target 25–30%');
      expect(formatSectorTarget('  Technology  ')).toBe('target 15–18%');
    });

    it('formats single-value target (min === max) as "target N%"', () => {
      const custom = { Technology: { min: 15, max: 15 } };
      expect(formatSectorTarget('Technology', custom)).toBe('target 15%');
    });

    it('uses customTargets when provided', () => {
      const custom = {
        Healthcare: { min: 20, max: 28 },
        Other: { min: 5, max: 10 },
      };
      expect(formatSectorTarget('Healthcare', custom)).toBe('target 20–28%');
      expect(formatSectorTarget('Other', custom)).toBe('target 5–10%');
      expect(formatSectorTarget('Technology', custom)).toBeNull();
    });

    it('returns null for sector not in targets', () => {
      expect(formatSectorTarget('Unknown Sector')).toBeNull();
    });
  });

  describe('defaults', () => {
    it('SECTOR_TARGET_TABLE has expected sectors and Cash is separate', () => {
      const sectors = SECTOR_TARGET_TABLE.map((r) => r.sector);
      expect(sectors).toContain('Healthcare');
      expect(sectors).toContain('Technology');
      expect(sectors).toContain('Crypto');
      expect(sectors).not.toContain('Cash');
    });

    it('CASH_TARGET_ROW matches CASH_TARGET_PCT', () => {
      expect(CASH_TARGET_ROW.sector).toBe('Cash');
      expect(CASH_TARGET_ROW.min).toBe(CASH_TARGET_PCT.min);
      expect(CASH_TARGET_ROW.max).toBe(CASH_TARGET_PCT.max);
    });
  });
});
