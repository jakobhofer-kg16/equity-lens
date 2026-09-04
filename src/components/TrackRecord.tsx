import { useMemo } from 'react';
import { FlaskConical } from 'lucide-react';
import backtest from '../data/backtest.json';
import {
  byClassification,
  categoryPower,
  noiseFloor,
  quantiles,
  verdict,
  type BacktestFile,
  type BacktestRow
} from '../lib/backtestStats';
import { Card, GeneratedBadge, Pill, Section } from './ui/primitives';
import { formatDate, formatPercent } from '../lib/format';

const CATEGORY_LABEL: Record<string, string> = {
  growth: 'Growth',
  profitability: 'Profitability',
  valuation: 'Valuation vs peers',
  health: 'Financial health',
  momentum: 'Price momentum'
};

function Scatter({ rows }: { rows: BacktestRow[] }) {
  const W = 640;
  const H = 260;
  const PAD = { l: 44, r: 12, t: 10, b: 28 };
  const ys = rows.map((r) => r.excessReturn);
  const yMin = Math.min(-0.5, ...ys);
  const yMax = Math.max(0.5, ...ys);
  const x = (s: number) => PAD.l + (s / 100) * (W - PAD.l - PAD.r);
  const y = (e: number) => PAD.t + (1 - (e - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  const color = { Bullish: '#059669', Watch: '#d97706', Bearish: '#dc2626' } as const;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Score against excess return, one dot per company">
      <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} stroke="#94a3b8" strokeDasharray="3 3" />
      {[0, 25, 50, 75, 100].map((s) => (
        <g key={s}>
          <line x1={x(s)} x2={x(s)} y1={PAD.t} y2={H - PAD.b} stroke="#e2e8f0" />
          <text x={x(s)} y={H - 8} textAnchor="middle" fontSize={10} fill="#64748b">
            {s}
          </text>
        </g>
      ))}
      {[yMin, 0, yMax].map((e) => (
        <text key={e} x={PAD.l - 6} y={y(e) + 3} textAnchor="end" fontSize={10} fill="#64748b">
          {formatPercent(e, 0, true)}
        </text>
      ))}
      {rows.map((r) => (
        <circle key={r.symbol} cx={x(r.score)} cy={y(r.excessReturn)} r={3} fill={color[r.classification]} opacity={0.65}>
          <title>
            {r.symbol}: score {r.score}, excess {formatPercent(r.excessReturn, 1, true)}
          </title>
        </circle>
      ))}
      <text x={W / 2} y={H - 18} textAnchor="middle" fontSize={10} fill="#64748b">
        score at anchor →
      </text>
    </svg>
  );
}

