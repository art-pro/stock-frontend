import {
  getSectorRebalanceSummary,
  getSuggestedActions,
  getConcentration,
} from './portfolioInsights';
import type { Stock } from '@/lib/api';

describe('portfolioInsights', () => {
  describe('getSectorRebalanceSummary', () => {
    it('classifies sectors as over/at/under using default targets', () => {
      const weights = {
        Healthcare: 0.35,   // 35% > 30 -> over
        Technology: 0.16,   // 16% in 15-18 -> at
        Energy: 0.03,       // 3% < 5 -> under
      };
      const summary = getSectorRebalanceSummary(weights);
      expect(summary.over).toHaveLength(1);
      expect(summary.over[0].sector).toBe('Healthcare');
      expect(summary.over[0].currentPct).toBe(35);
      expect(summary.at).toHaveLength(1);
      expect(summary.at[0].sector).toBe('Technology');
      expect(summary.under).toHaveLength(1);
      expect(summary.under[0].sector).toBe('Energy');
    });

    it('accepts sector weights as 0-100 (percentage)', () => {
      const weights = { Healthcare: 40 };
      const summary = getSectorRebalanceSummary(weights);
      expect(summary.over).toHaveLength(1);
      expect(summary.over[0].currentPct).toBe(40);
    });

    it('uses customTargets when provided', () => {
      const weights = { Healthcare: 0.28 };
      const defaultSummary = getSectorRebalanceSummary(weights);
      expect(defaultSummary.at).toHaveLength(1);

      const customTargets = { Healthcare: { min: 20, max: 25 } };
      const customSummary = getSectorRebalanceSummary(weights, customTargets);
      expect(customSummary.over).toHaveLength(1);
      expect(customSummary.over[0].targetMin).toBe(20);
      expect(customSummary.over[0].targetMax).toBe(25);
    });

    it('puts sector with no target in noTarget', () => {
      const weights = { 'Unknown Sector': 0.1 };
      const summary = getSectorRebalanceSummary(weights);
      expect(summary.noTarget).toHaveLength(1);
      expect(summary.noTarget[0].sector).toBe('Unknown Sector');
      expect(summary.noTarget[0].currentPct).toBe(10);
    });
  });

  describe('getSuggestedActions', () => {
    const baseStock: Stock = {
      id: 1,
      portfolio_id: 1,
      ticker: 'AAPL',
      company_name: 'Apple',
      sector: 'Technology',
      current_price: 100,
      currency: 'USD',
      fair_value: 110,
      expected_value: 8,
      assessment: 'Add',
      buy_zone_status: 'within buy zone',
      sell_zone_status: 'Below sell zone',
      weight: 0.05,
      half_kelly_suggested: 6,
      shares_owned: 10,
    } as Stock;

    it('includes sector_over when sector exceeds target', () => {
      const sectorWeights = { Technology: 0.25 };
      const stocks: Stock[] = [];
      const actions = getSuggestedActions(sectorWeights, stocks);
      expect(actions.some((a) => a.type === 'sector_over' && a.sector === 'Technology')).toBe(true);
    });

    it('uses customTargets for sector_over', () => {
      const sectorWeights = { Technology: 0.20 };
      const defaultActions = getSuggestedActions(sectorWeights, []);
      const overDefault = defaultActions.filter((a) => a.type === 'sector_over');
      const customTargets = { Technology: { min: 20, max: 25 } };
      const customActions = getSuggestedActions(sectorWeights, [], customTargets);
      const overCustom = customActions.filter((a) => a.type === 'sector_over');
      expect(overDefault.length).toBeGreaterThan(0);
      expect(overDefault[0].type).toBe('sector_over');
      expect(overCustom.length).toBe(0);
    });

    it('includes sell_zone and trim_zone from stock status', () => {
      const stocks: Stock[] = [
        { ...baseStock, id: 1, ticker: 'A', sell_zone_status: 'In sell zone' },
        { ...baseStock, id: 2, ticker: 'B', sell_zone_status: 'In trim zone' },
      ];
      const actions = getSuggestedActions({}, stocks);
      expect(actions.some((a) => a.type === 'sell_zone' && a.stock.ticker === 'A')).toBe(true);
      expect(actions.some((a) => a.type === 'trim_zone' && a.stock.ticker === 'B')).toBe(true);
    });
  });

  describe('getConcentration', () => {
    it('returns top 1/3/5 and max position from weights (0-1)', () => {
      const stocks: Stock[] = [
        { ...({} as Stock), id: 1, ticker: 'A', shares_owned: 100, weight: 0.4 },
        { ...({} as Stock), id: 2, ticker: 'B', shares_owned: 50, weight: 0.35 },
        { ...({} as Stock), id: 3, ticker: 'C', shares_owned: 30, weight: 0.25 },
      ];
      const c = getConcentration(stocks);
      expect(c.maxPositionTicker).toBe('A');
      expect(c.top1Pct).toBeCloseTo(40, 1);
      expect(c.top3Pct).toBeCloseTo(100, 1);
      expect(c.top5Pct).toBeCloseTo(100, 1);
      expect(c.maxPositionPct).toBeCloseTo(40, 1);
    });
  });
});
