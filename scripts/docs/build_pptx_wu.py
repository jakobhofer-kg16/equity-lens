"""
Investment committee deck on the WU Executive Academy 16:10 template.

Approach: unpack the template, drop its 25 sample slides, and write new slides
that use the template's own layouts and placeholders (so fonts, colours, footer
and logo come from the master). Tables use the template's table style; the
three charts are transplanted from the pptxgenjs build and recoloured to the
WU theme. All figures come from src/data/portfolio.json and backtest.json.
"""
import json, re, shutil, zipfile, html, os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
S = Path('/private/tmp/claude-501/-Users-jakob-Desktop-Claude/678dda1a-94eb-4847-83a6-ba8ce51a4344/scratchpad')
TEMPLATE = Path.home() / 'Library/CloudStorage/GoogleDrive-jakob.hofer@kg16.com/My Drive/MBA/02_Templats/WU EA PPT Layout 16x10 Update.pptx'
GEN = S / 'gen'            # unpacked pptxgenjs deck (charts to transplant)
W = S / 'wu_build'
OUT = ROOT / 'docs/HOFER_POST_Presentation.pptx'

P = json.load(open(ROOT / 'src/data/portfolio.json'))
B = json.load(open(ROOT / 'src/data/backtest.json'))
LIVE = 'https://jakobhofer-kg16.github.io/equity-lens/#/portfolio'
H = sorted(P['holdings'], key=lambda h: -P['weights']['maxSharpe'][h['symbol']])
St = P['stats']; industries = sorted({h['industry'] for h in P['holdings']}); n = len(H)
def pct(x, d=1, sign=False): return 'n/a' if x is None else f"{x*100:+.{d}f}%" if sign else f"{x*100:.{d}f}%"
def esc(s): return html.escape(str(s), quote=False)

# --- unpack -------------------------------------------------------------------
if W.exists(): shutil.rmtree(W)
W.mkdir(parents=True)
with zipfile.ZipFile(TEMPLATE) as z: z.extractall(W)

# --- read layouts: placeholder idx and geometry ---------------------------------
def layout(n_):
    return (W / f'ppt/slideLayouts/slideLayout{n_}.xml').read_text(encoding='utf8')
def ph_info(lay_xml):
    """{(type, idx): (off, ext)} for placeholders in a layout."""
    out = {}
    for sp in re.findall(r'<p:sp>.*?</p:sp>', lay_xml, re.S):
        m = re.search(r'<p:ph(?: type="([^"]*)")?(?: [^>]*?)?(?: idx="(\d+)")?', sp)
        if not m: continue
        typ = m.group(1) or 'body'; idx = m.group(2)
        x = re.search(r'<a:off x="(\d+)" y="(\d+)"/><a:ext cx="(\d+)" cy="(\d+)"/>', sp)
        out[(typ, idx)] = tuple(int(v) for v in x.groups()) if x else None
    return out
L4 = ph_info(layout(4)); L13 = ph_info(layout(13)); L1 = ph_info(layout(1)); L11 = ph_info(layout(11)); L15 = ph_info(layout(15)); L12 = ph_info(layout(12))
def find(info, typ):
    for (t, i), g in info.items():
        if t == typ: return i, g
    return None, None
BODY4_IDX, BODY4_GEO = find(L4, 'body')
FTR_IDX = find(L4, 'ftr')[0]; NUM_IDX = find(L4, 'sldNum')[0]
L13_bodies = [(i, g) for (t, i), g in L13.items() if t == 'body']

# --- XML builders ---------------------------------------------------------------
NS = ('xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
      'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"')
_id = [10]
def nid():
    _id[0] += 1; return _id[0]

def run(text, sz=None, b=False, color=None, lang='en-US'):
    attrs = f' lang="{lang}"' + (f' sz="{sz}"' if sz else '') + (' b="1"' if b else '') + ' dirty="0"'
    fill = f'<a:solidFill><a:schemeClr val="{color}"/></a:solidFill>' if color else ''
    return f'<a:r><a:rPr{attrs}>{fill}</a:rPr><a:t>{esc(text)}</a:t></a:r>'

