import { describe, expect, it } from 'vitest';
import { consensusLabelOf, consensusScoreOf, normalizeRating } from './analysts';

describe('analyst helpers', () => {
  it('maps broker wording onto the five buckets', () => {
    expect(normalizeRating('Overweight')).toBe('buy');
    expect(normalizeRating('Outperform')).toBe('buy');
    expect(normalizeRating('Equal-Weight')).toBe('hold');
    expect(normalizeRating('Sector Perform')).toBe('hold');
    expect(normalizeRating('Underperform')).toBe('sell');
    expect(normalizeRating('Strong Buy')).toBe('strongBuy');
    expect(normalizeRating('Conviction Sell')).toBe('strongSell');
  });

  it('consensus score is the weighted mean, 1 best to 5 worst', () => {
    expect(consensusScoreOf({ strongBuy: 10, buy: 0, hold: 0, sell: 0, strongSell: 0 })).toBe(1);
    expect(consensusScoreOf({ strongBuy: 0, buy: 0, hold: 10, sell: 0, strongSell: 0 })).toBe(3);
    expect(consensusScoreOf({ strongBuy: 0, buy: 0, hold: 0, sell: 0, strongSell: 0 })).toBe(3);
  });

  it('labels on the stated bands', () => {
    expect(consensusLabelOf(1.4)).toBe('Strong Buy');
    expect(consensusLabelOf(2.4)).toBe('Buy');
    expect(consensusLabelOf(3)).toBe('Hold');
    expect(consensusLabelOf(4.6)).toBe('Strong Sell');
  });
});
