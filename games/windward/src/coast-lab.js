// Coast Lab: top-down preview of the real-coast data at three world scales,
// with a year slider (settlements and lighthouses by year) and a draggable boat
// that shows treesNear(). Preview only; not wired into the game.
import { loadCoast, tripEstimate, recommendScale, fmtDuration } from './coast-data.js';
import { makeTreesNear, classSamplerFromCoast, DEFAULT_RADIUS } from './trees-near.js';
import { stateAt as stateAtYear, populationAt, houseWidth } from './history.js';

const SCALES = [6, 8, 10];
const DEFAULT_SCALE = 10;                       // Felix: 1:10 is the default
const YEAR_MIN = 1700, YEAR_MAX = 2025;
const MIN_SKERRY_GM = 2.5;                      // smallest islet drawn, in GAME metres
const TARGET_S = 20 * 60;
const PEEK_PX = 214;                            // collapsed bottom-sheet height on phones (matches --peek in the CSS)
const PRESETS = [
  { label: 'Herring boom 1747–1809', from: 1747, to: 1809 },
  { label: '1880–1900', from: 1880, to: 1900 },
  { label: 'Today', from: 2025, to: 2025 },
];
const COVER_COL = {
  bare_rock: [205, 183, 179], heath: [166, 122, 150], meadow: [168, 232, 81], scrub: [116, 170, 70], forest: [38, 96, 52], village: [232, 130, 60],
};
// one colour AND one shape per phase kind (shape helps if colours are hard to tell apart)
const KIND = {                                  // phase -> roof colour
  hamlet: { label: 'settled (no phase sourced)', color: '#e8e1d0', glyph: '■' },
  'herring-boom': { label: 'herring boom', color: '#f2c94c', glyph: '■' },
  decline: { label: 'decline', color: '#8f9ab5', glyph: '■' },
  'canning/industry': { label: 'canning / industry', color: '#ee7d5e', glyph: '■' },
  resort: { label: 'resort', color: '#7fd9b4', glyph: '■' },
};
// No population count at that year: the house is sized by phase and drawn as an outline only.
const PHASE_W = { hamlet: 12, 'herring-boom': 26, decline: 16, 'canning/industry': 24, resort: 22 };
const TREE_COL = { pine: '#1f4d2b', spruce: '#16392a', bush: '#6aaa48', juniper: '#4d8c70', birch: '#a6d870' };
const ROUTE_COL = ['#fff3b0', '#ffb3d1'];

const $ = (id) => document.getElementById(id);
const canvas = $('map'), ctx = canvas.getContext('2d');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const isMobile = () => matchMedia('(max-width: 700px)').matches;
const dpr = () => devicePixelRatio || 1;

let C, S = DEFAULT_SCALE, mode = 'terrain', zoom = 0.05, cx = 0, cy = 0, speed = 6;
const layers = { settle: true, light: true, places: true, route: true, skerries: true, trees: true };
// Some old counts come (via sv.wikipedia) from Tabellverket / the Demographic Data Base, whose terms restrict bulk copying and
// commercial use. They are tagged licence 'ddb-restricted' in the data; this switch (also ?ddb=0) leaves them out. See SOURCES.md.
let useDdb = new URLSearchParams(location.search).get('ddb') !== '0';
let settlements = [], lighthouses = null;
let boat = { i: 0, j: 0 };                      // plane pixel coords: stays put when the scale changes
const imgs = { terrain: new Map(), cover: new Map() };
const treesFns = new Map();
let treeCache = { key: '', list: [] };

// ---------------------------------------------------------------- years (URL: ?from=&to=)
const qs = new URLSearchParams(location.search);
const qnum = (k) => { const v = parseInt(qs.get(k), 10); return Number.isFinite(v) ? clamp(v, YEAR_MIN, YEAR_MAX) : null; };
let yFrom = qnum('from') ?? qnum('to') ?? 2025, yTo = qnum('to') ?? qnum('from') ?? 2025;
if (yFrom > yTo) [yFrom, yTo] = [yTo, yFrom];

