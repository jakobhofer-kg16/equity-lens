/**
 * Statistics over the committed backtest results (src/data/backtest.json).
 *
 * Everything here is descriptive and computed at render time from that file.
 * The wording in the UI is derived from the numbers, not written in advance,
 * so a null or inverse result reads as exactly that.
 */

export interface BacktestRow {
  symbol: string;
  name: string;
  sector: string;
  peersInSector: number;
  valuationReference?: 'industry' | 'universe';
  score: number;
  classification: 'Bullish' | 'Watch' | 'Bearish';
  confidence: 'high' | 'medium' | 'low';
  coverage: number;
  categories: Record<string, number | null>;
  anchorPrice: number;
  forwardReturn: number;
  excessReturn: number;
}

export interface BacktestFile {
  anchor: string;
  forwardTradingDays: number;
  benchmark: string;
  benchmarkReturn: number;
  universe: number;
  scored: number;
  generatedAt: string;
  method: string;
  rows: BacktestRow[];
}

export function median(values: number[]): number | null {
  const v = [...values].sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function ranks(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const out = new Array<number>(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1].v === indexed[i].v) j++;
    const rank = (i + j) / 2 + 1; // average rank for ties
    for (let k = i; k <= j; k++) out[indexed[k].i] = rank;
    i = j + 1;
  }
  return out;
}

/** Spearman rank correlation. Null when there are too few pairs. */
export function spearman(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 5) return null;
  const rx = ranks(xs);
  const ry = ranks(ys);
  const mx = rx.reduce((a, b) => a + b, 0) / rx.length;
  const my = ry.reduce((a, b) => a + b, 0) / ry.length;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < rx.length; i++) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : null;
}

/** Rule-of-thumb noise floor for a correlation on n pairs (≈ 2/√n). */
export function noiseFloor(n: number): number {
  return n > 0 ? 2 / Math.sqrt(n) : 1;
}

export interface Bucket {
  label: string;
  n: number;
  medianExcess: number | null;
  hitRate: number | null;
  scoreRange: [number, number];
}

/** Equal-count buckets by score, lowest first. */
export function quantiles(rows: BacktestRow[], count: number): Bucket[] {
  const sorted = [...rows].sort((a, b) => a.score - b.score);
  const size = Math.floor(sorted.length / count);
  if (!size) return [];
  const out: Bucket[] = [];
  for (let q = 0; q < count; q++) {
    const slice = sorted.slice(q * size, q === count - 1 ? sorted.length : (q + 1) * size);
    const excess = slice.map((r) => r.excessReturn);
    out.push({
      label: `Q${q + 1}`,
      n: slice.length,
      medianExcess: median(excess),
      hitRate: slice.length ? excess.filter((e) => e > 0).length / slice.length : null,
      scoreRange: [slice[0].score, slice[slice.length - 1].score]
    });
  }
  return out;
}

export function byClassification(rows: BacktestRow[]): Bucket[] {
  return (['Bullish', 'Watch', 'Bearish'] as const).map((label) => {
    const slice = rows.filter((r) => r.classification === label);
    const excess = slice.map((r) => r.excessReturn);
    const scores = slice.map((r) => r.score);
    return {
      label,
      n: slice.length,
      medianExcess: median(excess),
      hitRate: slice.length ? excess.filter((e) => e > 0).length / slice.length : null,
      scoreRange: slice.length ? [Math.min(...scores), Math.max(...scores)] : [0, 0]
    };
  });
}

export interface CategoryPower {
  key: string;
  n: number;
  rho: number | null;
}

export function categoryPower(rows: BacktestRow[]): CategoryPower[] {
  const keys = ['growth', 'profitability', 'valuation', 'health', 'momentum'];
  return keys.map((key) => {
    const pairs = rows.filter((r) => r.categories[key] !== null && r.categories[key] !== undefined);
    return {
      key,
      n: pairs.length,
      rho: spearman(
        pairs.map((r) => r.categories[key] as number),
        pairs.map((r) => r.excessReturn)
      )
    };
  });
}

export interface Verdict {
  rho: number | null;
  floor: number;
  /** 'positive' | 'none' | 'inverse' */
  reading: 'positive' | 'none' | 'inverse';
  sentence: string;
}

/** The headline sentence is chosen by the numbers, never pre-written. */
export function verdict(rows: BacktestRow[]): Verdict {
  const rho = spearman(
    rows.map((r) => r.score),
    rows.map((r) => r.excessReturn)
  );
  const floor = noiseFloor(rows.length);
  const reading: Verdict['reading'] = rho === null || Math.abs(rho) <= floor ? 'none' : rho > 0 ? 'positive' : 'inverse';

  const sentence =
    reading === 'none'
      ? `Across ${rows.length} companies the rank correlation between score and excess return is ${rho === null ? 'undefined' : rho.toFixed(2)}, inside the ±${floor.toFixed(2)} noise floor for this sample size. The score did not rank the following year's returns better than chance.`
      : reading === 'positive'
        ? `Across ${rows.length} companies the rank correlation between score and excess return is ${rho!.toFixed(2)}, above the ±${floor.toFixed(2)} noise floor. Higher scores were followed by higher excess returns — weakly, and in one year.`
        : `Across ${rows.length} companies the rank correlation between score and excess return is ${rho!.toFixed(2)}, beyond the ±${floor.toFixed(2)} noise floor in the wrong direction. Higher scores were followed by lower excess returns in this year — the model's bands read momentum and quality that the market had already priced.`;

  return { rho, floor, reading, sentence };
}
