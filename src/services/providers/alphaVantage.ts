/**
 * Alpha Vantage — optional add-on, no longer a base provider.
 *
 * Its free key allows 25 requests a day, which is too little to build a dossier
 * from. Two things justify keeping it:
 *
 * - `AnalystTargetPrice` in `OVERVIEW`: a consensus price target that Finnhub
 *   keeps behind a paid plan. One request per company.
 * - `TIME_SERIES_DAILY` as a last resort for the chart when no Twelve Data key
 *   is configured. `outputsize=full` is premium, so this is `compact`: the most
 *   recent 100 sessions, roughly five months.
 *
 * Every call goes through a queue because the free key also refuses bursts
 * (one request per second).
 */

import { DataError, type HistoricalPrices } from '../../types';

const BASE = 'https://www.alphavantage.co/query';
const BENCHMARK_SYMBOL = 'SPY';
const MIN_REQUEST_GAP_MS = 1100;
export const ALPHA_VANTAGE_DAILY_BARS = 100;

type Json = Record<string, unknown>;

let requestChain: Promise<unknown> = Promise.resolve();

function throttle<T>(task: () => Promise<T>): Promise<T> {
  const result = requestChain.then(task, task);
  const pause = () => new Promise<void>((resolve) => setTimeout(resolve, MIN_REQUEST_GAP_MS));
  requestChain = result.then(pause, pause);
  return result;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text || text === 'None' || text === '-') return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

async function call(fn: string, params: Record<string, string>, apiKey: string): Promise<Json> {
  return throttle(async () => {
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

    // Throttling and key problems arrive as HTTP 200 plus a message field.
    const note = (json.Note ?? json.Information ?? json['Error Message']) as string | undefined;
    if (note) {
      const clean = note.replace(/\s+/g, ' ').trim();
      if (/rate limit|per day|per second|frequency|sparingly/i.test(note)) {
        const daily = /per day|25 requests/i.test(note);
        throw new DataError(
          'rate-limited',
          daily ? `Alpha Vantage daily limit reached (25 requests on a free key). ${clean}` : `Alpha Vantage is throttling: ${clean}`,
          daily ? null : 5
        );
      }
      if (/premium/i.test(note)) throw new DataError('provider-error', `Alpha Vantage requires a premium plan: ${clean}`);
      if (/apikey|api key|invalid/i.test(note)) throw new DataError('no-api-key', clean);
      throw new DataError('provider-error', clean);
    }
    return json;
  });
}

function parseDailySeries(json: Json, symbol: string): HistoricalPrices {
  const series = json['Time Series (Daily)'] as Record<string, Record<string, string>> | undefined;
  if (!series) throw new DataError('unsupported-ticker', `Alpha Vantage returned no price history for ${symbol}.`);

  const bars = Object.entries(series)
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

  return { symbol, bars };
}

export async function fetchAlphaVantagePriceTarget(
  symbol: string,
  apiKey: string
): Promise<{ average: number; asOf: string } | null> {
  const json = await call('OVERVIEW', { symbol }, apiKey);
  const target = num(json.AnalystTargetPrice);
  return target ? { average: target, asOf: String(json.LatestQuarter ?? '') } : null;
}

export async function fetchAlphaVantageDaily(
  symbol: string,
  apiKey: string
): Promise<{ prices: HistoricalPrices; benchmark: HistoricalPrices | null }> {
  const prices = parseDailySeries(await call('TIME_SERIES_DAILY', { symbol, outputsize: 'compact' }, apiKey), symbol);
  let benchmark: HistoricalPrices | null = null;
  try {
    const raw = await call('TIME_SERIES_DAILY', { symbol: BENCHMARK_SYMBOL, outputsize: 'compact' }, apiKey);
    benchmark = { ...parseDailySeries(raw, BENCHMARK_SYMBOL), symbol: 'S&P 500 (SPY)' };
  } catch {
    // The benchmark is optional; the comparison toggle stays unavailable.
  }
  return { prices, benchmark };
}
