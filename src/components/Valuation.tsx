import type { CompanyDossier } from '../types';
import { Card, InfoTip, Pill, Section } from './ui/primitives';
import { formatMultiple, formatPercent } from '../lib/format';

interface Row {
  label: string;
  hint: string;
  value: number | null;
  median: number | null;
  format: (v: number | null) => string;
  /** True when a lower number is the more attractive one. */
  lowerIsBetter: boolean;
  unavailableReason?: string;
}

export function Valuation({ dossier }: { dossier: CompanyDossier }) {
  const { ratios, peers } = dossier;

  const rows: Row[] = [
    {
      label: 'Trailing P/E',
      hint: 'Share price divided by the last twelve months of earnings.',
      value: ratios.trailingPE,
      median: peers.sectorMedian.trailingPE,
      format: formatMultiple,
      lowerIsBetter: true,
      unavailableReason: 'Not meaningful when trailing earnings are negative.'
    },
    {
      label: 'Forward P/E',
      hint: 'Share price divided by expected earnings for the coming year.',
      value: ratios.forwardPE,
      median: null,
      format: formatMultiple,
      lowerIsBetter: true
    },
    {
      label: 'Price to sales',
      hint: 'Market value relative to revenue. Useful when earnings are thin or negative.',
      value: ratios.priceToSales,
      median: null,
      format: formatMultiple,
      lowerIsBetter: true
    },
    {
      label: 'EV / EBITDA',
      hint: 'Enterprise value against operating earnings before depreciation. Neutral to how the company is financed.',
      value: ratios.evToEbitda,
      median: peers.sectorMedian.evToEbitda,
      format: formatMultiple,
      lowerIsBetter: true,
      unavailableReason: 'Not meaningful when EBITDA is negative.'
    },
    {
      label: 'Free cash flow yield',
      hint: 'Free cash flow as a percentage of market value. The cash return at the current price.',
      value: ratios.freeCashFlowYield,
      median: null,
      format: (v) => formatPercent(v),
      lowerIsBetter: false
    },
    {
      label: 'PEG ratio',
      hint: 'P/E divided by the expected growth rate. Below 1 is traditionally considered cheap for the growth.',
      value: ratios.pegRatio,
      median: null,
      format: (v) => (v === null ? 'n/a' : v.toFixed(2)),
      lowerIsBetter: true,
      unavailableReason: 'Needs a positive P/E and a positive growth estimate.'
    },
    {
      label: 'Price to book',
      hint: 'Market value against accounting net assets. Most informative for asset-heavy businesses.',
      value: ratios.priceToBook,
      median: null,
      format: formatMultiple,
      lowerIsBetter: true
    }
  ];

  return (
    <Section
      id="valuation"
      title="Valuation"
      subtitle={`Compared with the ${peers.sector ?? 'sector'} median where one is available. Colour marks cheaper or dearer than peers — not good or bad.`}
    >
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs tracking-wide text-slate-500 uppercase">
                <th scope="col" className="px-4 py-2.5 font-medium">Metric</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">{dossier.profile.symbol}</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Sector median</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">vs median</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const comparable = row.value !== null && row.median !== null && row.median > 0 && row.value > 0;
                const relative = comparable ? (row.value as number) / (row.median as number) - 1 : null;
                const cheaper = relative !== null && (row.lowerIsBetter ? relative < 0 : relative > 0);

                return (
                  <tr key={row.label} className="border-b border-slate-100 last:border-0">
                    <th scope="row" className="px-4 py-2.5 text-left font-normal text-slate-700">
                      <span className="inline-flex items-center gap-1">
                        {row.label}
                        <InfoTip label={row.hint} />
                      </span>
                    </th>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums text-slate-900">
                      {row.value === null ? (
                        <span className="text-slate-400" title={row.unavailableReason}>
                          not meaningful
                        </span>
                      ) : (
                        row.format(row.value)
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">
                      {row.median === null ? '—' : row.format(row.median)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {relative === null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <Pill tone={cheaper ? 'green' : 'red'}>
                          {relative > 0 ? '+' : ''}
                          {(relative * 100).toFixed(0)}% {cheaper ? 'cheaper' : 'dearer'}
                        </Pill>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
          Metrics that cannot be computed are labelled &ldquo;not meaningful&rdquo; rather than shown as zero, which would
          read as extremely cheap.
        </p>
      </Card>
    </Section>
  );
}
