import { useEffect, useMemo, useRef, useState } from 'react';
import { ChartNoAxesColumn } from 'lucide-react';
import type { EarningsEvent, HistoricalPrices, PriceBar } from '../types';
import { macd as computeMacd, rsi as computeRsi, sma } from '../lib/indicators';
import { formatCompact, formatCurrency } from '../lib/format';

/**
 * Interactive OHLC panel: candles, volume, MACD and RSI on a shared x-axis,
 * with range presets, explicit from/to dates, a crosshair readout and a brush.
 *
 * Written as plain SVG rather than a chart library because the four stacked
 * panels have to share one x-scale and one hover index exactly; wiring that
 * through a generic charting API costs more than drawing it.
 */

const PANELS = { price: 250, volume: 54, macd: 84, rsi: 76 };
const AXIS_HEIGHT = 22;
const BRUSH_HEIGHT = 34;
const PANEL_GAP = 10;
const PAD_LEFT = 58;
const PAD_RIGHT = 46;

const TOTAL_HEIGHT =
  PANELS.price + PANELS.volume + PANELS.macd + PANELS.rsi + PANEL_GAP * 3 + AXIS_HEIGHT + BRUSH_HEIGHT + 8;

const UP = '#059669';
const DOWN = '#dc2626';
const GRID = '#e2e8f0';
const AXIS_TEXT = '#64748b';

export type RangeKey = '1M' | '3M' | '6M' | '1Y' | '5Y' | 'YTD' | 'ALL';

/** Narrowest window the brush may be dragged to. */
const MIN_BRUSH_BARS = 8;

const RANGE_DAYS: Record<Exclude<RangeKey, 'YTD' | 'ALL'>, number> = {
  '1M': 22,
  '3M': 66,
  '6M': 128,
  '1Y': 252,
  '5Y': 1260
};

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(880);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    setWidth(node.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

/**
 * Maps a client x-coordinate into the SVG's own coordinate system.
 *
 * getBoundingClientRect is not enough: the viewBox is clamped to a minimum
 * width, so on a narrow container the SVG is scaled and one CSS pixel is not
 * one viewBox unit. Going through the screen CTM is correct at any scale, and
 * also survives browser zoom.
 */
function svgX(svg: SVGSVGElement, clientX: number): number | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = 0;
  return point.matrixTransform(ctm.inverse()).x;
}

function niceTicks(min: number, max: number, count: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min];
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) ticks.push(Number(v.toFixed(6)));
  return ticks;
}

export interface CandlestickChartProps {
  prices: HistoricalPrices;
  benchmark?: HistoricalPrices;
  earnings?: EarningsEvent[];
  currency?: string;
}

