/**
 * Service facade.
 *
 * Components call `loadDossier` and never touch a provider directly. A dossier
 * is assembled in layers: a base provider supplies the full record, then any
 * additional key the user has entered replaces the slice it is better at. Each
 * layer is optional and each failure is recorded rather than thrown, so one
 * missing key degrades one section instead of the page.
 */

import { DataError, type CompanyDossier } from '../types';
import { mockProvider } from './providers/mock';
import {
  createAlphaVantageProvider,
  fetchAlphaVantageDaily,
  SHORT_HISTORY_NOTE
} from './providers/alphaVantage';
import { createFinnhubProvider, fetchAlphaVantagePriceTarget } from './providers/finnhub';
import { fetchTwelveDataPrices } from './providers/twelveData';
import { fetchNewsDataHeadlines } from './providers/newsData';
import { getKeys } from './keys';
import { SUPPORTED_MOCK_SYMBOLS } from '../data/mockSeeds';

/**
 * A free Alpha Vantage key allows 25 requests a day and one dossier costs
 * several, so the cache is persisted. Without it a page refresh would silently
 * spend another chunk of the daily budget on data already fetched.
 */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_STORAGE_KEY = 'equity-lens.dossier-cache.v1';
const MAX_CACHED_SYMBOLS = 8;
const BENCHMARK_SYMBOL = 'SPY';

interface CacheEntry {
  at: number;
  keySignature: string;
  value: CompanyDossier;
}

function readCache(): Map<string, CacheEntry> {
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return new Map();
    const entries = JSON.parse(raw) as Array<[string, CacheEntry]>;
    return new Map(entries.filter(([, entry]) => Date.now() - entry.at < CACHE_TTL_MS));
  } catch {
    return new Map();
  }
}

function persistCache(): void {
  try {
    // Newest first, so the trim keeps what was looked at most recently.
    const entries = [...cache.entries()].sort((a, b) => b[1].at - a[1].at).slice(0, MAX_CACHED_SYMBOLS);
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Quota exceeded or storage blocked: the in-memory cache still works for
    // this page load, which is the case that matters most.
  }
}

const cache = readCache();
/** In-flight requests, so a double click cannot fire the same call twice. */
const inFlight = new Map<string, Promise<CompanyDossier>>();

export function providerStatus() {
  const keys = getKeys();
  const label = keys.finnhub ? 'Finnhub' : keys.alphaVantage ? 'Alpha Vantage' : 'Bundled sample data';
  return {
    isMock: !keys.finnhub && !keys.alphaVantage,
    label,
    freshness: (keys.finnhub ? 'delayed' : 'end-of-day') as 'delayed' | 'end-of-day',
    sampleSymbols: SUPPORTED_MOCK_SYMBOLS,
    configured: {
      finnhub: Boolean(keys.finnhub),
      alphaVantage: Boolean(keys.alphaVantage),
      twelveData: Boolean(keys.twelveData),
      newsData: Boolean(keys.newsData),
      openRouter: Boolean(keys.openRouter)
    }
  };
}

/** Cache entries are per key set, so entering a key refreshes the view. */
function signatureOf(): string {
  const keys = getKeys();
  return [keys.finnhub, keys.alphaVantage, keys.twelveData, keys.newsData].map((k) => (k ? '1' : '0')).join('');
}

