import { useCallback, useEffect, useState } from 'react';

/**
 * Browser-local watchlist. No account, no database — the first version keeps
 * everything in localStorage, which also means it survives a refresh but not a
 * different browser. Stated as a limitation in the README.
 */

const STORAGE_KEY = 'stock-analyzer.watchlist.v1';

export interface WatchlistEntry {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  modelScore: number;
  classification: string;
  consensusLabel: string | null;
  impliedUpside: number | null;
  nextEarningsDate: string | null;
  addedAt: string;
}

function read(): WatchlistEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // A corrupted or blocked store should not take the page down.
    return [];
  }
}

export function useWatchlist() {
  const [entries, setEntries] = useState<WatchlistEntry[]>(read);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      /* storage disabled — the list simply will not persist */
    }
  }, [entries]);

  const add = useCallback((entry: WatchlistEntry) => {
    setEntries((prev) => [entry, ...prev.filter((e) => e.symbol !== entry.symbol)]);
  }, []);

  const remove = useCallback((symbol: string) => {
    setEntries((prev) => prev.filter((e) => e.symbol !== symbol));
  }, []);

  const has = useCallback((symbol: string) => entries.some((e) => e.symbol === symbol), [entries]);

  return { entries, add, remove, has };
}
