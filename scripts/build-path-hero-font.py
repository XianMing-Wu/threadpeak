"""Build the route hero's local WOFF2 subset from the official RHR v1.910 archive.

Usage: python scripts/build-path-hero-font.py /path/to/RHR-CFF2-CN-1.910.7z
Requires fonttools, brotli, py7zr. The source archive stays outside the repository.
"""
from pathlib import Path
import hashlib
import sys
import tempfile

import py7zr
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[1]
COPY = "路线规划从目标出发，把学习内容组织成可以进入的路线。"
archive = Path(sys.argv[1])
with tempfile.TemporaryDirectory() as directory:
    with py7zr.SevenZipFile(archive) as source:
        source.extractall(directory)
    font = TTFont(Path(directory) / "ResourceHanRoundedCN-VF.otf")
    options = subset.Options()
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14, 16, 17]
    options.name_legacy = True
    options.name_languages = [0x409]
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=COPY)
    subsetter.subset(font)
    font = instantiateVariableFont(font, {"wght": (400, 600), "ROND": 35}, inplace=True)
    names = {1: "ThreadPeak Rounded", 2: "Regular", 3: "ThreadPeakRounded-RHR1910-RouteSubset", 4: "ThreadPeak Rounded", 6: "ThreadPeakRounded", 16: "ThreadPeak Rounded", 17: "Regular"}
    for record in font["name"].names:
        if record.nameID in names:
            record.string = names[record.nameID].encode(record.getEncoding())
    font.flavor = "woff2"
    target = ROOT / "public/fonts/path-hero-rounded.woff2"
    target.parent.mkdir(parents=True, exist_ok=True)
    font.save(target)
    print(f"{target}: {target.stat().st_size} bytes")
    print("Archive SHA256:", hashlib.sha256(archive.read_bytes()).hexdigest())
    print("Font SHA256:", hashlib.sha256(target.read_bytes()).hexdigest())
