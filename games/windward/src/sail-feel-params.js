// The sail-feel lab's settings, and how they live in the page URL (no localStorage at all: the URL IS the saved state).
// Pure: no DOM, no THREE. parseParams(search) -> settings; toSearch(settings, currentSearch) -> the query string that reproduces them.
// Only values that differ from the defaults are written, and params this module does not know (touch=1, sheet=rope ...) are left alone.
//
//   ?day=sea-breeze|grey-westerly|misty-morning|unsettled   (default: the seed's own day type)
//   ?t=14:00            the game clock (also 14.5)       ?seed=7       the day seed
//   ?ff=1               fast-forward the clock x10       ?freeze=1     stop the clock
//   ?off=gusts,spray    layers switched OFF (ids below)  ?zoom=1.4     camera distance (default 1.4: the game's is 1; further out = you see gusts sooner)
//   ?drift=0.4          how fast gust patches drift, as a share of the wind (the key tunable)
//   ?spray=1 ?heel=1    strength of those two (0 = none, 2 = double)
//   ?era=1950|today     which coast                      ?start=spawn|outside|inside   where you begin
//   ?demo=gust|lee|heel|swell|squall|mist   a ready-made scene (sets clock, boat, camera)
//   ?panel=1 ?debug=1   open the card / show fps
import { DAY_TYPES, parseClock, formatClock, timeOfHour } from './weather.js';

// Every switchable layer. group: where the panel lists it.
export const LAYERS = [
  { id: 'shifts', group: 'Wind', label: 'Shifts (lifts and headers)' },
  { id: 'gusts', group: 'Wind', label: 'Gusts and lulls' },
  { id: 'shadows', group: 'Wind', label: 'Island shadows (calm lees)' },
  { id: 'funnel', group: 'Wind', label: 'Funnelling in sounds' },
  { id: 'boost', group: 'Wind', label: 'Utomskärs: stronger, steadier' },
  { id: 'swell', group: 'Sea', label: 'Swell and surfing (outside)' },
  { id: 'squalls', group: 'Sea', label: 'Squalls and showers' },
  { id: 'mist', group: 'Sea', label: 'Weather mist (low visibility)' },
  { id: 'dip', group: 'Feel', label: 'Camera dip and tighten' },
  { id: 'look', group: 'Feel', label: 'Look ahead' },
  { id: 'spray', group: 'Feel', label: 'Bow spray' },
  { id: 'heel', group: 'Feel', label: 'Heel' },
  { id: 'luff', group: 'Feel', label: 'Luff flutter' },
  { id: 'arrow', group: 'Feel', label: 'Wind arrow' },
];
export const LAYER_IDS = LAYERS.map((l) => l.id);
export const ERAS = ['1950', 'today'];
export const STARTS = ['spawn', 'outside', 'inside'];
export const DEMOS = ['gust', 'lee', 'heel', 'swell', 'squall', 'mist'];

export const DEFAULTS = Object.freeze({
  era: '1950', day: 'auto', seed: 7, t: 14, ff: 0, freeze: 0, off: [], zoom: 1.4, drift: 0.4, spray: 1, heel: 1,
  start: 'spawn', demo: null, panel: 0, debug: 0,
});

const num = (text, lo, hi) => { if (text == null || String(text).trim() === '') return undefined; const n = Number(text); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : undefined; };

export function parseParams(search) {
  const q = new URLSearchParams(search);
  const out = { ...DEFAULTS, off: [] };
  if (ERAS.includes(q.get('era'))) out.era = q.get('era');
  if (DAY_TYPES.includes(q.get('day'))) out.day = q.get('day');
  const seed = num(q.get('seed'), 0, 99999);
  if (seed !== undefined) out.seed = Math.round(seed);
  const t = parseClock(q.get('t'));
  if (t !== null) out.t = t;
  if (q.get('ff') === '1') out.ff = 1;
  if (q.get('freeze') === '1') out.freeze = 1;
  if (q.has('off')) out.off = q.get('off').split(',').filter((id, i, a) => LAYER_IDS.includes(id) && a.indexOf(id) === i);
  for (const [k, lo, hi] of [['zoom', 0.5, 2.5], ['drift', 0.1, 1.2], ['spray', 0, 2], ['heel', 0, 2]]) { const v = num(q.get(k), lo, hi); if (v !== undefined) out[k] = v; }
  if (STARTS.includes(q.get('start'))) out.start = q.get('start');
  if (DEMOS.includes(q.get('demo'))) out.demo = q.get('demo');
  if (q.get('panel') === '1') out.panel = 1;
  if (q.get('debug') === '1') out.debug = 1;
  return out;
}

const KNOWN = new Set(['era', 'day', 'seed', 't', 'ff', 'freeze', 'off', 'zoom', 'drift', 'spray', 'heel', 'start', 'demo', 'panel', 'debug']);
const round = (v) => String(Math.round(v * 100) / 100);

// currentSearch: the page's existing query (its unknown params are kept). Returns '?a=b&c=d' or ''.
export function toSearch(s, currentSearch = '') {
  const keep = new URLSearchParams(currentSearch);
  for (const k of KNOWN) keep.delete(k);
  const q = new URLSearchParams(keep);
  if (s.era !== DEFAULTS.era) q.set('era', s.era);
  if (s.day !== DEFAULTS.day) q.set('day', s.day);
  if (s.seed !== DEFAULTS.seed) q.set('seed', String(s.seed));
  if (Math.abs(s.t - DEFAULTS.t) > 1e-9) q.set('t', formatClock(timeOfHour(s.t)));
  if (s.ff) q.set('ff', '1');
  if (s.freeze) q.set('freeze', '1');
  if (s.off.length) q.set('off', LAYER_IDS.filter((id) => s.off.includes(id)).join(','));
  for (const k of ['zoom', 'drift', 'spray', 'heel']) if (Math.abs(s[k] - DEFAULTS[k]) > 1e-9) q.set(k, round(s[k]));
  if (s.start !== DEFAULTS.start) q.set('start', s.start);
  if (s.demo) q.set('demo', s.demo);
  if (s.panel) q.set('panel', '1');
  if (s.debug) q.set('debug', '1');
  const text = q.toString();
  return text ? `?${text}` : '';
}
