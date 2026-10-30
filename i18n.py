"""Helpers: collect every English-only translatable string of the merged data as flat path->text,
and apply translations (path->text) back as extra language keys."""
SKIP_TOP = {'ui_people', 'legal'}
LANGS = ['it', 'de', 'es']

def _key(item, i):
    return item['id'] if isinstance(item, dict) and 'id' in item else str(i)

def normalise(data):
    """Turn selected plain strings into {en: ...} so they can be translated like the rest."""
    for p in data['places']:
        if isinstance(p.get('accessNote'), str): p['accessNote'] = {'en': p['accessNote']}
    for e in data['history']['eras']:
        e['range'] = {'en': e['range']} if isinstance(e['range'], str) else e['range']
        for v in e['events']:
            for k in ('y', 't', 'flag'):
                if isinstance(v.get(k), str): v[k] = {'en': v[k]}
    if isinstance(data['history']['conflicts'], list): data['history']['conflicts'] = {'en': data['history']['conflicts']}
    for tr in data['tours']:
        if isinstance(tr.get('level'), str): tr['level'] = {'en': tr['level']}
    for o in data['transport']['operators']:
        if isinstance(o.get('contact'), str) and o['contact']: o['contact'] = {'en': o['contact']}
    for e in data['events']:
        pass

def collect(data):
    out = {}
    def walk(node, path):
        if isinstance(node, dict):
            if 'en' in node and not ({'de', 'es'} & set(node)):
                v = node['en']
                if isinstance(v, str): out[path + '.en'] = v
                elif isinstance(v, list):
                    for i, x in enumerate(v):
                        if isinstance(x, str): out[f'{path}.en.{i}'] = x
                        elif isinstance(x, dict) and 't' in x: out[f'{path}.en.{i}.t'] = x['t']
                return
            for k, v in node.items():
                if k in ('verify', 'sources', 'conflicts_owner', 'links'): continue
                walk(v, path + '.' + k if path else k)
        elif isinstance(node, list):
            for i, x in enumerate(node):
                walk(x, f'{path}.{_key(x, i)}')
    for k, v in data.items():
        if k in SKIP_TOP: continue
        walk(v, k)
    return out

def apply(data, lang, mapping):
    n = 0
    def setp(path, text):
        nonlocal n
        parts = path.split('.')
        # walk by keys / ids
        node = data
        i = 0
        while i < len(parts) - 1:
            p = parts[i]
            if isinstance(node, list):
                nxt = None
                for j, x in enumerate(node):
                    if _key(x, j) == p: nxt = x; break
                if nxt is None: return
                node = nxt
            else:
                if p == 'en' and (i + 1 < len(parts)):
                    # list under 'en'
                    sibling = node
                    lst = sibling['en']
                    idx = int(parts[i + 1])
                    if lang in sibling and not isinstance(sibling[lang], list): return
                    tgt = sibling.setdefault(lang, [None] * len(lst))
                    if len(parts) > i + 2 and parts[i + 2] == 't':
                        if tgt[idx] is None: tgt[idx] = dict(lst[idx])
                        tgt[idx]['t'] = text
                    else:
                        tgt[idx] = text
                    n += 1
                    return
                if p not in node: return
                node = node[p]
            i += 1
        if parts[-1] == 'en' and isinstance(node, dict) and lang not in node:
            node[lang] = text; n += 1
    for path, text in mapping.items(): setp(path, text)
    return n
