import { useEffect, useState } from 'react';
import { ExternalLink, Mic, Quote } from 'lucide-react';
import {
  fetchEarningsSentiment,
  hasEarningsArchive,
  type EarningsSentimentResult,
  type QuarterSentiment
} from '../services/providers/earningsCalls';
import type { SentimentScore } from '../lib/sentiment';
import { Card, EmptyState, ErrorState, GeneratedBadge, Pill, Section, Skeleton } from './ui/primitives';
import { formatDate, formatPercent } from '../lib/format';

const TONE_PILL = { positive: 'green', neutral: 'slate', negative: 'red' } as const;

function polarityBar(score: SentimentScore | null, label: string) {
  const polarity = score?.polarity ?? null;
  const width = polarity === null ? 0 : Math.min(Math.abs(polarity), 1) * 50;

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-24 shrink-0 text-slate-600">{label}</span>
      <div className="relative h-3.5 flex-1">
        <span className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-300" aria-hidden />
        {polarity !== null ? (
          <span
            className={`absolute top-0.5 bottom-0.5 rounded-sm ${polarity >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
            style={polarity >= 0 ? { left: '50%', width: `${width}%` } : { right: '50%', width: `${width}%` }}
          />
        ) : null}
      </div>
      <span className="w-14 shrink-0 text-right tabular-nums text-slate-700">
        {polarity === null ? 'n/a' : polarity.toFixed(2)}
      </span>
    </div>
  );
}

function QuarterCard({ quarter, isLatest }: { quarter: QuarterSentiment; isLatest: boolean }) {
  const { overall } = quarter;

  return (
    <div className={`rounded-lg border p-4 ${isLatest ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200'}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-900">
          {formatDate(quarter.date)}
          {isLatest ? <span className="ml-2 text-xs font-normal text-blue-700">most recent</span> : null}
        </h4>
        <Pill tone={TONE_PILL[overall.label]}>{overall.label}</Pill>
      </div>

      <div className="mt-3 space-y-1.5">
        {polarityBar(overall, 'Whole call')}
        {polarityBar(quarter.management, 'Management')}
        {polarityBar(quarter.analyst, 'Analysts')}
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-2.5 text-xs">
        <div>
          <dt className="text-slate-500">Hedging</dt>
          <dd className="font-semibold tabular-nums text-slate-800">{formatPercent(overall.uncertaintyRate, 2)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Legal talk</dt>
          <dd className="font-semibold tabular-nums text-slate-800">{formatPercent(overall.litigiousRate, 2)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Statements</dt>
          <dd className="font-semibold tabular-nums text-slate-800">{quarter.lines}</dd>
        </div>
      </dl>
    </div>
  );
}

function Highlight({ line, tone }: { line: NonNullable<QuarterSentiment['highlight']['positive']>; tone: 'positive' | 'negative' }) {
  const text = line.text.length > 420 ? `${line.text.slice(0, 420)}…` : line.text;
  return (
    <div className={`rounded-lg border-l-4 bg-slate-50 p-3 ${tone === 'positive' ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <Quote className="h-3 w-3" aria-hidden />
        Most {tone} passage
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-700">&ldquo;{text}&rdquo;</p>
      <p className="mt-1.5 text-xs text-slate-500">
        — {line.speaker}
        {line.title ? `, ${line.title}` : ''}
      </p>
    </div>
  );
}

export function EarningsSentiment({ symbol }: { symbol: string }) {
  const [result, setResult] = useState<EarningsSentimentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setError(null);

    if (!hasEarningsArchive(symbol)) return;

    setLoading(true);
    fetchEarningsSentiment(symbol)
      .then((value) => {
        if (!cancelled) setResult(value);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const subtitle =
    'Scored with a finance-specific word list. General sentiment lexicons read "liability", "cost" and "depreciation" as negative, which on an earnings call mostly measures how much accounting was discussed.';

  if (!hasEarningsArchive(symbol)) {
    return (
      <Section id="earnings-sentiment" title="Earnings call sentiment" subtitle={subtitle}>
        <EmptyState
          title={`No transcripts archived for ${symbol}`}
          detail="The course archive covers S&P 500 companies. Commercial transcript APIs, Finnhub's included, keep this behind a paid plan."
        />
      </Section>
    );
  }

  const latest = result?.quarters[result.quarters.length - 1] ?? null;

  return (
    <Section
      id="earnings-sentiment"
      title="Earnings call sentiment"
      subtitle={subtitle}
      action={<GeneratedBadge label="Computed on this page" />}
    >
      {loading ? (
        <div className="grid gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : null}

      {error ? <ErrorState title="Could not load transcripts" detail={error} /> : null}

      {result ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {result.quarters.map((quarter, i) => (
              <QuarterCard key={quarter.date} quarter={quarter} isLatest={i === result.quarters.length - 1} />
            ))}
          </div>

          {latest ? (
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-slate-900">
                From the {formatDate(latest.date)} call
              </h3>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {latest.highlight.positive ? <Highlight line={latest.highlight.positive} tone="positive" /> : null}
                {latest.highlight.negative ? <Highlight line={latest.highlight.negative} tone="negative" /> : null}
              </div>

              <p className="mt-3 border-t border-slate-100 pt-2.5 text-xs leading-relaxed text-slate-500">
                Polarity is (positive − negative) ÷ (positive + negative) word counts, from −1 to +1. Management
                normally scores higher than analysts on any call — they are presenting, the analysts are probing — so
                the useful signal is the gap between the two and how it moves quarter to quarter, not either number on
                its own. This is a word-count model: it cannot read sarcasm, negation or context.
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Mic className="h-3 w-3" aria-hidden /> Transcripts:{' '}
                  <a
                    href="https://github.com/kwartler/vienna-genai-finance-course/tree/main/earnings_call_archive/transcripts_sp500_marketbeat"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-blue-700 hover:underline"
                  >
                    course S&amp;P 500 archive <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                </span>
                {result.failed.length ? <span>⚠ {result.failed.length} quarter(s) failed to load.</span> : null}
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}
    </Section>
  );
}
