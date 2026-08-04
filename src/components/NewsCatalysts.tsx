import { CalendarClock, ExternalLink, Gavel, Package, Scale } from 'lucide-react';
import type { CatalystKind, CompanyDossier, NewsSentiment } from '../types';
import { Card, EmptyState, GeneratedBadge, Pill, Section } from './ui/primitives';
import { formatDate, formatDateTime } from '../lib/format';

const SENTIMENT_TONE: Record<NewsSentiment, 'green' | 'slate' | 'red'> = {
  positive: 'green',
  neutral: 'slate',
  negative: 'red'
};

const CATALYST_ICON: Record<CatalystKind, typeof Package> = {
  earnings: CalendarClock,
  product: Package,
  regulatory: Scale,
  litigation: Gavel,
  other: Package
};

export function NewsCatalysts({ dossier }: { dossier: CompanyDossier }) {
  const { news, catalysts } = dossier;

  return (
    <Section
      id="news"
      title="News and catalysts"
      subtitle="Headlines are reported facts from the publications named. Sentiment labels are model output, marked as such."
    >
      <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">Recent coverage</h3>
            <GeneratedBadge label="Sentiment is model-scored" />
          </div>

          {news.length ? (
            <ul className="mt-3 divide-y divide-slate-100">
              {news.map((item) => (
                <li key={item.id} className="py-3 first:pt-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold tracking-wide text-slate-700 uppercase">{item.publication}</span>
                    <span>{formatDateTime(item.publishedAt)}</span>
                    <Pill tone={SENTIMENT_TONE[item.sentiment]}>{item.sentiment}</Pill>
                  </div>
                  <h4 className="mt-1 text-sm font-medium text-slate-900">
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {item.headline}
                        <ExternalLink className="ml-1 inline h-3 w-3 align-baseline text-slate-400" aria-hidden />
                      </a>
                    ) : (
                      item.headline
                    )}
                  </h4>
                  {item.summary ? <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.summary}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3">
              <EmptyState title="No recent coverage returned" detail="The provider had no articles for this ticker." />
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold text-slate-900">Upcoming catalysts and known risks</h3>
          {catalysts.length ? (
            <ul className="mt-3 space-y-3">
              {catalysts.map((catalyst) => {
                const Icon = CATALYST_ICON[catalyst.kind];
                return (
                  <li key={catalyst.id} className="flex gap-3">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    <div>
                      <div className="flex flex-wrap items-baseline gap-2">
                        <h4 className="text-sm font-medium text-slate-900">{catalyst.title}</h4>
                        <span className="text-xs text-slate-500">
                          {catalyst.expectedDate ? formatDate(catalyst.expectedDate) : 'no fixed date'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{catalyst.detail}</p>
                      <p className="mt-0.5 text-xs text-slate-400">Source: {catalyst.source}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-3">
              <EmptyState
                title="No catalysts compiled"
                detail="Catalysts are curated for the sample companies. The live provider does not supply a structured catalyst feed."
              />
            </div>
          )}
        </Card>
      </div>
    </Section>
  );
}
