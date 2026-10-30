/* La Spezia Cruise Guide — prototype app logic (plain JavaScript, no framework).
   All guide content lives in /data/*.json and is injected as window.__DATA__ by build.py.
   Nothing here talks to a server. */
(function () {
'use strict';
const D = window.__DATA__;
const LANG = 'en';                       // future: 'it', 'fr', 'de', 'es'
const t = (o) => (o && (o[LANG] || o.en)) || '';
/* ---------- i18n: one dictionary English -> it/de/es, applied to rendered text ---------- */
const I18 = {}; const I18T = {};
(function () {
  const raw = D.i18n || {}; const en = raw.en || [];
  ['it', 'de', 'es'].forEach((l) => {
    const m = {}; const tp = [];
    en.forEach((k, i) => { const v = raw[l] && raw[l][i]; if (!v) return; m[k] = v; if (k.indexOf('{n}') >= 0) tp.push(k); });
    I18[l] = m;
    I18T[l] = tp.sort((a, b) => b.length - a.length).map((k) => {
      const parts = k.split('{n}').map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      return { re: new RegExp('^' + parts.join('(.+?)') + '$'), tr: m[k] };
    });
  });
})();
const VOICE_LANG = { en: 'en-GB', it: 'it-IT', de: 'de-DE', es: 'es-ES' };
const LOCALE = { en: 'en-GB', it: 'it-IT', de: 'de-DE', es: 'es-ES' };
const normTxt = (x) => x.replace(/\s+/g, ' ').trim();
const trCache = {};
function trText(raw) {
  const lg = (typeof S !== 'undefined' && S.lang) || 'en';
  if (lg === 'en' || !I18[lg] || typeof raw !== 'string') return raw;
  const k = normTxt(raw); if (!k) return raw;
  const c = trCache[lg] || (trCache[lg] = {});
  let v = c[k];
  if (v === undefined) {
    const m = I18[lg]; v = m[k];
    if (v == null) {
      const nums = []; const pk = k.replace(/\d+(?:[.,:]\d+)*/g, (x) => { nums.push(x); return '{' + (nums.length - 1) + '}'; });
      if (pk !== k && m[pk] != null) v = m[pk].replace(/\{(\d+)\}/g, (_, i) => nums[+i]);
    }
    if (v == null && I18T[lg]) {
      for (const T of I18T[lg]) { const mm = k.match(T.re); if (mm) { v = T.tr.replace('{n}', () => normTxt(trText(mm[1]))); break; } }
    }
    if (v == null && k.indexOf(' · ') > 0) { const parts = k.split(' · ').map((x) => (m[x] != null ? m[x] : x)); v = parts.join(' · '); }
    if (v == null && k.indexOf(' ') > 0 && /[.!?]\s/.test(k)) { /* several sentences in one node: try paragraph pieces split on line breaks only */ }
    c[k] = v == null ? null : v;
  }
  if (v == null) return raw;
  return raw.match(/^\s*/)[0] + v + raw.match(/\s*$/)[0];
}
const trSrc = new WeakMap();
function trNode(n) {
  if (!n) return;
  if (n.nodeType === 3) {
    const p = n.parentNode; if (!p || p.nodeName === 'SCRIPT' || p.nodeName === 'STYLE') return;
    const prev = trSrc.get(n); if (prev && prev.out === n.data) return;
    const out = trText(n.data); if (out !== n.data) { trSrc.set(n, { src: n.data, out }); n.data = out; }
  } else if (n.nodeType === 1) {
    if (n.nodeName === 'SCRIPT' || n.nodeName === 'STYLE') return;
    ['aria-label', 'placeholder', 'title', 'alt'].forEach((a) => { const v = n.getAttribute && n.getAttribute(a); if (v) { const o = trText(v); if (o !== v) n.setAttribute(a, o); } });
    for (let c = n.firstChild; c; c = c.nextSibling) trNode(c);
  }
}
let trObs = null;
function startI18n() {
  document.documentElement.lang = S.lang;
  if (trObs) trObs.disconnect();
  if (S.lang === 'en') return;
  trNode(document.body);
  trObs = new MutationObserver((recs) => { recs.forEach((r) => { if (r.type === 'characterData') trNode(r.target); else r.addedNodes.forEach(trNode); if (r.type === 'attributes') trNode(r.target); }); });
  trObs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'placeholder', 'title'] });
}
const $ = (s, el) => (el || document).querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const PL = D.planner;
const PLACES = D.places;
const P = Object.fromEntries(PLACES.map((p) => [p.id, p]));

/* ---------- icons ---------- */
const IC = {
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  explore: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  tours: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h7"/>',
  audio: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
  day: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 3h6"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  play: '<path d="M8 5v14l11-7z" fill="currentColor"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>',
  next: '<path d="M6 6v12l8-6z" fill="currentColor"/><path d="M18 6v12"/>',
  prev: '<path d="M18 6v12l-8-6z" fill="currentColor"/><path d="M6 6v12"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  nav: '<path d="m4 11 16-7-7 16-2-7z"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  walk: '<circle cx="13" cy="4.5" r="1.8"/><path d="m11 21 2-6-3-3 1-5 4 3 3 1M10 12l-3 2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  family: '<circle cx="8" cy="7" r="2.5"/><circle cx="17" cy="9" r="2"/><path d="M3 20v-3a5 5 0 0 1 10 0v3M14.5 20v-2a4 4 0 0 1 6.5-3"/>',
  anchor: '<circle cx="12" cy="5" r="2"/><path d="M12 7v14M8 11h8M5 14a7 7 0 0 0 14 0"/>',
  pin: '<path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/><path d="m3 17.5 9 5 9-5" opacity=".55"/>',
  locate: '<circle cx="12" cy="12" r="3.5"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5"/>',
  museum: '<path d="M3 9.5 12 4l9 5.5zM5 11v7M9.5 11v7M14.5 11v7M19 11v7M3 20h18"/>',
  monument: '<path d="M12 3l3 5v11H9V8zM7 21h10"/>',
  park: '<circle cx="12" cy="9" r="6"/><path d="M12 15v6"/>',
  church: '<path d="M12 3v5M9.5 5.5h5M6 21V12l6-4 6 4v9z"/>',
  castle: '<path d="M4 21V8h3v3h3V8h4v3h3V8h3v13zM10 21v-5h4v5"/>',
  train: '<rect x="5" y="4" width="14" height="13" rx="2.5"/><path d="M5 11h14M8 21l2-4M16 21l-2-4"/>',
  taxi: '<path d="M5 15h14l-1.5-5h-11zM3 15v4h3M21 15v4h-3M9 10l.7-2.5h4.6L15 10"/>',
  boat: '<path d="M3 16h18l-2.5 4h-13zM12 3v11M12 4l6 8h-6z"/>',
  star: '<path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-2.9-5.3 2.9 1.2-6-4.5-4.1 6-.7z"/>',
  book: '<path d="M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z"/>',
  food: '<path d="M7 3v7a2 2 0 0 0 2 2v9M5 3v6M9 3v6M17 3c-2 2-2.5 5-2.5 8H17v10"/>',
  warn: '<path d="M12 4 3 20h18z"/><path d="M12 10v4M12 17v.01"/>'
};
function icon(k, s, extra) {
  s = s || 20;
  return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ' + (extra || '') + '>' + (IC[k] || IC.pin) + '</svg>';
}

