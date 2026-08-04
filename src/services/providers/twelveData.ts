import { DataError, type HistoricalPrices } from '../../types';

/** Daily bars from Twelve Data. Used only to replace the price series. */
export async function fetchTwelveDataPrices(symbol: string, apiKey: string): Promise<HistoricalPrices> {
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=1260&apikey=${encodeURIComponent(apiKey)}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new DataError('network', `Could not reach Twelve Data: ${(err as Error).message}`);
  }

  const body = await response.text();
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(body) as Record<string, unknown>;
  } catch {
    throw new DataError('provider-error', body.trim().slice(0, 160) || 'Twelve Data returned an unreadable response');
  }

  if (raw.status === 'error') {
    const message = String(raw.message ?? 'Twelve Data error');
    if (/limit|credits/i.test(message)) throw new DataError('rate-limited', message, 60);
    if (/api ?key|apikey/i.test(message)) throw new DataError('no-api-key', message);
    throw new DataError('provider-error', message);
  }

  const values = (raw.values as Array<Record<string, string>> | undefined) ?? [];
  if (!values.length) throw new DataError('unsupported-ticker', `Twelve Data returned no price history for ${symbol}.`);

  return {
    symbol,
    bars: values
      .map((bar) => ({
        date: bar.datetime,
        open: Number(bar.open),
        high: Number(bar.high),
        low: Number(bar.low),
        close: Number(bar.close),
        volume: Number(bar.volume)
      }))
      .filter((bar) => Number.isFinite(bar.close))
      .sort((a, b) => (a.date < b.date ? -1 : 1))
  };
}
