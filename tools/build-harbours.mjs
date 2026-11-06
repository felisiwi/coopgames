// Audits every harbour and village for "can a boat sail from open water INTO the harbour?" and carves the approach where it
// cannot: writes tier "harbour" passes into games/windward/assets/coast/passes.json and games/windward/assets/coast/harbour-audit.json.
// Usage: node tools/build-harbours.mjs [--cache DIR] [--offline]
//   Overpass (natural=coastline cached by tools/build-passes.mjs, plus seamarks / quays / harbours here) with retries and a mirror,
//   generic User-Agent; responses cached, so a re-run is offline and deterministic. Idempotent: replaces the old harbour tier.
// Data: (c) OpenStreetMap contributors, ODbL 1.0.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCoast } from '../games/windward/src/coast-data.js';
import { buildCoastWorld, COAST_TILES } from '../games/windward/src/coast-world.js';
import { isBlocked } from '../games/windward/src/shore.js';
import { buildNameList } from '../games/windward/src/names.js';
import * as D from '../games/windward/src/pass-derive.js';
import { applyPasses, resetPasses, findRoute, passCellBox } from '../games/windward/src/passes.js';
import * as HA from '../games/windward/src/harbour-approach.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'games', 'windward') + '/';
const dir = ROOT + 'assets/coast/';
const argv = process.argv.slice(2);
const CACHE = argv.includes('--cache') ? argv[argv.indexOf('--cache') + 1] : join(tmpdir(), 'windward-passes-cache');
const OFFLINE = argv.includes('--offline');
mkdirSync(CACHE, { recursive: true });
export const REGION = { s: 58.085, w: 11.25, n: 58.30, e: 11.50 };
const BB = `(${REGION.s},${REGION.w},${REGION.n},${REGION.e})`;
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

async function overpass(name, query) {
  const file = join(CACHE, name + '.json');
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  if (OFFLINE) throw new Error(`--offline and ${file} is not cached`);
  let last;
  for (let round = 0; round < 4; round++) for (const url of ENDPOINTS) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'windward-harbours-fetch/1.0' }, body: 'data=' + encodeURIComponent(query), signal: AbortSignal.timeout(200000) });
      if (r.ok) { const j = await r.json(); writeFileSync(file, JSON.stringify(j)); return j; }
      last = `${url} -> HTTP ${r.status}`;
    } catch (e) { last = `${url} -> ${e.message}`; }
    console.error('overpass busy:', last, '(retrying)');
    await new Promise((res) => setTimeout(res, 15000 * (round + 1)));
  }
  throw new Error('Overpass unavailable after retries: ' + last);
}
const coastOsm = await overpass('coastline', `[out:json][timeout:180];\nway["natural"="coastline"](58.055,11.20,58.33,11.55);\nout geom(58.055,11.20,58.33,11.55);`);
const marksOsm = (await overpass('harbour-marks', `[out:json][timeout:120];\n(\n nwr["seamark:type"~"^(buoy_lateral|beacon_lateral|buoy_cardinal|beacon_cardinal|beacon_isolated_danger|light_minor|navigation_line|harbour|small_craft_facility)$"]${BB};\n nwr["leisure"="marina"]["name"]${BB};\n nwr["harbour"="yes"]${BB};\n nwr["man_made"~"^(pier|breakwater|quay)$"]${BB};\n);\nout geom tags;`)).elements;

const bridgesOsm = (await overpass('harbour-bridges', `[out:json][timeout:90];\n(way["bridge"~"^(yes|viaduct|movable)$"]${BB}; way["man_made"="bridge"]${BB};);\nout geom tags;`)).elements;

// ---- the world as the game builds it ----
const io = { json: async (u) => JSON.parse(readFileSync(u, 'utf8')), bytes: async (u) => new Uint8Array(readFileSync(u)) };
const coast = await loadCoast(dir, io, COAST_TILES);
const world = buildCoastWorld(coast, { skerries: JSON.parse(readFileSync(dir + 'skerries.json', 'utf8')).skerries });
const mpp = coast.meta.metersPerPixelReal, PJ = coast.meta.projection, REAL = 10;
const fromGame = (x, z) => [coast.meta.bbox.w + ((x / world.pxM) * mpp) / PJ.metersPerDegLon, coast.meta.bbox.n - ((z / world.pxM) * mpp) / PJ.metersPerDegLat];
const cellOf = (x, z) => ({ a: Math.floor((x - world.x0) / world.pxM), b: Math.floor((z - world.z0) / world.pxM) });
const centreOf = (a, b) => [world.x0 + (a + 0.5) * world.pxM, world.z0 + (b + 0.5) * world.pxM];
const r5 = (v) => Math.round(v * 1e5) / 1e5;
const mD = 111195, mL = mD * Math.cos((58.19 * Math.PI) / 180);

const ratio = 4, cellF = world.pxM / ratio, wF = world.nx * ratio, hF = world.nz * ratio;
const env = { water: null, wF, hF, cellF, x0: world.x0, z0: world.z0 };
env.water = D.rasterWater(D.segmentsFromWays(coastOsm.elements, world.toGame), { x0: world.x0, z0: world.z0, w: wF, h: hF, cell: cellF });
const clear = D.cellClearance(D.distanceToLand(env.water, wF, hF), wF, ratio, world.nx, world.nz, cellF);