/* ---------- placeholder artwork (no photos are bundled) ---------- */
let artN = 0;
function pic(p, w) {
  const a = art(p.img.motif, p.img.h);
  const ph = p.photo; if (!ph || !ph.src) return a;
  const src = (w && w <= 400 && ph.thumb) ? ph.thumb : ph.src;
  return a + '<img class="pic" src="' + esc(src.replace('{w}', w || 260)) + '" alt="' + esc(t(p.name)) + '" loading="lazy" decoding="async" referrerpolicy="no-referrer">';
}
document.addEventListener('error', (e) => {
  const el = e.target; if (!el || el.nodeName !== 'IMG' || !el.classList.contains('pic')) return;
  const hero = el.closest('.hero'); if (hero) { const ph = hero.querySelector('.ph'); if (ph) ph.textContent = 'Placeholder illustration'; const cr = document.querySelector('.photocredit'); if (cr) cr.remove(); }
  el.remove();
}, true);
function art(motif, h) {
  const id = 'ag' + (++artN);
  const sky1 = 'hsl(' + h + ' 62% 80%)', sky2 = 'hsl(' + ((h + 35) % 360) + ' 70% 92%)';
  const dk = 'hsl(' + h + ' 38% 24%)', md = 'hsl(' + h + ' 34% 40%)', lt = 'hsl(' + h + ' 40% 62%)';
  const sea = 'hsl(200 46% 40%)';
  let s = '<svg viewBox="0 0 300 180" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Placeholder illustration"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + sky1 + '"/><stop offset="1" stop-color="' + sky2 + '"/></linearGradient></defs><rect width="300" height="180" fill="url(#' + id + ')"/><circle cx="236" cy="44" r="18" fill="hsl(42 95% 70%)" opacity=".85"/>';
  const seaBand = '<rect y="132" width="300" height="48" fill="' + sea + '"/><path d="M0 146q20-6 40 0t40 0 40 0 40 0 40 0 40 0 40 0M0 162q20-6 40 0t40 0 40 0 40 0 40 0 40 0 40 0" stroke="#fff" stroke-opacity=".28" fill="none" stroke-width="2"/>';
  switch (motif) {
    case 'port':
      s += seaBand + '<path d="M50 132h200l-18 20H70z" fill="' + dk + '"/><rect x="95" y="104" width="110" height="28" fill="' + md + '"/><rect x="115" y="86" width="70" height="18" fill="' + lt + '"/><rect x="146" y="68" width="14" height="18" fill="' + dk + '"/><path d="M20 132V70h4v62M20 78h30M262 132V82h4v50" stroke="' + dk + '" stroke-width="3" fill="none"/>';
      break;
    case 'promenade':
      s += seaBand + '<rect y="124" width="300" height="10" fill="' + md + '"/><path d="M0 124h300" stroke="' + dk + '" stroke-width="2"/>';
      [40, 110, 185, 255].forEach(function (x, i) { const y = 124; const hh = 64 + (i % 2) * 14; s += '<path d="M' + x + ' ' + y + 'Q' + (x + 4) + ' ' + (y - hh / 2) + ' ' + (x + 2) + ' ' + (y - hh) + '" stroke="' + dk + '" stroke-width="4" fill="none"/><path d="M' + (x + 2) + ' ' + (y - hh) + 'q-26 -4 -34 14M' + (x + 2) + ' ' + (y - hh) + 'q26 -4 34 14M' + (x + 2) + ' ' + (y - hh) + 'q-16 -16 -26 -10M' + (x + 2) + ' ' + (y - hh) + 'q16 -16 26 -10" stroke="' + md + '" stroke-width="5" fill="none" stroke-linecap="round"/>'; });
      break;
    case 'garden':
      s += '<rect y="120" width="300" height="60" fill="' + md + '"/><path d="M110 180 150 120h4l40 60z" fill="' + lt + '" opacity=".7"/>';
      [[60, 96, 34], [120, 86, 40], [196, 90, 38], [250, 100, 30]].forEach(function (c) { s += '<rect x="' + (c[0] - 3) + '" y="' + c[1] + '" width="6" height="40" fill="' + dk + '"/><circle cx="' + c[0] + '" cy="' + c[1] + '" r="' + c[2] + '" fill="' + dk + '" opacity=".92"/>'; });
      break;
    case 'monument':
      s += '<rect y="140" width="300" height="40" fill="' + md + '"/><rect x="116" y="98" width="68" height="46" fill="' + dk + '"/><rect x="108" y="92" width="84" height="10" fill="' + md + '"/><ellipse cx="150" cy="78" rx="30" ry="14" fill="' + dk + '"/><path d="M120 86l-8 18M178 86l6 18" stroke="' + dk + '" stroke-width="5"/><circle cx="152" cy="56" r="9" fill="' + dk + '"/><path d="M178 70l18-14" stroke="' + dk + '" stroke-width="4"/>';
      break;
    case 'museum':
      s += '<rect y="146" width="300" height="34" fill="' + md + '"/><path d="M60 70 150 28 240 70z" fill="' + dk + '"/><rect x="66" y="74" width="168" height="10" fill="' + md + '"/>';
      [84, 114, 144, 174, 204].forEach(function (x) { s += '<rect x="' + x + '" y="86" width="12" height="58" fill="' + lt + '"/>'; });
      s += '<rect x="56" y="144" width="188" height="10" fill="' + dk + '"/>';
      break;
    case 'cathedral':
      s += '<rect y="148" width="300" height="32" fill="' + md + '"/><path d="M70 148V112q80-66 160 0v36z" fill="' + dk + '"/><path d="M100 148v-30M125 148v-40M150 148v-44M175 148v-40M200 148v-30" stroke="' + lt + '" stroke-width="3" opacity=".7"/><ellipse cx="150" cy="84" rx="64" ry="9" fill="' + md + '"/><rect x="146" y="40" width="8" height="24" fill="' + dk + '"/>';
      break;
    case 'castle':
      s += '<path d="M0 150Q80 100 150 120T300 110V180H0z" fill="' + md + '"/><path d="M96 130V70h14V58h12v12h14V58h12v12h14v60z" fill="' + dk + '"/><rect x="132" y="96" width="14" height="22" rx="7" fill="' + sky1 + '"/><path d="M70 130V96h12v-8h8v8h10v34zM190 130V92h12v-8h8v8h12v38z" fill="' + dk + '" opacity=".92"/>';
      break;
    case 'village': {
      s += seaBand + '<path d="M0 134Q70 88 150 100T300 82V134z" fill="' + md + '"/>';
      const cols = ['hsl(32 70% 62%)', 'hsl(12 62% 58%)', 'hsl(45 78% 66%)', 'hsl(18 55% 70%)', 'hsl(350 45% 62%)'];
      for (let i = 0; i < 9; i++) { const x = 20 + i * 30, y = 92 + (i % 3) * 8 - (i > 5 ? 14 : 0); s += '<rect x="' + x + '" y="' + y + '" width="26" height="' + (34 + (i % 2) * 8) + '" fill="' + cols[i % 5] + '"/><path d="M' + (x - 2) + ' ' + y + 'L' + (x + 13) + ' ' + (y - 9) + 'L' + (x + 28) + ' ' + y + 'z" fill="' + dk + '"/><rect x="' + (x + 8) + '" y="' + (y + 12) + '" width="6" height="9" fill="' + dk + '" opacity=".6"/>'; }
      break;
    }
    case 'train':
      s += '<rect y="132" width="300" height="48" fill="' + md + '"/><path d="M0 146h300M0 160h300" stroke="' + dk + '" stroke-width="3"/><rect x="40" y="86" width="150" height="46" rx="10" fill="' + dk + '"/><rect x="52" y="96" width="30" height="18" rx="3" fill="' + sky1 + '"/><rect x="92" y="96" width="30" height="18" rx="3" fill="' + sky1 + '"/><rect x="132" y="96" width="30" height="18" rx="3" fill="' + sky1 + '"/><rect x="196" y="98" width="62" height="34" rx="8" fill="' + md + '"/>';
      break;
    case 'stone':
      s += '<rect y="140" width="300" height="40" fill="' + md + '"/><path d="M120 150V76q0-30 30-30t30 30v74z" fill="' + dk + '"/><circle cx="150" cy="70" r="8" fill="' + md + '"/><path d="M128 100l-14 12M172 100l14 12M138 118h24M144 118v22M156 118v22" stroke="' + lt + '" stroke-width="4" stroke-linecap="round" fill="none"/>';
      break;
    case 'book':
      s += seaBand + '<path d="M60 124c30-22 60-22 90-6 30-16 60-16 90 6V82c-30-22-60-22-90-6-30-16-60-16-90 6z" fill="' + lt + '"/><path d="M150 76v42" stroke="' + dk + '" stroke-width="3"/><path d="M78 94c16-6 40-6 56 2M166 96c16-8 40-8 56-2M78 106c16-6 40-6 56 2M166 108c16-8 40-8 56-2" stroke="' + dk + '" stroke-width="2" fill="none" opacity=".6"/>';
      break;
    default:
      s += seaBand + '<path d="M0 132Q50 70 110 92T200 60 300 100V132z" fill="' + dk + '"/><path d="M0 132Q60 96 120 112T240 92 300 118V132z" fill="' + md + '"/>';
  }
  return s + '</svg>';
}

/* ---------- state ---------- */
const KEY = 'lsg-proto-v1';
function loadStore() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
const store = loadStore();
const S = {
  tab: 'map', exploreTab: 'places', scope: 'city', filter: 'all', walk: 0, q: '', sort: 'must',
  sel: null, detail: null, sheet: null, toast: null,
  pos: { lat: P.terminal.lat, lon: P.terminal.lon, src: 'terminal' },
  gpsPos: null,
  fav: new Set(store.fav || []),
  day: Object.assign({ ship: '', date: '', arrive: PL.defaults.arrive, aboard: PL.defaults.aboard, margin: PL.defaults.margin, set: false }, store.day || {}),
  plan: store.plan || [],
  route: null, plang: 'en', watch: null,
  audio: { id: null, playing: false, idx: 0, rate: 1, voice: '' }
};
const LG = D.legal;
S.onb = store.onb || null;
S.base = (D.maps && D.maps.length) ? 'img' : 'sketch';
if (store.base === 'img' && D.maps && D.maps.length) S.base = 'img'; else if (store.base === 'sketch') S.base = 'sketch';
(function () {
  let nl = 'en'; try { const b = (navigator.language || 'en').slice(0, 2); if (LG.L[b]) nl = b; } catch (e) {}
  S.lang = (S.onb && S.onb.lang) || nl;
  S.accepted = !!(S.onb && S.onb.v === LG.version && S.onb.at);
  S.gate = !(S.onb && S.onb.lang) ? 'lang' : (S.accepted ? null : 'terms');
  S.plang = S.lang; S.agree = false; S.declined = false; S.gateView = false;
})();
function persist() { try { localStorage.setItem(KEY, JSON.stringify({ fav: [...S.fav], day: S.day, plan: S.plan, onb: S.onb, base: (S.base === 'img' || S.base === 'sketch') ? S.base : null })); } catch (e) {} }

/* ---------- helpers ---------- */
function km(a, b) {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
}
const walkMin = (k) => Math.max(1, Math.round(k * PL.defaults.detour / PL.defaults.walkKmh * 60));
function fmtMin(m) { m = Math.round(m); if (m < 60) return m + ' min'; const h = Math.floor(m / 60), r = m % 60; return r ? h + ' h ' + r + ' min' : h + ' h'; }
function hhmm(min) { min = ((Math.round(min) % 1440) + 1440) % 1440; return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0'); }
function parseT(s) { const m = /^(\d{1,2}):(\d{2})$/.exec(s || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; }
function fmtDist(k) { return k < 1 ? Math.round(k * 100) * 10 + ' m' : k.toFixed(k < 10 ? 1 : 0) + ' km'; }
function todayStr() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function nowMin() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
function toast(msg, act) { S.toast = { msg, act }; renderToast(); clearTimeout(toast._t); toast._t = setTimeout(() => { S.toast = null; renderToast(); }, act ? 9000 : 3600); }
const catLabel = { people: 'People & plaques', museum: 'Museum', heritage: 'History', nature: 'Outdoors', transport: 'Transport', daytrip: 'Day trip' };
const posLabel = () => ({ terminal: 'the terminal', gps: 'your location', demo: 'demo position' }[S.pos.src] || 'the terminal');
function distFrom(p) { return km(S.pos, p); }
const isPeople = (p) => p.cat === 'people' || !!p.person;
const UP = D.ui_people;
const pl = (o) => (o && (o[S.plang] || o.en)) || '';
const up = (k) => pl(UP.strings[k]);
const notified = new Set();
function checkNear() {
  PLACES.forEach((p) => {
    if (!isPeople(p) || p.geo === 'unconfirmed' || notified.has(p.id)) return;
    if (km(S.pos, p) <= 0.15) { notified.add(p.id); toast(up('near_toast') + ': ' + (p.person ? p.person.name : t(p.name)), { a: 'detail', arg: p.id, label: up('open') }); }
  });
}
function walkTxt(p) {
  const k = distFrom(p);
  if (p.area !== 'city' && k > 3) return '≈ ' + Math.round(k) + ' km · needs transport';
  return walkMin(k) + ' min walk';
}
function directionsUrl(p) {
  let u = 'https://www.google.com/maps/dir/?api=1&destination=' + p.lat + ',' + p.lon + '&travelmode=' + (p.area === 'city' ? 'walking' : 'transit');
  if (S.pos.src === 'demo') u += '&origin=' + S.pos.lat + ',' + S.pos.lon;
  return u;
}
function searchUrl(q) { return 'https://www.google.com/search?q=' + encodeURIComponent(q); }

/* ---------- planner maths ---------- */
const zoneOf = (p) => (p.area === 'city' ? 'city' : (p.dest || 'city'));
const plannable = (p) => (p.area === 'city' ? !['terminal', 'station', 'taxi'].includes(p.kind) : !!p.dest);
function legMin(a, b) {
  const za = zoneOf(a), zb = zoneOf(b);
  if (za === zb) return { min: walkMin(km(a, b)), mode: 'walk' };
  const hi = (z) => (z === 'city' ? 0 : PL.zones[z].oneWay[1]);
  return { min: hi(za) + hi(zb), mode: 'transport' };
}
function buildTimeline(ids, start) {
  let tt = start, prev = P.terminal;
  const rows = [];
  ids.map((id) => P[id]).filter(Boolean).forEach((s) => {
    const lg = legMin(prev, s); tt += lg.min; const arrive = tt; tt += s.visitMin; rows.push({ p: s, leg: lg, arrive, leave: tt }); prev = s;
  });
  const back = legMin(prev, P.terminal); tt += back.min;
  return { rows, back, end: tt, total: tt - start };
}
function dayInfo() {
  const arrive = parseT(S.day.arrive), aboard = parseT(S.day.aboard), margin = +S.day.margin;
  const ok = arrive != null && aboard != null && aboard > arrive;
  const ready = ok ? arrive + PL.defaults.disembarkMin : null;
  const deadline = ok ? aboard - margin : null;
  const avail = ok ? deadline - ready : null;
  const live = !S.day.date || S.day.date === todayStr();
  return { ok, arrive, aboard, margin, ready, deadline, avail, live };
}
function feasibility(zoneId, di) {
  const z = PL.zones[zoneId];
  const low = 2 * z.oneWay[0] + z.visit, high = 2 * z.oneWay[1] + z.visit;
  let status = 'bad', label = 'Does not fit';
  if (di.avail != null) {
    if (di.avail >= high + 45) { status = 'ok'; label = 'Fits, with room'; }
    else if (di.avail >= high) { status = 'warn'; label = 'Tight'; }
    else if (di.avail >= low) { status = 'bad'; label = 'Only if nothing goes wrong'; }
  }
  return { z, low, high, status, label };
}

/* ---------- map ---------- */
const KX = 111.32 * Math.cos(44.08 * Math.PI / 180), KY = 111.2;
const proj = (lat, lon) => [(lon - 9.8) * KX, (44.08 - lat) * KY];
const LAND = [[9.50,44.30],[10.10,44.30],[10.10,44.00],[10.00,44.015],[9.965,44.035],[9.935,44.055],[9.922,44.064],[9.915,44.071],[9.906,44.0738],[9.897,44.0730],[9.885,44.0770],[9.874,44.0795],[9.866,44.0830],[9.858,44.0890],[9.851,44.0945],[9.848,44.0995],[9.8445,44.1050],[9.8405,44.1086],[9.8335,44.1084],[9.8300,44.1076],[9.8283,44.1058],[9.8270,44.1040],[9.8250,44.1027],[9.8230,44.1014],[9.8225,44.1006],[9.8185,44.0995],[9.8162,44.0970],[9.8180,44.0925],[9.8230,44.0870],[9.8310,44.0815],[9.8385,44.0770],[9.8425,44.0715],[9.8435,44.0655],[9.8405,44.0595],[9.8365,44.0545],[9.8345,44.0505],[9.8310,44.0495],[9.8230,44.0530],[9.8130,44.0595],[9.7990,44.0660],[9.7850,44.0730],[9.7700,44.0800],[9.7550,44.0875],[9.7430,44.0940],[9.7385,44.0985],[9.7285,44.1062],[9.7105,44.1178],[9.6845,44.1345],[9.6545,44.1445],[9.6000,44.1650],[9.5000,44.2000]];
const PALMARIA = [[9.8330,44.0470],[9.8395,44.0478],[9.8445,44.0430],[9.8455,44.0335],[9.8395,44.0275],[9.8335,44.0300],[9.8310,44.0390]];
const RAIL = [[9.8135,44.1113],[9.8190,44.1075],[9.7800,44.1060],[9.7388,44.0996],[9.7295,44.1075],[9.7108,44.1186],[9.6845,44.1350],[9.6545,44.1458]];
const SCOPES = {
  city: { lat: 44.1050, lon: 9.8268, scale: 155, label: 'City' },
  gulf: { lat: 44.0770, lon: 9.8680, scale: 42, label: 'Gulf' },
  coast: { lat: 44.0950, lon: 9.8400, scale: 10, label: 'Coast' }
};
const V = { cx: 0, cy: 0, scale: 210, W: 400, H: 600 };
(function () { const c = SCOPES.city; const [x, y] = proj(c.lat, c.lon); V.cx = x; V.cy = y; V.scale = c.scale; })();
const sx = (x) => (x - V.cx) * V.scale + V.W / 2;
const sy = (y) => (y - V.cy) * V.scale + V.H / 2;
function scr(lat, lon) { const [x, y] = proj(lat, lon); return [sx(x), sy(y)]; }
function pathOf(poly, close) { return poly.map((c, i) => { const [a, b] = scr(c[1], c[0]); return (i ? 'L' : 'M') + a.toFixed(1) + ' ' + b.toFixed(1); }).join('') + (close ? 'Z' : ''); }
const isTheme = (p) => p.kind === 'theme' || p.geo === 'area';
function passes(p) {
  const f = S.filter;
  if (f === 'themes') return isTheme(p);
  if (isTheme(p)) return f === 'saved' && S.fav.has(p.id);
  if (f === 'all') return true;
  if (f === 'must') return !!p.flags.must;
  if (f === 'photo') return !!p.flags.photo;
  if (f === 'family') return p.flags.family === 'likely';
  if (f === 'saved') return S.fav.has(p.id);
  if (f === 'people') return isPeople(p);
  return p.cat === f;
}
function passesWalk(p) {
  if (!S.walk) return true;
  if (p.id === 'terminal') return true;
  if (p.area !== 'city') return false;
  return walkMin(km(P.terminal, p)) <= S.walk;
}
function markerVisible(p) {
  if (p.id === 'terminal') return true;
  if (isTheme(p)) return false;
  if (!passes(p) || !passesWalk(p)) return p.id === S.sel;
  return true;
}
function labelVisible(p) {
  const s = V.scale;
  return p.id === S.sel || p.id === 'terminal' || s >= 260 || (s >= 130 && p.tier === 1) || (s < 130 && s >= 40 && p.tier === 1 && p.area !== 'city');
}

/* ---------- real map tiles under the SVG layer (same view model: V) ---------- */
const BASEMAPS = {
  osm: { label: 'Map', attr: 'Map data © OpenStreetMap contributors', max: 19, url: (z, x, y) => 'https://tile.openstreetmap.org/' + z + '/' + x + '/' + y + '.png' },
  sat: { label: 'Satellite', attr: 'Imagery © Esri, Maxar, Earthstar Geographics and the GIS User Community', max: 19, url: (z, x, y) => 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' + z + '/' + y + '/' + x },
  img: { label: 'Map', attr: (D.maps && D.maps[0] && D.maps[0].attr) || 'Map © OpenStreetMap contributors', max: 0, url: null },
  sketch: { label: 'Sketch', attr: 'Stylised map · positions approximate · not for navigation', max: 0, url: null }
};
const tileEls = new Map(); let tileOK = 0, tileErr = 0, tilePending = 0;
const tile2lat = (y, n) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
function dropTiles(keepKeys) { tileEls.forEach((el, k) => { if (!keepKeys || !keepKeys.has(k)) { el.remove(); tileEls.delete(k); } }); }
function drawTiles() {
  const host = $('#tiles'); if (!host) return;
  const B = BASEMAPS[S.base];
  if (S.base === 'img') { dropTiles(null); drawImgs(host); return; }
  if (!B.url) { dropTiles(null); drawImgs(host, true); return; }
  const lat0 = 44.1;
  let z = Math.round(Math.log2(V.scale * 40075.017 * Math.cos(lat0 * Math.PI / 180) / 256) + 0.5);
  z = Math.max(3, Math.min(B.max, z));
  const inv = (px, py) => { const x = (px - V.W / 2) / V.scale + V.cx, y = (py - V.H / 2) / V.scale + V.cy; return [44.08 - y / KY, 9.8 + x / KX]; };
  const [laN, loW] = inv(0, 0), [laS, loE] = inv(V.W, V.H);
  const n = Math.pow(2, z);
  const tx = (lon) => (lon + 180) / 360 * n;
  const ty = (lat) => { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n; };
  const x0 = Math.floor(tx(loW)), x1 = Math.floor(tx(loE)), y0 = Math.floor(ty(laN)), y1 = Math.floor(ty(laS));
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > 80) return;
  const cur = new Set();
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    if (y < 0 || y >= n) continue;
    const xx = ((x % n) + n) % n, key = S.base + '/' + z + '/' + xx + '/' + y;
    cur.add(key);
    let el = tileEls.get(key);
    if (!el) {
      el = document.createElement('img'); el.alt = ''; el.decoding = 'async'; el.draggable = false; el.referrerPolicy = 'no-referrer'; el.className = 'tile';
      tilePending++;
      el.onload = () => { tileOK++; tilePending = Math.max(0, tilePending - 1); el.classList.add('ok'); if (tilePending === 0) dropTiles(lastCur); };
      el.onerror = () => { tileErr++; tilePending = Math.max(0, tilePending - 1); el.remove(); tileEls.delete(key); if (tileOK === 0 && tileErr >= 6 && S.base !== 'sketch') tilesFailed(); };
      el.src = B.url(z, xx, y); host.appendChild(el); tileEls.set(key, el);
    }
    const lonL = x / n * 360 - 180, lonR = (x + 1) / n * 360 - 180;
    const [a, b] = scr(tile2lat(y, n), lonL), [c, d] = scr(tile2lat(y + 1, n), lonR);
    el.style.cssText = 'left:' + a.toFixed(1) + 'px;top:' + b.toFixed(1) + 'px;width:' + (c - a + 0.8).toFixed(1) + 'px;height:' + (d - b + 0.8).toFixed(1) + 'px;z-index:' + z;
  }
  lastCur = cur;
  if (tilePending === 0) dropTiles(cur);
}
let lastCur = new Set();
const imgEls = new Map();
function drawImgs(host, hide) {
  (D.maps || []).forEach((m, i) => {
    let el = imgEls.get(i);
    if (!el || el.parentNode !== host) { el = document.createElement('img'); el.alt = ''; el.draggable = false; el.className = 'mapimg'; el.src = m.src; host.appendChild(el); imgEls.set(i, el); }
    const [a, b] = scr(m.n, m.w), [c, d] = scr(m.s, m.e);
    const inRange = !hide && V.scale >= (m.min || 0) && V.scale <= (m.max || 1e9) && c > 0 && a < V.W && d > 0 && b < V.H;
    el.style.display = inRange ? 'block' : 'none';
    if (inRange) el.style.cssText = 'display:block;left:' + a.toFixed(1) + 'px;top:' + b.toFixed(1) + 'px;width:' + (c - a).toFixed(1) + 'px;height:' + (d - b).toFixed(1) + 'px;z-index:' + (m.z || (10 + (m.min || 0) / 10 | 0));
  });
}
function tilesFailed() {
  S.base = 'sketch'; dropTiles(null); updateAttr(); drawMap();
  toast('Online map tiles cannot load here, so the stylised map is shown instead.');
}
function updateAttr() { const el = $('#mapattr'); if (el) el.textContent = BASEMAPS[S.base].attr; const w = $('#mapwrap'); if (w) { w.classList.toggle('real', S.base === 'osm' || S.base === 'sat'); w.classList.toggle('imgmode', S.base === 'img'); } }
function drawSketch() {
  let o = '';
  o += '<rect width="' + V.W + '" height="' + V.H + '" fill="var(--sea)"/>';
  o += '<path d="' + pathOf(LAND, true) + '" fill="var(--land)" stroke="var(--coast)" stroke-width="1.5" stroke-linejoin="round"/>';
  o += '<path d="' + pathOf(PALMARIA, true) + '" fill="var(--land)" stroke="var(--coast)" stroke-width="1.5"/>';
  if (V.scale < 140) o += '<path d="' + pathOf(RAIL, false) + '" fill="none" stroke="var(--ink2)" stroke-width="1.6" stroke-dasharray="5 4" opacity=".7"/>';
  const wl = (lat, lon, txt, minS, maxS) => { if (V.scale < minS || V.scale > maxS) return ''; const [a, b] = scr(lat, lon); return '<text class="lbl water" x="' + a.toFixed(0) + '" y="' + b.toFixed(0) + '" text-anchor="middle">' + txt + '</text>'; };
  o += wl(44.0650, 9.8760, 'GULF OF LA SPEZIA', 25, 120);
  o += wl(44.0300, 9.7600, 'LIGURIAN SEA', 12, 90);
  o += wl(44.1185, 9.6800, 'CINQUE TERRE', 12, 40);
  o += wl(44.0870, 9.8660, 'Gulf', 120, 330);
  return o;
}
let HIT = [];
function drawMap() {
  const svg = $('#mapsvg'); if (!svg) return;
  drawTiles();
  const sk = S.base === 'sketch' || S.base === 'img';
  const bsv = $('#mapbase');
  if (bsv) bsv.innerHTML = sk ? drawSketch() : '';
  let o = '';
  // walking rings from the terminal
  if (V.scale >= 100) {
    const [tx, ty] = scr(P.terminal.lat, P.terminal.lon);
    [10, 20, 30].forEach((m) => {
      const rkm = m / 60 * PL.defaults.walkKmh / PL.defaults.detour, r = rkm * V.scale;
      o += '<circle cx="' + tx.toFixed(1) + '" cy="' + ty.toFixed(1) + '" r="' + r.toFixed(1) + '" fill="none" stroke="var(--accent)" stroke-width="1.2" stroke-dasharray="3 5" opacity=".55"/>';
      o += '<text class="lbl" x="' + (tx + r * 0.707).toFixed(0) + '" y="' + (ty - r * 0.707).toFixed(0) + '" style="fill:var(--accent)" text-anchor="start">' + m + ' min</text>';
    });
  }
  if (S.route && S.route.pts.length > 1) {
    o += '<path d="' + pathOf(S.route.pts.map((q) => [q.lon, q.lat]), false) + '" fill="none" stroke="var(--alert)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1 9" />';
    o += '<path d="' + pathOf(S.route.pts.map((q) => [q.lon, q.lat]), false) + '" fill="none" stroke="var(--alert)" stroke-width="2" stroke-opacity=".6" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  /* every place is drawn as its own marker (no grouping); the selected one and the terminal sit on top */
  const drawList = [];
  PLACES.filter(markerVisible).forEach((p) => { const [x, y] = scr(p.lat, p.lon); if (x < -40 || y < -40 || x > V.W + 40 || y > V.H + 40) return; drawList.push({ p, x, y, mem: [] }); });
  const prio = (i) => (i.p.id === S.sel ? 0 : i.p.id === 'terminal' ? 1 : 2 + (i.p.tier || 2) * 2 - (i.p.flags.must ? 1 : 0));
  drawList.sort((a, b) => prio(a) - prio(b)); drawList.reverse();
  HIT = [];
  drawList.forEach(({ p, x, y, mem }) => {
    const isT = p.id === 'terminal', isSel = p.id === S.sel;
    const r = isT ? 19 : (isSel ? 18 : 15);
    HIT.push({ id: p.id, x, y, r });
    const dim = !(passes(p) && passesWalk(p)) && !isT;
    o += '<g class="mk cat-' + p.cat + '" data-pid="' + p.id + '" transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')" opacity="' + (dim ? .45 : 1) + '" role="button" aria-label="' + esc(t(p.name)) + '">';
    if (isT) o += '<circle class="pulse" r="' + r + '" fill="var(--accent)"/>';
    if (isSel && !isT) o += '<circle class="pulse" r="' + r + '" fill="var(--cc)"/>';
    o += '<circle r="' + r + '" fill="' + (isT ? 'var(--accent)' : 'var(--cc)') + '" stroke="' + (isT ? 'var(--facade)' : '#fff') + '" stroke-width="' + (isT ? 3.5 : 2.5) + '"' + (p.geo === 'unconfirmed' ? ' stroke-dasharray="3 3"' : '') + '/>';
    const gs = r / 12 * 0.82; // glyph scale
    o += '<g transform="translate(' + (-12 * gs).toFixed(1) + ' ' + (-12 * gs).toFixed(1) + ') scale(' + gs.toFixed(2) + ')" fill="none" stroke="' + (isT ? 'var(--accent-ink)' : 'var(--on-c)') + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + (IC[p.icon] || IC.pin) + '</g>';
    if (isPeople(p) && !isT) o += '<circle cx="' + (r * 0.74).toFixed(1) + '" cy="' + (-r * 0.74).toFixed(1) + '" r="5.5" fill="var(--c-people)" stroke="#fff" stroke-width="1.6"/>';
    if (labelVisible(p)) o += '<text class="lbl" y="' + (r + 13) + '" text-anchor="middle">' + esc(isT ? 'Cruise Terminal' : shortName(p)) + '</text>';
    o += '</g>';
  });
  if (S.pos.src !== 'terminal') {
    const [x, y] = scr(S.pos.lat, S.pos.lon);
    o += '<g transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')"><circle r="16" fill="#2D7FF9" opacity=".18"/><circle r="8" fill="#2D7FF9" stroke="#fff" stroke-width="3"/><text class="lbl" y="26" text-anchor="middle">You (' + (S.pos.src === 'demo' ? 'demo' : 'GPS') + ')</text></g>';
  }
  svg.innerHTML = o;
}
function shortName(p) {
  const n = t(p.name);
  return n.length > 26 ? n.replace(/ \(.*\)/, '').replace(/^Cathedral of Christ the King.*/, 'Cristo Re Cathedral').replace(/^San Giorgio Castle.*/, 'San Giorgio Castle').replace(/^Passeggiata Morin.*/, 'Passeggiata Morin').replace(/^Historic centre.*/, 'Via del Prione').replace(/^How a navy.*/, 'The Arsenal').replace(/, Portovenere$/, '').replace(/: what is realistic$/, '').replace(/^La Spezia Centrale railway station$/, 'La Spezia Centrale').replace(/^Taxi rank.*/, 'Taxi rank').replace(/^Piazza Verdi.*/, 'Piazza Verdi').replace(/^Wartime shelter.*/, 'Wartime shelter').replace(/^Liberty:.*/, 'Liberty').replace(/^Futurism:.*/, 'Futurism').replace(/^Luni:.*/, 'Roman Luni').replace(/^CAMeC.*/, 'CAMeC').replace(/^Admiralty Palace.*/, 'Admiralty Palace').replace(/^Covered market.*/, 'Covered market').replace(/^Winged Victory.*/, 'Winged Victory').replace(/^Galleria Quintino.*/, 'Quintino Sella').slice(0, 26) : n;
}
let raf = 0;
function schedule() { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; drawMap(); }); }
function zoomAt(newScale, ax, ay) {
  newScale = Math.min(1400, Math.max(10, newScale));
  const wx = (ax - V.W / 2) / V.scale + V.cx, wy = (ay - V.H / 2) / V.scale + V.cy;
  V.scale = newScale; V.cx = wx - (ax - V.W / 2) / newScale; V.cy = wy - (ay - V.H / 2) / newScale;
  schedule();
}
let tween = 0;
function flyTo(lat, lon, scale, yOffsetPx) {
  const [x, y] = proj(lat, lon); const sc = scale || V.scale;
  const tx = x, ty = y + (yOffsetPx || 0) / sc;
  const from = { cx: V.cx, cy: V.cy, ls: Math.log(V.scale) }, to = { cx: tx, cy: ty, ls: Math.log(sc) };
  const t0 = performance.now(), dur = 380; cancelAnimationFrame(tween);
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { V.cx = to.cx; V.cy = to.cy; V.scale = Math.exp(to.ls); drawMap(); return; }
  (function step(now) {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    V.cx = from.cx + (to.cx - from.cx) * e; V.cy = from.cy + (to.cy - from.cy) * e; V.scale = Math.exp(from.ls + (to.ls - from.ls) * e);
    drawMap(); if (k < 1) tween = requestAnimationFrame(step);
  })(t0);
}
function setScope(id) {
  S.scope = id; const c = SCOPES[id]; flyTo(c.lat, c.lon, c.scale, 0); renderMapUI();
}
function selectPlace(id) {
  S.sel = id; const p = P[id];
  const off = (V.H * 0.18);
  flyTo(p.lat, p.lon, Math.max(V.scale, p.area === 'city' ? 190 : 60), off);
  renderMapUI(); drawMap();
}
function openFromMap(id) { S.multi = null; S.sel = id; renderMapUI(); drawMap(); A.detail(id); }
function clearSel() { if (!S.sel && !S.multi) return; S.sel = null; S.multi = null; renderMapUI(); drawMap(); }