// ---------------------------------------------------------------- settlements: phase and population at a year (src/history.js)
const stateAt = (st, y) => stateAtYear(st, y, YEAR_MAX);
const popAt = (st, y) => populationAt(st, y, { useDdb });
// Houses are oversized on purpose, but on a small map (phone, zoomed out) they would bury each other: scale them with zoom.
const houseScale = () => clamp(Math.sqrt(zoom / 0.055), 0.45, 1.5);
const fmtPop = (n) => n.toLocaleString('en-US');
function shade(hex, amt) {                      // amt -1..1 : darker .. lighter
  const n = parseInt(hex.slice(1), 16), mix = amt < 0 ? 0 : 255, k = Math.abs(amt);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (mix - v) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// ---------------------------------------------------------------- tile images
function buildImage(tile, kind) {
  const stride = isMobile() ? 2 : 1;
  const w = Math.ceil(tile.width / stride), h = Math.ceil(tile.height / stride);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const x = cv.getContext('2d'), id = x.createImageData(w, h), d = id.data;
  const names = C.meta.classes.map((c) => c.name);
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    const p = Math.min(tile.height - 1, yy * stride) * tile.width + Math.min(tile.width - 1, xx * stride);
    let c;
    if (tile.land[p] > 0) {
      if (kind === 'cover') c = COVER_COL[names[tile.classes[p]]] || [255, 0, 255];
      else { const t = Math.min(1, (tile.land[p] - 1) / 10 / 70); c = [190 + 48 * t, 160 + 62 * t, 158 + 56 * t]; }
    } else {
      const dm = tile.depth[p] / 10;
      c = dm < 12 ? [118 - 71 * (dm / 12), 214 - 80 * (dm / 12), 214 - 22 * (dm / 12)] : [47 - 29 * Math.min(1, (dm - 12) / 50), 134 - 71 * Math.min(1, (dm - 12) / 50), 192 - 72 * Math.min(1, (dm - 12) / 50)];
    }
    const o = (yy * w + xx) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
  }
  x.putImageData(id, 0, 0);
  return cv;
}
const tileImage = (tile) => { const m = imgs[mode]; if (!m.has(tile.id)) m.set(tile.id, buildImage(tile, mode)); return m.get(tile.id); };

// ---------------------------------------------------------------- view maths. World = game metres, origin = plane's north-west corner.
const gm = () => C.mpp / S;                                         // game metres per raster pixel
const insetPx = () => (isMobile() ? PEEK_PX * dpr() : 0);          // phone: the collapsed bottom sheet covers this much
const topPx = () => (isMobile() ? 56 * dpr() : 0);                 // phone: the zoom/scale buttons cover this much
const centreY = () => (topPx() + canvas.height - insetPx()) / 2;
const toScreen = (gx, gy) => [(gx - cx) * zoom + canvas.width / 2, (gy - cy) * zoom + centreY()];
const toWorld = (sx, sy) => [(sx - canvas.width / 2) / zoom + cx, (sy - centreY()) / zoom + cy];
const lonLatToWorld = (lon, lat) => { const [px, py] = C.toPx(lon, lat); return [px * gm(), py * gm()]; };
const boatWorld = () => [boat.i * gm(), boat.j * gm()];
const evtScreen = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * dpr(), (e.clientY - r.top) * dpr()]; };

function niceLength(maxGm) {
  let best = 1;
  for (const m of [1, 2, 5]) for (let k = 0; k < 6; k++) { const v = m * 10 ** k; if (v <= maxGm) best = Math.max(best, v); }
  return best;
}

// ---------------------------------------------------------------- trees near the boat
function currentTrees() {
  if (!treesFns.has(S)) treesFns.set(S, makeTreesNear({ classAt: classSamplerFromCoast(C, S), seed: 1 }));
  const [bx, bz] = boatWorld();
  const key = `${S}:${Math.round(bx)}:${Math.round(bz)}`;
  if (treeCache.key !== key) treeCache = { key, list: treesFns.get(S)(bx, bz, DEFAULT_RADIUS) };
  return treeCache.list;
}

// ---------------------------------------------------------------- drawing
// An oversized house seen from above: gable roof (two shaded halves + ridge) and a chimney.
// `estimated` = no population count: outline only, dashed.
function drawHouse(x, y, w, color, estimated, f) {
  const h = w * 0.78, x0 = x - w / 2, y0 = y - h / 2;
  ctx.lineJoin = 'round';
  if (estimated) {
    ctx.setLineDash([4 * f, 3 * f]); ctx.strokeStyle = color; ctx.lineWidth = 2 * f;
    ctx.strokeRect(x0, y0, w, h);
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); ctx.stroke(); ctx.setLineDash([]);
  } else {
    ctx.fillStyle = shade(color, -0.22); ctx.fillRect(x0, y0, w, h / 2);              // sunless slope
    ctx.fillStyle = color; ctx.fillRect(x0, y, w, h / 2);                              // sunny slope
    ctx.fillStyle = '#3a2a24'; ctx.fillRect(x0 + w * 0.68, y0 + h * 0.12, Math.max(2 * f, w * 0.13), Math.max(2 * f, w * 0.13));   // chimney
    ctx.strokeStyle = '#000a'; ctx.lineWidth = 1.5 * f; ctx.strokeRect(x0, y0, w, h);
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); ctx.strokeStyle = '#0006'; ctx.stroke();
  }
}

