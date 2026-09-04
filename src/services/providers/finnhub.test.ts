import { describe, expect, it } from 'vitest';
import { buildConsensus, buildStatements, fraction, newsFromFinnhub, peerMedianOf } from './finnhub';

describe('finnhub adapter', () => {
  it('converts percentage fields to fractions and leaves gaps null', () => {
    expect(fraction('48.65')).toBeCloseTo(0.4865);
    expect(fraction(137.18)).toBeCloseTo(1.3718);
    expect(fraction(undefined)).toBeNull();
    expect(fraction('')).toBeNull();
  });

  it('orders the recommendation trend oldest first and takes the latest as current', () => {
    const c = buildConsensus(
      [
        { period: '2026-06-01', strongBuy: 1, buy: 1, hold: 1, sell: 0, strongSell: 0 },
        { period: '2026-08-01', strongBuy: 5, buy: 5, hold: 0, sell: 0, strongSell: 0 },
        { period: '2026-07-01', strongBuy: 2, buy: 2, hold: 2, sell: 0, strongSell: 0 }
      ],
      'X'
    );
    expect(c?.asOf).toBe('2026-08-01');
    expect(c?.analystCount).toBe(10);
    expect(c?.trend.map((t) => t.period)).toEqual(['2026-06', '2026-07', '2026-08']);
    expect(c?.recentActions).toEqual([]); // premium endpoint, never reconstructed
  });

  it('returns null consensus when there are no rows', () => {
    expect(buildConsensus([], 'X')).toBeNull();
  });

  it('peer median ignores nulls and non-positive multiples', () => {
    const median = peerMedianOf([
      { symbol: 'A', name: 'A', marketCap: null, revenueGrowthYoY: null, operatingMargin: 0.1, returnOnEquity: null, trailingPE: 10, evToEbitda: null, debtToEquity: null, oneYearReturn: null },
      { symbol: 'B', name: 'B', marketCap: null, revenueGrowthYoY: null, operatingMargin: 0.3, returnOnEquity: null, trailingPE: -5, evToEbitda: null, debtToEquity: null, oneYearReturn: null },
      { symbol: 'C', name: 'C', marketCap: null, revenueGrowthYoY: null, operatingMargin: 0.2, returnOnEquity: null, trailingPE: 30, evToEbitda: null, debtToEquity: null, oneYearReturn: null }
    ]);
    expect(median.trailingPE).toBe(20);
    expect(median.operatingMargin).toBeCloseTo(0.2);
    expect(median.evToEbitda).toBeNull();
  });

  it('reconstructs statements from per-share figures and the share count', () => {
    const annual = buildStatements(
      {
        salesPerShare: [{ period: '2025-09-27', v: 20 }, { period: '2024-09-28', v: 18 }],
        netMargin: [{ period: '2025-09-27', v: 0.25 }],
        eps: [{ period: '2025-09-27', v: 5 }]
      },
      1_000
    );
    expect(annual.map((p) => p.fiscalYear)).toEqual([2024, 2025]);
    expect(annual[1].revenue).toBe(20_000);
    expect(annual[1].netIncome).toBe(5_000);
    expect(annual[1].eps).toBe(5);
    expect(annual[0].netIncome).toBeNull(); // no margin for that period: null, not 0
  });

  it('scores headlines with the finance lexicon and keeps the source', () => {
    const items = newsFromFinnhub(
      [{ id: 1, headline: 'Company posts record revenue and strong growth', summary: '', source: 'Reuters', url: 'https://x', datetime: 1_700_000_000 }],
      'X'
    );
    expect(items[0].sentiment).toBe('positive');
    expect(items[0].publication).toBe('Reuters');
    expect(items[0].publishedAt.startsWith('2023-11-14')).toBe(true);
  });
});