function bindMap() {
  const host = $('#mapwrap'), svg = $('#mapsvg');
  const ptrs = new Map(); let drag = null, pinch = null, moved = 0;
  host.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.mapui,.zoom,.mapcard')) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; cancelAnimationFrame(tween);
    if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, cx: V.cx, cy: V.cy, tgt: e.target };
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y), s0: V.scale }; moved = 99; }
  });
  window.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return;
    const q = ptrs.get(e.pointerId); q.x = e.clientX; q.y = e.clientY;
    if (ptrs.size === 2 && pinch) {
      const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const r = svg.getBoundingClientRect();
      zoomAt(pinch.s0 * d / pinch.d0, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
    } else if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved = Math.max(moved, Math.hypot(dx, dy));
      if (moved > 5) { V.cx = drag.cx - dx / V.scale; V.cy = drag.cy - dy / V.scale; schedule(); }
    }
  });
  const up = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (ptrs.size === 0) {
      if (drag && moved <= 5 && e.type === 'pointerup') {
        const rc = svg.getBoundingClientRect(), px = e.clientX - rc.left, py = e.clientY - rc.top;
        const hits = HIT.map((h) => ({ id: h.id, d: Math.hypot(px - h.x, py - h.y), r: h.r })).filter((h) => h.d <= h.r + 7).sort((a, b) => a.d - b.d);
        if (!hits.length) clearSel();
        else { const tie = hits.filter((h) => h.d <= hits[0].d + 7); if (tie.length === 1) openFromMap(tie[0].id); else { S.multi = tie.map((h) => h.id); S.sel = null; renderMapUI(); drawMap(); } }
      }
      drag = null; pinch = null;
    } else if (ptrs.size === 1) { const q = [...ptrs.values()][0]; drag = { x: q.x, y: q.y, cx: V.cx, cy: V.cy, tgt: document.body }; moved = 99; pinch = null; }
  };
  window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  host.addEventListener('wheel', (e) => { if (e.target.closest('.mapui,.mapcard')) return; e.preventDefault(); const r = svg.getBoundingClientRect(); zoomAt(V.scale * Math.exp(-e.deltaY * 0.0016), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  const ro = new ResizeObserver(() => { const r = svg.getBoundingClientRect(); if (r.width) { V.W = r.width; V.H = r.height; drawMap(); updateCardH(); } });
  ro.observe(svg);
}
function updateCardH() { const c = $('.mapcard'); const w = $('#mapwrap'); if (c && w) w.style.setProperty('--cardh', c.offsetHeight + 'px'); }

/* ---------- map overlay UI ---------- */
const FILTERS = [['all', 'All'], ['must', 'Must-see'], ['museum', 'Museums'], ['heritage', 'History'], ['people', UP.filter_label.en], ['nature', 'Outdoors'], ['photo', 'Photo spots'], ['family', 'Family'], ['transport', 'Transport'], ['daytrip', 'Day trips'], ['saved', 'Saved']];
function chipsHtml(forMap) { return FILTERS.filter(([id]) => !(forMap && id === 'themes')).map(([id, l]) => '<button class="chip" data-act="filter" data-arg="' + id + '" aria-pressed="' + (S.filter === id) + '">' + l + '</button>').join(''); }
function posSelectHtml() {
  const opts = [['terminal', 'From: Terminal'], ['gps', 'From: My location' + (S.gpsPos ? '' : ' (tap locate)')], ['d_station', 'From demo: station'], ['d_wagner_plaque', 'From demo: Via del Prione'], ['d_giardini', 'From demo: gardens'], ['d_castello', 'From demo: castle'], ['d_manarola', 'From demo: Manarola']];
  const cur = S.pos.src === 'demo' ? S.pos.demoId : S.pos.src;
  return '<select id="possel" data-bind="pos" aria-label="Where distances are measured from">' + opts.map(([v, l]) => '<option value="' + v + '"' + (v === cur ? ' selected' : '') + (v === 'gps' && !S.gpsPos ? ' disabled' : '') + '>' + l + '</option>').join('') + '</select>';
}
function renderMapUI() {
  const ui = $('#mapui'); if (!ui) return;
  ui.innerHTML = '<div class="chips" role="group" aria-label="Filter places">' + chipsHtml(true) + '</div>' +
    '<div class="maprow"><div class="seg" role="group" aria-label="Map area">' + Object.keys(SCOPES).map((k) => '<button data-act="scope" data-arg="' + k + '" aria-pressed="' + (S.scope === k) + '">' + SCOPES[k].label + '</button>').join('') + '</div>' +
    '<div class="row" style="gap:6px"><select id="walksel" data-bind="walk" aria-label="Limit by walking time from the terminal"><option value="0">Any walk</option>' + [10, 20, 30].map((m) => '<option value="' + m + '"' + (S.walk === m ? ' selected' : '') + '>≤ ' + m + ' min walk</option>').join('') + '</select></div></div>' +
    '<div class="maprow" style="justify-content:flex-end">' + posSelectHtml() + '</div>';
  const wrap = $('#mapwrap'); const cardHost = $('#mapcard');
  const p = S.sel && P[S.sel];
  if (!p && S.multi && S.multi.length) {
    wrap.classList.add('hascard');
    cardHost.innerHTML = '<div class="mapcard multi"><div class="small muted" style="font-weight:700">Several places here. Choose one:</div>' + S.multi.map((id) => P[id]).filter(Boolean).map((q) => '<button class="pitem cat-' + q.cat + '" data-act="detail" data-arg="' + q.id + '"><div class="thumb">' + pic(q) + '</div><div class="mid"><div class="nm">' + esc(t(q.name)) + '</div></div></button>').join('') + '</div>';
    updateCardH(); return;
  }
  wrap.classList.toggle('hascard', !!p);
  if (!p) { cardHost.innerHTML = ''; return; }
  const k = distFrom(p);
  cardHost.innerHTML = '<div class="mapcard cat-' + p.cat + '"><button class="head" data-act="detail" data-arg="' + p.id + '" aria-label="Open details for ' + esc(t(p.name)) + '"><div class="thumb">' + pic(p) + '</div><div style="min-width:0;flex:1"><div class="nm">' + esc(t(p.name)) + '</div><div class="it">' + esc(p.name.it) + '</div><div class="meta"><span><i class="dot"></i>' + (catLabel[p.cat] || '') + '</span><span>' + icon('walk', 14) + walkTxt(p) + '</span>' + (p.visitMin ? '<span>' + icon('clock', 14) + '~' + fmtMin(p.visitMin) + '</span>' : '') + '</div></div></button>' +
    '<div class="tl">' + esc(t(p.tagline)) + (p.geo !== 'area' && p.geo !== 'confirmed' ? ' <span class="muted small">· Position approximate</span>' : '') + '</div>' +
    '<div class="acts"><button class="btn sm" data-act="detail" data-arg="' + p.id + '">Details</button><button class="btn sm sec" data-act="play" data-arg="' + p.id + '">' + icon('audio', 16) + ' Listen</button><button class="btn sm sec" data-act="routeTo" data-arg="' + p.id + '">' + icon('nav', 16) + ' Route</button><button class="ibtn" data-act="fav" data-arg="' + p.id + '" aria-pressed="' + S.fav.has(p.id) + '" aria-label="Save to favourites">' + icon('heart', 18) + '</button></div></div>';
  updateCardH();
}

/* ---------- screens ---------- */
function mapScreen() {
  return '<div class="mapwrap' + ((S.base === 'osm' || S.base === 'sat') ? ' real' : '') + (S.base === 'img' ? ' imgmode' : '') + '" id="mapwrap"><svg id="mapbase" aria-hidden="true"></svg><div id="tiles" aria-hidden="true"></div><svg id="mapsvg" role="application" aria-label="Interactive map of La Spezia and the Gulf. Drag to move, pinch or use the buttons to zoom."></svg>' +
    '<div class="mapui" id="mapui"></div>' +
    '<div class="zoom"><button class="ibtn" data-act="locate" aria-label="Use my location">' + icon('locate', 20) + '</button><button class="ibtn" data-act="basemap" aria-label="Change map style">' + icon('layers', 20) + '</button><button class="ibtn" data-act="zoomIn" aria-label="Zoom in">' + icon('plus', 20) + '</button><button class="ibtn" data-act="zoomOut" aria-label="Zoom out">' + icon('minus', 20) + '</button><button class="ibtn" data-act="home" aria-label="Centre on the cruise terminal">' + icon('anchor', 20) + '</button></div>' +
    '<div class="mapnote" id="mapattr">' + esc(BASEMAPS[S.base].attr) + '</div><div id="mapcard"></div></div>';
}
function placeItem(p) {
  const hasAudio = true;
  return '<div class="pitem cat-' + p.cat + '"><button class="thumb" data-act="detail" data-arg="' + p.id + '" aria-label="Open ' + esc(t(p.name)) + '" style="padding:0">' + pic(p) + '</button>' +
    '<button class="mid" data-act="detail" data-arg="' + p.id + '" style="text-align:left"><div class="nm">' + esc(t(p.name)) + '</div><div class="tl">' + esc(t(p.tagline)) + '</div>' +
    '<div class="meta"><span><i class="dot"></i>' + (catLabel[p.cat] || '') + '</span><span>' + icon('walk', 13) + walkTxt(p) + '</span>' + (p.visitMin ? '<span>' + icon('clock', 13) + fmtMin(p.visitMin) + '</span>' : '') + (p.flags.photo ? '<span>' + icon('camera', 13) + 'Photo</span>' : '') + '</div></button>' +
    '<button class="ibtn" data-act="fav" data-arg="' + p.id + '" aria-pressed="' + S.fav.has(p.id) + '" aria-label="Save to favourites">' + icon('heart', 18) + '</button></div>';
}
function placesList() {
  const q = S.q.trim().toLowerCase();
  let l = PLACES.filter((p) => p.id !== 'taxi' || S.filter === 'all' || S.filter === 'transport').filter(passes);
  if (q) l = l.filter((p) => (t(p.name) + ' ' + p.name.it + ' ' + t(p.tagline)).toLowerCase().includes(q));
  if (S.sort === 'near') l.sort((a, b) => distFrom(a) - distFrom(b));
  else l.sort((a, b) => (b.flags.must - a.flags.must) || (a.area === 'city' ? 0 : 1) - (b.area === 'city' ? 0 : 1) || distFrom(a) - distFrom(b));
  if (!l.length) return '<div class="notice info">' + icon('info', 18) + '<div>No places match. Try another filter' + (S.filter === 'saved' ? ' or tap the heart on a place to save it.' : '.') + '</div></div>';
  return l.map(placeItem).join('');
}
function themeItem(p) {
  return '<div class="pitem cat-' + p.cat + '"><button class="thumb" data-act="detail" data-arg="' + p.id + '" aria-label="Open ' + esc(t(p.name)) + '" style="padding:0">' + pic(p) + '</button>' +
    '<button class="mid" data-act="detail" data-arg="' + p.id + '" style="text-align:left"><div class="nm">' + esc(t(p.name)) + '</div><div class="tl">' + esc(t(p.tagline)) + '</div>' +
    '<div class="meta"><span class="pill info">Theme</span><span>Not a single address</span></div></button>' +
    '<button class="ibtn" data-act="fav" data-arg="' + p.id + '" aria-pressed="' + S.fav.has(p.id) + '" aria-label="Save to favourites">' + icon('heart', 18) + '</button></div>';
}
function themesTab() {
  const l = PLACES.filter(isTheme);
  return '<div><h2 class="title-xl" style="font-size:22px">Themes</h2><p class="muted" style="margin-top:6px">These are themes and areas, not single addresses, so they do not appear on the map.</p></div>' +
    '<div style="display:flex;flex-direction:column;gap:10px">' + l.map(themeItem).join('') + '</div>';
}
function exploreScreen() {
  let h = '<div class="pad"><div class="seg segscroll" role="group" aria-label="Explore sections" style="align-self:stretch">' + [['places', 'Places'], ['themes', 'Themes'], ['history', 'History'], ['people', UP.tab_label.en], ['food', 'Food'], ['events', 'Events'], ['transport', 'Transport']].map(([k, l]) => '<button data-act="explore" data-arg="' + k + '" aria-pressed="' + (S.exploreTab === k) + '">' + l + '</button>').join('') + '</div>';
  if (S.exploreTab === 'places') {
    h += '<label class="search">' + icon('search', 18) + '<input id="q" type="search" placeholder="Search places by name" value="' + esc(S.q) + '" data-bind="q" autocomplete="off"></label>';
    h += '<div class="chips" style="margin:0 calc(-1*var(--gutr)) 0 calc(-1*var(--gutl));padding:2px var(--gutr) 2px var(--gutl)">' + chipsHtml() + '</div>';
    h += '<div class="row" style="justify-content:space-between"><span class="small muted">Distances from ' + posLabel() + '</span><select data-bind="sort" aria-label="Sort"><option value="must"' + (S.sort === 'must' ? ' selected' : '') + '>Must-see first</option><option value="near"' + (S.sort === 'near' ? ' selected' : '') + '>Nearest first</option></select></div>';
    h += '<div id="plist" style="display:flex;flex-direction:column;gap:10px">' + placesList() + '</div>';
  } else if (S.exploreTab === 'themes') {
    h += themesTab();
  } else if (S.exploreTab === 'transport') {
    h += transportTab();
  } else if (S.exploreTab === 'history') {
    h += historyTab();
  } else if (S.exploreTab === 'people') {
    h += peopleTab();
  } else if (S.exploreTab === 'food') {
    h += '<div class="notice info">' + icon('info', 18) + '<div>This guide explains the dishes. It does not list restaurants, prices or hours yet, because nothing has been verified on site. Venue listings will be added after checking each one.</div></div>';
    h += D.food.map(foodCard).join('');
  } else {
    h += eventsHtml();
  }
  return h + '</div>';
}
function foodCard(f) {
  return '<details class="acc" style="padding:0 14px"><summary><span><b style="font-family:var(--display);font-size:17px">' + esc(t(f.name)) + '</b><br><span class="small muted" style="font-weight:500">' + esc(t(f.tagline)) + '</span></span>' + icon('down', 18) + '</summary><div class="body">' + (f.photo ? '<figure class="foodimg"><img src="' + f.photo.src + '" alt="' + esc(t(f.name)) + '" loading="lazy"><figcaption class="small muted">' + esc(f.photo.credit) + '</figcaption></figure>' : '') +
    '<div><b>What it is.</b> ' + esc(t(f.what)) + '</div><div><b>How it is made.</b> ' + esc(t(f.how)) + '</div><div><b>Why it is local.</b> ' + esc(t(f.local)) + '</div><div><b>What to expect.</b> ' + esc(t(f.expect)) + '</div>' +
    '<div class="notice info" style="font-style:italic">' + esc(f.name.it) + ' · “' + esc(t(f.say)) + '”</div>' +
    '<div class="small muted">Where to try it: venue list not published yet. Ask at a local trattoria or bakery, and check opening hours yourself.</div>' +
    '<details class="small muted"><summary style="min-height:30px;font-weight:600;cursor:pointer">To verify before publishing</summary>' + esc(f.verify.join(' · ')) + '</details></div></details>';
}
function ruleMatches(r, d) {
  const wd = d.getDay(), m = d.getMonth() + 1, day = d.getDate();
  if (r.type === 'fixed') return m === r.month && day === r.day;
  if (r.type === 'nthWeekday') return m === r.month && wd === r.weekday && Math.ceil(day / 7) === r.n;
  if (r.type === 'monthlyNth') return wd === r.weekday && Math.ceil(day / 7) === r.n && !(r.except || []).includes(m);
  if (r.type === 'weekly') return wd === r.weekday;
  if (r.type === 'range') { const k = m * 100 + day; return k >= r.from[0] * 100 + r.from[1] && k <= r.to[0] * 100 + r.to[1]; }
  return false;
}
function nextOcc(rule) { let d = new Date(); d = new Date(d.getFullYear(), d.getMonth(), d.getDate()); for (let i = 0; i < 400; i++) { if (ruleMatches(rule, d)) return d; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); } return null; }
const fmtDate = (d) => d.toLocaleDateString(LOCALE[S.lang] || 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
/* events that usually fall on the traveller's call date (pattern only, never confirmed) */
function dayEventsInfo() {
  const ds = S.day.date || todayStr(), d = new Date(ds + 'T12:00:00');
  const list = isNaN(d) ? [] : D.events.filter((e) => ruleMatches(e.rule, d));
  return { date: d, list };
}
function dayEventsStrip() {
  const { list } = dayEventsInfo(); if (!list.length) return '';
  const names = list.map((e) => t(e.name)).join(' · ');
  return '<button class="retstrip evstrip" data-act="goExplore" data-arg="events">' + icon('info', 16) + '<span><span>' + esc(list.length === 1 ? 'Event on your day:' : 'Events on your day:') + '</span> <b>' + esc(names) + '</b></span></button>';
}
function dayEventsCard() {
  const { date, list } = dayEventsInfo();
  let h = '<div class="card"><h2>' + (list.length > 1 ? 'Events on your day' : 'Event on your day') + '</h2><div class="small muted">' + esc(fmtDate(date)) + '</div>' + (S.day.date ? '' : '<div class="small muted">Showing today\'s date. Enter your call date above to check another day.</div>');
  if (!list.length) {
    h += '<p>No event from this guide\'s list matches this date. That does not mean nothing is on, so check the local programme.</p>';
  } else {
    h += list.map((e) => '<div class="evrow"><div class="row" style="flex-wrap:wrap"><b>' + esc(t(e.name)) + '</b>' + (e.outside ? '<span class="pill warn">Outside La Spezia</span>' : '') + '</div><div class="small muted">' + esc(t(e.where)) + '</div><p>' + rich(t(e.summary), null) + '</p><div class="small">' + rich(t(e.cruiseNote), null) + '</div></div>').join('');
    h += '<div class="notice">' + icon('warn', 18) + '<div>These come from the usual pattern of each event, not from an official programme, so they are not confirmed for this date. Check the programme before you plan around them.</div></div>';
  }
  h += '<div class="row" style="flex-wrap:wrap">' + (list.length ? '<button class="btn sm line" data-act="goExplore" data-arg="events">See event details</button>' : '') + '<a class="btn sm line" target="_blank" rel="noopener" href="' + searchUrl('eventi La Spezia ' + date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })) + '">' + icon('ext', 15) + ' Search events for this date</a></div></div>';
  return h;
}
function eventsHtml() {
  let h = '<div class="notice">' + icon('warn', 18) + '<div>Dates below are calculated from the usual pattern. They are <b>not confirmed</b> for any given year. Check the official programme before you plan around an event.</div></div>';
  D.events.slice().sort((a, b) => (dayEventsInfo().list.includes(b) ? 1 : 0) - (dayEventsInfo().list.includes(a) ? 1 : 0)).forEach((e) => {
    const n = nextOcc(e.rule); let match = '';
    if (dayEventsInfo().list.includes(e)) match = '<span class="pill ok">Matches your call date</span>';
    h += '<div class="card"><div class="row" style="justify-content:space-between"><h2>' + esc(t(e.name)) + '</h2></div><div class="row"><span class="pill info">' + icon('pin', 13) + esc(t(e.where)) + '</span><span class="pill">' + esc(t(e.ruleText)) + '</span>' + match + '</div>' +
      '<p>' + rich(t(e.summary), null) + '</p><div class="small"><b>Next expected:</b> ' + (n ? fmtDate(n) : 'not calculated') + ' <span class="muted">(calculated, not confirmed)</span></div>' + (e.verify && e.verify.length ? '<details class="small muted"><summary style="min-height:30px;font-weight:600;cursor:pointer">To verify</summary>' + esc(e.verify.join(' · ')) + '</details>' : '') + (e.links ? '<div class="row" style="flex-wrap:wrap">' + e.links.map((x) => '<a class="btn sm line" href="' + esc(x.url) + '" target="_blank" rel="noopener">' + icon('ext', 15) + ' ' + esc(x.label) + '</a>').join('') + '</div>' : '') + '<div class="small muted">' + rich(t(e.cruiseNote), null) + '</div>' +
      '<a class="btn sm line" href="' + searchUrl(t(e.name) + ' ' + t(e.where) + ' programma ufficiale') + '" target="_blank" rel="noopener">' + icon('ext', 15) + ' Search the official programme</a></div>';
  });
  return h;
}
function tourCard(tr) {
  const stops = tr.stops.map((id) => P[id]);
  const tl = buildTimeline(tr.stops, 0);
  const di = dayInfo();
  let fit = '';
  if (di.avail != null) {
    const need = tl.total;
    fit = need <= di.avail - 30 ? '<span class="pill ok">' + icon('check', 13) + 'Fits your day</span>' : need <= di.avail ? '<span class="pill warn">Tight for your day</span>' : '<span class="pill bad">Too long for your day</span>';
  }
  const far = stops.some((p) => p.area !== 'city');
  let h = '<details class="acc"><summary><span><span class="small muted" style="font-weight:700;letter-spacing:.06em;text-transform:uppercase">' + esc(tr.level) + '</span><br><b style="font-family:var(--display);font-size:17px">' + esc(t(tr.name)) + '</b></span>' + icon('down', 18) + '</summary><div class="body">' +
    '<p>' + esc(t(tr.tagline)) + '</p><div class="row"><span class="pill info">' + icon('clock', 13) + 'About ' + fmtMin(tl.total) + ' from the terminal and back</span>' + fit + (far ? '<span class="pill warn">Needs transport</span>' : '') + '</div>';
  h += '<div>' + tl.rows.map((r) => '<div class="tl-row"><div class="tm">' + (r.leg.mode === 'walk' ? icon('walk', 16) : icon('train', 16)) + '</div><div><button data-act="detail" data-arg="' + r.p.id + '" style="text-align:left;font-weight:700">' + esc(t(r.p.name)) + '</button><div class="tl-leg">' + (r.leg.mode === 'walk' ? '~' + fmtMin(r.leg.min) + ' walk' : 'Allow ~' + fmtMin(r.leg.min) + ' of transport (assumption)') + ' · visit ~' + fmtMin(r.p.visitMin) + '</div></div></div>').join('') + '<div class="tl-row"><div class="tm">' + icon('anchor', 16) + '</div><div><b>Back to the terminal</b><div class="tl-leg">' + (tl.back.mode === 'walk' ? '~' + fmtMin(tl.back.min) + ' walk' : 'Allow ~' + fmtMin(tl.back.min) + ' of transport (assumption)') + '</div></div></div></div>';
  h += '<div class="small muted">Times are estimates: walking is straight-line distance × ' + PL.defaults.detour + ' at ' + PL.defaults.walkKmh + ' km/h; transport legs are planning assumptions, not timetables.</div>';
  h += '<div class="row"><button class="btn sm" data-act="tourMap" data-arg="' + tr.id + '">' + icon('map', 16) + ' Show on map</button><button class="btn sm sec" data-act="tourPlan" data-arg="' + tr.id + '">' + icon('day', 16) + ' Use as my plan</button></div></div></details>';
  return h;
}
function toursScreen() {
  return '<div class="pad"><div><h1 class="title-xl">Tours</h1><p class="muted">Ready-made routes that all start and end at the cruise terminal. Open one to see realistic timing.</p></div>' +
    discl() + (dayInfo().avail == null ? '' : '<div class="notice info">' + icon('clock', 18) + '<div>Your day gives you about <b>' + fmtMin(dayInfo().avail) + '</b> away from the ship (see My Day).</div></div>') +
    D.tours.map(tourCard).join('') + '</div>';
}

