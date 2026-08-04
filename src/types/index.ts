/**
 * Typed data models for the whole app.
 *
 * Every provider adapter maps its own wire format into these shapes, so no
 * component ever sees a provider-specific field name. Anything a provider may
 * not supply is `null` rather than absent, so the UI can distinguish
 * "not meaningful for this company" from "we never asked".
 */

export type DataFreshness = 'live' | 'delayed' | 'end-of-day';

/** Where a value came from. Rendered next to the data it describes. */
export interface SourceInfo {
  provider: string;
  fetchedAt: string;
  freshness: DataFreshness;
  /** True when this came from bundled sample data rather than a live call. */
  isMock: boolean;
}

export interface CompanyProfile {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  country: string | null;
  sector: string | null;
  industry: string | null;
  description: string;
  website: string | null;
  logoUrl: string | null;
  sharesOutstanding: number | null;
  marketCap: number | null;
  beta: number | null;
  fiscalYearEnd: string | null;
}

export interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  open: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  week52High: number | null;
  week52Low: number | null;
  /** Trading day the price refers to, not the moment we fetched it. */
  asOf: string;
}

export interface PriceBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HistoricalPrices {
  symbol: string;
  bars: PriceBar[];
}

/** One fiscal period of reported financials. */
export interface FinancialPeriod {
  fiscalDate: string;
  fiscalYear: number;
  period: 'FY' | 'Q1' | 'Q2' | 'Q3' | 'Q4';
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  eps: number | null;
  operatingCashFlow: number | null;
  capitalExpenditure: number | null;
  freeCashFlow: number | null;
  totalAssets: number | null;
  totalDebt: number | null;
  totalEquity: number | null;
  interestExpense: number | null;
}

export interface FinancialStatements {
  symbol: string;
  annual: FinancialPeriod[];
  quarterly: FinancialPeriod[];
}

/** Derived ratios. Null means the metric is not meaningful, e.g. P/E on a loss. */
export interface FinancialRatios {
  symbol: string;
  trailingPE: number | null;
  forwardPE: number | null;
  pegRatio: number | null;
  priceToSales: number | null;
  priceToBook: number | null;
  evToEbitda: number | null;
  evToRevenue: number | null;
  freeCashFlowYield: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  profitMargin: number | null;
  returnOnEquity: number | null;
  returnOnAssets: number | null;
  returnOnInvestedCapital: number | null;
  debtToEquity: number | null;
  interestCoverage: number | null;
  currentRatio: number | null;
  revenueGrowthYoY: number | null;
  earningsGrowthYoY: number | null;
  revenueCagr3y: number | null;
}

export interface PeerCompany {
  symbol: string;
  name: string;
  marketCap: number | null;
  revenueGrowthYoY: number | null;
  operatingMargin: number | null;
  returnOnEquity: number | null;
  trailingPE: number | null;
  evToEbitda: number | null;
  debtToEquity: number | null;
  oneYearReturn: number | null;
}

export interface PeerSet {
  symbol: string;
  sector: string | null;
  /** Sector medians used as the valuation reference in the score. */
  sectorMedian: Pick<PeerCompany, 'trailingPE' | 'evToEbitda' | 'operatingMargin' | 'returnOnEquity'>;
  peers: PeerCompany[];
}

/** Normalized analyst rating buckets. */
export type RatingBucket = 'strongBuy' | 'buy' | 'hold' | 'sell' | 'strongSell';

export interface RatingDistribution {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

export interface RecommendationSnapshot {
  /** Month the snapshot describes, e.g. "2026-06". */
  period: string;
  distribution: RatingDistribution;
}

export interface AnalystAction {
  firm: string;
  action: 'upgrade' | 'downgrade' | 'initiate' | 'maintain';
  /** Provider's own wording, preserved verbatim for the detail view. */
  rawRating: string;
  rating: RatingBucket;
  priceTarget: number | null;
  date: string;
}

export interface AnalystConsensus {
  symbol: string;
  distribution: RatingDistribution;
  analystCount: number;
  /** Weighted mean of the distribution, 1 = strong buy .. 5 = strong sell. */
  consensusScore: number;
  consensusLabel: string;
  /** Most recent month covered by the data. */
  asOf: string;
  trend: RecommendationSnapshot[];
  recentActions: AnalystAction[];
}

export interface PriceTargets {
  symbol: string;
  average: number | null;
  median: number | null;
  high: number | null;
  low: number | null;
  analystCount: number;
  asOf: string;
}

export interface EstimateRow {
  fiscalYear: number;
  revenueEstimate: number | null;
  epsEstimate: number | null;
  revenueActual: number | null;
  epsActual: number | null;
  analystCount: number | null;
}

export interface AnalystEstimates {
  symbol: string;
  rows: EstimateRow[];
}

export type NewsSentiment = 'positive' | 'neutral' | 'negative';

export interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  url: string;
  publication: string;
  publishedAt: string;
  /** Provider-supplied sentiment. Labelled in the UI as a model output. */
  sentiment: NewsSentiment;
  sentimentScore: number | null;
}

export type CatalystKind = 'earnings' | 'product' | 'regulatory' | 'litigation' | 'other';

export interface Catalyst {
  id: string;
  kind: CatalystKind;
  title: string;
  detail: string;
  /** Null when the timing is known only qualitatively. */
  expectedDate: string | null;
  source: string;
}

export interface EarningsEvent {
  fiscalPeriod: string;
  date: string;
  epsEstimate: number | null;
  epsActual: number | null;
  isFuture: boolean;
}

export interface EarningsCalendar {
  symbol: string;
  events: EarningsEvent[];
  nextEarningsDate: string | null;
}

/** Everything one ticker view needs, assembled by the service layer. */
export interface CompanyDossier {
  source: SourceInfo;
  profile: CompanyProfile;
  quote: Quote;
  prices: HistoricalPrices;
  benchmark: HistoricalPrices;
  statements: FinancialStatements;
  ratios: FinancialRatios;
  peers: PeerSet;
  consensus: AnalystConsensus | null;
  priceTargets: PriceTargets | null;
  estimates: AnalystEstimates | null;
  news: NewsItem[];
  catalysts: Catalyst[];
  earnings: EarningsCalendar;
}

/** Error shape the UI branches on, so each failure gets its own message. */
export type DataErrorKind =
  | 'unsupported-ticker'
  | 'rate-limited'
  | 'network'
  | 'no-api-key'
  | 'provider-error';

export class DataError extends Error {
  kind: DataErrorKind;
  retryAfterSeconds: number | null;

  constructor(kind: DataErrorKind, message: string, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = 'DataError';
    this.kind = kind;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface StockDataProvider {
  readonly id: string;
  readonly label: string;
  readonly freshness: DataFreshness;
  readonly isMock: boolean;
  supports(symbol: string): boolean;
  getDossier(symbol: string): Promise<CompanyDossier>;
}
