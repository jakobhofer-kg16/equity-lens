import { BookOpen, Clock, Dices, Flame, Globe2, TrendingUp } from 'lucide-react';
import type { CompanyDossier } from '../types';
import { buildFunFacts, type FunFact } from '../lib/funFacts';
import { Card, Pill, Section } from './ui/primitives';

const ICONS = {
  chart: TrendingUp,
  globe: Globe2,
  clock: Clock,
  dice: Dices,
  flame: Flame,
  book: BookOpen
} as const;

export function FunFacts({ dossier }: { dossier: CompanyDossier }) {
  const facts: FunFact[] = buildFunFacts(dossier);
  if (!facts.length) return null;

  return (
    <Section
      id="fun-facts"
      title="Fun facts"
      subtitle="Arithmetic curiosities computed from the loaded data. Entertainment only — none of this feeds the score or the thesis."
      action={<Pill tone="slate">Not analysis</Pill>}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map((fact, i) => {
          const Icon = ICONS[fact.icon];
          return (
            <Card key={i} className="flex gap-3 p-4">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <div>
                <p className="text-sm leading-relaxed text-slate-700">{fact.text}</p>
                <p className="mt-1.5 text-[11px] text-slate-400">Computed from the data on this page</p>
              </div>
            </Card>
          );
        })}
      </div>
    </Section>
  );
}
