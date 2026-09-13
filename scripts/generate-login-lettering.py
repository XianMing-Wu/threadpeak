"""Build local login headline outlines from the pinned OFL brand font.
Usage: python3 scripts/generate-login-lettering.py /path/to/MaShanZheng-Regular.ttf
Requires fontTools; provenance: src/ui/brand/sources.json.
"""
from pathlib import Path
import hashlib
import json
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

root = Path(__file__).resolve().parent.parent
source = Path(sys.argv[1])
digest = hashlib.sha256(source.read_bytes()).hexdigest()
assert digest == '6d2546bb189c732a8ca29af9e22457b152387d158aa459e4ac2ce1e51788b7fb'
font = TTFont(source)
glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
scale = 100 / font['head'].unitsPerEm
labels = {'idea': '想做的事，', 'begin': '从这里开始。', 'welcome': '欢迎来到问山', 'brand': '问山'}
output = root / 'src/pages/auth-assets'
output.mkdir(exist_ok=True)
for name, label in labels.items():
    x, paths, bounds = 0, [], []
    for char in label:
        glyph = glyphs[cmap[ord(char)]]
        pen, box = SVGPathPen(glyphs), BoundsPen(glyphs)
        transform = (scale, 0, 0, -scale, x, 0)
        glyph.draw(TransformPen(pen, transform))
        glyph.draw(TransformPen(box, transform))
        if box.bounds:
            bounds.append(box.bounds)
        paths.append(f'<path d="{pen.getCommands()}"/>')
        x += glyph.width * scale + 3
    left, top = min(b[0] for b in bounds) - 3, min(b[1] for b in bounds) - 3
    width, height = max(b[2] for b in bounds) - left + 3, max(b[3] for b in bounds) - top + 3
    color = '#2864df' if name == 'begin' else '#202e35'
    (output / f'{name}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{left} {top} {width} {height}" fill="{color}">'+''.join(paths)+'</svg>\n')
(output / 'source.json').write_text(json.dumps({'family': 'Ma Shan Zheng', 'license': 'SIL OFL 1.1', 'sha256': digest, 'labels': labels}, ensure_ascii=False, indent=2)+'\n')