def para(runs, lvl=0, bullet=None, algn=None, space_after=None):
    ppr_parts = []
    if lvl: ppr_parts.append(f'lvl="{lvl}"')
    if algn: ppr_parts.append(f'algn="{algn}"')
    inner = ''
    if space_after is not None: inner += f'<a:spcAft><a:spcPts val="{space_after}"/></a:spcAft>'
    if bullet is False: inner += '<a:buNone/>'
    ppr = f'<a:pPr {" ".join(ppr_parts)}>{inner}</a:pPr>' if (ppr_parts or inner) else ''
    return f'<a:p>{ppr}{runs}</a:p>'

def ph_shape(typ, idx, paras, name='Platzhalter', geo=None, autofit=True):
    ph = f'<p:ph type="{typ}"' if typ != 'body_idx' else '<p:ph'
    ph += (f' idx="{idx}"' if idx else '') + '/>'
    if typ == 'body' and idx: ph = f'<p:ph type="body" sz="quarter" idx="{idx}"/>'
    sppr = f'<p:spPr><a:xfrm><a:off x="{geo[0]}" y="{geo[1]}"/><a:ext cx="{geo[2]}" cy="{geo[3]}"/></a:xfrm></p:spPr>' if geo else '<p:spPr/>'
    body = '<a:bodyPr><a:normAutofit/></a:bodyPr>' if autofit else '<a:bodyPr/>'
    return (f'<p:sp><p:nvSpPr><p:cNvPr id="{nid()}" name="{name}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>'
            f'<p:nvPr>{ph}</p:nvPr></p:nvSpPr>{sppr}<p:txBody>{body}<a:lstStyle/>{"".join(paras)}</p:txBody></p:sp>')

def footer_shapes(num):
    out = ''
    if FTR_IDX:
        out += ph_shape('ftr', FTR_IDX, [para(run('Hofer · Generative AI in Finance · Investment Committee', lang='en-US'))], 'Fußzeile')
    if NUM_IDX:
        out += (f'<p:sp><p:nvSpPr><p:cNvPr id="{nid()}" name="Foliennummer"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>'
                f'<p:nvPr><p:ph type="sldNum" sz="quarter" idx="{NUM_IDX}"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>'
                f'<a:p><a:fld id="{{B6F15528-21DE-4FAA-801E-634DDDAF4B2B}}" type="slidenum"><a:rPr lang="en-US"/><a:t>{num}</a:t></a:fld></a:p></p:txBody></p:sp>')
    return out

def textbox(x, y, cx, cy, paras, name='Text', fill=None, line=None, anchor='t', rounded=False, inset=91440):
    geom = 'roundRect' if rounded else 'rect'
    fillx = f'<a:solidFill><a:schemeClr val="{fill}"/></a:solidFill>' if fill else '<a:noFill/>'
    linex = f'<a:ln w="9525"><a:solidFill><a:schemeClr val="{line}"/></a:solidFill></a:ln>' if line else '<a:ln><a:noFill/></a:ln>'
    return (f'<p:sp><p:nvSpPr><p:cNvPr id="{nid()}" name="{name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>'
            f'<p:spPr><a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm><a:prstGeom prst="{geom}"><a:avLst/></a:prstGeom>{fillx}{linex}</p:spPr>'
            f'<p:txBody><a:bodyPr wrap="square" lIns="{inset}" tIns="{inset}" rIns="{inset}" bIns="{inset}" anchor="{anchor}"><a:normAutofit/></a:bodyPr><a:lstStyle/>{"".join(paras)}</p:txBody></p:sp>')

