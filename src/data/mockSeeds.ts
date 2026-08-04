/**
 * Curated seed facts for the bundled sample data.
 *
 * The figures are order-of-magnitude realistic for each company but are NOT
 * live filings — they exist so the app is fully explorable with no API key.
 * Anything rendered from this file is labelled as sample data in the UI.
 */

export interface PeerSeed {
  symbol: string;
  name: string;
  marketCap: number;
  revenueGrowthYoY: number;
  operatingMargin: number;
  returnOnEquity: number;
  trailingPE: number;
  evToEbitda: number;
  debtToEquity: number;
  oneYearReturn: number;
}

export interface CompanySeed {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  industry: string;
  country: string;
  website: string;
  description: string;
  fiscalYearEnd: string;
  /** Latest close used as the anchor for the generated price series. */
  price: number;
  changePercent: number;
  sharesOutstanding: number;
  beta: number;
  week52High: number;
  week52Low: number;
  /** Annual revenue, oldest first, in USD. */
  revenueHistory: number[];
  grossMargin: number;
  operatingMargin: number;
  profitMargin: number;
  returnOnEquity: number;
  returnOnAssets: number;
  returnOnInvestedCapital: number;
  trailingPE: number;
  forwardPE: number;
  pegRatio: number | null;
  priceToSales: number;
  priceToBook: number;
  evToEbitda: number;
  evToRevenue: number;
  freeCashFlowYield: number;
  debtToEquity: number;
  interestCoverage: number | null;
  currentRatio: number;
  epsHistory: number[];
  peers: PeerSeed[];
  sectorMedian: {
    trailingPE: number;
    evToEbitda: number;
    operatingMargin: number;
    returnOnEquity: number;
  };
  nextEarningsDate: string;
  analyst: {
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
    targetAverage: number;
    targetMedian: number;
    targetHigh: number;
    targetLow: number;
  };
  estimates: Array<{
    fiscalYear: number;
    revenueEstimate: number | null;
    epsEstimate: number | null;
    revenueActual: number | null;
    epsActual: number | null;
    analystCount: number;
  }>;
  actions: Array<{
    firm: string;
    action: 'upgrade' | 'downgrade' | 'initiate' | 'maintain';
    rawRating: string;
    priceTarget: number;
    date: string;
  }>;
  news: Array<{
    headline: string;
    summary: string;
    publication: string;
    publishedAt: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    sentimentScore: number;
  }>;
  catalysts: Array<{
    kind: 'earnings' | 'product' | 'regulatory' | 'litigation' | 'other';
    title: string;
    detail: string;
    expectedDate: string | null;
  }>;
}

