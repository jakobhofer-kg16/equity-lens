import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CompanyDossier } from '../types';
import { Card, EmptyState, Metric, Section } from './ui/primitives';
import { formatBigMoney, formatCompact, formatCurrency, formatMultiple, formatPercent } from '../lib/format';

const HINTS = {
  revenue: 'Total sales booked in the period, before any costs.',
  eps: 'Net profit divided by shares outstanding. What one share earned.',
  grossMargin: 'Revenue left after the direct cost of producing the product.',
  operatingMargin: 'Profit from running the business, before interest and tax. The cleanest read on operating quality.',
  fcf: 'Cash from operations minus capital spending. Cash the business can actually hand out.',
  roe: 'Profit earned per unit of shareholder capital. High values can also come from heavy debt.',
  roic: 'Return on all invested capital, debt included. Harder to flatter than return on equity.',
  debtToEquity: 'Borrowings relative to shareholder capital. Higher means more financial risk.',
  interestCoverage: 'How many times operating profit covers the interest bill. Below about 3x is tight.'
};

function ChartFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <h4 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</h4>
      <div className="h-44">{children}</div>
    </div>
  );
}

export function Fundamentals({ dossier }: { dossier: CompanyDossier }) {
  const { statements, ratios, profile } = dossier;
  const annual = statements.annual;

  if (!annual.length) {
    return (
      <Section id="fundamentals" title="Business fundamentals">
        <EmptyState
          title="No financial statements available"
          detail="The configured provider did not return annual statements for this ticker. Ratios sourced from the overview endpoint are still shown in the valuation section."
        />
      </Section>
    );
  }

  const revenueSeries = annual.map((period, i) => {
    const prior = annual[i - 1];
    return {
      year: String(period.fiscalYear),
      revenue: period.revenue ?? 0,
      growth: prior?.revenue && period.revenue ? (period.revenue / prior.revenue - 1) * 100 : null
    };
  });

  const marginSeries = annual.map((period) => ({
    year: String(period.fiscalYear),
    gross: period.revenue && period.grossProfit ? (period.grossProfit / period.revenue) * 100 : null,
    operating: period.revenue && period.operatingIncome ? (period.operatingIncome / period.revenue) * 100 : null
  }));

  const cashSeries = annual.map((period) => ({
    year: String(period.fiscalYear),
    fcf: period.freeCashFlow ?? 0
  }));

  const epsSeries = annual.filter((p) => p.eps !== null).map((p) => ({ year: String(p.fiscalYear), eps: p.eps as number }));

  return (
    <Section
      id="fundamentals"
      title="Business fundamentals"
      subtitle="Trends first — a single latest number hides whether the business is improving or drifting."
    >
      <Card className="p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Gross margin" value={formatPercent(ratios.grossMargin)} hint={HINTS.grossMargin} />
          <Metric label="Operating margin" value={formatPercent(ratios.operatingMargin)} hint={HINTS.operatingMargin} />
          <Metric label="Return on equity" value={formatPercent(ratios.returnOnEquity)} hint={HINTS.roe} />
          <Metric label="Return on invested capital" value={formatPercent(ratios.returnOnInvestedCapital)} hint={HINTS.roic} />
          <Metric label="Debt to equity" value={ratios.debtToEquity !== null ? ratios.debtToEquity.toFixed(2) : 'n/a'} hint={HINTS.debtToEquity} />
          <Metric label="Interest coverage" value={formatMultiple(ratios.interestCoverage)} hint={HINTS.interestCoverage} />
          <Metric label="Revenue growth (YoY)" value={formatPercent(ratios.revenueGrowthYoY, 1, true)} hint={HINTS.revenue} />
          <Metric label="Free cash flow yield" value={formatPercent(ratios.freeCashFlowYield)} hint={HINTS.fcf} />
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <ChartFrame title="Revenue by fiscal year">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueSeries} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={44} />
                <Tooltip
                  formatter={(value) => [formatBigMoney(Number(value), profile.currency), 'Revenue']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="revenue" fill="#1e293b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>

          <ChartFrame title="Margins (%)">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={marginSeries} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} />
                <Tooltip
                  formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name === 'gross' ? 'Gross' : 'Operating']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Line type="monotone" dataKey="gross" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="operating" stroke="#1e293b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartFrame>

          <ChartFrame title="Free cash flow">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashSeries} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={44} />
                <Tooltip
                  formatter={(value) => [formatBigMoney(Number(value), profile.currency), 'Free cash flow']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="fcf" fill="#0d9488" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>

          {epsSeries.length ? (
            <ChartFrame title="Earnings per share">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={epsSeries} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip
                    formatter={(value) => [formatCurrency(Number(value), profile.currency), 'EPS']}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Line type="monotone" dataKey="eps" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartFrame>
          ) : (
            <EmptyState title="No EPS history" detail="The provider did not return per-share earnings for these periods." />
          )}
        </div>
      </Card>
    </Section>
  );
}
