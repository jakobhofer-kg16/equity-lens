import { Building2, CalendarClock, ExternalLink } from 'lucide-react';
import type { CompanyDossier } from '../types';
import { Card, Metric, Pill, Section } from './ui/primitives';
import { formatBigMoney, formatCurrency, formatDate, formatDateTime, formatPercent } from '../lib/format';

const FRESHNESS_COPY = {
  live: 'Live market data',
  delayed: 'Delayed market data',
  'end-of-day': 'End-of-day data — not intraday'
} as const;

export function CompanySnapshot({ dossier }: { dossier: CompanyDossier }) {
  const { profile, quote, earnings, source } = dossier;
  const positive = quote.changePercent >= 0;

  return (
    <Section
      id="snapshot"
      title="Company snapshot"
      subtitle={
        <span className="inline-flex flex-wrap items-center gap-2">
          <Pill tone={source.isMock ? 'amber' : 'blue'}>{source.isMock ? 'Sample data' : source.provider}</Pill>
          <Pill tone="slate">{FRESHNESS_COPY[source.freshness]}</Pill>
          <span>Updated {formatDateTime(source.fetchedAt)}</span>
        </span>
      }
    >
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-700">
              {profile.symbol.slice(0, 2)}
            </span>
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-slate-900">
                {profile.name} <span className="text-slate-400">·</span> {profile.symbol}
              </h3>
              <p className="mt-0.5 text-sm text-slate-500">
                {[profile.exchange, profile.sector, profile.industry].filter(Boolean).join(' · ')}
              </p>
              {profile.website ? (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                >
                  {profile.website.replace(/^https?:\/\//, '')} <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              ) : null}
            </div>
          </div>

          <div className="text-right">
            <div className="text-3xl font-semibold tracking-tight tabular-nums text-slate-900">
              {formatCurrency(quote.price, profile.currency)}
            </div>
            <div className={`text-sm font-medium tabular-nums ${positive ? 'text-emerald-700' : 'text-red-700'}`}>
              {positive ? '+' : ''}
              {quote.change.toFixed(2)} ({positive ? '+' : ''}
              {quote.changePercent.toFixed(2)}%)
            </div>
            <div className="mt-0.5 text-xs text-slate-500">Close of {formatDate(quote.asOf)}</div>
          </div>
        </div>

        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-600">{profile.description}</p>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Market cap" value={formatBigMoney(profile.marketCap, profile.currency)} />
          <Metric
            label="52-week range"
            value={`${formatCurrency(quote.week52Low, profile.currency, 0)} – ${formatCurrency(quote.week52High, profile.currency, 0)}`}
            sub={
              quote.week52High && quote.week52Low
                ? `${formatPercent((quote.price - quote.week52Low) / (quote.week52High - quote.week52Low))} of the way up the range`
                : undefined
            }
          />
          <Metric
            label="Next earnings"
            value={earnings.nextEarningsDate ? formatDate(earnings.nextEarningsDate) : 'Not scheduled'}
          />
          <Metric label="Beta" value={profile.beta !== null ? profile.beta.toFixed(2) : 'n/a'} hint="Sensitivity to broad market moves. 1.0 means it tends to move with the index." />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" aria-hidden /> Fiscal year ends {profile.fiscalYearEnd ?? 'n/a'}
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden /> Source: {source.provider}
          </span>
        </div>
      </Card>
    </Section>
  );
}
