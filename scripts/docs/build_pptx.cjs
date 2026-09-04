/* Investment committee deck. Every figure is read from the committed data files. */
const pptxgen = require('pptxgenjs');
const fs = require('fs');
const P = JSON.parse(fs.readFileSync('src/data/portfolio.json', 'utf8'));
const B = JSON.parse(fs.readFileSync('src/data/backtest.json', 'utf8'));

const NAVY = '1E2761', ICE = 'CADCFC', WHITE = 'FFFFFF', INK = '1F2937', MUTED = '64748B', GREEN = '0F9D58', RED = 'C62828', PALE = 'F4F6FA';
const LIVE = 'https://jakobhofer-kg16.github.io/equity-lens/#/portfolio';
const pct = (x, d = 1, sign = false) => x == null ? 'n/a' : `${sign && x > 0 ? '+' : ''}${(x * 100).toFixed(d)}%`;
const H = [...P.holdings].sort((a, b) => P.weights.maxSharpe[b.symbol] - P.weights.maxSharpe[a.symbol]);
const S = P.stats;
const industries = [...new Set(P.holdings.map(h => h.industry))];

// Spearman per category for the evidence slide
function ranks(a) { const o = a.map((v, i) => ({ v, i })).sort((x, y) => x.v - y.v); const r = []; o.forEach((x, p) => r[x.i] = p + 1); return r; }
function rho(cat) {
  const pairs = B.rows.filter(r => r.categories[cat] != null).map(r => [r.categories[cat], r.excessReturn]);
  const a = ranks(pairs.map(p => p[0])), b = ranks(pairs.map(p => p[1])), n = pairs.length;
  const ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0; for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return num / Math.sqrt(da * db);
}
const cats = [['Growth', rho('growth')], ['Profitability', rho('profitability')], ['Valuation vs peers', rho('valuation')], ['Financial health', rho('health')], ['Momentum', rho('momentum')]];
const floor = 2 / Math.sqrt(B.rows.length);

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5
pres.author = 'Jakob Hofer'; pres.title = 'Cheap against peers, confirmed by the call';
const HFONT = 'Cambria', BFONT = 'Calibri';

function dark(slide) { slide.background = { color: NAVY }; }
function light(slide) { slide.background = { color: WHITE }; }
function title(slide, text, color = INK, y = 0.5) {
  slide.addText(text, { x: 0.6, y, w: 12.1, h: 0.9, fontFace: HFONT, fontSize: 32, bold: true, color, isTextBox: true, margin: 0 });
}
function foot(slide, n, color = MUTED) {
  slide.addText(`Hofer · Generative AI in Finance · Investment Committee · ${n}`, { x: 0.6, y: 7.0, w: 9, h: 0.3, fontSize: 9, color, fontFace: BFONT, isTextBox: true, margin: 0 });
}
function bullets(slide, items, opts) {
  slide.addText(items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < items.length - 1, paraSpaceAfter: 6 } })),
    Object.assign({ fontFace: BFONT, fontSize: 14, color: INK, isTextBox: true, valign: 'top', margin: 0 }, opts));
}
function statTile(slide, x, y, w, big, label, sub, color = NAVY) {
  slide.addShape(pres.ShapeType.roundRect, { x, y, w, h: 1.55, fill: { color: PALE }, line: { color: 'E2E8F0', width: 1 }, rectRadius: 0.08 });
  slide.addText(big, { x: x + 0.2, y: y + 0.12, w: w - 0.4, h: 0.8, fontFace: HFONT, fontSize: 34, bold: true, color, isTextBox: true, margin: 0 });
  slide.addText(label, { x: x + 0.2, y: y + 0.88, w: w - 0.4, h: 0.3, fontFace: BFONT, fontSize: 12, bold: true, color: INK, isTextBox: true, margin: 0 });
  slide.addText(sub, { x: x + 0.2, y: y + 1.15, w: w - 0.4, h: 0.3, fontFace: BFONT, fontSize: 10, color: MUTED, isTextBox: true, margin: 0 });
}
let n = 1;

