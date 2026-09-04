import { describe, expect, it } from 'vitest';
import { parseTranscript } from './earningsCalls';

const CSV = `"symbol","report_date","speaker","title","msg","source_url"
"AAPL","2024-08-01","Suhasini Chandramouli","Director of Investor Relations at Apple","Good afternoon and welcome.","u"
"AAPL","2024-08-01","Tim Cook","CEO at Apple","Revenue grew.","u"
"AAPL","2024-08-01","NA","NA","Operator instructions.","u"
"AAPL","2024-08-01","Ben Reitzes","Managing Director and Head of Technology Research at Melius","Question about margins?","u"
"AAPL","2024-08-01","Mike Ng","Managing Director at Goldman Sachs","Follow-up on services, ""please"".","u"
"AAPL","2024-08-01","Luca Maestri","CFO at Apple","Gross margin was 46%.","u"
`;

describe('parseTranscript', () => {
  const lines = parseTranscript(CSV);

  it('reads the archive columns and unescapes quotes', () => {
    expect(lines).toHaveLength(6);
    expect(lines.find((l) => l.speaker === 'Mike Ng')?.text).toContain('"please"');
  });

  it('classifies by employer, not by job title', () => {
    const role = (name: string) => lines.find((l) => l.speaker === name)?.role;
    expect(role('Tim Cook')).toBe('management');
    expect(role('Luca Maestri')).toBe('management');
    expect(role('Suhasini Chandramouli')).toBe('management');
    // A sell-side "Head of Research" would fool a title-based matcher.
    expect(role('Ben Reitzes')).toBe('analyst');
    expect(role('Mike Ng')).toBe('analyst');
  });

  it('treats the literal NA speaker as the operator', () => {
    expect(lines.find((l) => l.text.startsWith('Operator'))?.role).toBe('operator');
  });
});
