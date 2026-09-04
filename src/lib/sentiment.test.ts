import { describe, expect, it } from 'vitest';
import { countWords, scoreText } from './sentiment';

describe('finance sentiment lexicon', () => {
  it('does not read accounting vocabulary as negative', () => {
    // The whole point of a finance lexicon: these are neutral here.
    const s = scoreText('Total liabilities, depreciation and cost of capital were in line with the prior year.');
    expect(s.negative).toBe(0);
    expect(s.label).toBe('neutral');
  });

  it('scores an upbeat statement positive and a weak one negative', () => {
    expect(scoreText('Record revenue, strong momentum and improved margins; we exceeded guidance.').label).toBe('positive');
    expect(scoreText('Revenue declined, margins deteriorated and we missed guidance amid headwinds.').label).toBe('negative');
  });

  it('polarity is (positive - negative) / (positive + negative)', () => {
    const s = scoreText('strong strong strong weak');
    expect(s.positive).toBe(3);
    expect(s.negative).toBe(1);
    expect(s.polarity).toBeCloseTo(0.5);
  });

  it('returns null polarity with no tone words instead of pretending neutrality is measured', () => {
    expect(scoreText('The meeting is on Tuesday.').polarity).toBeNull();
  });

  it('tracks hedging separately from polarity', () => {
    const hedged = scoreText('We may possibly see potential growth, depending on uncertain conditions.');
    const firm = scoreText('We delivered growth.');
    expect(hedged.uncertaintyRate).toBeGreaterThan(firm.uncertaintyRate);
  });

  it('counts words case-insensitively and ignores punctuation', () => {
    expect(countWords('STRONG, strong. Strong!').positive).toBe(3);
  });
});
