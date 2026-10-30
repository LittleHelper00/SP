#!/usr/bin/env python3
"""Ingest map images into data/maps/ and write data/maps/maps.json.
File names carry the geographic bounds:  <name>_w<west>_s<south>_e<east>_n<north>.png|jpg
e.g. city_w9.8000_s44.0950_e9.8500_n44.1200.png   (decimal degrees, as shown by OpenStreetMap's Share > Image export)
Usage: python3 tools/ingest_maps.py file1.png file2.png ..."""
import sys, re, json
from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parent.parent
d = root / 'data' / 'maps'; d.mkdir(parents=True, exist_ok=True)
RANGE = {'city': (70, 1400), 'gulf': (22, 160), 'coast': (8, 70), 'centro': (250, 1400)}   # app zoom scales (px/km) where each image is shown
ATTR = 'Map data © OpenStreetMap contributors'
out = []
for f in sys.argv[1:]:
    m = re.match(r'^(\w+?)_w(-?[\d.]+)_s(-?[\d.]+)_e(-?[\d.]+)_n(-?[\d.]+)\.\w+$', Path(f).name)
    if not m: print('SKIP (bad name):', f); continue
    name, w, s, e, n = m.group(1), *map(float, m.groups()[1:])
    im = Image.open(f).convert('RGB'); im.thumbnail((2400, 2400)); fn = name + '.jpg'; im.save(d / fn, 'JPEG', quality=85, optimize=True)
    mn, mx = RANGE.get(name, (8, 1400)); out.append({'file': fn, 'w': w, 's': s, 'e': e, 'n': n, 'min': mn, 'max': mx, 'attr': ATTR})
    print('ok', name, (w, s, e, n), im.size)
(d / 'maps.json').write_text(json.dumps(out, indent=1))
