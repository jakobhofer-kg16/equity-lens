/**
 * Portfolio construction for the post-module assignment.
 *
 *   npx tsx scripts/portfolio.ts tone      # earnings-call tone for the universe (no key)
 *   TWELVEDATA_KEY=… npx tsx scripts/portfolio.ts build
 *
 * Thesis — "Cheap against peers, confirmed by the call":
 *   The model backtest (src/data/backtest.json) found one category with signal
 *   at the 2025 anchor: valuation against industry peers (ρ +0.14). Quality was
 *   negatively priced. So the strategy buys what is cheaper than its industry
 *   peers, requires the latest earnings call to sound at least neutral and not
 *   deteriorating (the text signal), and only enters names in an uptrend that
 *   are not overbought (the technical rules taught: 50/200 golden cross, RSI).
 *
 * Universe: the 383 S&P 500 companies with transcripts in the course archive.
 * Fundamentals: Finnhub metrics cached by scripts/backtest.ts (fetched today).
 * Prices: Twelve Data, two years of daily bars for the candidates.
 * Optimisation: maximum Sharpe ratio and minimum variance (the two methods
 * taught), long-only, 10% cap per name, plus equal weight as the baseline.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EARNINGS_ARCHIVE, archiveUrl } from '../src/data/earningsArchive';
import { parseTranscript } from '../src/services/providers/earningsCalls';
import { countWords, scoreCounts, sumCounts } from '../src/lib/sentiment';
import { macd, rsi, sma } from '../src/lib/indicators';

const CACHE = join(process.cwd(), '.backtest-cache');
const TONE_FILE = join(CACHE, 'tone.json');
const OUT = join(process.cwd(), 'src/data/portfolio.json');

const RISK_FREE = 0.04;
const TARGET_HOLDINGS = 20;
const CANDIDATES_FOR_PRICES = 40;
const MAX_WEIGHT = 0.1;
/** Every name that passed the screen is held; the optimiser tilts within bands. */
const MIN_WEIGHT = 0.02;
const MAX_PER_INDUSTRY = 4;
const LOOKBACK_BARS = 504;
const TWELVE_GAP_MS = 7700;

type Json = Record<string, unknown>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const symbols = Object.keys(EARNINGS_ARCHIVE).sort();

// --- phase 1: earnings-call tone ----------------------------------------------

interface Tone {
  latestDate: string;
  polarity: number | null;
  priorPolarity: number | null;
  delta: number | null;
  hedging: number;
  managementPolarity: number | null;
  analystPolarity: number | null;
}

async function toneFor(symbol: string): Promise<Tone | null> {
  const dates = EARNINGS_ARCHIVE[symbol];
  const last = dates.slice(-2);
  const scored: Array<{ date: string; polarity: number | null; hedging: number; mgmt: number | null; ana: number | null }> = [];
  for (const date of last) {
    try {
      const csv = await fetch(archiveUrl(symbol, date)).then((r) => (r.ok ? r.text() : ''));
      const lines = parseTranscript(csv).filter((l) => l.role !== 'operator');
      if (!lines.length) continue;
      const all = scoreCounts(sumCounts(lines.map((l) => countWords(l.text))));
      const group = (role: string) => {
        const g = lines.filter((l) => l.role === role);
        return g.length ? scoreCounts(sumCounts(g.map((l) => countWords(l.text)))).polarity : null;
      };
      scored.push({ date, polarity: all.polarity, hedging: all.uncertaintyRate, mgmt: group('management'), ana: group('analyst') });
    } catch {
      /* skip this quarter */
    }
  }
  if (!scored.length) return null;
  const latest = scored[scored.length - 1];
  const prior = scored.length > 1 ? scored[scored.length - 2] : null;
  return {
    latestDate: latest.date,
    polarity: latest.polarity,
    priorPolarity: prior?.polarity ?? null,
    delta: latest.polarity !== null && prior?.polarity != null ? latest.polarity - prior.polarity : null,
    hedging: latest.hedging,
    managementPolarity: latest.mgmt,
    analystPolarity: latest.ana
  };
}

