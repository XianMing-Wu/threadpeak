#!/usr/bin/env python3
"""Outline product-page route and network labels with the pinned Ma Shan Zheng font."""
from pathlib import Path
import hashlib
import json
import sys

from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

ROOT = Path(__file__).resolve().parent.parent
REPO = ROOT.parent
font_path = Path(sys.argv[1])
digest = hashlib.sha256(font_path.read_bytes()).hexdigest()
assert digest == "6d2546bb189c732a8ca29af9e22457b152387d158aa459e4ac2ce1e51788b7fb", digest

font = TTFont(font_path)
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
scale = 100 / font["head"].unitsPerEm

latin_path = REPO / "node_modules/katex/dist/fonts/KaTeX_Main-Bold.ttf"
if not latin_path.exists():
    latin_path = ROOT / "node_modules/katex/dist/fonts/KaTeX_Main-Bold.ttf"
latin = TTFont(latin_path)
latin_glyphs = latin.getGlyphSet()
latin_map = latin.getBestCmap()

HORIZONTAL = {
    "assets/lettering/route/carrier-0.svg": "规模与预算",
    "assets/lettering/route/carrier-1.svg": "网络与注意力",
    "assets/lettering/route/carrier-2.svg": "词表与损失",
    "assets/lettering/route/carrier-3.svg": "训练与验收",
    "assets/lettering/network-topic-0.svg": "规模与预算",
    "assets/lettering/network-topic-1.svg": "网络与注意力",
    "assets/lettering/network-topic-2.svg": "词表与损失",
    "assets/lettering/network-topic-3.svg": "训练与验收",
    "assets/lettering/learning-start-heading.svg": "计算最优如何定",
}

VERTICAL = {
    "assets/lettering/route/concept-0.svg": "计算最优如何定",
    "assets/lettering/route/concept-1.svg": "参数配数据",
    "assets/lettering/route/concept-2.svg": "网络块训什么",
    "assets/lettering/route/concept-3.svg": "注意力如何实现",
    "assets/lettering/route/concept-4.svg": "位置如何写入",
    "assets/lettering/route/concept-5.svg": "词表如何划定",
    "assets/lettering/route/concept-6.svg": "损失为何不降",
    "assets/lettering/route/concept-7.svg": "怎样算跑通",
    "assets/lettering/route/concept-8.svg": "失败怪哪里",
}


def glyph_for(char: str):
    use_latin = char.isascii() and (char.isalpha() or char in ":，、")
    gs = latin_glyphs if use_latin else glyphs
    cm = latin_map if use_latin else cmap
    s = 125 / latin["head"].unitsPerEm if use_latin else scale
    code = ord(char)
    if code not in cm:
        return None
    return gs, gs[cm[code]], s, 7 if use_latin else 2


def pack(paths, bounds):
    if not bounds:
        raise SystemExit("no outlines")
    left = min(b[0] for b in bounds) - 3
    top = min(b[1] for b in bounds) - 3
    right = max(b[2] for b in bounds) + 3
    bottom = max(b[3] for b in bounds) + 3
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{left:.2f} {top:.2f} {right-left:.2f} {bottom-top:.2f}">{"".join(paths)}</svg>\n'


def draw_horizontal(label: str) -> str:
    x = 0
    paths = []
    bounds = []
    for char in label:
        item = glyph_for(char)
        if item is None:
            x += 28
            continue
        gs, g, s, gap = item
        pen = SVGPathPen(gs)
        b = BoundsPen(gs)
        t = (s, 0, 0, -s, x, 0)
        g.draw(TransformPen(pen, t))
        g.draw(TransformPen(b, t))
        if b.bounds:
            bounds.append(b.bounds)
        paths.append(f'<path fill="#1d3038" d="{pen.getCommands()}"/>')
        x += g.width * s + gap
    return pack(paths, bounds)


def draw_vertical(label: str) -> str:
    y = 0
    paths = []
    bounds = []
    for char in label:
        item = glyph_for(char)
        if item is None:
            y += 28
            continue
        gs, g, s, _gap = item
        pen = SVGPathPen(gs)
        b = BoundsPen(gs)
        # Center each upright glyph on the vertical axis.
        x = -g.width * s / 2
        t = (s, 0, 0, -s, x, y)
        g.draw(TransformPen(pen, t))
        g.draw(TransformPen(b, t))
        if b.bounds:
            bounds.append(b.bounds)
        paths.append(f'<path fill="#1d3038" d="{pen.getCommands()}"/>')
        tall = (b.bounds[3] - b.bounds[1]) if b.bounds else g.width * s
        # Latin letters are narrow; do not pad them to CJK cell height or the column explodes.
        if char.isascii() and char.isalpha():
            y += max(tall, 34) + 4
        else:
            y += max(g.width * s, 96) + 10
    return pack(paths, bounds)


LABELS = {**HORIZONTAL, **VERTICAL}
for rel, label in HORIZONTAL.items():
    (ROOT / rel).write_text(draw_horizontal(label))
for rel, label in VERTICAL.items():
    (ROOT / rel).write_text(draw_vertical(label))

source = {
    "family": "Ma Shan Zheng",
    "sha256": digest,
    "license": "SIL Open Font License 1.1",
    "orientation": {
        **{rel: "horizontal" for rel in HORIZONTAL},
        **{rel: "vertical" for rel in VERTICAL},
    },
    "labels": {rel: label for rel, label in LABELS.items()},
}
(ROOT / "assets/lettering/route-lettering-source.json").write_text(
    json.dumps(source, ensure_ascii=False, indent=2) + "\n"
)
print(f"wrote {len(LABELS)} lettering files")