function draw() {
  const f = dpr(), w = Math.round(canvas.clientWidth * f), h = Math.round(canvas.clientHeight * f);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b141b'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!C) return;
  const k = zoom * gm();                                              // screen px per raster px
  const [ox, oy] = toScreen(0, 0);
  ctx.imageSmoothingEnabled = k < 1;
  for (const t of C.tiles) ctx.drawImage(tileImage(t), ox + t.x0 * k, oy + t.y0 * k, t.width * k, t.height * k);

  if (layers.skerries) {
    ctx.fillStyle = '#c4a8a3'; ctx.strokeStyle = '#7d625e'; ctx.lineWidth = f;
    for (const [lon, lat, wd] of C.skerries) {
      const [sx, sy] = toScreen(...lonLatToWorld(lon, lat));
      if (sx < -10 || sy < -10 || sx > canvas.width + 10 || sy > canvas.height + 10) continue;
      const r = Math.max(Math.max(wd / S, MIN_SKERRY_GM) * zoom / 2, 0.9 * f);
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.283); ctx.fill(); if (r > 2.5 * f) ctx.stroke();
    }
  }
  if (layers.route) {
    C.routes.forEach((rt, n) => {
      ctx.strokeStyle = ROUTE_COL[n % ROUTE_COL.length]; ctx.lineWidth = 2.5 * f; ctx.setLineDash([8 * f, 5 * f]); ctx.beginPath();
      rt.points.forEach(([lon, lat], i) => { const [sx, sy] = toScreen(...lonLatToWorld(lon, lat)); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
      ctx.stroke();
    });
    ctx.setLineDash([]);
  }

  if (layers.trees) {
    const trees = currentTrees();
    for (const t of trees) {
      const [sx, sy] = toScreen(t.x, t.z);
      if (sx < -8 || sy < -8 || sx > canvas.width + 8 || sy > canvas.height + 8) continue;
      ctx.fillStyle = TREE_COL[t.kind] || '#3a7d44';
      ctx.beginPath(); ctx.arc(sx, sy, clamp(1.7 * t.size * zoom, 1.1 * f, 7 * f), 0, 6.283); ctx.fill();
    }
    const [bsx, bsy] = toScreen(...boatWorld());
    document.body.dataset.boat = `${Math.round(bsx / f)},${Math.round(bsy / f)}`;      // CSS px; lets browser tests find the boat
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * f; ctx.setLineDash([6 * f, 4 * f]);
    ctx.beginPath(); ctx.arc(bsx, bsy, DEFAULT_RADIUS * zoom, 0, 6.283); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000c'; ctx.lineWidth = 2 * f;
    ctx.beginPath(); ctx.moveTo(bsx, bsy - 9 * f); ctx.lineTo(bsx + 6 * f, bsy + 7 * f); ctx.lineTo(bsx - 6 * f, bsy + 7 * f); ctx.closePath(); ctx.stroke(); ctx.fill();
  }

  // labels share one collision list: settlements first, then lighthouses, then other places
  ctx.font = `${12 * f}px system-ui, sans-serif`; ctx.textBaseline = 'middle';
  const taken = [];
  const label = (text, sx, sy, dx = 10) => {
    const tw = ctx.measureText(text).width, box = [sx + (dx - 2) * f, sy - 8 * f, tw + 4 * f, 16 * f];
    if (taken.some((b) => box[0] < b[0] + b[2] && box[0] + box[2] > b[0] && box[1] < b[1] + b[3] && box[1] + box[3] > b[1])) return;
    taken.push(box);
    ctx.lineWidth = 3 * f; ctx.strokeStyle = '#000c'; ctx.strokeText(text, sx + dx * f, sy);
    ctx.fillStyle = '#fff'; ctx.fillText(text, sx + dx * f, sy);
  };
  const onScreen = (sx, sy) => sx > -60 && sy > -20 && sx < canvas.width + 60 && sy < canvas.height + 20;
  let counted = 0, estimated = 0;
  if (layers.settle) {
    const items = [];
    for (const s of settlements) {
      const st = stateAt(s, yTo); if (!st) continue;
      const [sx, sy] = toScreen(...lonLatToWorld(s.lon, s.lat)); if (!onScreen(sx, sy)) continue;
      const pop = popAt(s, yTo);
      items.push({ s, st, pop, sx, sy, w: (pop ? houseWidth(pop.value) : PHASE_W[st.kind]) * houseScale() * f });
    }
    items.sort((a, b) => b.w - a.w);                                   // big houses first, so small ones sit on top and stay visible
    for (const { s, st, pop, sx, sy, w } of items) {
      if (s.firstRecorded != null && s.firstRecorded >= yFrom && s.firstRecorded <= yTo) {          // first recorded inside the window
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * f; ctx.beginPath(); ctx.rect(sx - w / 2 - 4 * f, sy - w * 0.39 - 4 * f, w + 8 * f, w * 0.78 + 8 * f); ctx.stroke();
      }
      drawHouse(sx, sy, w, KIND[st.kind].color, !pop, f);
      if (pop) counted++; else estimated++;
    }
    for (const { s, pop, sx, sy, w } of items) label(pop ? `${s.name} ${fmtPop(pop.value)}` : s.name, sx, sy, w / (2 * f) + 6);   // labels last, biggest places first
  }
  document.body.dataset.houses = `${counted},${estimated}`;                                         // counted,estimated (for browser tests)
  if (lighthouses && layers.light) {
    for (const l of lighthouses) {
      if (l.built > yTo) continue;
      const [sx, sy] = toScreen(...lonLatToWorld(l.lon, l.lat)); if (!onScreen(sx, sy)) continue;
      if (l.built >= yFrom) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * f; ctx.beginPath(); ctx.arc(sx, sy, 10 * f, 0, 6.283); ctx.stroke(); }
      ctx.fillStyle = '#ffd24a'; ctx.strokeStyle = '#000c'; ctx.lineWidth = 1.5 * f;
      ctx.beginPath(); ctx.moveTo(sx, sy - 7 * f); ctx.lineTo(sx + 6 * f, sy + 5 * f); ctx.lineTo(sx - 6 * f, sy + 5 * f); ctx.closePath(); ctx.stroke(); ctx.fill();
      label(`${l.name} ${l.built}`, sx, sy, 10);
    }
  }
  if (layers.places) {
    const order = [...C.places].sort((a, b) => (a.kind === 'village') - (b.kind === 'village'));
    for (const p of order) {
      if (layers.settle && settlements.some((s) => s.name === p.name)) continue;   // the settlement marker replaces the plain village dot
      if (lighthouses && layers.light && p.kind === 'lighthouse') continue;       // real lighthouse layer replaces ours
      const [sx, sy] = toScreen(...lonLatToWorld(p.lon, p.lat)); if (!onScreen(sx, sy)) continue;
      ctx.fillStyle = p.kind === 'lighthouse' ? '#ffd24a' : p.kind === 'fortress' ? '#ff9e6b' : p.kind === 'island' ? '#ffffff' : '#ff5d73';
      ctx.strokeStyle = '#000b'; ctx.lineWidth = 1.5 * f; ctx.beginPath();
      if (p.kind === 'lighthouse') { ctx.moveTo(sx, sy - 6 * f); ctx.lineTo(sx + 5 * f, sy + 4 * f); ctx.lineTo(sx - 5 * f, sy + 4 * f); ctx.closePath(); }
      else if (p.kind === 'fortress') ctx.rect(sx - 4 * f, sy - 4 * f, 8 * f, 8 * f);
      else ctx.arc(sx, sy, (p.kind === 'island' ? 3 : 4) * f, 0, 6.283);
      ctx.stroke(); ctx.fill(); label(p.name, sx, sy, 10);
    }
  }

  // scale bar (game metres) + boat reference, above the phone sheet when collapsed
  const bar = niceLength((canvas.width * 0.28) / zoom), bx = 16 * f, by = canvas.height - insetPx() - 40 * f;
  ctx.strokeStyle = '#000c'; ctx.lineWidth = 4 * f;
  ctx.beginPath(); ctx.moveTo(bx, by - 5 * f); ctx.lineTo(bx, by); ctx.lineTo(bx + bar * zoom, by); ctx.lineTo(bx + bar * zoom, by - 5 * f); ctx.stroke();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.8 * f; ctx.stroke();
  ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fff';
  const txt = `${bar >= 1000 ? bar / 1000 + ' km' : bar + ' m'} game = ${((bar * S) / 1000).toFixed(bar * S < 1000 ? 2 : 1)} km real (1:${S})`;
  ctx.lineWidth = 3 * f; ctx.strokeStyle = '#000c'; ctx.strokeText(txt, bx, by - 9 * f); ctx.fillText(txt, bx, by - 9 * f);
  if (6 * zoom >= 3 * f) { ctx.fillStyle = '#ffd24a'; ctx.fillRect(bx, by + 8 * f, 6 * zoom, 4 * f); ctx.fillText('boat = 6 m', bx + 6 * zoom + 6 * f, by + 13 * f); }
}

