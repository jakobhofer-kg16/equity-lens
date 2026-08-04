/**
 * Finnhub adapter — the primary provider.
 *
 * Verified against a real free key rather than the docs. Free tier returns:
 *
 * - `profile2` — profile, market cap, shares, and a logo URL
 * - `metric?metric=all` — 133 ratios plus 39 annual and 41 quarterly time
 *   series, which is what makes the fundamentals charts possible
 * - `recommendation` — the analyst rating distribution **month by month**, which
 *   Alpha Vantage cannot give at any tier of its free plan
 * - `peers` — a real comparison set instead of a curated list
 * - `earnings`, `quote`
 *
 * Premium and unavailable here (confirmed 403): `candle` (price history),
 * `price-target`, `upgrade-downgrade`.
 *
 * The decisive difference from Alpha Vantage is the budget: 60 requests per
 * minute against 25 per day. That is why peer metrics can be fetched per name,
 * and why this is the base provider rather than the fallback.
 */

import {
  DataError,
  type AnalystConsensus,
  type FinancialPeriod,
  type PeerCompany,
  type RatingDistribution,
  type StockDataProvider
} from '../../types';
import { SECTOR_MEDIANS } from '../../data/peerMap';
import { consensusLabelOf, consensusScoreOf } from './mock';

const BASE = 'https://finnhub.io/api/v1';
const MAX_PEERS = 3;
/** profile2 reports market cap and share count in millions. */
const MILLIONS = 1e6;

type Json = Record<string, unknown>;

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Finnhub reports margins and returns as percentages, e.g. 48.65 for 48.65%. */
function fraction(value: unknown): number | null {
  const parsed = num(value);
  return parsed === null ? null : parsed / 100;
}

async function call(path: string, params: Record<string, string>, apiKey: string): Promise<unknown> {
  const query = new URLSearchParams({ ...params, token: apiKey });

  let response: Response;
  try {
    response = await fetch(`${BASE}/${path}?${query}`);
  } catch (err) {
    throw new DataError('network', `Could not reach Finnhub: ${(err as Error).message}`);
  }

  if (response.status === 401) throw new DataError('no-api-key', 'Finnhub rejected the API key.');
  if (response.status === 403) {
    throw new DataError('provider-error', `Finnhub: ${path} is not included in this plan.`);
  }
  if (response.status === 429) {
    throw new DataError('rate-limited', 'Finnhub rate limit reached (60 requests per minute).', 60);
  }
  if (!response.ok) {
    throw new DataError('provider-error', `(HTTP ${response.status}) Finnhub request failed for ${path}.`);
  }

  return response.json();
}

interface SeriesPoint {
  period: string;
  v: number;
}

type SeriesMap = Record<string, SeriesPoint[]>;

function pointsFor(series: SeriesMap, key: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const point of series[key] ?? []) {
    if (typeof point?.v === 'number') map.set(point.period, point.v);
  }
  return map;
}

/**
 * Finnhub publishes per-share figures and margins rather than absolute income
 * statement lines, so the absolute values are reconstructed from them and the
 * share count. Good enough for a trend chart, and derived rather than reported —
 * the UI labels the section accordingly.
 */
function buildStatements(series: SeriesMap, shares: number | null): FinancialPeriod[] {
  const salesPerShare = pointsFor(series, 'salesPerShare');
  if (!salesPerShare.size || !shares) return [];

  const grossMargin = pointsFor(series, 'grossMargin');
  const netMargin = pointsFor(series, 'netMargin');
  const ebitPerShare = pointsFor(series, 'ebitPerShare');
  const eps = pointsFor(series, 'eps');
  const fcfMargin = pointsFor(series, 'fcfMargin');
  const bookValue = pointsFor(series, 'bookValue');
  const debtToEquity = pointsFor(series, 'totalDebtToEquity');

  return [...salesPerShare.entries()]
    .map(([period, sps]) => {
      const revenue = sps * shares;
      const equity = bookValue.has(period) ? (bookValue.get(period) as number) * shares : null;
      const leverage = debtToEquity.get(period) ?? null;

      return {
        fiscalDate: period,
        fiscalYear: Number(period.slice(0, 4)),
        period: 'FY' as const,
        revenue,
        grossProfit: grossMargin.has(period) ? revenue * (grossMargin.get(period) as number) : null,
        operatingIncome: ebitPerShare.has(period) ? (ebitPerShare.get(period) as number) * shares : null,
        netIncome: netMargin.has(period) ? revenue * (netMargin.get(period) as number) : null,
        eps: eps.get(period) ?? null,
        operatingCashFlow: null,
        capitalExpenditure: null,
        freeCashFlow: fcfMargin.has(period) ? revenue * (fcfMargin.get(period) as number) : null,
        totalAssets: null,
        totalDebt: equity !== null && leverage !== null ? equity * leverage : null,
        totalEquity: equity,
        interestExpense: null
      };
    })
    .sort((a, b) => (a.fiscalDate < b.fiscalDate ? -1 : 1))
    .slice(-6);
}