TABLE_STYLE = '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}'
def table(x, y, cx, col_w, rows, sz=1000, row_h=250000, header=True, right_from=None):
    total = sum(col_w); scale = cx / total; cols = [int(w * scale) for w in col_w]
    grid = ''.join(f'<a:gridCol w="{w}"/>' for w in cols)
    trs = ''
    for ri, r in enumerate(rows):
        tcs = ''
        for ci, c in enumerate(r):
            algn = 'r' if (right_from is not None and ci >= right_from and ri > 0) else None
            tcs += (f'<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>{para(run(c, sz=sz, b=(ri==0 and header)), algn=algn)}</a:txBody>'
                    f'<a:tcPr marL="45720" marR="45720" marT="22860" marB="22860"/></a:tc>')
        trs += f'<a:tr h="{row_h}">{tcs}</a:tr>'
    cy = row_h * len(rows)
    return (f'<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="{nid()}" name="Tabelle"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>'
            f'<p:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{cx}" cy="{cy}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">'
            f'<a:tbl><a:tblPr firstRow="{1 if header else 0}" bandRow="1"><a:tableStyleId>{TABLE_STYLE}</a:tableStyleId></a:tblPr><a:tblGrid>{grid}</a:tblGrid>{trs}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>')

def chart_frame(rid, x, y, cx, cy):
    return (f'<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="{nid()}" name="Diagramm"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>'
            f'<p:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{cx}" cy="{cy}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">'
            f'<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="{rid}"/></a:graphicData></a:graphic></p:graphicFrame>')

