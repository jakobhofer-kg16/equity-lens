# Equity Lens

An investment decision dashboard for US stocks, built for an MBA class project.

It is not a price predictor. The point is to turn scattered financial data into a
readable, transparent investment thesis — and to be explicit about where every
number came from, how old it is, and which parts are opinion rather than fact.

> **This application is for educational purposes only and does not constitute
> personalized financial or investment advice.**

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3200>. The app works immediately with no API key —
complete sample dossiers are bundled for **AAPL**, **MSFT** and **TSLA**.

```bash
npm run lint      # oxlint
npm run build     # tsc -b && vite build
npm run preview   # serve the production build
```

## What is on the page

| Section | What it answers |
|---|---|
| Company snapshot | What does this company do, and what is the stock doing today |
| Executive verdict | Our own 0–100 score, expandable down to individual metrics |
| Price performance | Candles, volume, MACD and RSI with range controls and a benchmark overlay |
| Business fundamentals | Is the business improving — trends, not a single latest number |
| Valuation | Multiples against the sector median, with "not meaningful" where it applies |
| Competitor comparison | How it stacks against a curated peer set |
| Analyst consensus | What the sell side publishes, kept strictly separate from our model |
| News and catalysts | Sourced headlines, model-scored sentiment, upcoming events |
| Fun facts | Trivia and arithmetic curiosities. Entertainment, clearly labelled |
| Investment thesis builder | An editable bull/base/bear draft you can copy out |
| Watchlist | Browser-local, no account needed |

## Data providers

**Alpha Vantage** is the live provider. It was chosen after testing the free
tiers of several services, for three reasons:

1. A single `OVERVIEW` call returns the company profile, valuation multiples,
   margins, returns, growth, the 52-week range **and** the full analyst rating
   distribution plus target price. Free analyst consensus is rare.
2. It sends `Access-Control-Allow-Origin: *`, so a static build can call it
   directly with no proxy.
3. The free key allows unlimited daily requests for verified educational
   projects — the standard free limit is otherwise 25 requests/day.

Free-tier limits worth knowing: data is **end-of-day**, because intraday US
market data is premium-only under exchange rules. One dossier costs up to eight
requests, so responses are cached for 10 minutes and identical in-flight
requests are de-duplicated.

Get a key at <https://www.alphavantage.co/support/#api-key>, copy
`.env.example` to `.env.local`, and set `VITE_ALPHAVANTAGE_KEY`.

### Providers evaluated and rejected

| Provider | Why not |
|---|---|
| Financial Modeling Prep | Analyst estimates, grades and peers sit behind paid tiers; the free plan is 250 requests/day |
| Finnhub | Recommendation trends are free, but detailed financials are premium |
| SEC EDGAR (`data.sec.gov`) | Free, official, complete history, no key — but sends no CORS header, so a static page cannot call it, and it carries no analyst data. Worth adding behind the proxy later |
| Stooq | Now behind a JavaScript bot challenge, unusable from a browser app |

### Keeping the key off the client

Anything prefixed `VITE_` is inlined into the JavaScript bundle at build time
and is therefore **public**. That is acceptable only for a throwaway local demo
key.

For any shared deployment, put a serverless function in front of the provider
and point `VITE_API_PROXY_URL` at it:

