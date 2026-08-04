import type { CompanyDossier } from '../types';
import { Card, Section } from './ui/primitives';
import { CandlestickChart } from './CandlestickChart';

export function PricePerformance({ dossier }: { dossier: CompanyDossier }) {
  return (
    <Section
      id="price"
      title="Price performance"
      subtitle="Candles, volume, MACD and RSI on one time axis. Hover for a session readout; switch on the comparison to index both series to 100."
    >
      <Card className="p-4">
        <CandlestickChart
          prices={dossier.prices}
          benchmark={dossier.benchmark}
          earnings={dossier.earnings.events}
          currency={dossier.profile.currency}
        />
      </Card>
    </Section>
  );
}
