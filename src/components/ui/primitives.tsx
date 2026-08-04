import { useId, useState, type ReactNode } from 'react';
import { AlertTriangle, HelpCircle, Inbox } from 'lucide-react';

export function Section({
  id,
  title,
  subtitle,
  action,
  children
}: {
  id: string;
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-20">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={`${id}-heading`} className="text-lg font-semibold tracking-tight text-slate-900">
            {title}
          </h2>
          {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>
  );
}

/** Keyboard- and pointer-accessible explanation of a metric. */
export function InfoTip({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={`What is this? ${label}`}
        aria-describedby={open ? id : undefined}
        className="text-slate-400 transition hover:text-slate-700"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-30 mb-2 w-60 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs leading-relaxed font-normal text-slate-100 shadow-lg"
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}

export function Metric({
  label,
  value,
  hint,
  tone = 'neutral',
  sub
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'positive' | 'negative';
  sub?: string;
}) {
  const toneClass =
    tone === 'positive' ? 'text-emerald-700' : tone === 'negative' ? 'text-red-700' : 'text-slate-900';

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex items-center gap-1 text-xs font-medium tracking-wide text-slate-500 uppercase">
        {label}
        {hint ? <InfoTip label={hint} /> : null}
      </div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${toneClass}`}>{value}</div>
      {sub ? <div className="text-xs text-slate-500">{sub}</div> : null}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5">
      <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      <div>
        <p className="text-sm font-medium text-slate-700">{title}</p>
        <p className="mt-0.5 text-sm text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

export function ErrorState({ title, detail, onRetry }: { title: string; detail: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-5">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden />
      <div>
        <p className="text-sm font-medium text-red-900">{title}</p>
        <p className="mt-0.5 text-sm text-red-700">{detail}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-800 transition hover:bg-red-100"
          >
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Marks anything a model wrote rather than a source reported. */
export function GeneratedBadge({ label = 'Generated' }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
      {label}
    </span>
  );
}

export function Pill({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'red' | 'amber' | 'blue' }) {
  const tones = {
    slate: 'border-slate-300 bg-slate-100 text-slate-700',
    green: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    red: 'border-red-300 bg-red-50 text-red-800',
    amber: 'border-amber-300 bg-amber-50 text-amber-800',
    blue: 'border-blue-300 bg-blue-50 text-blue-800'
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}
