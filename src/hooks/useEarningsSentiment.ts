import { useEffect, useState } from 'react';
import { fetchEarningsSentiment, hasEarningsArchive, type EarningsSentimentResult } from '../services/providers/earningsCalls';

export function useEarningsSentiment(symbol: string) {
  const [result, setResult] = useState<EarningsSentimentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setError(null);
    if (!hasEarningsArchive(symbol)) return;

    setLoading(true);
    fetchEarningsSentiment(symbol)
      .then((value) => {
        if (!cancelled) setResult(value);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  return { result, loading, error, available: hasEarningsArchive(symbol) };
}
