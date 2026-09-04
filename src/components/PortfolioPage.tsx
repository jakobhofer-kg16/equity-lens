import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Briefcase, RefreshCw, Sparkles } from 'lucide-react';
import portfolioJson from '../data/portfolio.json';
import type { PortfolioFile, PortfolioHolding } from '../lib/portfolioTypes';
import { getKeys } from '../services/keys';
import { writePortfolioCommentary, THESIS_MODEL } from '../services/providers/openRouter';
import { Card, GeneratedBadge, Pill, Section } from './ui/primitives';
import { formatBigMoney, formatCurrency, formatDate, formatPercent } from '../lib/format';

type Method = 'maxSharpe' | 'minVariance' | 'equal';
const METHOD_LABEL: Record<Method, string> = {
  maxSharpe: 'Maximum Sharpe ratio',
  minVariance: 'Minimum variance',
  equal: 'Equal weight'
};

interface Quote {
  price: number;
  change: number;
  changePercent: number;
  asOf: string;
}

const portfolio = portfolioJson as unknown as PortfolioFile;
type Holding = PortfolioHolding;

/** Live quotes for every holding, one Finnhub request each (60/min allowed). */
async function fetchQuotes(symbols: string[], apiKey: string): Promise<Record<string, Quote>> {
  const out: Record<string, Quote> = {};
  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        let r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`);
        if (r.status === 429) {
          // Burst limit: one retry after a short pause is enough for sixteen calls.
          await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1500));
          r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`);
        }
        if (!r.ok) return;
        const j = (await r.json()) as Record<string, number>;
        if (!j.c) return;
        out[symbol] = { price: j.c, change: j.d, changePercent: j.dp, asOf: j.t ? new Date(j.t * 1000).toISOString().slice(0, 10) : '' };
      } catch {
        /* one missing quote is shown as stale, not fatal */
      }
    })
  );
  return out;
}

