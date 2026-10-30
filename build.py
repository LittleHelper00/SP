#!/usr/bin/env python3
"""Builds dist/index.html: one self-contained page from src/ and data/."""
import json, pathlib
root = pathlib.Path(__file__).parent
data = {k: json.loads((root / 'data' / f'{k}.json').read_text(encoding='utf-8'))
        for k in ['places', 'food', 'events', 'tours', 'planner']}
people = json.loads((root / 'data' / 'people.json').read_text(encoding='utf-8'))
byid = {p['id']: p for p in data['places']}
def merge(entries):
    for e in entries:
        if 'extends' in e:
            base = byid[e['extends']]
            for k, v in e.items():
                if k == 'extends': continue
                if k == 'pverify':
                    base['verify'] = base.get('verify', []) + v
                elif k == 'storyAppend':
                    base['story']['en'] = base['story']['en'] + v['en']
                elif k == 'storyInsert':
                    base['story']['en'][v['at']:v['at']] = v['en']
                elif k in ('tipsAppend', 'curiosAppend'):
                    base.setdefault(k[:-6], {'en': []})['en'] += v['en']
                elif k == 'sources' and base.get('sources'):
                    seen = {x['url'] for x in base['sources']}
                    base['sources'] = base['sources'] + [x for x in v if x['url'] not in seen]
                else:
                    base[k] = v
        else:
            data['places'].append(e); byid[e['id']] = e
for name in ['people', 'enrich', 'extra']:
    merge(people if name == 'people' else json.loads((root / 'data' / f'{name}.json').read_text(encoding='utf-8')))
for _p in data['places']:
    for _k in ('story', 'tips'):
        if _p.get(_k, {}).get('en'):
            _p[_k]['en'] = [x for x in _p[_k]['en'] if x and x.strip()]
byid['giardini']['flags']['photo'] = True
# coordinates supplied by the app owner (Google Maps): override position and mark as confirmed
_co = json.loads((root / 'data' / 'coords.json').read_text(encoding='utf-8'))
for _id, (_la, _lo) in _co['coords'].items():
    byid[_id]['lat'], byid[_id]['lon'], byid[_id]['geo'] = _la, _lo, 'confirmed'
for _id, _items in _co['dropVerify'].items():
    byid[_id]['verify'] = [x for x in byid[_id].get('verify', []) if x not in _items]
import base64, mimetypes
data['maps'] = []
_mp = root / 'data' / 'maps' / 'maps.json'
if _mp.exists():
    for m in json.loads(_mp.read_text(encoding='utf-8')):
        f = root / 'data' / 'maps' / m['file']
        if f.exists():
            mm = dict(m); mm['src'] = 'data:' + (mimetypes.guess_type(f.name)[0] or 'image/png') + ';base64,' + base64.b64encode(f.read_bytes()).decode(); mm.pop('file'); data['maps'].append(mm)
data['transport'] = json.loads((root / 'data' / 'transport.json').read_text(encoding='utf-8'))
data['legal'] = json.loads((root / 'data' / 'legal.json').read_text(encoding='utf-8'))
data['history'] = json.loads((root / 'data' / 'history.json').read_text(encoding='utf-8'))
data['ui_people'] = json.loads((root / 'data' / 'ui_people.json').read_text(encoding='utf-8'))
_ph = json.loads((root / 'data' / 'photos.json').read_text(encoding='utf-8'))
import csv
def _uri(f): return 'data:image/jpeg;base64,' + base64.b64encode(f.read_bytes()).decode()
_pd = root / 'data' / 'photos'
_cred = {}
if (_pd / 'credits.csv').exists():
    for r in csv.DictReader(open(_pd / 'credits.csv', encoding='utf-8')): _cred[r['id']] = r
for _id, _p in _ph.items():
    # remote hotlinks cannot load inside the artifact (CSP): only local files are shown
    if str(_p.get('src', '')).startswith('http'): continue
    byid[_id]['photo'] = {k: v for k, v in _p.items() if k != 'alt'}
for _id, _pl in byid.items():
    f = _pd / (_id + '.jpg')
    if not f.exists(): continue
    c = _cred.get(_id, {})
    ph = {'src': _uri(f), 'thumb': _uri(_pd / (_id + '_thumb.jpg')) if (_pd / (_id + '_thumb.jpg')).exists() else None,
          'credit': c.get('author') or 'Photo supplied by the app owner', 'license': c.get('license') or '', 'licenseUrl': '', 'page': c.get('source_url') or '', 'pageLabel': 'Source'}
    if c.get('caption'): ph['caption'] = {'en': c['caption']}
    if c.get('generic', '').strip().lower() in ('1', 'yes', 'si', 'sì', 'true'): ph['generic'] = True
    more = [_uri(g) for g in sorted(_pd.glob(_id + '_[2-9].jpg'))]
    if more: ph['more'] = more
    _pl['photo'] = ph