export const MOCK_SEEDS: Record<string, CompanySeed> = {
  AAPL: {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    exchange: 'NASDAQ',
    sector: 'Technology',
    industry: 'Consumer Electronics',
    country: 'United States',
    website: 'https://www.apple.com',
    description:
      'Apple designs, manufactures and markets smartphones, personal computers, tablets, wearables and accessories, and sells a growing portfolio of services including the App Store, iCloud, advertising, payments and subscription content. Hardware still drives the majority of revenue, while Services carries a materially higher gross margin and has become the main engine of margin expansion.',
    fiscalYearEnd: 'September',
    price: 309.05,
    changePercent: 1.86,
    sharesOutstanding: 14_840_000_000,
    beta: 1.19,
    week52High: 344.57,
    week52Low: 214.4,
    revenueHistory: [274_515_000_000, 365_817_000_000, 394_328_000_000, 383_285_000_000, 416_160_000_000],
    grossMargin: 0.462,
    operatingMargin: 0.317,
    profitMargin: 0.267,
    returnOnEquity: 1.478,
    returnOnAssets: 0.286,
    returnOnInvestedCapital: 0.582,
    trailingPE: 34.8,
    forwardPE: 30.2,
    pegRatio: 3.1,
    priceToSales: 11.0,
    priceToBook: 51.2,
    evToEbitda: 25.6,
    evToRevenue: 10.9,
    freeCashFlowYield: 0.029,
    debtToEquity: 1.54,
    interestCoverage: 38.4,
    currentRatio: 0.94,
    epsHistory: [3.28, 5.61, 6.11, 6.13, 7.42],
    peers: [
      {
        symbol: 'MSFT',
        name: 'Microsoft Corp.',
        marketCap: 3_620_000_000_000,
        revenueGrowthYoY: 0.152,
        operatingMargin: 0.448,
        returnOnEquity: 0.352,
        trailingPE: 35.4,
        evToEbitda: 23.1,
        debtToEquity: 0.35,
        oneYearReturn: 0.181
      },
      {
        symbol: 'GOOGL',
        name: 'Alphabet Inc.',
        marketCap: 2_410_000_000_000,
        revenueGrowthYoY: 0.135,
        operatingMargin: 0.324,
        returnOnEquity: 0.305,
        trailingPE: 24.6,
        evToEbitda: 17.4,
        debtToEquity: 0.09,
        oneYearReturn: 0.242
      },
      {
        symbol: 'SONY',
        name: 'Sony Group Corp.',
        marketCap: 148_000_000_000,
        revenueGrowthYoY: 0.041,
        operatingMargin: 0.104,
        returnOnEquity: 0.142,
        trailingPE: 17.2,
        evToEbitda: 9.8,
        debtToEquity: 0.42,
        oneYearReturn: 0.096
      }
    ],
    sectorMedian: { trailingPE: 26.4, evToEbitda: 17.8, operatingMargin: 0.243, returnOnEquity: 0.264 },
    nextEarningsDate: '2026-10-29',
    analyst: {
      strongBuy: 12,
      buy: 17,
      hold: 11,
      sell: 2,
      strongSell: 1,
      targetAverage: 331.4,
      targetMedian: 335.0,
      targetHigh: 395.0,
      targetLow: 220.0
    },
    estimates: [
      { fiscalYear: 2024, revenueEstimate: 385_100_000_000, epsEstimate: 6.6, revenueActual: 391_035_000_000, epsActual: 6.75, analystCount: 38 },
      { fiscalYear: 2025, revenueEstimate: 408_400_000_000, epsEstimate: 7.24, revenueActual: 416_160_000_000, epsActual: 7.42, analystCount: 40 },
      { fiscalYear: 2026, revenueEstimate: 441_800_000_000, epsEstimate: 8.16, revenueActual: null, epsActual: null, analystCount: 39 },
      { fiscalYear: 2027, revenueEstimate: 471_500_000_000, epsEstimate: 9.02, revenueActual: null, epsActual: null, analystCount: 31 }
    ],
    actions: [
      { firm: 'Morgan Stanley', action: 'maintain', rawRating: 'Overweight', priceTarget: 340, date: '2026-08-01' },
      { firm: 'Goldman Sachs', action: 'upgrade', rawRating: 'Buy', priceTarget: 352, date: '2026-07-28' },
      { firm: 'Evercore ISI', action: 'maintain', rawRating: 'Outperform', priceTarget: 345, date: '2026-07-22' },
      { firm: 'Barclays', action: 'downgrade', rawRating: 'Underweight', priceTarget: 220, date: '2026-06-30' },
      { firm: 'Melius Research', action: 'initiate', rawRating: 'Hold', priceTarget: 300, date: '2026-06-11' }
    ],
    news: [
      {
        headline: 'Apple posts record Services revenue as iPhone demand holds up',
        summary: 'Fiscal Q3 revenue of $109.4bn beat consensus, with Services reaching an all-time high and gross margin ahead of guidance.',
        publication: 'Reuters',
        publishedAt: '2026-08-03T18:19:15Z',
        sentiment: 'positive',
        sentimentScore: 0.42
      },
      {
        headline: 'Greater China sales decline again despite the earnings beat',
        summary: 'Revenue in Greater China fell year over year for a third consecutive quarter, which management attributed to competitive pressure and channel timing.',
        publication: 'Bloomberg',
        publishedAt: '2026-08-03T21:22:17Z',
        sentiment: 'negative',
        sentimentScore: -0.31
      },
      {
        headline: 'Apple is quietly building a new manufacturing edge',
        summary: 'The company has developed internal software for plasma-based manufacturing process control, according to people familiar with the work.',
        publication: 'Yahoo Finance',
        publishedAt: '2026-08-03T16:46:11Z',
        sentiment: 'positive',
        sentimentScore: 0.28
      },
      {
        headline: 'Regulators press ahead with App Store remedies in the EU',
        summary: 'The Commission signalled that further changes to link-out rules may be required, keeping the compliance timeline open into next year.',
        publication: 'Financial Times',
        publishedAt: '2026-08-02T09:05:00Z',
        sentiment: 'negative',
        sentimentScore: -0.22
      },
      {
        headline: 'Analysts split on the pace of the AI feature rollout',
        summary: 'Some see monetisation arriving only with the next hardware cycle, while others argue the installed base alone justifies the current multiple.',
        publication: 'Seeking Alpha',
        publishedAt: '2026-08-01T17:02:18Z',
        sentiment: 'neutral',
        sentimentScore: 0.02
      }
    ],
    catalysts: [
      { kind: 'earnings', title: 'Fiscal Q4 results', detail: 'First full quarter including the new hardware cycle and updated Services disclosure.', expectedDate: '2026-10-29' },
      { kind: 'product', title: 'Autumn hardware event', detail: 'Refresh expected across the flagship line, with the AI feature set as the swing factor for the upgrade rate.', expectedDate: '2026-09-15' },
      { kind: 'regulatory', title: 'EU App Store remedies', detail: 'Further link-out and fee changes could reduce Services take rate in Europe.', expectedDate: null },
      { kind: 'litigation', title: 'US antitrust proceedings', detail: 'Ongoing case touching default search payments and distribution agreements.', expectedDate: null }
    ]
  },

  MSFT: {
    symbol: 'MSFT',
    name: 'Microsoft Corp.',
    exchange: 'NASDAQ',
    sector: 'Technology',
    industry: 'Software — Infrastructure',
    country: 'United States',
    website: 'https://www.microsoft.com',
    description:
      'Microsoft develops and licenses software, cloud infrastructure and productivity services. Intelligent Cloud, led by Azure, is the largest growth driver, while Productivity and Business Processes provides a durable subscription base. Capital intensity has risen sharply as the company builds out AI datacentre capacity.',
    fiscalYearEnd: 'June',
    price: 487.2,
    changePercent: -0.64,
    sharesOutstanding: 7_430_000_000,
    beta: 0.92,
    week52High: 528.6,
    week52Low: 366.5,
    revenueHistory: [168_088_000_000, 198_270_000_000, 211_915_000_000, 245_122_000_000, 282_400_000_000],
    grossMargin: 0.694,
    operatingMargin: 0.448,
    profitMargin: 0.361,
    returnOnEquity: 0.352,
    returnOnAssets: 0.184,
    returnOnInvestedCapital: 0.276,
    trailingPE: 35.4,
    forwardPE: 29.8,
    pegRatio: 2.2,
    priceToSales: 12.8,
    priceToBook: 11.4,
    evToEbitda: 23.1,
    evToRevenue: 12.7,
    freeCashFlowYield: 0.021,
    debtToEquity: 0.35,
    interestCoverage: 42.1,
    currentRatio: 1.28,
    epsHistory: [8.05, 9.65, 9.68, 11.8, 13.64],
    peers: [
      {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        marketCap: 4_586_000_000_000,
        revenueGrowthYoY: 0.086,
        operatingMargin: 0.317,
        returnOnEquity: 1.478,
        trailingPE: 34.8,
        evToEbitda: 25.6,
        debtToEquity: 1.54,
        oneYearReturn: 0.312
      },
      {
        symbol: 'GOOGL',
        name: 'Alphabet Inc.',
        marketCap: 2_410_000_000_000,
        revenueGrowthYoY: 0.135,
        operatingMargin: 0.324,
        returnOnEquity: 0.305,
        trailingPE: 24.6,
        evToEbitda: 17.4,
        debtToEquity: 0.09,
        oneYearReturn: 0.242
      },
      {
        symbol: 'ORCL',
        name: 'Oracle Corp.',
        marketCap: 412_000_000_000,
        revenueGrowthYoY: 0.089,
        operatingMargin: 0.288,
        returnOnEquity: 1.12,
        trailingPE: 31.2,
        evToEbitda: 18.6,
        debtToEquity: 6.8,
        oneYearReturn: 0.134
      }
    ],
    sectorMedian: { trailingPE: 26.4, evToEbitda: 17.8, operatingMargin: 0.243, returnOnEquity: 0.264 },
    nextEarningsDate: '2026-10-22',
    analyst: {
      strongBuy: 19,
      buy: 21,
      hold: 5,
      sell: 1,
      strongSell: 0,
      targetAverage: 552.3,
      targetMedian: 555.0,
      targetHigh: 640.0,
      targetLow: 420.0
    },
    estimates: [
      { fiscalYear: 2024, revenueEstimate: 243_800_000_000, epsEstimate: 11.62, revenueActual: 245_122_000_000, epsActual: 11.8, analystCount: 42 },
      { fiscalYear: 2025, revenueEstimate: 278_100_000_000, epsEstimate: 13.31, revenueActual: 282_400_000_000, epsActual: 13.64, analystCount: 44 },
      { fiscalYear: 2026, revenueEstimate: 322_600_000_000, epsEstimate: 15.42, revenueActual: null, epsActual: null, analystCount: 43 },
      { fiscalYear: 2027, revenueEstimate: 368_900_000_000, epsEstimate: 17.9, revenueActual: null, epsActual: null, analystCount: 34 }
    ],
    actions: [
      { firm: 'UBS', action: 'maintain', rawRating: 'Buy', priceTarget: 560, date: '2026-07-31' },
      { firm: 'Wells Fargo', action: 'upgrade', rawRating: 'Overweight', priceTarget: 585, date: '2026-07-24' },
      { firm: 'TD Cowen', action: 'maintain', rawRating: 'Buy', priceTarget: 570, date: '2026-07-18' },
      { firm: 'DA Davidson', action: 'downgrade', rawRating: 'Neutral', priceTarget: 470, date: '2026-07-02' }
    ],
    news: [
      {
        headline: 'Azure growth reaccelerates as AI capacity comes online',
        summary: 'Management pointed to capacity additions rather than demand as the constraint through the first half of the year.',
        publication: 'CNBC',
        publishedAt: '2026-07-30T20:11:00Z',
        sentiment: 'positive',
        sentimentScore: 0.51
      },
      {
        headline: 'Capital expenditure guidance lifted again',
        summary: 'Datacentre spending is now expected above prior guidance, which pressures near-term free cash flow conversion.',
        publication: 'Bloomberg',
        publishedAt: '2026-07-30T21:40:00Z',
        sentiment: 'negative',
        sentimentScore: -0.27
      },
      {
        headline: 'Copilot seat growth outpaces internal targets',
        summary: 'Enterprise attach rates rose across the largest commercial agreements, though disclosure remains limited.',
        publication: 'Reuters',
        publishedAt: '2026-07-25T13:02:00Z',
        sentiment: 'positive',
        sentimentScore: 0.34
      }
    ],
    catalysts: [
      { kind: 'earnings', title: 'Fiscal Q1 results', detail: 'Azure growth rate and the updated capex path are the two numbers that matter.', expectedDate: '2026-10-22' },
      { kind: 'product', title: 'Enterprise AI agent platform GA', detail: 'General availability would move Copilot revenue from seats towards consumption.', expectedDate: '2026-11-10' },
      { kind: 'regulatory', title: 'Cloud licensing review', detail: 'European scrutiny of bundling terms continues without a fixed decision date.', expectedDate: null }
    ]
  },

  TSLA: {
    symbol: 'TSLA',
    name: 'Tesla, Inc.',
    exchange: 'NASDAQ',
    sector: 'Consumer Cyclical',
    industry: 'Automobiles',
    country: 'United States',
    website: 'https://www.tesla.com',
    description:
      'Tesla designs, manufactures and sells electric vehicles and energy generation and storage systems. Automotive volume drives revenue, while the Energy segment has become the fastest-growing and highest-margin part of the business. The equity multiple embeds substantial value for autonomy and robotics that is not yet reflected in reported earnings.',
    fiscalYearEnd: 'December',
    price: 341.8,
    changePercent: 2.94,
    sharesOutstanding: 3_520_000_000,
    beta: 2.31,
    week52High: 488.5,
    week52Low: 214.25,
    revenueHistory: [53_823_000_000, 81_462_000_000, 96_773_000_000, 97_690_000_000, 103_400_000_000],
    grossMargin: 0.176,
    operatingMargin: 0.062,
    profitMargin: 0.071,
    returnOnEquity: 0.089,
    returnOnAssets: 0.052,
    returnOnInvestedCapital: 0.061,
    trailingPE: 164.2,
    forwardPE: 118.6,
    pegRatio: null,
    priceToSales: 11.6,
    priceToBook: 13.8,
    evToEbitda: 72.4,
    evToRevenue: 11.4,
    freeCashFlowYield: 0.008,
    debtToEquity: 0.18,
    interestCoverage: 12.6,
    currentRatio: 2.02,
    epsHistory: [0.64, 3.62, 4.3, 2.04, 2.08],
    peers: [
      {
        symbol: 'GM',
        name: 'General Motors Co.',
        marketCap: 58_000_000_000,
        revenueGrowthYoY: 0.021,
        operatingMargin: 0.062,
        returnOnEquity: 0.142,
        trailingPE: 6.4,
        evToEbitda: 8.1,
        debtToEquity: 1.72,
        oneYearReturn: 0.104
      },
      {
        symbol: 'F',
        name: 'Ford Motor Co.',
        marketCap: 46_000_000_000,
        revenueGrowthYoY: 0.008,
        operatingMargin: 0.031,
        returnOnEquity: 0.096,
        trailingPE: 9.1,
        evToEbitda: 11.2,
        debtToEquity: 3.42,
        oneYearReturn: -0.032
      },
      {
        symbol: 'RIVN',
        name: 'Rivian Automotive',
        marketCap: 14_600_000_000,
        revenueGrowthYoY: 0.184,
        operatingMargin: -0.512,
        returnOnEquity: -0.386,
        trailingPE: null as unknown as number,
        evToEbitda: null as unknown as number,
        debtToEquity: 0.68,
        oneYearReturn: -0.184
      }
    ],
    sectorMedian: { trailingPE: 12.8, evToEbitda: 9.6, operatingMargin: 0.071, returnOnEquity: 0.146 },
    nextEarningsDate: '2026-10-21',
    analyst: {
      strongBuy: 7,
      buy: 8,
      hold: 14,
      sell: 6,
      strongSell: 4,
      targetAverage: 318.6,
      targetMedian: 305.0,
      targetHigh: 600.0,
      targetLow: 120.0
    },
    estimates: [
      { fiscalYear: 2024, revenueEstimate: 99_100_000_000, epsEstimate: 2.26, revenueActual: 97_690_000_000, epsActual: 2.04, analystCount: 36 },
      { fiscalYear: 2025, revenueEstimate: 107_800_000_000, epsEstimate: 2.41, revenueActual: 103_400_000_000, epsActual: 2.08, analystCount: 38 },
      { fiscalYear: 2026, revenueEstimate: 119_400_000_000, epsEstimate: 2.88, revenueActual: null, epsActual: null, analystCount: 37 },
      { fiscalYear: 2027, revenueEstimate: 138_200_000_000, epsEstimate: 3.74, revenueActual: null, epsActual: null, analystCount: 29 }
    ],
    actions: [
      { firm: 'Wedbush', action: 'maintain', rawRating: 'Outperform', priceTarget: 500, date: '2026-07-29' },
      { firm: 'Bernstein', action: 'maintain', rawRating: 'Underperform', priceTarget: 145, date: '2026-07-25' },
      { firm: 'Guggenheim', action: 'downgrade', rawRating: 'Sell', priceTarget: 175, date: '2026-07-14' },
      { firm: 'Piper Sandler', action: 'upgrade', rawRating: 'Overweight', priceTarget: 420, date: '2026-06-26' }
    ],
    news: [
      {
        headline: 'Energy storage deployments hit a record quarter',
        summary: 'Storage gross margin again exceeded the automotive segment, lifting the group margin mix.',
        publication: 'Reuters',
        publishedAt: '2026-07-24T22:05:00Z',
        sentiment: 'positive',
        sentimentScore: 0.46
      },
      {
        headline: 'Average selling prices fall again on incentive mix',
        summary: 'Continued financing incentives weighed on automotive gross margin excluding regulatory credits.',
        publication: 'Bloomberg',
        publishedAt: '2026-07-24T22:30:00Z',
        sentiment: 'negative',
        sentimentScore: -0.38
      },
      {
        headline: 'Robotaxi permit expanded to two additional metros',
        summary: 'Supervised operation remains a condition, and the regulator has not set a timeline for removing it.',
        publication: 'The Verge',
        publishedAt: '2026-07-19T15:44:00Z',
        sentiment: 'neutral',
        sentimentScore: 0.11
      }
    ],
    catalysts: [
      { kind: 'earnings', title: 'Q3 results', detail: 'Automotive gross margin excluding credits is the number the market trades on.', expectedDate: '2026-10-21' },
      { kind: 'product', title: 'Next-generation platform start of production', detail: 'Unit economics of the lower-cost platform decide whether volume growth resumes.', expectedDate: null },
      { kind: 'regulatory', title: 'Autonomy approvals', detail: 'Removal of the supervision requirement would be the single largest re-rating trigger.', expectedDate: null },
      { kind: 'litigation', title: 'Driver-assist marketing claims', detail: 'Several proceedings continue over how the driver-assistance suite has been described.', expectedDate: null }
    ]
  }
};

export const SUPPORTED_MOCK_SYMBOLS = Object.keys(MOCK_SEEDS);
