/**
 * Static peer sets and sector medians.
 *
 * Assumption, stated openly: no free provider exposes a peer endpoint, and
 * pulling metrics for each peer would cost one request per name — more than the
 * free daily budget allows. So the comparison set is curated here rather than
 * discovered. Sector medians are rounded reference figures for the scoring
 * model, not live calculations.
 */

export const PEER_MAP: Record<string, string[]> = {
  AAPL: ['MSFT', 'GOOGL', 'SONY'],
  MSFT: ['AAPL', 'GOOGL', 'ORCL'],
  GOOGL: ['MSFT', 'META', 'AMZN'],
  AMZN: ['GOOGL', 'MSFT', 'WMT'],
  META: ['GOOGL', 'SNAP', 'PINS'],
  NVDA: ['AMD', 'AVGO', 'INTC'],
  AMD: ['NVDA', 'INTC', 'AVGO'],
  TSLA: ['GM', 'F', 'RIVN'],
  GM: ['F', 'TSLA', 'STLA'],
  F: ['GM', 'TSLA', 'STLA'],
  NFLX: ['DIS', 'WBD', 'PARA'],
  JPM: ['BAC', 'WFC', 'C'],
  KO: ['PEP', 'MNST', 'KDP'],
  XOM: ['CVX', 'COP', 'SHEL']
};

export interface SectorMedian {
  trailingPE: number | null;
  evToEbitda: number | null;
  operatingMargin: number | null;
  returnOnEquity: number | null;
}

export const SECTOR_MEDIANS: Record<string, SectorMedian> = {
  Technology: { trailingPE: 26.4, evToEbitda: 17.8, operatingMargin: 0.243, returnOnEquity: 0.264 },
  'Consumer cyclical': { trailingPE: 12.8, evToEbitda: 9.6, operatingMargin: 0.071, returnOnEquity: 0.146 },
  'Communication services': { trailingPE: 19.2, evToEbitda: 11.4, operatingMargin: 0.186, returnOnEquity: 0.198 },
  'Financial services': { trailingPE: 12.1, evToEbitda: 9.1, operatingMargin: 0.312, returnOnEquity: 0.121 },
  Healthcare: { trailingPE: 21.6, evToEbitda: 14.2, operatingMargin: 0.158, returnOnEquity: 0.176 },
  Energy: { trailingPE: 11.4, evToEbitda: 6.2, operatingMargin: 0.142, returnOnEquity: 0.152 },
  Industrials: { trailingPE: 19.8, evToEbitda: 12.6, operatingMargin: 0.114, returnOnEquity: 0.184 },
  'Consumer defensive': { trailingPE: 20.4, evToEbitda: 13.1, operatingMargin: 0.102, returnOnEquity: 0.212 }
};
