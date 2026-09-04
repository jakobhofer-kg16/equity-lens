import type { RatingBucket, RatingDistribution } from '../types';

const CONSENSUS_WEIGHTS: Record<keyof RatingDistribution, number> = {
  strongBuy: 1,
  buy: 2,
  hold: 3,
  sell: 4,
  strongSell: 5
};

/** Weighted mean of the distribution: 1 = everyone says strong buy, 5 = strong sell. */
export function consensusScoreOf(dist: RatingDistribution): number {
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  if (!total) return 3;
  const weighted = (Object.keys(dist) as Array<keyof RatingDistribution>).reduce(
    (sum, key) => sum + dist[key] * CONSENSUS_WEIGHTS[key],
    0
  );
  return weighted / total;
}

export function consensusLabelOf(score: number): string {
  if (score <= 1.5) return 'Strong Buy';
  if (score <= 2.5) return 'Buy';
  if (score <= 3.5) return 'Hold';
  if (score <= 4.5) return 'Sell';
  return 'Strong Sell';
}

/** Maps a broker's own wording onto the five buckets, e.g. "Overweight" -> buy. */
export function normalizeRating(raw: string): RatingBucket {
  const value = raw.toLowerCase();
  if (/strong buy|conviction buy/.test(value)) return 'strongBuy';
  if (/buy|outperform|overweight|accumulate|add|positive/.test(value)) return 'buy';
  if (/hold|neutral|market perform|equal ?weight|in-?line|sector perform/.test(value)) return 'hold';
  if (/strong sell|conviction sell/.test(value)) return 'strongSell';
  if (/sell|underperform|underweight|reduce|negative/.test(value)) return 'sell';
  return 'hold';
}