// ---- the marks: the red/green channel, leading lines, and the quay lines to keep ----
const marks = [], navLines = [], quayLines = [], harbourNodes = [];
const toXZ = (g) => world.toGame(g.lon, g.lat);
for (const e of marksOsm) {
  const t = e.tags ?? {};
  if (e.type === 'node' && t['seamark:type'] === 'buoy_lateral') { const [x, z] = world.toGame(e.lon, e.lat); marks.push({ x, z, side: t['seamark:buoy_lateral:category'] }); }
  if (e.type === 'way' && t['seamark:type'] === 'navigation_line' && e.geometry) navLines.push(e.geometry.filter(Boolean).map(toXZ));
  if (e.type === 'way' && (t.man_made === 'quay' || t.man_made === 'breakwater') && e.geometry) quayLines.push(e.geometry.filter(Boolean).map(toXZ));
  if (e.type === 'node' && (t['seamark:type'] === 'harbour' || t.leisure === 'marina')) harbourNodes.push({ name: t.name ?? t['seamark:name'] ?? 'harbour', lat: e.lat, lon: e.lon });
}
const protect = HA.protectNear(quayLines, 0.9);
const fairway = HA.fairwayMask(world, marks, navLines);

// ---- targets: the places the arrival uses, every OSM harbour / marina, Felix's pins ----
const names = JSON.parse(readFileSync(dir + 'names.json', 'utf8'));
const placeNames = JSON.parse(readFileSync(ROOT + 'data/place-names.json', 'utf8'));
const settlements = JSON.parse(readFileSync(ROOT + 'data/settlements-history.json', 'utf8')).settlements;
const nameList = buildNameList({ names, villages: settlements, toGame: world.toGame, inside: (x, z) => world.inside(x, z, 80), placeNames }).filter((p) => p.kind === 'village' || p.kind === 'harbour');
const PRIORITY = ['Grundsunds hamn', 'Grundsund', 'Grundsunds Marina', 'Fiskebäckskil', 'Fiskebäckskils småbåtshamn', 'Lyckans slip Marina', 'Käringön', 'Käringöns gästhamn', 'harbour', 'Gullholmen', 'Gullholmens gästhamn', 'Lysekil', 'Fiskhamnens gästhamn', 'Norra Hamnens gästhamn', 'Hälleviksstrand', 'Hälleviksstrands Hamn'];
const targets = [];
const addT = (t) => { if (!targets.some((o) => Math.hypot(o.x - t.x, o.z - t.z) < 4 && o.name === t.name)) targets.push(t); };
for (const p of nameList) { const [lon, lat] = fromGame(p.x, p.z); addT({ name: p.name, kind: p.kind, src: 'name-list (arrival)', x: p.x, z: p.z, lat, lon }); }
for (const h of harbourNodes) { const [x, z] = world.toGame(h.lon, h.lat); if (!targets.some((o) => Math.hypot(o.x - x, o.z - z) < 6)) addT({ name: h.name, kind: 'quay', src: 'OSM harbour / marina', x, z, lat: h.lat, lon: h.lon }); }
for (const [nm, lon, lat] of [['Vrakevik (Felix)', 11.385059, 58.238711], ['Kråksundsgap (Felix)', 11.439134, 58.104431]]) { const [x, z] = world.toGame(lon, lat); if (!targets.some((o) => Math.hypot(o.x - x, o.z - z) < 8)) addT({ name: nm, kind: 'favourite', src: 'Felix pin', x, z, lat, lon }); }
for (const t of targets) { // the real quay water: the nearest real water; a village on land falls back to its nearest OSM harbour
  t.anchor = HA.realWaterNear(env, t.x, t.z);
  t.anchorOffM = t.anchor ? Math.round(t.anchor.d * REAL) : null;
  if (t.kind === 'village' && (!t.anchor || t.anchor.d > HA.ANCHOR_TRUST_M)) {
    const h = harbourNodes.map((n) => ({ n, d: Math.hypot((n.lat - t.lat) * mD, (n.lon - t.lon) * mL) / REAL })).sort((a, b) => a.d - b.d)[0];
    if (h && h.d <= 80) { t.viaHarbour = h.n.name; const [hx, hz] = world.toGame(h.n.lon, h.n.lat); t.anchor = HA.realWaterNear(env, hx, hz); t.anchorOffM = t.anchor ? Math.round(t.anchor.d * REAL) : null; }
  }
  t.confidence = t.anchor && t.anchor.d <= HA.ANCHOR_TRUST_M ? 'quay water' : t.anchor ? 'point on land (islet / village origin)' : 'no water within 150 m';
}
const rank = (t) => { const i = PRIORITY.indexOf(t.name); return i < 0 ? 99 : i; };
targets.sort((a, b) => rank(a) - rank(b));

// ---- state: the world with the ship tier applied (what the game will have), then each harbour carve on top ----
const passFile = JSON.parse(readFileSync(dir + 'passes.json', 'utf8'));
const basePasses = passFile.passes.filter((p) => p.tier !== 'harbour');
const H0 = world.H.slice(), CL0 = world.CL.slice();
const snap = () => ({ H: world.H.slice(), CL: world.CL.slice(), done: new Set(world.carvedPasses ?? []) });
const restoreTo = (s) => { world.H.set(s.H); world.CL.set(s.CL); world.carvedPasses = new Set(s.done); };
const sailW = new Uint8Array(world.nx * world.nz);
let labelW, mainW;
const refresh = () => { sailW.set(D.sailableMask(world, isBlocked)); const c = D.components(sailW, world.nx, world.nz); labelW = c.label; mainW = c.sizes.indexOf(Math.max(...c.sizes)); };
const gridW = () => ({ nx: world.nx, nz: world.nz, pxM: world.pxM, x0: world.x0, z0: world.z0, sail: sailW, label: labelW, clear });
const reachNow = (t) => (t.anchor ? HA.reachFromSea(gridW(), mainW, t.anchor.x, t.anchor.z, 40) : Infinity);

