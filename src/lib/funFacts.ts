/**
 * Fun facts. Explicitly entertainment, not part of the investment case, and
 * never fed into the score.
 *
 * Two kinds are mixed: hand-written trivia for the tickers we have it for, and
 * facts computed from the loaded data so any ticker gets something. Computed
 * facts are honest arithmetic on the same series the charts use — the joke is
 * the framing, not the number.
 */

import type { CompanyDossier } from '../types';
import { TRIVIA } from '../data/trivia';
import { formatBigMoney, formatCurrency, formatNumber, formatPercent } from './format';

export interface FunFact {
  icon: 'chart' | 'globe' | 'clock' | 'dice' | 'flame' | 'book';
  text: string;
  /** True for hand-written trivia, false for facts derived from the data. */
  isCurated: boolean;
}

/** Rough nominal GDP in USD, for the "bigger than a country" comparison. */
const GDP_BY_COUNTRY: Array<[string, number]> = [
  ['Iceland', 32_000_000_000],
  ['Croatia', 82_000_000_000],
  ['Ecuador', 121_000_000_000],
  ['Hungary', 224_000_000_000],
  ['Portugal', 300_000_000_000],
  ['Greece', 249_000_000_000],
  ['New Zealand', 253_000_000_000],
  ['Finland', 300_000_000_000],
  ['Denmark', 420_000_000_000],
  ['Austria', 516_000_000_000],
  ['Ireland', 546_000_000_000],
  ['Belgium', 655_000_000_000],
  ['Sweden', 593_000_000_000],
  ['Switzerland', 885_000_000_000],
  ['Netherlands', 1_120_000_000_000],
  ['Türkiye', 1_340_000_000_000],
  ['Spain', 1_580_000_000_000],
  ['Australia', 1_790_000_000_000],
  ['Brazil', 2_170_000_000_000],
  ['Italy', 2_300_000_000_000],
  ['Canada', 2_240_000_000_000],
  ['France', 3_170_000_000_000],
  ['United Kingdom', 3_590_000_000_000],
  ['Japan', 4_210_000_000_000],
  ['Germany', 4_710_000_000_000]
];

const MEDIAN_US_SALARY = 62_000;
const WORLD_POPULATION = 8_100_000_000;
const SECONDS_PER_YEAR = 31_557_600;

function largestCountryBelow(marketCap: number): [string, number] | null {
  let best: [string, number] | null = null;
  for (const entry of GDP_BY_COUNTRY) {
    if (entry[1] <= marketCap && (!best || entry[1] > best[1])) best = entry;
  }
  return best;
}

export function buildFunFacts(dossier: CompanyDossier): FunFact[] {
  const facts: FunFact[] = [];
  const bars = dossier.prices.bars;
  const { profile, quote, statements } = dossier;

  // --- Biggest single-day move -------------------------------------------
  if (bars.length > 2) {
    let extremeMove = 0;
    let extremeDate = '';
    for (let i = 1; i < bars.length; i++) {
      const move = bars[i].close / bars[i - 1].close - 1;
      if (Math.abs(move) > Math.abs(extremeMove)) {
        extremeMove = move;
        extremeDate = bars[i].date;
      }
    }
    if (extremeDate) {
      const direction = extremeMove > 0 ? 'gained' : 'lost';
      facts.push({
        icon: 'flame',
        text: `Wildest day on record here: ${profile.symbol} ${direction} ${formatPercent(Math.abs(extremeMove))} on ${extremeDate}. Somebody had a memorable afternoon.`,
        isCurated: false
      });
    }
  }

  // --- $1,000 five years ago ---------------------------------------------
  if (bars.length > 200) {
    const first = bars[0].close;
    const last = bars[bars.length - 1].close;
    const outcome = (1000 * last) / first;
    const verdict =
      outcome > 3000
        ? 'Try not to think about how many you did not buy.'
        : outcome > 1000
          ? 'Beats leaving it under the mattress.'
          : 'The mattress would have won.';
    facts.push({
      icon: 'chart',
      text: `$1,000 put into ${profile.symbol} at the start of this chart would be ${formatCurrency(outcome, profile.currency, 0)} today. ${verdict}`,
      isCurated: false
    });
  }

  // --- Market cap vs a country's GDP -------------------------------------
  if (profile.marketCap) {
    const country = largestCountryBelow(profile.marketCap);
    if (country) {
      facts.push({
        icon: 'globe',
        text: `At ${formatBigMoney(profile.marketCap)}, the market cap is larger than the entire annual economic output of ${country[0]}.`,
        isCurated: false
      });
    }
  }

  // --- Revenue per second -------------------------------------------------
  const latestRevenue = statements.annual[statements.annual.length - 1]?.revenue ?? null;
  if (latestRevenue) {
    facts.push({
      icon: 'clock',
      text: `The company books roughly ${formatCurrency(latestRevenue / SECONDS_PER_YEAR, profile.currency, 0)} of revenue every second. In the time you have spent reading this page it earned more than most people do in a year.`,
      isCurated: false
    });
  }

  // --- Shares per human ---------------------------------------------------
  if (profile.sharesOutstanding) {
    const perPerson = profile.sharesOutstanding / WORLD_POPULATION;
    facts.push({
      icon: 'dice',
      text:
        perPerson >= 1
          ? `There are ${formatNumber(profile.sharesOutstanding / 1e9, 2)} billion shares outstanding — enough for roughly ${perPerson.toFixed(1)} each for every person alive.`
          : `There are ${formatNumber(profile.sharesOutstanding / 1e9, 2)} billion shares outstanding, so about one share for every ${formatNumber(1 / perPerson, 0)} people on the planet.`,
      isCurated: false
    });
  }

  // --- Working hours per share --------------------------------------------
  if (quote.price > 0) {
    const hours = (quote.price / MEDIAN_US_SALARY) * 2080;
    facts.push({
      icon: 'clock',
      text:
        hours < 1
          ? `On the median US salary you earn one share roughly every ${Math.round(hours * 60)} minutes of work.`
          : `On the median US salary it takes about ${hours.toFixed(1)} hours of work to afford a single share.`,
      isCurated: false
    });
  }

  // --- Volatility count ----------------------------------------------------
  const lastYear = bars.slice(-252);
  if (lastYear.length > 100) {
    const bigMoves = lastYear.filter((bar, i) => i > 0 && Math.abs(bar.close / lastYear[i - 1].close - 1) > 0.03).length;
    facts.push({
      icon: 'flame',
      text:
        bigMoves === 0
          ? `Not once in the past year did this stock move more than 3% in a day. Thrilling it is not.`
          : `It moved more than 3% in a single day on ${bigMoves} of the last ${lastYear.length} trading days. ${bigMoves > 25 ? 'Hold on to something.' : 'Reasonably well behaved, as these things go.'}`,
      isCurated: false
    });
  }

  const curated = TRIVIA[profile.symbol] ?? [];
  const curatedFacts: FunFact[] = curated.map((text) => ({ icon: 'book', text, isCurated: true }));

  return [...curatedFacts, ...facts];
}
