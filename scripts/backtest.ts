/**
 * Backtest of the scoring model — run offline, results committed.
 *
 *   FINNHUB_KEY=… TWELVEDATA_KEY=… npx tsx scripts/backtest.ts fetch
 *   npx tsx scripts/backtest.ts compute
 *
 * Question answered: if the model had been run on ANCHOR with only the data
 * available then, would its score have said anything about the following
 * twelve months? Universe: the 383 S&P 500 companies in the course archive.
 *
 * Design choices that keep this honest:
 * - Only fundamentals from fiscal periods ending on or before ANCHOR are used.
 *   Valuation multiples are recomputed from the anchor-day price and the
 *   per-share fundamentals of that period, so no later price leaks in.
 * - The peer median for valuation is the median across companies in the same
 *   Finnhub industry within this universe, computed here — nothing hand-set.
 * - Growth is measured on per-share revenue, which buybacks flatter. Stated in
 *   the report.
 * - Forward return is measured against SPY over the same window, so the result
 *   is about selection, not about the market having gone up.
 *
 * The fetch phase is resumable and throttled to each provider's free limit.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EARNINGS_ARCHIVE } from '../src/data/earningsArchive';
import { scoreCompany } from '../src/lib/scoring';
import type { CompanyDossier, FinancialRatios, PriceBar } from '../src/types';

const ANCHOR = '2025-01-31';
const FORWARD_TRADING_DAYS = 252;
const MIN_FORWARD_BARS = 240;
const MIN_HISTORY_BARS = 240;
const BENCHMARK = 'SPY';

const CACHE_DIR = join(process.cwd(), '.backtest-cache');
const OUT_FILE = join(process.cwd(), 'src/data/backtest.json');

const FINNHUB_GAP_MS = 1100; // 60/min allowed; 55/min used
const TWELVE_GAP_MS = 7700; // 8/min allowed

type Json = Record<string, unknown>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const symbols = Object.keys(EARNINGS_ARCHIVE).sort();

function cachePath(kind: 'fh' | 'td', symbol: string) {
  return join(CACHE_DIR, kind, `${symbol}.json`);
}

// --- fetch phase ---------------------------------------------------------------

async function fetchFinnhub(key: string) {
  mkdirSync(join(CACHE_DIR, 'fh'), { recursive: true });
  let done = 0;
  for (const symbol of symbols) {
    const path = cachePath('fh', symbol);
    if (existsSync(path)) continue;
    try {
      const [profile, metric] = await Promise.all([
        fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${key}`).then((r) => r.json()),
        fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${key}`).then((r) => r.json())
      ]);
      writeFileSync(path, JSON.stringify({ profile, metric }));
      done++;
      if (done % 20 === 0) console.log(`[finnhub] ${done} fetched, ${symbols.length - done} to go`);
    } catch (err) {
      console.error(`[finnhub] ${symbol}: ${(err as Error).message}`);
    }
    await sleep(FINNHUB_GAP_MS * 2); // two requests per symbol
  }
  console.log('[finnhub] done');
}

async function fetchTwelveData(key: string) {
  mkdirSync(join(CACHE_DIR, 'td'), { recursive: true });
  const targets = [BENCHMARK, ...symbols];
  let done = 0;
  for (const symbol of targets) {
    const path = cachePath('td', symbol);
    if (existsSync(path)) continue;
    const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&start_date=2023-11-01&end_date=2026-03-01&outputsize=700&apikey=${key}`;
    try {
      const json = (await fetch(url).then((r) => r.json())) as Json;
      if (json.status === 'error') {
        const message = String(json.message ?? '');
        if (/credits|limit/i.test(message)) {
          console.log('[twelvedata] rate limited, waiting 65s');
          await sleep(65_000);
          continue; // retry the same symbol
        }
        console.error(`[twelvedata] ${symbol}: ${message}`);
        writeFileSync(path, JSON.stringify({ values: [] }));
      } else {
        writeFileSync(path, JSON.stringify(json));
      }
      done++;
      if (done % 20 === 0) console.log(`[twelvedata] ${done} fetched, ${targets.length - done} to go`);
    } catch (err) {
      console.error(`[twelvedata] ${symbol}: ${(err as Error).message}`);
    }
    await sleep(TWELVE_GAP_MS);
  }
  console.log('[twelvedata] done');
}

// --- compute phase -------------------------------------------------------------

interface SeriesPoint {
  period: string;
  v: number;
}

function series(metric: Json, key: string): SeriesPoint[] {
  const annual = ((metric.series as Json | undefined)?.annual ?? {}) as Record<string, SeriesPoint[]>;
  return (annual[key] ?? []).filter((p) => typeof p.v === 'number').sort((a, b) => a.period.localeCompare(b.period));
}

/** Latest value whose period ends on or before the anchor — no lookahead. */
function at(points: SeriesPoint[], anchor: string, back = 0): number | null {
  const eligible = points.filter((p) => p.period <= anchor);
  const idx = eligible.length - 1 - back;
  return idx >= 0 ? eligible[idx].v : null;
}