// ---------------------------------------------------------------- scale / fit / boat
function setScale(s) {
  if (C && s !== S) { const k = S / s; cx *= k; cy *= k; }             // keep the same real spot centred
  S = s;
  document.querySelectorAll('#scales button').forEach((b) => b.classList.toggle('on', +b.dataset.s === S));
  panelsScale(); draw();
}
function fit() {
  const worldW = (C.width * C.mpp) / S, worldH = (C.height * C.mpp) / S;
  zoom = Math.min(canvas.width / worldW, (canvas.height - insetPx() - topPx()) / worldH) * 0.95;
  cx = worldW / 2; cy = worldH / 2; draw();
}
function goBoat() { zoom = Math.max(zoom, 0.28); [cx, cy] = boatWorld(); draw(); }
function zoomAt(factor, sx, sy) {
  const [wx, wy] = toWorld(sx, sy); zoom = clamp(zoom * factor, 0.003, 12);
  cx = wx - (sx - canvas.width / 2) / zoom; cy = wy - (sy - centreY()) / zoom; draw();
}

// ---------------------------------------------------------------- info line (hover / tap)
function infoAt(sx, sy) {
  const f = dpr(), near = 16 * f, hits = [];                          // candidates near the pointer; the closest wins
  if (layers.settle) for (const s of settlements) {
    const st = stateAt(s, yTo); if (!st) continue;
    const [px, py] = toScreen(...lonLatToWorld(s.lon, s.lat)), pop = popAt(s, yTo);
    const w = (pop ? houseWidth(pop.value) : PHASE_W[st.kind]) * houseScale() * f;
    if (Math.abs(px - sx) <= Math.max(w / 2 + 4 * f, near) && Math.abs(py - sy) <= Math.max(w * 0.39 + 4 * f, near)) {
      const ph = st.phase ? `${KIND[st.kind].label} ${st.phase.from}–${st.phase.to ?? 'ongoing'}` : 'no sourced phase at this year';
      const pp = !pop ? 'population: no count, house size estimated from the phase (outline)'
        : pop.mode === 'counted' ? `population ${fmtPop(pop.value)} (${pop.counts}, ${pop.year})`
        : pop.mode === 'interpolated' ? `population about ${fmtPop(pop.value)} (between ${pop.from.year} and ${pop.to.year} counts)`
        : `population ${fmtPop(pop.value)} (${pop.counts}, nearest count ${pop.year})`;
      hits.push({ d: Math.hypot(px - sx, py - sy), text: `${s.name} · first recorded ${s.firstRecorded ?? 'not sourced'} · ${ph} · ${pp} · confidence ${s.confidence}` });
    }
  }
  if (lighthouses && layers.light) for (const l of lighthouses) {
    if (l.built > yTo) continue;
    const [px, py] = toScreen(...lonLatToWorld(l.lon, l.lat)), d = Math.hypot(px - sx, py - sy);
    if (d <= near) hits.push({ d, text: `${l.name} lighthouse · built ${l.built}` });
  }
  if (hits.length) return hits.sort((a, b) => a.d - b.d)[0].text;
  const [gx, gy] = toWorld(sx, sy), i = Math.floor(gx / gm()), j = Math.floor(gy / gm());
  if (!C.inTile(i, j)) return 'outside the data';
  const m = C.meta, lon = m.bbox.w + (i + 0.5) * C.mpp / m.projection.metersPerDegLon, lat = m.bbox.n - (j + 0.5) * C.mpp / m.projection.metersPerDegLat;
  const where = C.isLand(i, j) ? `${m.classes[C.classAt(i, j)].name.replace('_', ' ')} · ${C.heightM(i, j).toFixed(1)} m high` : `sea · depth ${C.depthM(i, j).toFixed(1)} m (placeholder model)`;
  return `${lat.toFixed(4)} N  ${lon.toFixed(4)} E · ${where}`;
}