function buildConsensus(rows: Array<Json>, symbol: string): AnalystConsensus | null {
  if (!rows.length) return null;

  const sorted = [...rows].sort((a, b) => String(a.period).localeCompare(String(b.period)));
  const toDistribution = (row: Json): RatingDistribution => ({
    strongBuy: num(row.strongBuy) ?? 0,
    buy: num(row.buy) ?? 0,
    hold: num(row.hold) ?? 0,
    sell: num(row.sell) ?? 0,
    strongSell: num(row.strongSell) ?? 0
  });

  const latest = sorted[sorted.length - 1];
  const distribution = toDistribution(latest);
  const score = consensusScoreOf(distribution);

  return {
    symbol,
    distribution,
    analystCount: Object.values(distribution).reduce((a, b) => a + b, 0),
    consensusScore: score,
    consensusLabel: consensusLabelOf(score),
    asOf: String(latest.period ?? ''),
    trend: sorted.slice(-6).map((row) => ({
      period: String(row.period ?? '').slice(0, 7),
      distribution: toDistribution(row)
    })),
    // Individual rating actions sit behind /stock/upgrade-downgrade, which is
    // premium. Reported as unavailable rather than reconstructed.
    recentActions: []
  };
}

async function peerMetrics(symbols: string[], apiKey: string): Promise<PeerCompany[]> {
  const results = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const [metricJson, profileJson] = await Promise.all([
          call('stock/metric', { symbol, metric: 'all' }, apiKey) as Promise<Json>,
          call('stock/profile2', { symbol }, apiKey) as Promise<Json>
        ]);
        const m = (metricJson.metric ?? {}) as Json;
        return {
          symbol,
          name: String(profileJson.name ?? symbol),
          marketCap: num(profileJson.marketCapitalization) !== null ? (num(profileJson.marketCapitalization) as number) * MILLIONS : null,
          revenueGrowthYoY: fraction(m.revenueGrowthTTMYoy),
          operatingMargin: fraction(m.operatingMarginTTM),
          returnOnEquity: fraction(m.roeTTM),
          trailingPE: num(m.peTTM),
          evToEbitda: num(m.evEbitdaTTM),
          debtToEquity: num(m['totalDebt/totalEquityAnnual']),
          oneYearReturn: fraction(m['52WeekPriceReturnDaily'])
        };
      } catch {
        // One unavailable peer must not take the comparison table down.
        return null;
      }
    })
  );

  return results.filter((peer): peer is PeerCompany => peer !== null);
}