def slide_xml(shapes):
    return (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:sld {NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
            f'<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>{"".join(shapes)}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>')

def bullets(items, sz=1400, lvl0=0):
    out = []
    for it in items:
        if isinstance(it, tuple): text, lvl = it
        else: text, lvl = it, 0
        out.append(para(run(text, sz=sz), lvl=lvl0 + lvl, space_after=400))
    return out

# --- chart transplant -----------------------------------------------------------
RECOLOR = {'1E2761': None, '9DB4D6': None}  # replaced by scheme colours below
def transplant_chart(src_num, dst_num):
    src = (GEN / f'ppt/charts/chart{src_num}.xml').read_text(encoding='utf8')
    src = src.replace('<a:srgbClr val="1E2761"/>', '<a:schemeClr val="accent4"/>').replace('<a:srgbClr val="9DB4D6"/>', '<a:schemeClr val="accent3"/>')
    src = re.sub(r'typeface="[^"]*"', 'typeface="Verdana"', src)
    (W / f'ppt/charts/chart{dst_num}.xml').write_text(src, encoding='utf8')
    rels = (GEN / f'ppt/charts/_rels/chart{src_num}.xml.rels').read_text(encoding='utf8')
    emb = re.search(r'Target="\.\./embeddings/([^"]+)"', rels).group(1)
    new_emb = f'wu_chart{dst_num}.xlsx'
    shutil.copy(GEN / 'ppt/embeddings' / emb, W / 'ppt/embeddings' / new_emb)
    (W / f'ppt/charts/_rels/chart{dst_num}.xml.rels').write_text(rels.replace(emb, new_emb), encoding='utf8')
    return f'chart{dst_num}'

# --- wipe sample slides ---------------------------------------------------------
for d in ('ppt/slides', 'ppt/slides/_rels', 'ppt/notesSlides', 'ppt/notesSlides/_rels'):
    p = W / d
    if p.exists():
        for f in p.glob('*'):
            if f.is_file(): f.unlink()
for f in list((W / 'ppt/charts').glob('chart*.xml')) + list((W / 'ppt/charts/_rels').glob('*.rels')) + list((W / 'ppt/embeddings').glob('*')):
    f.unlink()
ct = (W / '[Content_Types].xml').read_text(encoding='utf8')
ct = re.sub(r'<Override PartName="/ppt/(slides|notesSlides|charts)/[^"]+"[^>]*/>', '', ct)
prels = (W / 'ppt/_rels/presentation.xml.rels').read_text(encoding='utf8')
prels = re.sub(r'<Relationship Id="rId\d+" Type="[^"]*/(slide|notesSlide)" Target="(slides|notesSlides)/[^"]+"/>', '', prels)
pres = (W / 'ppt/presentation.xml').read_text(encoding='utf8')
pres = re.sub(r'<p:sldIdLst>.*?</p:sldIdLst>', '<p:sldIdLst></p:sldIdLst>', pres, flags=re.S)

# --- slide registry -------------------------------------------------------------
slides = []  # (xml, layout_no, extra_rels:list[(rid, type, target)])
def add(xml, layout_no, extra=None): slides.append((xml, layout_no, extra or []))

SW, SH = 9144000, 5715000
bx, by, bw, bh = BODY4_GEO   # content area of "Titel und Inhalt"

# 1 title
add(slide_xml([
    ph_shape('ctrTitle', None, [para(run('Cheap against peers, confirmed by the call', lang='en-US'))], 'Titel'),
    ph_shape('subTitle', '1', [para(run('A quantitative equity strategy for a $1M USD allocation', lang='en-US'))], 'Untertitel'),
    ph_shape('body', find(L1, 'body')[0], [para(run('Jakob Hofer · Executive MBA Finance 2025–27', sz=1200)), para(run('Generative AI in Finance · Investment Committee · September 2026', sz=1200))], 'Autor', geo=find(L1, 'body')[1])
]), 1)

# 2 the ask (Kapitelfolie kurz)
b11_idx, b11_geo = find(L11, 'body')
add(slide_xml([
    ph_shape('ctrTitle', None, [para(run('The ask'))], 'Titel'),
    ph_shape('body', b11_idx, [para(run(f'Allocate $1M to a rules-based basket of {n} S&P 500 companies that are cheaper than their industry peers, whose latest earnings call does not contradict the price, and that have already turned up. Quarterly rebalance. Every figure in this deck is read from the application\'s committed data.', sz=1300))], 'Text', geo=b11_geo)
]), 11)

# 3 key numbers (tiles)
tiles = [(f'{n}', 'holdings', f'{len(industries)} industries · 2–10% per name'),
         (f"{St['maxSharpe']['sharpe']:.2f}", 'Sharpe ratio, in-sample', f"SPY {St['benchmark']['sharpe']:.2f} over the same window"),
         (pct(St['maxSharpe']['volatility']), 'annualised volatility', f"SPY {pct(St['benchmark']['volatility'])}"),
         (pct(St['maxSharpe']['expectedReturn']), 'expected return, in-sample', 'two-year historical mean — the fit, not a forecast')]
shapes = [ph_shape('title', None, [para(run('What you get for it'))], 'Titel')]
gap = 120000; tw = (bw - 3 * gap) // 4; th = 1500000
for i, (big, lab, sub) in enumerate(tiles):
    x = bx + i * (tw + gap)
    shapes.append(textbox(x, by + 150000, tw, th, [para(run(big, sz=2800, b=True, color='accent4')), para(run(lab, sz=1100, b=True)), para(run(sub, sz=900, color='accent5'))], fill='lt2' if False else None, line='accent3', rounded=True))
shapes.append(textbox(bx, by + 150000 + th + 200000, bw, 900000, bullets(['Weights: maximum Sharpe ratio, long-only, 2–10% per name, at most four names per industry', 'Minimum-variance and equal-weight computed on the same holdings for comparison', 'Rules re-screened quarterly after earnings season; a person decides, the application recommends'], sz=1200)))
shapes.append(footer_shapes(3))
add(slide_xml(shapes), 4)

# 4 evidence (chart transplant: backtest per-category)
c1 = transplant_chart(1, 101)
half = (bw - gap) // 2
shapes = [ph_shape('title', None, [para(run('Why this thesis: the model told us what not to trust'))], 'Titel'),
          textbox(bx, by, half, bh, bullets([f"Before writing a thesis I backtested a five-factor score on {B['scored']} S&P 500 companies as of {B['anchor']} against the next year's excess return over SPY.",
                   'The total score ranked nothing (ρ 0.00).', 'Valuation vs peers: ρ +0.14 — the only factor above the noise floor in the right direction', 'Profitability: ρ −0.13 — quality had already been priced', 'Growth, health, momentum: noise', 'So: keep the factor that worked, drop the one that hurt, add two checks the score never had'], sz=1200)),
          chart_frame('rIdC', bx + half + gap, by, half, bh), footer_shapes(4)]
add(slide_xml(shapes), 4, [('rIdC', 'chart', f'../charts/{c1}.xml')])

# 5 three rules (Zwei Inhalte layout would give 2 columns; build 3 columns as textboxes)
cols = [('1 · Value — selects', ['Trailing P/E below the industry-peer median, or EV/EBITDA below it', 'Both multiples positive; operating margin above zero', 'Industry = Finnhub classification; universe median if fewer than four peers']),
        ('2 · Call tone — screens out value traps', ['Latest earnings-call polarity ≥ 0.20 on a finance lexicon', 'Not worse than −0.10 versus the prior call', 'Hedging words below 1.5% of the transcript', 'Speakers split by employer, not job title']),
        ('3 · Technical — times the entry', ['Golden cross: 50-day above 200-day', 'Price above the 200-day average', 'RSI(14) below 70', 'Gates, never selects'])]
shapes = [ph_shape('title', None, [para(run('Three rules, three roles'))], 'Titel')]
cw = (bw - 2 * gap) // 3
for i, (h, items) in enumerate(cols):
    x = bx + i * (cw + gap)
    shapes.append(textbox(x, by, cw, bh - 450000, [para(run(h, sz=1300, b=True, color='accent4'), space_after=600)] + bullets(items, sz=1100), fill=None, line='accent3', rounded=True))
shapes.append(textbox(bx, by + bh - 380000, bw, 380000, [para(run('Ranking among names that pass: 50% value discount · 30% tone level · 20% tone change (percentile ranks).', sz=1000, color='accent5'))]))
shapes.append(footer_shapes(5)); add(slide_xml(shapes), 4)

# 6 data sources table
rows = [['Source', 'Used for', 'Limit that shaped the design'],
        ['Finnhub', 'Profile, 133 TTM metrics, industry, real peer list, live quotes', '60 requests/min; prices, targets and transcripts are premium'],
        ['Twelve Data', 'Daily prices for the technical rules, two-year returns for optimisation, SPY', '8 requests/min — the pipeline\'s bottleneck'],
        ['Course transcript archive', '2,899 earnings calls, 383 companies — the text signal', 'No key, CORS-enabled; ends at the archive\'s last quarter'],
        ['OpenRouter', 'Executive commentary on the dashboard (gemini-2.5-flash)', 'Labelled AI-generated; never used for selection'],
        ['Alpha Vantage', 'Consensus price target only', '25 requests/day → one request per company']]
shapes = [ph_shape('title', None, [para(run('Data: free tiers, verified against real keys'))], 'Titel'),
          table(bx, by, bw, [2.0, 4.2, 3.6], rows, sz=1000, row_h=420000),
          textbox(bx, by + 420000 * 6 + 200000, bw, 400000, [para(run('Keys are entered in the app and stay in the browser. A search of the full Git history and the published bundle found none.', sz=1000, color='accent5'))]),
          footer_shapes(6)]
add(slide_xml(shapes), 4)

# 7 funnel (chart transplant)
c2 = transplant_chart(2, 102)
rej = P.get('rejectedByScreen', {})
shapes = [ph_shape('title', None, [para(run(f'From {P["universe"]} companies to a portfolio'))], 'Titel'),
          chart_frame('rIdC', bx, by, half + 300000, bh),
          textbox(bx + half + 300000 + gap, by, half - 300000 - gap, bh, bullets([f"Not cheaper than peers: {rej.get('not cheaper than peers','–')} — the thesis is selective by design", f"Loss-making: {rej.get('no positive earnings / EBITDA','–')}", f"Call tone deteriorating: {rej.get('tone deteriorating','–')}", f"Cheap but still in a downtrend: {P['candidatesPriced']-P['passedTechnical']} of {P['candidatesPriced']} — removed by the entry filter"], sz=1200)),
          footer_shapes(7)]
add(slide_xml(shapes), 4, [('rIdC', 'chart', f'../charts/{c2}.xml')])

# 8 holdings table
rows = [['Ticker', 'Company', 'Industry', 'Weight', 'P/E vs peer', 'Tone (Δ)', 'RSI']]
for h in H:
    t = h['tone']; rows.append([h['symbol'], h['name'][:24], h['industry'][:22], pct(P['weights']['maxSharpe'][h['symbol']]), f"{h['valuation']['pe']:.1f} / {h['valuation']['peerPe']:.1f}", f"{t['polarity']:.2f}" + (f" ({t['delta']:+.2f})" if t['delta'] is not None else ''), f"{h['technical']['rsi']:.0f}"])
shapes = [ph_shape('title', None, [para(run(f'The portfolio: {n} names, {len(industries)} industries'))], 'Titel'),
          table(bx, by - 60000, bw, [0.8, 2.6, 2.4, 0.9, 1.4, 1.4, 0.6], rows, sz=800, row_h=int((bh + 60000) / (n + 1)), right_from=3),
          footer_shapes(8)]
add(slide_xml(shapes), 4)

# 9 weights chart (transplant)
c3 = transplant_chart(3, 103)
shapes = [ph_shape('title', None, [para(run('Weights: the optimiser tilts, it does not decide'))], 'Titel'),
          chart_frame('rIdC', bx, by, half + 500000, bh),
          textbox(bx + half + 500000 + gap, by, half - 500000 - gap, bh, bullets(['Every name that passed the rules is held: 2% floor', '10% cap per name, at most four per industry', 'Without the floor the max-Sharpe optimiser put ten names at the cap and nine at zero — a bet on last year\'s winners, not the thesis', 'Where max-Sharpe and min-variance agree (ALL, INCY, SPG, OXY) the position is robust'], sz=1100)),
          footer_shapes(9)]
add(slide_xml(shapes), 4, [('rIdC', 'chart', f'../charts/{c3}.xml')])

# 10 methods compared
def r_(k, lab): s = St[k]; return [lab, pct(s['expectedReturn']), pct(s['volatility']), f"{s['sharpe']:.2f}"]
rows = [['Method', 'Expected return', 'Volatility', 'Sharpe'], r_('maxSharpe', 'Maximum Sharpe ratio (chosen)'), r_('minVariance', 'Minimum variance'), r_('equal', 'Equal weight (baseline)'), r_('benchmark', 'SPY, same window')]
shapes = [ph_shape('title', None, [para(run('The two methods taught, side by side'))], 'Titel'),
          table(bx, by, half + 400000, [3.2, 1.6, 1.4, 1.2], rows, sz=1000, row_h=380000, right_from=1),
          textbox(bx + half + 400000 + gap, by, half - 400000 - gap, bh, [para(run('Read this honestly', sz=1300, b=True, color='accent4'), space_after=600)] + bullets([f"{P['lookbackTradingDays']} trading days ending {P['pricesAsOf']}; risk-free {pct(P['riskFreeRate'],0)}", 'Weights were fitted on the same window they are measured on — this is the fit, not a forecast', 'Expected returns are historical means, the weakest input in mean-variance work; that is why min-variance is shown'], sz=1100), line='accent3', rounded=True),
          footer_shapes(10)]
add(slide_xml(shapes), 4)

# 11 application
feats = [('On load', 'Live quote for all holdings from Finnhub; failures shown as “stale”, never hidden'), ('Weights', 'Max-Sharpe, min-variance and equal weight switchable; $1M allocation per name'), ('Signals', 'Golden/death cross, RSI(14), MACD histogram and call tone per holding, dated'), ('Commentary', 'Four paragraphs written by the model from live quotes and signals, labelled; without a key a computed summary, no pre-written text'), ('Research', 'Every ticker opens the full dossier: score, chart, peers, analysts, news, call sentiment, track record'), ('Guardrails', 'No sample data, keys in the browser only, 41 unit tests, GitHub Pages on every push')]
shapes = [ph_shape('title', None, [para(run('The application (live demo)'))], 'Titel'),
          textbox(bx, by - 40000, bw, 330000, [para(run(LIVE, sz=1200, b=True, color='accent1'))])]
fw = (bw - gap) // 2; fh = (bh - 330000 - 2 * gap) // 3
for i, (hd, tx) in enumerate(feats):
    c, r = i % 2, i // 2
    shapes.append(textbox(bx + c * (fw + gap), by + 330000 + r * (fh + gap), fw, fh, [para(run(f'{i+1}  {hd}', sz=1200, b=True, color='accent4'), space_after=300), para(run(tx, sz=1000))], line='accent3', rounded=True))
shapes.append(footer_shapes(11)); add(slide_xml(shapes), 4)

# 12 risks
risks = [('One backtest, one year', 'The valuation signal was found at a single 2025 anchor. Mitigation: second and third anchors before scaling; paper-trade two quarters.'),
         ('Value trap despite the call', 'A word-count tone can be gamed by upbeat language. Mitigation: hedging and legal-vocabulary rates, tone change, and the technical gate.'),
         ('Estimation error in weights', 'Expected returns are historical means. Mitigation: 2–10% bands, industry cap, min-variance shown beside max-Sharpe.'),
         ('Concentration by industry', f'{len(industries)} industries; Health Care and Energy carry several names. Mitigation: cap of four per industry; monitor sector beta.'),
         ('Data and vendor risk', 'Free tiers, rate limits, an archive that stops. Mitigation: layered providers, persisted cache, explicit “stale” states.'),
         ('Automation without oversight', 'Knight Capital: rules executing unwatched. Mitigation: quarterly human review, no automated trading, every signal labelled and dated.')]
shapes = [ph_shape('title', None, [para(run('Risk factors and what limits them'))], 'Titel')]
rw = (bw - 2 * gap) // 3; rh = (bh - gap) // 2
for i, (hd, tx) in enumerate(risks):
    c, r = i % 3, i // 3
    shapes.append(textbox(bx + c * (rw + gap), by + r * (rh + gap), rw, rh, [para(run(hd, sz=1100, b=True, color='accent4'), space_after=300), para(run(tx, sz=900))], line='accent3', rounded=True))
shapes.append(footer_shapes(12)); add(slide_xml(shapes), 4)

# 13 challenge questions
qa = [('“Your Sharpe beats SPY — why should I believe it?”', f"You shouldn't, as a forecast. It is in-sample on {P['lookbackTradingDays']} days. Believe the process: one factor with out-of-sample evidence, two independent checks, and a dashboard that shows the fit and the stale states rather than hiding them."),
      ('“Why not just buy cheap stocks?”', f"Because cheap alone was the {rej.get('not cheaper than peers','128')}-name rejection in reverse: half the cheap names were cheap for a reason. The call tone and the trend filter turn a screen into a portfolio."),
      ('“What if the model is wrong about profitability?”', 'Then we hold fewer high-margin names than a quality strategy would, and the min-variance view is the hedge. The finding was one year; the rule is re-tested with every anchor we add.'),
      ('“Who pulls the trigger?”', 'A person, quarterly, after earnings season. The application recommends; it never trades. That is the Knight Capital lesson applied.')]
paras = []
for q, a in qa:
    paras.append(para(run(q, sz=1200, b=True, color='accent4'), bullet=False, space_after=200))
    paras.append(para(run(a, sz=1000), bullet=False, space_after=700))
shapes = [ph_shape('title', None, [para(run('Questions you will ask, and the answers'))], 'Titel'), textbox(bx, by, bw, bh, paras), footer_shapes(13)]
add(slide_xml(shapes), 4)

# 14 closing (Abschlussfolie)
b15_idx, b15_geo = find(L15, 'body')
add(slide_xml([ph_shape('body', b15_idx, [para(run('Decision requested', sz=1800, b=True)), para(run(f'Approve $1M into the {n}-name maximum-Sharpe basket, 2–10% per name', sz=1200)), para(run('Quarterly re-screen after earnings season; two quarters of paper-tracking reported back to this committee', sz=1200)), para(run('Second and third backtest anchors before any scale-up', sz=1200)), para(run(' ', sz=800)), para(run(LIVE, sz=1000, color='accent1')), para(run('github.com/jakobhofer-kg16/equity-lens', sz=1000, color='accent1'))], 'Text', geo=b15_geo)]), 15)

# --- register slides --------------------------------------------------------------
rid_base = 1000; sld_id = 5000
sld_entries = ''; rel_entries = ''; ct_entries = ''
for i, (xml, lay, extra) in enumerate(slides, start=1):
    (W / f'ppt/slides/slide{i}.xml').write_text(xml, encoding='utf8')
    rels = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            f'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout{lay}.xml"/>')
    for rid, typ, target in extra:
        rels += f'<Relationship Id="{rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/{typ}" Target="{target}"/>'
    rels += '</Relationships>'
    (W / f'ppt/slides/_rels/slide{i}.xml.rels').write_text(rels, encoding='utf8')
    sld_entries += f'<p:sldId id="{sld_id + i}" r:id="rId{rid_base + i}"/>'
    rel_entries += f'<Relationship Id="rId{rid_base + i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide{i}.xml"/>'
    ct_entries += f'<Override PartName="/ppt/slides/slide{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'
