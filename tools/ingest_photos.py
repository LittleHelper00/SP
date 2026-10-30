#!/usr/bin/env python3
"""Ingest a zip of photos named <placeid>.jpg / <placeid>_2.jpg into data/photos/ (resized).
Usage: python3 tools/ingest_photos.py photos.zip
File names are matched case-insensitively against place ids (see data/photos/LISTA_FOTO.md)."""
import sys, zipfile, io, json, re, csv
from pathlib import Path
from PIL import Image, ImageOps
root = Path(__file__).resolve().parent.parent
ids = {p['id'].lower(): p['id'] for p in json.loads((root / 'build' / 'data_payload.json').read_text(encoding='utf-8'))['places']}
out = root / 'data' / 'photos'; out.mkdir(parents=True, exist_ok=True)
ok, bad = [], []
with zipfile.ZipFile(sys.argv[1]) as z:
    for n in z.namelist():
        base = Path(n).name
        if n.endswith('/') or base.startswith(('.', '_')) or not re.search(r'\.(jpe?g|png|webp|heic)$', base, re.I): continue
        stem = re.sub(r'\.[^.]+$', '', base).lower().replace(' ', '_').replace('-', '_')
        m = re.match(r'^(.*?)(?:_(\d))?$', stem); pid, idx = m.group(1), m.group(2)
        if pid not in ids: bad.append(n); continue
        im = ImageOps.exif_transpose(Image.open(io.BytesIO(z.read(n)))).convert('RGB')
        suffix = '' if not idx or idx == '1' else '_' + idx
        h = im.copy(); h.thumbnail((1000, 1000)); h.save(out / (ids[pid] + suffix + '.jpg'), 'JPEG', quality=80, optimize=True)
        if not suffix:
            t = im.copy(); t.thumbnail((320, 320)); t.save(out / (ids[pid] + '_thumb.jpg'), 'JPEG', quality=75, optimize=True)
        ok.append(ids[pid] + suffix)
# credits: crediti.csv / credits.csv inside the zip (Italian or English headers) merged into data/photos/credits.csv
ALIAS = {'id': 'id', 'autore': 'author', 'author': 'author', 'licenza': 'license', 'license': 'license', 'link_origine': 'source_url', 'source_url': 'source_url', 'link': 'source_url', 'didascalia': 'caption', 'caption': 'caption', 'generica': 'generic', 'generic': 'generic'}
FIELDS = ['id', 'author', 'license', 'source_url', 'caption', 'generic']
cf = out / 'credits.csv'; rows = {}
if cf.exists():
    for r in csv.DictReader(open(cf, encoding='utf-8')): rows[r['id']] = r
with zipfile.ZipFile(sys.argv[1]) as z:
    for n in z.namelist():
        if Path(n).name.lower() in ('crediti.csv', 'credits.csv'):
            for r in csv.DictReader(io.StringIO(z.read(n).decode('utf-8-sig'))):
                r = {ALIAS.get(k.strip().lower(), k): (v or '').strip() for k, v in r.items() if k}
                pid = re.sub(r'[ -]', '_', (r.get('id') or '').lower()).replace('.jpg', '')
                if pid in ids: r['id'] = ids[pid]; rows[ids[pid]] = {f: r.get(f, '') for f in FIELDS}
with open(cf, 'w', encoding='utf-8', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=FIELDS); w.writeheader(); [w.writerow(r) for r in rows.values()]
print('imported', len(ok), ':', ', '.join(ok)); print('NOT matched (rename to a place id):', bad or 'none')
