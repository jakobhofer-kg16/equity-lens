const NOT_AVAILABLE = 'n/a';

export function formatCurrency(value: number | null, currency = 'USD', digits = 2): string {
  if (value === null || !Number.isFinite(value)) return NOT_AVAILABLE;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

/** Compact money, e.g. $4.59T. Used wherever a full number would not fit. */
export function formatBigMoney(value: number | null, currency = 'USD'): string {
  if (value === null || !Number.isFinite(value)) return NOT_AVAILABLE;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 2
  }).format(value);
}

export function formatNumber(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return NOT_AVAILABLE;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

export function formatCompact(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return NOT_AVAILABLE;
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

/** Takes a fraction, so 0.153 renders as 15.3%. */
export function formatPercent(value: number | null, digits = 1, withSign = false): string {
  if (value === null || !Number.isFinite(value)) return NOT_AVAILABLE;
  const sign = withSign && value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(digits)}%`;
}

export function formatMultiple(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return NOT_AVAILABLE;
  return `${value.toFixed(digits)}x`;
}

export function formatDate(value: string | null): string {
  if (!value) return NOT_AVAILABLE;
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    date
  );
}

export function formatDateTime(value: string | null): string {
  if (!value) return NOT_AVAILABLE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

/** "3 days ago" — used to make the age of analyst data obvious. */
export function formatRelative(value: string | null): string {
  if (!value) return NOT_AVAILABLE;
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;

  const days = Math.round((Date.now() - date.getTime()) / 86_400_000);
  if (days < 0) return `in ${Math.abs(days)} days`;
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 45) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 24) return `${months} months ago`;
  return `${Math.round(days / 365)} years ago`;
}

export function daysBetween(value: string | null): number | null {
  if (!value) return null;
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.round((Date.now() - date.getTime()) / 86_400_000);
}