function loadBars(symbol: string): PriceBar[] {
  const path = cachePath('td', symbol);
  if (!existsSync(path)) return [];
  const json = JSON.parse(readFileSync(path, 'utf8')) as { values?: Array<Record<string, string>> };
  return (json.values ?? [])
    .map((b) => ({
      date: b.datetime,
      open: Number(b.open),
      high: Number(b.high),
      low: Number(b.low),
      close: Number(b.close),
      volume: Number(b.volume)
    }))
    .filter((b) => Number.isFinite(b.close))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function median(values: Array<number | null>): number | null {
  const v = values.filter((x): x is number => x !== null && x > 0).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

interface Prepared {
  symbol: string;
  name: string;
  sector: string;
  ratios: FinancialRatios;
  barsToAnchor: PriceBar[];
  anchorPrice: number;
  forwardReturn: number;
}

function prepare(symbol: string): Prepared | null {
  const fhPath = cachePath('fh', symbol);
  if (!existsSync(fhPath)) return null;
  const { profile, metric } = JSON.parse(readFileSync(fhPath, 'utf8')) as { profile: Json; metric: Json };
  if (!profile?.ticker) return null;

  const bars = loadBars(symbol);
  const anchorIdx = bars.findLastIndex((b) => b.date <= ANCHOR);
  if (anchorIdx < MIN_HISTORY_BARS) return null;
  const forwardIdx = anchorIdx + FORWARD_TRADING_DAYS;
  if (bars.length - 1 - anchorIdx < MIN_FORWARD_BARS) return null;
  const endIdx = Math.min(forwardIdx, bars.length - 1);

  const price = bars[anchorIdx].close;
  const forwardReturn = bars[endIdx].close / price - 1;

  const eps = at(series(metric, 'eps'), ANCHOR);
  const epsPrev = at(series(metric, 'eps'), ANCHOR, 1);
  const sps = at(series(metric, 'salesPerShare'), ANCHOR);
  const spsPrev = at(series(metric, 'salesPerShare'), ANCHOR, 1);
  const sps3 = at(series(metric, 'salesPerShare'), ANCHOR, 3);
  const bookValue = at(series(metric, 'bookValue'), ANCHOR);
  const fcfMargin = at(series(metric, 'fcfMargin'), ANCHOR);

  const ratios: FinancialRatios = {
    symbol,
    trailingPE: eps && eps > 0 ? price / eps : null,
    forwardPE: null,
    pegRatio: null,
    priceToSales: sps && sps > 0 ? price / sps : null,
    priceToBook: bookValue && bookValue > 0 ? price / bookValue : null,
    evToEbitda: at(series(metric, 'evEbitda'), ANCHOR),
    evToRevenue: null,
    freeCashFlowYield: fcfMargin !== null && sps && price > 0 ? (fcfMargin * sps) / price : null,
    grossMargin: at(series(metric, 'grossMargin'), ANCHOR),
    operatingMargin: at(series(metric, 'operatingMargin'), ANCHOR),
    profitMargin: at(series(metric, 'netMargin'), ANCHOR),
    returnOnEquity: at(series(metric, 'roe'), ANCHOR),
    returnOnAssets: at(series(metric, 'roa'), ANCHOR),
    returnOnInvestedCapital: at(series(metric, 'roic'), ANCHOR),
    debtToEquity: at(series(metric, 'totalDebtToEquity'), ANCHOR),
    interestCoverage: null,
    currentRatio: at(series(metric, 'currentRatio'), ANCHOR),
    revenueGrowthYoY: sps && spsPrev && spsPrev > 0 ? sps / spsPrev - 1 : null,
    earningsGrowthYoY: eps !== null && epsPrev && epsPrev > 0 ? eps / epsPrev - 1 : null,
    revenueCagr3y: sps && sps3 && sps3 > 0 ? Math.pow(sps / sps3, 1 / 3) - 1 : null
  };

  return {
    symbol,
    name: String(profile.name ?? symbol),
    sector: String(profile.finnhubIndustry ?? 'Unknown'),
    ratios,
    barsToAnchor: bars.slice(0, anchorIdx + 1),
    anchorPrice: price,
    forwardReturn
  };
}

function compute() {
  const spy = loadBars(BENCHMARK);
  const spyAnchor = spy.findLastIndex((b) => b.date <= ANCHOR);
  const spyEnd = Math.min(spyAnchor + FORWARD_TRADING_DAYS, spy.length - 1);
  const benchmarkReturn = spy[spyEnd].close / spy[spyAnchor].close - 1;

  const prepared = symbols.map(prepare).filter((p): p is Prepared => p !== null);
  console.log(`[compute] ${prepared.length} of ${symbols.length} companies have complete data at ${ANCHOR}`);

  // Peer medians per Finnhub industry, from this universe. Finnhub industries
  // are fine-grained, so a group with fewer than MIN_SECTOR_GROUP members
  // falls back to the universe-wide median rather than comparing a company
  // with itself.
  const MIN_SECTOR_GROUP = 4;
  const bySector = new Map<string, Prepared[]>();
  for (const p of prepared) bySector.set(p.sector, [...(bySector.get(p.sector) ?? []), p]);
  const medianOf = (group: Prepared[]) => ({
    trailingPE: median(group.map((g) => g.ratios.trailingPE)),
    evToEbitda: median(group.map((g) => g.ratios.evToEbitda)),
    operatingMargin: median(group.map((g) => g.ratios.operatingMargin)),
    returnOnEquity: median(group.map((g) => g.ratios.returnOnEquity))
  });
  const universeMedian = medianOf(prepared);

  const rows = prepared.map((p) => {
    const group = bySector.get(p.sector) ?? [];
    const usesSectorMedian = group.length >= MIN_SECTOR_GROUP;
    const peerMedian = usesSectorMedian ? medianOf(group) : universeMedian;

    const last252 = p.barsToAnchor.slice(-252);
    const dossier = {
      profile: { symbol: p.symbol, name: p.name, sector: p.sector },
      quote: {
        price: p.anchorPrice,
        week52High: Math.max(...last252.map((b) => b.high)),
        week52Low: Math.min(...last252.map((b) => b.low))
      },
      prices: { symbol: p.symbol, bars: p.barsToAnchor },
      ratios: p.ratios,
      peers: { symbol: p.symbol, sector: p.sector, peerMedian, self: null, peers: [] }
    } as unknown as CompanyDossier;

    const score = scoreCompany(dossier);
    const categories = Object.fromEntries(score.categories.map((c) => [c.key, c.score])) as Record<string, number | null>;

    return {
      symbol: p.symbol,
      name: p.name,
      sector: p.sector,
      peersInSector: group.length,
      valuationReference: usesSectorMedian ? 'industry' : 'universe',
      score: score.total,
      classification: score.classification,
      confidence: score.confidence,
      coverage: Number(score.coverage.toFixed(2)),
      categories,
      anchorPrice: Number(p.anchorPrice.toFixed(2)),
      forwardReturn: Number(p.forwardReturn.toFixed(4)),
      excessReturn: Number((p.forwardReturn - benchmarkReturn).toFixed(4))
    };
  });

  const output = {
    anchor: ANCHOR,
    forwardTradingDays: FORWARD_TRADING_DAYS,
    benchmark: BENCHMARK,
    benchmarkReturn: Number(benchmarkReturn.toFixed(4)),
    universe: symbols.length,
    scored: rows.length,
    generatedAt: new Date().toISOString(),
    method:
      'Fundamentals from the latest fiscal period ending on or before the anchor (Finnhub annual series). Valuation multiples recomputed from the anchor-day close and per-share fundamentals. Peer medians per Finnhub industry within this universe, falling back to the universe median where an industry has fewer than four members. Momentum from Twelve Data bars up to the anchor. Forward return over the next 252 trading days, excess return against SPY over the same window.',
    rows
  };
  writeFileSync(OUT_FILE, JSON.stringify(output, null, 1));
  console.log(`[compute] wrote ${OUT_FILE}: ${rows.length} rows, SPY ${(benchmarkReturn * 100).toFixed(1)}%`);
}

const mode = process.argv[2];
if (mode === 'fetch') {
  const fh = process.env.FINNHUB_KEY;
  const td = process.env.TWELVEDATA_KEY;
  if (!fh || !td) throw new Error('FINNHUB_KEY and TWELVEDATA_KEY are required');
  await Promise.all([fetchFinnhub(fh), fetchTwelveData(td)]);
} else if (mode === 'compute') {
  compute();
} else if (mode === 'status') {
  const fh = existsSync(join(CACHE_DIR, 'fh')) ? readdirSync(join(CACHE_DIR, 'fh')).length : 0;
  const td = existsSync(join(CACHE_DIR, 'td')) ? readdirSync(join(CACHE_DIR, 'td')).length : 0;
  console.log(`finnhub ${fh}/${symbols.length}  twelvedata ${td}/${symbols.length + 1}`);
} else {
  console.log('usage: backtest.ts fetch|compute|status');
}
