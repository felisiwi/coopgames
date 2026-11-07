// Landmark Lab, the pure parts (no THREE scene, no DOM): the address parameters and the shelf layout, so both are testable in node.
//
// URL: ?mode=shelf|boat  ?era=1703|1950|today|all  ?type=all|cairn|polemark|fyrkur|sjobod|church|windmill|darkhouse  ?v=<variant> (one variant, turntable)
//      ?night=1  ?cam=game|weather|speed|orbit (shelf: game|orbit; boat: the three game cameras)  ?zoom=<n>  ?az= ?el= ?dist= (orbit)  ?rot=<deg>  ?fig=0|1 (the 1.5 m figure for scale)
//      ?rs=0|1 (apply the game's read scale: default 0 on the shelf, 1 from the boat)  ?view=<id from data/landmarks.json> (boat)  ?lm=0|1 (draw the kit's landmarks; 0 = the bare game)  ?panel=1
import { TYPE_IDS, LANDMARK_TYPES, ALL_VARIANTS } from './landmark-assets.js';

export const LAB_ERAS = ['1703', '1950', 'today', 'all'];
export const LAB_MODES = ['shelf', 'boat'];
export const LAB_DEFAULTS = { mode: 'shelf', type: 'cairn', era: '1950', v: '', night: 0, cam: 'game', zoom: 1, az: 35, el: 30, dist: 30, rot: 40, fig: 1, rs: 0, view: '', lm: 1 };
export const CAM_CHOICES = ['game', 'weather', 'speed', 'orbit'];
export const BOAT_ERAS = ['1703', '1950', 'today'];
export const rsDefault = (mode) => (mode === 'boat' ? 1 : 0); // from the boat the game's read scale is on: that is how the game places landmarks

const num = (x, lo, hi, d) => { const n = Number(x); return Number.isFinite(n) && x !== null && x !== '' ? Math.min(hi, Math.max(lo, n)) : d; };
export function parseLabParams(search) {
  const q = new URLSearchParams(search);
  const S = { ...LAB_DEFAULTS };
  if (LAB_MODES.includes(q.get('mode'))) S.mode = q.get('mode');
  if (LAB_ERAS.includes(q.get('era'))) S.era = q.get('era');
  const t = q.get('type');
  if (t === 'all' || TYPE_IDS.includes(t)) S.type = t;
  const v = q.get('v');
  if (v) { const hit = ALL_VARIANTS.find((x) => x.variant === v && (S.type === 'all' || x.type === S.type)) ?? ALL_VARIANTS.find((x) => x.variant === v); if (hit) { S.v = v; S.type = hit.type; } }
  S.night = q.get('night') === '1' ? 1 : 0;
  S.cam = CAM_CHOICES.includes(q.get('cam')) ? q.get('cam') : 'game';
  S.zoom = num(q.get('zoom'), 0.05, 3, LAB_DEFAULTS.zoom);
  S.az = num(q.get('az'), 0, 360, LAB_DEFAULTS.az); S.el = num(q.get('el'), 4, 88, LAB_DEFAULTS.el); S.dist = num(q.get('dist'), 3, 400, LAB_DEFAULTS.dist);
  S.rot = num(q.get('rot'), 0, 360, LAB_DEFAULTS.rot);
  S.fig = q.get('fig') === '0' ? 0 : 1;
  S.rs = q.has('rs') ? (q.get('rs') === '1' ? 1 : 0) : rsDefault(S.mode);
  S.view = q.get('view') || '';
  S.lm = q.get('lm') === '0' ? 0 : 1;
  if (S.mode === 'boat' && !BOAT_ERAS.includes(S.era)) S.era = '1950'; // the coast is built per era: no 'all' from the boat
  return S;
}
// Write only what differs from the defaults, and keep unrelated parameters (panel=1, anything the page does not know).
export function labParamsToSearch(search, S) {
  const q = new URLSearchParams(search);
  for (const k of Object.keys(LAB_DEFAULTS)) q.delete(k);
  for (const [k, d0] of Object.entries(LAB_DEFAULTS)) { const d = k === 'rs' ? rsDefault(S.mode) : d0; if (S[k] !== d && S[k] != null && !(S[k] === '' && d === '')) q.set(k, String(S[k])); }
  const s = q.toString();
  return s ? `?${s}` : '';
}

