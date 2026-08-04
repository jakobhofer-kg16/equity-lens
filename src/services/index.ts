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
import { createAlphaVantageProvider } from './providers/alphaVantage';
import { fetchTwelveDataPrices } from './providers/twelveData';
import { fetchNewsDataHeadlines } from './providers/newsData';
import { getKeys } from './keys';
import { SUPPORTED_MOCK_SYMBOLS } from '../data/mockSeeds';

const CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
  at: number;
  keySignature: string;
  value: CompanyDossier;
}

const cache = new Map<string, CacheEntry>();
/** In-flight requests, so a double click cannot fire the same call twice. */
const inFlight = new Map<string, Promise<CompanyDossier>>();

export function providerStatus() {
  const keys = getKeys();
  return {
    isMock: !keys.alphaVantage,
    label: keys.alphaVantage ? 'Alpha Vantage' : 'Bundled sample data',
    freshness: 'end-of-day' as const,
    sampleSymbols: SUPPORTED_MOCK_SYMBOLS,
    configured: {
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
  return [keys.alphaVantage, keys.twelveData, keys.newsData].map((k) => (k ? '1' : '0')).join('');
}

export function invalidateCache(): void {
  cache.clear();
}

async function assemble(symbol: string): Promise<CompanyDossier> {
  const keys = getKeys();
  const base = keys.alphaVantage ? createAlphaVantageProvider(keys.alphaVantage) : mockProvider;

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

  if (keys.twelveData) {
    try {
      dossier = { ...dossier, prices: await fetchTwelveDataPrices(symbol, keys.twelveData) };
      dossier.source.notes.push('Price history from Twelve Data.');
    } catch (err) {
      dossier.source.notes.push(`Twelve Data prices unavailable: ${(err as Error).message}`);
    }
  }

  if (keys.newsData) {
    try {
      const news = await fetchNewsDataHeadlines(symbol, dossier.profile.name, keys.newsData);
      dossier = { ...dossier, news };
      dossier.source.notes.push('Headlines from newsdata.io.');
    } catch (err) {
      dossier.source.notes.push(`newsdata.io headlines unavailable: ${(err as Error).message}`);
    }
  }

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
  return value;
}