export function invalidateCache(): void {
  cache.clear();
  try {
    localStorage.removeItem(CACHE_STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** Symbols that can be reopened without spending any request budget. */
export function cachedSymbols(): string[] {
  const signature = signatureOf();
  return [...cache.entries()]
    .filter(([, entry]) => entry.keySignature === signature && Date.now() - entry.at < CACHE_TTL_MS)
    .sort((a, b) => b[1].at - a[1].at)
    .map(([symbol]) => symbol);
}

async function assemble(symbol: string): Promise<CompanyDossier> {
  const keys = getKeys();
  const notes: string[] = [];

  // The optional providers run FIRST, because whether they succeed decides what
  // the base provider still has to fetch. Deciding to skip an Alpha Vantage
  // request before knowing that its replacement worked leaves the page with
  // neither — the skip has to be earned, not assumed.
  let prices: Awaited<ReturnType<typeof fetchTwelveDataPrices>> | null = null;
  let benchmark: Awaited<ReturnType<typeof fetchTwelveDataPrices>> | null = null;

  if (keys.twelveData) {
    try {
      const [main, bench] = await Promise.all([
        fetchTwelveDataPrices(symbol, keys.twelveData),
        // The benchmark must come from the same source, otherwise the indexed
        // comparison runs a multi-year series against a much shorter one.
        fetchTwelveDataPrices(BENCHMARK_SYMBOL, keys.twelveData).catch(() => null)
      ]);
      prices = main;
      benchmark = bench;
      const years = Math.round((main.bars.length / 252) * 10) / 10;
      notes.push(
        `Price history from Twelve Data: ${main.bars.length} daily bars (about ${years} years). The one-year return and the 200-day average are computed from this series.`
      );
      if (!bench) notes.push('Benchmark series unavailable from Twelve Data, falling back to the base provider.');
    } catch (err) {
      notes.push(`Twelve Data prices unavailable, falling back to the base provider: ${(err as Error).message}`);
    }
  }

  let news: Awaited<ReturnType<typeof fetchNewsDataHeadlines>> | null = null;
  let newsPending = false;
  if (keys.newsData) {
    // The company name is only known after the base provider answers, so the
    // headline call is deferred; the base provider must still fetch its own.
    newsPending = true;
  }

  // Finnhub first: 60 requests a minute against Alpha Vantage's 25 a day, and
  // it carries the ratio history, the real peer set and the rating trend.
  const base = keys.finnhub
    ? createFinnhubProvider(keys.finnhub)
    : keys.alphaVantage
      ? createAlphaVantageProvider(keys.alphaVantage, { skipPrices: Boolean(prices), skipNews: false })
      : mockProvider;

  let dossier: CompanyDossier;
  try {
    dossier = await base.getDossier(symbol);
  } catch (err) {
    // With a live key configured, fall back to sample data rather than leaving
    // the page empty — but only where a sample exists, and the UI still says so.
    const kind = err instanceof DataError ? err.kind : 'provider-error';
    if (base !== mockProvider && mockProvider.supports(symbol) && (kind === 'rate-limited' || kind === 'network')) {
      dossier = await mockProvider.getDossier(symbol);
      dossier.source.notes.push(`Alpha Vantage unavailable (${kind}), showing sample data instead.`);
    } else {
      throw err;
    }
  }

  if (prices) {
    // A longer series supersedes the base provider's short-history warning;
    // two contradictory notes are worse than none.
    dossier.source.notes = dossier.source.notes.filter((note) => !note.startsWith(SHORT_HISTORY_NOTE));
    dossier = {
      ...dossier,
      prices,
      benchmark: benchmark ? { ...benchmark, symbol: 'S&P 500 (SPY)' } : dossier.benchmark
    };
  }

  // Finnhub has no price history on the free plan, so if Twelve Data did not
  // cover it, Alpha Vantage is the last resort before the chart goes empty.
  if (keys.finnhub && !prices && keys.alphaVantage && !dossier.prices.bars.length) {
    try {
      const fallback = await fetchAlphaVantageDaily(symbol, keys.alphaVantage);
      dossier = {
        ...dossier,
        prices: fallback.prices,
        benchmark: fallback.benchmark ?? dossier.benchmark
      };
      notes.push(
        `Price history from Alpha Vantage: ${fallback.bars} daily bars. Finnhub keeps prices behind a paid plan; a Twelve Data key gives several years instead.`
      );
    } catch (err) {
      notes.push(`Price history unavailable: ${(err as Error).message}`);
    }
  }

  if (keys.finnhub && !dossier.prices.bars.length) {
    notes.push(
      'No price history: Finnhub keeps it behind a paid plan. Add a Twelve Data key (free, multi-year) to fill the chart.'
    );
  }

  // Finnhub keeps price targets behind a paid plan, but Alpha Vantage publishes
  // one for free. Worth exactly one request out of the 25 daily budget.
  if (keys.finnhub && keys.alphaVantage && !dossier.priceTargets) {
    try {
      const target = await fetchAlphaVantagePriceTarget(symbol, keys.alphaVantage);
      if (target) {
        dossier = {
          ...dossier,
          priceTargets: {
            symbol,
            average: target.average,
            median: target.average,
            high: null,
            low: null,
            analystCount: dossier.consensus?.analystCount ?? 0,
            asOf: target.asOf
          }
        };
        notes.push('Consensus price target from Alpha Vantage (one request).');
      }
    } catch {
      notes.push('Alpha Vantage price target unavailable.');
    }
  }

  if (newsPending) {
    try {
      news = await fetchNewsDataHeadlines(symbol, dossier.profile.name, keys.newsData);
      dossier = { ...dossier, news };
      notes.push('Headlines from newsdata.io.');
    } catch (err) {
      notes.push(`newsdata.io headlines unavailable, keeping the base provider's: ${(err as Error).message}`);
    }
  }

  dossier.source.notes = [...dossier.source.notes, ...notes].map((note) =>
    note.replace(SHORT_HISTORY_NOTE, '')
  );
  return dossier;
}

export async function loadDossier(rawSymbol: string, options: { force?: boolean } = {}): Promise<CompanyDossier> {
  const symbol = rawSymbol.trim().toUpperCase();
  if (!/^[A-Z][A-Z.-]{0,6}$/.test(symbol)) {
    throw new DataError('unsupported-ticker', `"${rawSymbol}" is not a valid US ticker symbol.`);
  }

  const signature = signatureOf();
  const hit = cache.get(symbol);
  if (!options.force && hit && hit.keySignature === signature && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.value;
  }

  const pending = inFlight.get(symbol);
  if (pending) return pending;

  const request = assemble(symbol).finally(() => inFlight.delete(symbol));
  inFlight.set(symbol, request);

  const value = await request;
  cache.set(symbol, { at: Date.now(), keySignature: signature, value });
  persistCache();
  return value;
}
