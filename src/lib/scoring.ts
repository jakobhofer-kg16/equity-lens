/**
 * The fundamental scoring model.
 *
 * Deliberately contains NO analyst input. Analyst ratings and price targets are
 * displayed alongside this score but never feed into it — otherwise the app
 * would be validating a score with the same opinions it already absorbed, and
 * the "contrarian signal" comparison would be meaningless.
 *
 * This is an educational model with hand-chosen bands, not an objective
 * valuation. Every band below is stated in the UI so a reader can disagree with
 * a specific threshold rather than with an opaque number.
 */

import type { CompanyDossier, FinancialRatios, PeerSet } from '../types';

export const CATEGORY_WEIGHTS = {
  growth: 0.25,
  profitability: 0.25,
  valuation: 0.2,
  health: 0.15,
  momentum: 0.15
} as const;

export type CategoryKey = keyof typeof CATEGORY_WEIGHTS;

export interface MetricContribution {
  label: string;
  /** Raw value, or null when the provider had nothing meaningful. */
  value: number | null;
  formatted: string;
  /** 0-100, or null when the metric could not be scored. */
  score: number | null;
  /** Plain-language statement of the band that produced the score. */
  band: string;
}

export interface CategoryScore {
  key: CategoryKey;
  label: string;
  weight: number;
  /** 0-100, or null when no metric in the category had data. */
  score: number | null;
  metrics: MetricContribution[];
}

export type Classification = 'Bullish' | 'Watch' | 'Bearish';
export type Confidence = 'high' | 'medium' | 'low';

export interface ModelScore {
  total: number;
  classification: Classification;
  confidence: Confidence;
  /** Share of model metrics that had usable data, 0-1. */
  coverage: number;
  summary: string;
  strengths: MetricContribution[];
  risks: MetricContribution[];
  categories: CategoryScore[];
}

/** Linear score between two anchors, clamped to 0-100. */
function scale(value: number, atZero: number, atHundred: number): number {
  const raw = ((value - atZero) / (atHundred - atZero)) * 100;
  return Math.max(0, Math.min(100, raw));
}

interface MetricSpec {
  label: string;
  value: number | null;
  format: (v: number) => string;
  /** Anchors: the value scoring 0 and the value scoring 100. */
  atZero: number;
  atHundred: number;
  band: string;
}

function buildMetric(spec: MetricSpec): MetricContribution {
  if (spec.value === null || !Number.isFinite(spec.value)) {
    return { label: spec.label, value: null, formatted: 'n/a', score: null, band: spec.band };
  }
  return {
    label: spec.label,
    value: spec.value,
    formatted: spec.format(spec.value),
    score: Math.round(scale(spec.value, spec.atZero, spec.atHundred)),
    band: spec.band
  };
}