/* ---- audio ---- */
function splitSent(text) { const m = text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g); return (m || [text]).map((s) => s.trim()).filter(Boolean); }
function audioItem(id) {
  const p = P[id]; if (!p) return null;
  const script = p.audio && p.audio.en;
  const text = script ? trText(script) : stripMarks(trText(t(p.intro)) + ' ' + p.story.en.map(trText).join(' '));
  return { id, title: t(p.name), kind: script ? 'narration' : 'readaloud', text, sents: splitSent(text) };
}
function durTxt(text) { const secs = Math.round(text.split(/\s+/).length / 2.5); return secs < 90 ? '~' + secs + ' sec' : '~' + (secs / 60).toFixed(1) + ' min'; }
const NARR = PLACES.filter((p) => p.audio && p.audio.en && p.id !== 'taxi').map((p) => p.id);
const READ = PLACES.filter((p) => !(p.audio && p.audio.en) && p.id !== 'taxi' && p.id !== 'station').map((p) => p.id);
const synth = ('speechSynthesis' in window) ? window.speechSynthesis : null;
let voices = [], token = 0;
function loadVoices() { if (!synth) return; voices = synth.getVoices().filter((v) => v.lang && v.lang.toLowerCase().indexOf(S.lang) === 0); if (!voices.some((v) => v.voiceURI === S.audio.voice)) S.audio.voice = ''; if (!S.audio.voice && voices.length) { const pref = voices.find((v) => v.lang.toLowerCase() === VOICE_LANG[S.lang].toLowerCase()) || voices[0]; S.audio.voice = pref.voiceURI; } }
if (synth) { loadVoices(); synth.addEventListener && synth.addEventListener('voiceschanged', () => { loadVoices(); if (S.tab === 'audio') renderScreen(); }); }
function speakCurrent() {
  const it = audioItem(S.audio.id); if (!it || !synth) return;
  synth.cancel(); const my = ++token;
  const u = new SpeechSynthesisUtterance(it.sents[S.audio.idx]);
  u.lang = VOICE_LANG[S.lang] || 'en-GB'; u.rate = S.audio.rate;
  const v = voices.find((x) => x.voiceURI === S.audio.voice); if (v) { u.voice = v; u.lang = v.lang; }
  u.onend = () => { if (my !== token || !S.audio.playing) return; if (S.audio.idx < it.sents.length - 1) { S.audio.idx++; speakCurrent(); updateAudioUI(); } else { S.audio.playing = false; S.audio.idx = 0; updateAudioUI(true); } };
  u.onerror = (e) => { if (my !== token) return; if (e.error === 'interrupted' || e.error === 'canceled') return; S.audio.playing = false; updateAudioUI(true); toast('Speech could not start on this device. You can still read the text.'); };
  synth.speak(u);
}
function playAudio(id) {
  if (!synth) { S.audio = Object.assign(S.audio, { id, playing: false, idx: 0 }); toast('This browser has no built-in speech. The text is shown instead.'); renderAll(); return; }
  S.audio.id = id; S.audio.idx = 0; S.audio.playing = true; speakCurrent(); renderAll();
}
function toggleAudio() {
  if (!S.audio.id) return;
  if (!synth) return;
  if (S.audio.playing) { S.audio.playing = false; token++; synth.cancel(); } else { S.audio.playing = true; speakCurrent(); }
  updateAudioUI(true);
}
function stepAudio(dir) {
  const list = NARR.includes(S.audio.id) ? NARR : READ; let i = list.indexOf(S.audio.id); i = (i + dir + list.length) % list.length;
  playAudio(list[i]);
}
function updateAudioUI(full) {
  if (full) { renderMini(); if (S.tab === 'audio') renderScreen(); return; }
  const it = audioItem(S.audio.id); if (!it) return;
  const bar = $('#abar'); if (bar) bar.style.width = ((S.audio.idx + 1) / it.sents.length * 100) + '%';
  document.querySelectorAll('.script span').forEach((s, i) => s.classList.toggle('cur', i === S.audio.idx));
  const cur = $('.script span.cur'); if (cur) { const sc = cur.parentElement; sc.scrollTop = cur.offsetTop - sc.clientHeight / 3; }
}
function audioScreen() {
  const it = audioItem(S.audio.id);
  let h = '<div class="pad"><div><h1 class="title-xl">Audio guide</h1><p class="muted">Narration is in the language you chose, if your device has a voice for it.</p></div>';
  h += '<div class="notice info">' + icon('info', 18) + '<div><b>How the audio works in this prototype:</b> it is <b>generated speech</b> from your phone or browser, reading draft scripts. There are no recorded audio files yet, and nothing is downloaded for offline use.' + (synth ? '' : ' <b>This browser has no speech voice, so you will only see the text.</b>') + '</div></div>';
  if (it) {
    const total = it.sents.length;
    h += '<div class="player"><div class="kind">' + (S.audio.playing ? 'Now playing' : 'Selected') + ' · ' + (it.kind === 'narration' ? 'Draft narration script' : 'Reads the page text') + '</div><h2>' + esc(it.title) + '</h2>' +
      '<div class="bar" aria-hidden="true"><i id="abar" style="width:' + ((S.audio.idx + 1) / total * 100) + '%"></i></div>' +
      '<div class="ctrl"><button class="sm" data-act="aprev" aria-label="Previous guide">' + icon('prev', 24) + '</button><button class="big" data-act="atoggle" aria-label="' + (S.audio.playing ? 'Pause' : 'Play') + '">' + icon(S.audio.playing ? 'pause' : 'play', 30) + '</button><button class="sm" data-act="anext" aria-label="Next guide">' + icon('next', 24) + '</button></div>' +
      '<div class="script" aria-label="Transcript">' + it.sents.map((s, i) => '<span data-act="aseek" data-arg="' + i + '" class="' + (i === S.audio.idx ? 'cur' : '') + '">' + esc(s) + ' </span>').join('') + '</div>' +
      '<div class="row"><label class="small" for="rate">Speed</label><select id="rate" data-bind="rate" style="max-width:110px">' + [[0.85, 'Slow'], [1, 'Normal'], [1.15, 'Quick']].map(([v, l]) => '<option value="' + v + '"' + (S.audio.rate === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>' +
      (voices.length ? '<label class="small" for="voice">Voice</label><select id="voice" data-bind="voice" style="max-width:190px">' + voices.map((v) => '<option value="' + esc(v.voiceURI) + '"' + (v.voiceURI === S.audio.voice ? ' selected' : '') + '>' + esc(v.name) + '</option>').join('') + '</select>' : '') + '</div></div>';
  }
  const li = (id) => { const p = P[id]; const on = S.audio.id === id; return '<button class="pitem" data-act="play" data-arg="' + id + '" style="' + (on ? 'border-color:var(--accent)' : '') + '"><span class="ibtn" style="background:var(--info-bg);color:var(--accent);border:0">' + icon(on && S.audio.playing ? 'pause' : 'play', 20) + '</span><span class="mid" style="flex:1;min-width:0"><span class="nm" style="display:block">' + esc(t(p.name)) + '</span><span class="small muted">~' + Math.max(1, Math.round(audioItem(id).text.split(/\s+/).length / 2.5 / 60 * 10) / 10) + ' min</span></span></button>'; };
  h += '<h2>Draft narrations</h2><div style="display:flex;flex-direction:column;gap:8px">' + NARR.map(li).join('') + '</div>';
  h += '<h2>Read-aloud of page text</h2><p class="small muted">These places do not have a narration script yet, so the voice reads the written page.</p><div style="display:flex;flex-direction:column;gap:8px">' + READ.map(li).join('') + '</div></div>';
  return h;
}

/* ---- my day ---- */
function dayScreen() {
  const di = dayInfo();
  let h = '<div class="pad"><div><h1 class="title-xl">My Cruise Day</h1><p class="muted">Enter your ship call details and keep the way back to the ship in view.</p></div>' + discl();
  h += '<div class="card"><h2>Your ship call</h2><div class="notice info">' + icon('info', 18) + '<div><b>Entered by you.</b> This app has no connection to cruise lines or the port, so it cannot confirm your times. Always follow your ship\'s printed times and announcements.</div></div>' +
    (S.day.set ? '' : '<div class="notice">' + icon('warn', 18) + '<div>These are <b>example times</b>. Change them to match your ship before you rely on the clock.</div></div>') + '<div class="row"><div class="field"><label for="ship">SHIP NAME (OPTIONAL)</label><input id="ship" data-bind="ship" value="' + esc(S.day.ship) + '" maxlength="40" placeholder="e.g. your ship\'s name" autocomplete="off"></div><div class="field"><label for="cdate">CALL DATE (OPTIONAL)</label><input id="cdate" type="date" data-bind="date" value="' + esc(S.day.date) + '"></div></div>' +
    '<div class="row"><div class="field"><label for="arr">ARRIVAL AT PORT</label><input id="arr" type="time" data-bind="arrive" value="' + esc(S.day.arrive) + '"></div><div class="field"><label for="abd">ALL ABOARD</label><input id="abd" type="time" data-bind="aboard" value="' + esc(S.day.aboard) + '"></div></div>' +
    '<div class="field"><label for="mar">SAFETY MARGIN BEFORE ALL-ABOARD</label><select id="mar" data-bind="margin">' + PL.marginOptions.map((m) => '<option value="' + m + '"' + (+S.day.margin === m ? ' selected' : '') + '>' + m + ' minutes before all-aboard</option>').join('') + '</select></div>' +
    '<a class="btn sm line" href="' + searchUrl('La Spezia cruise port ship schedule') + '" target="_blank" rel="noopener" style="align-self:flex-start">' + icon('ext', 15) + ' Look up the port schedule</a></div>';
  h += dayEventsCard();
  if (!di.ok) {
    h += '<div class="notice" style="background:var(--bad-bg);color:var(--bad)">' + icon('warn', 18) + '<div>All-aboard must be later than the arrival time. Check both times.</div></div>';
  } else {
    const live = di.live, left = di.deadline - nowMin();
    h += '<div class="card"><div class="small muted" style="font-weight:700;letter-spacing:.06em">BE BACK AT THE TERMINAL BY</div><div class="bigclock">' + hhmm(di.deadline) + '</div>' +
      '<div class="row"><span class="pill info">All aboard ' + hhmm(di.aboard) + '</span><span class="pill">Margin ' + di.margin + ' min</span>' + (live ? '<span class="pill ' + (left < 0 ? 'bad' : left < 60 ? 'warn' : 'ok') + '" id="daypill">' + (left < 0 ? 'Past the deadline' : fmtMin(left) + ' left (live clock)') + '</span>' : '<span class="pill">Call date is not today</span>') + '</div>' +
      '<p>About <b>' + fmtMin(di.avail) + '</b> away from the ship after allowing ' + PL.defaults.disembarkMin + ' minutes to get off and out of the terminal (assumption).</p></div>';
    h += '<div class="card"><h2>Can I get there?</h2><p class="small muted">Plain-language guidance, based on planning assumptions that are listed below each line. Real timetables are not connected.</p>';
    PL.dayTripsForFeasibility.forEach((zid) => {
      const f = feasibility(zid, di); const pct = Math.min(100, Math.round(f.high / Math.max(di.avail, 1) * 100));
      h += '<div class="feas"><div class="row" style="justify-content:space-between"><b>' + esc(t(f.z.name)) + '</b><span class="pill ' + f.status + '">' + f.label + '</span></div>' +
        '<div class="small">Needs about <b>' + fmtMin(f.low) + '–' + fmtMin(f.high) + '</b> in total: two ways of travel plus ~' + fmtMin(f.z.visit) + ' on site. You have ' + fmtMin(di.avail) + '.</div>' +
        '<div class="meter" aria-hidden="true"><i style="width:' + pct + '%;background:var(--' + (f.status === 'ok' ? 'ok' : f.status === 'warn' ? 'facade' : 'bad') + ')"></i></div>' +
        '<details class="small muted"><summary style="cursor:pointer;min-height:28px">Assumptions</summary>' + esc(t(f.z.mode)) + ', ' + f.z.oneWay[0] + '–' + f.z.oneWay[1] + ' min each way. ' + esc(t(f.z.note)) + '</details></div>';
    });
    h += '</div>';
  }
  /* plan */
  h += '<div class="card"><div class="row" style="justify-content:space-between"><h2>My plan</h2>' + (S.plan.length ? '<button class="btn sm sec" data-act="clearPlan">Clear</button>' : '') + '</div>';
  if (!S.plan.length) h += '<p class="muted">Nothing yet. Add places from their detail page, or use a ready-made tour.</p><div class="row"><button class="btn sm" data-act="tab" data-arg="tours">' + icon('tours', 16) + ' Browse tours</button><button class="btn sm sec" data-act="tab" data-arg="explore">' + icon('explore', 16) + ' Browse places</button></div>';
  else {
    const start = di.ok ? di.ready : 9 * 60; const tl = buildTimeline(S.plan, start);
    h += '<div class="tl-row"><div class="tm">' + hhmm(start) + '</div><div><b>Leave the terminal</b><div class="tl-leg">Assumes ' + PL.defaults.disembarkMin + ' min after arrival</div></div><div></div></div>';
    tl.rows.forEach((r, i) => {
      h += '<div class="tl-row"><div class="tm">' + hhmm(r.arrive) + '</div><div><button data-act="detail" data-arg="' + r.p.id + '" style="text-align:left;font-weight:700">' + esc(t(r.p.name)) + '</button><div class="tl-leg">' + (r.leg.mode === 'walk' ? icon('walk', 13, 'style="display:inline;vertical-align:-2px"') + ' ~' + fmtMin(r.leg.min) + ' walk to get here' : 'Transport ~' + fmtMin(r.leg.min) + ' to get here (assumption)') + ' · visit ~' + fmtMin(r.p.visitMin) + ' · leave ' + hhmm(r.leave) + '</div></div><div class="row" style="gap:2px;flex-wrap:nowrap"><button class="ibtn" style="width:34px;height:34px" data-act="upPlan" data-arg="' + i + '" aria-label="Move up">' + icon('up', 16) + '</button><button class="ibtn" style="width:34px;height:34px" data-act="downPlan" data-arg="' + i + '" aria-label="Move down">' + icon('down', 16) + '</button><button class="ibtn" style="width:34px;height:34px" data-act="rmPlan" data-arg="' + i + '" aria-label="Remove">' + icon('trash', 16) + '</button></div></div>';
    });
    const late = di.ok && tl.end > di.deadline;
    h += '<div class="tl-row"><div class="tm">' + hhmm(tl.end) + '</div><div><b>Back at the terminal</b><div class="tl-leg">' + (tl.back.mode === 'walk' ? '~' + fmtMin(tl.back.min) + ' walk' : 'Transport ~' + fmtMin(tl.back.min) + ' (assumption)') + '</div></div><div></div></div>';
    if (di.ok) h += '<div class="notice" style="' + (late ? 'background:var(--bad-bg);color:var(--bad)' : 'background:var(--ok-bg);color:var(--ok)') + '">' + icon(late ? 'warn' : 'check', 18) + '<div>' + (late ? '<b>This plan runs ' + fmtMin(tl.end - di.deadline) + ' past your return deadline.</b> Remove a stop or shorten a visit.' : 'Plan ends ' + fmtMin(di.deadline - tl.end) + ' before your return deadline (' + hhmm(di.deadline) + ').') + '</div></div>';
    h += '<button class="btn sm sec" data-act="routePlan" style="align-self:flex-start">' + icon('map', 16) + ' Show plan on map</button>';
  }
  h += '</div></div>';
  return h;
}

/* ---------- detail overlay ---------- */
function accessText(p) {
  if (p.accessNote) return p.accessNote;
  const m = { open: 'Open-air public space. Access is normally free, but this has not been verified.', ticketed: 'Opening days, hours and ticket prices are not verified yet. Some Italian museums close one day a week, so check before you go.', church: 'This is a place of worship. Visiting times can change around services. Check locally and dress modestly.', restricted: 'Access conditions are not verified and may involve a military area. Check before planning a visit.', transit: 'Services and times are not verified here. Check operators on the day.', village: 'A public village. Services, shops and opening hours are not verified.' };
  return m[p.access] || '';
}
function nearby(p) { return PLACES.filter((q) => q.id !== p.id && !isTheme(q) && q.area === p.area && !['taxi'].includes(q.id)).sort((a, b) => km(p, a) - km(p, b)).slice(0, 3); }
function detailHtml(p) {
  const RC = { self: p.id, used: new Set() };
  const k = distFrom(p), has = S.fav.has(p.id), inPlan = S.plan.includes(p.id), it = audioItem(p.id);
  const geoNote = p.geo === 'confirmed' ? 'Position from Google Maps coordinates supplied by the app owner.' : p.geo === 'unconfirmed' ? 'Position unconfirmed. The marker is only a placeholder.' : (p.geo === 'area' ? 'This is a theme or area, not a single address.' : 'Position approximate (± a few hundred metres).');
  let h = '<div class="detail cat-' + p.cat + '" role="dialog" aria-label="' + esc(t(p.name)) + '"><div class="scroll"><div class="hero">' + pic(p, 900) + '<button class="ibtn back" data-act="closeDetail" aria-label="Back">' + icon('back', 20) + '</button><span class="ph">' + (p.photo && p.photo.src ? 'Photo' : 'Placeholder illustration') + '</span></div>' + photoCredit(p) + galleryHtml(p) + '' +
    '<div class="pad"><div><div class="row" style="margin-bottom:6px"><span class="pill" style="background:var(--cc);color:var(--on-c)">' + (catLabel[p.cat] || '') + '</span>' + (isTheme(p) ? '<span class="pill info">Theme</span>' : '') + (p.flags.must ? '<span class="pill warn">Must-see</span>' : '') + (p.flags.photo ? '<span class="pill info">' + icon('camera', 13) + 'Photo spot</span>' : '') + '</div><h1 class="title-xl">' + esc(t(p.name)) + '</h1><div class="muted" style="font-style:italic;margin-top:2px">' + esc(p.name.it) + '</div></div>' +
    '<div class="facts"><div class="fact"><b>' + (p.visitMin ? '~' + fmtMin(p.visitMin) : '—') + '</b><span>Typical visit (estimate)</span></div><div class="fact"><b>' + (p.area !== 'city' && k > 3 ? '≈ ' + Math.round(k) + ' km' : walkMin(k) + ' min') + '</b><span>' + (p.area !== 'city' && k > 3 ? 'Away. Transport needed' : 'Walk from ' + posLabel()) + '</span></div><div class="fact"><b>' + (p.area === 'city' ? 'City' : p.area === 'gulf' ? 'Gulf' : 'Coast') + '</b><span>Area</span></div></div>' +
    '<p class="lead">' + rich(t(p.intro), RC) + '</p>' + (p.person ? peopleBlock(p) : '') +
    '<button class="btn" data-act="play" data-arg="' + p.id + '">' + icon('audio', 20) + (it.kind === 'narration' ? ' Listen to the audio guide' : ' Read this page aloud') + '</button>' +
    '<div class="small muted" style="margin-top:-8px">' + (it.kind === 'narration' ? 'Generated speech from a draft script. Not a recording.' : 'No narration script yet. The voice reads the page text.') + '</div>' +
    '<div class="prose">' + p.story[LANG].map((x) => '<p>' + rich(x, RC) + '</p>').join('') + '</div>';
  if (p.curios && p.curios.en.length) h += curiosHtml(p.curios.en, null, RC);
  if (p.tips && p.tips.en.length) h += '<div class="card"><h3>Good to know</h3><ul class="tips">' + p.tips.en.map((x) => '<li>' + rich(x, RC) + '</li>').join('') + '</ul></div>';
  h += '<div class="card"><h3>Practical information</h3><dl class="kv"><dt>Hours and tickets</dt><dd>' + esc(accessText(p)) + '</dd>' + (p.address ? '<dt>Address</dt><dd>' + esc(t(p.address)) + '</dd>' : '') + (p.getThere ? '<dt>Getting there</dt><dd>' + esc(t(p.getThere)) + ' <button class="linkbtn" data-act="goExplore" data-arg="transport">Transport</button></dd>' : '') + '<dt>Location</dt><dd>' + geoNote + '</dd></dl>' +
    ((p.access === 'ticketed' || p.access === 'church' || p.access === 'restricted') ? '<a class="btn sm line" target="_blank" rel="noopener" href="' + searchUrl(t(p.name) + ' ' + (p.access === 'ticketed' ? 'orari apertura biglietti' : 'orari')) + '" style="align-self:flex-start">' + icon('ext', 15) + ' Check current hours</a>' : '') + '</div>';
  if (p.dest) h += transportCard(p) + discl();
  const nb = nearby(p);
  if (nb.length) h += '<div><h3 style="margin-bottom:8px">Nearby</h3><div style="display:flex;flex-direction:column;gap:8px">' + nb.map((q) => '<button class="pitem cat-' + q.cat + '" data-act="detail" data-arg="' + q.id + '"><div class="thumb">' + pic(q) + '</div><div class="mid"><div class="nm">' + esc(t(q.name)) + '</div><div class="meta"><span>' + icon('walk', 13) + fmtDist(km(p, q)) + ' from here</span></div></div></button>').join('') + '</div></div>';
  h += '<details class="acc"><summary>Content status (for the app owner)</summary><div class="body small"><div class="pill warn" style="align-self:flex-start">Draft content</div><div>Still to verify before publishing:</div><ul class="tips">' + p.verify.map((v) => '<li>' + esc(v) + '</li>').join('') + '</ul>' + confl(p) + '<div>Image: placeholder artwork. Replace with a licensed or own photograph.</div></div></details>';
  h += '</div></div><div class="dock"><a class="btn" href="' + directionsUrl(p) + '" target="_blank" rel="noopener">' + icon('nav', 18) + ' Directions</a>' + (plannable(p) ? '<button class="btn sec" data-act="' + (inPlan ? 'rmPlanId' : 'addPlan') + '" data-arg="' + p.id + '">' + icon(inPlan ? 'check' : 'plus', 18) + (inPlan ? ' In my day' : ' Add to my day') + '</button>' : '') +
    '<button class="ibtn" data-act="fav" data-arg="' + p.id + '" aria-pressed="' + has + '" aria-label="' + (has ? 'Remove from favourites' : 'Save to favourites') + '" style="width:44px;height:44px">' + icon('heart', 20) + '</button></div></div>';
  return h;
}

function langSeg() { return '<div class="row"><span class="small muted">' + esc(up('lang_label')) + '</span><div class="seg" role="group" aria-label="Language">' + [['en', 'EN'], ['it', 'IT'], ['de', 'DE'], ['es', 'ES']].map(([k, l]) => '<button data-act="plang" data-arg="' + k + '" aria-pressed="' + (S.plang === k) + '">' + l + '</button>').join('') + '</div></div>'; }
function statusPill(st) { const m = { confirmed: ['ok', 'status_confirmed'], partial: ['warn', 'status_partial'], reported: ['warn', 'status_reported'], conflict: ['bad', 'status_conflict'] }; const x = m[st] || m.reported; return '<span class="pill ' + x[0] + '">' + esc(up(x[1])) + '</span>'; }
function peopleBlock(p) {
  const far = p.area !== 'city', wT = far ? up('transport_needed') : walkMin(km(P.terminal, p)) + ' min', wS = far ? up('transport_needed') : walkMin(km(P.station, p)) + ' min';
  const coord = p.geo === 'unconfirmed' ? up('coords_unconfirmed') : p.lat.toFixed(5) + ', ' + p.lon.toFixed(5) + ' · ' + (p.geo === 'confirmed' ? 'Position confirmed' : up('coords_approx'));
  return '<div class="card" style="border-color:var(--c-people)"><div class="row" style="justify-content:space-between">' + '<div><h2>' + esc(p.person.name) + ' — ' + esc(pl(p.person.role)) + '</h2><div class="small muted">' + esc(p.person.years) + '</div></div></div>' + langSeg() +
    '<p>' + esc(pl(p.desc)) + '</p>' +
    '<div style="display:flex;flex-direction:column;gap:6px"><div class="small muted" style="font-weight:700;letter-spacing:.04em">' + esc(up('plaque_where').toUpperCase()) + '</div>' + statusPill(p.plaque.status) + '<div>' + esc(pl(p.plaque.where)) + '</div></div>' +
    '<div style="display:flex;flex-direction:column;gap:6px"><div class="small muted" style="font-weight:700;letter-spacing:.04em">' + esc(up('plaque_meaning').toUpperCase()) + '</div><div>' + esc(pl(p.plaque.meaning)) + '</div></div>' +
    '<div class="facts" style="grid-template-columns:1fr 1fr"><div class="fact"><b>' + wT + '</b><span>' + esc(up('walk_terminal')) + '</span></div><div class="fact"><b>' + wS + '</b><span>' + esc(up('walk_station')) + '</span></div></div>' +
    '<div class="small muted">GPS: ' + esc(coord) + '<br>' + esc(up('walk_note')) + '</div></div>';
}
function galleryHtml(p) {
  const m = p.photo && p.photo.more; if (!m || !m.length) return '';
  return '<div class="gallery">' + m.map((x) => '<img src="' + esc(x) + '" alt="' + esc(t(p.name)) + '" loading="lazy">').join('') + '</div>';
}
function photoCredit(p) {
  let h = '';
  if (p.photo && p.photo.src) { const ph = p.photo; h += '<div class="small muted photocredit">' + (ph.caption ? esc(t(ph.caption)) + ' ' : '') + (ph.generic ? '<i>Illustrative photo of the area, not of this exact spot.</i> ' : '') + '<b>Photo credit</b>: ' + esc(ph.credit || '') + (ph.license ? ' · ' + (ph.licenseUrl ? '<a href="' + esc(ph.licenseUrl) + '" target="_blank" rel="noopener">' + esc(ph.license) + '</a>' : esc(ph.license)) : '') + (ph.page ? ' · <a href="' + esc(ph.page) + '" target="_blank" rel="noopener">' + esc(ph.pageLabel || 'Source') + '</a>' : '') + '</div>'; }
  return h;
}
function confl(p) {
  let h = '';
  if (p.conflicts && p.conflicts.length) h += '<div class="pill bad" style="align-self:flex-start">Conflicts to resolve</div><ul class="tips">' + p.conflicts.map((c) => '<li>' + esc(c) + '</li>').join('') + '</ul>';
  if (p.sources && p.sources.length) h += '<div>Sources checked:</div><ul class="tips">' + p.sources.map((x) => '<li>' + (x.url ? '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.label) + '</a>' : esc(x.label)) + '</li>').join('') + '</ul>';
  return h;
}

const CK = { doc: ['ok', 'Documented'], tradition: ['info', 'Tradition or legend'], rumour: ['warn', 'Rumour. Not confirmed'] };
function curiosHtml(list, title, rc) {
  return '<div class="card curios"><h3>' + esc(title || 'Curiosities and mysteries') + '</h3>' + list.map((c) => { const k = CK[c.k] || CK.doc; return '<div class="curio"><span class="pill ' + k[0] + '">' + k[1] + '</span><p>' + (rc ? rich(c.t, rc) : esc(c.t)) + '</p></div>'; }).join('') + '</div>';
}

/* ---- rich text: [[id|label]] markers and automatic links to other places ---- */
const ALIAS = {
  piazza_europa: ['Piazza Europa'],
  terminal: ['Terminal Crociere', 'Stazione Marittima'],
  station: ['La Spezia Centrale'],
  mirabello: ['Ponte Thaon di Revel', 'Ponte Mirabello', 'Mirabello Bridge', 'Thaon di Revel Bridge', 'Mirabello-Brücke', 'Puente Mirabello'],
  morin: ['Passeggiata Morin', 'Morin Promenade'],
  giardini: ['Public Gardens', 'Giardini Pubblici', 'Stadtgarten', 'Jardines Públicos'],
  garibaldi: ['Garibaldi Monument', 'Monumento a Garibaldi', 'Garibaldi-Denkmal'],
  wagner: ['Richard Wagner statue', 'Statua di Richard Wagner', 'Richard-Wagner-Statue', 'Estatua de Richard Wagner'],
  vittoria_alata: ['Winged Victory', 'Vittoria Alata', 'Geflügelte Siegesgöttin', 'Victoria Alada'],
  ammiragliato: ['Admiralty Palace', 'Palazzo dell\'Ammiragliato', 'Admiralitätspalast', 'Palacio del Almirantazgo'],
  cristore: ['Cathedral of Christ the King', 'Cattedrale di Cristo Re', 'Kathedrale Christus König', 'Catedral de Cristo Rey'],
  castello: ['San Giorgio Castle', 'Castello San Giorgio', 'Castillo de San Giorgio'],
  rifugio: ['Galleria Quintino Sella'],
  piazza_verdi: ['Piazza Verdi'],
  camec: ['CAMeC'],
  lia: ['Amedeo Lia Civic Museum', 'Museo Civico Amedeo Lia', 'Städtisches Museum Amedeo Lia', 'Museo Cívico Amedeo Lia'],
  sigillo: ['Seal Museum', 'Museo del Sigillo', 'Siegelmuseum', 'Museo del Sello'],
  navale: ['Naval Technical Museum', 'Museo Tecnico Navale', 'Technisches Marinemuseum', 'Museo Técnico Naval'],
  etnografico: ['Podenzana Ethnographic Museum', 'Museo Etnografico Podenzana', 'Ethnografisches Museum Podenzana', 'Museo Etnográfico Podenzana'],
  sarzana: ['Sarzana'],
  luni: ['Luni'],
  lerici: ['Lerici'],
  portovenere: ['Portovenere'],
  sanTerenzo: ['San Terenzo', 'Casa Magni'],
  grottabyron: ['Byron\'s Grotto', 'Grotta di Byron', 'Byrons Grotte', 'Gruta de Byron'],
  sanpietro: ['Church of San Pietro', 'Chiesa di San Pietro', 'Kirche San Pietro', 'Iglesia de San Pietro'],
  viadellamore: ['Via dell\'Amore'],
  manarola: ['Manarola'], riomaggiore: ['Riomaggiore'], vernazza: ['Vernazza'], corniglia: ['Corniglia'], monterosso: ['Monterosso al Mare', 'Monterosso'],
  cinqueterre: ['Cinque Terre'],
  wagner_plaque: ['Wagner plaque', 'Targa di Richard Wagner', 'Richard-Wagner-Gedenktafel', 'Placa de Richard Wagner'],
  garibaldi_plaque: ['Garibaldi plaque', 'Targa di Garibaldi', 'Garibaldi-Gedenktafel', 'Placa de Garibaldi'],
  stele: ['statue-stelae', 'statue stele', 'Statuenstelen', 'estatuas-estela']
};
let ALIAS_RE = null, ALIAS_MAP = null;
function aliasInit() {
  ALIAS_MAP = {}; const all = [];
  Object.keys(ALIAS).forEach((id) => ALIAS[id].forEach((a) => { ALIAS_MAP[a.toLowerCase()] = id; all.push(a); }));
  all.sort((a, b) => b.length - a.length);
  ALIAS_RE = new RegExp('(?<![\\p{L}\\p{N}])(' + all.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![\\p{L}\\p{N}])', 'gu');
}
function linkBtn(id, label) { return '<button class="inl" data-act="detail" data-arg="' + id + '">' + esc(label) + '</button>'; }
function stripMarks(x) { return String(x).replace(/\[\[\w+\|([^\]]+)\]\]/g, '$1'); }
/* ctx = { self: id|null, used: Set } shared by every paragraph of one page, so each place is linked once */
function rich(raw, ctx) {
  const txt = trText(raw); ctx = ctx || { self: null, used: new Set() };
  if (!ALIAS_RE) aliasInit();
  const plain = (seg) => seg.split(ALIAS_RE).map((part, i) => {
    if (i % 2 === 0) return esc(part);
    const id = ALIAS_MAP[part.toLowerCase()];
    if (!id || id === ctx.self || ctx.used.has(id) || !P[id]) return esc(part);
    ctx.used.add(id); return linkBtn(id, part);
  }).join('');
  let out = '', last = 0, m; const re = /\[\[(\w+)\|([^\]]+)\]\]/g;
  /* explicit markers first, so they are reserved before the automatic pass */
  const marks = []; while ((m = re.exec(txt))) marks.push(m[1]);
  marks.forEach((id) => { if (id !== ctx.self) ctx.used.add(id); });
  re.lastIndex = 0;
  while ((m = re.exec(txt))) {
    out += plain(txt.slice(last, m.index));
    out += (P[m[1]] && m[1] !== ctx.self) ? linkBtn(m[1], m[2]) : esc(m[2]);
    last = m.index + m[0].length;
  }
  return out + plain(txt.slice(last));
}
function placeLink(id) { const q = P[id]; return q ? '<button class="btn sm line" data-act="detail" data-arg="' + id + '">' + icon('pin', 15) + ' ' + esc(t(q.name)) + '</button>' : ''; }
function historyTab() {
  const H = D.history;
  let h = '<div><h2 class="title-xl" style="font-size:22px">' + esc(t(H.title)) + '</h2>' + H.intro.en.map((x) => '<p class="muted" style="margin-top:6px">' + esc(x) + '</p>').join('') + '</div>';
  h += '<div class="notice">' + icon('warn', 18) + '<div>Draft history compiled from public sources. Where sources disagree, the entry is marked and listed at the end. Dates have not been checked against archives.</div></div>';
  h += H.eras.map((e, i) => '<details class="acc" style="padding:0 14px"' + (i === 0 ? ' open' : '') + '><summary><span><span class="small muted" style="font-weight:700;letter-spacing:.06em;text-transform:uppercase">' + esc(e.range) + '</span><br><b style="font-family:var(--display);font-size:17px">' + esc(t(e.title)) + '</b></span>' + icon('down', 18) + '</summary><div class="body"><p>' + esc(t(e.summary)) + '</p>' +
    '<div>' + e.events.map((v) => '<div class="tl-row hrow"><div class="tm">' + esc(v.y) + '</div><div>' + esc(v.t) + (v.flag ? '<div class="small"><span class="pill warn">' + esc(v.flag) + '</span></div>' : '') + '</div></div>').join('') + '</div>' +
    (e.places && e.places.length ? '<div class="row" style="flex-wrap:wrap">' + e.places.map(placeLink).join('') + '</div>' : '') + '</div></details>').join('');
  h += '<div><h3 style="margin-bottom:8px">Mysteries and legends</h3><div style="display:flex;flex-direction:column;gap:10px">' + H.mysteries.map((m) => '<div class="card"><h3>' + esc(t(m.title)) + '</h3><p>' + esc(t(m.body)) + '</p>' + placeLink(m.place) + '</div>').join('') + '</div></div>';
  h += '<details class="acc"><summary>Where the sources disagree</summary><div class="body small"><ul class="tips">' + H.conflicts.map((c) => '<li>' + esc(c) + '</li>').join('') + '</ul><div>Sources:</div><ul class="tips">' + H.sources.map((x) => '<li><a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.label) + '</a></li>').join('') + '</ul></div></details>';
  return h;
}

function discl() { return '<div class="notice">' + icon('warn', 18) + '<div><b>Estimates only.</b> Distances, times and durations are indicative, and the app is not responsible for differences from real services. Check official sources for transport, museums and your ship\'s times. <button class="linkbtn" data-act="goExplore" data-arg="transport">Official links</button></div></div>'; }
function linkBtns(list) { return '<div class="row" style="flex-wrap:wrap">' + list.map((x) => '<a class="btn sm line" href="' + esc(x.url) + '" target="_blank" rel="noopener">' + icon('ext', 15) + ' ' + esc(x.label) + '</a>').join('') + '</div>'; }
function copyTxt(txt) {
  const done = () => toast('Number copied');
  try { navigator.clipboard.writeText(txt).then(done, () => toast('Select the number to copy it')); } catch (e) { toast('Select the number to copy it'); }
}
function taxiCard() {
  const X = D.transport.taxi; if (!X) return '';
  let h = '<div class="card"><h2>' + esc(t(X.title)) + '</h2><p>' + esc(t(X.intro)) + '</p>';
  h += X.ranks.map((r) => { const q = P[r.place]; if (!q) return ''; return '<div class="taxirank"><div class="small"><b>' + esc(t(r.name)) + '</b></div><div class="small muted">' + esc(t(r.note)) + '</div><div class="row" style="flex-wrap:wrap"><button class="btn sm line" data-act="detail" data-arg="' + r.place + '">' + icon('pin', 15) + ' ' + esc(t(q.name)) + '</button><a class="btn sm line" href="' + directionsUrl(q) + '" target="_blank" rel="noopener">' + icon('nav', 15) + ' Directions</a></div></div>'; }).join('');
  if (P.taxi && P.terminal) h += '<div class="small muted">The two ranks are about ' + fmtDist(km(P.taxi, P.terminal)) + ' apart in a straight line. The real road distance is longer.</div>';
  h += '<div class="taxirank"><div class="small"><b>' + esc(t(X.phone.label)) + '</b></div><div class="phone"><span class="num" data-num>' + esc(X.phone.number) + '</span><button class="btn sm line" data-act="copyNum" data-arg="' + esc(X.phone.number) + '">Copy number</button><a class="btn sm line" href="tel:' + esc(X.phone.number.replace(/\s/g, '')) + '">' + icon('phone', 15) + ' Call</a></div><div class="small muted">' + esc(t(X.phone.note)) + '</div></div>';
  h += '<ul class="tips">' + X.tips.en.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
  return h;
}
function guidesHtml() {
  return (D.transport.guides || []).map((g) => '<div class="card"><h2>' + esc(t(g.title)) + '</h2>' + g.items.map((it) =>
    (it.h ? '<h3 style="margin-top:4px">' + esc(t(it.h)) + '</h3>' : '') + (it.p ? '<p>' + esc(t(it.p)) + '</p>' : '') + (it.ul ? '<ul class="tips">' + it.ul.en.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '')).join('') + '</div>').join('');
}
function transportTab() {
  const T = D.transport;
  let h = '<div><h2 class="title-xl" style="font-size:22px">Transport and official links</h2><p class="muted" style="margin-top:6px">' + esc(T.intro.en) + '</p></div>' + discl();
  h += guidesHtml();
  h += taxiCard();
  h += T.operators.map((o) => '<div class="card"><h2>' + esc(o.name) + '</h2><p>' + esc(o.what.en) + '</p>' + linkBtns(o.links) + (o.contact ? '<div class="small muted">' + esc(o.contact) + '</div>' : '') + '</div>').join('');
  h += '<div class="card"><h3>Before you travel</h3><ul class="tips">' + T.checklist.en.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
  h += '<div class="notice info">' + icon('info', 18) + '<div>Museums, castles and archaeological sites publish their own hours and prices. Each place page links to a search for current hours, and its practical section says what is unverified.</div></div>';
  return h;
}
function transportCard(p) {
  const T = D.transport, ids = T.zoneLinks[p.dest]; if (!ids) return '';
  const spec = { portovenere: 'Portovenere Girobus', lerici: 'Lerici shuttle', ct_south: 'Cinque Terre bus' }[p.dest];
  let h = '<div class="card"><h3>Official transport sites</h3><p class="small muted">The journey time shown in this app for this trip is an author assumption. Use the operators for real times and the last return service.</p>';
  ids.forEach((id) => { const o = T.operators.find((x) => x.id === id); if (!o) return; const ls = id === 'atc' ? o.links.filter((x) => x.label === 'ATC Esercizio home' || x.label.startsWith('Timetables') || x.label === 'Service changes' || x.label === spec) : o.links; h += '<div class="small"><b>' + esc(o.name) + '</b></div>' + linkBtns(ls); });
  return h + '</div>';
}
function peopleTab() {
  const list = PLACES.filter(isPeople);
  return '<div><h2 class="title-xl" style="font-size:22px">' + esc(up('section_title')) + '</h2><p class="muted" style="margin-top:6px">' + esc(up('section_intro')) + '</p></div>' + langSeg() +
    '<div class="notice">' + icon('warn', 18) + '<div>Draft section. Plaque positions are placeholders and several details from the brief conflict with the sources checked. Open a card to see exactly what is confirmed.</div></div>' +
    '<button class="btn" data-act="tourMap" data-arg="authors">' + icon('map', 18) + ' ' + esc(up('walk_btn')) + '</button>' +
    '<div style="display:flex;flex-direction:column;gap:10px">' + list.map(placeItem).join('') + '</div>';
}

/* ---------- onboarding gate: language, then binding terms ---------- */
const LT = () => LG.L[S.lang] || LG.L.en;
function renderGate() {
  const host = $('#gate'), app = document.querySelector('.app');
  if (!host) return;
  if (app) { if (S.gate) app.setAttribute('inert', ''); else app.removeAttribute('inert'); }
  if (!S.gate) { host.innerHTML = ''; host.hidden = true; return; }
  host.hidden = false;
  const L = LT();
  const badge = '<div class="brand-badge" style="width:48px;height:48px;border-radius:14px" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2"/><path d="M12 7v14M8 11h8M5 14a7 7 0 0 0 14 0"/></svg></div>';
  let h = '<div class="gate" role="dialog" aria-modal="true"><div class="gatebox">';
  if (S.gate === 'lang') {
    h += badge + '<div><h1 class="title-xl">La Spezia Cruise Guide</h1><p class="muted" style="margin-top:4px">' + esc(L.welcome) + '</p></div><h2 style="font-size:19px">' + esc(L.choose) + '</h2>' +
      '<div class="langgrid" role="group" aria-label="' + esc(L.choose) + '">' + LG.order.map((k) => '<button class="langbtn" data-act="glang" data-arg="' + k + '" aria-pressed="' + (S.lang === k) + '" lang="' + k + '"><span>' + esc(LG.L[k].native) + '</span>' + (S.lang === k ? icon('check', 20) : '') + '</button>').join('') + '</div>' +
      '<p class="small muted">' + esc(L.choose_sub) + '</p><div class="notice info">' + icon('info', 18) + '<div>' + esc(L.lang_note) + '</div></div>' +
      '<button class="btn" data-act="gnext">' + esc(L.cont) + '</button>';
  } else {
    const acc = S.accepted && S.onb && S.onb.at ? new Date(S.onb.at).toLocaleDateString(S.lang) : '';
    h += '<div class="row" style="justify-content:space-between"><button class="btn sm line" data-act="gback">' + icon('back', 16) + ' ' + esc(L.back) + '</button><span class="small muted">' + esc(L.version) + ' ' + esc(LG.version) + '</span></div>' +
      '<div><h1 class="title-xl" style="font-size:24px">' + esc(L.t_title) + '</h1><p class="muted" style="margin-top:4px">' + esc(L.t_intro) + '</p></div>' +
      '<div class="notice">' + icon('warn', 18) + '<div>' + esc(L.draft) + '</div></div>' +
      '<div class="termsbox" tabindex="0" lang="' + S.lang + '">' + L.sections.map((x) => '<h3>' + esc(x.h) + '</h3><p>' + esc(x.p) + '</p>').join('') + '</div>';
    if (S.gateView) {
      h += (acc ? '<div class="small muted">' + esc(L.accepted_on) + ' ' + esc(acc) + '</div>' : '') + '<button class="btn" data-act="gclose">OK</button>';
    } else {
      h += '<label class="agree"><input type="checkbox" id="agree" data-bind="agree"' + (S.agree ? ' checked' : '') + '><span>' + esc(L.check) + '</span></label>' +
        (S.declined ? '<div class="notice" style="background:var(--bad-bg);color:var(--bad)">' + icon('warn', 18) + '<div>' + esc(L.declined) + '</div></div>' : '') +
        '<div class="row"><button class="btn" id="acceptbtn" data-act="gaccept"' + (S.agree ? '' : ' disabled') + '>' + esc(L.accept) + '</button><button class="btn line" data-act="gdecline">' + esc(L.decline) + '</button></div>';
    }
  }
  host.innerHTML = h + '</div></div>';
  const g = host.querySelector('.gate'); if (g) g.scrollTop = 0;
}
function installGateActs() { Object.assign(A, {
  glang(a) { S.lang = a; S.plang = a; if (synth) { token++; synth.cancel(); S.audio.playing = false; loadVoices(); } startI18n(); renderGate(); renderAll(); },
  gnext() { if (!S.onb) S.onb = {}; S.onb.lang = S.lang; if (S.accepted || S.gateView) { S.gate = null; S.gateView = false; } else S.gate = 'terms'; persist(); renderGate(); },
  gback() { S.gate = 'lang'; renderGate(); },
  gaccept() { if (!S.agree) return; S.onb = { lang: S.lang, v: LG.version, at: new Date().toISOString() }; S.accepted = true; S.gate = null; S.declined = false; persist(); renderGate(); },
  gdecline() { S.declined = true; S.agree = false; renderGate(); },
  gclose() { S.gate = null; S.gateView = false; renderGate(); },
  openTerms() { S.sheet = null; renderSheet(); S.gate = 'terms'; S.gateView = true; renderGate(); },
  changeLang() { S.sheet = null; renderSheet(); S.gate = 'lang'; S.gateView = true; renderGate(); },
  goExplore(a) { S.tab = 'explore'; S.exploreTab = a; S.detail = null; S.sheet = null; renderSheet(); renderAll(); }
}); }

/* ---------- sheets ---------- */
function returnSheet() {
  const T = P.terminal, k = km(S.pos, T), di = dayInfo(); const far = k > 4;
  let h = '<div class="scrim" data-act="closeSheet"><div class="sheet" data-stop="1" role="dialog" aria-label="Back to the ship"><span class="grab"></span><div class="row" style="justify-content:space-between"><h2 class="title-xl" style="font-size:22px">Back to the ship</h2><button class="ibtn" data-act="closeSheet" aria-label="Close">' + icon('close', 18) + '</button></div>';
  h += '<div class="card"><div class="small muted">From ' + posLabel() + ' to the cruise terminal</div><div class="bigclock" style="font-size:34px">' + (far ? '≈ ' + Math.round(k) + ' km' : walkMin(k) + ' min') + '</div><div class="small muted">' + (far ? 'You are far from the ship. Count on train, bus or taxi time as well, and leave early.' : 'Walking estimate: straight line × ' + PL.defaults.detour + ' at ' + PL.defaults.walkKmh + ' km/h. Real routes differ.') + '</div></div>';
  if (di.ok) { const left = di.deadline - nowMin(); h += '<div class="card"><div class="small muted">Your deadline at the terminal (from My Day)</div><div class="bigclock" style="font-size:34px">' + hhmm(di.deadline) + '</div>' + (di.live ? '<div class="pill ' + (left < 0 ? 'bad' : left < 60 ? 'warn' : 'ok') + '" style="align-self:flex-start">' + (left < 0 ? 'Past the deadline. Head back now' : fmtMin(left) + ' left') + '</div>' : '<div class="small muted">Your call date is not today.</div>') + '</div>'; }
  else h += '<div class="notice">' + icon('warn', 18) + '<div>Your times are not set correctly in My Day.</div></div>';
  h += '<a class="btn danger" href="' + directionsUrl(T) + '" target="_blank" rel="noopener">' + icon('nav', 18) + ' Open walking directions</a><button class="btn sec" data-act="routeTo" data-arg="terminal">' + icon('map', 18) + ' Show the line on the map</button>';
  h += '<div class="notice info">' + icon('info', 18) + '<div>Directions open in your maps app. If time is short, a taxi is usually faster than walking. The app cannot hold the ship. Follow the instructions on your cruise documents.</div></div></div></div>';
  return h;
}
function aboutSheet() {
  const row = (cls, tx, d) => '<div class="card" style="gap:6px"><span class="pill ' + cls + '" style="align-self:flex-start">' + tx + '</span><div class="small">' + d + '</div></div>';
  return '<div class="scrim" data-act="closeSheet"><div class="sheet" data-stop="1" role="dialog" aria-label="What is real in this prototype"><span class="grab"></span><div class="row" style="justify-content:space-between"><h2 class="title-xl" style="font-size:22px">What is real here?</h2><button class="ibtn" data-act="closeSheet" aria-label="Close">' + icon('close', 18) + '</button></div>' +
    '<p class="muted">This is a working prototype of a cruise-passenger guide for La Spezia. Here is exactly what each part is.</p>' +
    row('ok', 'Working now', 'Navigation, filters, search, saved places (kept in this browser), tours, the My Day planner and its return clock, the walking-ring tool, and directions links that open Google Maps. Audio plays through your device\'s own text-to-speech voice. Location works if your browser allows it.') +
    row('warn', 'Simulated or placeholder', 'The map in this preview is a stylised drawing, with pins placed from coordinates (most confirmed by the app owner). A real street or satellite map needs map images supplied for this preview, or a tile provider with a commercial licence once the app is hosted outside it. Distances are straight-line estimates. Transport durations are planning assumptions, not timetables. Pictures are placeholder illustrations unless a photo credit is shown. Audio is generated speech from draft scripts, not recorded narration.') +
    row('bad', 'Not connected yet', 'Verified opening hours and prices, live train, bus and ferry times, verified ship schedules, recorded audio, offline use, payments, accounts, analytics and a content-management back office.') +
    row('info', 'Content status', 'Every place is draft content. Facts were drawn from public sources and each page lists what still needs checking. Nothing about hours, prices or restaurants has been invented. Curiosities are labelled as documented, tradition or rumour. Where sources disagree, the page says so.') +
    '<div class="row" style="flex-wrap:wrap"><button class="btn sm line" data-act="resetApp">' + (S.resetAsk ? 'Tap again to erase and restart' : 'Reset prototype (start from scratch)') + '</button><button class="btn sm line" data-act="openTerms">' + esc(LT().read_terms) + '</button><button class="btn sm line" data-act="changeLang">' + esc(LT().change_lang) + '</button></div>' +
    '<div class="small muted">Main sources: VisitSpezia (history, Liberty, Futurism, monuments), Treccani, the Ministry of Culture page for Luni, Artribune, Mentelocale and local guides, listed on each page. Earlier drafting sources: <a href="https://www.lecinqueterre.org/laspeziacosavedere.php" target="_blank" rel="noopener">lecinqueterre.org (sights)</a>, <a href="https://en.wikipedia.org/wiki/La_Spezia_Cathedral" target="_blank" rel="noopener">Wikipedia, La Spezia Cathedral</a>, <a href="https://www.ilpost.it/2025/02/14/via-amore-cinque-terre-riaperta/" target="_blank" rel="noopener">Il Post, Via dell\'Amore</a>, and Wagner\'s account as retold by <a href="https://pietroscarneraa.substack.com/p/tra-le-onde-con-richard-wagner" target="_blank" rel="noopener">this essay</a>. Working title only: the product name is not chosen.</div></div></div>';
}

/* ---------- render ---------- */
function stripHtml() {
  const di = dayInfo();
  if (!S.day.set || !di.ok) return '<button class="retstrip" data-act="tab" data-arg="day">' + icon('clock', 16) + '<span>Set your all-aboard time for a live return clock</span></button>';
  const left = di.deadline - nowMin();
  if (di.live) return '<button class="retstrip' + (left < 0 ? ' late' : '') + '" data-act="tab" data-arg="day">' + icon('clock', 16) + '<span>Back at the terminal by <b class="num">' + hhmm(di.deadline) + '</b> · <span class="num">' + (left < 0 ? 'past deadline' : fmtMin(left) + ' left') + '</span></span></button>';
  return '<button class="retstrip" data-act="tab" data-arg="day">' + icon('clock', 16) + '<span>Back at the terminal by <b class="num">' + hhmm(di.deadline) + '</b> · all aboard ' + hhmm(di.aboard) + '</span></button>';
}
function renderStrip() { const el = $('#strip'); if (el) el.innerHTML = stripHtml() + dayEventsStrip(); }
function renderMini() {
  const el = $('#mini'); if (!el) return; const it = audioItem(S.audio.id);
  if (!it || S.tab === 'audio') { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="mini"><button class="t" data-act="tab" data-arg="audio"><b>' + esc(it.title) + '</b><span>' + (S.audio.playing ? 'Playing' : 'Paused') + ' · generated speech</span></button><button class="pp" data-act="atoggle" aria-label="' + (S.audio.playing ? 'Pause' : 'Play') + '">' + icon(S.audio.playing ? 'pause' : 'play', 20) + '</button></div>';
}
function renderNav() {
  const items = [['map', 'Map'], ['explore', 'Explore'], ['tours', 'Tours'], ['audio', 'Audio'], ['day', 'My Day']];
  $('#nav').innerHTML = items.map(([k, l]) => '<button data-act="tab" data-arg="' + k + '"' + (S.tab === k ? ' aria-current="page"' : '') + '><span class="ni">' + icon(k, 22) + '</span>' + l + '</button>').join('');
}
function renderScreen() {
  const view = $('#view'), mapEl = $('#s-map');
  mapEl.hidden = S.tab !== 'map'; view.hidden = S.tab === 'map';
  if (S.tab === 'map') { renderMapUI(); drawMap(); }
  else {
    const prev = view.scrollTop; const html = { explore: exploreScreen, tours: toursScreen, audio: audioScreen, day: dayScreen }[S.tab]();
    view.innerHTML = html; view.scrollTop = renderScreen.keep ? prev : 0; renderScreen.keep = false;
  }
}
function renderDetail() {
  const el = $('#detailhost'); const p = S.detail && P[S.detail];
  if (!p) { el.innerHTML = ''; return; }
  const prev = $('.detail .scroll') ? $('.detail .scroll').scrollTop : 0; const same = el.dataset.id === p.id;
  el.innerHTML = detailHtml(p); el.dataset.id = p.id; if (same) $('.detail .scroll').scrollTop = prev;
}
function renderSheet() { $('#sheethost').innerHTML = S.sheet === 'return' ? returnSheet() : S.sheet === 'about' ? aboutSheet() : ''; }
function renderToast() { const T = S.toast; $('#toasthost').innerHTML = T ? '<div class="toast" role="status"><span>' + esc(T.msg) + '</span>' + (T.act ? '<button class="btn sm" data-act="' + T.act.a + '" data-arg="' + esc(T.act.arg) + '">' + esc(T.act.label) + '</button>' : '') + '</div>' : ''; }
function renderAll() { renderStrip(); renderNav(); renderScreen(); renderMini(); renderDetail(); renderSheet(); }

/* ---------- actions ---------- */
const A = {
  tab(a) { S.tab = a; S.detail = null; renderScreen.keep = false; renderAll(); },
  explore(a) { S.exploreTab = a; renderScreen.keep = false; renderScreen(); },
  filter(a) { S.filter = a; if (S.tab === 'map') { renderMapUI(); drawMap(); } else { renderScreen.keep = true; renderScreen(); } },
  scope(a) { setScope(a); },
  detail(a) { S.detail = a; renderDetail(); },
  closeDetail() { S.detail = null; renderDetail(); },
  copyNum(a) { copyTxt(a); },
  fav(a) { if (S.fav.has(a)) S.fav.delete(a); else { S.fav.add(a); toast('Saved to favourites'); } persist(); renderScreen.keep = true; renderScreen(); renderDetail(); if (S.tab === 'map') { renderMapUI(); } },
  play(a) { playAudio(a); },
  atoggle() { toggleAudio(); },
  anext() { stepAudio(1); }, aprev() { stepAudio(-1); },
  aseek(a) { S.audio.idx = +a; S.audio.playing = true; speakCurrent(); updateAudioUI(true); },
  addPlan(a) { if (!S.plan.includes(a)) S.plan.push(a); persist(); toast('Added to My Day'); renderDetail(); },
  rmPlanId(a) { S.plan = S.plan.filter((x) => x !== a); persist(); renderDetail(); },
  rmPlan(a) { S.plan.splice(+a, 1); persist(); renderScreen.keep = true; renderScreen(); },
  upPlan(a) { const i = +a; if (i > 0) { [S.plan[i - 1], S.plan[i]] = [S.plan[i], S.plan[i - 1]]; persist(); renderScreen.keep = true; renderScreen(); } },
  downPlan(a) { const i = +a; if (i < S.plan.length - 1) { [S.plan[i + 1], S.plan[i]] = [S.plan[i], S.plan[i + 1]]; persist(); renderScreen.keep = true; renderScreen(); } },
  clearPlan() { S.plan = []; S.route = null; persist(); renderScreen.keep = true; renderScreen(); },
  tourPlan(a) { const tr = D.tours.find((x) => x.id === a); S.plan = tr.stops.slice(); persist(); S.tab = 'day'; toast('Tour copied to My Day'); renderAll(); },
  tourMap(a) { const tr = D.tours.find((x) => x.id === a); S.route = { pts: [P.terminal].concat(tr.stops.map((i) => P[i]), [P.terminal]), label: t(tr.name) }; S.tab = 'map'; S.sel = null; renderAll(); fitRoute(); },
  routePlan() { if (!S.plan.length) return; S.route = { pts: [P.terminal].concat(S.plan.map((i) => P[i]), [P.terminal]), label: 'My plan' }; S.tab = 'map'; S.sel = null; renderAll(); fitRoute(); },
  routeTo(a) { const p = P[a]; S.route = { pts: [S.pos, p], label: t(p.name) }; S.sheet = null; S.detail = null; S.tab = 'map'; S.sel = a; renderAll(); fitRoute(); toast('Straight line shown. Use Directions for real streets.'); },
  plang(a) { S.plang = a; renderScreen.keep = true; renderScreen(); renderDetail(); },
  ret() { S.sheet = 'return'; renderSheet(); },
  about() { S.sheet = 'about'; S.resetAsk = false; renderSheet(); },
  resetApp() {
    if (!S.resetAsk) { S.resetAsk = true; renderSheet(); clearTimeout(A._rt); A._rt = setTimeout(() => { S.resetAsk = false; if (S.sheet === 'about') renderSheet(); }, 6000); return; }
    try { localStorage.removeItem(KEY); } catch (e) { /* storage unavailable */ }
    try { sessionStorage.clear(); } catch (e) { /* ignore */ }
    location.reload();
  },
  closeSheet(a, el, e) { if (e && e.target.closest('[data-stop]') && !e.target.closest('button[data-act="closeSheet"]')) return; S.sheet = null; renderSheet(); },
  basemap() { const order = ((D.maps && D.maps.length) ? ['img'] : []).concat(['sketch', 'osm', 'sat']); S.base = order[(order.indexOf(S.base) + 1) % order.length]; tileOK = 0; tileErr = 0; dropTiles(null); updateAttr(); persist(); drawMap(); toast('Map style: ' + BASEMAPS[S.base].label); },
  zoomIn() { zoomAt(V.scale * 1.6, V.W / 2, V.H / 2); },
  zoomOut() { zoomAt(V.scale / 1.6, V.W / 2, V.H / 2); },
  home() { S.route = null; S.sel = null; S.scope = 'city'; flyTo(P.terminal.lat, P.terminal.lon, 210, 0); renderMapUI(); },
  clearRoute() { S.route = null; drawMap(); },
  locate() {
    if (!navigator.geolocation) { toast('Location is not available in this browser. Pick a demo position instead.'); return; }
    toast('Asking for your location…');
    if (S.watch != null) navigator.geolocation.clearWatch(S.watch);
    let first = true;
    S.watch = navigator.geolocation.watchPosition((pos) => {
      S.gpsPos = { lat: pos.coords.latitude, lon: pos.coords.longitude }; S.pos = { lat: S.gpsPos.lat, lon: S.gpsPos.lon, src: 'gps' };
      if (first) { first = false; toast('Using your real location'); }
      renderMapUI(); drawMap(); if (S.tab !== 'map') renderScreen(); checkNear();
    }, () => toast('Location is blocked or unavailable here. Distances stay on the terminal. You can pick a demo position.'), { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 });
  }
};
function fitRoute() {
  if (!S.route) return; const pts = S.route.pts; const xs = pts.map((q) => proj(q.lat, q.lon)[0]), ys = pts.map((q) => proj(q.lat, q.lon)[1]);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const w = Math.max(maxx - minx, 0.2), hgt = Math.max(maxy - miny, 0.2);
  const sc = Math.min((V.W - 90) / w, (V.H - 260) / hgt, 400);
  const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2; const lat = 44.08 - cy / KY, lon = 9.8 + cx / KX;
  setTimeout(() => flyTo(lat, lon, sc, 0), 60);
}
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = A[el.dataset.act]; if (fn) fn(el.dataset.arg, el, e);
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-bind]'); if (!el) return; const b = el.dataset.bind, v = el.value;
  if (b === 'walk') { S.walk = +v; renderMapUI(); drawMap(); }
  else if (b === 'sort') { S.sort = v; renderScreen.keep = true; renderScreen(); }
  else if (b === 'agree') { S.agree = el.checked; const bt = $('#acceptbtn'); if (bt) bt.disabled = !S.agree; }
  else if (b === 'rate') { S.audio.rate = +v; if (S.audio.playing) speakCurrent(); }
  else if (b === 'voice') { S.audio.voice = v; if (S.audio.playing) speakCurrent(); }
  else if (b === 'pos') {
    if (v === 'terminal') S.pos = { lat: P.terminal.lat, lon: P.terminal.lon, src: 'terminal' };
    else if (v === 'gps' && S.gpsPos) S.pos = { lat: S.gpsPos.lat, lon: S.gpsPos.lon, src: 'gps' };
    else if (v.startsWith('d_')) { const id = v.slice(2); S.pos = { lat: P[id].lat, lon: P[id].lon, src: 'demo', demoId: v }; }
    renderMapUI(); drawMap(); toast('Distances now measured from ' + posLabel()); setTimeout(checkNear, 600);
  } else if (['ship', 'date', 'arrive', 'aboard', 'margin'].includes(b)) {
    S.day[b] = b === 'margin' ? +v : v; S.day.set = true; persist(); renderStrip(); renderScreen.keep = true; renderScreen();
  }
});
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-bind]'); if (!el) return;
  if (el.dataset.bind === 'q') { S.q = el.value; const l = $('#plist'); if (l) l.innerHTML = placesList(); }
  if (el.dataset.bind === 'ship') { S.day.ship = el.value; persist(); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (S.sheet) { S.sheet = null; renderSheet(); } else if (S.detail) { S.detail = null; renderDetail(); } } });

/* ---------- boot ---------- */
function boot() {
  $('#s-map').innerHTML = mapScreen();
  bindMap();
  const r = $('#mapsvg').getBoundingClientRect(); if (r.width) { V.W = r.width; V.H = r.height; }
  installGateActs(); loadVoices(); renderAll(); renderGate(); startI18n();
  setInterval(() => { renderStrip(); const pill = $('#daypill'); if (pill && S.tab === 'day') { renderScreen.keep = true; renderScreen(); } }, 30000);
  window.__LSG = { S, P, buildTimeline, feasibility, dayInfo, legMin, walkMin, A };
}
boot();
})();
