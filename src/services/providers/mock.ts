/**
 * Bundled sample-data provider.
 *
 * Lets the app run fully without any API key. Price series are generated from a
 * seeded PRNG so a given ticker looks identical on every reload — a chart that
 * reshuffles on refresh is worse than no chart.
 */

import {
  DataError,
  type AnalystConsensus,
  type CompanyDossier,
  type EarningsCalendar,
  type FinancialPeriod,
  type FinancialRatios,
  type HistoricalPrices,
  type NewsItem,
  type PriceBar,
  type RatingDistribution,
  type StockDataProvider
} from '../../types';
import { MOCK_SEEDS, SUPPORTED_MOCK_SYMBOLS, type CompanySeed } from '../../data/mockSeeds';

/** Fixed anchor date so the sample data never shifts under the reader. */
const LATEST_TRADING_DAY = '2026-08-03';
const YEARS_OF_HISTORY = 5;
const TRADING_DAYS_PER_YEAR = 252;

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromSymbol(symbol: string): number {
  let hash = 2166136261;
  for (let i = 0; i < symbol.length; i++) {
    hash ^= symbol.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Business days ending at LATEST_TRADING_DAY, oldest first. */
function businessDays(count: number): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${LATEST_TRADING_DAY}T00:00:00Z`);
  while (dates.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return dates.reverse();
}

/**
 * Walks backwards from the known latest close so the series ends exactly on the
 * seed price, then fills OHLC around each close.
 */
function generateBars(symbol: string, endPrice: number, annualVol: number, annualDrift: number): PriceBar[] {
  const count = YEARS_OF_HISTORY * TRADING_DAYS_PER_YEAR;
  const dates = businessDays(count);
  const rand = mulberry32(seedFromSymbol(symbol));

  const dailyVol = annualVol / Math.sqrt(TRADING_DAYS_PER_YEAR);
  const dailyDrift = annualDrift / TRADING_DAYS_PER_YEAR;

  const closes: number[] = new Array(count);
  closes[count - 1] = endPrice;
  for (let i = count - 2; i >= 0; i--) {
    // Box-Muller for a normal shock, applied in reverse.
    const u1 = Math.max(rand(), 1e-9);
    const u2 = rand();
    const shock = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const step = dailyDrift + dailyVol * shock;
    closes[i] = closes[i + 1] / (1 + step);
  }

  return dates.map((date, i) => {
    const close = closes[i];
    const prev = i > 0 ? closes[i - 1] : close;
    const open = prev * (1 + (rand() - 0.5) * dailyVol * 0.8);
    const spread = close * dailyVol * (0.6 + rand() * 0.9);
    const high = Math.max(open, close) + spread * rand();
    const low = Math.min(open, close) - spread * rand();
    const volume = Math.round((25_000_000 + rand() * 45_000_000) * (1 + Math.abs(close / prev - 1) * 12));
    return {
      date,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume
    };
  });
}

function buildStatements(seed: CompanySeed): FinancialPeriod[] {
  const startYear = 2021;
  return seed.revenueHistory.map((revenue, i) => {
    const netIncome = revenue * seed.profitMargin * (0.88 + i * 0.03);
    const operatingIncome = revenue * seed.operatingMargin * (0.9 + i * 0.025);
    const operatingCashFlow = netIncome * 1.28;
    const capex = revenue * 0.058;
    return {
      fiscalDate: `${startYear + i}-12-31`,
      fiscalYear: startYear + i,
      period: 'FY' as const,
      revenue,
      grossProfit: revenue * seed.grossMargin,
      operatingIncome,
      netIncome,
      eps: seed.epsHistory[i] ?? null,
      operatingCashFlow,
      capitalExpenditure: capex,
      freeCashFlow: operatingCashFlow - capex,
      totalAssets: revenue * 0.92,
      totalDebt: revenue * 0.28 * seed.debtToEquity,
      totalEquity: (revenue * 0.28 * seed.debtToEquity) / Math.max(seed.debtToEquity, 0.01),
      interestExpense: seed.interestCoverage ? operatingIncome / seed.interestCoverage : null
    };
  });
}

function buildRatios(seed: CompanySeed): FinancialRatios {
  const rev = seed.revenueHistory;
  const latest = rev[rev.length - 1];
  const prior = rev[rev.length - 2];
  const threeBack = rev[rev.length - 4];
  const eps = seed.epsHistory;

  return {
    symbol: seed.symbol,
    trailingPE: seed.trailingPE,
    forwardPE: seed.forwardPE,
    pegRatio: seed.pegRatio,
    priceToSales: seed.priceToSales,
    priceToBook: seed.priceToBook,
    evToEbitda: seed.evToEbitda,
    evToRevenue: seed.evToRevenue,
    freeCashFlowYield: seed.freeCashFlowYield,
    grossMargin: seed.grossMargin,
    operatingMargin: seed.operatingMargin,
    profitMargin: seed.profitMargin,
    returnOnEquity: seed.returnOnEquity,
    returnOnAssets: seed.returnOnAssets,
    returnOnInvestedCapital: seed.returnOnInvestedCapital,
    debtToEquity: seed.debtToEquity,
    interestCoverage: seed.interestCoverage,
    currentRatio: seed.currentRatio,
    revenueGrowthYoY: prior ? latest / prior - 1 : null,
    earningsGrowthYoY: eps.length > 1 && eps[eps.length - 2] > 0 ? eps[eps.length - 1] / eps[eps.length - 2] - 1 : null,
    revenueCagr3y: threeBack ? Math.pow(latest / threeBack, 1 / 3) - 1 : null
  };
}

const CONSENSUS_WEIGHTS: Record<keyof RatingDistribution, number> = {
  strongBuy: 1,
  buy: 2,
  hold: 3,
  sell: 4,
  strongSell: 5
};

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

/** Maps provider wording onto our buckets, e.g. "Overweight" -> buy. */
export function normalizeRating(raw: string): 'strongBuy' | 'buy' | 'hold' | 'sell' | 'strongSell' {
  const value = raw.toLowerCase();
  if (/strong buy|conviction buy/.test(value)) return 'strongBuy';
  if (/buy|outperform|overweight|accumulate|add|positive/.test(value)) return 'buy';
  if (/hold|neutral|market perform|equal ?weight|in-?line|sector perform/.test(value)) return 'hold';
  if (/strong sell|conviction sell/.test(value)) return 'strongSell';
  if (/sell|underperform|underweight|reduce|negative/.test(value)) return 'sell';
  return 'hold';
}

function buildConsensus(seed: CompanySeed): AnalystConsensus {
  const dist: RatingDistribution = {
    strongBuy: seed.analyst.strongBuy,
    buy: seed.analyst.buy,
    hold: seed.analyst.hold,
    sell: seed.analyst.sell,
    strongSell: seed.analyst.strongSell
  };
  const score = consensusScoreOf(dist);
  const rand = mulberry32(seedFromSymbol(`${seed.symbol}-trend`));

  // Six monthly snapshots ending at the current distribution.
  const trend = Array.from({ length: 6 }, (_, i) => {
    const monthsBack = 5 - i;
    const date = new Date('2026-08-01T00:00:00Z');
    date.setUTCMonth(date.getUTCMonth() - monthsBack);
    const drift = monthsBack === 0 ? 0 : Math.round((rand() - 0.45) * 4);
    return {
      period: date.toISOString().slice(0, 7),
      distribution: {
        strongBuy: Math.max(0, dist.strongBuy - drift),
        buy: Math.max(0, dist.buy + Math.round(drift / 2)),
        hold: Math.max(0, dist.hold + drift),
        sell: Math.max(0, dist.sell + (monthsBack > 3 ? 1 : 0)),
        strongSell: dist.strongSell
      }
    };
  });

  return {
    symbol: seed.symbol,
    distribution: dist,
    analystCount: Object.values(dist).reduce((a, b) => a + b, 0),
    consensusScore: score,
    consensusLabel: consensusLabelOf(score),
    asOf: '2026-08-01',
    trend,
    recentActions: seed.actions.map((a) => ({
      firm: a.firm,
      action: a.action,
      rawRating: a.rawRating,
      rating: normalizeRating(a.rawRating),
      priceTarget: a.priceTarget,
      date: a.date
    }))
  };
}

function buildNews(seed: CompanySeed): NewsItem[] {
  return seed.news.map((item, i) => ({
    id: `${seed.symbol}-news-${i}`,
    headline: item.headline,
    summary: item.summary,
    url: `${seed.website}/newsroom`,
    publication: item.publication,
    publishedAt: item.publishedAt,
    sentiment: item.sentiment,
    sentimentScore: item.sentimentScore
  }));
}

function buildEarnings(seed: CompanySeed): EarningsCalendar {
  const past = [
    { fiscalPeriod: 'Q3 2025', date: '2025-10-30', epsEstimate: 1.6, epsActual: 1.64 },
    { fiscalPeriod: 'Q4 2025', date: '2026-01-29', epsEstimate: 2.35, epsActual: 2.4 },
    { fiscalPeriod: 'Q1 2026', date: '2026-04-30', epsEstimate: 1.62, epsActual: 1.58 },
    { fiscalPeriod: 'Q2 2026', date: '2026-07-30', epsEstimate: 1.71, epsActual: 1.79 }
  ].map((e) => ({ ...e, isFuture: false }));

  return {
    symbol: seed.symbol,
    events: [
      ...past,
      { fiscalPeriod: 'Q3 2026', date: seed.nextEarningsDate, epsEstimate: 1.94, epsActual: null, isFuture: true }
    ],
    nextEarningsDate: seed.nextEarningsDate
  };
}

function buildDossier(seed: CompanySeed): CompanyDossier {
  const annualVol = 0.16 + seed.beta * 0.11;
  const annualDrift = 0.06 + (seed.returnOnEquity > 0.3 ? 0.09 : 0.02);
  const bars = generateBars(seed.symbol, seed.price, annualVol, annualDrift);
  const benchmarkBars = generateBars('SPX-BENCHMARK', 6180, 0.14, 0.085);

  const prices: HistoricalPrices = { symbol: seed.symbol, bars };
  const benchmark: HistoricalPrices = { symbol: 'S&P 500', bars: benchmarkBars };

  const last = bars[bars.length - 1];
  // The day change is derived from the seed's percentage rather than from the
  // generated series, so the absolute and percentage figures cannot disagree.
  const prevClose = Number((seed.price / (1 + seed.changePercent / 100)).toFixed(2));
  const annual = buildStatements(seed);

  return {
    source: {
      provider: 'Bundled sample data',
      fetchedAt: new Date().toISOString(),
      freshness: 'end-of-day',
      isMock: true
    },
    profile: {
      symbol: seed.symbol,
      name: seed.name,
      exchange: seed.exchange,
      currency: 'USD',
      country: seed.country,
      sector: seed.sector,
      industry: seed.industry,
      description: seed.description,
      website: seed.website,
      logoUrl: null,
      sharesOutstanding: seed.sharesOutstanding,
      marketCap: seed.price * seed.sharesOutstanding,
      beta: seed.beta,
      fiscalYearEnd: seed.fiscalYearEnd
    },
    quote: {
      symbol: seed.symbol,
      price: seed.price,
      change: seed.price - prevClose,
      changePercent: seed.changePercent,
      previousClose: prevClose,
      open: last.open,
      dayHigh: last.high,
      dayLow: last.low,
      volume: last.volume,
      week52High: seed.week52High,
      week52Low: seed.week52Low,
      asOf: LATEST_TRADING_DAY
    },
    prices,
    benchmark,
    statements: { symbol: seed.symbol, annual, quarterly: [] },
    ratios: buildRatios(seed),
    peers: {
      symbol: seed.symbol,
      sector: seed.sector,
      sectorMedian: seed.sectorMedian,
      peers: seed.peers
    },
    consensus: buildConsensus(seed),
    priceTargets: {
      symbol: seed.symbol,
      average: seed.analyst.targetAverage,
      median: seed.analyst.targetMedian,
      high: seed.analyst.targetHigh,
      low: seed.analyst.targetLow,
      analystCount:
        seed.analyst.strongBuy + seed.analyst.buy + seed.analyst.hold + seed.analyst.sell + seed.analyst.strongSell,
      asOf: '2026-08-01'
    },
    estimates: { symbol: seed.symbol, rows: seed.estimates },
    news: buildNews(seed),
    catalysts: seed.catalysts.map((c, i) => ({
      id: `${seed.symbol}-cat-${i}`,
      kind: c.kind,
      title: c.title,
      detail: c.detail,
      expectedDate: c.expectedDate,
      source: 'Company filings and press coverage'
    })),
    earnings: buildEarnings(seed)
  };
}

export const mockProvider: StockDataProvider = {
  id: 'mock',
  label: 'Bundled sample data',
  freshness: 'end-of-day',
  isMock: true,
  supports: (symbol) => symbol.toUpperCase() in MOCK_SEEDS,
  async getDossier(symbol) {
    const key = symbol.toUpperCase();
    const seed = MOCK_SEEDS[key];
    if (!seed) {
      throw new DataError(
        'unsupported-ticker',
        `No sample data bundled for ${key}. Sample tickers: ${SUPPORTED_MOCK_SYMBOLS.join(', ')}. Configure an API key to look up any US ticker.`
      );
    }
    // Small delay so loading states are exercised rather than skipped.
    await new Promise((resolve) => setTimeout(resolve, 180));
    return buildDossier(seed);
  }
};