export function CandlestickChart({ prices, benchmark, earnings = [], currency = 'USD' }: CandlestickChartProps) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [range, setRange] = useState<RangeKey>('6M');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [hover, setHover] = useState<number | null>(null);
  /** Explicit window set by dragging the brush. Overrides the presets. */
  const [brush, setBrush] = useState<{ start: number; end: number } | null>(null);
  const dragRef = useRef<{ mode: 'pan' | 'left' | 'right'; from: number; start: number; end: number } | null>(null);
  const [showMa, setShowMa] = useState(true);
  const [compare, setCompare] = useState(false);

  const bars = prices.bars;
  const hasBars = bars.length > 1;

  // Indicators are computed over the complete series, then sliced. Computing
  // them on the visible window would change the values as you zoom.
  const indicators = useMemo(() => {
    const closes = bars.map((b) => b.close);
    return {
      macd: computeMacd(closes),
      rsi: computeRsi(closes, 14),
      ma50: sma(closes, 50),
      ma200: sma(closes, 200)
    };
  }, [bars]);

  const [startIndex, endIndex] = useMemo(() => {
    if (!bars.length) return [0, 0];
    if (brush) return [brush.start, brush.end];

    if (customFrom || customTo) {
      const from = customFrom || bars[0].date;
      const to = customTo || bars[bars.length - 1].date;
      let s = bars.findIndex((b) => b.date >= from);
      let e = bars.findLastIndex((b) => b.date <= to);
      if (s < 0) s = 0;
      if (e < 0) e = bars.length - 1;
      return s < e ? [s, e] : [Math.max(0, e - 5), e];
    }

    const end = bars.length - 1;
    // A preset the history cannot fill falls back to everything loaded, so the
    // selected button never disagrees with what is drawn.
    if (range === 'ALL' || (range !== 'YTD' && bars.length < RANGE_DAYS[range] * 0.9)) return [0, end];
    if (range === 'YTD') {
      const year = bars[end].date.slice(0, 4);
      const s = bars.findIndex((b) => b.date >= `${year}-01-01`);
      return [s < 0 ? 0 : s, end];
    }
    return [Math.max(0, end - RANGE_DAYS[range] + 1), end];
  }, [bars, range, customFrom, customTo, brush]);

  const visible = bars.slice(startIndex, endIndex + 1);
  const innerWidth = Math.max(width - PAD_LEFT - PAD_RIGHT, 120);
  const step = visible.length ? innerWidth / visible.length : 0;
  const candleWidth = Math.max(1, Math.min(step * 0.68, 14));

  const priceTop = 4;
  const volumeTop = priceTop + PANELS.price + PANEL_GAP;
  const macdTop = volumeTop + PANELS.volume + PANEL_GAP;
  const rsiTop = macdTop + PANELS.macd + PANEL_GAP;
  const axisY = rsiTop + PANELS.rsi;
  const brushTop = axisY + AXIS_HEIGHT;

  const xOf = (i: number) => PAD_LEFT + i * step + step / 2;

  // --- price scale --------------------------------------------------------
  const priceScale = useMemo(() => {
    if (!visible.length) return { min: 0, max: 1 };
    let min = Infinity;
    let max = -Infinity;
    for (const bar of visible) {
      min = Math.min(min, bar.low);
      max = Math.max(max, bar.high);
    }
    if (showMa) {
      for (let i = startIndex; i <= endIndex; i++) {
        for (const series of [indicators.ma50, indicators.ma200]) {
          const value = series[i];
          if (value !== null) {
            min = Math.min(min, value);
            max = Math.max(max, value);
          }
        }
      }
    }
    const pad = (max - min) * 0.08 || 1;
    return { min: min - pad, max: max + pad };
  }, [visible, showMa, indicators, startIndex, endIndex]);

  const yPrice = (value: number) =>
    priceTop + PANELS.price - ((value - priceScale.min) / (priceScale.max - priceScale.min)) * PANELS.price;

  // --- comparison mode ----------------------------------------------------
  const comparison = useMemo(() => {
    if (!compare || !benchmark?.bars.length || !visible.length) return null;

    const byDate = new Map(benchmark.bars.map((b) => [b.date, b.close]));
    const points = visible.map((bar) => ({ date: bar.date, stock: bar.close, bench: byDate.get(bar.date) ?? null }));
    const baseStock = points[0]?.stock ?? 1;
    const firstBench = points.find((p) => p.bench !== null)?.bench ?? null;
    if (!firstBench) return null;

    const series = points.map((p) => ({
      stock: (p.stock / baseStock) * 100,
      bench: p.bench === null ? null : (p.bench / firstBench) * 100
    }));

    const values = series.flatMap((p) => [p.stock, ...(p.bench === null ? [] : [p.bench])]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.08 || 1;
    return { series, min: min - pad, max: max + pad };
  }, [compare, benchmark, visible]);

  const yCompare = (value: number) => {
    if (!comparison) return 0;
    return priceTop + PANELS.price - ((value - comparison.min) / (comparison.max - comparison.min)) * PANELS.price;
  };

  // --- other panel scales -------------------------------------------------
  const maxVolume = Math.max(...visible.map((b) => b.volume), 1);
  const yVolume = (value: number) => volumeTop + PANELS.volume - (value / maxVolume) * PANELS.volume;

  const macdSlice = useMemo(() => {
    const values: number[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      for (const series of [indicators.macd.macd, indicators.macd.signal, indicators.macd.histogram]) {
        const v = series[i];
        if (v !== null) values.push(v);
      }
    }
    const max = values.length ? Math.max(...values.map(Math.abs)) : 1;
    return { bound: max || 1 };
  }, [indicators, startIndex, endIndex]);

  const yMacd = (value: number) => macdTop + PANELS.macd / 2 - (value / macdSlice.bound) * (PANELS.macd / 2 - 4);
  const yRsi = (value: number) => rsiTop + PANELS.rsi - (value / 100) * PANELS.rsi;

  // --- x-axis ticks -------------------------------------------------------
  const dateTicks = useMemo(() => {
    if (!visible.length) return [] as Array<{ i: number; label: string }>;
    const target = Math.max(2, Math.min(7, Math.floor(innerWidth / 110)));
    const every = Math.max(1, Math.floor(visible.length / target));
    return visible
      .map((bar, i) => ({ i, label: bar.date.slice(2) }))
      .filter((t) => t.i % every === 0 && t.i < visible.length - every / 2);
  }, [visible, innerWidth]);

  const earningsMarkers = useMemo(() => {
    if (!earnings.length || !visible.length) return [] as Array<{ i: number; event: EarningsEvent }>;
    const index = new Map(visible.map((bar, i) => [bar.date, i]));
    return earnings
      .map((event) => ({ i: index.get(event.date) ?? -1, event }))
      .filter((m) => m.i >= 0);
  }, [earnings, visible]);

  const hoveredBar: PriceBar | null = hover !== null ? (visible[hover] ?? null) : null;
  const hoveredGlobal = hover !== null ? startIndex + hover : null;

  const lastIndex = Math.max(bars.length - 1, 1);
  const brushX = (i: number) => PAD_LEFT + (i / lastIndex) * innerWidth;
  const brushIndexAt = (svg: SVGSVGElement, clientX: number): number | null => {
    const x = svgX(svg, clientX);
    return x === null ? null : Math.round(((x - PAD_LEFT) / innerWidth) * lastIndex);
  };

  function beginDrag(mode: 'pan' | 'left' | 'right', event: React.PointerEvent<SVGElement>) {
    event.preventDefault();
    event.stopPropagation();
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const from = brushIndexAt(svg, event.clientX);
    if (from === null) return;
    dragRef.current = { mode, from, start: startIndex, end: endIndex };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointer(event: React.PointerEvent<SVGSVGElement>) {
    const svg = event.currentTarget;
    const drag = dragRef.current;

    // While dragging the brush the pointer is steering the window, not the
    // crosshair, so the hover readout stands down until the drag ends.
    if (drag) {
      const index = brushIndexAt(svg, event.clientX);
      if (index === null) return;
      const delta = index - drag.from;
      const width = drag.end - drag.start;

      if (drag.mode === 'pan') {
        const start = Math.max(0, Math.min(lastIndex - width, drag.start + delta));
        setBrush({ start, end: start + width });
      } else if (drag.mode === 'left') {
        setBrush({ start: Math.max(0, Math.min(index, drag.end - MIN_BRUSH_BARS)), end: drag.end });
      } else {
        setBrush({ start: drag.start, end: Math.min(lastIndex, Math.max(index, drag.start + MIN_BRUSH_BARS)) });
      }
      setHover(null);
      return;
    }

    const x = svgX(svg, event.clientX);
    if (x === null) return;
    const index = Math.floor((x - PAD_LEFT) / step);
    setHover(index >= 0 && index < visible.length ? index : null);
  }

  function nudgeBrush(direction: -1 | 1, resize: boolean) {
    const width = endIndex - startIndex;
    const amount = Math.max(1, Math.round(width * 0.1));
    if (resize) {
      setBrush({
        start: startIndex,
        end: Math.min(lastIndex, Math.max(startIndex + MIN_BRUSH_BARS, endIndex + direction * amount))
      });
      return;
    }
    const start = Math.max(0, Math.min(lastIndex - width, startIndex + direction * amount));
    setBrush({ start, end: start + width });
  }

  const priceTicks = niceTicks(priceScale.min, priceScale.max, 5);
  const compareTicks = comparison ? niceTicks(comparison.min, comparison.max, 5) : [];

  const readout = (() => {
    if (!hoveredBar || hoveredGlobal === null) return null;
    const prev = bars[hoveredGlobal - 1]?.close ?? hoveredBar.close;
    const change = hoveredBar.close - prev;
    return {
      bar: hoveredBar,
      change,
      changePct: prev ? (change / prev) * 100 : 0,
      rsi: indicators.rsi[hoveredGlobal],
      macd: indicators.macd.macd[hoveredGlobal],
      signal: indicators.macd.signal[hoveredGlobal]
    };
  })();

  const rangeUnavailable = (key: RangeKey): boolean =>
    key !== 'ALL' && key !== 'YTD' && bars.length < RANGE_DAYS[key] * 0.9;

  const effectiveRange: RangeKey = rangeUnavailable(range) ? 'ALL' : range;

  const activeRangeButton = (key: RangeKey) =>
    !brush && !customFrom && !customTo && effectiveRange === key
      ? 'bg-slate-900 text-white'
      : 'bg-white text-slate-600 hover:bg-slate-100';

  /**
   * Offering "5Y" over five months of data would show the same chart under a
   * different label, so those presets are disabled and say why on hover.
   */
  const historyMonths = Math.round((bars.length / 21) * 10) / 10;

  // An empty SVG shell with "undefined to undefined" on the brush is worse than
  // saying plainly that there is nothing to draw.
  if (!hasBars) {
    return (
      <div ref={wrapRef} className="w-full">
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6">
          <ChartNoAxesColumn className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <div>
            <p className="text-sm font-medium text-slate-700">No price history loaded</p>
            <p className="mt-0.5 text-sm text-slate-500">
              The configured provider does not supply daily bars for {prices.symbol}. Finnhub keeps price history
              behind a paid plan — add a Twelve Data key under <strong>API keys</strong> for several years of it, free.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="w-full">
      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-300" role="group" aria-label="Chart range">
          {(['1M', '3M', '6M', '1Y', '5Y', 'YTD', 'ALL'] as RangeKey[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={!brush && !customFrom && !customTo && effectiveRange === key}
              disabled={rangeUnavailable(key)}
              title={
                rangeUnavailable(key)
                  ? `Only ${historyMonths} months of price history loaded. Add a Twelve Data key for multi-year history.`
                  : undefined
              }
              onClick={() => {
                setRange(key);
                setCustomFrom('');
                setCustomTo('');
                setBrush(null);
              }}
              className={`px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300 ${activeRangeButton(key)}`}
            >
              {key}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <label htmlFor="chart-from" className="font-medium">
            From
          </label>
          <input
            id="chart-from"
            type="date"
            value={customFrom}
            min={bars[0]?.date}
            max={bars[bars.length - 1]?.date}
            onChange={(e) => {
              setCustomFrom(e.target.value);
              setBrush(null);
            }}
            className="rounded-md border border-slate-300 px-1.5 py-1"
          />
          <label htmlFor="chart-to" className="font-medium">
            To
          </label>
          <input
            id="chart-to"
            type="date"
            value={customTo}
            min={bars[0]?.date}
            max={bars[bars.length - 1]?.date}
            onChange={(e) => {
              setCustomTo(e.target.value);
              setBrush(null);
            }}
            className="rounded-md border border-slate-300 px-1.5 py-1"
          />
          {(customFrom || customTo) && (
            <button
              type="button"
              onClick={() => {
                setCustomFrom('');
                setCustomTo('');
                setBrush(null);
              }}
              className="rounded-md border border-slate-300 px-1.5 py-1 font-medium hover:bg-slate-100"
            >
              Reset
            </button>
          )}
        </div>

        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <input type="checkbox" checked={showMa} onChange={(e) => setShowMa(e.target.checked)} className="accent-slate-900" />
          50 / 200-day average
        </label>

        {benchmark?.bars.length ? (
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="accent-slate-900" />
            Compare with {benchmark.symbol} (indexed to 100)
          </label>
        ) : null}
      </div>

      {/* Crosshair readout */}
      <div
        aria-live="polite"
        className="mb-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs tabular-nums text-slate-700"
      >
        {readout ? (
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <strong className="font-semibold text-slate-900">{readout.bar.date}</strong>
            <span>O {formatCurrency(readout.bar.open, currency)}</span>
            <span>H {formatCurrency(readout.bar.high, currency)}</span>
            <span>L {formatCurrency(readout.bar.low, currency)}</span>
            <span>C {formatCurrency(readout.bar.close, currency)}</span>
            <span className={readout.change >= 0 ? 'text-emerald-700' : 'text-red-700'}>
              {readout.change >= 0 ? '+' : ''}
              {readout.change.toFixed(2)} ({readout.changePct >= 0 ? '+' : ''}
              {readout.changePct.toFixed(2)}%)
            </span>
            <span>Vol {formatCompact(readout.bar.volume)}</span>
            <span>RSI {readout.rsi !== null ? readout.rsi.toFixed(1) : '—'}</span>
            <span>MACD {readout.macd !== null ? readout.macd.toFixed(2) : '—'}</span>
            <span>Sig {readout.signal !== null ? readout.signal.toFixed(2) : '—'}</span>
          </span>
        ) : (
          <span className="text-slate-500">Hover the chart to read a session's open, high, low, close and indicators.</span>
        )}
      </div>

      <svg
        role="img"
        aria-label={`Price, volume, MACD and RSI for ${prices.symbol}`}
        width="100%"
        height={TOTAL_HEIGHT}
        viewBox={`0 0 ${Math.max(width, 320)} ${TOTAL_HEIGHT}`}
        onPointerMove={handlePointer}
        onPointerLeave={() => setHover(null)}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
        className="touch-pan-y select-none"
      >
        {/* Price grid */}
        {(comparison ? compareTicks : priceTicks).map((tick) => {
          const y = comparison ? yCompare(tick) : yPrice(tick);
          return (
            <g key={`pg-${tick}`}>
              <line x1={PAD_LEFT} x2={width - PAD_RIGHT} y1={y} y2={y} stroke={GRID} strokeWidth={1} />
              <text x={PAD_LEFT - 6} y={y + 3} textAnchor="end" fontSize={10} fill={AXIS_TEXT}>
                {comparison ? tick.toFixed(0) : formatCurrency(tick, currency, 0)}
              </text>
            </g>
          );
        })}

        {comparison ? (
          <>
            <path
              d={comparison.series
                .map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i)},${yCompare(p.stock)}`)
                .join(' ')}
              fill="none"
              stroke="#1d4ed8"
              strokeWidth={1.8}
            />
            <path
              d={comparison.series
                .map((p, i) => (p.bench === null ? '' : `${i === 0 ? 'M' : 'L'}${xOf(i)},${yCompare(p.bench)}`))
                .filter(Boolean)
                .join(' ')
                .replace(/^L/, 'M')}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={1.6}
              strokeDasharray="4 3"
            />
          </>
        ) : (
          <>
            {/* Candles */}
            {visible.map((bar, i) => {
              const rising = bar.close >= bar.open;
              const color = rising ? UP : DOWN;
              const x = xOf(i);
              const bodyTop = yPrice(Math.max(bar.open, bar.close));
              const bodyBottom = yPrice(Math.min(bar.open, bar.close));
              return (
                <g key={bar.date}>
                  <line x1={x} x2={x} y1={yPrice(bar.high)} y2={yPrice(bar.low)} stroke={color} strokeWidth={1} />
                  <rect
                    x={x - candleWidth / 2}
                    y={bodyTop}
                    width={candleWidth}
                    height={Math.max(1, bodyBottom - bodyTop)}
                    fill={color}
                  />
                </g>
              );
            })}

            {showMa &&
              (['ma50', 'ma200'] as const).map((key) => {
                const stroke = key === 'ma50' ? '#f59e0b' : '#7c3aed';
                const d = visible
                  .map((_, i) => {
                    const value = indicators[key][startIndex + i];
                    return value === null ? '' : `L${xOf(i)},${yPrice(value)}`;
                  })
                  .filter(Boolean)
                  .join(' ')
                  .replace(/^L/, 'M');
                return d ? <path key={key} d={d} fill="none" stroke={stroke} strokeWidth={1.4} /> : null;
              })}
          </>
        )}

        {/* Earnings markers */}
        {earningsMarkers.map(({ i, event }) => (
          <g key={`e-${event.date}`}>
            <line
              x1={xOf(i)}
              x2={xOf(i)}
              y1={priceTop}
              y2={priceTop + PANELS.price}
              stroke="#0f172a"
              strokeWidth={1}
              strokeDasharray="2 3"
              opacity={0.35}
            />
            <text x={xOf(i)} y={priceTop + 10} textAnchor="middle" fontSize={9} fill="#0f172a" opacity={0.75}>
              E
            </text>
          </g>
        ))}

        {/* Volume */}
        <text x={PAD_LEFT - 6} y={volumeTop + 9} textAnchor="end" fontSize={9} fill={AXIS_TEXT}>
          Vol
        </text>
        {visible.map((bar, i) => {
          const rising = bar.close >= bar.open;
          const y = yVolume(bar.volume);
          return (
            <rect
              key={`v-${bar.date}`}
              x={xOf(i) - candleWidth / 2}
              y={y}
              width={candleWidth}
              height={volumeTop + PANELS.volume - y}
              fill={rising ? UP : DOWN}
              opacity={0.35}
            />
          );
        })}

        {/* MACD */}
        <line x1={PAD_LEFT} x2={width - PAD_RIGHT} y1={yMacd(0)} y2={yMacd(0)} stroke={GRID} />
        <text x={PAD_LEFT - 6} y={macdTop + 9} textAnchor="end" fontSize={9} fill={AXIS_TEXT}>
          MACD
        </text>
        {visible.map((bar, i) => {
          const value = indicators.macd.histogram[startIndex + i];
          if (value === null) return null;
          const zero = yMacd(0);
          const y = yMacd(value);
          return (
            <rect
              key={`m-${bar.date}`}
              x={xOf(i) - candleWidth / 2}
              y={Math.min(zero, y)}
              width={candleWidth}
              height={Math.max(1, Math.abs(zero - y))}
              fill={value >= 0 ? UP : DOWN}
              opacity={0.55}
            />
          );
        })}
        {(['macd', 'signal'] as const).map((key) => {
          const d = visible
            .map((_, i) => {
              const value = indicators.macd[key][startIndex + i];
              return value === null ? '' : `L${xOf(i)},${yMacd(value)}`;
            })
            .filter(Boolean)
            .join(' ')
            .replace(/^L/, 'M');
          return d ? (
            <path key={key} d={d} fill="none" stroke={key === 'macd' ? '#2563eb' : '#f97316'} strokeWidth={1.3} />
          ) : null;
        })}

        {/* RSI */}
        <text x={PAD_LEFT - 6} y={rsiTop + 9} textAnchor="end" fontSize={9} fill={AXIS_TEXT}>
          RSI
        </text>
        {[30, 70].map((level) => (
          <g key={`r-${level}`}>
            <line
              x1={PAD_LEFT}
              x2={width - PAD_RIGHT}
              y1={yRsi(level)}
              y2={yRsi(level)}
              stroke={level === 70 ? DOWN : UP}
              strokeDasharray="3 3"
              strokeWidth={1}
              opacity={0.5}
            />
            <text x={width - PAD_RIGHT + 4} y={yRsi(level) + 3} fontSize={9} fill={AXIS_TEXT}>
              {level}
            </text>
          </g>
        ))}
        <path
          d={visible
            .map((_, i) => {
              const value = indicators.rsi[startIndex + i];
              return value === null ? '' : `L${xOf(i)},${yRsi(value)}`;
            })
            .filter(Boolean)
            .join(' ')
            .replace(/^L/, 'M')}
          fill="none"
          stroke="#7c3aed"
          strokeWidth={1.4}
        />

        {/* X axis */}
        {dateTicks.map((tick) => (
          <text key={tick.i} x={xOf(tick.i)} y={axisY + 13} textAnchor="middle" fontSize={10} fill={AXIS_TEXT}>
            {tick.label}
          </text>
        ))}

        {/* Crosshair */}
        {hover !== null && visible[hover] ? (
          <line
            x1={xOf(hover)}
            x2={xOf(hover)}
            y1={priceTop}
            y2={axisY}
            stroke="#0f172a"
            strokeWidth={1}
            opacity={0.35}
            pointerEvents="none"
          />
        ) : null}

        {/* Brush: drag the window to pan, drag an edge to resize */}
        <g transform={`translate(0, ${brushTop})`}>
          <rect x={PAD_LEFT} y={0} width={innerWidth} height={BRUSH_HEIGHT - 8} fill="#f1f5f9" rx={4} />
          {(() => {
            const closes = bars.map((b) => b.close);
            const min = Math.min(...closes);
            const max = Math.max(...closes);
            const h = BRUSH_HEIGHT - 12;
            const outline = bars
              .map((bar, i) => {
                const y = 2 + h - ((bar.close - min) / (max - min || 1)) * h;
                return `${i === 0 ? 'M' : 'L'}${brushX(i)},${y}`;
              })
              .join(' ');
            const x1 = brushX(startIndex);
            const x2 = brushX(endIndex);

            return (
              <>
                <path d={outline} fill="none" stroke="#94a3b8" strokeWidth={1} pointerEvents="none" />

                {/* Window: drag to pan. Focusable so it is reachable without a pointer. */}
                <rect
                  x={x1}
                  y={0}
                  width={Math.max(2, x2 - x1)}
                  height={BRUSH_HEIGHT - 8}
                  fill="#2563eb"
                  opacity={0.16}
                  style={{ cursor: 'grab' }}
                  tabIndex={0}
                  role="slider"
                  aria-label="Visible date window. Arrow keys pan, shift and arrow keys resize."
                  aria-valuemin={0}
                  aria-valuemax={lastIndex}
                  aria-valuenow={startIndex}
                  aria-valuetext={`${bars[startIndex]?.date} to ${bars[endIndex]?.date}`}
                  onPointerDown={(e) => beginDrag('pan', e)}
                  onKeyDown={(e) => {
                    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                    e.preventDefault();
                    nudgeBrush(e.key === 'ArrowLeft' ? -1 : 1, e.shiftKey);
                  }}
                />

                {/* Edge handles. The wide transparent rect is the grab target. */}
                {([['left', x1], ['right', x2]] as const).map(([side, x]) => (
                  <g key={side} style={{ cursor: 'ew-resize' }} onPointerDown={(e) => beginDrag(side, e)}>
                    <rect x={x - 6} y={0} width={12} height={BRUSH_HEIGHT - 8} fill="transparent" />
                    <line x1={x} x2={x} y1={0} y2={BRUSH_HEIGHT - 8} stroke="#2563eb" strokeWidth={2} />
                    <rect x={x - 2.5} y={(BRUSH_HEIGHT - 8) / 2 - 5} width={5} height={10} rx={1.5} fill="#2563eb" />
                  </g>
                ))}
              </>
            );
          })()}
        </g>
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
        {comparison ? (
          <>
            <LegendDot color="#1d4ed8" label={prices.symbol} />
            <LegendDot color="#94a3b8" label={`${benchmark?.symbol ?? 'Benchmark'} (dashed)`} />
          </>
        ) : (
          <>
            <LegendDot color={UP} label="Close above open" />
            <LegendDot color={DOWN} label="Close below open" />
            {showMa ? <LegendDot color="#f59e0b" label="50-day average" /> : null}
            {showMa ? <LegendDot color="#7c3aed" label="200-day average" /> : null}
          </>
        )}
        {earningsMarkers.length ? <span>E = earnings date</span> : null}
        <span className="text-slate-400">
          Drag the blue window below the axis to pan, drag its edges to zoom.
        </span>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {label}
    </span>
  );
}
