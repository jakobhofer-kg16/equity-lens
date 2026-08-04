import { Star, Trash2, X } from 'lucide-react';
import type { WatchlistEntry } from '../hooks/useWatchlist';
import { EmptyState, Pill } from './ui/primitives';
import { formatCurrency, formatDate, formatPercent } from '../lib/format';

export function WatchlistPanel({
  open,
  entries,
  onClose,
  onSelect,
  onRemove
}: {
  open: boolean;
  entries: WatchlistEntry[];
  onClose: () => void;
  onSelect: (symbol: string) => void;
  onRemove: (symbol: string) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30 flex justify-end" role="dialog" aria-modal="true" aria-label="Watchlist">
      <button type="button" aria-label="Close watchlist" className="flex-1 bg-slate-900/20" onClick={onClose} />
      <div className="flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Star className="h-4 w-4" aria-hidden /> Watchlist
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {entries.length ? (
            <ul className="space-y-2">
              {entries.map((entry) => (
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

                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <span className="text-slate-500">Price</span>
                    <span className="text-right tabular-nums text-slate-900">
                      {formatCurrency(entry.price)}{' '}
                      <span className={entry.changePercent >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                        ({entry.changePercent >= 0 ? '+' : ''}
                        {entry.changePercent.toFixed(2)}%)
                      </span>
                    </span>

                    <span className="text-slate-500">Model score</span>
                    <span className="text-right tabular-nums text-slate-900">
                      {entry.modelScore}/100 <Pill tone="slate">{entry.classification}</Pill>
                    </span>

                    <span className="text-slate-500">Analyst consensus</span>
                    <span className="text-right text-slate-900">{entry.consensusLabel ?? 'n/a'}</span>

                    <span className="text-slate-500">Implied vs median target</span>
                    <span
                      className={`text-right tabular-nums ${entry.impliedUpside === null ? 'text-slate-500' : entry.impliedUpside >= 0 ? 'text-emerald-700' : 'text-red-700'}`}
                    >
                      {entry.impliedUpside === null ? 'n/a' : formatPercent(entry.impliedUpside, 1, true)}
                    </span>

                    <span className="text-slate-500">Next earnings</span>
                    <span className="text-right text-slate-900">{formatDate(entry.nextEarningsDate)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="Nothing on the watchlist yet"
              detail="Add a company from its snapshot to keep an eye on its score, consensus and next earnings date."
            />
          )}
        </div>

        <p className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
          Stored in this browser only. Clearing site data removes it, and it does not follow you to another device.
        </p>
      </div>
    </div>
  );
}