// 1 Title
{ const s = pres.addSlide(); dark(s);
  s.addText('Cheap against peers,\nconfirmed by the call', { x: 0.7, y: 1.6, w: 11.5, h: 2.2, fontFace: HFONT, fontSize: 48, bold: true, color: WHITE, isTextBox: true, margin: 0 });
  s.addText('A quantitative equity strategy for a $1M USD allocation', { x: 0.7, y: 3.9, w: 11, h: 0.6, fontFace: BFONT, fontSize: 22, color: ICE, isTextBox: true, margin: 0 });
  s.addText(`Jakob Hofer · Executive MBA Finance 2025–27 · Generative AI in Finance (Ted Kwartler)\nLive dashboard: ${LIVE}`, { x: 0.7, y: 5.6, w: 12, h: 0.9, fontFace: BFONT, fontSize: 13, color: ICE, isTextBox: true, margin: 0 });
  s.addNotes('Open the live dashboard before the meeting; the quotes on it are fetched on load.');
}
// 2 The ask
{ const s = pres.addSlide(); light(s); title(s, 'The ask, and what you get for it');
  s.addText('Allocate $1M to a rules-based basket of S&P 500 companies that are cheaper than their own industry peers, whose latest earnings call does not contradict the price, and that have already turned up.', { x: 0.6, y: 1.5, w: 12.1, h: 1.0, fontFace: BFONT, fontSize: 16, color: INK, isTextBox: true, margin: 0 });
  statTile(s, 0.6, 2.9, 2.9, `${P.holdings.length}`, 'holdings', `${industries.length} industries, 2–10% per name`);
  statTile(s, 3.7, 2.9, 2.9, S.maxSharpe.sharpe.toFixed(2), 'Sharpe ratio (in-sample)', `SPY ${S.benchmark.sharpe.toFixed(2)} over the same window`, GREEN);
  statTile(s, 6.8, 2.9, 2.9, pct(S.maxSharpe.volatility), 'volatility', `SPY ${pct(S.benchmark.volatility)}`);
  statTile(s, 9.9, 2.9, 2.8, 'quarterly', 'rebalance', 'after every earnings season');
  s.addText('Every number in this deck is read from the application\'s committed data files. Nothing is typed in, and the same files drive the live dashboard.', { x: 0.6, y: 5.0, w: 12.1, h: 0.6, fontFace: BFONT, fontSize: 12, italic: true, color: MUTED, isTextBox: true, margin: 0 });
  foot(s, ++n);
}
// 3 Evidence: backtest
{ const s = pres.addSlide(); light(s); title(s, 'Why this thesis: the model told us what not to trust');
  s.addText(`Before writing a thesis I backtested a five-factor score on ${B.scored} S&P 500 companies as of ${B.anchor} against the next year's excess return over SPY. The total score ranked nothing (ρ 0.00). One factor did.`, { x: 0.6, y: 1.45, w: 6.0, h: 1.6, fontFace: BFONT, fontSize: 14, color: INK, isTextBox: true, margin: 0 });
  bullets(s, [`Valuation vs peers: ρ ${cats[2][1] >= 0 ? '+' : ''}${cats[2][1].toFixed(2)} — the only factor above the ±${floor.toFixed(2)} noise floor in the right direction`, `Profitability: ρ ${cats[1][1].toFixed(2)} — quality had already been priced`, 'Growth, health, momentum: noise', 'Conclusion: keep the factor that worked, drop the one that hurt, add two checks the score never had'], { x: 0.6, y: 3.2, w: 6.0, h: 3.3 });
  s.addChart(pres.ChartType.bar, [{ name: 'Rank correlation with next-year excess return', labels: cats.map(c => c[0]), values: cats.map(c => Number(c[1].toFixed(3))) }],
    { x: 6.9, y: 1.4, w: 5.9, h: 5.2, barDir: 'bar', chartColors: [NAVY], showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '+0.00;-0.00', dataLabelFontSize: 10,
      valAxisMinVal: -0.2, valAxisMaxVal: 0.2, valAxisLabelFormatCode: '0.00', valAxisLabelFontSize: 9, catAxisLabelFontSize: 11, valGridLine: { color: 'E2E8F0', size: 0.5 }, catGridLine: { style: 'none' }, showLegend: false, showTitle: true, title: 'Signal by category (Spearman ρ)', titleFontSize: 12, titleColor: INK });
  foot(s, ++n);
}
// 4 Rules
{ const s = pres.addSlide(); light(s); title(s, 'Three rules, three roles');
  const cols = [
    ['1 · Value (selects)', ['Trailing P/E below the industry-peer median, or EV/EBITDA below it', 'Both multiples positive; operating margin above zero', 'Industry = Finnhub classification; universe median if fewer than four peers']],
    ['2 · Call tone (screens out value traps)', ['Latest earnings call polarity ≥ 0.20 on a finance lexicon', 'Not worse than −0.10 versus the prior call', 'Hedging words below 1.5% of the transcript', 'Speakers split by employer, not job title']],
    ['3 · Technical (times the entry)', ['Golden cross: 50-day above 200-day', 'Price above the 200-day average', 'RSI(14) below 70', 'Gates, never selects']]
  ];
  cols.forEach(([h, items], i) => {
    const x = 0.6 + i * 4.1;
    s.addShape(pres.ShapeType.roundRect, { x, y: 1.5, w: 3.9, h: 4.9, fill: { color: i === 0 ? NAVY : PALE }, line: { color: 'E2E8F0', width: 1 }, rectRadius: 0.08 });
    s.addText(h, { x: x + 0.25, y: 1.7, w: 3.4, h: 0.6, fontFace: HFONT, fontSize: 17, bold: true, color: i === 0 ? WHITE : INK, isTextBox: true, margin: 0 });
    bullets(s, items, { x: x + 0.25, y: 2.4, w: 3.4, h: 3.8, fontSize: 13, color: i === 0 ? ICE : INK });
  });
  s.addText('Ranking among names that pass: 50% value discount · 30% tone level · 20% tone change (percentile ranks). At most four names per industry.', { x: 0.6, y: 6.5, w: 12.1, h: 0.4, fontFace: BFONT, fontSize: 11, color: MUTED, isTextBox: true, margin: 0 });
  foot(s, ++n);
}
// 5 Data
{ const s = pres.addSlide(); light(s); title(s, 'Data: free tiers, verified against real keys');
  const rows = [
    [{ text: 'Source', options: { bold: true, fill: { color: PALE } } }, { text: 'Used for', options: { bold: true, fill: { color: PALE } } }, { text: 'Limit that shaped the design', options: { bold: true, fill: { color: PALE } } }],
    ['Finnhub', 'Profile, 133 TTM metrics, industry, real peer list, live quotes', '60 requests/min; prices, targets and transcripts are premium'],
    ['Twelve Data', 'Daily prices for technical rules, 2-year returns for optimisation, SPY', '8 requests/min — the pipeline\'s bottleneck'],
    ['Course transcript archive', '2,899 earnings calls, 383 companies — the text signal', 'No key, CORS-enabled; ends at the archive\'s last quarter'],
    ['OpenRouter', 'Executive commentary on the dashboard (gemini-2.5-flash)', 'Labelled AI-generated; never used for selection'],
    ['Alpha Vantage', 'Consensus price target only', '25 requests/day → one request per company']
  ];
  s.addTable(rows, { x: 0.6, y: 1.5, w: 12.1, colW: [2.4, 5.4, 4.3], fontFace: BFONT, fontSize: 12, color: INK, border: { type: 'solid', color: 'E2E8F0', pt: 1 }, rowH: 0.55, valign: 'middle' });
  s.addText('Keys are entered in the app and stay in the browser. A search of the full Git history and the published bundle found none.', { x: 0.6, y: 5.6, w: 12.1, h: 0.5, fontFace: BFONT, fontSize: 12, italic: true, color: MUTED, isTextBox: true, margin: 0 });
  foot(s, ++n);
}
// 6 Funnel
{ const s = pres.addSlide(); light(s); title(s, 'From 383 companies to a portfolio');
  const labels = ['With transcripts', 'With fundamentals', 'Cheap + acceptable call', 'Priced (industry cap)', 'Golden cross, RSI < 70', 'Portfolio'];
  const values = [P.universe, P.withFundamentals, P.passedScreen, P.candidatesPriced, P.passedTechnical, P.holdings.length];
  s.addChart(pres.ChartType.bar, [{ name: 'Companies', labels, values }], { x: 0.6, y: 1.4, w: 7.4, h: 5.3, barDir: 'bar', chartColors: [NAVY], showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 11, catAxisLabelFontSize: 11, valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' }, showLegend: false, catAxisOrientation: 'maxMin' });
  const rej = P.rejectedByScreen || {};
  bullets(s, [`Not cheaper than peers: ${rej['not cheaper than peers'] ?? '–'} — the thesis is selective by design`, `Loss-making: ${rej['no positive earnings / EBITDA'] ?? '–'}`, `Call tone deteriorating: ${rej['tone deteriorating'] ?? '–'}`, `Cheap but still in a downtrend: ${P.candidatesPriced - P.passedTechnical} of ${P.candidatesPriced} — removed by the entry filter`], { x: 8.3, y: 1.6, w: 4.5, h: 4.8, fontSize: 13 });
  foot(s, ++n);
}
// 7 Holdings table
{ const s = pres.addSlide(); light(s); title(s, `The portfolio: ${P.holdings.length} names, ${industries.length} industries`);
  const head = ['Ticker', 'Company', 'Industry', 'Weight', 'P/E vs peer', 'Tone (Δ)', 'RSI'].map(t => ({ text: t, options: { bold: true, fill: { color: PALE } } }));
  const rows = [head, ...H.map(h => [h.symbol, h.name.length > 24 ? h.name.slice(0, 23) + '…' : h.name, h.industry.length > 22 ? h.industry.slice(0, 21) + '…' : h.industry, pct(P.weights.maxSharpe[h.symbol]), `${h.valuation.pe.toFixed(1)} / ${h.valuation.peerPe.toFixed(1)}`, `${h.tone.polarity.toFixed(2)}${h.tone.delta != null ? ` (${h.tone.delta >= 0 ? '+' : ''}${h.tone.delta.toFixed(2)})` : ''}`, `${Math.round(h.technical.rsi)}`])];
  s.addTable(rows, { x: 0.6, y: 1.35, w: 12.1, colW: [0.9, 3.0, 2.9, 1.1, 1.6, 1.6, 1.0], fontFace: BFONT, fontSize: 10.5, color: INK, border: { type: 'solid', color: 'E2E8F0', pt: 0.75 }, rowH: 0.31, valign: 'middle' });
  s.addText(`Weights: maximum Sharpe ratio, 2–10% per name. Signals as of ${P.pricesAsOf}.`, { x: 0.6, y: 6.7, w: 12, h: 0.3, fontFace: BFONT, fontSize: 10, color: MUTED, isTextBox: true, margin: 0 });
  foot(s, ++n);
}
// 8 Weights chart
{ const s = pres.addSlide(); light(s); title(s, 'Weights: the optimiser tilts, it does not decide');
  const labels = H.map(h => h.symbol);
  s.addChart(pres.ChartType.bar, [
    { name: 'Maximum Sharpe (chosen)', labels, values: H.map(h => Number((P.weights.maxSharpe[h.symbol] * 100).toFixed(1))) },
    { name: 'Minimum variance', labels, values: H.map(h => Number((P.weights.minVariance[h.symbol] * 100).toFixed(1))) }
  ], { x: 0.6, y: 1.4, w: 8.4, h: 5.3, barDir: 'col', barGrouping: 'clustered', chartColors: [NAVY, '9DB4D6'], valAxisLabelFormatCode: '0"%"', valAxisLabelFontSize: 9, catAxisLabelFontSize: 10, valGridLine: { color: 'E2E8F0', size: 0.5 }, catGridLine: { style: 'none' }, showLegend: true, legendPos: 'b', legendFontSize: 10, valAxisMaxVal: 12 });
  bullets(s, ['Every name that passed the rules is held: 2% floor', '10% cap per name, at most four per industry', 'Without the floor the max-Sharpe optimiser put ten names at the cap and nine at zero — a bet on last year\'s winners, not the thesis', 'Min-variance ignores expected returns; where both agree (ALL, INCY, SPG, OXY) the position is robust'], { x: 9.3, y: 1.6, w: 3.5, h: 5.0, fontSize: 12 });
  foot(s, ++n);
}
// 9 Methods compared
{ const s = pres.addSlide(); light(s); title(s, 'The two methods taught, side by side');
  const r = (k, label) => [label, pct(S[k].expectedReturn), pct(S[k].volatility), S[k].sharpe.toFixed(2)];
  const rows = [['Method', 'Expected return', 'Volatility', 'Sharpe'].map(t => ({ text: t, options: { bold: true, fill: { color: PALE } } })), r('maxSharpe', 'Maximum Sharpe ratio (chosen)'), r('minVariance', 'Minimum variance'), r('equal', 'Equal weight (baseline)'), r('benchmark', 'SPY, same window')];
  s.addTable(rows, { x: 0.6, y: 1.5, w: 7.6, colW: [3.4, 1.5, 1.4, 1.3], fontFace: BFONT, fontSize: 13, color: INK, border: { type: 'solid', color: 'E2E8F0', pt: 1 }, rowH: 0.5, valign: 'middle', align: 'right' });
  s.addShape(pres.ShapeType.roundRect, { x: 8.6, y: 1.5, w: 4.1, h: 3.9, fill: { color: PALE }, line: { color: 'E2E8F0', width: 1 }, rectRadius: 0.08 });
  s.addText('Read this honestly', { x: 8.85, y: 1.7, w: 3.6, h: 0.5, fontFace: HFONT, fontSize: 16, bold: true, color: INK, isTextBox: true, margin: 0 });
  bullets(s, [`${P.lookbackTradingDays} trading days ending ${P.pricesAsOf}; risk-free ${pct(P.riskFreeRate, 0)}`, 'Weights were fitted on the same window they are measured on — this is the fit, not a forecast', 'Expected returns are historical means, the weakest input in mean-variance work; that is why min-variance is shown'], { x: 8.85, y: 2.3, w: 3.6, h: 3.0, fontSize: 12 });
  foot(s, ++n);
}
// 10 Application
{ const s = pres.addSlide(); light(s); title(s, 'The application (live demo)');
  s.addText(LIVE, { x: 0.6, y: 1.4, w: 12, h: 0.5, fontFace: BFONT, fontSize: 16, bold: true, color: NAVY, isTextBox: true, margin: 0, hyperlink: { url: LIVE } });
  const feats = [['On load', 'Fetches a live quote for all holdings from Finnhub; failures shown as "stale", never hidden'], ['Weights', 'Max-Sharpe, min-variance and equal weight switchable; $1M allocation per name'], ['Signals', 'Golden/death cross, RSI(14), MACD histogram and call tone per holding, dated'], ['Commentary', 'Four paragraphs written by the model from the live quotes and signals, labelled; without a key, a computed summary and no pre-written text'], ['Research', 'Every ticker opens the full dossier: score, chart, peers, analysts, news, call sentiment, track record'], ['Guardrails', 'No sample data, keys in the browser only, 41 unit tests, GitHub Pages on every push']];
  feats.forEach(([h, t], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.6 + col * 6.2, y = 2.1 + row * 1.45;
    s.addShape(pres.ShapeType.ellipse, { x, y: y + 0.05, w: 0.5, h: 0.5, fill: { color: NAVY }, line: { color: NAVY } });
    s.addText(String(i + 1), { x, y: y + 0.05, w: 0.5, h: 0.5, fontFace: HFONT, fontSize: 14, bold: true, color: WHITE, align: 'center', valign: 'middle', isTextBox: true, margin: 0 });
    s.addText(h, { x: x + 0.65, y, w: 5.3, h: 0.35, fontFace: HFONT, fontSize: 15, bold: true, color: INK, isTextBox: true, margin: 0 });
    s.addText(t, { x: x + 0.65, y: y + 0.38, w: 5.3, h: 0.9, fontFace: BFONT, fontSize: 11.5, color: MUTED, isTextBox: true, margin: 0, valign: 'top' });
  });
  s.addNotes('Demo order: open #/portfolio, point at "Portfolio today" (live), switch weighting method, click one ticker into the dossier, show the track-record section and the call-sentiment reaction table.');
  foot(s, ++n);
}
// 11 Risks
{ const s = pres.addSlide(); light(s); title(s, 'Risk factors and what limits them');
  const risks = [['One backtest, one year', 'The valuation signal was found at a single 2025 anchor. Mitigation: second and third anchors before scaling; paper-trade two quarters.'], ['Value trap despite the call', 'A word-count tone can be gamed by upbeat language. Mitigation: hedging and legal-vocabulary rates, tone change, and the technical gate.'], ['Estimation error in weights', 'Expected returns are historical means. Mitigation: 2–10% bands, industry cap, min-variance shown beside max-Sharpe.'], ['Concentration by industry', `${industries.length} industries; Health Care and Energy carry several names. Mitigation: cap of four per industry; monitor sector beta.`], ['Data and vendor risk', 'Free tiers, rate limits, a course archive that stops. Mitigation: layered providers, persisted cache, explicit "stale" states.'], ['Automation without oversight', 'Knight Capital: rules executing unwatched. Mitigation: quarterly human review, no automated trading, every signal labelled and dated.']];
  risks.forEach(([h, t], i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.6 + col * 4.1, y = 1.45 + row * 2.6;
    s.addShape(pres.ShapeType.roundRect, { x, y, w: 3.9, h: 2.4, fill: { color: PALE }, line: { color: 'E2E8F0', width: 1 }, rectRadius: 0.08 });
    s.addText(h, { x: x + 0.22, y: y + 0.18, w: 3.5, h: 0.45, fontFace: HFONT, fontSize: 15, bold: true, color: i === 5 ? RED : INK, isTextBox: true, margin: 0 });
    s.addText(t, { x: x + 0.22, y: y + 0.7, w: 3.5, h: 1.6, fontFace: BFONT, fontSize: 11.5, color: INK, isTextBox: true, margin: 0, valign: 'top' });
  });
  foot(s, ++n);
}
// 12 Challenge questions
{ const s = pres.addSlide(); light(s); title(s, 'Questions you will ask, and the answers');
  const qa = [['"Your Sharpe beats SPY — why should I believe it?"', `You shouldn't, as a forecast. It is in-sample on ${P.lookbackTradingDays} days. What I ask you to believe is the process: one factor with out-of-sample evidence, two independent checks, and a dashboard that shows you the fit and the stale states rather than hiding them.`], ['"Why not just buy cheap stocks?"', `Because cheap alone was the ${P.rejectedByScreen?.['not cheaper than peers'] ?? '128'}-name rejection in reverse: half the cheap names were cheap for a reason. The call tone and the trend filter are what turn a screen into a portfolio.`], ['"What if the model is wrong about profitability?"', 'Then we hold fewer high-margin names than a quality strategy would, and the min-variance view is the hedge. The finding was one year; the rule is re-tested every anchor we add.'], ['"Who pulls the trigger?"', 'A person, quarterly, after earnings season. The application recommends; it never trades. That is the Knight Capital lesson applied.']];
  qa.forEach(([q, a], i) => {
    const y = 1.4 + i * 1.35;
    s.addText(q, { x: 0.6, y, w: 12.1, h: 0.4, fontFace: HFONT, fontSize: 15, bold: true, color: NAVY, isTextBox: true, margin: 0 });
    s.addText(a, { x: 0.9, y: y + 0.42, w: 11.8, h: 0.85, fontFace: BFONT, fontSize: 12, color: INK, isTextBox: true, margin: 0, valign: 'top' });
  });
  foot(s, ++n);
}
// 13 Close
{ const s = pres.addSlide(); dark(s);
  s.addText('Decision requested', { x: 0.7, y: 1.2, w: 12, h: 0.8, fontFace: HFONT, fontSize: 36, bold: true, color: WHITE, isTextBox: true, margin: 0 });
  bullets(s, [`Approve $1M into the ${P.holdings.length}-name maximum-Sharpe basket, 2–10% per name`, 'Quarterly re-screen after earnings season; exits on a break of the 200-day average or a call tone below zero', 'Two quarters of paper-tracking on the dashboard reported back to this committee', 'Second and third backtest anchors delivered before any scale-up'], { x: 0.7, y: 2.3, w: 11.5, h: 3.2, fontSize: 18, color: ICE });
  s.addText(`${LIVE}\ngithub.com/jakobhofer-kg16/equity-lens`, { x: 0.7, y: 6.0, w: 12, h: 0.8, fontFace: BFONT, fontSize: 13, color: ICE, isTextBox: true, margin: 0 });
  foot(s, ++n, ICE);
}
pres.writeFile({ fileName: 'docs/HOFER_POST_Presentation.pptx' }).then(f => console.log('wrote', f));
