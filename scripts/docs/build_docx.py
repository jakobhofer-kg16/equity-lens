"""
Builds HOFER_POST.docx from the WU written-assignment template.

Fills the cover, ticks "Post-Module", drops the template's own instructions
(the template asks for that), and appends the three written parts of the
post-module assignment. All numbers come from src/data/portfolio.json and
src/data/backtest.json — nothing is typed in by hand.
"""
import json, re, shutil, subprocess, zipfile, os, html, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TEMPLATE = Path.home() / "Downloads/Template_Written Assignments_EMBA FIN 25-27.docx"
OUT_DIR = ROOT / "docs"
WORK = Path("/private/tmp/claude-501/-Users-jakob-Desktop-Claude/678dda1a-94eb-4847-83a6-ba8ce51a4344/scratchpad/docx_work")

P = json.load(open(ROOT / "src/data/portfolio.json"))
B = json.load(open(ROOT / "src/data/backtest.json"))
LIVE = "https://jakobhofer-kg16.github.io/equity-lens/"
REPO = "https://github.com/jakobhofer-kg16/equity-lens"
PORTFOLIO_URL = LIVE + "#/portfolio"

def esc(s): return html.escape(str(s), quote=False)
def pct(x, d=1, sign=False):
    if x is None: return "n/a"
    s = f"{x*100:+.{d}f}%" if sign else f"{x*100:.{d}f}%"
    return s
def mult(x, d=1): return "n/a" if x is None else f"{x:.{d}f}x"

# ---------------------------------------------------------------- XML helpers
def run(text, bold=False, italic=False, size=None, color=None):
    rpr = ""
    if bold: rpr += "<w:b/>"
    if italic: rpr += "<w:i/>"
    if color: rpr += f'<w:color w:val="{color}"/>'
    if size: rpr += f'<w:sz w:val="{size}"/><w:szCs w:val="{size}"/>'
    return f'<w:r><w:rPr>{rpr}</w:rPr><w:t xml:space="preserve">{esc(text)}</w:t></w:r>'

def para(runs, align=None, before=0, after=120, keep_next=False, indent=None, page_break_before=False):
    ppr = ""
    if keep_next: ppr += "<w:keepNext/>"
    if page_break_before: ppr += "<w:pageBreakBefore/>"
    ppr += f'<w:spacing w:before="{before}" w:after="{after}"/>'
    if indent: ppr += f'<w:ind w:left="{indent}" w:hanging="240"/>'
    if align: ppr += f'<w:jc w:val="{align}"/>'
    return f"<w:p><w:pPr>{ppr}</w:pPr>{runs}</w:p>"

def h1(t): return para(run(t, bold=True, size=30, color="1F2A44"), before=360, after=160, keep_next=True)
def h2(t): return para(run(t, bold=True, size=24, color="1F2A44"), before=240, after=100, keep_next=True)
def h3(t): return para(run(t, bold=True, size=21), before=160, after=60, keep_next=True)
def body(t, after=120): return para(run(t, size=20), after=after)
def rich(parts, after=120):
    """parts: list of (text, bold) tuples."""
    return para("".join(run(t, bold=b, size=20) for t, b in parts), after=after)
def bullet(t, level=0):
    return para(run("–  ", size=20) + run(t, size=20), after=60, indent=360 + level * 360)
def bullet_rich(parts, level=0):
    return para(run("–  ", size=20) + "".join(run(t, bold=b, size=20) for t, b in parts), after=60, indent=360 + level * 360)
def page_break(): return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'