export function createFinnhubProvider(apiKey: string): StockDataProvider {
  return {
    id: 'finnhub',
    label: 'Finnhub',
    freshness: 'delayed',
    isMock: false,
    supports: () => true,

    async getDossier(rawSymbol) {
      const symbol = rawSymbol.toUpperCase();

      const [profile, metricJson, quoteJson] = await Promise.all([
        call('stock/profile2', { symbol }, apiKey) as Promise<Json>,
        call('stock/metric', { symbol, metric: 'all' }, apiKey) as Promise<Json>,
        call('quote', { symbol }, apiKey) as Promise<Json>
      ]);

      if (!profile.ticker) {
        throw new DataError('unsupported-ticker', `Finnhub does not cover "${symbol}".`);
      }

      const [recommendations, peerSymbols, earnings] = await Promise.all([
        (call('stock/recommendation', { symbol }, apiKey) as Promise<Json[]>).catch(() => [] as Json[]),
        (call('stock/peers', { symbol }, apiKey) as Promise<string[]>).catch(() => [] as string[]),
        (call('stock/earnings', { symbol }, apiKey) as Promise<Json[]>).catch(() => [] as Json[])
      ]);

      const m = (metricJson.metric ?? {}) as Json;
      const series = ((metricJson.series as Json | undefined)?.annual ?? {}) as SeriesMap;

      const shares = num(profile.shareOutstanding) !== null ? (num(profile.shareOutstanding) as number) * MILLIONS : null;
      const marketCap = num(profile.marketCapitalization) !== null ? (num(profile.marketCapitalization) as number) * MILLIONS : null;
      const price = num(quoteJson.c) ?? 0;

      // Finnhub's own peer list starts with the company itself.
      const peers = peerSymbols.filter((p) => p.toUpperCase() !== symbol).slice(0, MAX_PEERS);
      const sector = profile.finnhubIndustry ? String(profile.finnhubIndustry) : null;

      const fcfPerShare = num(m.fcfPerShareTTM);

      return {
        source: {
          provider: 'Finnhub',
          fetchedAt: new Date().toISOString(),
          freshness: 'delayed',
          isMock: false,
          notes: [
            'Fundamentals are reconstructed from Finnhub per-share figures and margins; Finnhub does not publish absolute statement lines on this plan.'
          ]
        },
        profile: {
          symbol,
          name: String(profile.name ?? symbol),
          exchange: String(profile.exchange ?? ''),
          currency: String(profile.currency ?? 'USD'),
          country: profile.country ? String(profile.country) : null,
          sector,
          // Finnhub publishes a single classification field, so there is no
          // separate industry to show. Rendering it twice reads as a bug.
          industry: null,
          description: `${profile.name ?? symbol} is listed on ${profile.exchange ?? 'a US exchange'} and has been public since ${profile.ipo ?? 'an undisclosed date'}. Finnhub does not supply a business description on this plan.`,
          website: profile.weburl ? String(profile.weburl) : null,
          logoUrl: profile.logo ? String(profile.logo) : null,
          sharesOutstanding: shares,
          marketCap,
          beta: num(m.beta),
          fiscalYearEnd: null
        },
        quote: {
          symbol,
          price,
          change: num(quoteJson.d) ?? 0,
          changePercent: num(quoteJson.dp) ?? 0,
          previousClose: num(quoteJson.pc) ?? price,
          open: num(quoteJson.o),
          dayHigh: num(quoteJson.h),
          dayLow: num(quoteJson.l),
          volume: null,
          week52High: num(m['52WeekHigh']),
          week52Low: num(m['52WeekLow']),
          asOf: num(quoteJson.t) ? new Date((num(quoteJson.t) as number) * 1000).toISOString().slice(0, 10) : ''
        },
        // Price history is premium on Finnhub; a Twelve Data key fills this in.
        prices: { symbol, bars: [] },
        benchmark: { symbol: 'S&P 500 (SPY)', bars: [] },
        statements: { symbol, annual: buildStatements(series, shares), quarterly: [] },
        ratios: {
          symbol,
          trailingPE: num(m.peTTM),
          forwardPE: num(m.forwardPE) ?? num(m.peNormalizedAnnual),
          pegRatio: num(m.pegRatio),
          priceToSales: num(m.psTTM),
          priceToBook: num(m.pbAnnual),
          evToEbitda: num(m.evEbitdaTTM),
          evToRevenue: num(m.evRevenueTTM),
          freeCashFlowYield: fcfPerShare !== null && price > 0 ? fcfPerShare / price : null,
          grossMargin: fraction(m.grossMarginTTM),
          operatingMargin: fraction(m.operatingMarginTTM),
          profitMargin: fraction(m.netProfitMarginTTM),
          returnOnEquity: fraction(m.roeTTM),
          returnOnAssets: fraction(m.roaTTM),
          returnOnInvestedCapital: fraction(m.roiTTM),
          debtToEquity: num(m['totalDebt/totalEquityAnnual']),
          interestCoverage: num(m.netInterestCoverageAnnual),
          currentRatio: num(m.currentRatioAnnual),
          revenueGrowthYoY: fraction(m.revenueGrowthTTMYoy),
          earningsGrowthYoY: fraction(m.epsGrowthTTMYoy),
          revenueCagr3y: fraction(m.revenueGrowth3Y)
        },
        peers: {
          symbol,
          sector,
          sectorMedian: SECTOR_MEDIANS[sector ?? ''] ?? {
            trailingPE: null,
            evToEbitda: null,
            operatingMargin: null,
            returnOnEquity: null
          },
          peers: await peerMetrics(peers, apiKey)
        },
        consensus: buildConsensus(recommendations, symbol),
        // /stock/price-target is premium; an Alpha Vantage key supplies this.
        priceTargets: null,
        estimates: null,
        news: [],
        catalysts: [],
        earnings: {
          symbol,
          events: earnings.slice(0, 8).map((row) => ({
            fiscalPeriod: String(row.period ?? ''),
            date: String(row.period ?? ''),
            epsEstimate: num(row.estimate),
            epsActual: num(row.actual),
            isFuture: false
          })),
          nextEarningsDate: null
        }
      };
    }
  };
}

/** Alpha Vantage's one free advantage: a consensus price target. */
export async function fetchAlphaVantagePriceTarget(
  symbol: string,
  apiKey: string
): Promise<{ average: number; asOf: string } | null> {
  const response = await fetch(
    `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`
  );
  if (!response.ok) return null;
  const json = (await response.json()) as Json;
  const target = num(json.AnalystTargetPrice);
  return target ? { average: target, asOf: String(json.LatestQuarter ?? '') } : null;
}
