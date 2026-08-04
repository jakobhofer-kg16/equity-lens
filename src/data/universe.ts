/**
 * A small comparison universe used for the industry section.
 *
 * Ranking "alternatives" needs more names than the three-company peer set, but
 * no free provider will hand over metrics for a whole sector inside the request
 * budget. So the universe is curated here: order-of-magnitude realistic figures
 * for well-known names, grouped by sector. Labelled as sample data in the UI,
 * exactly like the rest of the bundled figures.
 */

import type { PeerSeed } from './mockSeeds';

export interface UniverseEntry extends PeerSeed {
  sector: string;
  industry: string;
}

export const UNIVERSE: UniverseEntry[] = [
  // --- Technology ---------------------------------------------------------
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', industry: 'Consumer Electronics', marketCap: 4_586_000_000_000, revenueGrowthYoY: 0.086, operatingMargin: 0.317, returnOnEquity: 1.478, trailingPE: 34.8, evToEbitda: 25.6, debtToEquity: 1.54, oneYearReturn: 0.312 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', sector: 'Technology', industry: 'Software — Infrastructure', marketCap: 3_620_000_000_000, revenueGrowthYoY: 0.152, operatingMargin: 0.448, returnOnEquity: 0.352, trailingPE: 35.4, evToEbitda: 23.1, debtToEquity: 0.35, oneYearReturn: 0.181 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology', industry: 'Internet Content & Information', marketCap: 2_410_000_000_000, revenueGrowthYoY: 0.135, operatingMargin: 0.324, returnOnEquity: 0.305, trailingPE: 24.6, evToEbitda: 17.4, debtToEquity: 0.09, oneYearReturn: 0.242 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', sector: 'Technology', industry: 'Semiconductors', marketCap: 3_180_000_000_000, revenueGrowthYoY: 0.418, operatingMargin: 0.582, returnOnEquity: 0.912, trailingPE: 41.2, evToEbitda: 34.8, debtToEquity: 0.14, oneYearReturn: 0.288 },
  { symbol: 'AVGO', name: 'Broadcom Inc.', sector: 'Technology', industry: 'Semiconductors', marketCap: 1_120_000_000_000, revenueGrowthYoY: 0.221, operatingMargin: 0.348, returnOnEquity: 0.246, trailingPE: 38.6, evToEbitda: 24.2, debtToEquity: 0.98, oneYearReturn: 0.164 },
  { symbol: 'ORCL', name: 'Oracle Corp.', sector: 'Technology', industry: 'Software — Infrastructure', marketCap: 412_000_000_000, revenueGrowthYoY: 0.089, operatingMargin: 0.288, returnOnEquity: 1.12, trailingPE: 31.2, evToEbitda: 18.6, debtToEquity: 6.8, oneYearReturn: 0.134 },
  { symbol: 'AMD', name: 'Advanced Micro Devices', sector: 'Technology', industry: 'Semiconductors', marketCap: 268_000_000_000, revenueGrowthYoY: 0.196, operatingMargin: 0.112, returnOnEquity: 0.062, trailingPE: 88.4, evToEbitda: 42.1, debtToEquity: 0.06, oneYearReturn: -0.042 },
  { symbol: 'INTC', name: 'Intel Corp.', sector: 'Technology', industry: 'Semiconductors', marketCap: 96_000_000_000, revenueGrowthYoY: -0.028, operatingMargin: -0.042, returnOnEquity: -0.031, trailingPE: null as unknown as number, evToEbitda: 12.4, debtToEquity: 0.52, oneYearReturn: -0.186 },
  { symbol: 'SONY', name: 'Sony Group Corp.', sector: 'Technology', industry: 'Consumer Electronics', marketCap: 148_000_000_000, revenueGrowthYoY: 0.041, operatingMargin: 0.104, returnOnEquity: 0.142, trailingPE: 17.2, evToEbitda: 9.8, debtToEquity: 0.42, oneYearReturn: 0.096 },
  { symbol: 'DELL', name: 'Dell Technologies', sector: 'Technology', industry: 'Consumer Electronics', marketCap: 84_000_000_000, revenueGrowthYoY: 0.072, operatingMargin: 0.061, returnOnEquity: 0.884, trailingPE: 16.4, evToEbitda: 8.9, debtToEquity: 12.4, oneYearReturn: 0.058 },

  // --- Consumer cyclical --------------------------------------------------
  { symbol: 'TSLA', name: 'Tesla, Inc.', sector: 'Consumer Cyclical', industry: 'Automobiles', marketCap: 1_203_000_000_000, revenueGrowthYoY: 0.058, operatingMargin: 0.062, returnOnEquity: 0.089, trailingPE: 164.2, evToEbitda: 72.4, debtToEquity: 0.18, oneYearReturn: 0.084 },
  { symbol: 'GM', name: 'General Motors Co.', sector: 'Consumer Cyclical', industry: 'Automobiles', marketCap: 58_000_000_000, revenueGrowthYoY: 0.021, operatingMargin: 0.062, returnOnEquity: 0.142, trailingPE: 6.4, evToEbitda: 8.1, debtToEquity: 1.72, oneYearReturn: 0.104 },
  { symbol: 'F', name: 'Ford Motor Co.', sector: 'Consumer Cyclical', industry: 'Automobiles', marketCap: 46_000_000_000, revenueGrowthYoY: 0.008, operatingMargin: 0.031, returnOnEquity: 0.096, trailingPE: 9.1, evToEbitda: 11.2, debtToEquity: 3.42, oneYearReturn: -0.032 },
  { symbol: 'STLA', name: 'Stellantis N.V.', sector: 'Consumer Cyclical', industry: 'Automobiles', marketCap: 31_000_000_000, revenueGrowthYoY: -0.112, operatingMargin: 0.024, returnOnEquity: 0.041, trailingPE: 5.2, evToEbitda: 4.8, debtToEquity: 0.64, oneYearReturn: -0.284 },
  { symbol: 'RIVN', name: 'Rivian Automotive', sector: 'Consumer Cyclical', industry: 'Automobiles', marketCap: 14_600_000_000, revenueGrowthYoY: 0.184, operatingMargin: -0.512, returnOnEquity: -0.386, trailingPE: null as unknown as number, evToEbitda: null as unknown as number, debtToEquity: 0.68, oneYearReturn: -0.184 },
  { symbol: 'TM', name: 'Toyota Motor Corp.', sector: 'Consumer Cyclical', industry: 'Automobiles', marketCap: 249_000_000_000, revenueGrowthYoY: 0.034, operatingMargin: 0.098, returnOnEquity: 0.132, trailingPE: 8.2, evToEbitda: 9.4, debtToEquity: 1.08, oneYearReturn: 0.062 },
  { symbol: 'HMC', name: 'Honda Motor Co.', sector: 'Consumer Cyclical', industry: 'Automobiles', marketCap: 44_000_000_000, revenueGrowthYoY: 0.018, operatingMargin: 0.064, returnOnEquity: 0.081, trailingPE: 7.1, evToEbitda: 7.2, debtToEquity: 0.92, oneYearReturn: -0.014 }
];

export function universeFor(sector: string | null, excludeSymbol: string): UniverseEntry[] {
  if (!sector) return [];
  const key = sector.trim().toLowerCase();
  return UNIVERSE.filter((e) => e.sector.toLowerCase() === key && e.symbol !== excludeSymbol.toUpperCase());
}
