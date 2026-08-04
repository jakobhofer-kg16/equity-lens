/**
 * Alpha Vantage adapter.
 *
 * Chosen as the live provider because a single OVERVIEW call already carries
 * the company profile, valuation multiples, margins, returns and — unusually
 * for a free tier — the full analyst rating distribution and target price. It
 * also sends `Access-Control-Allow-Origin: *`, so a static build can call it
 * directly without a proxy.
 *
 * Limits worth knowing: the free key allows 25 requests/day and returns
 * end-of-day data (intraday is premium-only). One dossier costs up to 8 calls,
 * so the cache in ../index.ts matters. See the README for the proxy setup that
 * keeps the key off the client in a real deployment.
 */

import {
  DataError,
  type AnalystConsensus,
  type FinancialPeriod,
  type NewsItem,
  type NewsSentiment,
  type PriceBar,
  type RatingDistribution,
  type StockDataProvider
} from '../../types';
import { PEER_MAP, SECTOR_MEDIANS } from '../../data/peerMap';
import { consensusLabelOf, consensusScoreOf } from './mock';

const BASE = 'https://www.alphavantage.co/query';
const BENCHMARK_SYMBOL = 'SPY';

type Json = Record<string, unknown>;

function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  // Alpha Vantage writes "None", "-" or "0" for metrics that do not apply.
  if (!text || text === 'None' || text === '-' || text.toLowerCase() === 'nan') return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Treats a zero as "not meaningful", used for multiples that cannot be zero. */