refresh(); const rawReach = new Map(targets.map((t) => [t, reachNow(t)]));
applyPasses(world, passFile.passes, { tiers: ['ship'], depth: false });
refresh(); const shipReach = new Map(targets.map((t) => [t, reachNow(t)]));
const shipState = snap();
console.log('targets', targets.length, '| blocked raw', [...rawReach.values()].filter((d) => !(d <= HA.HARBOUR_REACH_M)).length, '| blocked with the ship batch', [...shipReach.values()].filter((d) => !(d <= HA.HARBOUR_REACH_M)).length);

const slug = (s) => s.toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const lineLen = (pts) => pts.reduce((t, p, i) => (i ? t + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
const harbourPasses = [], audit = [];
const pathLen = (cells) => cells.reduce((t, c, i) => (i ? t + Math.hypot(c[0] - cells[i - 1][0], c[1] - cells[i - 1][1]) * world.pxM : 0), 0);

// ---- is the real harbour a through-route or a dead end? (on the real topology: raster + all real water, before any harbour carve) ----
// Route 1: the best way out to open water. Then block route 1 (beyond the basin) and its mouth, and look for a SECOND, independent
// way out at least 250 m (real) from the first mouth that is not absurdly longer. Found = a through-route; not = a dead end.
// The real-water network: every real-water cell with clearance >= 0.2 game m (about 4 m across) is passable (cheap when >= 3 game m
// = 60 m across, by narrowness otherwise); "open water" = real clearance >= 6 game m (120 m across). It ignores the game's own raster.
const realGrid = (() => {
  const n = world.nx * world.nz, sailR = new Uint8Array(n), labelR = new Int32Array(n);
  for (let k = 0; k < n; k++) { sailR[k] = clear[k] >= 3 ? 1 : 0; labelR[k] = clear[k] >= 6 ? 1 : 0; }
  return { nx: world.nx, nz: world.nz, sail: sailR, label: labelR, clear };
})();
function classify(t) {
  if (!t.anchor) return { topology: 'unknown (no water within 150 m)' };
  const A = cellOf(t.anchor.x, t.anchor.z), opt = { minClear: 0.2, maxCells: 500 };
  const r1 = HA.approachRoute(realGrid, A, 1, opt);
  if (!r1) return { topology: 'unknown (no real route to open water)' };
  const len1 = pathLen(r1.cells);
  if (len1 <= 10) return { topology: 'open coast', note: 'the quay water is on (or within 100 m of) open water: no channel' };
  const L1 = r1.cells[r1.cells.length - 1], BASIN = 12 / world.pxM, MOUTH = 14 / world.pxM;
  const sail2 = realGrid.sail.slice(), clear2 = clear.slice(), lab2 = realGrid.label.slice();
  const kill = (a, b) => { if (a >= 0 && b >= 0 && a < world.nx && b < world.nz) { const k = b * world.nx + a; sail2[k] = 0; clear2[k] = 0; lab2[k] = 0; } };
  for (const [a, b] of r1.cells) if (Math.hypot(a - A.a, b - A.b) > BASIN) for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) kill(a + di, b + dj);
  for (let dj = -Math.ceil(MOUTH); dj <= Math.ceil(MOUTH); dj++) for (let di = -Math.ceil(MOUTH); di <= Math.ceil(MOUTH); di++) if (Math.hypot(di, dj) <= MOUTH) kill(L1[0] + di, L1[1] + dj);
  const r2 = HA.approachRoute({ ...realGrid, sail: sail2, clear: clear2, label: lab2 }, A, 1, opt);
  const m1 = { lat: r5(fromGame(...centreOf(...L1))[1]), lon: r5(fromGame(...centreOf(...L1))[0]) };
  if (!r2) return { topology: 'dead end', firstMouth: { ...m1, lengthM: Math.round(len1 * REAL) } };
  const L2 = r2.cells[r2.cells.length - 1], len2 = pathLen(r2.cells), sep = Math.hypot(L2[0] - L1[0], L2[1] - L1[1]) * world.pxM;
  const [mlo, mla] = fromGame(...centreOf(...L2));
  if (sep < 25 || len2 > 4 * len1 + 40) return { topology: 'dead end', firstMouth: { ...m1, lengthM: Math.round(len1 * REAL) }, note: `a second way out exists but is a ${Math.round(len2 * REAL)} m detour (first mouth ${Math.round(len1 * REAL)} m)` };
  return { topology: 'through-route', firstMouth: { ...m1, lengthM: Math.round(len1 * REAL) }, secondMouth: { lat: r5(mla), lon: r5(mlo), lengthM: Math.round(len2 * REAL), narrowestM: Math.round(2 * Math.min(...r2.blocked.map(([a, b]) => clear[b * world.nx + a]), 9) * REAL) } };
}
for (const t of targets) t.topology = classify(t);

// ---- a through-channel: ONE pass for a harbour that is a route (both ends open to the sea) -------------------------------
// wp: [{ name, cell: { a, b }, sea? }, ...] in order along the channel; the route is chained leg by leg through the real water;
// both basins keep their real shape (a wide corridor around `basinPts`); only the narrows are widened, until the boat sails every leg
// (HA.findRouteVia, a tight margin: it must USE the channel, not sail round the island) in both directions.
const throughPasses = [];
const seaNear = (x, z, r = 30) => { // the nearest sailable cell of the main sea
  const c0 = cellOf(x, z); let best = null, bd = Infinity;
  for (let dj = -Math.ceil(r / world.pxM); dj <= Math.ceil(r / world.pxM); dj++) for (let di = -Math.ceil(r / world.pxM); di <= Math.ceil(r / world.pxM); di++) { const a = c0.a + di, b = c0.b + dj; if (a < 0 || b < 0 || a >= world.nx || b >= world.nz) continue; const k = b * world.nx + a; if (sailW[k] && labelW[k] === mainW && Math.hypot(di, dj) < bd) { bd = Math.hypot(di, dj); best = { a, b }; } }
  return best;
};
const cen0 = (w) => centreOf(w.cell.a, w.cell.b);
function carveThrough({ id, name, channel, targetsCovered, wp, basinPts, minClear = 0.2, kind = 'through-channel', quay }) {
  const route = HA.routeThrough(gridW(), wp.map((w) => w.cell), { fairway: fairway.mask, minClear });
  if (!route) { console.log(`  ${id}: no through-route`); return null; }
  if (process.env.THROUGH_DEBUG) { for (let i = 1; i < wp.length; i++) console.log(`   ${id} leg ${i} ${wp[i - 1].name} -> ${wp[i].name}: ${Math.round(pathLen(route.cells.slice(route.legs[i - 1], route.legs[i] + 1)) * REAL)} m`); }
  let pts = route.cells.map(([a, b]) => { const [x, z] = centreOf(a, b); return [x, z, clear[b * world.nx + a]]; });
  pts = pts.map(([x, z, c]) => [x, z, basinPts.some((bp) => Math.hypot(bp[0] - x, bp[1] - z) < 13) ? Math.max(c, 13) : c]); // keep the basins' real shape
  for (let pass = 0; pass < 2; pass++) pts = pts.map((p, i) => (i === 0 || i === pts.length - 1 ? p : [(pts[i - 1][0] + 2 * p[0] + pts[i + 1][0]) / 4, (pts[i - 1][1] + 2 * p[1] + pts[i + 1][1]) / 4, p[2]]));
  const S = pts[0], B = pts[pts.length - 1], L = lineLen(pts);
  const viaPts = wp.map((w) => centreOf(w.cell.a, w.cell.b));
  const legLens = []; for (let i = 1; i < wp.length; i++) legLens.push(pathLen(route.cells.slice(route.legs[i - 1], route.legs[i] + 1)));
  const base = snap();
  // Widen only the narrows: the tube (the boat's minimum width) is applied ONLY where the real channel is narrower than the boat needs
  // (real clearance under NARROW_CLR game m each side); wide stretches and both basins keep the real shape and get no tube at all.
  // One width is then tuned (3 to 8 game m each side) until the boat sails every leg in both directions. (At 2 m cells a boat with a
  // 2.5 m hull needs about 85-95 m of water, so a 15 m real channel is widened about x6 wherever it is that narrow.)
  // RESTORED 2026-11-06 to ONE uniform tube (NARROW_CLR = Infinity): per-leg widths and a narrow-only tube were both tried and both made it
  // worse or failed (see the report). The finding stands: with the circular hull probe only a ~95 m carve passes, so the limit is the collision shape.
  const NARROW_CLR = Infinity, HALF0 = 3.0, HALF_MAX = 8.0, STEP = 0.25;
  const narrow = pts.map((p) => p[2] < NARROW_CLR);
  let chosen = null;
  for (let half = HALF0; half <= HALF_MAX + 1e-9; half += STEP) {
    const halves = pts.map((p, i) => (narrow[i] ? half : 0));
    const line = pts.map((p, i) => [p[0], p[1], p[2], halves[i]]);
    const rings = HA.carveHarbourRings({ ...env }, line, { minHalf: 0, protect });
    const poly = rings.map((r) => r.map(([x, z]) => fromGame(x, z).map(r5)));
    restoreTo(base);
    applyPasses(world, [{ id: 'trial', tier: 'harbour', polygon: poly }], { ids: ['trial'], depth: false });
    const fwd = HA.findRouteVia(world, viaPts, { margin: 25, legLimits: legLens }), back = HA.findRouteVia(world, viaPts.slice().reverse(), { margin: 25, legLimits: legLens.slice().reverse() });
    if (process.env.THROUGH_DEBUG2) console.log(`  [${id} half ${half}] fwd ${fwd.ok ? 'ok' : 'leg ' + fwd.leg + ' ' + fwd.reason} back ${back.ok ? 'ok' : 'leg ' + back.leg + ' ' + back.reason}`);
    if (fwd.ok && back.ok) { chosen = { half, poly, halves }; break; }
  }
  restoreTo(base);
  if (!chosen) { console.log(`  ${id}: could not be carved navigable`); return null; }
  // the widened stretches' width, for the report: the width at the stretch where the boat needed the most
  pts = pts.map((p, i) => [p[0], p[1], p[2], chosen.halves[i]]);
  const blockedClr = route.blocked.map(([a, b]) => clear[b * world.nx + a]);
  const realWidthM = Math.round(2 * Math.min(...blockedClr, 9) * REAL);
  const ll = (x, z) => ({ lat: r5(fromGame(x, z)[1]), lon: r5(fromGame(x, z)[0]) });
  const pass = {
    id, name, tier: 'harbour', channel, through: true,
    a: ll(S[0], S[1]), b: ll(B[0], B[1]), centre: ll((S[0] + B[0]) / 2, (S[1] + B[1]) / 2),
    realWidthM, lengthM: Math.round(L * REAL), carveWidthM: Math.max(realWidthM, Math.round(chosen.half * 2 * REAL)),
    waypoints: wp.map((w, i) => ({ name: w.name, ...ll(...centreOf(w.cell.a, w.cell.b)), alongM: Math.round(lineLen(pts.slice(0, Math.max(2, Math.round((route.legs[i] / (route.cells.length - 1)) * (pts.length - 1)) + 1))) * REAL) })),
    harbour: { target: name, kind, targets: targetsCovered.map((t) => t.name), quay: quay ?? ll(targetsCovered[0].anchor.x, targetsCovered[0].anchor.z), confidence: 'quay water', via: null, marksUsed: marks.some((m) => pts.some((q) => Math.hypot(q[0] - m.x, q[1] - m.z) <= 8)), quayProtected: quayLines.length > 0 },
    line: pts.map((p) => fromGame(p[0], p[1]).map(r5)), polygon: chosen.poly, dependsOn: [],
  };
  pass.widenFactor = +(pass.carveWidthM / Math.max(10, realWidthM)).toFixed(1);
  pass.widenedSharePct = Math.round((100 * narrow.filter(Boolean).length) / narrow.length); // the share of the route (by length) where the real channel was narrower than the boat needs and got the tube
  pass.carveWidthMinM = narrow.every(Boolean) ? pass.carveWidthM : Math.round(2 * NARROW_CLR * REAL); // wide stretches keep their real width, at least this
  {
    const near = (x, z) => pts.some((p) => Math.hypot(p[0] - x, p[1] - z) <= 45);
    const cut = (line) => { const out = []; let cur = []; for (const [x, z] of line) { if (near(x, z)) cur.push(fromGame(x, z).map(r5)); else { if (cur.length > 1) out.push(cur); cur = []; } } if (cur.length > 1) out.push(cur); return out; };
    const piers = []; for (const e of marksOsm) if (e.type === 'way' && e.tags?.man_made === 'pier' && e.geometry) piers.push(e.geometry.filter(Boolean).map(toXZ));
    pass.context = { quays: quayLines.flatMap(cut), piers: piers.flatMap(cut).slice(0, 80), marks: marks.filter((m) => near(m.x, m.z)).map((m) => ({ lat: r5(fromGame(m.x, m.z)[1]), lon: r5(fromGame(m.x, m.z)[0]), side: m.side })), lines: navLines.flatMap(cut), lights: marksOsm.filter((e) => e.type === 'node' && e.tags?.['seamark:type'] === 'light_minor' && near(...world.toGame(e.lon, e.lat))).map((e) => ({ lat: r5(e.lat), lon: r5(e.lon), name: e.tags['seamark:name'] ?? '', character: e.tags['seamark:light:1:character'] ? `${e.tags['seamark:light:1:character']}(${e.tags['seamark:light:1:group'] ?? ''}) WRG ${e.tags['seamark:light:1:period'] ?? ''}s` : '' })) };
  }
  restoreTo(base); applyPasses(world, [pass], { ids: [id], depth: false });
  harbourPasses.push(pass); throughPasses.push({ pass, targets: targetsCovered });
  refresh();
  console.log(`${id.padEnd(34)} THROUGH real ${realWidthM} m x ${pass.lengthM} m -> ${pass.carveWidthM} m (x${pass.widenFactor}), ${wp.length} waypoints`);
  return pass;
}

// ---- Grundsund: two basins, each reached from its own end; the canal between them stays closed (Felix, 2026-11-06) ------------------
// On the big map Grundsund is reached from both ends: the NORTH entrance into the guest-harbour basin (already open: ~51 m from the quay
// water) and the SOUTH-WEST entrance (past Skutevik, the green mark) into the southern fishing-harbour basin (the marina). Both basins
// count as "in the harbour". The narrow canal through the village stays CLOSED at 1:10: sailing through it is a feature of the Grundsund
// close-up later (it was historically shallow until the 1914-18 canal). Reference: ref/grundsund-skippo.png.
{
  const T = (n) => targets.find((t) => t.name === n);
  const tH = T('Grundsunds hamn'), tV = T('Grundsund'), tM = T('Grundsunds Marina');
  const exitHint = world.toGame(11.4136, 58.2073); // the green mark at Skutevik, the south-west entrance
  const exitMark = marks.filter((m) => m.side === 'starboard').map((m) => ({ ...m, d: Math.hypot(m.x - exitHint[0], m.z - exitHint[1]) })).sort((p, q) => p.d - q.d)[0];
  const exitPt = exitMark && exitMark.d < 20 ? [exitMark.x, exitMark.z] : exitHint;
  const wcell = (x, z) => { const w = HA.realWaterNear(env, x, z, 15); return cellOf(w ? w.x : x, w ? w.z : z); };
  const wp = [
    { name: 'south-west entrance (open sea)', cell: seaNear(exitPt[0], exitPt[1]), sea: true },
    { name: 'the green mark by Skutevik', cell: wcell(exitPt[0], exitPt[1]) },
    { name: 'the southern basin (fishing harbour / marina)', cell: cellOf(tM.anchor.x, tM.anchor.z) },
  ];
  const p = carveThrough({ id: 'harbour-grundsunds-marina', name: 'Grundsund: the southern basin (fishing harbour)', channel: 'Grundsund, south-west entrance', kind: 'harbour-approach', targetsCovered: [tM], wp, basinPts: [cen0(wp[2])], quay: { lat: r5(fromGame(tM.anchor.x, tM.anchor.z)[1]), lon: r5(fromGame(tM.anchor.x, tM.anchor.z)[0]) } });
  if (!p) throw new Error('Grundsund: the south-west approach could not be built');
  p.through = false; p.canalLeftClosed = 'The canal through the village (the 5-15 m sound between the two basins) is NOT carved: Felix, 2026-11-06, it is a close-up feature.';
  // the village is "in harbour" through the guest-harbour basin (north entrance, open today)
  tV.viaHarbour = 'Grundsunds hamn'; tV.anchor = tH.anchor; tV.anchorOffM = tH.anchorOffM; tV.confidence = 'via the guest-harbour basin (the canal stays closed)';
}
// Other harbours: the same rule. A harbour is "reached" when its basin is; a real SECOND way out (a through-route) is reported in the audit
// (topology) but NOT carved: narrow inner channels are close-up features.
for (const t of targets) { const tp = t.topology; if (tp?.topology === 'through-route') tp.note = `a second way out exists (${tp.secondMouth.lengthM} m, narrowest ${tp.secondMouth.narrowestM} m): left to the harbour close-up, not carved`; }
for (const t of targets) {
  const row = { name: t.name, kind: t.kind, source: t.src, lat: r5(t.lat), lon: r5(t.lon), via: t.viaHarbour ?? null, confidence: t.confidence, anchorOffsetM: t.anchorOffM, reachRawM: Math.round(rawReach.get(t) * REAL), reachShipM: Math.round(shipReach.get(t) * REAL), reachAfterM: null, passes: [], topology: t.topology };
  if (t.anchor) { const [qlo, qla] = fromGame(t.anchor.x, t.anchor.z); row.quay = { lat: r5(qla), lon: r5(qlo) }; } // the real quay water the test used (a village's own quay, not its point on land)
  for (const k of ['reachRawM', 'reachShipM']) if (!Number.isFinite(row[k])) row[k] = null;
  const covered = throughPasses.find((tp) => tp.targets.includes(t));
  if (covered) { row.status = 'blocked, carved'; row.passes = [covered.pass.id]; row.reachAfterM = Math.round(reachNow(t) * REAL); row.blockedAt = { lat: covered.pass.centre.lat, lon: covered.pass.centre.lon, cells: null, lengthM: covered.pass.lengthM, narrowestM: covered.pass.realWidthM }; row.topology = t.topology; audit.push({ t, row }); continue; }
  const before = reachNow(t);
  if (!t.anchor) { row.status = 'no real water within 150 m'; audit.push({ t, row }); continue; }
  if (before <= HA.HARBOUR_REACH_M) { row.status = t.viaHarbour && t.kind === 'village' ? `open (via ${t.viaHarbour})` : row.reachRawM !== null && row.reachRawM <= HA.HARBOUR_REACH_M * REAL ? 'open' : 'open (after the ship batch)'; row.reachAfterM = Math.round(before * REAL); audit.push({ t, row }); continue; }
  // ---- blocked: route from the quay water out to the sea, preferring the marked fairway ----
  const A = t.anchor, startCell = cellOf(A.x, A.z);
  const route = HA.approachRoute(gridW(), startCell, mainW, { fairway: fairway.mask });
  if (!route) { row.status = 'blocked, no real water route to the sea'; audit.push({ t, row }); continue; }
  // the line from the sea INTO the harbour, stopping BERTH_BACK short of the quay water
  let pts = route.cells.slice().reverse().map(([a, b]) => { const [x, z] = centreOf(a, b); return [x, z, clear[b * world.nx + a]]; });
  pts = pts.filter((p, i) => i < pts.length - 1 ? Math.hypot(p[0] - A.x, p[1] - A.z) >= HA.BERTH_BACK_M : true);
  if (Math.hypot(pts[pts.length - 1][0] - A.x, pts[pts.length - 1][1] - A.z) < HA.BERTH_BACK_M && pts.length > 2) pts.pop();
  { // end the line at a berth about 4 game m from the quay water (interpolated, so the step size of the route does not matter)
    const last = pts[pts.length - 1], dl = Math.hypot(last[0] - A.x, last[1] - A.z);
    if (dl > 4.6) { const f = 1 - 4.0 / dl; pts.push([last[0] + (A.x - last[0]) * f, last[1] + (A.z - last[1]) * f, Math.max(0, last[2] * 0.6)]); }
  }
  if (pts.length < 2) pts = [pts[0], [A.x, A.z, 0]];
  for (let pass = 0; pass < 2; pass++) pts = pts.map((p, i) => (i === 0 || i === pts.length - 1 ? p : [(pts[i - 1][0] + 2 * p[0] + pts[i + 1][0]) / 4, (pts[i - 1][1] + 2 * p[1] + pts[i + 1][1]) / 4, p[2]]));
  const S = pts[0], B = pts[pts.length - 1], L = lineLen(pts);
  const blockedClr = route.blocked.map(([a, b]) => clear[b * world.nx + a]);
  const realWidthM = Math.round(2 * Math.min(...blockedClr, 9) * REAL);
  const base = snap();
  let chosen = null;
  for (let half = 3.0; half <= 7.0 + 1e-9; half += 0.25) {
    const rings = HA.carveHarbourRings({ ...env }, pts, { minHalf: half, protect });
    const poly = rings.map((r) => r.map(([x, z]) => fromGame(x, z).map(r5)));
    restoreTo(base);
    applyPasses(world, [{ id: 'trial', tier: 'harbour', polygon: poly }], { ids: ['trial'], depth: false });
    const rt = findRoute(world, S, B, { margin: 40 + L });
    if (process.env.DEBUG_HARBOUR === t.name) console.log(`  [${t.name} half ${half}] route ok ${rt.ok} ${rt.reason ?? ''} len ${rt.length?.toFixed?.(1)} vs L ${L.toFixed(1)}, B-A ${Math.hypot(B[0] - A.x, B[1] - A.z).toFixed(1)} gm, S blocked-before ${isBlocked(world.heightAt, S[0], S[1])}, B blocked ${isBlocked(world.heightAt, B[0], B[1])}, pts ${pts.length}, rings ${rings.length}`);
    if (rt.ok && rt.length <= 1.35 * L + 25 && Math.hypot(B[0] - A.x, B[1] - A.z) <= HA.HARBOUR_REACH_M) { chosen = { half, poly, rings, rt }; break; }
  }
  restoreTo(base);
  if (!chosen) { row.status = 'blocked, could not be carved navigable'; audit.push({ t, row }); continue; }
  let id = `harbour-${slug(t.name.replace(/ \(Felix\)/, ''))}`; // unique: two unnamed "Småbåtshamn" exist (applyPasses remembers ids)
  for (let n = 2; harbourPasses.some((q) => q.id === id) || passFile.passes.some((q) => q.id === id && q.tier !== 'harbour'); n++) id = `harbour-${slug(t.name.replace(/ \(Felix\)/, ''))}-${n}`;
  const pass = {
    id, name: t.name, tier: 'harbour', channel: null,
    a: { lat: r5(fromGame(S[0], S[1])[1]), lon: r5(fromGame(S[0], S[1])[0]) }, b: { lat: r5(fromGame(B[0], B[1])[1]), lon: r5(fromGame(B[0], B[1])[0]) },
    centre: { lat: r5(fromGame((S[0] + B[0]) / 2, (S[1] + B[1]) / 2)[1]), lon: r5(fromGame((S[0] + B[0]) / 2, (S[1] + B[1]) / 2)[0]) },
    realWidthM, lengthM: Math.round(L * REAL), carveWidthM: Math.max(realWidthM, Math.round(chosen.half * 2 * REAL)),
    harbour: { target: t.name, kind: t.kind, quay: { lat: r5(fromGame(A.x, A.z)[1]), lon: r5(fromGame(A.x, A.z)[0]) }, confidence: t.confidence, via: t.viaHarbour ?? null, marksUsed: fairway.gates.some(([gx, gz]) => pts.some((q) => Math.hypot(q[0] - gx, q[1] - gz) <= 8)), quayProtected: quayLines.length > 0 },
    line: pts.map((p) => fromGame(p[0], p[1]).map(r5)), polygon: chosen.poly,
  };
  pass.widenFactor = +(pass.carveWidthM / Math.max(10, realWidthM)).toFixed(1);
  // what it costs: land turned to water
  restoreTo(base); applyPasses(world, [pass], { ids: [id], depth: false });
  let landToWater = 0; for (let k = 0; k < H0.length; k++) if (H0[k] > 0 && world.H[k] < -0.5) landToWater++;
  pass.landRemovedM2 = Math.round(landToWater * (world.pxM * REAL) ** 2); // (cumulative with earlier carves is avoided by diffing below)
  restoreTo(base); applyPasses(world, [pass], { ids: [id], depth: false });
  // does it work on its own (just the ship batch + this pass)? If not, it continues an earlier harbour pass: name it
  {
    const works = (extra) => { restoreTo(shipState); applyPasses(world, [...extra, pass], { ids: [...extra.map((q) => q.id), id], depth: false }); const r = findRoute(world, S, B, { margin: 40 + L }); return r.ok && r.length <= 1.35 * L + 25; };
    let deps = [];
    if (!works([])) {
      const near = harbourPasses.map((q) => ({ q, d: Math.min(...q.line.map(([lo, la]) => { const [x, z] = world.toGame(lo, la); return Math.hypot(x - S[0], z - S[1]); })) })).sort((p1, p2) => p1.d - p2.d);
      for (const { q } of near) { deps.push(q); if (works(deps)) break; }
      if (!works(deps)) deps = harbourPasses.slice();
    }
    pass.dependsOn = deps.map((q) => q.id);
  }
  // the surroundings for the check page (the browser has no OSM): quay / breakwater / pier lines and marks near the pass
  {
    const near = (x, z) => pts.some((p) => Math.hypot(p[0] - x, p[1] - z) <= 45);
    const cut = (line) => { const out = []; let cur = []; for (const [x, z] of line) { if (near(x, z)) cur.push(fromGame(x, z).map(r5)); else { if (cur.length > 1) out.push(cur); cur = []; } } if (cur.length > 1) out.push(cur); return out; };
    const piers = []; for (const e of marksOsm) if (e.type === 'way' && e.tags?.man_made === 'pier' && e.geometry) piers.push(e.geometry.filter(Boolean).map(toXZ));
    pass.context = {
      quays: quayLines.flatMap(cut), piers: piers.flatMap(cut).slice(0, 40),
      marks: marks.filter((m) => near(m.x, m.z)).map((m) => ({ lat: r5(fromGame(m.x, m.z)[1]), lon: r5(fromGame(m.x, m.z)[0]), side: m.side })),
      lines: navLines.flatMap(cut),
    };
  }
  harbourPasses.push(pass);
  restoreTo(base); applyPasses(world, [pass], { ids: [id], depth: false });
  refresh();
  row.reachAfterM = Math.round(reachNow(t) * REAL);
  row.status = 'blocked, carved'; row.passes = [id];
  row.blockedAt = route.blocked.length ? (() => { const m = route.blocked[route.blocked.length >> 1]; const [x, z] = centreOf(...m); const [lo, la] = fromGame(x, z); return { lat: r5(la), lon: r5(lo), cells: route.blocked.length, lengthM: Math.round(route.blocked.length * world.pxM * REAL), narrowestM: realWidthM }; })() : null;
  audit.push({ t, row });
  console.log(`${id.padEnd(34)} real ${realWidthM} m x ${pass.lengthM} m -> ${pass.carveWidthM} m (x${pass.widenFactor}) reach ${row.reachShipM ?? '-'} -> ${row.reachAfterM} m`);
}
// land removed per pass must not include earlier passes' carves: recompute each against the ship state in isolation
{
  restoreTo({ H: H0, CL: CL0, done: new Set() }); applyPasses(world, passFile.passes, { tiers: ['ship'], depth: false });
  const shipState = snap();
  for (const p of harbourPasses) { restoreTo(shipState); applyPasses(world, [p], { ids: [p.id], depth: false }); let n = 0; for (let k = 0; k < H0.length; k++) if (shipState.H[k] > 0 && world.H[k] < -0.5) n++; p.landRemovedM2 = Math.round(n * (world.pxM * REAL) ** 2); }
}
// the final check, the way the game will run it: raw world + (ship + harbour) via applyPasses
restoreTo({ H: H0, CL: CL0, done: new Set() });
const all = { passes: [...basePasses, ...harbourPasses] };
applyPasses(world, all, { tiers: ['ship', 'harbour'], depth: false }); refresh();
for (const { t, row } of audit) { if (t.anchor) { row.reachAfterM = Math.round(reachNow(t) * REAL); row.finalOpen = row.reachAfterM <= HA.HARBOUR_REACH_M * REAL; } else row.finalOpen = false; }
const stillBlocked = audit.filter(({ row }) => !row.finalOpen);
console.log('after ship + harbour: open', audit.length - stillBlocked.length, 'of', audit.length, '| still blocked:', stillBlocked.map(({ row }) => `${row.name} (${row.status})`).join('; ') || 'none');

// ---- write passes.json (harbour tier replaced) and the audit ----
const order = { ship: 0, harbour: 1, later: 2, eye: 3 };
const merged = [...basePasses, ...harbourPasses].sort((p, q) => order[p.tier] - order[q.tier]);
const counts = { total: merged.length }; for (const tier of ['ship', 'harbour', 'later', 'eye']) counts[tier] = merged.filter((p) => p.tier === tier).length;
passFile.counts = counts; passFile.passes = merged;
passFile.note = passFile.note.replace(/ harbour = .*$/, '') + ' harbour = a harbour approach (tier added 2026-11-06): carved WITH the ship tier (applyPasses tiers [ship, harbour]), may be widened more than x1.7 but keeps the real shape and the quay (OSM quay / breakwater lines stay land); see harbour-audit.json.';
writeFileSync(dir + 'passes.json', JSON.stringify(passFile, null, 1) + '\n');
const head = { generated: new Date().toISOString().slice(0, 10), source: 'OpenStreetMap contributors, ODbL 1.0; the places the arrival uses (src/names.js), Felix\'s pins; tools/build-harbours.mjs', credit: '© OpenStreetMap contributors', licence: 'ODbL 1.0', licenceUrl: 'https://www.openstreetmap.org/copyright', region: REGION };
const auditRows = audit.map(({ row }) => row);
writeFileSync(dir + 'harbour-audit.json', JSON.stringify({
  ...head,
  note: `reach = how close (m real) the boat's centre can get to the quay water from the open sea with the hull rule (shore.js isBlocked). "In the harbour" = within ${HA.HARBOUR_REACH_M * REAL} m. reachRawM = the raster as it is today; reachShipM = with the ship tier carved; reachAfterM = with ship + harbour. confidence: quay water = the target sits on real water (within ${HA.ANCHOR_TRUST_M * REAL} m); point on land = an islet centre or village origin, so the quay is approximate.`,
  counts: { targets: auditRows.length, openRaw: auditRows.filter((r) => r.reachRawM !== null && r.reachRawM <= HA.HARBOUR_REACH_M * REAL).length, openAfter: auditRows.filter((r) => r.finalOpen).length, harbourPasses: harbourPasses.length },
  harbours: auditRows,
}, null, 1) + '\n');
console.log('harbour passes', harbourPasses.length, '| targets', auditRows.length);