for _f in data['food']:
    _fp = _pd / ('food_' + _f['id'] + '.jpg')
    if _fp.exists(): _f['photo'] = {'src': _uri(_fp), 'credit': 'Photo supplied by the app owner'}
(root / 'build').mkdir(exist_ok=True)
import re, glob
LANGS = ['it', 'de', 'es']
SKIP = {'id','kind','cat','icon','area','access','geo','dest','motif','url','label','k','type','say','sources','legal','ui_people','i18n','it','de','es','weekday','n','except','month','day','tier','lat','lon','h','visitMin','oneWay','visit','must','photo','family','status','years','rule','extends','person','zoneLinks','contact','links','level_code'}
def collect_en(o, key=None, out=None):
    out = {} if out is None else out
    if isinstance(o, str):
        if key not in SKIP and re.search(r'[A-Za-z]{3,}', o) and ' ' in o.strip(): out[re.sub(r'\s+', ' ', o).strip()] = 1
    elif isinstance(o, list):
        for x in o: collect_en(x, key, out)
    elif isinstance(o, dict):
        for k, v in o.items():
            if k in SKIP and k != 'en': continue
            collect_en(v, k if k != 'en' else key, out)
    return out
# Master dictionaries English -> translation, built from chunk/part files (data/i18n/parts, dist/chunks)
tr = {l: {} for l in LANGS}
for cf in sorted(glob.glob(str(root / 'dist' / 'chunks' / 'chunk_*.json'))):
    name = pathlib.Path(cf).stem.split('_', 1)[1]
    src = json.loads(pathlib.Path(cf).read_text(encoding='utf-8'))
    for l in LANGS:
        pf = root / 'data' / 'i18n' / 'parts' / f'{l}_{name}.json'
        if not pf.exists(): continue
        part = json.loads(pf.read_text(encoding='utf-8'))
        for k, en in src.items():
            if part.get(k): tr[l].setdefault(re.sub(r'\s+', ' ', en).strip(), part[k].strip())
for l in LANGS:
    for df in sorted(glob.glob(str(root / 'data' / 'i18n' / 'dict' / f'out_{l}_*.json'))):
        for k, v in json.loads(pathlib.Path(df).read_text(encoding='utf-8')).items():
            if v and v.strip(): tr[l][re.sub(r'\s+', ' ', k).strip()] = v.strip()
(root / 'build' / 'tr_all.json').write_text(json.dumps(tr, ensure_ascii=False), encoding='utf-8')
want = collect_en({k: v for k, v in data.items() if k not in ('legal', 'ui_people', 'i18n')})
ui_file = root / 'data' / 'i18n' / 'ui_keys.json'
ui_keys = json.loads(ui_file.read_text(encoding='utf-8')) if ui_file.exists() else []
allkeys = list(dict.fromkeys(list(want) + ui_keys))
missing = [k for k in allkeys if any(k not in tr[l] for l in LANGS)]
(root / 'build' / 'missing_i18n.json').write_text(json.dumps(missing, ensure_ascii=False, indent=0), encoding='utf-8')
bad = [(l, k) for l in LANGS for k, v in tr[l].items() if sorted(re.findall(r'\{\w+\}', k)) != sorted(re.findall(r'\{\w+\}', v))]
print('placeholder mismatches', bad[:10], len(bad))
print('i18n keys', len(allkeys), 'missing in some language', len(missing))
data['i18n'] = {'en': allkeys}
for l in LANGS: data['i18n'][l] = [tr[l].get(k, '') for k in allkeys]
(root / 'build').mkdir(exist_ok=True)
(root / 'build' / 'data_payload.json').write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
tpl = (root / 'src' / 'template.html').read_text(encoding='utf-8')
css = (root / 'src' / 'styles.css').read_text(encoding='utf-8')
js = (root / 'src' / 'app.js').read_text(encoding='utf-8')
payload = json.dumps(data, ensure_ascii=False).replace('</', '<\\/')
out = tpl.replace('/*__CSS__*/', css).replace('/*__DATA__*/', payload).replace('/*__JS__*/', js)
(root / 'dist').mkdir(exist_ok=True)
(root / 'dist' / 'index.html').write_text(out, encoding='utf-8')
print('built', len(out) // 1024, 'KB')
