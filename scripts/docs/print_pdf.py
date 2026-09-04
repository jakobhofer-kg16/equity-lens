"""docx -> HTML (textutil) -> PDF (Chrome headless). Used because neither
LibreOffice nor Office automation is available without user interaction."""
import re, base64, zipfile, subprocess, sys
from pathlib import Path
S = Path('/private/tmp/claude-501/-Users-jakob-Desktop-Claude/678dda1a-94eb-4847-83a6-ba8ce51a4344/scratchpad')
docx = Path(sys.argv[1]).resolve(); pdf = docx.with_suffix('.pdf')
subprocess.run(['textutil', '-convert', 'html', '-output', str(S/'post.html'), str(docx)], check=True)
html = (S/'post.html').read_text(encoding='utf8')
body = re.search(r'<body[^>]*>(.*)</body>', html, re.S).group(1)
z = zipfile.ZipFile(str(Path.home()/'Downloads/Template_Written Assignments_EMBA FIN 25-27.docx'))
logo = base64.b64encode(z.read('word/media/image1.png')).decode()
# Force a new page before each part; textutil drops Word's page-break runs.
body = re.sub(r'<p([^>]*)>(\s*(?:<[^>]+>\s*)*Part [ABC] —)', r'<p style="page-break-before:always"\1>\2', body)
css = '''
@page { size: A4; margin: 18mm; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color:#111; line-height:1.36; }
p { margin: 0 0 5pt 0; }
table { border-collapse: collapse; width: 100%; margin: 4pt 0 9pt 0; font-size: 8.8pt; }
td, th { border: 1px solid #bfc7d5; padding: 2pt 4pt; vertical-align: top; }
tr { page-break-inside: avoid; }
.cover-logo { text-align: right; margin-bottom: 18mm; } .cover-logo img { height: 13mm; }
.foot { margin-top: 10mm; font-size: 7.5pt; color: #777; border-top: 1px solid #ddd; padding-top: 3pt; }
'''
foot = '<p class="foot">WU Executive Academy · Wirtschaftsuniversität Wien · Welthandelsplatz 1, Building EA, 1020 Vienna · executiveacademy.at</p>'
(S/'post_print.html').write_text(f'<!doctype html><html><head><meta charset="utf-8"><style>{css}</style></head><body><div class="cover-logo"><img src="data:image/png;base64,{logo}"></div>{body}{foot}</body></html>', encoding='utf8')
subprocess.run(['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '--headless=new', '--disable-gpu', '--no-pdf-header-footer', f'--print-to-pdf={pdf}', f'file://{S}/post_print.html'], capture_output=True)
print(pdf)
