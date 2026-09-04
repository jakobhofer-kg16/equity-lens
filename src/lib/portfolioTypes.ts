/** Shape of src/data/portfolio.json, written by scripts/portfolio.ts. */

export interface PortfolioTone {
  latestDate: string;
  polarity: number | null;
  priorPolarity: number | null;
  delta: number | null;
  hedging: number;
  managementPolarity: number | null;
  analystPolarity: number | null;
}

export interface PortfolioTechnical {
  close: number;
  asOf: string;
  sma50: number | null;
  sma200: number | null;
  goldenCross: boolean | null;
  rsi: number | null;
  macdHist: number | null;
}

export interface PortfolioHolding {
  symbol: string;
  name: string;
  industry: string;
  marketCap: number | null;
  composite: number;
  valuation: { pe: number | null; peerPe: number; evEbitda: number | null; peerEv: number; discountPe: number; discountEv: number };
  quality: { operatingMargin: number | null; roe: number | null; debtToEquity: number | null; revenueGrowth: number | null; dividendYield: number | null };
  tone: PortfolioTone;
  technical: PortfolioTechnical;
  annualisedReturn: number;
  annualisedVol: number;
  reasons: string[];
}

export interface PortfolioStats {
  expectedReturn: number;
  volatility: number;
  sharpe: number;
}

export interface PortfolioFile {
  generatedAt: string;
  pricesAsOf: string;
  lookbackTradingDays: number;
  riskFreeRate: number;
  maxWeight: number;
  minWeight: number;
  maxPerIndustry: number;
  thesis: string;
  universe: number;
  withFundamentals: number;
  passedScreen: number;
  candidatesPriced: number;
  passedTechnical: number;
  rejectedByScreen?: Record<string, number>;
  rejectedByTechnical?: string[];
  universeMedians?: { pe: number | null; evEbitda: number | null };
  weights: { maxSharpe: Record<string, number>; minVariance: Record<string, number>; equal: Record<string, number> };
  stats: { maxSharpe: PortfolioStats; minVariance: PortfolioStats; equal: PortfolioStats; benchmark: PortfolioStats };
  holdings: PortfolioHolding[];
  nextInLine: string[];
}