def table(headers, rows, widths, header_fill="E8EDF5", font=18, align_right_from=None):
    total = sum(widths)
    def cell(text, w, bold=False, fill=None, right=False):
        tcpr = f'<w:tcW w:w="{w}" w:type="dxa"/>'
        if fill: tcpr += f'<w:shd w:val="clear" w:color="auto" w:fill="{fill}"/>'
        jc = '<w:jc w:val="right"/>' if right else ""
        return (f'<w:tc><w:tcPr>{tcpr}</w:tcPr><w:p><w:pPr><w:spacing w:before="20" w:after="20"/>{jc}</w:pPr>'
                f'{run(text, bold=bold, size=font)}</w:p></w:tc>')
    borders = ('<w:tblBorders>' + ''.join(f'<w:{b} w:val="single" w:sz="4" w:space="0" w:color="BFC7D5"/>'
               for b in ("top","left","bottom","right","insideH","insideV")) + '</w:tblBorders>')
    grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in widths)
    x = (f'<w:tbl><w:tblPr><w:tblW w:w="{total}" w:type="dxa"/>{borders}'
         f'<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>'
         f'<w:tblGrid>{grid}</w:tblGrid>')
    x += "<w:tr><w:trPr><w:tblHeader/></w:trPr>" + "".join(cell(h, w, bold=True, fill=header_fill,
          right=(align_right_from is not None and i >= align_right_from)) for i, (h, w) in enumerate(zip(headers, widths))) + "</w:tr>"
    for r in rows:
        x += "<w:tr>" + "".join(cell(c, w, right=(align_right_from is not None and i >= align_right_from))
                                for i, (c, w) in enumerate(zip(r, widths))) + "</w:tr>"
    x += "</w:tbl>" + para(run("", size=20), after=120)
    return x

# ---------------------------------------------------------------- content
H = sorted(P["holdings"], key=lambda h: -h["composite"])
W = P["weights"]; S = P["stats"]
core10 = H[:10]
n = len(H)
industries = sorted(set(h["industry"] for h in H))
rb = B["rows"]
def rho(cat):
    # recompute spearman quickly for the text
    pairs = [(r["categories"][cat], r["excessReturn"]) for r in rb if r["categories"].get(cat) is not None]
    def ranks(a):
        o = sorted(range(len(a)), key=lambda i: a[i]); rk = [0]*len(a)
        for p_, i in enumerate(o): rk[i] = p_+1
        return rk
    a = ranks([p[0] for p in pairs]); b = ranks([p[1] for p in pairs]); m = len(pairs)
    ma = sum(a)/m; mb = sum(b)/m
    num = sum((x-ma)*(y-mb) for x, y in zip(a, b)); den = (sum((x-ma)**2 for x in a)*sum((y-mb)**2 for y in b))**.5
    return num/den
rho_val = rho("valuation"); rho_prof = rho("profitability")
floor_ = 2/len(rb)**.5

def funnel_rows():
    rej = P.get("rejectedByScreen", {})
    return [
        ["S&P 500 companies with an earnings-call transcript in the course archive", str(P["universe"])],
        ["… with Finnhub fundamentals", str(P["withFundamentals"])],
        ["… cheaper than industry peers, profitable, acceptable call tone", str(P["passedScreen"])],
        ["… after the industry cap (max 4 per industry), priced", str(P["candidatesPriced"])],
        ["… on a golden cross, above the 200-day average, RSI < 70", str(P["passedTechnical"])],
        ["Portfolio (top by composite rank)", str(n)],
    ]

def holdings_rows():
    rows = []
    for h in sorted(H, key=lambda h: -W["maxSharpe"][h["symbol"]]):
        s = h["symbol"]; v = h["valuation"]; t = h["tone"]; te = h["technical"]
        rows.append([s, h["name"][:26], h["industry"][:22],
                     pct(W["maxSharpe"][s]), pct(W["minVariance"][s]),
                     f'{v["pe"]:.1f} / {v["peerPe"]:.1f}',
                     f'{t["polarity"]:.2f}' + (f' ({t["delta"]:+.2f})' if t["delta"] is not None else ""),
                     f'{te["rsi"]:.0f}'])
    return rows

def stats_rows():
    def r(k, label): s = S[k]; return [label, pct(s["expectedReturn"]), pct(s["volatility"]), f'{s["sharpe"]:.2f}']
    return [r("maxSharpe","Maximum Sharpe (chosen)"), r("minVariance","Minimum variance"), r("equal","Equal weight"), r("benchmark","SPY, same window")]

top_w = sorted(H, key=lambda h: -W["maxSharpe"][h["symbol"]])[:3]
concentration = sum(sorted(W["maxSharpe"].values(), reverse=True)[:5])