// ---------------------------------------------------------------- pointer gestures: pan, drag the boat, pinch
const pointers = new Map();
let gesture = null, pinch = null;
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; gesture = null; return;
  }
  const [sx, sy] = evtScreen(e), [bsx, bsy] = toScreen(...boatWorld());
  const hit = layers.trees && Math.hypot(sx - bsx, sy - bsy) <= Math.max(DEFAULT_RADIUS * zoom, 30 * dpr());
  gesture = hit ? { type: 'boat', moved: 0, sx0: sx, sy0: sy, offx: bsx - sx, offy: bsy - sy } :   // keep the grab offset so the boat does not jump under the finger
    { type: 'pan', x: e.clientX, y: e.clientY, cx, cy, moved: 0 };
  canvas.classList.add('drag');
});
canvas.addEventListener('pointermove', (e) => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size >= 2) {
    const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, r = canvas.getBoundingClientRect();
    cx -= ((mx - pinch.mx) * dpr()) / zoom; cy -= ((my - pinch.my) * dpr()) / zoom;
    zoomAt(d / pinch.d, (mx - r.left) * dpr(), (my - r.top) * dpr());
    pinch = { d, mx, my }; return;
  }
  if (!gesture) { if (e.pointerType === 'mouse') $('status').textContent = infoAt(...evtScreen(e)); return; }
  const [sx, sy] = evtScreen(e);
  if (gesture.type === 'boat') {
    gesture.moved = Math.max(gesture.moved, Math.hypot(sx - gesture.sx0, sy - gesture.sy0));
    const [gx, gy] = toWorld(sx + gesture.offx, sy + gesture.offy); boat = { i: gx / gm(), j: gy / gm() }; draw(); panelsTrees();
  } else {
    gesture.moved = Math.max(gesture.moved, Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y));
    cx = gesture.cx - ((e.clientX - gesture.x) * dpr()) / zoom; cy = gesture.cy - ((e.clientY - gesture.y) * dpr()) / zoom; draw();
  }
});
const endPointer = (e) => {
  const wasTap = gesture && gesture.moved < 6 * (gesture.type === 'boat' ? dpr() : 1);
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (wasTap) $('status').textContent = infoAt(...evtScreen(e));         // tap = show info (phones have no hover)
  if (!pointers.size) { gesture = null; canvas.classList.remove('drag'); }
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); const [sx, sy] = evtScreen(e); zoomAt(Math.exp(-e.deltaY * 0.0015), sx, sy); }, { passive: false });
$('zin').onclick = () => zoomAt(1.5, canvas.width / 2, centreY());
$('zout').onclick = () => zoomAt(1 / 1.5, canvas.width / 2, centreY());
$('zfit').onclick = fit;
$('zboat').onclick = goBoat;
$('grab').onclick = () => $('sheet').classList.toggle('open');
new ResizeObserver(() => draw()).observe($('stage'));

