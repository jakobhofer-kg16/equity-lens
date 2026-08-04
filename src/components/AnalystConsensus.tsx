import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus, Plus } from 'lucide-react';
import type { CompanyDossier, RatingBucket, RatingDistribution } from '../types';
import type { ModelScore } from '../lib/scoring';
import { Card, EmptyState, Metric, Pill, Section } from './ui/primitives';
import { formatCurrency, formatDate, formatPercent, formatRelative, daysBetween } from '../lib/format';

const BUCKETS: Array<{ key: keyof RatingDistribution; label: string; color: string }> = [
  { key: 'strongBuy', label: 'Strong Buy', color: 'bg-emerald-600' },
  { key: 'buy', label: 'Buy', color: 'bg-emerald-400' },
  { key: 'hold', label: 'Hold', color: 'bg-slate-400' },
  { key: 'sell', label: 'Sell', color: 'bg-orange-400' },
  { key: 'strongSell', label: 'Strong Sell', color: 'bg-red-600' }
];

const ACTION_ICON = {
  upgrade: ArrowUpRight,
  downgrade: ArrowDownRight,
  maintain: Minus,
  initiate: Plus
} as const;

const STALE_AFTER_DAYS = 120;
const THIN_COVERAGE = 5;

function ratingLabel(bucket: RatingBucket): string {
  return BUCKETS.find((b) => b.key === bucket)?.label ?? bucket;
}

