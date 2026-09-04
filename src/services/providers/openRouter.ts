/**
 * OpenRouter — writes the investment thesis from the loaded data.
 *
 * The model sees a compact summary of everything on the page: profile, quote,
 * ratios against the peer median, the score with its strengths and risks, the
 * analyst distribution, headlines, catalysts and the earnings-call tone. It is
 * asked for the seven thesis fields as JSON. The output is labelled as
 * AI-generated in the UI and stays fully editable.
 */

import { DataError, type CompanyDossier } from '../../types';
import type { ModelScore } from '../../lib/scoring';
import type { ThesisDraft, Horizon, RiskTolerance } from '../../lib/thesis';
import type { EarningsSentimentResult } from './earningsCalls';

export const THESIS_MODEL = 'google/gemini-2.5-flash';

function pct(v: number | null): string {
  return v === null ? 'n/a' : `${(v * 100).toFixed(1)}%`;
}
function mult(v: number | null): string {
  return v === null ? 'n/a' : `${v.toFixed(1)}x`;
}

export function buildThesisPrompt(
  dossier: CompanyDossier,
  score: ModelScore,
  sentiment: EarningsSentimentResult | null,
  horizon: Horizon,
  risk: RiskTolerance
): string {
  const { profile, quote, ratios, peers, consensus, priceTargets, news, catalysts } = dossier;
  const latestCall = sentiment?.quarters[sentiment.quarters.length - 1] ?? null;
  const priorCall = sentiment?.quarters[sentiment.quarters.length - 2] ?? null;

  return `You are an equity analyst drafting an investment thesis for an MBA investment committee. Use ONLY the data below. Do not add facts you cannot see here. Where the data is missing, say so rather than guess.

# COMPANY
${profile.name} (${profile.symbol}), ${profile.sector ?? 'sector n/a'}, ${profile.exchange}. Price $${quote.price.toFixed(2)}, day change ${quote.changePercent.toFixed(2)}%. 52-week range $${quote.week52Low ?? 'n/a'}–$${quote.week52High ?? 'n/a'}. Market cap $${profile.marketCap ? (profile.marketCap / 1e9).toFixed(0) + 'B' : 'n/a'}.

# FUNDAMENTALS (trailing)
Revenue growth ${pct(ratios.revenueGrowthYoY)}, 3y revenue CAGR ${pct(ratios.revenueCagr3y)}, EPS growth ${pct(ratios.earningsGrowthYoY)}.
Gross margin ${pct(ratios.grossMargin)}, operating margin ${pct(ratios.operatingMargin)}, net margin ${pct(ratios.profitMargin)}, ROE ${pct(ratios.returnOnEquity)}, ROIC ${pct(ratios.returnOnInvestedCapital)}.
Debt/equity ${ratios.debtToEquity?.toFixed(2) ?? 'n/a'}, current ratio ${ratios.currentRatio?.toFixed(2) ?? 'n/a'}.

# VALUATION vs ${peers.peers.length} PEERS (${peers.peers.map((p) => p.symbol).join(', ')})
P/E ${mult(ratios.trailingPE)} vs peer median ${mult(peers.peerMedian.trailingPE)}. EV/EBITDA ${mult(ratios.evToEbitda)} vs ${mult(peers.peerMedian.evToEbitda)}. P/S ${mult(ratios.priceToSales)}. FCF yield ${pct(ratios.freeCashFlowYield)}.

# OUR MODEL (no analyst input)
Score ${score.total}/100 → ${score.classification}, confidence ${score.confidence}.
Categories: ${score.categories.map((c) => `${c.label} ${c.score ?? 'n/a'}`).join('; ')}.
Strengths: ${score.strengths.map((m) => `${m.label} ${m.formatted}`).join('; ')}.
Risks: ${score.risks.map((m) => `${m.label} ${m.formatted}`).join('; ')}.

# ANALYSTS (third party, separate from our model)
${consensus ? `${consensus.consensusLabel} from ${consensus.analystCount} analysts (strong buy ${consensus.distribution.strongBuy}, buy ${consensus.distribution.buy}, hold ${consensus.distribution.hold}, sell ${consensus.distribution.sell}, strong sell ${consensus.distribution.strongSell}), as of ${consensus.asOf}.` : 'No analyst coverage returned.'}
${priceTargets?.median ? `Consensus price target $${priceTargets.median.toFixed(2)} (${pct(priceTargets.median / quote.price - 1)} vs price).` : 'No price target available.'}

# EARNINGS CALL TONE (finance lexicon, polarity -1..+1)
${latestCall ? `Latest call ${latestCall.date}: overall ${latestCall.overall.polarity?.toFixed(2) ?? 'n/a'}, management ${latestCall.management?.polarity?.toFixed(2) ?? 'n/a'}, analysts ${latestCall.analyst?.polarity?.toFixed(2) ?? 'n/a'}, hedging ${pct(latestCall.overall.uncertaintyRate)}.` : 'No transcript available.'}
${priorCall ? `Prior call ${priorCall.date}: overall ${priorCall.overall.polarity?.toFixed(2) ?? 'n/a'}.` : ''}
${latestCall?.highlight.negative ? `Most negative passage (${latestCall.highlight.negative.speaker}): "${latestCall.highlight.negative.text.slice(0, 300)}"` : ''}

# RECENT HEADLINES
${news.slice(0, 6).map((n) => `- [${n.publication}] ${n.headline}`).join('\n') || '- none'}

# CATALYSTS
${catalysts.map((c) => `- ${c.title}: ${c.detail} (${c.expectedDate ?? 'no date'})`).join('\n') || '- none known'}

# TASK
Horizon: ${horizon}. Risk tolerance: ${risk}.
Return ONLY a JSON object with these string fields, each 2–5 sentences, plain prose, numbers from the data above:
{"bull": ..., "base": ..., "bear": ..., "assumptions": ..., "catalysts": ..., "risks": ..., "invalidation": ...}
"assumptions" and "risks" may use newline-separated bullet lines. Be specific and quantitative. Never promise returns.`;
}

