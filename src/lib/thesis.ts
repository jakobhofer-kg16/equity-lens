/**
 * Seeds the editable thesis from the loaded data.
 *
 * These are template sentences filled with the company's own numbers, not model
 * prose — the UI labels the section as a generated starting point and every
 * field stays editable.
 */

import type { CompanyDossier } from '../types';
import type { ModelScore } from './scoring';
import { formatPercent, formatMultiple, formatCurrency } from './format';

export type Horizon = '6 months' | '1-2 years' | '3-5 years';
export type RiskTolerance = 'conservative' | 'balanced' | 'aggressive';

export interface ThesisDraft {
  bull: string;
  base: string;
  bear: string;
  assumptions: string;
  catalysts: string;
  risks: string;
  invalidation: string;
}

export function buildThesisDraft(
  dossier: CompanyDossier,
  score: ModelScore,
  horizon: Horizon,
  risk: RiskTolerance
): ThesisDraft {
  const { profile, ratios, quote, priceTargets } = dossier;
  const name = profile.name;
  const ranked = score.categories.filter((c) => c.score !== null).sort((a, b) => (b.score as number) - (a.score as number));
  const strongest = ranked[0];
  const weakest = ranked[ranked.length - 1];

  const upside = priceTargets?.median && quote.price ? priceTargets.median / quote.price - 1 : null;

  const sizing =
    risk === 'conservative'
      ? 'Sized small and only alongside a position you already understand.'
      : risk === 'aggressive'
        ? 'Sized to matter, accepting that the drawdown could be severe.'
        : 'Sized as a normal position, added to in tranches rather than at once.';

  return {
    bull: `${name} keeps ${strongest ? strongest.label.toLowerCase() : 'its current operating performance'} intact over the next ${horizon}, revenue growth holds near ${formatPercent(ratios.revenueGrowthYoY)}, and the market continues to pay ${formatMultiple(ratios.trailingPE)} trailing earnings for that consistency. In this case the shares track towards the upper end of the analyst target range rather than the median.`,
    base: `Operating performance stays roughly where it is, with margins near ${formatPercent(ratios.operatingMargin)} and no multiple re-rating in either direction. Returns over ${horizon} come from earnings growth alone${upside !== null ? `, broadly consistent with the ${formatPercent(upside, 1, true)} implied by the median analyst target` : ''}. ${sizing}`,
    bear: `${weakest ? `${weakest.label} deteriorates further` : 'Operating performance deteriorates'} and the multiple compresses towards the sector median. At ${formatMultiple(ratios.trailingPE)} trailing earnings there is little valuation support, so a growth disappointment is felt twice — once in earnings and once in the multiple.`,
    assumptions: [
      `Revenue growth stays within a few points of ${formatPercent(ratios.revenueGrowthYoY)}.`,
      `Operating margin holds near ${formatPercent(ratios.operatingMargin)}.`,
      `No material change to the capital structure (debt/equity currently ${ratios.debtToEquity !== null ? ratios.debtToEquity.toFixed(2) : 'n/a'}).`,
      'The sector multiple does not de-rate broadly.'
    ].join('\n'),
    catalysts:
      dossier.catalysts.length > 0
        ? dossier.catalysts.map((c) => `${c.title}: ${c.detail}`).join('\n')
        : `Next earnings report${dossier.earnings.nextEarningsDate ? ` on ${dossier.earnings.nextEarningsDate}` : ''}.`,
    risks: score.risks.map((r) => `${r.label} at ${r.formatted} — ${r.band}.`).join('\n'),
    invalidation: `Two consecutive quarters of revenue growth below zero, operating margin falling more than 300bp from ${formatPercent(ratios.operatingMargin)}, or the share price closing below ${formatCurrency(quote.price * 0.75, profile.currency)} on deteriorating fundamentals rather than a market-wide drawdown.`
  };
}

export function thesisToText(
  symbol: string,
  name: string,
  draft: ThesisDraft,
  horizon: Horizon,
  risk: RiskTolerance
): string {
  return [
    `INVESTMENT THESIS — ${name} (${symbol})`,
    `Horizon: ${horizon}   Risk tolerance: ${risk}`,
    '',
    'BULL CASE',
    draft.bull,
    '',
    'BASE CASE',
    draft.base,
    '',
    'BEAR CASE',
    draft.bear,
    '',
    'KEY ASSUMPTIONS',
    draft.assumptions,
    '',
    'POTENTIAL CATALYSTS',
    draft.catalysts,
    '',
    'PRINCIPAL RISKS',
    draft.risks,
    '',
    'WHAT WOULD INVALIDATE THIS',
    draft.invalidation,
    '',
    'Educational use only. Not personalized financial or investment advice.'
  ].join('\n');
}
