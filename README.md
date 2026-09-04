# Equity Lens

An investment decision dashboard for US stocks, built for an MBA class project.

It is not a price predictor. The point is to turn scattered financial data into a
readable, transparent investment thesis — and to be explicit about where every
number came from, how old it is, and which parts are opinion rather than fact.

**Nothing on the page is invented.** There is no bundled sample company, no
hand-written peer list, no curated sector median and no trivia. Every figure is
fetched from a provider, computed from fetched data, or shown as missing.

> **This application is for educational purposes only and does not constitute
> personalized financial or investment advice.**

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3200>, click **API keys**, and paste a free Finnhub key.
That is enough for everything except the price chart; a free Twelve Data key
fills that. Keys stay in the browser and never reach the repository.

```bash
npm run lint              # oxlint
npm run test              # vitest — 41 tests over the pure modules
npm run build             # tsc -b && vite build
npm run backtest:fetch    # pull the backtest inputs (needs FINNHUB_KEY, TWELVEDATA_KEY)
npm run backtest:compute  # score the anchor date and write src/data/backtest.json
```

## Portfolio dashboard (post-module assignment)

`#/portfolio` — reachable from the **Portfolio** button in the header — is the
post-module deliverable: a basket of S&P 500 names that are **cheaper than their
industry peers, whose latest earnings call reads at least neutral and is not
deteriorating, entered only on a golden cross with RSI below 70**. It fetches a
live quote for every holding on load, shows the optimised weights (maximum
Sharpe, minimum variance and equal weight, switchable), a trading-signal summary
per holding, and an executive commentary written by the model from the live
quotes and signals when an OpenRouter key is present.

The selection and optimisation run offline and are committed:

```bash
npx tsx scripts/portfolio.ts tone                     # call tone for the universe (no key)
TWELVEDATA_KEY=… npx tsx scripts/portfolio.ts build   # screen, prices, optimise → src/data/portfolio.json
```

The thesis is derived from the model backtest below: valuation against peers
was the one category with signal, so the strategy keeps it and adds a text
signal and a technical entry filter. The written deliverables — functional
requirements document, portfolio construction, executive summary and the
investment committee deck — are generated from the same data files:

```bash
python3 scripts/docs/build_docx.py     # docs/HOFER_POST.docx from the WU template
python3 scripts/docs/print_pdf.py docs/HOFER_POST.docx
node scripts/docs/build_pptx.cjs       # docs/HOFER_POST_Presentation.pptx
```

## What is on the page

| Section | What it answers | Source |
|---|---|---|
| Company snapshot | What the company is and what the stock did today | Finnhub |
| Executive verdict | Our own 0–100 score, expandable to every metric and band | computed |
| Track record | Would that score have said anything a year ago? | committed backtest |
| Price performance | Candles, volume, MACD, RSI; draggable brush; benchmark overlay | Twelve Data |
| Business fundamentals | Trends over six fiscal years | Finnhub series |
| Valuation | Multiples against the median of the real peer set | Finnhub |
| Competitor comparison | Finnhub's own peer list, each with live metrics | Finnhub |
| Peer performance and alternatives | 1-year return against peers; top 3 peers on fundamentals | Finnhub |
| Analyst consensus | Rating distribution month by month; price target if a key allows | Finnhub, Alpha Vantage |
| News and catalysts | Recent coverage, next reporting date with estimates | Finnhub |
| Earnings call sentiment | Tone of the last four calls; management vs analysts; tone vs price reaction | course archive, Twelve Data |
| Fun facts | Arithmetic curiosities from the loaded data | computed |
| Investment thesis builder | Editable bull/base/bear; a model can write it from the whole dossier | template or OpenRouter |
| Watchlist | Remembers the score when added and shows what moved since | browser |
| Portfolio (`#/portfolio`) | Live quotes, optimised weights, signals and model commentary for the thesis basket | Finnhub, committed data |

## Data providers

Every tier below was verified against a real key, not read off a pricing page.

