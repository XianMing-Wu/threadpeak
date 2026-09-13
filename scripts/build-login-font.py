"""Build the login-only Chinese/Latin subset from the pinned RHR v1.910 archive.

Usage: python scripts/build-login-font.py /path/to/RHR-CFF2-CN-1.910.7z
Requires fonttools, brotli and py7zr. Keep the source archive outside the repo.
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
archive = Path(sys.argv[1])
expected = '4ad7b141535a1f11831287b0a6f71ddcec8daa92dc1d82c59892068f8ae5df09'
if hashlib.sha256(archive.read_bytes()).hexdigest() != expected:
    raise ValueError('Unexpected font archive version')
copy = (ROOT / 'src/pages/AuthLanding.tsx').read_text()
copy += (ROOT / 'src/pages/LoginJourney.tsx').read_text()
copy += ''.join(chr(code) for code in range(32, 127))
with tempfile.TemporaryDirectory() as directory:
    with py7zr.SevenZipFile(archive) as source:
        source.extractall(directory)
    font = TTFont(Path(directory) / 'ResourceHanRoundedCN-VF.otf')
    options = subset.Options()
    # Horizontal Chinese UI: retain locale/composition, omit unused vertical and
    # pair-positioning features before instancing the CFF2 subset.
    options.layout_features = ['locl', 'ccmp']
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14, 16, 17]
    options.name_legacy = True
    options.name_languages = [0x409]
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=copy)
    subsetter.subset(font)
    font = instantiateVariableFont(font, {'wght': (350, 650), 'ROND': 18}, inplace=True)
    names = {1: 'ThreadPeak Login', 2: 'Regular', 3: 'ThreadPeakLogin-RHR1910', 4: 'ThreadPeak Login', 6: 'ThreadPeakLogin', 16: 'ThreadPeak Login', 17: 'Regular'}
    for record in font['name'].names:
        if record.nameID in names:
            record.string = names[record.nameID].encode(record.getEncoding())
    font.flavor = 'woff2'
    target = ROOT / 'public/fonts/login-sans.woff2'
    font.save(target)
    print(f'{target.name}: {target.stat().st_size} bytes')
    print('Font SHA256:', hashlib.sha256(target.read_bytes()).hexdigest())
