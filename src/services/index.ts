/**
 * Service facade.
 *
 * Components call `loadDossier` and never touch a provider directly. A dossier
 * is assembled in layers: Finnhub supplies the record, then each additional
 * key replaces the slice it is better at. Nothing here is invented — with no
 * Finnhub key the facade refuses rather than substituting sample data.
 */

import { DataError, type CompanyDossier } from '../types';
import { createFinnhubProvider } from './providers/finnhub';
import { fetchAlphaVantageDaily, fetchAlphaVantagePriceTarget, ALPHA_VANTAGE_DAILY_BARS } from './providers/alphaVantage';
import { fetchTwelveDataPrices } from './providers/twelveData';
import { fetchNewsDataHeadlines } from './providers/newsData';
import { getKeys } from './keys';

/** Dossiers are persisted so a refresh does not re-spend request budgets. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_STORAGE_KEY = 'equity-lens.dossier-cache.v2';
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

const cache = readCache();
const inFlight = new Map<string, Promise<CompanyDossier>>();

function persistCache(): void {
  try {
    const entries = [...cache.entries()].sort((a, b) => b[1].at - a[1].at).slice(0, MAX_CACHED_SYMBOLS);
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Quota exceeded or storage blocked: the in-memory cache still works.
  }
}

export function providerStatus() {
  const keys = getKeys();
  return {
    ready: Boolean(keys.finnhub),
    label: keys.finnhub ? 'Finnhub' : 'No data provider configured',
    freshness: 'delayed' as const,
    configured: {
      finnhub: Boolean(keys.finnhub),
      alphaVantage: Boolean(keys.alphaVantage),
      twelveData: Boolean(keys.twelveData),
      newsData: Boolean(keys.newsData),
      openRouter: Boolean(keys.openRouter)
    }
  };
}

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

export function cachedSymbols(): string[] {
  const signature = signatureOf();
  return [...cache.entries()]
    .filter(([, e]) => e.keySignature === signature && Date.now() - e.at < CACHE_TTL_MS)
    .sort((a, b) => b[1].at - a[1].at)
    .map(([symbol]) => symbol);
}

async function assemble(symbol: string): Promise<CompanyDossier> {
  const keys = getKeys();
  if (!keys.finnhub) {
    throw new DataError('no-api-key', 'A Finnhub key is required. Add one under API keys — the free plan is enough.');
  }
  const notes: string[] = [];

  // Price history first, because Finnhub does not carry it on the free plan.
  let prices: CompanyDossier['prices'] | null = null;
  let benchmark: CompanyDossier['benchmark'] | null = null;

  if (keys.twelveData) {
    try {
      const [main, bench] = await Promise.all([
        fetchTwelveDataPrices(symbol, keys.twelveData),
        fetchTwelveDataPrices(BENCHMARK_SYMBOL, keys.twelveData).catch(() => null)
      ]);
      prices = main;
      benchmark = bench ? { ...bench, symbol: 'S&P 500 (SPY)' } : null;
      notes.push(
        `Price history from Twelve Data: ${main.bars.length} daily bars (about ${Math.round((main.bars.length / 252) * 10) / 10} years).`
      );
    } catch (err) {
      notes.push(`Twelve Data prices unavailable: ${(err as Error).message}`);
    }
  }

  let dossier = await createFinnhubProvider(keys.finnhub).getDossier(symbol);

  if (!prices && keys.alphaVantage) {
    try {
      const fallback = await fetchAlphaVantageDaily(symbol, keys.alphaVantage);
      prices = fallback.prices;
      benchmark = fallback.benchmark;
      notes.push(
        `Price history from Alpha Vantage: ${fallback.prices.bars.length} daily bars — its free plan stops at ${ALPHA_VANTAGE_DAILY_BARS}. A Twelve Data key gives several years.`
      );
    } catch (err) {
      notes.push(`Alpha Vantage prices unavailable: ${(err as Error).message}`);
    }
  }

  if (prices) {
    dossier = { ...dossier, prices, benchmark: benchmark ?? dossier.benchmark };
  } else {
    notes.push('No price history: Finnhub keeps it behind a paid plan. Add a Twelve Data key (free, multi-year) to fill the chart.');
  }

  if (keys.alphaVantage) {
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
    } catch (err) {
      notes.push(`Alpha Vantage price target unavailable: ${(err as Error).message}`);
    }
  }

  if (keys.newsData) {
    try {
      const news = await fetchNewsDataHeadlines(symbol, dossier.profile.name, keys.newsData);
      dossier = { ...dossier, news };
      notes.push('Headlines from newsdata.io.');
    } catch (err) {
      notes.push(`newsdata.io headlines unavailable, keeping Finnhub coverage: ${(err as Error).message}`);
    }
  }

  dossier.source.notes = [...dossier.source.notes, ...notes];
  return dossier;
}

export async function loadDossier(rawSymbol: string, options: { force?: boolean } = {}): Promise<CompanyDossier> {
  const symbol = rawSymbol.trim().toUpperCase();
  if (!/^[A-Z][A-Z.-]{0,6}$/.test(symbol)) {
    throw new DataError('unsupported-ticker', `"${rawSymbol}" is not a valid US ticker symbol.`);
  }

  const signature = signatureOf();
  const hit = cache.get(symbol);
  if (!options.force && hit && hit.keySignature === signature && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const pending = inFlight.get(symbol);
  if (pending) return pending;

  const request = assemble(symbol).finally(() => inFlight.delete(symbol));
  inFlight.set(symbol, request);

  const value = await request;
  cache.set(symbol, { at: Date.now(), keySignature: signature, value });
  persistCache();
  return value;
}
