import { DataError, type NewsItem, type NewsSentiment } from '../../types';

/**
 * Headlines from newsdata.io. Plan access to the endpoints differs per key, so
 * the market feed is tried first and the general feeds are the fallback.
 */
const ENDPOINTS = ['market', 'latest', 'news'];

/**
 * newsdata.io supplies a sentiment field only on paid plans, so headlines are
 * classified here with a keyword pass. It is crude, and the UI labels the
 * result as model-scored rather than reported.
 */
const POSITIVE = /\b(beat|beats|record|surge|surges|jump|jumps|rally|upgrade|growth|strong|wins|profit|raises)\b/i;
const NEGATIVE = /\b(miss|misses|fall|falls|drop|drops|plunge|slump|downgrade|lawsuit|probe|recall|warns|cuts|loss|weak)\b/i;

function classify(text: string): { sentiment: NewsSentiment; score: number } {
  const positives = (text.match(new RegExp(POSITIVE, 'gi')) ?? []).length;
  const negatives = (text.match(new RegExp(NEGATIVE, 'gi')) ?? []).length;
  if (positives === negatives) return { sentiment: 'neutral', score: 0 };
  const score = (positives - negatives) / Math.max(positives + negatives, 1);
  return { sentiment: score > 0 ? 'positive' : 'negative', score };
}

export async function fetchNewsDataHeadlines(symbol: string, name: string, apiKey: string): Promise<NewsItem[]> {
  let lastError = '';

  for (const endpoint of ENDPOINTS) {
    const query = encodeURIComponent(`${symbol} OR "${name}"`);
    const url = `https://newsdata.io/api/1/${endpoint}?apikey=${encodeURIComponent(apiKey)}&q=${query}&language=en&prioritydomain=top`;

    let response: Response;
    let bodyText: string;
    try {
      response = await fetch(url);
      bodyText = await response.text();
    } catch (err) {
      lastError = (err as Error).message;
      continue;
    }

    let json: Record<string, unknown>;
    try {
      json = JSON.parse(bodyText) as Record<string, unknown>;
    } catch {
      lastError = bodyText.trim().slice(0, 160);
      continue;
    }

    if (json.status === 'error') {
      const detail = (json.results as { message?: string } | undefined)?.message ?? 'newsdata.io error';
      // A bad key fails identically on every endpoint, so stop early.
      if (/api ?key|unauthor|forbidden/i.test(detail)) throw new DataError('no-api-key', detail);
      lastError = detail;
      continue;
    }

    const rows = (json.results as Array<Record<string, unknown>> | undefined) ?? [];
    if (!rows.length) {
      lastError = `No headlines returned for ${symbol}`;
      continue;
    }

    return rows.slice(0, 8).map((row, i) => {
      const headline = String(row.title ?? 'Untitled');
      const summary = String(row.description ?? row.content ?? '');
      const { sentiment, score } = classify(`${headline} ${summary}`);
      return {
        id: `${symbol}-nd-${i}`,
        headline,
        summary: summary.length > 260 ? `${summary.slice(0, 260)}...` : summary,
        url: String(row.link ?? ''),
        publication: String(row.source_id ?? row.source_name ?? 'unknown'),
        publishedAt: String(row.pubDate ?? ''),
        sentiment,
        sentimentScore: score
      };
    });
  }

  throw new DataError('provider-error', lastError || `No headlines available for ${symbol}`);
}
