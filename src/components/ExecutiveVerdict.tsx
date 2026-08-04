import { useState } from 'react';
import { ChevronDown, ShieldAlert, Sparkles, TrendingUp } from 'lucide-react';
import type { ModelScore } from '../lib/scoring';
import { CATEGORY_WEIGHTS } from '../lib/scoring';
import { Card, GeneratedBadge, Pill, Section } from './ui/primitives';
import { formatPercent } from '../lib/format';

const TONE = {
  Bullish: { pill: 'green', bar: 'bg-emerald-500', text: 'text-emerald-700' },
  Watch: { pill: 'amber', bar: 'bg-amber-500', text: 'text-amber-700' },
  Bearish: { pill: 'red', bar: 'bg-red-500', text: 'text-red-700' }
} as const;

export function ExecutiveVerdict({ score, symbol }: { score: ModelScore; symbol: string }) {
  const [open, setOpen] = useState(false);
  const tone = TONE[score.classification];

  return (
    <Section
      id="verdict"
      title="Executive verdict"
      subtitle="Our own model. Deliberately excludes analyst opinions so the two can be compared independently."
      action={<GeneratedBadge label="Model output" />}
    >
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-center gap-5">
            <div className="text-center">
              <div className={`text-5xl font-bold tracking-tight tabular-nums ${tone.text}`}>{score.total}</div>
              <div className="text-xs tracking-wide text-slate-500 uppercase">out of 100</div>
            </div>
            <div>
              <Pill tone={tone.pill}>{score.classification.toUpperCase()}</Pill>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-700">{score.summary}</p>
              <p className="mt-1.5 text-xs text-slate-500">
                Confidence: <strong className="font-semibold text-slate-700">{score.confidence}</strong> — {formatPercent(score.coverage, 0)} of
                the model&rsquo;s metrics had usable data for {symbol}.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> Three strengths
            </h4>
            <ul className="mt-2 space-y-1.5">
              {score.strengths.map((m) => (
                <li key={m.label} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-slate-700">{m.label}</span>
                  <span className="shrink-0 font-medium tabular-nums text-slate-900">{m.formatted}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <ShieldAlert className="h-3.5 w-3.5 text-red-600" aria-hidden /> Three risks
            </h4>
            <ul className="mt-2 space-y-1.5">
              {score.risks.map((m) => (
                <li key={m.label} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-slate-700">{m.label}</span>
                  <span className="shrink-0 font-medium tabular-nums text-slate-900">{m.formatted}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {open ? 'Hide' : 'Show'} how this score is built
          <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>

        {open ? (
          <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
            <p className="text-sm text-slate-600">
              Each category is the average of its metrics, then the categories are combined with the weights below. A
              category with no data is dropped and its weight is spread over the rest, rather than counted as zero.
              These bands are chosen for teaching, not calibrated against returns.
            </p>
            {score.categories.map((category) => (
              <div key={category.key}>
                <div className="flex items-center justify-between gap-3">
                  <h5 className="text-sm font-semibold text-slate-800">
                    {category.label}{' '}
                    <span className="font-normal text-slate-500">
                      · weight {formatPercent(CATEGORY_WEIGHTS[category.key], 0)}
                    </span>
                  </h5>
                  <span className="text-sm font-semibold tabular-nums text-slate-900">
                    {category.score !== null ? category.score : 'no data'}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className={`h-full ${tone.bar}`} style={{ width: `${category.score ?? 0}%` }} />
                </div>
                <ul className="mt-2 space-y-1">
                  {category.metrics.map((metric) => (
                    <li key={metric.label} className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
                      <span className="text-slate-600">{metric.label}</span>
                      <span className="text-slate-400">{metric.band}</span>
                      <span className="w-24 text-right font-medium tabular-nums text-slate-800">
                        {metric.formatted}
                        {metric.score !== null ? <span className="text-slate-400"> → {metric.score}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
      </Card>
    </Section>
  );
}