export function TrackRecord() {
  const data = backtest as BacktestFile;
  const rows = data.rows;

  const stats = useMemo(
    () => ({
      verdict: verdict(rows),
      quintiles: quantiles(rows, 5),
      classes: byClassification(rows),
      categories: categoryPower(rows),
      floor: noiseFloor(rows.length)
    }),
    [rows]
  );

  if (!rows.length) return null;

  const tone = stats.verdict.reading === 'positive' ? 'green' : stats.verdict.reading === 'inverse' ? 'red' : 'amber';

  return (
    <Section
      id="track-record"
      title="Track record of the model"
      subtitle={`The score as it would have been on ${formatDate(data.anchor)}, using only data available then, against the excess return over ${data.benchmark} across the following ${data.forwardTradingDays} trading days. Universe: the ${data.universe} S&P 500 companies in the course transcript archive, ${data.scored} with complete data.`}
      action={<GeneratedBadge label="Computed offline, committed" />}
    >
      <div className="space-y-3">
        <Card className={`border-l-4 p-5 ${tone === 'green' ? 'border-l-emerald-500' : tone === 'red' ? 'border-l-red-500' : 'border-l-amber-500'}`}>
          <div className="flex flex-wrap items-center gap-2">
            <FlaskConical className="h-4 w-4 text-slate-500" aria-hidden />
            <h3 className="text-sm font-semibold text-slate-900">Finding</h3>
            <Pill tone={tone}>
              {stats.verdict.reading === 'positive' ? 'weak signal' : stats.verdict.reading === 'inverse' ? 'inverse' : 'no signal'}
            </Pill>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{stats.verdict.sentence}</p>
          <p className="mt-2 text-xs text-slate-500">
            {data.benchmark} returned {formatPercent(data.benchmarkReturn, 1, true)} over the window, so excess return is what
            selection added on top of simply owning the index. One anchor date is one draw; a different year could read
            differently.
          </p>
        </Card>

        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="p-4">
            <h4 className="text-sm font-semibold text-slate-900">By score quintile</h4>
            <p className="mt-0.5 text-xs text-slate-500">Q1 is the lowest fifth of scores, Q5 the highest. If the score works, the right column should rise.</p>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs tracking-wide text-slate-500 uppercase">
                  <th className="py-1.5 font-medium">Quintile</th>
                  <th className="py-1.5 text-right font-medium">Scores</th>
                  <th className="py-1.5 text-right font-medium">n</th>
                  <th className="py-1.5 text-right font-medium">Beat {data.benchmark}</th>
                  <th className="py-1.5 text-right font-medium">Median excess</th>
                </tr>
              </thead>
              <tbody>
                {stats.quintiles.map((q) => (
                  <tr key={q.label} className="border-b border-slate-100 last:border-0">
                    <td className="py-1.5 text-slate-700">{q.label}</td>
                    <td className="py-1.5 text-right tabular-nums text-slate-500">
                      {q.scoreRange[0]}–{q.scoreRange[1]}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-slate-500">{q.n}</td>
                    <td className="py-1.5 text-right tabular-nums text-slate-700">{formatPercent(q.hitRate, 0)}</td>
                    <td className={`py-1.5 text-right tabular-nums font-medium ${(q.medianExcess ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {formatPercent(q.medianExcess, 1, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="p-4">
            <h4 className="text-sm font-semibold text-slate-900">By classification</h4>
            <p className="mt-0.5 text-xs text-slate-500">What the three labels would have delivered.</p>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs tracking-wide text-slate-500 uppercase">
                  <th className="py-1.5 font-medium">Label</th>
                  <th className="py-1.5 text-right font-medium">n</th>
                  <th className="py-1.5 text-right font-medium">Beat {data.benchmark}</th>
                  <th className="py-1.5 text-right font-medium">Median excess</th>
                </tr>
              </thead>
              <tbody>
                {stats.classes.map((c) => (
                  <tr key={c.label} className="border-b border-slate-100 last:border-0">
                    <td className="py-1.5 text-slate-700">{c.label}</td>
                    <td className="py-1.5 text-right tabular-nums text-slate-500">{c.n}</td>
                    <td className="py-1.5 text-right tabular-nums text-slate-700">{formatPercent(c.hitRate, 0)}</td>
                    <td className={`py-1.5 text-right tabular-nums font-medium ${(c.medianExcess ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {formatPercent(c.medianExcess, 1, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h4 className="mt-5 text-sm font-semibold text-slate-900">Which category carried any signal</h4>
            <p className="mt-0.5 text-xs text-slate-500">
              Rank correlation of each category score with excess return. Values inside ±{stats.floor.toFixed(2)} are noise at this sample size.
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {stats.categories.map((c) => {
                const strong = c.rho !== null && Math.abs(c.rho) > stats.floor;
                return (
                  <li key={c.key} className="flex items-center justify-between gap-3">
                    <span className="text-slate-700">{CATEGORY_LABEL[c.key]}</span>
                    <span className={`tabular-nums ${strong ? (c.rho! > 0 ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium') : 'text-slate-400'}`}>
                      {c.rho === null ? 'n/a' : `ρ ${c.rho >= 0 ? '+' : ''}${c.rho.toFixed(2)}`} <span className="text-slate-400">(n={c.n})</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <Card className="p-4">
          <h4 className="text-sm font-semibold text-slate-900">Every company</h4>
          <p className="mt-0.5 text-xs text-slate-500">One dot per company: score on {formatDate(data.anchor)} against excess return over the following year. Hover for the ticker.</p>
          <div className="mt-2">
            <Scatter rows={rows} />
          </div>
          <details className="mt-3 text-xs text-slate-500">
            <summary className="cursor-pointer font-medium text-slate-700">Method</summary>
            <p className="mt-1.5 leading-relaxed">{data.method}</p>
            <p className="mt-1.5 leading-relaxed">
              Growth is measured on per-share revenue, which buybacks flatter. Interest coverage and the PEG ratio are not
              available historically, so those metrics are absent and their weight redistributed. Generated{' '}
              {formatDate(data.generatedAt.slice(0, 10))} with <code>npm run backtest:fetch</code> and <code>npm run backtest:compute</code>;
              the raw provider responses are cached locally and not committed.
            </p>
          </details>
        </Card>
      </div>
    </Section>
  );
}
