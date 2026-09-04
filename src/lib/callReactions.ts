import type { PriceBar } from '../types';
import type { QuarterSentiment } from '../services/providers/earningsCalls';

export const REACTION_DAYS = 5;

export interface Reaction {
  date: string;
  toneDelta: number | null;
  reaction: number | null;
  agree: boolean | null;
}

/**
 * Did the tone of the call anticipate the price reaction? For each call: the
 * change in overall polarity against the previous call, and the price move from
 * the last close on or before the call date to the close five sessions later.
 * Calls are held after the close, so that base close is pre-call.
 */
export function callReactions(quarters: QuarterSentiment[], bars: PriceBar[]): Reaction[] {
  return quarters.map((q, i) => {
    const prev = quarters[i - 1];
    const toneDelta =
      prev && q.overall.polarity !== null && prev.overall.polarity !== null ? q.overall.polarity - prev.overall.polarity : null;

    const baseIdx = bars.findLastIndex((b) => b.date <= q.date);
    const afterIdx = baseIdx + REACTION_DAYS;
    const reaction = baseIdx >= 0 && afterIdx < bars.length ? bars[afterIdx].close / bars[baseIdx].close - 1 : null;

    const agree =
      toneDelta !== null && reaction !== null && Math.abs(toneDelta) > 0.01 && Math.abs(reaction) > 0.005
        ? Math.sign(toneDelta) === Math.sign(reaction)
        : null;

    return { date: q.date, toneDelta, reaction, agree };
  });
}

