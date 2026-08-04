/**
 * Service facade.
 *
 * Components call `loadDossier` and never touch a provider directly, so
 * swapping the sample data for a live feed is a one-line change here.
 */

import { DataError, type CompanyDossier, type StockDataProvider } from '../types';
import { mockProvider } from './providers/mock';
import { createAlphaVantageProvider } from './providers/alphaVantage';
import { SUPPORTED_MOCK_SYMBOLS } from '../data/mockSeeds';

const CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
  at: number;
  value: CompanyDossier;
}

const cache = new Map<string, CacheEntry>();
/** In-flight requests, so a double click cannot fire the same call twice. */
const inFlight = new Map<string, Promise<CompanyDossier>>();

/**
 * `VITE_` variables are inlined into the bundle at build time and are therefore
 * public. This is acceptable only for a local demo key. For anything shared,
 * point VITE_API_PROXY_URL at a serverless function that holds the real key —
 * see the README.
 */
const apiKey = import.meta.env.VITE_ALPHAVANTAGE_KEY as string | undefined;
const proxyUrl = import.meta.env.VITE_API_PROXY_URL as string | undefined;

export const liveProvider: StockDataProvider | null = apiKey
  ? createAlphaVantageProvider(apiKey)
  : null;

export const activeProvider: StockDataProvider = liveProvider ?? mockProvider;

export const providerStatus = {
  id: activeProvider.id,
  label: activeProvider.label,
  isMock: activeProvider.isMock,
  freshness: activeProvider.freshness,
  usesProxy: Boolean(proxyUrl),
  sampleSymbols: SUPPORTED_MOCK_SYMBOLS
};

export function cachedSymbols(): string[] {
  return [...cache.keys()];
}

export async function loadDossier(rawSymbol: string, options: { force?: boolean } = {}): Promise<CompanyDossier> {
  const symbol = rawSymbol.trim().toUpperCase();
  if (!/^[A-Z][A-Z.-]{0,6}$/.test(symbol)) {
    throw new DataError('unsupported-ticker', `"${rawSymbol}" is not a valid US ticker symbol.`);
  }

  const hit = cache.get(symbol);
  if (!options.force && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const pending = inFlight.get(symbol);
  if (pending) return pending;

  const request = (async () => {
    try {
      return await activeProvider.getDossier(symbol);
    } catch (err) {
      // With a live key configured, fall back to sample data rather than
      // leaving the page empty — but only when we actually have a sample for
      // this ticker, and the UI still says the data is sample data.
      if (activeProvider !== mockProvider && mockProvider.supports(symbol)) {
        const reason = err instanceof DataError ? err.kind : 'provider-error';
        if (reason === 'rate-limited' || reason === 'network') return mockProvider.getDossier(symbol);
      }
      throw err;
    } finally {
      inFlight.delete(symbol);
    }
  })();

  inFlight.set(symbol, request);
  const value = await request;
  cache.set(symbol, { at: Date.now(), value });
  return value;
}