// ---- the shelf -------------------------------------------------------------------------------------------------------
// Extra shelf entries that are one variant at another size (the sources give several sizes of one look).
const EXTRAS = [
  { type: 'cairn', variant: 'cone-white-arm', opts: { size: 'small' }, label: 'Pipeskär: white cone, 2.6 m (1933)', eras: ['1950', 'today'] },
  { type: 'cairn', variant: 'small-white', opts: { h: 1.8 }, label: 'Tenholmen: small white, 1.8 m', eras: ['1950', 'today'] },
  { type: 'cairn', variant: 'small-white', opts: { h: 2.5 }, label: 'Islandsberg: small white, 2.5 m (1875)', eras: ['1950', 'today'] },
];
// Which looks to put on the shelf for an era ('all' = everything, including the variants that stood only between our eras: shown with their 1950 look).
export function shelfEntries({ era = '1950', type = 'all', v = '' } = {}) {
  const out = [];
  for (const x of ALL_VARIANTS) {
    if (type !== 'all' && x.type !== type) continue;
    if (v && x.variant !== v) continue;
    const stands = era === 'all' ? true : x.eras.includes(era);
    if (!stands) continue;
    out.push({ key: `${x.type}/${x.variant}`, type: x.type, variant: x.variant, opts: {}, label: x.label, eras: x.eras, eraLabel: x.eras.length ? x.eras.join(' · ') : x.eraLabel, era: era === 'all' ? (x.eras[0] ?? '1950') : era });
  }
  if (!v) for (const e of EXTRAS) if ((type === 'all' || e.type === type) && (era === 'all' || e.eras.includes(era))) out.push({ key: `${e.type}/${e.variant}/${JSON.stringify(e.opts)}`, type: e.type, variant: e.variant, opts: e.opts, label: e.label, eras: e.eras, eraLabel: e.eras.join(' · '), era: era === 'all' ? e.eras[0] : era });
  const order = new Map(TYPE_IDS.map((t, i) => [t, i]));
  return out.sort((a, b) => order.get(a.type) - order.get(b.type)); // stable: variants keep the kit's order inside a type
}
// Lay entries out in rows (perRow across), each cell as wide as its frame (the kit's "fits on screen" size) plus a margin. x to the right, z toward the camera.
export function layoutShelf(entries, { perRow = 3, margin = 1.25 } = {}) {
  const rows = []; // each type starts a new row, so a row never mixes a hut row with a cairn
  for (let i = 0; i < entries.length;) { let j = i; while (j < entries.length && j - i < perRow && entries[j].type === entries[i].type) j++; rows.push(entries.slice(i, j)); i = j; }
  const frameOf = (e) => LANDMARK_TYPES[e.type].variants[e.variant]?.frame ?? LANDMARK_TYPES[e.type].frame; // a variant may be wider than its type (a row of huts)
  let z = 0, width = 0;
  const items = [];
  const rowInfo = rows.map((row) => ({ w: row.reduce((s, e) => s + frameOf(e) * margin, 0), d: Math.max(...row.map(frameOf)) * margin }));
  const depth = rowInfo.reduce((s, r) => s + r.d, 0);
  rows.forEach((row, ri) => {
    const info = rowInfo[ri];
    width = Math.max(width, info.w);
    let x = -info.w / 2;
    z += info.d / 2;
    for (const e of row) { const cw = frameOf(e) * margin; items.push({ ...e, x: x + cw / 2, z: z - depth / 2, cell: cw }); x += cw; }
    z += info.d / 2;
  });
  return { items, width, depth, tallest: Math.max(0, ...entries.map(frameOf)) };
}