// ---------------------------------------------------------------- year slider (two thumbs)
const track = $('yrTrack');
const frac = (y) => (y - YEAR_MIN) / (YEAR_MAX - YEAR_MIN);
function layoutSlider() {
  $('yrFrom').style.left = frac(yFrom) * 100 + '%'; $('yrTo').style.left = frac(yTo) * 100 + '%';
  $('yrFill').style.left = frac(yFrom) * 100 + '%'; $('yrFill').style.width = (frac(yTo) - frac(yFrom)) * 100 + '%';
  $('yrText').textContent = yFrom === yTo ? String(yTo) : `${yFrom} – ${yTo}`;
  $('yrHint').textContent = yFrom === yTo ? 'one year: drag to scrub, tap the rail to open a window' : 'white ring = new in the window';
  for (const [id, v] of [['yrFrom', yFrom], ['yrTo', yTo]]) $(id).setAttribute('aria-valuenow', v);
  $('yrTo').style.zIndex = yFrom >= YEAR_MAX - 20 ? 1 : 2;
  document.querySelectorAll('#presets button').forEach((b) => b.classList.toggle('on', +b.dataset.from === yFrom && +b.dataset.to === yTo));
  document.body.dataset.from = yFrom; document.body.dataset.to = yTo;
}
function syncUrl() {
  const u = new URL(location.href); u.searchParams.set('from', yFrom); u.searchParams.set('to', yTo);
  try { history.replaceState(null, '', u); } catch { /* sandboxed frames */ }
}
function setYears(a, b) { yFrom = clamp(Math.min(a, b), YEAR_MIN, YEAR_MAX); yTo = clamp(Math.max(a, b), YEAR_MIN, YEAR_MAX); layoutSlider(); syncUrl(); panelsYear(); draw(); }
function setThumb(which, y) { y = clamp(y, YEAR_MIN, YEAR_MAX); if (which === 'from') setYears(Math.min(y, yTo), yTo); else setYears(yFrom, Math.max(y, yFrom)); }
const yearFromEvent = (e) => { const r = track.getBoundingClientRect(); return Math.round(YEAR_MIN + clamp((e.clientX - r.left) / r.width, 0, 1) * (YEAR_MAX - YEAR_MIN)); };
let yDrag = null;
track.addEventListener('pointerdown', (e) => {
  track.setPointerCapture(e.pointerId); const y = yearFromEvent(e);
  let which;
  if (yFrom === yTo) which = Math.abs(y - yFrom) > 18 ? (y < yFrom ? 'from' : 'to') : 'both';   // thumbs overlap: on them = scrub one year; elsewhere on the rail = open a window
  else which = Math.abs(y - yFrom) <= Math.abs(y - yTo) ? 'from' : 'to';
  yDrag = { which, x0: e.clientX };
  if (which === 'both') setYears(y, y); else setThumb(which, y);
  e.preventDefault();
});
track.addEventListener('pointermove', (e) => {
  if (!yDrag) return;
  if (yDrag.which === 'both') { const y = yearFromEvent(e); setYears(y, y); return; }
  setThumb(yDrag.which, yearFromEvent(e));
});
for (const ev of ['pointerup', 'pointercancel']) track.addEventListener(ev, () => { yDrag = null; });
for (const [id, which] of [['yrFrom', 'from'], ['yrTo', 'to']]) {
  $(id).addEventListener('keydown', (e) => {
    const cur = which === 'from' ? yFrom : yTo;
    const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 }[e.key];
    let y = step ? cur + step : e.key === 'Home' ? YEAR_MIN : e.key === 'End' ? YEAR_MAX : null;
    if (y === null) return; e.preventDefault(); setThumb(which, y);
  });
}
$('presets').innerHTML = PRESETS.map((p) => `<button data-from="${p.from}" data-to="${p.to}">${p.label}</button>`).join('');
$('presets').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setYears(+b.dataset.from, +b.dataset.to); });
$('yrTicks').innerHTML = [1700, 1800, 1900, 2025].map((y) => `<span style="left:${frac(y) * 100}%">${y}</span>`).join('');

