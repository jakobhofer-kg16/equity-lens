import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyRound, Star, StarOff } from 'lucide-react';
import { DataError, type CompanyDossier } from './types';
import { invalidateCache, loadDossier, providerStatus } from './services';
import { scoreCompany } from './lib/scoring';
import { useWatchlist } from './hooks/useWatchlist';
import { Header } from './components/Header';
import { CompanySnapshot } from './components/CompanySnapshot';
import { ExecutiveVerdict } from './components/ExecutiveVerdict';
import { PricePerformance } from './components/PricePerformance';
import { Fundamentals } from './components/Fundamentals';
import { Valuation } from './components/Valuation';
import { PeerComparison } from './components/PeerComparison';
import { IndustryComparison } from './components/IndustryComparison';
import { AnalystConsensus } from './components/AnalystConsensus';
import { NewsCatalysts } from './components/NewsCatalysts';
import { FunFacts } from './components/FunFacts';
import { ThesisBuilder } from './components/ThesisBuilder';
import { WatchlistPanel } from './components/Watchlist';
import { ApiKeyPanel } from './components/ApiKeyPanel';
import { Card, ErrorState, Skeleton } from './components/ui/primitives';

const INITIAL_SYMBOL = 'AAPL';

const ERROR_TITLES: Record<string, string> = {
  'unsupported-ticker': 'Ticker not covered',
  'rate-limited': 'Provider rate limit reached',
  network: 'Could not reach the data provider',
  'no-api-key': 'API key problem',
  'provider-error': 'The data provider returned an error'
};

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading company data">
      <Card className="space-y-3 p-5">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <Skeleton className="h-24 w-full" />
      </Card>
      <Card className="p-5">
        <Skeleton className="h-72 w-full" />
      </Card>
    </div>
  );
}

export default function App() {
  const [symbol, setSymbol] = useState(INITIAL_SYMBOL);
  const [dossier, setDossier] = useState<CompanyDossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [status, setStatus] = useState(providerStatus);

  const watchlist = useWatchlist();

  const fetchSymbol = useCallback(async (next: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadDossier(next);
      setDossier(result);
      setSymbol(result.profile.symbol);
    } catch (err) {
      const kind = err instanceof DataError ? err.kind : 'provider-error';
      setError({ title: ERROR_TITLES[kind] ?? 'Something went wrong', detail: (err as Error).message });
      setDossier(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSymbol(INITIAL_SYMBOL);
  }, [fetchSymbol]);

  const score = useMemo(() => (dossier ? scoreCompany(dossier) : null), [dossier]);

  const impliedUpside =
    dossier?.priceTargets?.median && dossier.quote.price
      ? dossier.priceTargets.median / dossier.quote.price - 1
      : null;

  const inWatchlist = watchlist.has(symbol);

  function toggleWatchlist() {
    if (!dossier || !score) return;
    if (inWatchlist) {
      watchlist.remove(dossier.profile.symbol);
      return;
    }
    watchlist.add({
      symbol: dossier.profile.symbol,
      name: dossier.profile.name,
      price: dossier.quote.price,
      changePercent: dossier.quote.changePercent,
      modelScore: score.total,
      classification: score.classification,
      consensusLabel: dossier.consensus?.consensusLabel ?? null,
      impliedUpside,
      nextEarningsDate: dossier.earnings.nextEarningsDate,
      addedAt: new Date().toISOString()
    });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header
        onOpenKeys={() => setKeysOpen(true)}
        configuredKeyCount={Object.values(status.configured).filter(Boolean).length}
        onSearch={(next) => void fetchSymbol(next)}
        onToggleWatchlist={() => setWatchlistOpen(true)}
        watchlistCount={watchlist.entries.length}
        busy={loading}
      />

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-6">
        {status.isMock ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span>
            Running on bundled sample data because no API key is configured. Full sample dossiers exist for{' '}
            <strong>{status.sampleSymbols.join(', ')}</strong>. Add an Alpha Vantage key to analyze any US ticker.
            </span>
            <button
              type="button"
              onClick={() => setKeysOpen(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden /> Add API keys
            </button>
          </div>
        ) : null}

        {dossier?.source.notes.length ? (
          <ul className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-500">
            {dossier.source.notes.map((note) => (
              <li key={note}>• {note}</li>
            ))}
          </ul>
        ) : null}

        {loading ? <DashboardSkeleton /> : null}

        {!loading && error ? (
          <ErrorState title={error.title} detail={error.detail} onRetry={() => void fetchSymbol(symbol)} />
        ) : null}

        {!loading && dossier && score ? (
          <>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={toggleWatchlist}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                {inWatchlist ? <StarOff className="h-3.5 w-3.5" aria-hidden /> : <Star className="h-3.5 w-3.5" aria-hidden />}
                {inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
              </button>
            </div>

            <CompanySnapshot dossier={dossier} />
            <ExecutiveVerdict score={score} symbol={dossier.profile.symbol} />
            <PricePerformance dossier={dossier} />
            <Fundamentals dossier={dossier} />
            <Valuation dossier={dossier} />
            <PeerComparison dossier={dossier} />
            <IndustryComparison dossier={dossier} />
            <AnalystConsensus dossier={dossier} score={score} />
            <NewsCatalysts dossier={dossier} />
            <FunFacts dossier={dossier} />
            <ThesisBuilder dossier={dossier} score={score} />
          </>
        ) : null}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-6 text-xs leading-relaxed text-slate-500">
          <p className="font-medium text-slate-700">
            This application is for educational purposes only and does not constitute personalized financial or
            investment advice.
          </p>
          <p>
            Data provider: {dossier?.source.provider ?? status.label}. Market data is{' '}
            {dossier?.source.freshness ?? status.freshness} — not real time. Last updated{' '}
            {dossier ? new Date(dossier.source.fetchedAt).toLocaleString() : 'n/a'}.
          </p>
          <p>
            Model scores and analyst price targets are opinions and estimates, not facts or forecasts. Sections marked
            as generated are produced by this application from the data shown. No return is promised or implied.
          </p>
        </div>
      </footer>

      <ApiKeyPanel
        open={keysOpen}
        onClose={() => setKeysOpen(false)}
        onSaved={() => {
          invalidateCache();
          setStatus(providerStatus());
          void fetchSymbol(symbol);
        }}
      />

      <WatchlistPanel
        open={watchlistOpen}
        entries={watchlist.entries}
        onClose={() => setWatchlistOpen(false)}
        onSelect={(next) => void fetchSymbol(next)}
        onRemove={watchlist.remove}
      />
    </div>
  );
}