function positive(value: unknown): number | null {
  const parsed = num(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

async function call(fn: string, params: Record<string, string>, apiKey: string): Promise<Json> {
  const query = new URLSearchParams({ function: fn, apikey: apiKey, ...params });

  let response: Response;
  try {
    response = await fetch(`${BASE}?${query}`);
  } catch (err) {
    throw new DataError('network', `Could not reach Alpha Vantage: ${(err as Error).message}`);
  }

  if (!response.ok) {
    throw new DataError('provider-error', `(HTTP ${response.status}) Alpha Vantage request failed for ${fn}.`);
  }

  const json = (await response.json()) as Json;

  // Alpha Vantage signals throttling and key problems with HTTP 200 plus a
  // message field, so status codes alone are not enough.
  const note = (json.Note ?? json.Information ?? json['Error Message']) as string | undefined;
  if (note) {
    if (/rate limit|per day|frequency/i.test(note)) {
      throw new DataError('rate-limited', note, 60);
    }
    if (/apikey|api key|invalid/i.test(note)) {
      throw new DataError('no-api-key', note);
    }
    throw new DataError('provider-error', note);
  }

  return json;
}

function parseDailySeries(json: Json, symbol: string): PriceBar[] {
  const series = json['Time Series (Daily)'] as Record<string, Record<string, string>> | undefined;
  if (!series) {
    throw new DataError('unsupported-ticker', `Alpha Vantage returned no price history for ${symbol}.`);
  }

  return Object.entries(series)
    .map(([date, row]) => ({
      date,
      open: Number(row['1. open']),
      high: Number(row['2. high']),
      low: Number(row['3. low']),
      close: Number(row['4. close']),
      volume: Number(row['5. volume'])
    }))
    .filter((bar) => Number.isFinite(bar.close))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

function parseStatements(income: Json | null, balance: Json | null, cash: Json | null): FinancialPeriod[] {
  const incomeRows = (income?.annualReports as Json[] | undefined) ?? [];
  if (!incomeRows.length) return [];

  const balanceRows = (balance?.annualReports as Json[] | undefined) ?? [];
  const cashRows = (cash?.annualReports as Json[] | undefined) ?? [];
  const byDate = (rows: Json[], date: string) => rows.find((r) => r.fiscalDateEnding === date) ?? null;

  return incomeRows
    .map((row) => {
      const date = String(row.fiscalDateEnding);
      const bal = byDate(balanceRows, date);
      const flow = byDate(cashRows, date);

      const operatingCashFlow = num(flow?.operatingCashflow);
      const capex = num(flow?.capitalExpenditures);
      const longTerm = num(bal?.longTermDebt) ?? 0;
      const shortTerm = num(bal?.shortTermDebt) ?? 0;

      return {
        fiscalDate: date,
        fiscalYear: Number(date.slice(0, 4)),
        period: 'FY' as const,
        revenue: num(row.totalRevenue),
        grossProfit: num(row.grossProfit),
        operatingIncome: num(row.operatingIncome),
        netIncome: num(row.netIncome),
        eps: null,
        operatingCashFlow,
        capitalExpenditure: capex,
        freeCashFlow: operatingCashFlow !== null && capex !== null ? operatingCashFlow - capex : null,
        totalAssets: num(bal?.totalAssets),
        totalDebt: longTerm + shortTerm || null,
        totalEquity: num(bal?.totalShareholderEquity),
        interestExpense: num(row.interestExpense)
      };
    })
    .sort((a, b) => a.fiscalYear - b.fiscalYear);
}

function parseNews(json: Json | null, symbol: string): NewsItem[] {
  const feed = (json?.feed as Json[] | undefined) ?? [];

  return feed.slice(0, 8).map((item, i) => {
    // Per-ticker sentiment is more useful than the article-wide score.
    const tickerRow = ((item.ticker_sentiment as Json[] | undefined) ?? []).find(
      (t) => String(t.ticker).toUpperCase() === symbol
    );
    const score = num(tickerRow?.ticker_sentiment_score) ?? num(item.overall_sentiment_score) ?? 0;
    const sentiment: NewsSentiment = score > 0.15 ? 'positive' : score < -0.15 ? 'negative' : 'neutral';

    const raw = String(item.time_published ?? '');
    const publishedAt = /^\d{8}T\d{6}$/.test(raw)
      ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(9, 11)}:${raw.slice(11, 13)}:${raw.slice(13, 15)}Z`
      : raw;

    return {
      id: `${symbol}-av-${i}`,
      headline: String(item.title ?? 'Untitled'),
      summary: String(item.summary ?? ''),
      url: String(item.url ?? ''),
      publication: String(item.source ?? 'unknown'),
      publishedAt,
      sentiment,
      sentimentScore: score
    };
  });
}

function parseConsensus(overview: Json, symbol: string): AnalystConsensus | null {
  const distribution: RatingDistribution = {
    strongBuy: num(overview.AnalystRatingStrongBuy) ?? 0,
    buy: num(overview.AnalystRatingBuy) ?? 0,
    hold: num(overview.AnalystRatingHold) ?? 0,
    sell: num(overview.AnalystRatingSell) ?? 0,
    strongSell: num(overview.AnalystRatingStrongSell) ?? 0
  };

  const analystCount = Object.values(distribution).reduce((a, b) => a + b, 0);
  if (!analystCount) return null;

  const score = consensusScoreOf(distribution);
  return {
    symbol,
    distribution,
    analystCount,
    consensusScore: score,
    consensusLabel: consensusLabelOf(score),
    asOf: String(overview.LatestQuarter ?? ''),
    // The free tier exposes only the current snapshot, so there is no history
    // to plot. The UI states this rather than faking a trend line.
    trend: [],
    recentActions: []
  };
}

export function createAlphaVantageProvider(apiKey: string): StockDataProvider {
  return {
    id: 'alpha-vantage',
    label: 'Alpha Vantage',
    freshness: 'end-of-day',
    isMock: false,
    supports: () => true,

    async getDossier(rawSymbol) {
      const symbol = rawSymbol.toUpperCase();

      const [overview, daily] = await Promise.all([
        call('OVERVIEW', { symbol }, apiKey),
        call('TIME_SERIES_DAILY', { symbol, outputsize: 'full' }, apiKey)
      ]);

      if (!overview.Symbol) {
        throw new DataError('unsupported-ticker', `Alpha Vantage does not cover "${symbol}".`);
      }

      // Everything below is best-effort: a missing statement should degrade one
      // section, not fail the whole page.
      const [income, balance, cash, earnings, news, benchmark] = await Promise.allSettled([
        call('INCOME_STATEMENT', { symbol }, apiKey),
        call('BALANCE_SHEET', { symbol }, apiKey),
        call('CASH_FLOW', { symbol }, apiKey),
        call('EARNINGS', { symbol }, apiKey),
        call('NEWS_SENTIMENT', { tickers: symbol, limit: '20' }, apiKey),
        call('TIME_SERIES_DAILY', { symbol: BENCHMARK_SYMBOL, outputsize: 'full' }, apiKey)
      ]);
      const settled = (r: PromiseSettledResult<Json>) => (r.status === 'fulfilled' ? r.value : null);

      const bars = parseDailySeries(daily, symbol);
      const annual = parseStatements(settled(income), settled(balance), settled(cash));
      const price = bars[bars.length - 1]?.close ?? 0;
      const previousClose = bars[bars.length - 2]?.close ?? price;

      const latestFcf = annual[annual.length - 1]?.freeCashFlow ?? null;
      const marketCap = num(overview.MarketCapitalization);

      const totalDebt = annual[annual.length - 1]?.totalDebt ?? null;
      const totalEquity = annual[annual.length - 1]?.totalEquity ?? null;
      const operatingIncome = annual[annual.length - 1]?.operatingIncome ?? null;
      const interestExpense = annual[annual.length - 1]?.interestExpense ?? null;

      const sector = overview.Sector ? String(overview.Sector) : null;
      const peerSymbols = PEER_MAP[symbol] ?? [];

      const earningsRows = ((settled(earnings)?.quarterlyEarnings as Json[] | undefined) ?? []).slice(0, 8);
      const benchmarkBars = settled(benchmark) ? parseDailySeries(settled(benchmark) as Json, BENCHMARK_SYMBOL) : [];

      return {
        source: {
          provider: 'Alpha Vantage',
          fetchedAt: new Date().toISOString(),
          freshness: 'end-of-day',
          isMock: false
        },
        profile: {
          symbol,
          name: String(overview.Name ?? symbol),
          exchange: String(overview.Exchange ?? ''),
          currency: String(overview.Currency ?? 'USD'),
          country: overview.Country ? String(overview.Country) : null,
          sector: sector ? sector.charAt(0) + sector.slice(1).toLowerCase() : null,
          industry: overview.Industry ? String(overview.Industry) : null,
          description: String(overview.Description ?? ''),
          website: overview.OfficialSite ? String(overview.OfficialSite) : null,
          logoUrl: null,
          sharesOutstanding: num(overview.SharesOutstanding),
          marketCap,
          beta: num(overview.Beta),
          fiscalYearEnd: overview.FiscalYearEnd ? String(overview.FiscalYearEnd) : null
        },
        quote: {
          symbol,
          price,
          change: price - previousClose,
          changePercent: previousClose ? ((price - previousClose) / previousClose) * 100 : 0,
          previousClose,
          open: bars[bars.length - 1]?.open ?? null,
          dayHigh: bars[bars.length - 1]?.high ?? null,
          dayLow: bars[bars.length - 1]?.low ?? null,
          volume: bars[bars.length - 1]?.volume ?? null,
          week52High: num(overview['52WeekHigh']),
          week52Low: num(overview['52WeekLow']),
          asOf: bars[bars.length - 1]?.date ?? ''
        },
        prices: { symbol, bars },
        benchmark: { symbol: 'S&P 500 (SPY)', bars: benchmarkBars },
        statements: { symbol, annual, quarterly: [] },
        ratios: {
          symbol,
          trailingPE: positive(overview.TrailingPE ?? overview.PERatio),
          forwardPE: positive(overview.ForwardPE),
          pegRatio: positive(overview.PEGRatio),
          priceToSales: positive(overview.PriceToSalesRatioTTM),
          priceToBook: positive(overview.PriceToBookRatio),
          evToEbitda: positive(overview.EVToEBITDA),
          evToRevenue: positive(overview.EVToRevenue),
          freeCashFlowYield: latestFcf !== null && marketCap ? latestFcf / marketCap : null,
          grossMargin:
            num(overview.GrossProfitTTM) !== null && num(overview.RevenueTTM)
              ? (num(overview.GrossProfitTTM) as number) / (num(overview.RevenueTTM) as number)
              : null,
          operatingMargin: num(overview.OperatingMarginTTM),
          profitMargin: num(overview.ProfitMargin),
          returnOnEquity: num(overview.ReturnOnEquityTTM),
          returnOnAssets: num(overview.ReturnOnAssetsTTM),
          returnOnInvestedCapital: null,
          debtToEquity: totalDebt !== null && totalEquity ? totalDebt / totalEquity : null,
          interestCoverage:
            operatingIncome !== null && interestExpense ? operatingIncome / Math.abs(interestExpense) : null,
          currentRatio: null,
          revenueGrowthYoY: num(overview.QuarterlyRevenueGrowthYOY),
          earningsGrowthYoY: num(overview.QuarterlyEarningsGrowthYOY),
          revenueCagr3y:
            annual.length >= 4 && annual[annual.length - 4].revenue && annual[annual.length - 1].revenue
              ? Math.pow(
                  (annual[annual.length - 1].revenue as number) / (annual[annual.length - 4].revenue as number),
                  1 / 3
                ) - 1
              : null
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
          // Peer metrics need one OVERVIEW call each, which the 25/day free
          // budget cannot absorb. Names are listed; the comparison table shows
          // an explicit empty state until a higher-volume key is configured.
          peers: peerSymbols.map((peer) => ({
            symbol: peer,
            name: peer,
            marketCap: null,
            revenueGrowthYoY: null,
            operatingMargin: null,
            returnOnEquity: null,
            trailingPE: null,
            evToEbitda: null,
            debtToEquity: null,
            oneYearReturn: null
          }))
        },
        consensus: parseConsensus(overview, symbol),
        priceTargets: num(overview.AnalystTargetPrice)
          ? {
              symbol,
              average: num(overview.AnalystTargetPrice),
              // The free tier publishes a single target, so median, high and
              // low are unavailable rather than guessed.
              median: num(overview.AnalystTargetPrice),
              high: null,
              low: null,
              analystCount: 0,
              asOf: String(overview.LatestQuarter ?? '')
            }
          : null,
        estimates: null,
        news: parseNews(settled(news), symbol),
        catalysts: [],
        earnings: {
          symbol,
          events: earningsRows.map((row) => ({
            fiscalPeriod: String(row.fiscalDateEnding ?? ''),
            date: String(row.reportedDate ?? row.fiscalDateEnding ?? ''),
            epsEstimate: num(row.estimatedEPS),
            epsActual: num(row.reportedEPS),
            isFuture: false
          })),
          nextEarningsDate: null
        }
      };
    }
  };
}
