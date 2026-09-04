import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Star, Trash2, X } from 'lucide-react';
import { biggestMover, type WatchlistEntry, type WatchlistSnapshot } from '../hooks/useWatchlist';
import { EmptyState, Pill } from './ui/primitives';
import { formatCurrency, formatDate, formatPercent, formatRelative } from '../lib/format';

const CATEGORY_LABEL: Record<string, string> = {
  growth: 'growth',
  profitability: 'profitability',
  valuation: 'valuation',
  health: 'financial health',
  momentum: 'momentum'
};

function Delta({ from, to, digits = 0 }: { from: number; to: number; digits?: number }) {
  const delta = to - from;
  if (Math.abs(delta) < Math.pow(10, -digits) / 2) return <span className="text-slate-400">unchanged</span>;
  return (
    <span className={delta > 0 ? 'text-emerald-700' : 'text-red-700'}>
      {delta > 0 ? '+' : ''}
      {delta.toFixed(digits)}
    </span>
  );
}

export function WatchlistPanel({
  open,
  entries,
  onClose,
  onSelect,
  onRemove,
  onRefresh
}: {
  open: boolean;
  entries: WatchlistEntry[];
  onClose: () => void;
  onSelect: (symbol: string) => void;
  onRemove: (symbol: string) => void;
  /** Loads fresh data for one symbol and returns a snapshot, or null on failure. */
  onRefresh: (symbol: string) => Promise<WatchlistSnapshot | null>;
}) {
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const refreshedThisOpen = useRef(false);

  // Refresh sequentially when the panel opens, so a long list does not fire a
  // burst against the provider's per-minute limit.
  useEffect(() => {
    if (!open) {
      refreshedThisOpen.current = false;
      return;
    }
    if (refreshedThisOpen.current || !entries.length) return;
    refreshedThisOpen.current = true;

    let cancelled = false;
    (async () => {
      for (const entry of entries) {
        if (cancelled) break;
        setRefreshing(entry.symbol);
        await onRefresh(entry.symbol);
      }
      if (!cancelled) setRefreshing(null);
    })();
    return () => {
      cancelled = true;
    };
    // entries intentionally excluded: refreshing mutates them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30 flex justify-end" role="dialog" aria-modal="true" aria-label="Watchlist">
      <button type="button" aria-label="Close watchlist" className="flex-1 bg-slate-900/20" onClick={onClose} />
      <div className="flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Star className="h-4 w-4" aria-hidden /> Watchlist
            {refreshing ? (
              <span className="inline-flex items-center gap-1 text-xs font-normal text-slate-500">
                <RefreshCw className="h-3 w-3 animate-spin" aria-hidden /> refreshing {refreshing}
              </span>
            ) : null}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {entries.length ? (
            <ul className="space-y-2">
              {entries.map((entry) => {
                const now = entry.latest ?? entry.added;
                const mover = entry.latest ? biggestMover(entry.added, entry.latest) : null;
                const consensusMoved =
                  entry.latest?.consensusLabel && entry.latest.consensusLabel !== entry.added.consensusLabel;

                return (
                  <li key={entry.symbol} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(entry.symbol);
                          onClose();
                        }}
                        className="text-left"
                      >
                        <span className="font-semibold text-slate-900">{entry.symbol}</span>
                        <span className="ml-2 text-xs text-slate-500">{entry.name}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(entry.symbol)}
                        aria-label={`Remove ${entry.symbol}`}
                        className="rounded-md p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>

                    <p className="mt-1 text-[11px] text-slate-400">
                      Added {formatRelative(entry.added.takenAt)} at {formatCurrency(entry.added.price)}, score {entry.added.modelScore}
                    </p>

                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      <span className="text-slate-500">Price</span>
                      <span className="text-right tabular-nums text-slate-900">
                        {formatCurrency(now.price)}{' '}
                        <span className={now.price >= entry.added.price ? 'text-emerald-700' : 'text-red-700'}>
                          ({formatPercent(now.price / entry.added.price - 1, 1, true)} since added)
                        </span>
                      </span>

                      <span className="text-slate-500">Model score</span>
                      <span className="text-right tabular-nums text-slate-900">
                        {now.modelScore}/100 <Pill tone="slate">{now.classification}</Pill>{' '}
                        <Delta from={entry.added.modelScore} to={now.modelScore} />
                      </span>

                      {mover && Math.abs(mover.delta) >= 3 ? (
                        <>
                          <span className="text-slate-500">Driven by</span>
                          <span className="text-right text-slate-900">
                            {CATEGORY_LABEL[mover.key] ?? mover.key}{' '}
                            <span className={mover.delta > 0 ? 'text-emerald-700' : 'text-red-700'}>
                              {mover.delta > 0 ? '+' : ''}
                              {mover.delta}
                            </span>
                          </span>
                        </>
                      ) : null}

                      <span className="text-slate-500">Analyst consensus</span>
                      <span className="text-right text-slate-900">
                        {now.consensusLabel ?? 'n/a'}
                        {consensusMoved ? (
                          <span className="ml-1 text-amber-700">(was {entry.added.consensusLabel})</span>
                        ) : null}
                      </span>

                      <span className="text-slate-500">Implied vs target</span>
                      <span className={`text-right tabular-nums ${now.impliedUpside === null ? 'text-slate-500' : now.impliedUpside >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {now.impliedUpside === null ? 'n/a' : formatPercent(now.impliedUpside, 1, true)}
                      </span>

                      <span className="text-slate-500">Next earnings</span>
                      <span className="text-right text-slate-900">{formatDate(now.nextEarningsDate)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              title="Nothing on the watchlist yet"
              detail="Add a company from its snapshot. The list remembers the score and consensus at that moment and shows what has moved since."
            />
          )}
        </div>

        <p className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
          Stored in this browser only. Opening the list refreshes each company once, one at a time.
        </p>
      </div>
    </div>
  );
}
