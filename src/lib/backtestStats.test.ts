import { describe, expect, it } from 'vitest';
import { byClassification, noiseFloor, quantiles, spearman, verdict, type BacktestRow } from './backtestStats';

function row(score: number, excess: number, i = 0): BacktestRow {
  return {
    symbol: `S${i}`,
    name: `S${i}`,
    sector: 'X',
    peersInSector: 5,
    score,
    classification: score >= 65 ? 'Bullish' : score >= 40 ? 'Watch' : 'Bearish',
    confidence: 'high',
    coverage: 1,
    categories: { growth: score, profitability: null, valuation: null, health: null, momentum: null },
    anchorPrice: 100,
    forwardReturn: excess,
    excessReturn: excess
  };
}

describe('spearman', () => {
  it('is 1 for a monotone increasing relation and -1 for decreasing', () => {
    expect(spearman([1, 2, 3, 4, 5], [10, 20, 30, 40, 50])).toBeCloseTo(1);
    expect(spearman([1, 2, 3, 4, 5], [50, 40, 30, 20, 10])).toBeCloseTo(-1);
  });
  it('refuses tiny samples', () => {
    expect(spearman([1, 2], [1, 2])).toBeNull();
  });
  it('handles ties with average ranks', () => {
    expect(spearman([1, 1, 2, 2, 3], [1, 2, 3, 4, 5])).toBeGreaterThan(0.8);
  });
});

describe('quantiles and classes', () => {
  const rows = Array.from({ length: 50 }, (_, i) => row(i * 2, i % 2 ? 0.1 : -0.1, i));

  it('splits into equal buckets ordered by score', () => {
    const q = quantiles(rows, 5);
    expect(q).toHaveLength(5);
    expect(q.map((b) => b.n)).toEqual([10, 10, 10, 10, 10]);
    expect(q[0].scoreRange[1]).toBeLessThan(q[4].scoreRange[0]);
  });

  it('reports hit rate as the share beating the benchmark', () => {
    expect(quantiles(rows, 5)[0].hitRate).toBeCloseTo(0.5);
    expect(byClassification(rows).find((c) => c.label === 'Bullish')?.n).toBe(rows.filter((r) => r.score >= 65).length);
  });
});

describe('verdict wording follows the numbers', () => {
  it('says no signal when the correlation sits inside the noise floor', () => {
    const rows = Array.from({ length: 100 }, (_, i) => row((i * 37) % 100, ((i * 53) % 100) / 100 - 0.5, i));
    const v = verdict(rows);
    expect(v.reading).toBe('none');
    expect(v.sentence).toMatch(/better than chance/);
  });
  it('says positive when higher scores really did better', () => {
    const rows = Array.from({ length: 100 }, (_, i) => row(i, i / 100 - 0.5, i));
    expect(verdict(rows).reading).toBe('positive');
  });
  it('says inverse when higher scores did worse', () => {
    const rows = Array.from({ length: 100 }, (_, i) => row(i, 0.5 - i / 100, i));
    expect(verdict(rows).reading).toBe('inverse');
  });
  it('noise floor shrinks with sample size', () => {
    expect(noiseFloor(400)).toBeCloseTo(0.1);
    expect(noiseFloor(100)).toBeCloseTo(0.2);
  });
});