// ---------------------------------------------------------------- side panel
$('scales').innerHTML = SCALES.map((s) => `<button data-s="${s}">1:${s}</button>`).join('');
$('scales').addEventListener('click', (e) => { if (e.target.dataset.s) setScale(+e.target.dataset.s); });
document.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', () => { mode = r.value; draw(); }));
$('chkDdb').checked = useDdb;
$('chkDdb').addEventListener('change', (e) => { useDdb = e.target.checked; draw(); panelsYear(); });
for (const [id, key] of [['chkSettle', 'settle'], ['chkLight', 'light'], ['chkPlaces', 'places'], ['chkRoute', 'route'], ['chkSkerries', 'skerries'], ['chkTrees', 'trees']]) {
  $(id).addEventListener('change', (e) => { layers[key] = e.target.checked; draw(); panelsTrees(); });
}
$('speed').addEventListener('input', (e) => { speed = Math.max(1, +e.target.value || 6); panelsTrips(); });

function panelsTrips() {
  $('trips').innerHTML = C.routes.map((rt) => {
    const rec = recommendScale(rt.length_m, SCALES, speed, TARGET_S);
    return `<table><caption style="text-align:left;color:var(--dim);font-size:12px;padding-top:6px">${rt.from} → ${rt.to}, ${(rt.length_m / 1000).toFixed(1)} km real</caption>
      <tr><th>scale</th><th>game km</th><th>time</th><th>vs 20 min</th></tr>${SCALES.map((s) => {
      const t = tripEstimate(rt.length_m, s, speed), d = t.seconds - TARGET_S;
      return `<tr class="${s === rec ? 'rec' : ''} ${s === S ? 'cur' : ''}"><td>1:${s}${s === rec ? ' ★' : ''}</td><td>${(t.gameMeters / 1000).toFixed(1)}</td><td>${fmtDuration(t.seconds)}</td><td>${d >= 0 ? '+' : '−'}${fmtDuration(Math.abs(d))}</td></tr>`;
    }).join('')}</table>`;
  }).join('');
  const r0 = C.routes[0];
  $('tripnote').textContent = C.routes.map((rt) => `${rt.from} → ${rt.to}: open-sea alternative ${((rt.offshoreLength_m || 0) / 1000).toFixed(1)} km; ends sit ${rt.startSnap_m} m / ${rt.endSnap_m} m off the town points (harbours are too narrow for the 100 m clearance rule).`).join(' ')
    + ` ★ = closest to 20 min; blue bar = the scale shown. Exactly 20 min at ${speed} m/s for ${r0.from} → ${r0.to} would be 1:${(r0.length_m / (speed * TARGET_S)).toFixed(1)}.`;
}
function panelsScale() {
  panelsTrips();
  $('skerrynote').textContent = `Islets narrower than ${MIN_SKERRY_GM} game m are drawn ${MIN_SKERRY_GM} m wide (= ${MIN_SKERRY_GM * S} m real at 1:${S}; ${C.skerries.length} islets under 25 m wide in the data).`;
  const names = C.meta.classes.map((c) => c.name).slice(1);
  $('cover').innerHTML = '<tr><th>class</th><th>% of land</th><th>km² real</th></tr>' + names.map((n) =>
    `<tr><td><span class="sw" style="background:rgb(${COVER_COL[n]})"></span>${n.replace('_', ' ')}</td><td>${C.meta.classPercentOfLand[n]}</td><td>${C.meta.classKm2[n]}</td></tr>`).join('') + `<tr><td>land total</td><td>100</td><td>${C.meta.landKm2}</td></tr>`;
  const T = C.trees.totals['1:' + S];
  $('trees').innerHTML = '<tr><th>class</th><th>per 100 m²</th><th>trees</th></tr>' + names.map((n) =>
    `<tr><td>${n.replace('_', ' ')}</td><td>${C.trees.density[n]}</td><td>${T.byClass[n].toLocaleString()}</td></tr>`).join('') + `<tr><td><b>whole map</b></td><td></td><td><b>${T.total.toLocaleString()}</b></td></tr>`;
  $('treebox').innerHTML = `<div class="box bad"><b>Too heavy to plant everywhere.</b> ${T.total.toLocaleString()} is ${T.overBudgetBy}× the ${C.trees.budget.toLocaleString()} budget, so trees exist only inside the boat circle (<code>treesNear</code>).</div>`;
  panelsTrees(); panelsYear();
}
function panelsTrees() {
  if (!layers.trees) { $('treecount').textContent = 'Trees and boat are switched off.'; return; }
  const n = currentTrees().length, full = Math.round((Math.PI * DEFAULT_RADIUS * DEFAULT_RADIUS) / 100);
  $('treecount').innerHTML = `<b>${n.toLocaleString()}</b> trees within ${DEFAULT_RADIUS} m of the boat. A completely forested circle would hold about ${full.toLocaleString()}; phone budget is ${C.trees.budget.toLocaleString()}.`;
  document.body.dataset.trees = n;
}
function panelsYear() {
  $('legend').innerHTML = 'House = settlement, seen from above. Roof colour = phase: '
    + Object.values(KIND).map((k) => `<span style="color:${k.color}">${k.glyph}</span> ${k.label}`).join(' &nbsp; ')
    + '<br>Size = population at the end year (log scale). <b>Solid</b> = a counted population; <b>dashed outline</b> = no count, size set by phase (estimated). White frame = first recorded within the selected years. Several phases at one year: the latest-starting wins.';
  const rows = settlements.map((s) => ({ s, st: stateAt(s, yTo) })).filter((r) => r.st);
  $('setlist').innerHTML = '<tr><th>name</th><th>first</th><th>pop.</th><th>phase</th><th>conf.</th><th>src</th></tr>' + rows.map(({ s, st }) => {
    const pop = popAt(s, yTo);
    const ph = st.phase ? `${KIND[st.kind].glyph} ${KIND[st.kind].label} ${st.phase.from}–${st.phase.to ?? '…'}` : '–';
    const src = s.sources.map((u, i) => `<a href="${u}" target="_blank" rel="noopener">${i + 1}</a>`).join(' ');
    return `<tr><td>${s.name}</td><td>${s.firstRecorded ?? '?'}</td><td>${pop ? fmtPop(pop.value) + (pop.mode === 'counted' ? '' : '~') : 'est.'}</td><td style="text-align:left">${ph}</td><td>${s.confidence}</td><td>${src}</td></tr>`;
  }).join('');
  $('setdetails').hidden = !settlements.length;
}

