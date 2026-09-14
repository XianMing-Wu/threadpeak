"""Outline the introduction's Chinese headlines with the pinned local brand font.
Usage: python3 scripts/generate-introduction-lettering.py /path/to/MaShanZheng-Regular.ttf
Requires fontTools. Font provenance and license: src/ui/brand/sources.json.
"""
from pathlib import Path
import hashlib,json,sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
root=Path(__file__).resolve().parent.parent
font_path=Path(sys.argv[1]);digest=hashlib.sha256(font_path.read_bytes()).hexdigest()
assert digest=='6d2546bb189c732a8ca29af9e22457b152387d158aa459e4ac2ce1e51788b7fb'
font=TTFont(font_path);glyphs=font.getGlyphSet();cmap=font.getBestCmap();scale=100/font['head'].unitsPerEm
latin=TTFont(root/'node_modules/katex/dist/fonts/KaTeX_Main-Bold.ttf');latin_glyphs=latin.getGlyphSet();latin_map=latin.getBestCmap()
manifest=json.loads((root/'src/introduction/assets/story-lettering-source.json').read_text())
labels=[(name,label,5) for name,label in manifest['labels'].items()]
for name,label,blue_from in labels:
 x=0;paths=[];bounds=[]
 for i,char in enumerate(label):
  use_latin=char.isascii() and char.isalpha()
  gs=latin_glyphs if use_latin else glyphs;cm=latin_map if use_latin else cmap;s=125/latin['head'].unitsPerEm if use_latin else scale
  g=gs[cm[ord(char)]];pen=SVGPathPen(gs);b=BoundsPen(gs);t=(s,0,0,-s,x,0)
  g.draw(TransformPen(pen,t));g.draw(TransformPen(b,t))
  if b.bounds:bounds.append(b.bounds)
  paths.append(f'<path fill="{"#2864df" if i>=blue_from else "#202e35"}" d="{pen.getCommands()}"/>');x+=g.width*s+(7 if use_latin else 2)
 left=min(b[0] for b in bounds)-3;top=min(b[1] for b in bounds)-3;right=max(b[2] for b in bounds)+3;bottom=max(b[3] for b in bounds)+3
 (root/f'src/introduction/assets/{name}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{left} {top} {right-left} {bottom-top}">'+''.join(paths)+'</svg>\n')
(root/'src/introduction/assets/story-lettering-source.json').write_text(json.dumps({'family':'Ma Shan Zheng','license':'SIL OFL 1.1','sha256':digest,'labels':{name:label for name,label,_ in labels}},ensure_ascii=False,indent=2)+'\n')