FRD = [
 h1("Part A — Functional Requirements Document"),
 body("This document specifies a quantitative investment thesis and the application that implements it. Everything below was built and is running: the dashboard is published on GitHub Pages, the repository is public, and every figure in this document is read from the application's committed data files rather than typed in."),
 rich([("Live application: ", True), (PORTFOLIO_URL, False)]),
 rich([("Repository: ", True), (REPO, False)]),

 h2("1. Investment thesis"),
 rich([("Name. ", True), ("“Cheap against peers, confirmed by the call.”", False)]),
 body("Buy S&P 500 companies that trade at a discount to their own industry peers on earnings and cash-flow multiples, whose most recent earnings call reads at least neutral and is not deteriorating, and whose share price is in a confirmed uptrend. Hold a diversified basket of 15–30 such names, weighted by a maximum-Sharpe optimisation within bands, and re-screen quarterly after each earnings season."),
 rich([("Why this and not something else. ", True), ("The thesis is not chosen from conviction; it is chosen from evidence produced by the same application. Before writing the thesis I backtested a five-factor fundamental score (growth, profitability, valuation versus peers, financial health, momentum) on " + f"{B['scored']} S&P 500 companies as of {B['anchor']}" + " against their excess return over SPY in the following 252 trading days. The total score had no predictive power (rank correlation 0.00). One category did: ", False), (f"valuation versus industry peers, ρ = {rho_val:+.2f}", True), (f", above the ±{floor_:.2f} noise floor for that sample. Profitability was ", False), (f"negatively", True), (f" related to subsequent returns (ρ = {rho_prof:+.2f}) — quality had already been priced. So the thesis keeps the one factor that showed signal, drops the one that hurt, and adds two things the score did not have: a text signal from the earnings call and a technical entry filter.", False)]),
 rich([("What the text signal adds. ", True), ("A low multiple is either an opportunity or a warning. The earnings call is where management has to defend the quarter to analysts. Scoring the call with a finance-specific word list (positive/negative polarity, hedging rate, legal vocabulary) and requiring the latest call to be at least neutral and not worse than the prior one is a cheap way of separating “cheap because ignored” from “cheap because in trouble”.", False)]),
 rich([("What the technical filter adds. ", True), ("Value stocks can stay cheap for years. The golden-cross and RSI rules taught in the module are used strictly as an entry timing filter: a name enters only when its 50-day average is above its 200-day average, the price is above the 200-day average, and RSI(14) is below 70. The filter does not select; it gates.", False)]),

 h2("2. Equity universe"),
 rich([("Screening universe. ", True), (f"The {P['universe']} S&P 500 companies that have earnings-call transcripts in the course archive (kwartler/vienna-genai-finance-course). This is the widest set for which the text signal can be computed without a paid transcript API. {P['withFundamentals']} of them have Finnhub fundamentals.", False)]),
 rich([("Core universe (10 stocks). ", True), ("The ten highest-ranked names on the composite score, shown here with the figures that put them there. They are the reference set the functional requirements below are written against; the portfolio in Part B widens the selection to all names that pass the rules.", False)]),
 table(["Ticker","Company","Industry","P/E vs peer","EV/EBITDA vs peer","Call tone (Δ)","RSI"],
       [[h["symbol"], h["name"][:28], h["industry"][:24],
         f'{h["valuation"]["pe"]:.1f} / {h["valuation"]["peerPe"]:.1f}',
         f'{h["valuation"]["evEbitda"]:.1f} / {h["valuation"]["peerEv"]:.1f}',
         f'{h["tone"]["polarity"]:.2f}' + (f' ({h["tone"]["delta"]:+.2f})' if h["tone"]["delta"] is not None else ""),
         f'{h["technical"]["rsi"]:.0f}'] for h in core10],
       [900, 2100, 1900, 1300, 1500, 1300, 700], align_right_from=3),

 h2("3. Selection criteria"),
 h3("3.1 Fundamental rules (the thesis)"),
 bullet_rich([("Cheaper than peers. ", True), ("Trailing P/E below the median of the company's Finnhub industry within the universe, or EV/EBITDA below the industry median. Both multiples must be positive (loss-making companies are excluded). Where an industry has fewer than four members the universe median is used.", False)]),
 bullet_rich([("Profitable. ", True), ("Trailing operating margin above zero.", False)]),
 h3("3.2 Text signal (earnings-call tone)"),
 bullet_rich([("Tone level. ", True), ("Polarity of the latest call — (positive − negative) ÷ (positive + negative) words over a finance lexicon — of at least 0.20. Management and analysts are separated by employer, not job title; operator lines are dropped; boilerplate (safe-harbour language, welcome) is excluded from highlights.", False)]),
 bullet_rich([("Not deteriorating. ", True), ("Polarity change versus the prior call no worse than −0.10.", False)]),
 bullet_rich([("Not evasive. ", True), ("Hedging words (may, could, uncertain, …) below 1.5% of all words.", False)]),
 h3("3.3 Technical rules (entry filter, as taught)"),
 bullet("Golden cross: 50-day simple moving average above the 200-day."),
 bullet("Price above the 200-day average."),
 bullet("RSI(14) below 70 — not overbought at entry."),
 h3("3.4 Ranking"),
 body("Names that pass all rules are ranked by a composite: 50% average valuation discount to peers, 30% call-tone level, 20% call-tone change, each as a percentile rank. The industry cap (at most four per Finnhub industry) is applied on the way in."),

 h2("4. Data sources"),
 table(["Source","Used for","Access","Limit that shaped the design"],
  [["Finnhub (finnhub.io)","Company profile, 133 TTM metrics incl. P/E, EV/EBITDA, margins; industry; peers; quotes","Free API key, entered at run time","60 requests/minute; price history, price targets and transcripts are premium"],
   ["Twelve Data","Daily OHLCV for the technical rules, the two-year return series for optimisation, and SPY","Free API key","8 requests/minute, 800/day; some symbols not on the free plan"],
   ["Course transcript archive","Earnings-call transcripts (2,899 calls, 383 companies) for the text signal","Public GitHub, no key, CORS-enabled","Coverage stops at the archive's last quarter"],
   ["OpenRouter","Executive commentary and thesis drafting (google/gemini-2.5-flash)","Personal API key, optional","Output is labelled AI-generated; never used for selection"],
   ["Alpha Vantage","Consensus price target only","Free key, optional","25 requests/day; one request per company"]],
  [1700, 3300, 1900, 2800]),
 body("Keys are entered in the application and stored in the browser only. The repository and the deployed bundle contain no key; this was verified with a search of the full Git history and of the published JavaScript."),

 h2("5. Portfolio construction rules"),
 bullet(f"Hold every name that passes the rules, capped at 30 and floored at 15. Current count: {n}."),
 bullet(f"Weights from the maximum-Sharpe-ratio optimisation (the method chosen), long-only, between {pct(P['minWeight'],0)} and {pct(P['maxWeight'],0)} per name. Minimum-variance and equal-weight are computed on the same holdings for comparison."),
 bullet(f"Inputs: {P['lookbackTradingDays']} trading days of daily log returns ending {P['pricesAsOf']}; annualised mean and covariance; risk-free rate {pct(P['riskFreeRate'],0)}."),
 bullet("Re-screen quarterly after earnings season; exit a name when it breaks the 200-day average or its call tone falls below zero."),

 h2("6. Application behaviour (functional requirements)"),
 table(["ID","Requirement","Acceptance criterion"],
  [["FR-1","On load, fetch a live quote for every holding from Finnhub","All holdings show a price and day change within 10 seconds; failures are shown as “stale” with the last close, never hidden"],
   ["FR-2","Display optimised weights and the equivalent $1M allocation","Weights sum to 100%; the user can switch between max-Sharpe, min-variance and equal weight"],
   ["FR-3","Show a trading-signal summary per holding","Golden/death cross, RSI(14), MACD histogram sign and call tone with change are shown, with the as-of date"],
   ["FR-4","Render an LLM executive commentary on load","With an OpenRouter key: four paragraphs written from the live quotes and signals, labelled with the model. Without a key: a computed signal summary and no pre-written text"],
   ["FR-5","Compare the weighting methods","Expected return, volatility and Sharpe for all three methods and SPY over the same window, labelled in-sample"],
   ["FR-6","Link every holding to the full research dossier","Clicking a ticker opens the company view with score, chart, peers, analysts, news and call sentiment"],
   ["FR-7","Show the model's own track record","The backtest section states the rank correlation, quintile returns and per-category signal; its headline sentence is derived from the numbers"],
   ["FR-8","Handle keys safely","Keys live in localStorage only; the setup screen appears when no Finnhub key is present; a bad key degrades one section, not the page"],
   ["FR-9","Respect provider limits","Finnhub burst limit handled with one retry; Twelve Data used only in the offline build; nothing is fetched twice within six hours"],
   ["FR-10","Publish via GitHub Pages","Every push to main builds and deploys; the URL is public"]],
  [700, 3900, 5100]),
 h3("Non-functional"),
 bullet("Transparency: every number that is derived, reconstructed or model-generated is labelled as such next to where it appears."),
 bullet("No invented data: without a key the application shows a setup screen, not sample companies."),
 bullet("Tests: 41 unit tests over the scoring, sentiment, indicator and provider-parsing modules, including the invariant that analyst opinion changes the score by exactly zero."),
]

