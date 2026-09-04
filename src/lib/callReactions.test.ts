import { describe, expect, it } from 'vitest';
import { callReactions } from './callReactions';
import type { QuarterSentiment } from '../services/providers/earningsCalls';
import type { PriceBar } from '../types';

function quarter(date: string, polarity: number): QuarterSentiment {
  const overall = { words: 100, positive: 10, negative: 5, uncertainty: 0, litigious: 0, polarity, uncertaintyRate: 0, litigiousRate: 0, label: 'positive' as const };
  return { date, url: '', lines: 1, overall, management: null, analyst: null, highlight: { positive: null, negative: null } };
}

function bars(dates: string[], closes: number[]): PriceBar[] {
  return dates.map((date, i) => ({ date, open: closes[i], high: closes[i], low: closes[i], close: closes[i], volume: 0 }));
}

describe('callReactions', () => {
  it('measures the move from the pre-call close to five sessions later', () => {
    const dates = ['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-06', '2025-01-07', '2025-01-08', '2025-01-09'];
    const series = bars(dates, [100, 100, 100, 100, 100, 100, 110]);
    const r = callReactions([quarter('2024-12-31', 0.5), quarter('2025-01-02', 0.8)], series);
    expect(r[0].toneDelta).toBeNull(); // first call has no prior
    expect(r[1].toneDelta).toBeCloseTo(0.3);
    expect(r[1].reaction).toBeCloseTo(0.1); // 100 on 01-02 -> 110 five bars later
    expect(r[1].agree).toBe(true);
  });

  it('leaves the comparison open when a move is too small to call', () => {
    const dates = ['2025-01-02', '2025-01-03', '2025-01-06', '2025-01-07', '2025-01-08', '2025-01-09'];
    const series = bars(dates, [100, 100, 100, 100, 100, 100.1]);
    const r = callReactions([quarter('2024-12-31', 0.5), quarter('2025-01-02', 0.9)], series);
    expect(r[1].agree).toBeNull();
  });
});
