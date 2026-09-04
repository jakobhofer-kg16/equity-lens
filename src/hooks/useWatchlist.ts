import { useCallback, useEffect, useState } from 'react';

/**
 * Browser-local watchlist that remembers what a company looked like when you
 * added it, so opening the list shows what has changed since — the score, the
 * category that moved it, and whether the analyst consensus shifted.
 *
 * No account, no database: localStorage, so it survives a refresh but not a
 * different browser. Stated as a limitation in the README.
 */

const STORAGE_KEY = 'stock-analyzer.watchlist.v2';

export interface WatchlistSnapshot {
  price: number;
  changePercent: number;
  modelScore: number;
  classification: string;
  categories: Record<string, number | null>;
  consensusLabel: string | null;
  consensusScore: number | null;
  impliedUpside: number | null;
  nextEarningsDate: string | null;
  takenAt: string;
}

export interface WatchlistEntry {
  symbol: string;
  name: string;
  /** What it looked like when added. Never overwritten. */
  added: WatchlistSnapshot;
  /** Most recent refresh, or null until the list has been refreshed once. */
  latest: WatchlistSnapshot | null;
}

function read(): WatchlistEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useWatchlist() {
  const [entries, setEntries] = useState<WatchlistEntry[]>(read);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      /* storage disabled — the list will not persist */
    }
  }, [entries]);

  const add = useCallback((symbol: string, name: string, snapshot: WatchlistSnapshot) => {
    setEntries((prev) => [{ symbol, name, added: snapshot, latest: snapshot }, ...prev.filter((e) => e.symbol !== symbol)]);
  }, []);

  const refresh = useCallback((symbol: string, snapshot: WatchlistSnapshot) => {
    setEntries((prev) => prev.map((e) => (e.symbol === symbol ? { ...e, latest: snapshot } : e)));
  }, []);

  const remove = useCallback((symbol: string) => {
    setEntries((prev) => prev.filter((e) => e.symbol !== symbol));
  }, []);

  const has = useCallback((symbol: string) => entries.some((e) => e.symbol === symbol), [entries]);

  return { entries, add, refresh, remove, has };
}

/** The category whose score moved the most between two snapshots. */
export function biggestMover(from: WatchlistSnapshot, to: WatchlistSnapshot): { key: string; delta: number } | null {
  let best: { key: string; delta: number } | null = null;
  for (const key of Object.keys(to.categories)) {
    const a = from.categories[key];
    const b = to.categories[key];
    if (a === null || a === undefined || b === null || b === undefined) continue;
    const delta = b - a;
    if (!best || Math.abs(delta) > Math.abs(best.delta)) best = { key, delta };
  }
  return best;
}