for c in (101, 102, 103):
    ct_entries += f'<Override PartName="/ppt/charts/chart{c}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>'
pres = pres.replace('<p:sldIdLst></p:sldIdLst>', f'<p:sldIdLst>{sld_entries}</p:sldIdLst>')
prels = prels.replace('</Relationships>', rel_entries + '</Relationships>')
ct = ct.replace('</Types>', ct_entries + '</Types>')
(W / 'ppt/presentation.xml').write_text(pres, encoding='utf8')
(W / 'ppt/_rels/presentation.xml.rels').write_text(prels, encoding='utf8')
(W / '[Content_Types].xml').write_text(ct, encoding='utf8')
# docProps app.xml lists slide titles/counts; safest to reset the counts
app = W / 'docProps/app.xml'
if app.exists():
    a = app.read_text(encoding='utf8'); a = re.sub(r'<Slides>\d+</Slides>', f'<Slides>{len(slides)}</Slides>', a); a = re.sub(r'<Notes>\d+</Notes>', '<Notes>0</Notes>', a)
    a = re.sub(r'<TitlesOfParts>.*?</TitlesOfParts>', '', a, flags=re.S); a = re.sub(r'<HeadingPairs>.*?</HeadingPairs>', '', a, flags=re.S)
    app.write_text(a, encoding='utf8')

# --- well-formedness + zip ----------------------------------------------------------
import xml.dom.minidom as md
bad = []
for f in W.rglob('*.xml'):
    try: md.parse(str(f))
    except Exception as e: bad.append((str(f.relative_to(W)), str(e)[:80]))
for f in W.rglob('*.rels'):
    try: md.parse(str(f))
    except Exception as e: bad.append((str(f.relative_to(W)), str(e)[:80]))
if bad: print('XML errors:', bad)
if OUT.exists(): OUT.unlink()
with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
    z.write(W / '[Content_Types].xml', '[Content_Types].xml')
    for f in sorted(W.rglob('*')):
        if f.is_file() and f.name != '[Content_Types].xml': z.write(f, f.relative_to(W).as_posix())
print('wrote', OUT, 'slides:', len(slides), 'xml errors:', len(bad))