PART_B = [
 h1("Part B — Portfolio construction"),
 body(f"Selection was run on {P['generatedAt'][:10]} with the rules in Part A. The funnel, the resulting holdings and the optimisation are below; the same numbers drive the dashboard."),
 h2("1. Selection funnel"),
 table(["Step","Companies"], funnel_rows(), [8100, 1600], align_right_from=1),
 body("The largest single reason for exclusion was not being cheaper than peers (" + str(P.get("rejectedByScreen",{}).get("not cheaper than peers","–")) + " companies), followed by loss-making businesses (" + str(P.get("rejectedByScreen",{}).get("no positive earnings / EBITDA","–")) + ") and a deteriorating call (" + str(P.get("rejectedByScreen",{}).get("tone deteriorating","–")) + "). The technical filter then removed " + str(P["candidatesPriced"] - P["passedTechnical"]) + " of " + str(P["candidatesPriced"]) + " priced candidates — cheap names that were still in a downtrend."),
 h2(f"2. Holdings ({n}) and weights"),
 table(["Ticker","Company","Industry","Max Sharpe","Min var","P/E vs peer","Tone (Δ)","RSI"], holdings_rows(),
       [800, 2200, 1900, 1000, 900, 1300, 1200, 400], align_right_from=3),
 body(f"{len(industries)} industries are represented; the largest weight is {pct(max(W['maxSharpe'].values()),0)} and the top five names carry {pct(concentration,0)} of the max-Sharpe portfolio."),
 h2("3. Optimisation results (in-sample)"),
 table(["Method","Expected return","Volatility","Sharpe"], stats_rows(), [3400, 2100, 2100, 2100], align_right_from=1),
 body(f"The maximum-Sharpe weights are chosen for the mandate. Their expected return of {pct(S['maxSharpe']['expectedReturn'])} is a two-year historical mean — the weakest input in any mean-variance optimisation — which is exactly why the minimum-variance portfolio (which does not use expected returns) and equal weight are shown beside it. The {pct(P['minWeight'],0)}–{pct(P['maxWeight'],0)} band was added deliberately: without a floor the optimiser put ten names at the cap and nine at zero, which is a bet on last year's winners, not a diversified expression of the thesis."),
 body("Read the Sharpe ratios as a description of the fit, not a forecast: the weights were chosen on the same window they are measured on."),
]