function parseJsonLoose(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const match = candidate.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export async function writeThesisWithAi(
  apiKey: string,
  dossier: CompanyDossier,
  score: ModelScore,
  sentiment: EarningsSentimentResult | null,
  horizon: Horizon,
  risk: RiskTolerance
): Promise<ThesisDraft> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: THESIS_MODEL,
      messages: [{ role: 'user', content: buildThesisPrompt(dossier, score, sentiment, horizon, risk) }],
      temperature: 0.3,
      max_tokens: 2000,
      reasoning: { enabled: false }
    })
  });

  const bodyText = await response.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(bodyText);
  } catch {
    throw new DataError('provider-error', `(HTTP ${response.status}) ${bodyText.slice(0, 160)}`);
  }
  const error = json.error as { code?: number; message?: string } | undefined;
  if (error) {
    const code = error.code ?? response.status;
    const hint = code === 401 ? 'Key is invalid. ' : code === 402 ? 'Out of credits. ' : code === 429 ? 'Rate limited. ' : '';
    throw new DataError(code === 401 ? 'no-api-key' : 'provider-error', `(HTTP ${code}) ${hint}${error.message ?? ''}`);
  }

  const content = (json.choices as Array<{ message?: { content?: string } }> | undefined)?.[0]?.message?.content;
  if (!content) throw new DataError('provider-error', 'OpenRouter returned no completion.');

  const parsed = parseJsonLoose(content);
  if (!parsed) throw new DataError('provider-error', 'The model did not return the expected JSON.');

  const field = (key: string) => String(parsed[key] ?? '').trim();
  return {
    bull: field('bull'),
    base: field('base'),
    bear: field('bear'),
    assumptions: field('assumptions'),
    catalysts: field('catalysts'),
    risks: field('risks'),
    invalidation: field('invalidation')
  };
}
