import { useState, type FormEvent } from 'react';
import { KeyRound, LineChart, Search, Star } from 'lucide-react';
import { Pill } from './ui/primitives';

const EXAMPLES = ['AAPL', 'MSFT', 'TSLA'];

export function Header({
  onSearch,
  onToggleWatchlist,
  onOpenKeys,
  watchlistCount,
  configuredKeyCount,
  busy
}: {
  onSearch: (symbol: string) => void;
  onToggleWatchlist: () => void;
  onOpenKeys: () => void;
  watchlistCount: number;
  configuredKeyCount: number;
  busy: boolean;
}) {
  const [value, setValue] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    const symbol = value.trim().toUpperCase();
    if (symbol) onSearch(symbol);
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
            <LineChart className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h1 className="text-base leading-tight font-semibold tracking-tight text-slate-900">Equity Lens</h1>
            <p className="text-xs leading-tight text-slate-500">An investment decision dashboard, not a price predictor</p>
          </div>
        </div>

        <form onSubmit={submit} className="flex min-w-[260px] flex-1 items-center gap-2" role="search">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Search a US ticker, e.g. AAPL"
              aria-label="Ticker symbol"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm placeholder:text-slate-400"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {busy ? 'Loading' : 'Analyze'}
          </button>
        </form>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleWatchlist}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            aria-label={`Watchlist, ${watchlistCount} companies`}
          >
            <Star className="h-4 w-4" aria-hidden />
            Watchlist
            {watchlistCount > 0 ? (
              <span className="rounded-full bg-slate-900 px-1.5 text-xs text-white tabular-nums">{watchlistCount}</span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={onOpenKeys}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            aria-label={`API keys, ${configuredKeyCount} configured`}
          >
            <KeyRound className="h-4 w-4" aria-hidden />
            API keys
            {configuredKeyCount > 0 ? (
              <span className="rounded-full bg-emerald-600 px-1.5 text-xs text-white tabular-nums">{configuredKeyCount}</span>
            ) : null}
          </button>
          <Pill tone="amber">Educational use only</Pill>
        </div>

        <div className="flex w-full items-center gap-2 text-xs text-slate-500">
          <span>Try:</span>
          {EXAMPLES.map((symbol) => (
            <button
              key={symbol}
              type="button"
              onClick={() => {
                setValue(symbol);
                onSearch(symbol);
              }}
              className="rounded-md border border-slate-200 px-2 py-0.5 font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
            >
              {symbol}
            </button>
          ))}

        </div>
      </div>
    </header>
  );
}
