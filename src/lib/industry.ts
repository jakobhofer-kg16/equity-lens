/**
 * Industry comparison and alternative ranking.
 *
 * Two separate questions are answered here, and they are deliberately kept
 * apart: how the selected stock has *performed* against its industry, and which
 * names in that industry look better on *fundamentals*. A stock can lag its
 * industry badly and still be the strongest business in it.
 *
 * The ranking uses the same philosophy as the main score — growth,
 * profitability and valuation against the sector median — but a reduced metric
 * set, because that is all a comparison universe realistically carries. It is
 * scored separately rather than reusing scoreCompany(), which needs a full
 * dossier per company.
 */

import type { CompanyDossier, PeerCompany } from '../types';
import { UNIVERSE, universeFor, type UniverseEntry } from '../data/universe';
import { computeMomentumInput } from './scoring';

const UNIVERSE_BY_SYMBOL = new Map(UNIVERSE.map((entry) => [entry.symbol, entry]));

function median(values: number[]): number | null {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function scale(value: number, atZero: number, atHundred: number): number {
  return Math.max(0, Math.min(100, ((value - atZero) / (atHundred - atZero)) * 100));
}

export interface IndustryPerformance {
  sector: string | null;
  industry: string | null;
  stockReturn: number | null;
  industryMedianReturn: number | null;
  /** Stock return minus industry median. Positive means outperformance. */
  spread: number | null;
  constituents: Array<{ symbol: string; name: string; oneYearReturn: number | null }>;
}

export function industryPerformance(dossier: CompanyDossier): IndustryPerformance {
  const { profile } = dossier;
  const peers = universeFor(profile.sector, profile.symbol);

  // Peer returns come from the curated universe. Taking the selected company's
  // return from its price series instead would compare two different sources
  // and produce a spread that is an artefact of the mismatch, so the universe
  // figure wins when there is one and the series is only the fallback.
  const own = UNIVERSE_BY_SYMBOL.get(profile.symbol.toUpperCase());
  const stockReturn = own?.oneYearReturn ?? computeMomentumInput(dossier).oneYearReturn;

  const returns = peers.map((p) => p.oneYearReturn).filter((v): v is number => v !== null);
  const industryMedianReturn = median(returns);

  return {
    sector: profile.sector,
    industry: profile.industry,
    stockReturn,
    industryMedianReturn,
    spread:
      stockReturn !== null && industryMedianReturn !== null ? stockReturn - industryMedianReturn : null,
    constituents: [
      { symbol: profile.symbol, name: profile.name, oneYearReturn: stockReturn },
      ...peers.map((p) => ({ symbol: p.symbol, name: p.name, oneYearReturn: p.oneYearReturn }))
    ].sort((a, b) => (b.oneYearReturn ?? -Infinity) - (a.oneYearReturn ?? -Infinity))
  };
}

export interface AlternativeScore {
  symbol: string;
  name: string;
  industry: string;
  score: number;
  /** Sub-scores, so the ranking can be argued with rather than trusted. */
  parts: { growth: number | null; profitability: number | null; valuation: number | null };
  metrics: Pick<PeerCompany, 'revenueGrowthYoY' | 'operatingMargin' | 'returnOnEquity' | 'trailingPE' | 'evToEbitda' | 'oneYearReturn'>;
  /** One sentence naming the reason this name ranked where it did. */
  rationale: string;
}

function scoreEntry(
  entry: UniverseEntry,
  medians: { trailingPE: number | null; evToEbitda: number | null }
): AlternativeScore {
  const growthParts = [
    entry.revenueGrowthYoY !== null ? scale(entry.revenueGrowthYoY, -0.05, 0.25) : null
  ].filter((v): v is number => v !== null);

  const profitParts = [
    entry.operatingMargin !== null ? scale(entry.operatingMargin, 0, 0.3) : null,
    entry.returnOnEquity !== null ? scale(entry.returnOnEquity, 0, 0.3) : null
  ].filter((v): v is number => v !== null);

  // Loss-making or unpriceable names score 0 on valuation rather than being
  // excluded — "no P/E because there are no earnings" is information, not a gap.
  const valuationParts: number[] = [];
  if (medians.trailingPE && entry.trailingPE) {
    valuationParts.push(scale(entry.trailingPE / medians.trailingPE, 1.6, 0.6));
  } else if (entry.trailingPE === null || Number.isNaN(entry.trailingPE)) {
    valuationParts.push(0);
  }
  if (medians.evToEbitda && entry.evToEbitda) {
    valuationParts.push(scale(entry.evToEbitda / medians.evToEbitda, 1.6, 0.6));
  }

  const avg = (parts: number[]) => (parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null);
  const growth = avg(growthParts);
  const profitability = avg(profitParts);
  const valuation = avg(valuationParts);

  // Same relative emphasis as the main model, renormalized over what exists.
  const weighted: Array<[number | null, number]> = [
    [growth, 0.35],
    [profitability, 0.35],
    [valuation, 0.3]
  ];
  const available = weighted.filter(([value]) => value !== null);
  const weightSum = available.reduce((sum, [, w]) => sum + w, 0);
  const score = weightSum
    ? Math.round(available.reduce((sum, [value, w]) => sum + (value as number) * w, 0) / weightSum)
    : 0;

  const ranked = [
    ['growth', growth],
    ['profitability', profitability],
    ['valuation', valuation]
  ]
    .filter((entryPair): entryPair is [string, number] => entryPair[1] !== null)
    .sort((a, b) => b[1] - a[1]);

  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const rationale =
    best && worst && best[0] !== worst[0]
      ? `Strongest on ${best[0]}, weakest on ${worst[0]}.`
      : best
        ? `Ranked mainly on ${best[0]}.`
        : 'Too little data to rank confidently.';

  return {
    symbol: entry.symbol,
    name: entry.name,
    industry: entry.industry,
    score,
    parts: {
      growth: growth === null ? null : Math.round(growth),
      profitability: profitability === null ? null : Math.round(profitability),
      valuation: valuation === null ? null : Math.round(valuation)
    },
    metrics: {
      revenueGrowthYoY: entry.revenueGrowthYoY,
      operatingMargin: entry.operatingMargin,
      returnOnEquity: entry.returnOnEquity,
      trailingPE: entry.trailingPE,
      evToEbitda: entry.evToEbitda,
      oneYearReturn: entry.oneYearReturn
    },
    rationale
  };
}

export function topAlternatives(dossier: CompanyDossier, count = 3): AlternativeScore[] {
  const candidates = universeFor(dossier.profile.sector, dossier.profile.symbol);
  if (!candidates.length) return [];

  const medians = {
    trailingPE: dossier.peers.sectorMedian.trailingPE ?? median(candidates.map((c) => c.trailingPE).filter(Boolean) as number[]),
    evToEbitda: dossier.peers.sectorMedian.evToEbitda ?? median(candidates.map((c) => c.evToEbitda).filter(Boolean) as number[])
  };

  return candidates
    .map((entry) => scoreEntry(entry, medians))
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}
