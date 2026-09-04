import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, RotateCcw, Sparkles } from 'lucide-react';
import type { CompanyDossier } from '../types';
import type { ModelScore } from '../lib/scoring';
import { buildThesisDraft, thesisToText, type Horizon, type RiskTolerance, type ThesisDraft } from '../lib/thesis';
import { getKeys } from '../services/keys';
import { THESIS_MODEL, writeThesisWithAi } from '../services/providers/openRouter';
import type { EarningsSentimentResult } from '../services/providers/earningsCalls';
import { Card, GeneratedBadge, Pill, Section } from './ui/primitives';

const FIELDS: Array<{ key: keyof ThesisDraft; label: string; rows: number }> = [
  { key: 'bull', label: 'Bull case', rows: 4 },
  { key: 'base', label: 'Base case', rows: 4 },
  { key: 'bear', label: 'Bear case', rows: 4 },
  { key: 'assumptions', label: 'Key assumptions', rows: 4 },
  { key: 'catalysts', label: 'Potential catalysts', rows: 4 },
  { key: 'risks', label: 'Principal risks', rows: 4 },
  { key: 'invalidation', label: 'What would invalidate this thesis', rows: 3 }
];

const HORIZONS: Horizon[] = ['6 months', '1-2 years', '3-5 years'];
const RISK_LEVELS: RiskTolerance[] = ['conservative', 'balanced', 'aggressive'];

export function ThesisBuilder({
  dossier,
  score,
  sentiment
}: {
  dossier: CompanyDossier;
  score: ModelScore;
  sentiment: EarningsSentimentResult | null;
}) {
  const [horizon, setHorizon] = useState<Horizon>('1-2 years');
  const [risk, setRisk] = useState<RiskTolerance>('balanced');
  const [copied, setCopied] = useState(false);
  const [aiState, setAiState] = useState<'idle' | 'writing' | 'done' | 'error'>('idle');
  const [aiError, setAiError] = useState<string | null>(null);
  const hasAiKey = Boolean(getKeys().openRouter);

  const generated = useMemo(
    () => buildThesisDraft(dossier, score, horizon, risk),
    [dossier, score, horizon, risk]
  );
  const [draft, setDraft] = useState<ThesisDraft>(generated);

  // Regenerating on ticker or setting changes replaces the draft, which also
  // discards edits — the reset button makes that explicit rather than surprising.
  useEffect(() => {
    setDraft(generated);
    setAiState('idle');
  }, [generated]);

  async function writeWithAi() {
    const key = getKeys().openRouter;
    if (!key) return;
    setAiState('writing');
    setAiError(null);
    try {
      setDraft(await writeThesisWithAi(key, dossier, score, sentiment, horizon, risk));
      setAiState('done');
    } catch (err) {
      setAiError((err as Error).message);
      setAiState('error');
    }
  }

  async function copy() {
    const text = thesisToText(dossier.profile.symbol, dossier.profile.name, draft, horizon, risk);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context or denied permission): fall back to
      // a download so the export still works.
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${dossier.profile.symbol}-thesis.txt`;
      link.click();
      URL.revokeObjectURL(url);
    }
  }

  return (
    <Section
      id="thesis"
      title="Investment thesis builder"
      subtitle={
        hasAiKey
          ? 'Template draft from the figures on this page, or let the model write one from the whole dossier. Every field stays editable.'
          : 'Template draft assembled from the figures on this page. Add an OpenRouter key to have a model write it from the whole dossier. Every field stays editable.'
      }
      action={aiState === 'done' ? <GeneratedBadge label={`AI-generated · ${THESIS_MODEL}`} /> : <GeneratedBadge label="Template draft" />}
    >
      <Card className="p-5">
        <div className="flex flex-wrap items-end gap-5">
          <fieldset>
            <legend className="text-xs font-medium tracking-wide text-slate-500 uppercase">Investment horizon</legend>
            <div className="mt-1.5 inline-flex overflow-hidden rounded-lg border border-slate-300">
              {HORIZONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={horizon === option}
                  onClick={() => setHorizon(option)}
                  className={`px-3 py-1.5 text-xs font-semibold transition ${horizon === option ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-medium tracking-wide text-slate-500 uppercase">Risk tolerance</legend>
            <div className="mt-1.5 inline-flex overflow-hidden rounded-lg border border-slate-300">
              {RISK_LEVELS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={risk === option}
                  onClick={() => setRisk(option)}
                  className={`px-3 py-1.5 text-xs font-semibold capitalize transition ${risk === option ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="ml-auto flex flex-wrap gap-2">
            {hasAiKey ? (
              <button
                type="button"
                onClick={writeWithAi}
                disabled={aiState === 'writing'}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100 disabled:opacity-60"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {aiState === 'writing' ? 'Writing…' : 'Write with AI'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setDraft(generated);
                setAiState('idle');
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset to draft
            </button>
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
              {copied ? 'Copied' : 'Copy summary'}
            </button>
          </div>
        </div>

        {aiState === 'error' && aiError ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">AI draft failed: {aiError}</p>
        ) : null}
        {aiState === 'done' ? (
          <p className="mt-3 text-xs text-slate-500">
            <Pill tone="amber">AI-generated</Pill> Written by {THESIS_MODEL} from the data on this page only. Check every
            number against the sections above before you use it.
          </p>
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {FIELDS.map((field) => (
            <div key={field.key} className={field.key === 'invalidation' ? 'md:col-span-2' : ''}>
              <label htmlFor={`thesis-${field.key}`} className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {field.label}
              </label>
              <textarea
                id={`thesis-${field.key}`}
                rows={field.rows}
                value={draft[field.key]}
                onChange={(e) => setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))}
                className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed text-slate-800"
              />
            </div>
          ))}
        </div>
      </Card>
    </Section>
  );
}