function averageScore(metrics: MetricContribution[]): number | null {
  const scored = metrics.filter((m) => m.score !== null);
  if (!scored.length) return null;
  return Math.round(scored.reduce((sum, m) => sum + (m.score as number), 0) / scored.length);
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const mult = (v: number) => `${v.toFixed(1)}x`;
const ratio = (v: number) => v.toFixed(2);

/** Price-derived inputs for the momentum category. */
export interface MomentumInput {
  oneYearReturn: number | null;
  /** Position within the 52-week range, 0 = at the low, 1 = at the high. */
  range52Position: number | null;
  priceVs200dma: number | null;
}

/**
 * Valuation is scored relative to the median of the real peer set, not against
 * an absolute multiple, because "expensive" only means anything next to a
 * comparison set.
 */
function relativeToMedian(value: number | null, median: number | null): number | null {
  if (value === null || median === null || median <= 0 || value <= 0) return null;
  return value / median;
}

/**
 * A one-year return needs a year of bars and a 200-day average needs 200 of
 * them. Computing either over a shorter window and keeping the label would be
 * quietly wrong, so both report null instead — the score then redistributes the
 * weight, and the UI shows "n/a". This matters because Alpha Vantage's free tier
 * only returns 100 daily bars.
 */
const BARS_FOR_ONE_YEAR = 240;
const BARS_FOR_200DMA = 200;

export function computeMomentumInput(dossier: CompanyDossier): MomentumInput {
  const bars = dossier.prices.bars;
  const quote = dossier.quote;
  if (!bars.length) {
    return { oneYearReturn: null, range52Position: null, priceVs200dma: null };
  }

  const last = bars[bars.length - 1].close;
  const yearAgo = bars.length >= BARS_FOR_ONE_YEAR ? bars[bars.length - 253]?.close ?? bars[0].close : null;
  const oneYearReturn = yearAgo && yearAgo > 0 ? last / yearAgo - 1 : null;

  // The 52-week range comes from the provider's own overview rather than the
  // series, so it survives a short price history.
  const high = quote.week52High;
  const low = quote.week52Low;
  const range52Position =
    high !== null && low !== null && high > low ? (quote.price - low) / (high - low) : null;

  const window = bars.slice(-BARS_FOR_200DMA);
  const dma200 =
    window.length >= BARS_FOR_200DMA ? window.reduce((sum, b) => sum + b.close, 0) / window.length : null;
  const priceVs200dma = dma200 && dma200 > 0 ? quote.price / dma200 - 1 : null;

  return { oneYearReturn, range52Position, priceVs200dma };
}

function growthCategory(r: FinancialRatios): CategoryScore {
  const metrics = [
    buildMetric({
      label: 'Revenue growth (YoY)',
      value: r.revenueGrowthYoY,
      format: pct,
      atZero: -0.05,
      atHundred: 0.25,
      band: '-5% scores 0, +25% scores 100'
    }),
    buildMetric({
      label: 'Revenue CAGR (3y)',
      value: r.revenueCagr3y,
      format: pct,
      atZero: 0,
      atHundred: 0.2,
      band: '0% scores 0, +20% scores 100'
    }),
    buildMetric({
      label: 'Earnings growth (YoY)',
      value: r.earningsGrowthYoY,
      format: pct,
      atZero: -0.1,
      atHundred: 0.25,
      band: '-10% scores 0, +25% scores 100'
    })
  ];
  return { key: 'growth', label: 'Growth', weight: CATEGORY_WEIGHTS.growth, score: averageScore(metrics), metrics };
}

function profitabilityCategory(r: FinancialRatios): CategoryScore {
  const metrics = [
    buildMetric({
      label: 'Operating margin',
      value: r.operatingMargin,
      format: pct,
      atZero: 0,
      atHundred: 0.3,
      band: '0% scores 0, 30% scores 100'
    }),
    buildMetric({
      label: 'Net profit margin',
      value: r.profitMargin,
      format: pct,
      atZero: 0,
      atHundred: 0.25,
      band: '0% scores 0, 25% scores 100'
    }),
    buildMetric({
      label: 'Return on equity',
      value: r.returnOnEquity,
      format: pct,
      atZero: 0,
      atHundred: 0.3,
      band: '0% scores 0, 30% scores 100'
    }),
    buildMetric({
      label: 'Return on invested capital',
      value: r.returnOnInvestedCapital,
      format: pct,
      atZero: 0,
      atHundred: 0.25,
      band: '0% scores 0, 25% scores 100'
    })
  ];
  return {
    key: 'profitability',
    label: 'Profitability',
    weight: CATEGORY_WEIGHTS.profitability,
    score: averageScore(metrics),
    metrics
  };
}

function valuationCategory(r: FinancialRatios, peers: PeerSet): CategoryScore {
  const peRelative = relativeToMedian(r.trailingPE, peers.peerMedian.trailingPE);
  const evRelative = relativeToMedian(r.evToEbitda, peers.peerMedian.evToEbitda);

  const metrics = [
    buildMetric({
      label: 'P/E vs peer median',
      value: peRelative,
      format: (v) => `${v.toFixed(2)}x median`,
      atZero: 1.6,
      atHundred: 0.6,
      band: '60% of the median scores 100, 160% scores 0'
    }),
    buildMetric({
      label: 'EV/EBITDA vs peer median',
      value: evRelative,
      format: (v) => `${v.toFixed(2)}x median`,
      atZero: 1.6,
      atHundred: 0.6,
      band: '60% of the median scores 100, 160% scores 0'
    }),
    buildMetric({
      label: 'Free cash flow yield',
      value: r.freeCashFlowYield,
      format: pct,
      atZero: 0,
      atHundred: 0.08,
      band: '0% scores 0, 8% scores 100'
    }),
    buildMetric({
      label: 'PEG ratio',
      value: r.pegRatio,
      format: ratio,
      atZero: 3,
      atHundred: 0.8,
      band: '0.8 scores 100, 3.0 scores 0'
    })
  ];
  return {
    key: 'valuation',
    label: 'Valuation vs peers',
    weight: CATEGORY_WEIGHTS.valuation,
    score: averageScore(metrics),
    metrics
  };
}

function healthCategory(r: FinancialRatios): CategoryScore {
  const metrics = [
    buildMetric({
      label: 'Debt to equity',
      value: r.debtToEquity,
      format: ratio,
      atZero: 2.5,
      atHundred: 0,
      band: '0.0 scores 100, 2.5 scores 0'
    }),
    buildMetric({
      label: 'Interest coverage',
      value: r.interestCoverage,
      format: mult,
      atZero: 2,
      atHundred: 20,
      band: '2x scores 0, 20x scores 100'
    }),
    buildMetric({
      label: 'Current ratio',
      value: r.currentRatio,
      format: ratio,
      atZero: 0.8,
      atHundred: 2.5,
      band: '0.8 scores 0, 2.5 scores 100'
    })
  ];
  return {
    key: 'health',
    label: 'Financial health',
    weight: CATEGORY_WEIGHTS.health,
    score: averageScore(metrics),
    metrics
  };
}

function momentumCategory(m: MomentumInput): CategoryScore {
  const metrics = [
    buildMetric({
      label: '1-year price return',
      value: m.oneYearReturn,
      format: pct,
      atZero: -0.2,
      atHundred: 0.4,
      band: '-20% scores 0, +40% scores 100'
    }),
    buildMetric({
      label: 'Position in 52-week range',
      value: m.range52Position,
      format: pct,
      atZero: 0,
      atHundred: 1,
      band: 'at the low scores 0, at the high scores 100'
    }),
    buildMetric({
      label: 'Price vs 200-day average',
      value: m.priceVs200dma,
      format: pct,
      atZero: -0.15,
      atHundred: 0.2,
      band: '-15% scores 0, +20% scores 100'
    })
  ];
  return { key: 'momentum', label: 'Price momentum', weight: CATEGORY_WEIGHTS.momentum, score: averageScore(metrics), metrics };
}

function classify(total: number): Classification {
  if (total >= 65) return 'Bullish';
  if (total >= 40) return 'Watch';
  return 'Bearish';
}

function describe(
  classification: Classification,
  best: CategoryScore | undefined,
  worst: CategoryScore | undefined
): string {
  const lead =
    classification === 'Bullish'
      ? 'The model reads this constructively'
      : classification === 'Bearish'
        ? 'The model reads this cautiously'
        : 'The model sees a mixed picture';

  if (!best || !worst || best.key === worst.key) return `${lead} on the metrics available.`;
  return `${lead}: ${best.label.toLowerCase()} scores well while ${worst.label.toLowerCase()} is the weak point.`;
}

export function scoreCompany(dossier: CompanyDossier): ModelScore {
  const momentum = computeMomentumInput(dossier);
  const categories: CategoryScore[] = [
    growthCategory(dossier.ratios),
    profitabilityCategory(dossier.ratios),
    valuationCategory(dossier.ratios, dossier.peers),
    healthCategory(dossier.ratios),
    momentumCategory(momentum)
  ];

  // Re-normalize across the categories that actually produced a score, so a
  // missing category shifts weight to the others instead of scoring as zero.
  const scored = categories.filter((c) => c.score !== null);
  const weightSum = scored.reduce((sum, c) => sum + c.weight, 0);
  const total = weightSum
    ? Math.round(scored.reduce((sum, c) => sum + (c.score as number) * c.weight, 0) / weightSum)
    : 0;

  const allMetrics = categories.flatMap((c) => c.metrics);
  const withData = allMetrics.filter((m) => m.score !== null);
  const coverage = allMetrics.length ? withData.length / allMetrics.length : 0;

  const ranked = [...withData].sort((a, b) => (b.score as number) - (a.score as number));
  const byScore = [...scored].sort((a, b) => (b.score as number) - (a.score as number));

  return {
    total,
    classification: classify(total),
    confidence: coverage >= 0.8 ? 'high' : coverage >= 0.55 ? 'medium' : 'low',
    coverage,
    summary: describe(classify(total), byScore[0], byScore[byScore.length - 1]),
    strengths: ranked.slice(0, 3),
    risks: ranked.slice(-3).reverse(),
    categories
  };
}
