"""Rebuild the zero-network single HTML file using Python 3; no packages required."""
from pathlib import Path
root=Path(__file__).resolve().parent
html=(root/'index.html').read_text(encoding='utf-8')
for name in ('world-impact','demo'):
    text=(root/'src'/f'{name}.js').read_text(encoding='utf-8')
    if '</script' in text.lower():
        raise ValueError('Unsafe closing script tag in source')
    html=html.replace(f'<script src="src/{name}.js"></script>',f'<script>\n{text}\n</script>')
(root/'standalone.html').write_text(html,encoding='utf-8')
print('Built standalone.html')