export function AnalystConsensus({ dossier, score }: { dossier: CompanyDossier; score: ModelScore }) {
  const { consensus, priceTargets, quote, profile, estimates } = dossier;

  if (!consensus) {
    return (
      <Section id="analysts" title="Analyst consensus">
        <EmptyState
          title="No analyst coverage returned"
          detail={`The provider reported no ratings for ${profile.symbol}. This is common for small caps and recently listed companies.`}
        />
      </Section>
    );
  }

  const total = consensus.analystCount;
  const impliedUpside =
    priceTargets?.median && quote.price ? priceTargets.median / quote.price - 1 : null;

  const age = daysBetween(consensus.asOf);
  const isStale = age !== null && age > STALE_AFTER_DAYS;
  const isThin = total < THIN_COVERAGE;

  // The comparison that gives this section its point: analysts are bullish or
  // bearish independently of what our own fundamentals model concluded.
  const analystsBullish = consensus.consensusScore <= 2.4;
  const analystsBearish = consensus.consensusScore >= 3.6;
  const modelBullish = score.classification === 'Bullish';
  const modelBearish = score.classification === 'Bearish';
  const divergence =
    (analystsBullish && modelBearish) || (analystsBearish && modelBullish)
      ? 'strong'
      : (analystsBullish && score.classification === 'Watch') || (analystsBearish && score.classification === 'Watch')
        ? 'mild'
        : null;

  return (
    <Section
      id="analysts"
      title="Analyst consensus"
      subtitle="What sell-side analysts publish. Kept separate from our model, and carrying no weight in its score."
      action={<Pill tone="blue">Third-party opinion</Pill>}
    >
      <div className="space-y-3">
        {(isStale || isThin) && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              {isThin ? `Thin coverage: only ${total} analysts. ` : ''}
              {isStale ? `The consensus snapshot is ${formatRelative(consensus.asOf)} and may not reflect recent news. ` : ''}
              Treat the figures below with more caution than a broadly covered large cap.
            </span>
          </div>
        )}

        <Card className="p-5">
          <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="text-2xl font-semibold text-slate-900">{consensus.consensusLabel}</span>
                <span className="text-sm text-slate-500">
                  from {total} analysts · as of {formatDate(consensus.asOf)} ({formatRelative(consensus.asOf)})
                </span>
              </div>

              <div className="mt-4 space-y-2">
                {BUCKETS.map((bucket) => {
                  const count = consensus.distribution[bucket.key];
                  const share = total ? count / total : 0;
                  return (
                    <div key={bucket.key} className="flex items-center gap-3 text-sm">
                      <span className="w-24 shrink-0 text-slate-600">{bucket.label}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full ${bucket.color}`} style={{ width: `${share * 100}%` }} />
                      </div>
                      <span className="w-14 shrink-0 text-right tabular-nums text-slate-700">
                        {count} <span className="text-slate-400">({formatPercent(share, 0)})</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Metric label="Average target" value={formatCurrency(priceTargets?.average ?? null, profile.currency)} />
              <Metric label="Median target" value={formatCurrency(priceTargets?.median ?? null, profile.currency)} />
              <Metric
                label="Target range"
                value={
                  priceTargets?.low && priceTargets?.high
                    ? `${formatCurrency(priceTargets.low, profile.currency, 0)} – ${formatCurrency(priceTargets.high, profile.currency, 0)}`
                    : 'n/a'
                }
              />
              <Metric
                label="Implied vs median"
                value={impliedUpside === null ? 'n/a' : formatPercent(impliedUpside, 1, true)}
                tone={impliedUpside === null ? 'neutral' : impliedUpside >= 0 ? 'positive' : 'negative'}
                hint="Median target divided by the current price, minus one. A target is an opinion about value, not a forecast of where the price will go."
              />
            </div>
          </div>

          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            Price targets are analyst opinions, not predictions or guaranteed outcomes. Ratings are normalized into five
            buckets — the original wording each firm used is kept in the actions table below.
          </p>
        </Card>

        {divergence ? (
          <Card className={`border-l-4 p-4 ${divergence === 'strong' ? 'border-l-amber-500' : 'border-l-slate-400'}`}>
            <h4 className="text-sm font-semibold text-slate-900">
              {divergence === 'strong' ? 'Contrarian signal' : 'Mild divergence'}
            </h4>
            <p className="mt-1 text-sm text-slate-700">
              Analysts are {analystsBullish ? 'bullish' : 'bearish'} on {profile.symbol} ({consensus.consensusLabel}), while
              our fundamentals model reads {score.classification.toLowerCase()} at {score.total}/100
              {score.risks[0] ? `, flagging ${score.risks[0].label.toLowerCase()} at ${score.risks[0].formatted}` : ''}. Because
              the model never sees analyst input, this is a genuine disagreement rather than the same view counted twice.
            </p>
          </Card>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="p-4">
            <h4 className="text-sm font-semibold text-slate-900">Recommendation trend</h4>
            {consensus.trend.length ? (
              <div className="mt-3 space-y-2">
                {consensus.trend.map((snapshot) => {
                  const snapTotal = Object.values(snapshot.distribution).reduce((a, b) => a + b, 0) || 1;
                  return (
                    <div key={snapshot.period} className="flex items-center gap-3">
                      <span className="w-16 shrink-0 text-xs tabular-nums text-slate-500">{snapshot.period}</span>
                      <div className="flex h-3 flex-1 overflow-hidden rounded-full">
                        {BUCKETS.map((bucket) => (
                          <div
                            key={bucket.key}
                            className={bucket.color}
                            style={{ width: `${(snapshot.distribution[bucket.key] / snapTotal) * 100}%` }}
                            title={`${bucket.label}: ${snapshot.distribution[bucket.key]}`}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                The configured provider publishes only the current snapshot, so there is no history to plot. Shown as
                unavailable rather than reconstructed.
              </p>
            )}
          </Card>

          <Card className="p-4">
            <h4 className="text-sm font-semibold text-slate-900">Recent upgrades and downgrades</h4>
            {consensus.recentActions.length ? (
              <ul className="mt-3 divide-y divide-slate-100">
                {consensus.recentActions.map((action, i) => {
                  const Icon = ACTION_ICON[action.action];
                  const tone =
                    action.action === 'upgrade'
                      ? 'text-emerald-600'
                      : action.action === 'downgrade'
                        ? 'text-red-600'
                        : 'text-slate-400';
                  return (
                    <li key={`${action.firm}-${i}`} className="flex items-center gap-3 py-2 text-sm">
                      <Icon className={`h-4 w-4 shrink-0 ${tone}`} aria-hidden />
                      <span className="flex-1 font-medium text-slate-800">{action.firm}</span>
                      <span className="text-slate-600" title={`Normalized to ${ratingLabel(action.rating)}`}>
                        {action.rawRating}
                      </span>
                      <span className="w-16 text-right tabular-nums text-slate-700">
                        {formatCurrency(action.priceTarget, profile.currency, 0)}
                      </span>
                      <span className="w-20 text-right text-xs text-slate-400">{formatDate(action.date)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No individual rating actions returned by this provider.</p>
            )}
          </Card>
        </div>

        {estimates?.rows.length ? (
          <Card className="overflow-hidden">
            <h4 className="px-4 pt-4 text-sm font-semibold text-slate-900">Forecasts against actuals</h4>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                    <th scope="col" className="px-4 py-2 text-left font-medium">Fiscal year</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Revenue estimate</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Revenue actual</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">EPS estimate</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">EPS actual</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Analysts</th>
                  </tr>
                </thead>
                <tbody>
                  {estimates.rows.map((row) => {
                    const beat = row.epsActual !== null && row.epsEstimate !== null ? row.epsActual >= row.epsEstimate : null;
                    return (
                      <tr key={row.fiscalYear} className="border-b border-slate-100 last:border-0">
                        <th scope="row" className="px-4 py-2 text-left font-medium text-slate-800">
                          {row.fiscalYear}
                          {row.revenueActual === null ? <span className="ml-1.5 text-xs font-normal text-slate-400">forecast</span> : null}
                        </th>
                        <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                          {row.revenueEstimate ? `$${(row.revenueEstimate / 1e9).toFixed(1)}B` : '—'}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-slate-900">
                          {row.revenueActual ? `$${(row.revenueActual / 1e9).toFixed(1)}B` : '—'}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                          {row.epsEstimate !== null ? row.epsEstimate.toFixed(2) : '—'}
                        </td>
                        <td
                          className={`px-4 py-2 text-right tabular-nums ${beat === null ? 'text-slate-900' : beat ? 'text-emerald-700' : 'text-red-700'}`}
                        >
                          {row.epsActual !== null ? row.epsActual.toFixed(2) : '—'}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-slate-500">{row.analystCount ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}
      </div>
    </Section>
  );
}