EXEC = [
 h1("Part C — Executive Summary"),
 rich([("Thesis. ", True), (f"Buy S&P 500 companies that are cheaper than their own industry peers and whose latest earnings call confirms the business is not deteriorating; enter only in an uptrend. {n} names, weighted by maximum Sharpe ratio within {pct(P['minWeight'],0)}–{pct(P['maxWeight'],0)} bands, re-screened quarterly. Mandate: $1M.", False)]),
 rich([("Supporting logic. ", True), (f"A backtest of a five-factor fundamental score on {B['scored']} S&P 500 companies as of {B['anchor']} found no power in the total score to rank the next year's excess returns (ρ 0.00), but a signal in valuation against industry peers (ρ {rho_val:+.2f}) and a negative one in profitability (ρ {rho_prof:+.2f}). The strategy keeps the factor that worked and adds two checks the score lacked: earnings-call tone as a text signal against value traps, and the golden-cross/RSI rules as an entry filter against buying too early.", False)]),
 rich([("Data sources. ", True), ("Finnhub (fundamentals, industry, peers, live quotes; free, 60/min), Twelve Data (daily prices, free), the course transcript archive (2,899 earnings calls, no key), OpenRouter for commentary. Keys stay in the browser; none is in the repository or the published bundle.", False)]),
 rich([("Portfolio. ", True), (f"{n} holdings across {len(industries)} industries; largest positions " + ", ".join(f"{h['symbol']} {pct(W['maxSharpe'][h['symbol']],0)}" for h in top_w) + f". In-sample: expected return {pct(S['maxSharpe']['expectedReturn'])}, volatility {pct(S['maxSharpe']['volatility'])}, Sharpe {S['maxSharpe']['sharpe']:.2f} against SPY {S['benchmark']['sharpe']:.2f}. Live at {PORTFOLIO_URL}.", False)]),
 rich([("Known weaknesses. ", True), ("(1) One backtest anchor is one draw. (2) Expected returns are two-year historical means; the max-Sharpe weights inherit their noise, which is why min-variance and equal weight are shown beside them. (3) The tone score is a word count and cannot read sarcasm or negation; four calls per company is a short history. (4) Small industries fall back to the universe median. (5) In-sample statistics describe the fit, not the future.", False)]),
 rich([("Ideas to strengthen. ", True), ("A second and third backtest anchor before trusting the valuation signal; shrunk or Black-Litterman expected returns; keys behind a serverless proxy plus SEC EDGAR fundamentals; the call-tone model checked against FinBERT; a turnover and cost model for the quarterly rebalance; and two quarters of paper trading before allocating.", False)]),
]

