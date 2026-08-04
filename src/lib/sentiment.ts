/**
 * Sentiment scoring for earnings call transcripts.
 *
 * Uses a finance-specific word list rather than a general-purpose one. This is
 * the Loughran-McDonald observation: in ordinary sentiment lexicons "liability",
 * "cost", "capital" and "depreciation" all read as negative, and they are simply
 * accounting vocabulary. Scoring an earnings call with a general lexicon mostly
 * measures how much accounting was discussed.
 *
 * The lists below are a compact subset of that approach, not the full published
 * dictionary. Two extra dimensions are tracked because they matter more on a
 * call than raw polarity does:
 *
 * - **Uncertainty** — hedging language. A confident quarter and a hedged one can
 *   have identical positive/negative counts.
 * - **Litigious** — legal and regulatory vocabulary, which tends to spike before
 *   trouble becomes a headline.
 *
 * This is a word-count model. It cannot read sarcasm, negation or context, and
 * the UI says so.
 */

const POSITIVE = [
  'able','achieve','achieved','achievement','advance','advantage','attractive','beat','beneficial','benefit',
  'best','better','boost','breakthrough','confident','confidence','strong','stronger','strongest','strength',
  'delighted','deliver','delivered','despite','durable','effective','efficiency','efficient','encouraged',
  'encouraging','enhance','enhanced','excellent','exceptional','exceed','exceeded','exceeding','excited',
  'expand','expanded','expansion','favorable','gain','gained','gains','good','great','greater','growth','grew',
  'healthy','improve','improved','improvement','improving','incremental','innovative','leadership','leading',
  'momentum','opportunity','opportunities','outperform','outstanding','pleased','positive','profitable',
  'progress','record','records','resilient','robust','solid','success','successful','successfully','surpassed',
  'tremendous','upside','win','winning','wins'
];

const NEGATIVE = [
  'adverse','adversely','against','challenge','challenged','challenges','challenging','concern','concerned',
  'concerns','decline','declined','declines','declining','decrease','decreased','deficit','delay','delayed',
  'delays','deteriorate','deteriorating','difficult','difficulty','disappointed','disappointing','disappointment',
  'disruption','down','downturn','drag','fail','failed','failure','fell','headwind','headwinds','hurt','impair',
  'impairment','lag','lagged','loss','losses','lost','miss','missed','negative','pressure','pressured',
  'pressures','problem','problems','recession','reduce','reduced','reduction','restructuring','shortfall','slow',
  'slowdown','slower','slowing','soft','softer','softness','struggle','struggled','unfavorable','weak','weaker',
  'weakness','worse','worsening','writedown','write-down'
];

const UNCERTAINTY = [
  'almost','ambiguous','anticipate','anticipated','appear','appears','approximate','approximately','assume',
  'assumed','assumption','assumptions','believe','cautious','cautiously','conceivable','contingent','could',
  'depend','depending','depends','doubt','estimate','estimated','exposure','fluctuate','fluctuation','indefinite',
  'likely','may','maybe','might','possible','possibly','potential','potentially','predict','preliminary',
  'probable','risk','risks','risky','seems','somewhat','sometimes','tentative','uncertain','uncertainty',
  'unclear','unknown','unpredictable','unusual','vary','variable','volatile','volatility'
];

const LITIGIOUS = [
  'allegation','allegations','alleged','antitrust','appeal','arbitration','attorney','claim','claims','compliance',
  'consent','contractual','court','defendant','disclosure','dispute','enforcement','forfeit','fraud','indemnify',
  'infringement','injunction','investigation','judicial','judgment','jury','lawsuit','legal','liability',
  'litigation','plaintiff','probe','prosecution','regulator','regulators','regulatory','settlement','subpoena',
  'testimony','violation','violations'
];

function toSet(words: string[]): Set<string> {
  return new Set(words);
}

const LEXICON = {
  positive: toSet(POSITIVE),
  negative: toSet(NEGATIVE),
  uncertainty: toSet(UNCERTAINTY),
  litigious: toSet(LITIGIOUS)
};

export interface SentimentCounts {
  words: number;
  positive: number;
  negative: number;
  uncertainty: number;
  litigious: number;
}

export interface SentimentScore extends SentimentCounts {
  /** (positive - negative) / (positive + negative), -1 to 1. */
  polarity: number | null;
  /** Share of all words that hedge. */
  uncertaintyRate: number;
  /** Share of all words that are legal or regulatory vocabulary. */
  litigiousRate: number;
  label: 'positive' | 'neutral' | 'negative';
}

const WORD_RE = /[a-z][a-z'-]*/g;

export function countWords(text: string): SentimentCounts {
  const counts: SentimentCounts = { words: 0, positive: 0, negative: 0, uncertainty: 0, litigious: 0 };
  const matches = text.toLowerCase().match(WORD_RE);
  if (!matches) return counts;

  for (const word of matches) {
    counts.words++;
    if (LEXICON.positive.has(word)) counts.positive++;
    else if (LEXICON.negative.has(word)) counts.negative++;
    if (LEXICON.uncertainty.has(word)) counts.uncertainty++;
    if (LEXICON.litigious.has(word)) counts.litigious++;
  }
  return counts;
}

export function sumCounts(list: SentimentCounts[]): SentimentCounts {
  return list.reduce(
    (acc, c) => ({
      words: acc.words + c.words,
      positive: acc.positive + c.positive,
      negative: acc.negative + c.negative,
      uncertainty: acc.uncertainty + c.uncertainty,
      litigious: acc.litigious + c.litigious
    }),
    { words: 0, positive: 0, negative: 0, uncertainty: 0, litigious: 0 }
  );
}

export function scoreCounts(counts: SentimentCounts): SentimentScore {
  const tone = counts.positive + counts.negative;
  const polarity = tone > 0 ? (counts.positive - counts.negative) / tone : null;

  return {
    ...counts,
    polarity,
    uncertaintyRate: counts.words ? counts.uncertainty / counts.words : 0,
    litigiousRate: counts.words ? counts.litigious / counts.words : 0,
    // A call that is merely balanced still reads as constructive in practice,
    // so the neutral band sits slightly below zero rather than around it.
    label: polarity === null ? 'neutral' : polarity > 0.2 ? 'positive' : polarity < -0.05 ? 'negative' : 'neutral'
  };
}

export function scoreText(text: string): SentimentScore {
  return scoreCounts(countWords(text));
}
