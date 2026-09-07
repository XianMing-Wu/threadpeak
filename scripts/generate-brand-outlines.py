"""Manual, reproducible asset build: python -m pip install fonttools.
The application/build never downloads fonts. Source revisions and digests are pinned.
"""
import hashlib
import io
import json
from pathlib import Path
from urllib.request import urlopen
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.misc.transform import Transform
from fontTools.varLib.instancer import instantiateVariableFont

root = Path(__file__).resolve().parents[1] / 'src/ui/brand'
number = lambda value: format(value, '.3f').rstrip('0').rstrip('.') if value else '0'
result = {}
for name, spec in zip(['peak', 'threads', 'motto'], json.loads((root / 'sources.json').read_text())):
    data = urlopen(spec['source'], timeout=60).read()
    if hashlib.sha256(data).hexdigest() != spec['sha256']:
        raise ValueError('Font source digest mismatch: ' + spec['family'])
    font = TTFont(io.BytesIO(data))
    if 'fvar' in font:
        font = instantiateVariableFont(font, {'wght': 500}, inplace=True)
    glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
    scale, x, paths, bounds = spec['fontSize'] / font['head'].unitsPerEm, 0, [], []
    for char in spec['text']:
        glyph = glyphs[cmap[ord(char)]]
        transform = Transform(scale, 0, 0, -scale, x, 0)
        pen, bp = SVGPathPen(glyphs, ntos=number), BoundsPen(glyphs)
        glyph.draw(TransformPen(pen, transform))
        glyph.draw(TransformPen(bp, transform))
        paths.append(pen.getCommands())
        if bp.bounds:
            bounds.append(bp.bounds)
        x += glyph.width * scale + spec['letterSpacing']
    xmin, ymin = min(b[0] for b in bounds) - 1, min(b[1] for b in bounds) - 1
    width, height = max(b[2] for b in bounds) + 1 - xmin, max(b[3] for b in bounds) + 1 - ymin
    result[name] = {'viewBox': f'{xmin:.3f} {ymin:.3f} {width:.3f} {height:.3f}',
                    'width': round(width, 3), 'height': round(height, 3), 'path': ' '.join(paths)}
(root / 'outlines.ts').write_text('// Generated glyph outlines; see README.md. No browser font loading.\nexport const brandOutlines = ' + json.dumps(result, ensure_ascii=False, separators=(',', ':')) + ' as const\n')
