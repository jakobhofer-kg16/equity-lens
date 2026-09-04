/**
 * Industry comparison and alternative ranking, on the real peer set.
 *
 * Two separate questions, kept apart: how the selected stock has *performed*
 * against its peers, and which peers look better on *fundamentals*. A laggard
 * can still be the strongest business in the group.
 *
 * The ranking uses the same emphasis as the main score — growth, profitability
 * and valuation against the peer median — on the reduced metric set a peer
 * record carries.
 */

import type { CompanyDossier, PeerCompany } from '../types';
import { median } from '../services/providers/finnhub';

function scale(value: number, atZero: number, atHundred: number): number {
  return Math.max(0, Math.min(100, ((value - atZero) / (atHundred - atZero)) * 100));
}

export interface IndustryPerformance {
  sector: string | null;
  stockReturn: number | null;
  peerMedianReturn: number | null;
  /** Stock return minus peer median. Positive means outperformance. */
  spread: number | null;
  constituents: Array<{ symbol: string; name: string; oneYearReturn: number | null }>;
}

/**
 * The company's own return comes from the same Finnhub field as the peers'
 * (52-week price return), so the comparison uses one definition. The price
 * series is only the fallback.
 */
function ownReturn(dossier: CompanyDossier): number | null {
  const fromProvider = dossier.peers.self?.oneYearReturn ?? null;
  if (fromProvider !== null) return fromProvider;
  const bars = dossier.prices.bars;
  if (bars.length < 240) return null;
  const last = bars[bars.length - 1].close;
  const yearAgo = bars[Math.max(0, bars.length - 253)].close;
  return yearAgo > 0 ? last / yearAgo - 1 : null;
}

export function industryPerformance(dossier: CompanyDossier): IndustryPerformance {
  const { profile, peers } = dossier;
  const stockReturn = ownReturn(dossier);
  const returns = peers.peers.map((p) => p.oneYearReturn);
  const peerMedianReturn = median(returns.map((r) => (r === null ? null : r + 1)));
  const medianReturn = peerMedianReturn === null ? null : peerMedianReturn - 1;

  return {
    sector: profile.sector,
    stockReturn,
    peerMedianReturn: medianReturn,
    spread: stockReturn !== null && medianReturn !== null ? stockReturn - medianReturn : null,
    constituents: [
      { symbol: profile.symbol, name: profile.name, oneYearReturn: stockReturn },
      ...peers.peers.map((p) => ({ symbol: p.symbol, name: p.name, oneYearReturn: p.oneYearReturn }))
    ].sort((a, b) => (b.oneYearReturn ?? -Infinity) - (a.oneYearReturn ?? -Infinity))
  };
}

export interface AlternativeScore {
  symbol: string;
  name: string;
  score: number;
  parts: { growth: number | null; profitability: number | null; valuation: number | null };
  metrics: Pick<PeerCompany, 'revenueGrowthYoY' | 'operatingMargin' | 'returnOnEquity' | 'trailingPE' | 'evToEbitda' | 'oneYearReturn'>;
  rationale: string;
}

export function scorePeer(
  entry: PeerCompany,
  medians: { trailingPE: number | null; evToEbitda: number | null }
): AlternativeScore {
  const avg = (parts: Array<number | null>) => {
    const valid = parts.filter((v): v is number => v !== null);
    return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
  };

  const growth = avg([entry.revenueGrowthYoY !== null ? scale(entry.revenueGrowthYoY, -0.05, 0.25) : null]);
  const profitability = avg([
    entry.operatingMargin !== null ? scale(entry.operatingMargin, 0, 0.3) : null,
    entry.returnOnEquity !== null ? scale(entry.returnOnEquity, 0, 0.3) : null
  ]);

  // A company with no P/E has no earnings; that scores 0 rather than being
  // skipped, because it is information, not a gap.
  const valuationParts: Array<number | null> = [];
  if (medians.trailingPE) {
    valuationParts.push(entry.trailingPE && entry.trailingPE > 0 ? scale(entry.trailingPE / medians.trailingPE, 1.6, 0.6) : 0);
  }
  if (medians.evToEbitda && entry.evToEbitda && entry.evToEbitda > 0) {
    valuationParts.push(scale(entry.evToEbitda / medians.evToEbitda, 1.6, 0.6));
  }
  const valuation = avg(valuationParts);

  const weighted: Array<[number | null, number]> = [
    [growth, 0.35],
    [profitability, 0.35],
    [valuation, 0.3]
  ];
  const available = weighted.filter(([v]) => v !== null);
  const weightSum = available.reduce((s, [, w]) => s + w, 0);
  const score = weightSum ? Math.round(available.reduce((s, [v, w]) => s + (v as number) * w, 0) / weightSum) : 0;

  const ranked = (
    [
      ['growth', growth],
      ['profitability', profitability],
      ['valuation', valuation]
    ] as Array<[string, number | null]>
  )
    .filter((pair): pair is [string, number] => pair[1] !== null)
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
  const { peers, peerMedian } = dossier.peers;
  if (!peers.length) return [];
  return peers
    .map((entry) => scorePeer(entry, peerMedian))
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}