| | Finnhub free | Twelve Data free | Alpha Vantage free |
|---|---|---|---|
| Budget | **60 / minute** | 8 / minute, 800 / day | 25 / **day** |
| Profile, logo | ✓ | — | ✓ (no logo) |
| Ratios | ✓ 133 metrics | — | ✓ |
| Fundamentals history | ✓ 39 annual + 41 quarterly series | — | ✓ statements |
| Peers | ✓ real list | — | — |
| Analyst distribution | ✓ **month by month** | — | current snapshot only |
| Consensus price target | premium | — | ✓ |
| Company news | ✓ | — | ✓ |
| Earnings calendar | ✓ with estimates | — | — |
| Price history | premium | ✓ multi-year | 100 bars |

**Finnhub** is the base. Sixty requests a minute is what allows fetching metrics
for every peer instead of rationing calls. **Twelve Data** fills the chart and
the benchmark. **Alpha Vantage** is used for exactly one request per company —
the consensus price target Finnhub charges for — and as a last resort for prices.

Finnhub publishes per-share figures and margins rather than absolute statement
lines, so the fundamentals charts reconstruct revenue and profit from them and
the share count. Derived, not reported, and labelled as such in the app.

Optional providers are fetched **before** the base provider, and any base
request they cover is skipped only once they have actually succeeded. A failing
key costs its own section and nothing else; every layer reports what it did in
a note under the header.

### Earnings call transcripts

Every commercial transcript API is premium, Finnhub's included. This section
therefore runs on the archive published for the course:

<https://github.com/kwartler/vienna-genai-finance-course/tree/main/earnings_call_archive/transcripts_sp500_marketbeat>

2,899 transcripts across 383 S&P 500 companies, served from
raw.githubusercontent.com with `Access-Control-Allow-Origin: *`. No key. The
four most recent quarters per ticker are indexed in `src/data/earningsArchive.ts`.

### Entering keys

Click **API keys** in the header. Keys are stored in this browser only, are sent
nowhere except the provider they belong to, and are never written to the
repository. Because this is a static app with no backend, a key travels from the
browser straight to the provider over HTTPS — fine for a classroom, but anything
shared should put a serverless proxy in front (see below).

| Key | Env name | What it unlocks | Required |
|---|---|---|---|
| Finnhub | `FINNHUB_API_KEY` | Everything except the price chart | **Yes** |
| Twelve Data | `TWELVE_DATA_API` | Multi-year price history and the benchmark | For the chart |
| Alpha Vantage | `ALPHAVANTAGE_API_KEY` | Consensus price target; 100-bar prices as a fallback | Optional |
| newsdata.io | `NEWS_DATA_IO_API_KEY` | Alternative headline source | Optional |
| OpenRouter | `OPENROUTER_API_KEY` | Model-written thesis from the whole dossier | Optional |

Anything prefixed `VITE_` in `.env.local` is compiled into the bundle and is
therefore public; the panel is the better route.

### Keeping keys off the client

For any shared deployment, put a serverless function in front of the providers:

```js
// api/finnhub.js — Vercel / Netlify function
export default async function handler(req, res) {
  const params = new URLSearchParams(req.query);
  params.set('token', process.env.FINNHUB_KEY); // server-side only
  const upstream = await fetch(`https://finnhub.io/api/v1/${req.query.path}?${params}`);
  res.setHeader('Cache-Control', 's-maxage=600');
  res.status(upstream.status).json(await upstream.json());
}
```

Restrict `path` to an allowlist so the function cannot be used as an open proxy.

## Scoring methodology

The Executive verdict score runs from 0 to 100 and combines five categories:

| Category | Weight | Metrics |
|---|---|---|
| Growth | 25% | Revenue growth YoY, 3-year revenue CAGR, EPS growth YoY |
| Profitability | 25% | Operating margin, net margin, ROE, ROIC |
| Valuation vs peers | 20% | P/E and EV/EBITDA relative to the **peer median**, FCF yield, PEG |
| Financial health | 15% | Debt to equity, interest coverage, current ratio |
| Price momentum | 15% | 1-year return, position in the 52-week range, price vs 200-day average |

Each metric is scored 0–100 on a linear band with two stated anchors. A category
is the mean of its available metrics; the categories are combined by weight.
**A category with no data is dropped and its weight redistributed**, never
counted as zero. The peer median is the median of the Finnhub peer set's own
metrics, computed on the page.

Classification: **Bullish** at 65+, **Watch** from 40 to 64, **Bearish** below 40.

**Analyst opinion carries zero weight**, and a test enforces it. If analyst
ratings fed the score, comparing the score against those ratings would only
rediscover the same opinion. Keeping them apart is what makes the "contrarian
signal" callout meaningful.

### Track record

`npm run backtest:fetch` pulls, for all 383 archive companies, the Finnhub
annual series and profile plus Twelve Data prices from late 2023 to early 2026.
`npm run backtest:compute` then scores every company **as of 31 January 2025**
using only fiscal periods ending on or before that date, with valuation
multiples recomputed from the anchor-day close, peer medians per Finnhub
industry (universe median where an industry has fewer than four members), and
momentum from bars up to the anchor. The forward return is the following 252
trading days, measured as excess over SPY.

The result is committed as `src/data/backtest.json` and rendered in the Track
record section. The headline sentence there is chosen by the numbers — a null
or inverse result reads as exactly that.

**What it found (anchor 31 Jan 2025, 359 of 383 companies, SPY +14.6%):** the
rank correlation between the total score and the following year's excess return
is 0.00, inside the ±0.11 noise floor. The score did not rank returns better
than chance. Two categories did move beyond the noise: **valuation vs peers
(ρ +0.14)** — cheaper-than-peers was followed by better returns — and
**profitability (ρ −0.13)** — high margins and returns on capital were followed
by *worse* returns, consistent with quality having been priced in already.
Growth, financial health and momentum carried no detectable signal. All three
labels had a median excess return below zero, which mostly says the median
stock lagged a cap-weighted index in a year led by the largest names. Growth is measured on per-share
revenue, which buybacks flatter; interest coverage and PEG are not available
historically and are absent.

## Earnings call sentiment

Scored with a finance-specific word list rather than a general one. Ordinary
sentiment lexicons treat "liability", "cost" and "depreciation" as negative, so
scoring an earnings call with one mostly measures how much accounting was
discussed. Three dimensions: polarity, **hedging** and **legal vocabulary**.

Management and analysts are scored separately — management always scores
higher, so the signal is the gap and its movement. Speakers are separated by
employer, not job title (a sell-side "Head of Research" fools a title matcher).
Boilerplate is excluded and a highlighted passage needs several tone words.

The section also puts each call's tone change next to the share price move over
the following five sessions. Four calls are far too few to conclude anything;
the point is to see the two side by side.

This is a word-count model. It cannot read sarcasm, negation or context.

## Architecture

```
src/
  types/           Every data model the UI consumes
  services/
    index.ts       Facade: layered assembly, persisted cache, de-duplication
    keys.ts        Runtime key store (browser only)
    providers/     finnhub, twelveData, alphaVantage, newsData, openRouter, earningsCalls
  data/            earningsArchive.ts (index), backtest.json (results)
  lib/             scoring, sentiment, indicators, industry, funFacts, thesis, backtestStats
  hooks/           useWatchlist, useEarningsSentiment
  components/      One file per section, plus ui/ primitives
scripts/backtest.ts
```

## Assumptions and limits

- **Fundamentals are reconstructed** from per-share figures and margins.
- **Peer medians use up to eight Finnhub peers**; the set is Finnhub's, not ours.
- **Finnhub has no business description** on the free plan; the snapshot says so.
- **Individual analyst upgrades/downgrades and target ranges are premium
  everywhere** tested; those panels report themselves unavailable.
- **The watchlist and keys are per browser.**
- **One backtest anchor is one draw.** A different year could read differently.

## Next improvements

1. The serverless proxy above, which also unlocks SEC EDGAR (free, no CORS).
2. A second and third backtest anchor, so the track record is not one year.
3. Persist the edited thesis with the watchlist entry.
4. A quarterly view in the fundamentals section.
5. Mobile layout for the four-panel chart.