async function tonePhase() {
  mkdirSync(CACHE, { recursive: true });
  const done: Record<string, Tone | null> = existsSync(TONE_FILE) ? JSON.parse(readFileSync(TONE_FILE, 'utf8')) : {};
  const todo = symbols.filter((s) => !(s in done));
  console.log(`[tone] ${todo.length} symbols to score`);
  const CONCURRENCY = 6;
  let i = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (i < todo.length) {
        const symbol = todo[i++];
        done[symbol] = await toneFor(symbol);
        if (Object.keys(done).length % 25 === 0) {
          writeFileSync(TONE_FILE, JSON.stringify(done));
          console.log(`[tone] ${Object.keys(done).length}/${symbols.length}`);
        }
      }
    })
  );
  writeFileSync(TONE_FILE, JSON.stringify(done));
  console.log('[tone] done');
}

// --- phase 2: screen, prices, optimise ---------------------------------------

interface Fundamental {
  symbol: string;
  name: string;
  industry: string;
  marketCap: number | null;
  pe: number | null;
  evEbitda: number | null;
  operatingMargin: number | null;
  roe: number | null;
  debtToEquity: number | null;
  revenueGrowth: number | null;
  dividendYield: number | null;
}

function num(v: unknown): number | null {
  const n = Number(v);
  return v === null || v === undefined || v === '' || !Number.isFinite(n) ? null : n;
}

function loadFundamentals(): Fundamental[] {
  const out: Fundamental[] = [];
  for (const symbol of symbols) {
    const path = join(CACHE, 'fh', `${symbol}.json`);
    if (!existsSync(path)) continue;
    const { profile, metric } = JSON.parse(readFileSync(path, 'utf8')) as { profile: Json; metric: Json };
    const m = (metric.metric ?? {}) as Json;
    if (!profile?.ticker) continue;
    out.push({
      symbol,
      name: String(profile.name ?? symbol),
      industry: String(profile.finnhubIndustry ?? 'Unknown'),
      marketCap: num(profile.marketCapitalization) !== null ? (num(profile.marketCapitalization) as number) * 1e6 : null,
      pe: num(m.peTTM),
      evEbitda: num(m.evEbitdaTTM),
      operatingMargin: num(m.operatingMarginTTM) !== null ? (num(m.operatingMarginTTM) as number) / 100 : null,
      roe: num(m.roeTTM) !== null ? (num(m.roeTTM) as number) / 100 : null,
      debtToEquity: num(m['totalDebt/totalEquityAnnual']),
      revenueGrowth: num(m.revenueGrowthTTMYoy) !== null ? (num(m.revenueGrowthTTMYoy) as number) / 100 : null,
      dividendYield: num(m.dividendYieldIndicatedAnnual) !== null ? (num(m.dividendYieldIndicatedAnnual) as number) / 100 : null
    });
  }
  return out;
}