export function PortfolioPage({ onOpenCompany, onOpenKeys }: { onOpenCompany: (symbol: string) => void; onOpenKeys: () => void }) {
  const [method, setMethod] = useState<Method>('maxSharpe');
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [quoteState, setQuoteState] = useState<'idle' | 'loading' | 'done' | 'nokey'>('idle');
  const [commentary, setCommentary] = useState<string | null>(null);
  const [commentaryState, setCommentaryState] = useState<'idle' | 'writing' | 'done' | 'error' | 'nokey'>('idle');
  const [commentaryError, setCommentaryError] = useState<string | null>(null);

  const holdings = portfolio.holdings as Holding[];
  const weights = portfolio.weights[method] as Record<string, number>;
  const stats = portfolio.stats[method];

  // Live prices on load.
  useEffect(() => {
    const key = getKeys().finnhub;
    if (!key) {
      setQuoteState('nokey');
      return;
    }
    setQuoteState('loading');
    fetchQuotes(
      holdings.map((h) => h.symbol),
      key
    ).then((q) => {
      setQuotes(q);
      setQuoteState('done');
    });
  }, [holdings]);

  const portfolioDayChange = useMemo(() => {
    let sum = 0;
    let covered = 0;
    for (const h of holdings) {
      const q = quotes[h.symbol];
      if (!q) continue;
      sum += (weights[h.symbol] ?? 0) * q.changePercent;
      covered += weights[h.symbol] ?? 0;
    }
    return covered > 0.5 ? sum / covered : null;
  }, [holdings, quotes, weights]);

  const commentaryInput = useMemo(
    () => ({
      thesis: portfolio.thesis,
      method: METHOD_LABEL[method],
      asOf: portfolio.pricesAsOf,
      stats,
      benchmark: portfolio.stats.benchmark,
      portfolioDayChangePct: portfolioDayChange,
      holdings: holdings.map((h) => ({
        symbol: h.symbol,
        name: h.name,
        industry: h.industry,
        weight: weights[h.symbol] ?? 0,
        livePrice: quotes[h.symbol]?.price ?? null,
        dayChangePct: quotes[h.symbol]?.changePercent ?? null,
        discountPe: h.valuation.discountPe,
        tone: h.tone.polarity,
        toneDelta: h.tone.delta,
        goldenCross: h.technical.goldenCross,
        rsi: h.technical.rsi
      }))
    }),
    [holdings, method, quotes, stats, weights, portfolioDayChange]
  );

  // Executive commentary on load, once quotes have settled.
  useEffect(() => {
    if (quoteState !== 'done' && quoteState !== 'nokey') return;
    const key = getKeys().openRouter;
    if (!key) {
      setCommentaryState('nokey');
      return;
    }
    let cancelled = false;
    setCommentaryState('writing');
    writePortfolioCommentary(key, commentaryInput)
      .then((text) => {
        if (!cancelled) {
          setCommentary(text);
          setCommentaryState('done');
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setCommentaryError(err.message);
          setCommentaryState('error');
        }
      });
    return () => {
      cancelled = true;
    };
    // Re-run when the method changes; quotes are stable after load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteState, method]);

  const sorted = [...holdings].sort((a, b) => (weights[b.symbol] ?? 0) - (weights[a.symbol] ?? 0));
  const goldenCount = holdings.filter((h) => h.technical.goldenCross).length;
  const overboughtCount = holdings.filter((h) => (h.technical.rsi ?? 0) >= 70).length;
  const macdUp = holdings.filter((h) => (h.technical.macdHist ?? 0) > 0).length;
  const toneUp = holdings.filter((h) => (h.tone.delta ?? 0) > 0).length;

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => onOpenCompany('')} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Company research
        </button>
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-300" role="group" aria-label="Weighting method">
          {(Object.keys(METHOD_LABEL) as Method[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={method === m}
              onClick={() => setMethod(m)}
              className={`px-3 py-1.5 text-xs font-semibold transition ${method === m ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
            >
              {METHOD_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      <Section
        id="portfolio"
        title="Cheap against peers, confirmed by the call"
        subtitle={`${holdings.length} S&P 500 names selected from ${portfolio.universe} with transcripts: cheaper than industry peers on P/E and EV/EBITDA, latest earnings call at least neutral and not deteriorating, entered on a golden cross above the 200-day average with RSI below 70. Weights from ${METHOD_LABEL[method].toLowerCase()}, long-only, ${formatPercent(portfolio.minWeight, 0)}–${formatPercent(portfolio.maxWeight, 0)} per name, at most ${portfolio.maxPerIndustry} per industry.`}
        action={<Pill tone="blue">$1M mandate</Pill>}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <div className="text-xs tracking-wide text-slate-500 uppercase">Portfolio today</div>
            <div className={`mt-1 text-2xl font-semibold tabular-nums ${portfolioDayChange === null ? 'text-slate-400' : portfolioDayChange >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {portfolioDayChange === null ? (quoteState === 'loading' ? '…' : 'n/a') : formatPercent(portfolioDayChange / 100, 2, true)}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              {quoteState === 'done' ? `Live quotes, ${Object.keys(quotes).length} of ${holdings.length} holdings` : quoteState === 'nokey' ? 'Add a Finnhub key for live prices' : 'Fetching live quotes'}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs tracking-wide text-slate-500 uppercase">Expected return</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{formatPercent(stats.expectedReturn, 1)}</div>
            <div className="mt-0.5 text-xs text-slate-500">annualised, in-sample · SPY {formatPercent(portfolio.stats.benchmark.expectedReturn, 1)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs tracking-wide text-slate-500 uppercase">Volatility</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{formatPercent(stats.volatility, 1)}</div>
            <div className="mt-0.5 text-xs text-slate-500">annualised · SPY {formatPercent(portfolio.stats.benchmark.volatility, 1)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs tracking-wide text-slate-500 uppercase">Sharpe ratio</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{stats.sharpe.toFixed(2)}</div>
            <div className="mt-0.5 text-xs text-slate-500">rf {formatPercent(portfolio.riskFreeRate, 0)} · SPY {portfolio.stats.benchmark.sharpe.toFixed(2)}</div>
          </Card>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Return, volatility and Sharpe are measured on the same {portfolio.lookbackTradingDays} trading days the weights were fitted on. They describe the fit, not a forecast.
        </p>
      </Section>

      <Section id="commentary" title="Executive commentary" action={commentaryState === 'done' ? <GeneratedBadge label={`AI-generated · ${THESIS_MODEL}`} /> : <GeneratedBadge label="Generated" />}>
        <Card className="p-5">
          {commentaryState === 'writing' ? (
            <p className="inline-flex items-center gap-2 text-sm text-slate-500"><RefreshCw className="h-4 w-4 animate-spin" aria-hidden /> Writing from live quotes and signals…</p>
          ) : commentaryState === 'done' && commentary ? (
            <div className="space-y-3 text-sm leading-relaxed text-slate-700">
              {commentary.split(/\n{2,}/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          ) : commentaryState === 'error' ? (
            <p className="text-sm text-red-700">Commentary unavailable: {commentaryError}</p>
          ) : (
            <div className="text-sm text-slate-600">
              <p>
                No OpenRouter key configured, so no model commentary is shown — nothing here is pre-written. What the signals say today, computed on this page:
                {' '}{goldenCount} of {holdings.length} holdings sit above their 200-day average, {macdUp} have a positive MACD histogram, {overboughtCount} are overbought on RSI, and the call tone improved quarter on quarter for {toneUp}.
              </p>
              <button type="button" onClick={onOpenKeys} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-400 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100">
                <Sparkles className="h-3.5 w-3.5" aria-hidden /> Add an OpenRouter key
              </button>
            </div>
          )}
        </Card>
      </Section>

      <Section id="holdings" title="Holdings, weights and signals" subtitle={`Signals as of ${formatDate(portfolio.pricesAsOf)}. Prices are live where a quote arrived.`}>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs tracking-wide text-slate-500 uppercase">
                  <th className="px-3 py-2 font-medium">Holding</th>
                  <th className="px-3 py-2 text-right font-medium">Weight</th>
                  <th className="px-3 py-2 text-right font-medium">$1M</th>
                  <th className="px-3 py-2 text-right font-medium">Price</th>
                  <th className="px-3 py-2 text-right font-medium">Day</th>
                  <th className="px-3 py-2 text-right font-medium">P/E vs peers</th>
                  <th className="px-3 py-2 text-right font-medium">Call tone</th>
                  <th className="px-3 py-2 text-center font-medium">Trend</th>
                  <th className="px-3 py-2 text-right font-medium">RSI</th>
                  <th className="px-3 py-2 text-center font-medium">MACD</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((h) => {
                  const w = weights[h.symbol] ?? 0;
                  const q = quotes[h.symbol];
                  return (
                    <tr key={h.symbol} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => onOpenCompany(h.symbol)} className="font-semibold text-slate-900 hover:underline">{h.symbol}</button>
                        <span className="block text-xs text-slate-500">{h.name} · {h.industry}</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="h-1.5 rounded-full bg-slate-800" style={{ width: `${Math.max(2, w * 400)}px` }} />
                          <span className="w-12 tabular-nums">{formatPercent(w, 1)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600">{formatBigMoney(w * 1_000_000)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{q ? formatCurrency(q.price) : <span className="text-slate-400">{formatCurrency(h.technical.close)}</span>}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${!q ? 'text-slate-400' : q.changePercent >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{q ? formatPercent(q.changePercent / 100, 2, true) : 'stale'}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{formatPercent(h.valuation.discountPe, 0)} cheaper</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {h.tone.polarity?.toFixed(2) ?? 'n/a'}
                        {h.tone.delta !== null ? <span className={`ml-1 text-xs ${h.tone.delta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>({h.tone.delta >= 0 ? '+' : ''}{h.tone.delta.toFixed(2)})</span> : null}
                      </td>
                      <td className="px-3 py-2 text-center">{h.technical.goldenCross === null ? '—' : <Pill tone={h.technical.goldenCross ? 'green' : 'red'}>{h.technical.goldenCross ? 'golden cross' : 'death cross'}</Pill>}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${(h.technical.rsi ?? 0) >= 70 ? 'text-red-700' : (h.technical.rsi ?? 100) <= 30 ? 'text-emerald-700' : 'text-slate-700'}`}>{h.technical.rsi?.toFixed(0) ?? 'n/a'}</td>
                      <td className="px-3 py-2 text-center">{h.technical.macdHist === null ? '—' : <Pill tone={h.technical.macdHist > 0 ? 'green' : 'slate'}>{h.technical.macdHist > 0 ? 'positive' : 'negative'}</Pill>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
            Screen: {portfolio.withFundamentals} companies with fundamentals → {portfolio.passedScreen} cheaper than peers with an acceptable call → {portfolio.candidatesPriced} priced (industry cap) → {portfolio.passedTechnical} in an uptrend and not overbought → top {holdings.length} by composite rank. Generated {formatDate(portfolio.generatedAt.slice(0, 10))} with <code>npx tsx scripts/portfolio.ts</code>.
          </p>
        </Card>
      </Section>

      <Section id="method" title="Weighting methods compared" subtitle="The two methods taught, plus equal weight as the naive baseline. Same holdings, same two-year window.">
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs tracking-wide text-slate-500 uppercase">
                <th className="px-4 py-2 font-medium">Method</th>
                <th className="px-4 py-2 text-right font-medium">Expected return</th>
                <th className="px-4 py-2 text-right font-medium">Volatility</th>
                <th className="px-4 py-2 text-right font-medium">Sharpe</th>
                <th className="px-4 py-2 text-right font-medium">Largest weight</th>
                <th className="px-4 py-2 text-right font-medium">Names ≥ 1%</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(METHOD_LABEL) as Method[]).map((m) => {
                const w = portfolio.weights[m] as Record<string, number>;
                const s = portfolio.stats[m];
                return (
                  <tr key={m} className={`border-b border-slate-100 last:border-0 ${m === method ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-4 py-2 font-medium text-slate-900">{METHOD_LABEL[m]}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatPercent(s.expectedReturn, 1)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatPercent(s.volatility, 1)}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold">{s.sharpe.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatPercent(Math.max(...Object.values(w)), 1)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{Object.values(w).filter((x) => x >= 0.01).length}</td>
                  </tr>
                );
              })}
              <tr className="border-t border-slate-200">
                <td className="px-4 py-2 text-slate-600">SPY (same window)</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatPercent(portfolio.stats.benchmark.expectedReturn, 1)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatPercent(portfolio.stats.benchmark.volatility, 1)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{portfolio.stats.benchmark.sharpe.toFixed(2)}</td>
                <td className="px-4 py-2 text-right text-slate-400">—</td>
                <td className="px-4 py-2 text-right text-slate-400">—</td>
              </tr>
            </tbody>
          </table>
        </Card>
        <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
          <Briefcase className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          Expected returns are two-year historical means, the weakest input in any mean-variance optimisation; the maximum-Sharpe weights lean on them, the minimum-variance weights do not. That is why both are shown.
        </p>
      </Section>
    </main>
  );
}