```js
// api/quote.js — Vercel / Netlify function
export default async function handler(req, res) {
  const params = new URLSearchParams(req.query);
  params.set('apikey', process.env.ALPHAVANTAGE_KEY); // server-side only
  const upstream = await fetch(`https://www.alphavantage.co/query?${params}`);
  res.setHeader('Cache-Control', 's-maxage=600');
  res.status(upstream.status).json(await upstream.json());
}
```

The function holds the real key as a server environment variable, so it never
reaches the browser. Restrict it to an allowlist of `function` values so it
cannot be used as an open proxy.

## Scoring methodology

The Executive verdict score runs from 0 to 100 and combines five categories:

| Category | Weight | Metrics |
|---|---|---|
| Growth | 25% | Revenue growth YoY, 3-year revenue CAGR, earnings growth YoY |
| Profitability | 25% | Operating margin, net margin, return on equity, return on invested capital |
| Valuation vs peers | 20% | P/E and EV/EBITDA relative to the sector median, free cash flow yield, PEG |
| Financial health | 15% | Debt to equity, interest coverage, current ratio |
| Price momentum | 15% | 1-year return, position in the 52-week range, price vs the 200-day average |

Each metric is scored 0–100 on a linear band with two stated anchors — for
example revenue growth scores 0 at −5% and 100 at +25%. A category is the mean
of its available metrics; the categories are then combined by weight. **A
category with no data is dropped and its weight is redistributed**, rather than
counted as zero, which would penalise a company for a provider's gaps.

Classification: **Bullish** at 65+, **Watch** from 40 to 64, **Bearish** below
40. Confidence reflects how many of the model's metrics had usable data.

Every band is shown in the UI under "Show how this score is built". They are
chosen for teaching, not calibrated against realised returns.

**Analyst opinion carries zero weight.** This is deliberate. If analyst ratings
fed the score, the app would then compare the score against those same ratings
and find agreement it had manufactured itself. Keeping them separate is what
makes the "contrarian signal" callout meaningful.

## Architecture

```
src/
  types/          One place defining every data model the UI consumes
  services/
    index.ts      Facade: caching, in-flight de-duplication, provider selection
    providers/
      mock.ts     Bundled sample data, deterministic price generation
      alphaVantage.ts
  data/           Sample seeds, peer map, sector medians, curated trivia
  lib/            Scoring, indicators, fun facts, thesis drafting, formatting
  hooks/          Watchlist (localStorage)
  components/     One file per dashboard section, plus ui/ primitives
```

Components call `loadDossier(symbol)` and never touch a provider directly, so
adding a provider means writing one adapter that returns a `CompanyDossier`.

Handled explicitly: loading skeletons, empty states, provider errors, rate
limits, missing metrics, stale data warnings and unsupported tickers. When a
live provider is configured but rate-limited or unreachable, the app falls back
to sample data **only** where a sample exists, and the UI still says the data is
sample data.

## Assumptions

- **Peer sets are curated, not discovered.** No free provider exposes a peer
  endpoint, and fetching metrics per peer would cost one request each. See
  `src/data/peerMap.ts`.
- **Sector medians are static reference figures**, not live calculations.
- **Sample financial figures are order-of-magnitude realistic, not filings.**
  They exist so the app is explorable without a key, and are labelled as sample
  data everywhere they appear.
- **Sample price history is generated** from a seeded PRNG anchored to the real
  latest close, so charts are stable across reloads but are not real prices.
- **Return on invested capital and current ratio are unavailable from the live
  provider** and show as "n/a" there; both are present in the sample data.
- **The watchlist is per browser.** Clearing site data removes it.

## Recommended next improvements

1. Add the serverless proxy so the key is server-side and SEC EDGAR becomes
   usable — that would give real, complete, free fundamentals with full history.
2. Fetch peer metrics through the proxy, which removes the request-budget limit
   and makes the competitor table live.
3. Persist the edited thesis alongside the watchlist entry, so a company's
   research survives a reload.
4. Add a quarterly view to the fundamentals section; annual periods hide
   inflections.
5. Unit-test the scoring bands and the ratio derivations — they are the part
   most likely to break silently when a provider changes a field name.
6. Replace the static sector medians with a computed median over the peer set
   once peer metrics are live.

## Compliance and transparency

- The educational-use disclaimer is visible in the header and the footer.
- The data provider, freshness (`live` / `delayed` / `end-of-day`) and the exact
  update time are shown in the snapshot and the footer.
- Sections produced by this application rather than reported by a source are
  marked **Generated** or **Model output**.
- Analyst price targets are described as opinions, never as predictions or
  guaranteed outcomes.
- Thin or stale analyst coverage triggers an explicit warning.
- Metrics that cannot be computed read "not meaningful" rather than showing zero.