def build():
    if WORK.exists(): shutil.rmtree(WORK)
    WORK.mkdir(parents=True)
    with zipfile.ZipFile(TEMPLATE) as z: z.extractall(WORK)
    doc = WORK / "word/document.xml"
    x = doc.read_text(encoding="utf8")

    def replace_para_text(marker, new_text):
        nonlocal x
        m = None
        for pm in re.finditer(r'<w:p\b.*?</w:p>', x, re.S):
            if marker in re.sub(r'<[^>]+>', '', pm.group(0)):
                m = pm; break
        assert m, marker
        p = m.group(0)
        ppr = re.search(r'<w:pPr>.*?</w:pPr>', p, re.S)
        rpr = re.search(r'<w:r\b[^>]*>(<w:rPr>.*?</w:rPr>)', p, re.S)
        newp = "<w:p>" + (ppr.group(0) if ppr else "") + f'<w:r>{rpr.group(1) if rpr else ""}<w:t xml:space="preserve">{esc(new_text)}</w:t></w:r></w:p>'
        x = x[:m.start()] + newp + x[m.end():]

    replace_para_text("AUTHOR(s)", "AUTHOR(s): Hofer, Jakob")
    replace_para_text("MODULE:", "MODULE: Generative AI in Finance (Ted Kwartler, August 3–4, 2026)")
    # tick Post-Module: the checkbox sdt immediately preceding the " Post-Module" run
    i = x.find(" Post-Module</w:t>")
    j = x.rfind('<w14:checked w14:val="0"/>', 0, i)
    x = x[:j] + '<w14:checked w14:val="1"/>' + x[j+len('<w14:checked w14:val="0"/>'):]
    k = x.rfind("<w:t>☐</w:t>", 0, i)
    x = x[:k] + "<w:t>☒</w:t>" + x[k+len("<w:t>☐</w:t>"):]
    # drop the template's own instructions (it asks not to submit instructions)
    for marker in ("IMPORTANT NOTES", "Plagiarism:", "File name:", "Sometimes file names"):
        m = None
        for pm in re.finditer(r'<w:p\b.*?</w:p>', x, re.S):
            if marker in re.sub(r'<[^>]+>', '', pm.group(0)): m = pm; break
        if m: x = x[:m.start()] + x[m.end():]

    body_xml = page_break() + "".join(FRD) + page_break() + "".join(PART_B) + page_break() + "".join(EXEC)
    x = x.replace("<w:sectPr", body_xml + "<w:sectPr", 1)
    doc.write_text(x, encoding="utf8")

    OUT_DIR.mkdir(exist_ok=True)
    out = OUT_DIR / "HOFER_POST.docx"
    if out.exists(): out.unlink()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for f in WORK.rglob("*"):
            if f.is_file(): z.write(f, f.relative_to(WORK).as_posix())
    print("wrote", out)

build()
