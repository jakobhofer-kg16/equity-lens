/**
 * Earnings call transcripts from the course archive.
 *
 * Commercial transcript APIs are all premium — Finnhub's included — so this
 * section runs on the S&P 500 archive published for the course. It needs no key,
 * raw.githubusercontent.com sends `Access-Control-Allow-Origin: *`, and it
 * covers 383 tickers with several quarters each.
 */

import { archiveDatesFor, archiveUrl } from '../../data/earningsArchive';
import { countWords, scoreCounts, sumCounts, type SentimentScore } from '../../lib/sentiment';
import { DataError } from '../../types';

export type SpeakerRole = 'management' | 'analyst' | 'operator' | 'other';

export interface TranscriptLine {
  speaker: string;
  title: string;
  role: SpeakerRole;
  text: string;
}

export interface QuarterSentiment {
  date: string;
  url: string;
  lines: number;
  overall: SentimentScore;
  management: SentimentScore | null;
  analyst: SentimentScore | null;
  /** The single most positive and most negative substantial passages. */
  highlight: { positive: TranscriptLine | null; negative: TranscriptLine | null };
}

export interface EarningsSentimentResult {
  symbol: string;
  quarters: QuarterSentiment[];
  /** Dates that exist in the archive but failed to load. */
  failed: string[];
}

// --- CSV ------------------------------------------------------------------

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += char;
      continue;
    }
    if (char === '"') inQuotes = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') field += char;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

const EMPLOYER_RE = /\s+at\s+(.+)$/i;
const OPERATOR_RE = /\boperator\b/i;

/**
 * Job titles are a poor signal on an earnings call: a sell-side analyst is a
 * "Managing Director at Goldman Sachs", and a "Head of Technology Research"
 * reads like management to any keyword matcher. The employer is reliable
 * instead — management all share one, and on a call that one does most of the
 * talking, so the most frequent employer is taken to be the company.
 */
function detectCompanyEmployer(rows: Array<{ title: string }>): string | null {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const match = row.title.match(EMPLOYER_RE);
    if (!match) continue;
    const firm = match[1].trim().toLowerCase();
    counts.set(firm, (counts.get(firm) ?? 0) + 1);
  }
  if (counts.size < 2) return null;

  let best: string | null = null;
  let bestCount = 0;
  for (const [firm, count] of counts) {
    if (count > bestCount) {
      best = firm;
      bestCount = count;
    }
  }
  return best;
}

export function parseTranscript(csv: string): TranscriptLine[] {
  const rows = parseCsv(csv);
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const speakerCol = header.indexOf('speaker');
  const titleCol = header.indexOf('title');
  const textCol = header.indexOf('msg');
  if (speakerCol < 0 || textCol < 0) return [];

  const clean = (value: string | undefined) => {
    const trimmed = (value ?? '').trim();
    // The archive writes a literal "NA" for unattributed lines.
    return trimmed.toUpperCase() === 'NA' ? '' : trimmed;
  };

  const raw = rows.slice(1).map((row) => ({
    speaker: clean(row[speakerCol]),
    title: titleCol >= 0 ? clean(row[titleCol]) : '',
    text: (row[textCol] ?? '').trim()
  }));

  const employer = detectCompanyEmployer(raw);

  return raw
    .filter((row) => row.text)
    .map((row) => {
      let role: SpeakerRole = 'other';
      if (!row.speaker || OPERATOR_RE.test(`${row.speaker} ${row.title}`)) role = 'operator';
      else if (employer) {
        const match = row.title.match(EMPLOYER_RE);
        role = match ? (match[1].trim().toLowerCase() === employer ? 'management' : 'analyst') : 'other';
      }
      return { ...row, role };
    });
}

// --- Scoring ---------------------------------------------------------------

/** Long enough to be a real statement rather than "Thanks, Tim". */
const HIGHLIGHT_MIN_WORDS = 45;

/**
 * A passage carried by one or two tone words scores +1.0 and means nothing, so
 * a highlight has to contain a handful before it can be the extreme.
 */
const HIGHLIGHT_MIN_TONE_WORDS = 4;

/**
 * Every call opens with the same welcome and safe-harbour language, and it is
 * full of positive words while saying nothing about the business. Left in, it
 * wins "most positive passage" on almost every transcript.
 */
const BOILERPLATE_RE =
  /welcome to the .{0,80}(earnings|conference) call|forward[- ]looking statements|safe harbou?r|non-?gaap|replay of this (call|conference|webcast)|turn the call over|question[- ]and[- ]answer session|please refer to (our|the)|risks and uncertainties|actual results.{0,30}differ materially|today's call is being recorded/i;

function scoreQuarter(date: string, url: string, lines: TranscriptLine[]): QuarterSentiment {
  const spoken = lines.filter((l) => l.role !== 'operator');
  const scoreGroup = (group: TranscriptLine[]) =>
    group.length ? scoreCounts(sumCounts(group.map((l) => countWords(l.text)))) : null;

  let mostPositive: { line: TranscriptLine; polarity: number } | null = null;
  let mostNegative: { line: TranscriptLine; polarity: number } | null = null;

  for (const line of spoken) {
    if (BOILERPLATE_RE.test(line.text)) continue;
    const counts = countWords(line.text);
    if (counts.words < HIGHLIGHT_MIN_WORDS) continue;
    if (counts.positive + counts.negative < HIGHLIGHT_MIN_TONE_WORDS) continue;
    const score = scoreCounts(counts);
    if (score.polarity === null) continue;
    if (!mostPositive || score.polarity > mostPositive.polarity) mostPositive = { line, polarity: score.polarity };
    if (!mostNegative || score.polarity < mostNegative.polarity) mostNegative = { line, polarity: score.polarity };
  }

  return {
    date,
    url,
    lines: spoken.length,
    overall: scoreCounts(sumCounts(spoken.map((l) => countWords(l.text)))),
    management: scoreGroup(spoken.filter((l) => l.role === 'management')),
    analyst: scoreGroup(spoken.filter((l) => l.role === 'analyst')),
    highlight: { positive: mostPositive?.line ?? null, negative: mostNegative?.line ?? null }
  };
}

export function hasEarningsArchive(symbol: string): boolean {
  return archiveDatesFor(symbol).length > 0;
}

export async function fetchEarningsSentiment(symbol: string): Promise<EarningsSentimentResult> {
  const dates = archiveDatesFor(symbol);
  if (!dates.length) {
    throw new DataError('unsupported-ticker', `No earnings call transcripts archived for ${symbol.toUpperCase()}.`);
  }

  const results = await Promise.allSettled(
    dates.map(async (date) => {
      const url = archiveUrl(symbol, date);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`(HTTP ${response.status}) ${url}`);
      const lines = parseTranscript(await response.text());
      if (!lines.length) throw new Error(`No readable rows in ${url}`);
      return scoreQuarter(date, url, lines);
    })
  );

  const quarters = results
    .filter((r): r is PromiseFulfilledResult<QuarterSentiment> => r.status === 'fulfilled')
    .map((r) => r.value)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const failed = dates.filter((_, i) => results[i].status === 'rejected');

  if (!quarters.length) {
    throw new DataError('network', `Could not load any transcript for ${symbol.toUpperCase()}.`);
  }

  return { symbol: symbol.toUpperCase(), quarters, failed };
}
