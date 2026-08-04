import type { CompanyDossier } from '../types';
import { Card, EmptyState, Section } from './ui/primitives';
import { formatBigMoney, formatMultiple, formatPercent } from '../lib/format';

interface Column {
  key: string;
  label: string;
  format: (v: number | null) => string;
  /** Null where "higher" is not automatically better, so no colour is applied. */
  higherIsBetter: boolean | null;
}

const COLUMNS: Column[] = [
  { key: 'revenueGrowthYoY', label: 'Revenue growth', format: (v) => formatPercent(v, 1, true), higherIsBetter: true },
  { key: 'operatingMargin', label: 'Operating margin', format: (v) => formatPercent(v), higherIsBetter: true },
  { key: 'returnOnEquity', label: 'Return on equity', format: (v) => formatPercent(v), higherIsBetter: true },
  { key: 'trailingPE', label: 'P/E', format: formatMultiple, higherIsBetter: false },
  { key: 'evToEbitda', label: 'EV/EBITDA', format: formatMultiple, higherIsBetter: false },
  { key: 'debtToEquity', label: 'Debt/equity', format: (v) => (v === null ? 'n/a' : v.toFixed(2)), higherIsBetter: null },
  { key: 'oneYearReturn', label: '1-year return', format: (v) => formatPercent(v, 1, true), higherIsBetter: null }
];

export function PeerComparison({ dossier }: { dossier: CompanyDossier }) {
  const { peers, ratios, profile } = dossier;

  const self = {
    symbol: profile.symbol,
    name: profile.name,
    marketCap: profile.marketCap,
    revenueGrowthYoY: ratios.revenueGrowthYoY,
    operatingMargin: ratios.operatingMargin,
    returnOnEquity: ratios.returnOnEquity,
    trailingPE: ratios.trailingPE,
    evToEbitda: ratios.evToEbitda,
    debtToEquity: ratios.debtToEquity,
    oneYearReturn: null as number | null
  };

  const hasPeerData = peers.peers.some((p) => p.operatingMargin !== null || p.trailingPE !== null);

  if (!peers.peers.length) {
    return (
      <Section id="peers" title="Competitor comparison">
        <EmptyState title="No peer set defined" detail={`No comparison group is configured for ${profile.symbol}.`} />
      </Section>
    );
  }

  if (!hasPeerData) {
    return (
      <Section id="peers" title="Competitor comparison" subtitle={`Peer group: ${peers.peers.map((p) => p.symbol).join(', ')}`}>
        <EmptyState
          title="Peer metrics not loaded"
          detail="Each peer costs one additional provider request, which exceeds the free daily budget. Peer figures are populated when running on sample data or with a higher-volume key."
        />
      </Section>
    );
  }

  const rows = [self, ...peers.peers];

  return (
    <Section
      id="peers"
      title="Competitor comparison"
      subtitle="Green marks the better reading on metrics where a direction is meaningful. Debt and one-year return are left uncoloured — neither is simply better when higher."
    >
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs tracking-wide text-slate-500 uppercase">
                <th scope="col" className="px-4 py-2.5 font-medium">Company</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Market cap</th>
                {COLUMNS.map((col) => (
                  <th key={col.key} scope="col" className="px-4 py-2.5 text-right font-medium whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.symbol}
                  className={`border-b border-slate-100 last:border-0 ${index === 0 ? 'bg-blue-50/50' : ''}`}
                >
                  <th scope="row" className="px-4 py-2.5 text-left font-medium whitespace-nowrap text-slate-900">
                    {row.symbol}
                    {index === 0 ? <span className="ml-1.5 text-xs font-normal text-blue-700">selected</span> : null}
                    <span className="block text-xs font-normal text-slate-500">{row.name}</span>
                  </th>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{formatBigMoney(row.marketCap)}</td>
                  {COLUMNS.map((col) => {
                    const value = (row as unknown as Record<string, number | null>)[col.key];
                    const values = rows
                      .map((r) => (r as unknown as Record<string, number | null>)[col.key])
                      .filter((v): v is number => v !== null);

                    let tone = 'text-slate-700';
                    if (col.higherIsBetter !== null && value !== null && values.length > 1) {
                      const best = col.higherIsBetter ? Math.max(...values) : Math.min(...values);
                      if (value === best) tone = 'text-emerald-700 font-semibold';
                    }

                    return (
                      <td key={col.key} className={`px-4 py-2.5 text-right tabular-nums ${tone}`}>
                        {col.format(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </Section>
  );
}