// ---------------------------------------------------------------- optional data: settlements, lighthouses
async function loadSettlements() {
  try {
    const r = await fetch(new URL('../data/settlements-history.json', import.meta.url));
    if (!r.ok) return [];
    const j = await r.json();
    return (j.settlements || []).filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon) && Array.isArray(s.phases));
  } catch { return []; }
}
// Another agent adds `built` years to src/lighthouses.js on felix/windward-lighthouses. Until that module
// (and the lat/lon/built fields) exist here, the layer simply stays hidden. We never copy its data.
async function loadLighthouses() {
  try {
    const mod = await import('./lighthouses.js');
    const found = [], seen = new Set();
    const visit = (v, depth) => {
      if (!v || typeof v !== 'object' || seen.has(v) || depth > 4) return;
      seen.add(v);
      if (Array.isArray(v)) { v.forEach((x) => visit(x, depth + 1)); return; }
      const lon = v.lon ?? v.lng, lat = v.lat;
      if (Number.isFinite(lat) && Number.isFinite(lon) && Number.isFinite(v.built)) { found.push({ name: String(v.name || v.id || 'lighthouse'), lat, lon, built: v.built }); return; }
      Object.values(v).forEach((x) => visit(x, depth + 1));
    };
    Object.values(mod).forEach((x) => visit(x, 0));
    return found.length ? found : null;
  } catch { return null; }
}

// ---------------------------------------------------------------- start
try {
  C = await loadCoast(new URL('../assets/coast/', import.meta.url).href);
  [settlements, lighthouses] = await Promise.all([loadSettlements(), loadLighthouses()]);
  if (lighthouses) $('lblLight').hidden = false;
  const mars = C.places.find((p) => p.name === 'Marstrand');
  const [bi, bj] = mars ? C.toPx(mars.lon, mars.lat) : [C.width / 2, C.height / 2];
  boat = { i: bi + 14, j: bj - 6 };                                        // just off Marstrand
  $('loading').remove();
  canvas.width = Math.round(canvas.clientWidth * dpr()); canvas.height = Math.round(canvas.clientHeight * dpr());
  layoutSlider(); setScale(DEFAULT_SCALE); fit();
  // read-only hook for browser tests and debugging: what does the info line say at a coordinate?
  window.__coastLab = { infoAtLonLat: (lon, lat) => infoAt(...toScreen(...lonLatToWorld(lon, lat))), scale: () => S, houses: () => document.body.dataset.houses };
  document.body.dataset.ready = '1';
} catch (err) {
  $('loading').textContent = 'Could not load coast data: ' + err.message;
  console.error(err);
}
