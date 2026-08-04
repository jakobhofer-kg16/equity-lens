/**
 * Runtime API key store.
 *
 * Keys are typed into the app at run time and kept in this browser only. None
 * is ever committed, and the repo carries no key material — which is what makes
 * the deployed page safe to share. Build-time `VITE_` variables still work as a
 * fallback for local development, but they are compiled into the bundle and are
 * therefore public; the panel is the better route.
 */

const STORAGE_KEY = 'equity-lens.api-keys.v1';

export interface ApiKeys {
  finnhub: string;
  alphaVantage: string;
  twelveData: string;
  newsData: string;
  openRouter: string;
}

export type ApiKeyName = keyof ApiKeys;

const EMPTY: ApiKeys = { finnhub: '', alphaVantage: '', twelveData: '', newsData: '', openRouter: '' };

export interface ProviderDescriptor {
  name: ApiKeyName;
  label: string;
  envName: string;
  signupUrl: string;
  /** What breaks without it. */
  powers: string;
  required: boolean;
}

export const PROVIDERS: ProviderDescriptor[] = [
  {
    name: 'finnhub',
    label: 'Finnhub',
    envName: 'FINNHUB_API_KEY',
    signupUrl: 'https://finnhub.io/register',
    powers:
      'The main key. Profile and logo, 133 ratios with several years of history, a real peer set, and the analyst rating distribution month by month. 60 requests per minute on the free plan.',
    required: true
  },
  {
    name: 'alphaVantage',
    label: 'Alpha Vantage',
    envName: 'ALPHAVANTAGE_API_KEY',
    signupUrl: 'https://www.alphavantage.co/support/#api-key',
    powers:
      'Adds the consensus price target, which Finnhub keeps behind a paid plan. Used for one request per company, because the free key allows only 25 per day.',
    required: false
  },
  {
    name: 'twelveData',
    label: 'Twelve Data',
    envName: 'TWELVE_DATA_API',
    signupUrl: 'https://twelvedata.com/pricing',
    powers:
      'Daily price history for the candlestick chart. Optional: Alpha Vantage already supplies prices, but Twelve Data allows more requests per day.',
    required: false
  },
  {
    name: 'newsData',
    label: 'newsdata.io',
    envName: 'NEWS_DATA_IO_API_KEY',
    signupUrl: 'https://newsdata.io/',
    powers: 'Live headlines in the news section. Without it the section shows sample or Alpha Vantage coverage.',
    required: false
  },
  {
    name: 'openRouter',
    label: 'OpenRouter',
    envName: 'OPENROUTER_API_KEY',
    signupUrl: 'https://openrouter.ai/',
    powers: 'Writes a narrative summary of your investment thesis. Everything else works without it.',
    required: false
  }
];

function fromEnv(): ApiKeys {
  return {
    finnhub: (import.meta.env.VITE_FINNHUB_KEY as string) ?? '',
    alphaVantage: (import.meta.env.VITE_ALPHAVANTAGE_KEY as string) ?? '',
    twelveData: (import.meta.env.VITE_TWELVEDATA_KEY as string) ?? '',
    newsData: (import.meta.env.VITE_NEWSDATA_KEY as string) ?? '',
    openRouter: (import.meta.env.VITE_OPENROUTER_KEY as string) ?? ''
  };
}

function read(): ApiKeys {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const stored = raw ? (JSON.parse(raw) as Partial<ApiKeys>) : {};
    const env = fromEnv();
    // A key typed into the panel wins over the build-time variable.
    return {
      finnhub: stored.finnhub || env.finnhub,
      alphaVantage: stored.alphaVantage || env.alphaVantage,
      twelveData: stored.twelveData || env.twelveData,
      newsData: stored.newsData || env.newsData,
      openRouter: stored.openRouter || env.openRouter
    };
  } catch {
    return fromEnv();
  }
}

let current: ApiKeys = read();
const listeners = new Set<(keys: ApiKeys) => void>();

export function getKeys(): ApiKeys {
  return current;
}

export function setKeys(next: Partial<ApiKeys>): ApiKeys {
  current = { ...current, ...next };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* storage blocked — keys stay for this page load only */
  }
  listeners.forEach((listener) => listener(current));
  return current;
}

export function clearKeys(): void {
  current = { ...EMPTY };
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
  listeners.forEach((listener) => listener(current));
}

export function subscribeKeys(listener: (keys: ApiKeys) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Masks a key for display: never render the raw value back to the page. */
export function maskKey(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '•'.repeat(value.length);
  return `${value.slice(0, 4)}${'•'.repeat(Math.min(value.length - 8, 20))}${value.slice(-4)}`;
}
