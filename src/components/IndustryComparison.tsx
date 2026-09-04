import { ArrowRight, Trophy } from 'lucide-react';
import type { CompanyDossier } from '../types';
import { industryPerformance, topAlternatives } from '../lib/industry';
import { Card, EmptyState, GeneratedBadge, Pill, Section } from './ui/primitives';
import { formatMultiple, formatPercent } from '../lib/format';

const MEDAL = ['border-l-amber-500', 'border-l-slate-400', 'border-l-orange-400'];

export function IndustryComparison({ dossier }: { dossier: CompanyDossier }) {
  const performance = industryPerformance(dossier);
  const alternatives = topAlternatives(dossier, 3);
  const symbol = dossier.profile.symbol;

  if (!performance.constituents.length || !alternatives.length) {
    return (
      <Section id="industry" title="Industry comparison">
        <EmptyState title="No peers to rank" detail={`Finnhub returned no peer set for ${symbol}, so there is nothing to compare against.`} />
      </Section>
    );
  }

  const outperforming = (performance.spread ?? 0) >= 0;
  const returns = performance.constituents.map((c) => c.oneYearReturn ?? 0);
  const maxAbs = Math.max(...returns.map(Math.abs), 0.05);

  return (
    <Section
      id="industry"
      title="Peer performance and alternatives"
      subtitle="Two separate questions: how the stock has performed against its peers, and which of them look stronger on fundamentals. A laggard can still be the best business in the group."
      action={<GeneratedBadge label="Model output" />}
    >
      <div className="space-y-3">
        <Card className="p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">
              1-year performance vs {performance.constituents.length - 1} Finnhub peers
              {performance.sector ? <span className="font-normal text-slate-500"> · {performance.sector}</span> : null}
            </h3>
            {performance.spread !== null ? (
              <Pill tone={outperforming ? 'green' : 'red'}>
                {outperforming ? 'Outperforming' : 'Lagging'} by {formatPercent(Math.abs(performance.spread))}
              </Pill>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
            <span>
              {symbol}:{' '}
              <strong className={`tabular-nums ${(performance.stockReturn ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {formatPercent(performance.stockReturn, 1, true)}
              </strong>
            </span>
            <span>
              Peer median:{' '}
              <strong className="tabular-nums text-slate-900">{formatPercent(performance.peerMedianReturn, 1, true)}</strong>
            </span>
            <span className="text-slate-400">{performance.constituents.length} companies</span>
          </div>

          <ul className="mt-4 space-y-1.5">
            {performance.constituents.map((company) => {
              const value = company.oneYearReturn ?? 0;
              const width = (Math.abs(value) / maxAbs) * 50;
              const isSelf = company.symbol === symbol;
              return (
                <li key={company.symbol} className="flex items-center gap-3 text-xs">
                  <span className={`w-14 shrink-0 ${isSelf ? 'font-bold text-blue-800' : 'font-medium text-slate-700'}`}>
                    {company.symbol}
                  </span>
                  <div className="relative h-4 flex-1">
                    <span className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-300" aria-hidden />
                    <span
                      className={`absolute top-0.5 bottom-0.5 rounded-sm ${value >= 0 ? 'bg-emerald-500' : 'bg-red-500'} ${isSelf ? '' : 'opacity-45'}`}
                      style={value >= 0 ? { left: '50%', width: `${width}%` } : { right: '50%', width: `${width}%` }}
                    />
                  </div>
                  <span
                    className={`w-16 shrink-0 text-right tabular-nums ${isSelf ? 'font-semibold text-slate-900' : 'text-slate-500'}`}
                  >
                    {formatPercent(company.oneYearReturn, 1, true)}
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="mt-3 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
            Past performance. It says nothing about what happens next, and a wide spread often reflects where each
            company sits in its own cycle rather than relative quality.
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" aria-hidden />
            <h3 className="text-sm font-semibold text-slate-900">Top 3 alternatives in this industry</h3>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Ranked on growth, profitability and valuation against the peer median — the same emphasis as the main
            score, on the metrics Finnhub carries per peer. Analyst views play no part.
          </p>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {alternatives.map((alt, i) => (
              <div key={alt.symbol} className={`rounded-lg border border-l-4 border-slate-200 p-4 ${MEDAL[i]}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <span className="text-base font-semibold text-slate-900">{alt.symbol}</span>
                    <span className="ml-2 text-xs text-slate-500">{alt.name}</span>
                  </div>
                  <span className="text-lg font-bold tabular-nums text-slate-900">{alt.score}</span>
                </div>

                <p className="mt-2 text-sm text-slate-700">{alt.rationale}</p>

                <dl className="mt-3 space-y-1 text-xs">
                  {[
                    ['Revenue growth', formatPercent(alt.metrics.revenueGrowthYoY, 1, true)],
                    ['Operating margin', formatPercent(alt.metrics.operatingMargin)],
                    ['Return on equity', formatPercent(alt.metrics.returnOnEquity)],
                    ['P/E', formatMultiple(alt.metrics.trailingPE)],
                    ['1-year return', formatPercent(alt.metrics.oneYearReturn, 1, true)]
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-2">
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="tabular-nums text-slate-800">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-3 flex gap-1.5 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                  {(['growth', 'profitability', 'valuation'] as const).map((part) => (
                    <span key={part} className="flex-1">
                      <span className="block capitalize">{part.slice(0, 6)}</span>
                      <span className="font-semibold tabular-nums text-slate-800">{alt.parts[part] ?? '—'}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
            <ArrowRight className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            These are screening candidates, not recommendations. Search a ticker above to run the full analysis on one.
          </p>
        </Card>
      </div>
    </Section>
  );
}
