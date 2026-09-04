import { describe, expect, it } from 'vitest';
import { scoreCompany, computeMomentumInput, CATEGORY_WEIGHTS } from './scoring';
import type { CompanyDossier, FinancialRatios, PriceBar } from '../types';

/** Test fixtures only — nothing here reaches the UI. */
function bars(count: number, start = 100, drift = 0.0005): PriceBar[] {
  const out: PriceBar[] = [];
  let price = start;
  const d = new Date('2024-01-02T00:00:00Z');
  for (let i = 0; i < count; i++) {
    price *= 1 + drift;
    out.push({ date: d.toISOString().slice(0, 10), open: price, high: price * 1.01, low: price * 0.99, close: price, volume: 1 });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function ratios(overrides: Partial<FinancialRatios> = {}): FinancialRatios {
  return {
    symbol: 'TEST',
    trailingPE: 20,
    forwardPE: null,
    pegRatio: null,
    priceToSales: null,
    priceToBook: null,
    evToEbitda: 15,
    evToRevenue: null,
    freeCashFlowYield: 0.04,
    grossMargin: 0.4,
    operatingMargin: 0.15,
    profitMargin: 0.125,
    returnOnEquity: 0.15,
    returnOnAssets: null,
    returnOnInvestedCapital: 0.125,
    debtToEquity: 1.25,
    interestCoverage: 11,
    currentRatio: 1.65,
    revenueGrowthYoY: 0.1,
    earningsGrowthYoY: 0.075,
    revenueCagr3y: 0.1,
    ...overrides
  };
}

function dossier(overrides: Partial<CompanyDossier> = {}, r: Partial<FinancialRatios> = {}): CompanyDossier {
  const series = bars(300);
  return {
    profile: { symbol: 'TEST', name: 'Test', sector: 'Technology' },
    quote: { price: series[series.length - 1].close, week52High: 130, week52Low: 90 },
    prices: { symbol: 'TEST', bars: series },
    ratios: ratios(r),
    peers: { symbol: 'TEST', sector: 'Technology', peerMedian: { trailingPE: 20, evToEbitda: 15, operatingMargin: 0.15, returnOnEquity: 0.15 }, self: null, peers: [] },
    consensus: null,
    ...overrides
  } as unknown as CompanyDossier;
}

describe('scoreCompany', () => {
  it('weights sum to one', () => {
    expect(Object.values(CATEGORY_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it('scores a company exactly at the band midpoints near 50', () => {
    // Every ratio above sits at the middle of its band and the multiples equal
    // the peer median, so each category should land near 50.
    const score = scoreCompany(dossier());
    for (const category of score.categories) {
      if (category.key === 'momentum') continue; // depends on the synthetic series
      expect(category.score).toBeGreaterThanOrEqual(40);
      expect(category.score).toBeLessThanOrEqual(60);
    }
  });

  it('classifies on the stated thresholds', () => {
    const bullish = scoreCompany(
      dossier({}, { revenueGrowthYoY: 0.3, revenueCagr3y: 0.25, earningsGrowthYoY: 0.3, operatingMargin: 0.35, profitMargin: 0.3, returnOnEquity: 0.35, returnOnInvestedCapital: 0.3, trailingPE: 10, evToEbitda: 8, freeCashFlowYield: 0.09, debtToEquity: 0, interestCoverage: 25, currentRatio: 2.6 })
    );
    expect(bullish.classification).toBe('Bullish');

    const bearish = scoreCompany(
      dossier({}, { revenueGrowthYoY: -0.1, revenueCagr3y: -0.05, earningsGrowthYoY: -0.2, operatingMargin: -0.05, profitMargin: -0.1, returnOnEquity: -0.1, returnOnInvestedCapital: -0.05, trailingPE: 40, evToEbitda: 30, freeCashFlowYield: -0.01, debtToEquity: 3, interestCoverage: 1, currentRatio: 0.5 })
    );
    expect(bearish.classification).toBe('Bearish');
  });

  it('drops a category with no data and redistributes its weight rather than scoring zero', () => {
    const full = scoreCompany(dossier());
    const noHealth = scoreCompany(dossier({}, { debtToEquity: null, interestCoverage: null, currentRatio: null }));
    const health = noHealth.categories.find((c) => c.key === 'health');
    expect(health?.score).toBeNull();
    // Health was near 50 like everything else, so removing it should not move the total much.
    expect(Math.abs(noHealth.total - full.total)).toBeLessThan(8);
    expect(noHealth.coverage).toBeLessThan(full.coverage);
  });

  it('gives analyst opinion zero weight', () => {
    const base = dossier();
    const withBullishAnalysts = dossier({
      consensus: {
        symbol: 'TEST',
        distribution: { strongBuy: 30, buy: 10, hold: 0, sell: 0, strongSell: 0 },
        analystCount: 40,
        consensusScore: 1.25,
        consensusLabel: 'Strong Buy',
        asOf: '2026-08',
        trend: [],
        recentActions: []
      }
    });
    expect(scoreCompany(withBullishAnalysts).total).toBe(scoreCompany(base).total);
  });

  it('marks a null metric as n/a instead of formatting a fake value', () => {
    const score = scoreCompany(dossier({}, { pegRatio: null }));
    const peg = score.categories.flatMap((c) => c.metrics).find((m) => m.label === 'PEG ratio');
    expect(peg?.formatted).toBe('n/a');
    expect(peg?.score).toBeNull();
  });
});

describe('computeMomentumInput', () => {
  it('refuses a one-year return and a 200-day average on a short series', () => {
    const short = dossier({ prices: { symbol: 'TEST', bars: bars(100) } });
    const m = computeMomentumInput(short);
    expect(m.oneYearReturn).toBeNull();
    expect(m.priceVs200dma).toBeNull();
    // The 52-week position comes from the quote, so it survives.
    expect(m.range52Position).not.toBeNull();
  });

  it('computes them on a long series', () => {
    const m = computeMomentumInput(dossier());
    expect(m.oneYearReturn).not.toBeNull();
    expect(m.priceVs200dma).not.toBeNull();
    expect(m.oneYearReturn as number).toBeGreaterThan(0); // positive drift fixture
  });
});