function median(values: Array<number | null>): number | null {
  const v = values.filter((x): x is number => x !== null && x > 0).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function rankAsc(values: number[]): number[] {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const r = new Array<number>(values.length);
  order.forEach((o, pos) => (r[o.i] = pos / Math.max(values.length - 1, 1)));
  return r;
}

interface Candidate extends Fundamental {
  tone: Tone;
  peerPe: number;
  peerEv: number;
  discountPe: number;
  discountEv: number;
  composite: number;
  reasons: string[];
}

function screen(funds: Fundamental[], tones: Record<string, Tone | null>) {
  const byIndustry = new Map<string, Fundamental[]>();
  for (const f of funds) byIndustry.set(f.industry, [...(byIndustry.get(f.industry) ?? []), f]);
  const universePe = median(funds.map((f) => f.pe));
  const universeEv = median(funds.map((f) => f.evEbitda));

  const passed: Candidate[] = [];
  const rejected: Record<string, number> = {};
  const reject = (why: string) => (rejected[why] = (rejected[why] ?? 0) + 1);

  for (const f of funds) {
    const tone = tones[f.symbol];
    if (!tone || tone.polarity === null) { reject('no transcript tone'); continue; }
    if (f.pe === null || f.pe <= 0 || f.evEbitda === null || f.evEbitda <= 0) { reject('no positive earnings / EBITDA'); continue; }
    if (f.operatingMargin === null || f.operatingMargin <= 0) { reject('operating loss'); continue; }

    const group = byIndustry.get(f.industry) ?? [];
    const peerPe = (group.length >= 4 ? median(group.map((g) => g.pe)) : universePe) ?? universePe;
    const peerEv = (group.length >= 4 ? median(group.map((g) => g.evEbitda)) : universeEv) ?? universeEv;
    if (!peerPe || !peerEv) { reject('no peer reference'); continue; }

    const discountPe = peerPe / f.pe - 1;
    const discountEv = peerEv / f.evEbitda - 1;
    if (discountPe <= 0 && discountEv <= 0) { reject('not cheaper than peers'); continue; }
    if (tone.polarity < 0.2) { reject('call tone below neutral band'); continue; }
    if (tone.delta !== null && tone.delta < -0.1) { reject('tone deteriorating'); continue; }
    if (tone.hedging > 0.015) { reject('elevated hedging'); continue; }

    passed.push({
      ...f,
      tone,
      peerPe,
      peerEv,
      discountPe,
      discountEv,
      composite: 0,
      reasons: [
        `P/E ${f.pe.toFixed(1)} vs peer ${peerPe.toFixed(1)} (${(discountPe * 100).toFixed(0)}% cheaper)`,
        `EV/EBITDA ${f.evEbitda.toFixed(1)} vs peer ${peerEv.toFixed(1)}`,
        `call tone ${tone.polarity.toFixed(2)}${tone.delta !== null ? ` (${tone.delta >= 0 ? '+' : ''}${tone.delta.toFixed(2)} vs prior)` : ''}`
      ]
    });
  }

  // Composite: value discount weighs most, then the tone level, then its change.
  const rVal = rankAsc(passed.map((c) => (c.discountPe + c.discountEv) / 2));
  const rTone = rankAsc(passed.map((c) => c.tone.polarity as number));
  const rDelta = rankAsc(passed.map((c) => c.tone.delta ?? 0));
  passed.forEach((c, i) => (c.composite = 0.5 * rVal[i] + 0.3 * rTone[i] + 0.2 * rDelta[i]));
  passed.sort((a, b) => b.composite - a.composite);

  return { passed, rejected, universePe, universeEv };
}

interface Bar {
  date: string;
  close: number;
}

async function fetchBars(symbol: string, key: string): Promise<Bar[]> {
  const path = join(CACHE, 'td-recent', `${symbol}.json`);
  if (existsSync(path)) {
    const cached = JSON.parse(readFileSync(path, 'utf8')) as { fetched: string; bars: Bar[] };
    if (cached.fetched === new Date().toISOString().slice(0, 10)) return cached.bars;
  }
  for (;;) {
    const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=${LOOKBACK_BARS + 30}&apikey=${key}`;
    const json = (await fetch(url).then((r) => r.json())) as Json;
    if (json.status === 'error') {
      if (/credits|limit/i.test(String(json.message))) {
        await sleep(65_000);
        continue;
      }
      return [];
    }
    const bars = ((json.values as Array<Record<string, string>>) ?? [])
      .map((b) => ({ date: b.datetime, close: Number(b.close) }))
      .filter((b) => Number.isFinite(b.close))
      .sort((a, b) => a.date.localeCompare(b.date));
    mkdirSync(join(CACHE, 'td-recent'), { recursive: true });
    writeFileSync(path, JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), bars }));
    await sleep(TWELVE_GAP_MS);
    return bars;
  }
}

// --- optimisation --------------------------------------------------------------

function dailyReturns(bars: Bar[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < bars.length; i++) r.push(Math.log(bars[i].close / bars[i - 1].close));
  return r;
}

function alignReturns(series: Map<string, Bar[]>): { symbols: string[]; returns: number[][]; dates: string[] } {
  const syms = [...series.keys()];
  const common = syms
    .map((s) => new Set(series.get(s)!.map((b) => b.date)))
    .reduce((acc, set) => new Set([...acc].filter((d) => set.has(d))));
  const dates = [...common].sort().slice(-LOOKBACK_BARS - 1);
  const returns = syms.map((s) => {
    const byDate = new Map(series.get(s)!.map((b) => [b.date, b.close]));
    const closes = dates.map((d) => byDate.get(d) as number);
    return dailyReturns(closes.map((c, i) => ({ date: dates[i], close: c })));
  });
  return { symbols: syms, returns, dates: dates.slice(1) };
}

function meanVec(R: number[][]): number[] {
  return R.map((r) => (r.reduce((a, b) => a + b, 0) / r.length) * 252);
}

function covMat(R: number[][]): number[][] {
  const n = R.length;
  const T = R[0].length;
  const mu = R.map((r) => r.reduce((a, b) => a + b, 0) / T);
  const C: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = i; j < n; j++) {
      let s = 0;
      for (let t = 0; t < T; t++) s += (R[i][t] - mu[i]) * (R[j][t] - mu[j]);
      C[i][j] = C[j][i] = (s / (T - 1)) * 252;
    }
  return C;
}

const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
const matVec = (M: number[][], v: number[]) => M.map((row) => dot(row, v));

/** Projection onto { w : Σw = 1, floor ≤ w ≤ cap } by bisection on the shift. */
function projectCapped(v: number[], cap: number, floor = MIN_WEIGHT): number[] {
  let lo = -1;
  let hi = 1;
  const clip = (t: number) => v.map((x) => Math.min(cap, Math.max(floor, x - t)));
  for (let k = 0; k < 100; k++) {
    const mid = (lo + hi) / 2;
    if (clip(mid).reduce((a, b) => a + b, 0) > 1) lo = mid;
    else hi = mid;
  }
  return clip((lo + hi) / 2);
}

function optimise(mu: number[], C: number[], objective: 'sharpe' | 'minvar'): number[] {
  const n = mu.length;
  const Cm = C as unknown as number[][];
  let w = projectCapped(new Array(n).fill(1 / n), MAX_WEIGHT);
  let step = 0.05;
  const value = (x: number[]) => {
    const vol = Math.sqrt(Math.max(dot(x, matVec(Cm, x)), 1e-12));
    return objective === 'sharpe' ? (dot(x, mu) - RISK_FREE) / vol : -vol;
  };
  for (let iter = 0; iter < 4000; iter++) {
    const Cw = matVec(Cm, w);
    const vol = Math.sqrt(Math.max(dot(w, Cw), 1e-12));
    let grad: number[];
    if (objective === 'sharpe') {
      const excess = dot(w, mu) - RISK_FREE;
      grad = mu.map((m, i) => m / vol - (excess * Cw[i]) / vol ** 3);
    } else {
      grad = Cw.map((c) => -c / vol);
    }
    const next = projectCapped(w.map((x, i) => x + step * grad[i]), MAX_WEIGHT);
    if (value(next) >= value(w)) w = next;
    else step *= 0.7;
    if (step < 1e-7) break;
  }
  return w;
}

function stats(w: number[], mu: number[], C: number[][]) {
  const ret = dot(w, mu);
  const vol = Math.sqrt(dot(w, matVec(C, w)));
  return { expectedReturn: ret, volatility: vol, sharpe: (ret - RISK_FREE) / vol };
}

// --- build ---------------------------------------------------------------------

async function buildPhase(key: string) {
  const tones = JSON.parse(readFileSync(TONE_FILE, 'utf8')) as Record<string, Tone | null>;
  const funds = loadFundamentals();
  const { passed, rejected, universePe, universeEv } = screen(funds, tones);
  console.log(`[screen] ${funds.length} with fundamentals, ${passed.length} pass; rejections:`, rejected);

  // Industry cap on the way in, so the price fetch is not wasted on a sixth bank.
  const perIndustry = new Map<string, number>();
  const candidates = passed.filter((c) => {
    const n = perIndustry.get(c.industry) ?? 0;
    if (n >= MAX_PER_INDUSTRY) return false;
    perIndustry.set(c.industry, n + 1);
    return true;
  }).slice(0, CANDIDATES_FOR_PRICES);

  const series = new Map<string, Bar[]>();
  const technical: Record<string, { close: number; asOf: string; sma50: number | null; sma200: number | null; goldenCross: boolean | null; rsi: number | null; macdHist: number | null }> = {};
  let done = 0;
  for (const c of [...candidates.map((c) => c.symbol), 'SPY']) {
    const bars = await fetchBars(c, key);
    done++;
    if (bars.length < LOOKBACK_BARS / 2) {
      console.log(`[prices] ${c}: only ${bars.length} bars, skipped`);
      continue;
    }
    series.set(c, bars);
    const closes = bars.map((b) => b.close);
    const s50 = sma(closes, 50);
    const s200 = sma(closes, 200);
    const r = rsi(closes, 14);
    const m = macd(closes);
    const i = closes.length - 1;
    technical[c] = {
      close: closes[i],
      asOf: bars[i].date,
      sma50: s50[i],
      sma200: s200[i],
      goldenCross: s50[i] !== null && s200[i] !== null ? (s50[i] as number) > (s200[i] as number) : null,
      rsi: r[i],
      macdHist: m.histogram[i]
    };
    if (done % 10 === 0) console.log(`[prices] ${done}/${candidates.length + 1}`);
  }

  // Technical entry rules, as taught: golden cross (50-day above 200-day), price
  // above the 200-day average, and RSI not overbought.
  const entered = candidates.filter((c) => {
    const t = technical[c.symbol];
    return t && t.goldenCross === true && t.sma200 !== null && t.close > t.sma200 && t.rsi !== null && t.rsi < 70;
  });
  const techRejected = candidates.filter((c) => technical[c.symbol] && !entered.includes(c)).map((c) => c.symbol);
  const holdings = entered.slice(0, TARGET_HOLDINGS);
  console.log(`[technical] ${entered.length} of ${candidates.length} pass; holding ${holdings.length}`);

  const sub = new Map(holdings.map((h) => [h.symbol, series.get(h.symbol)!]));
  const { symbols: syms, returns, dates } = alignReturns(sub);
  const mu = meanVec(returns);
  const C = covMat(returns);

  const wSharpe = optimise(mu, C as unknown as number[], 'sharpe');
  const wMinVar = optimise(mu, C as unknown as number[], 'minvar');
  const wEqual = new Array(syms.length).fill(1 / syms.length);

  // Benchmark over the same window, for the record.
  const spy = series.get('SPY')!;
  const spyByDate = new Map(spy.map((b) => [b.date, b.close]));
  const spyReturns = dailyReturns(dates.map((d) => ({ date: d, close: spyByDate.get(d) as number })).filter((b) => Number.isFinite(b.close)));
  const spyMu = (spyReturns.reduce((a, b) => a + b, 0) / spyReturns.length) * 252;
  const spyVol = Math.sqrt(covMat([spyReturns])[0][0]);

  const out = {
    generatedAt: new Date().toISOString(),
    pricesAsOf: dates[dates.length - 1],
    lookbackTradingDays: dates.length,
    riskFreeRate: RISK_FREE,
    maxWeight: MAX_WEIGHT,
    minWeight: MIN_WEIGHT,
    maxPerIndustry: MAX_PER_INDUSTRY,
    thesis: 'Cheap against industry peers on P/E and EV/EBITDA, with a latest earnings call that reads at least neutral and is not deteriorating, entered only on a golden cross above the 200-day average and below RSI 70.',
    universe: symbols.length,
    withFundamentals: funds.length,
    passedScreen: passed.length,
    candidatesPriced: candidates.length,
    passedTechnical: entered.length,
    rejectedByScreen: rejected,
    rejectedByTechnical: techRejected,
    universeMedians: { pe: universePe, evEbitda: universeEv },
    weights: {
      maxSharpe: Object.fromEntries(syms.map((s, i) => [s, Number(wSharpe[i].toFixed(4))])),
      minVariance: Object.fromEntries(syms.map((s, i) => [s, Number(wMinVar[i].toFixed(4))])),
      equal: Object.fromEntries(syms.map((s, i) => [s, Number(wEqual[i].toFixed(4))]))
    },
    stats: {
      maxSharpe: stats(wSharpe, mu, C),
      minVariance: stats(wMinVar, mu, C),
      equal: stats(wEqual, mu, C),
      benchmark: { expectedReturn: spyMu, volatility: spyVol, sharpe: (spyMu - RISK_FREE) / spyVol }
    },
    holdings: holdings.map((h) => ({
      symbol: h.symbol,
      name: h.name,
      industry: h.industry,
      marketCap: h.marketCap,
      composite: Number(h.composite.toFixed(3)),
      valuation: { pe: h.pe, peerPe: h.peerPe, evEbitda: h.evEbitda, peerEv: h.peerEv, discountPe: h.discountPe, discountEv: h.discountEv },
      quality: { operatingMargin: h.operatingMargin, roe: h.roe, debtToEquity: h.debtToEquity, revenueGrowth: h.revenueGrowth, dividendYield: h.dividendYield },
      tone: h.tone,
      technical: technical[h.symbol],
      annualisedReturn: mu[syms.indexOf(h.symbol)],
      annualisedVol: Math.sqrt(C[syms.indexOf(h.symbol)][syms.indexOf(h.symbol)]),
      reasons: h.reasons
    })),
    nextInLine: entered.slice(TARGET_HOLDINGS, TARGET_HOLDINGS + 5).map((c) => c.symbol)
  };
  writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(`[build] wrote ${OUT}: ${holdings.length} holdings`);
  console.log('[build] stats', JSON.stringify(out.stats, null, 1));
}

const mode = process.argv[2];
if (mode === 'tone') await tonePhase();
else if (mode === 'build') {
  const key = process.env.TWELVEDATA_KEY;
  if (!key) throw new Error('TWELVEDATA_KEY required');
  await buildPhase(key);
} else console.log('usage: portfolio.ts tone|build');
