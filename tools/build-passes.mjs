// Builds games/windward/assets/coast/passes.json and pass-candidates.json: the real sounds and natural harbours the
// 1:10 raster closes (Felix's option B), each with a carve polygon from OSM's coastline, widened just enough for the boat.
//
// Usage: node tools/build-passes.mjs [--cache DIR] [--offline]
//   needs network the first time (Overpass natural=coastline, natural=strait, harbours; retries, a mirror, generic
//   User-Agent). Responses are cached in --cache (default: the OS temp dir) so a re-run is offline and deterministic.
//   Never commits the cache: the OSM coastline is large and only the derived polygons ship.
// Data: (c) OpenStreetMap contributors, ODbL 1.0 (the polygons derive from the coastline).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCoast } from '../games/windward/src/coast-data.js';
import { buildCoastWorld, COAST_TILES } from '../games/windward/src/coast-world.js';
import { isBlocked, HULL_RADIUS_M } from '../games/windward/src/shore.js';
import * as D from '../games/windward/src/pass-derive.js';
import { applyPasses, resetPasses, findRoute, passCellBox } from '../games/windward/src/passes.js';

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
  for (let round = 0; round < 4; round++) {
    for (const url of ENDPOINTS) {
      try {
        const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'windward-passes-fetch/1.0' }, body: 'data=' + encodeURIComponent(query), signal: AbortSignal.timeout(200000) });
        if (r.ok) { const j = await r.json(); writeFileSync(file, JSON.stringify(j)); return j; }
        last = `${url} -> HTTP ${r.status}`;
      } catch (e) { last = `${url} -> ${e.message}`; }
      console.error('overpass busy:', last, '(retrying)');
      await new Promise((res) => setTimeout(res, 15000 * (round + 1)));
    }
  }
  throw new Error('Overpass unavailable after retries: ' + last);
}

// ---- inputs ----
const coastOsm = await overpass('coastline', `[out:json][timeout:180];\nway["natural"="coastline"](58.055,11.20,58.33,11.55);\nout geom(58.055,11.20,58.33,11.55);`);
const straitsOsm = await overpass('straits', `[out:json][timeout:120];\nnwr["natural"="strait"]["name"]${BB};\nout geom tags;`);
const harboursOsm = await overpass('harbours', `[out:json][timeout:120];\n(nwr["seamark:type"="harbour"]${BB}; nwr["leisure"="marina"]["name"]${BB};);\nout center tags;`);

const io = { json: async (u) => JSON.parse(readFileSync(u, 'utf8')), bytes: async (u) => new Uint8Array(readFileSync(u)) };
const coast = await loadCoast(dir, io, COAST_TILES);
const world = buildCoastWorld(coast, { skerries: JSON.parse(readFileSync(dir + 'skerries.json', 'utf8')).skerries });
const mpp = coast.meta.metersPerPixelReal, PJ = coast.meta.projection, REAL = 10; // 1 game m = 10 real m
const fromGame = (x, z) => [coast.meta.bbox.w + ((x / world.pxM) * mpp) / PJ.metersPerDegLon, coast.meta.bbox.n - ((z / world.pxM) * mpp) / PJ.metersPerDegLat];
const cellOfLL = (lon, lat) => { const [x, z] = world.toGame(lon, lat); return { a: Math.floor((x - world.x0) / world.pxM), b: Math.floor((z - world.z0) / world.pxM) }; };
const centreOf = (a, b) => [world.x0 + (a + 0.5) * world.pxM, world.z0 + (b + 0.5) * world.pxM];
const r5 = (v) => Math.round(v * 1e5) / 1e5;

// ---- real water, real clearance, what the game allows today ----
const ratio = 4, cellF = world.pxM / ratio, wF = world.nx * ratio, hF = world.nz * ratio;
const segs = D.segmentsFromWays(coastOsm.elements, world.toGame);
const water = D.rasterWater(segs, { x0: world.x0, z0: world.z0, w: wF, h: hF, cell: cellF });
const clear = D.cellClearance(D.distanceToLand(water, wF, hF), wF, ratio, world.nx, world.nz, cellF);
const sail = D.sailableMask(world, isBlocked);
const { label, sizes } = D.components(sail, world.nx, world.nz);
const main = sizes.indexOf(Math.max(...sizes));
const grid = { nx: world.nx, nz: world.nz, sail, clear, label };

// ---- places the trip test connects: harbours, named harbours, villages, Felix's pins ----
const places = [];
const add = (id, lon, lat, extra = {}) => { const c = cellOfLL(lon, lat); if (c.a >= 0 && c.b >= 0 && c.a < world.nx && c.b < world.nz) places.push({ id, name: id, ...c, lon, lat, ...extra }); };
for (const e of harboursOsm.elements) { const c = e.center ?? e; const nm = e.tags?.name ?? e.tags?.['seamark:name']; if (nm && c.lat >= REGION.s && c.lat <= REGION.n && c.lon >= REGION.w && c.lon <= REGION.e && !places.some((p) => p.id === nm)) add(nm, c.lon, c.lat, { kind: 'harbour' }); }
const names = JSON.parse(readFileSync(dir + 'names.json', 'utf8'));
for (const h of names.harbours) if (!places.some((p) => p.id === h.name)) add(h.name, h.lon, h.lat, { kind: 'harbour' });
for (const p of JSON.parse(readFileSync(dir + 'places.json', 'utf8')).places) if (p.inside && (p.kind === 'village' || p.kind === 'island') && !places.some((q) => q.id === p.name)) add(p.name, p.lon, p.lat, { kind: p.kind });
// Felix's own pins (GAME-DESIGN.md "Felix's favourite places"): Vrakevik and Kråksundsgap
add('Vrakevik (Felix)', 11.385059, 58.238711, { kind: 'favourite' });
add('Kråksundsgap (Felix)', 11.439134, 58.104431, { kind: 'favourite' });
console.log('places', places.length, '| components', sizes.length, '| main sea', sizes[main], 'cells');

// ---- 1. the closed stretches that matter for a trip ----
const stretches = D.tripShortcuts(grid, places);
console.log('closed stretches found:', stretches.length);

// ---- OSM straits (name + geometry) for naming and the candidates table ----
const mD = 111195, mL = mD * Math.cos((58.19 * Math.PI) / 180);
const straits = straitsOsm.elements.map((e) => {
  const pts = (e.geometry ?? (e.members ?? []).flatMap((m) => m.geometry ?? [])).filter(Boolean).map((g) => [g.lon, g.lat]);
  const c = e.center ?? (e.type === 'node' ? e : null) ?? (pts.length ? { lon: pts.reduce((s, p) => s + p[0], 0) / pts.length, lat: pts.reduce((s, p) => s + p[1], 0) / pts.length } : null);
  return { name: e.tags.name, id: `${e.type}/${e.id}`, pts, c };
}).filter((s) => s.c);
const distTo = (s, lon, lat) => (s.pts.length ? Math.min(...s.pts.map(([x, y]) => Math.hypot((y - lat) * mD, (x - lon) * mL))) : Math.hypot((s.c.lat - lat) * mD, (s.c.lon - lon) * mL));
const lineLenM = (pts) => pts.reduce((s, p, i) => (i ? s + Math.hypot((p[1] - pts[i - 1][1]) * mD, (p[0] - pts[i - 1][0]) * mL) : 0), 0);
const slug = (s) => s.toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---- 2. a carve shape for each, widened until the boat really sails through it ----
const H0 = world.H.slice(), CL0 = world.CL.slice();
const restore = () => { world.H.set(H0); world.CL.set(CL0); resetPasses(world); };
const passes = [];
for (const s of stretches) {
  const cells = [s.before, ...s.cells, s.after].filter(Boolean);
  let pts = cells.map(([a, b]) => { const [x, z] = centreOf(a, b); return [x, z, clear[b * world.nx + a]]; });
  for (let pass = 0; pass < 2; pass++) pts = pts.map((p, i) => (i === 0 || i === pts.length - 1 ? p : [(pts[i - 1][0] + 2 * p[0] + pts[i + 1][0]) / 4, (pts[i - 1][1] + 2 * p[1] + pts[i + 1][1]) / 4, p[2]]));
  const blockedClr = s.cells.map(([a, b]) => clear[b * world.nx + a]);
  const realWidthM = Math.round(2 * Math.min(...blockedClr) * REAL);
  const lengthM = Math.round(pts.reduce((t, p, i) => (i ? t + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0) * REAL);
  const A = pts[0], B = pts[pts.length - 1];
  const lenGame = pts.reduce((t, p, i) => (i ? t + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0); // the channel's own length, game m
  const mid = pts[pts.length >> 1], [mlon, mlat] = fromGame(mid[0], mid[1]);
  // name: the nearest OSM strait within 350 m, else "near <nearest within 900 m>"
  const near = straits.map((st) => ({ st, d: distTo(st, mlon, mlat) })).sort((p, q) => p.d - q.d)[0];
  const isl = names.islands.map((i) => ({ n: i.name, d: Math.hypot((i.lat - mlat) * mD, (i.lon - mlon) * mL) })).sort((p, q) => p.d - q.d)[0];
  const name = near && near.d <= 350 ? near.st.name : near && near.d <= 900 ? `near ${near.st.name}` : isl && isl.d <= 700 ? `by ${isl.n}` : 'unnamed';
  const best = s.trips.sort((p, q) => (q[2] ?? 0) - (p[2] ?? 0))[0];
  // widen until the game's own collision lets the boat through, start at the boat's 50 m real gap + a margin
  let chosen = null, lastRoute = null;
  for (let half = 3.0; half <= 6.0 + 1e-9; half += 0.25) {
    const rings = D.carveRings({ water, wF, hF, cellF, x0: world.x0, z0: world.z0 }, pts, { minHalf: half });
    const poly = rings.map((r) => r.map(([x, z]) => fromGame(x, z).map(r5)));
    restore();
    applyPasses(world, [{ id: 'trial', tier: 'ship', polygon: poly }], { depth: false });
    const route = findRoute(world, A, B, { margin: 40 + lenGame });
    lastRoute = route;
    if (process.env.DEBUG_PASSES && !route.ok) {
      const inPoly = (x, z) => { let n = 0; for (const r of rings) { let ins = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, zi] = r[i], [xj, zj] = r[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins; } if (ins) n++; } return n & 1; };
      const out = pts.filter((p) => !inPoly(p[0], p[1])).length;
      if (half >= 5.99) { const bad = pts.map((q, i) => [i, q, world.heightAt(q[0], q[1]), isBlocked(world.heightAt, q[0], q[1])]).filter((t) => t[3]); console.log(`  [blocked after carve ${name}]`, bad.map((t) => `#${t[0]} h=${t[2].toFixed(2)}`).join(' ') || 'none on centreline', '| A blocked', isBlocked(world.heightAt, A[0], A[1]), 'B blocked', isBlocked(world.heightAt, B[0], B[1])); }
      console.log(`  [debug ${name} half ${half}] rings ${rings.length} (${rings.map((r) => r.length).join(',')}), centreline points outside polygon: ${out}/${pts.length}, reason ${route.reason}`);
    }
    if (route.ok && route.length <= 1.35 * lenGame + 25) { chosen = { half, poly, rings, route }; break; }
  }
  restore();
  const rec = {
    id: '', name, channel: near && near.d <= 900 ? near.st.name : null,
    a: { lat: r5(fromGame(A[0], A[1])[1]), lon: r5(fromGame(A[0], A[1])[0]) }, b: { lat: r5(fromGame(B[0], B[1])[1]), lon: r5(fromGame(B[0], B[1])[0]) },
    centre: { lat: r5(mlat), lon: r5(mlon) },
    realWidthM, lengthM, savedKm: +((s.savedCells * world.pxM * REAL) / 1000).toFixed(1), unlockTrips: s.unlockTrips, finiteTrips: s.finiteTrips,
    example: best ? `${best[0]} <-> ${best[1]}` : null,
    line: pts.map((p) => fromGame(p[0], p[1]).map(r5)),
  };
  if (!chosen) { rec.tier = 'heavy'; rec.carveWidthM = null; rec.polygon = []; rec.unnavigable = true; rec.why = lastRoute ? (lastRoute.ok ? `route ${Math.round(lastRoute.length)} gm vs channel ${Math.round(lenGame)} gm` : lastRoute.reason) : 'no trial'; passes.push(rec); continue; }
  // what the carve costs: land turned to water, and how much wider than reality
  restore();
  applyPasses(world, [{ id: 'trial', tier: 'ship', polygon: chosen.poly }], { depth: false });
  let landToWater = 0;
  for (let k = 0; k < H0.length; k++) if (H0[k] > 0 && world.H[k] < -0.5) landToWater++;
  restore();
  rec.carveWidthM = Math.max(realWidthM, Math.round(chosen.half * 2 * REAL)); // the real shape is kept where it is already wide enough
  rec.widenFactor = +(rec.carveWidthM / Math.max(10, realWidthM)).toFixed(1);
  rec.landRemovedM2 = Math.round(landToWater * (world.pxM * REAL) ** 2);
  rec.polygon = chosen.poly;
  passes.push(rec);
}

// ---- 3. tiers + ids ----
// score: what a pass is worth to a sailor (trips it helps, a real name, Felix's pins) over what it costs (the widening).
// ship = the best 8 that are cheap (at most 2x the real width, short, a real channel); later = worth doing; heavy = a tiny
// real channel (under 20 m) or a long one that needs a wide cut, or one that could not be made navigable.
const PINS = [[58.238711, 11.385059, 'Vrakevik'], [58.104431, 11.439134, 'Kråksundsgap']];
for (const p of passes) {
  const pin = PINS.map(([la, lo, n]) => ({ n, d: Math.hypot((la - p.centre.lat) * mD, (lo - p.centre.lon) * mL) })).sort((x, y) => x.d - y.d)[0];
  p.nearFelixPin = pin.d <= 400 ? pin.n : null;
  p.score = +(((p.finiteTrips + p.unlockTrips / 10 + (p.name.startsWith('by ') || p.name === 'unnamed' ? 0 : 3) + (p.nearFelixPin ? 5 : 0)) / (1 + 0.4 * Math.max(0, (p.widenFactor ?? 6) - 1)))).toFixed(1);
  // anything widened more than 2x (or under 20 m real, or unnavigable) is NOT shipped: it goes on the "needs Felix's eye" list
  p.eyeReason = p.unnavigable ? 'could not be made navigable' : p.realWidthM < 20 ? `real channel only ${p.realWidthM} m wide (widened x${p.widenFactor})` : p.widenFactor > 2.0 ? `widened x${p.widenFactor}` : null;
}
const eligible = passes.filter((p) => !p.eyeReason && p.widenFactor <= 2.0 && p.lengthM <= 300);
// ids first (the greedy search below names passes by id)
{ const used0 = new Map(); for (const p of passes) { const base = slug(p.name.replace(/^(near|by) /, '') || 'pass'); const n = (used0.get(base) ?? 0) + 1; used0.set(base, n); p.id = n === 1 ? base : `${base}-${n}`; } }
// How much does a set of passes improve sailing between all the places? Carve the set, re-read the sailable mask where it
// changed, and sum the shortest sailing distances between every pair of places (a pair the game cannot join costs CAP).
const CAP = 1500 * D.TRIP_UNIT, sail0 = sail.slice();
const sailW = sail.slice(), enterW = new Int16Array(world.nx * world.nz);
const placeCells = places.map((p) => p);
function totalSailing(ids) {
  restore();
  const chosen = passes.filter((p) => ids.includes(p.id));
  applyPasses(world, chosen, { ids, depth: false });
  sailW.set(sail0);
  for (const p of chosen) { const bx = passCellBox(world, p); for (let b = bx.b0; b <= bx.b1; b++) for (let a = bx.a0; a <= bx.a1; a++) { const [x, z] = centreOf(a, b); sailW[b * world.nx + a] = isBlocked(world.heightAt, x, z) ? 0 : 1; } }
  for (let k = 0; k < sailW.length; k++) enterW[k] = sailW[k] ? D.TRIP_UNIT : 0;
  const cells = placeCells.map((pl) => { let best = -1, bd = Infinity; for (let dj = -14; dj <= 14; dj++) for (let di = -14; di <= 14; di++) { const a = pl.a + di, b = pl.b + dj; if (a < 0 || b < 0 || a >= world.nx || b >= world.nz) continue; const k = b * world.nx + a; const d = Math.hypot(di, dj); if (sailW[k] && d < bd) { bd = d; best = k; } } return best; });
  let total = 0;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] < 0) { total += CAP * (cells.length - i - 1); continue; }
    const f = D.bucketField(world.nx, world.nz, [cells[i]], enterW, CAP);
    for (let j = i + 1; j < cells.length; j++) total += cells[j] < 0 || f.dist[cells[j]] < 0 ? CAP : Math.min(CAP, f.dist[cells[j]]);
  }
  restore();
  return total;
}
const base = totalSailing([]);
const gainOf = (ids) => (base - totalSailing(ids)) / D.TRIP_UNIT * world.pxM * REAL / 1000; // km of sailing saved, summed over all place pairs
const alone = new Map(passes.map((p) => [p.id, Math.max(0, +gainOf([p.id]).toFixed(1))])); // a negative figure is a snapping artefact (a place re-snaps to a worse cell): no measurable gain
for (const p of passes) p.aloneKm = alone.get(p.id);
const chosenIds = []; let chosenGain = 0;
while (chosenIds.length < 8) {
  let best = null;
  for (const p of eligible) {
    if (chosenIds.includes(p.id)) continue;
    const g = gainOf([...chosenIds, p.id]) - chosenGain, perCost = g / (0.5 + p.landRemovedM2 / 20000 + Math.max(0, p.widenFactor - 1) * 0.3);
    if (g > 0.5 && (!best || perCost > best.perCost)) best = { p, g, perCost };
  }
  if (!best) break;
  chosenIds.push(best.p.id); chosenGain += best.g; best.p.marginalKm = +best.g.toFixed(1); best.p.rank = chosenIds.length;
  console.log(`  greedy ${chosenIds.length}: ${best.p.id} +${best.g.toFixed(0)} km`);
}
// ship = the greedy picks that clearly pay off (the first few save hundreds of km, the tail only tens): lighter first batch
const SHIP_MIN_KM = 50;
const shipIds = new Set(passes.filter((p) => chosenIds.includes(p.id) && p.marginalKm >= SHIP_MIN_KM));
for (const p of passes) p.tier = p.eyeReason ? 'eye' : shipIds.has(p) ? 'ship' : 'later';
passes.sort((p, q) => ({ ship: 0, later: 1, eye: 2 }[p.tier] - { ship: 0, later: 1, eye: 2 }[q.tier]) || (p.rank ?? 99) - (q.rank ?? 99) || q.aloneKm - p.aloneKm);

// ---- 4. the candidates table: every named sound, harbour and favourite, open or closed today ----
const gridMain = (a, b) => (a >= 0 && b >= 0 && a < world.nx && b < world.nz ? sail[b * world.nx + a] : 0);
const sailNear = (a, b, r = 1) => { for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (gridMain(a + di, b + dj)) return true; return false; };
const clrNear = (a, b, r = 3) => { let m = 0; for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const aa = a + di, bb = b + dj; if (aa >= 0 && bb >= 0 && aa < world.nx && bb < world.nz) m = Math.max(m, clear[bb * world.nx + aa]); } return m; };
const passNear = (lon, lat, within = 350) => passes.filter((p) => Math.hypot((p.centre.lat - lat) * mD, (p.centre.lon - lon) * mL) <= within).map((p) => p.id);
const resample = (pts, stepM) => { const out = []; for (let i = 0; i + 1 < pts.length; i++) { const L = Math.hypot((pts[i + 1][1] - pts[i][1]) * mD, (pts[i + 1][0] - pts[i][0]) * mL); const n = Math.max(1, Math.round(L / stepM)); for (let k = 0; k < n; k++) out.push([pts[i][0] + ((pts[i + 1][0] - pts[i][0]) * k) / n, pts[i][1] + ((pts[i + 1][1] - pts[i][1]) * k) / n]); } out.push(pts[pts.length - 1]); return out; };
const candidates = [];
for (const st of straits) {
  const samples = st.pts.length > 1 ? resample(st.pts, 60) : [[st.c.lon, st.c.lat]];
  const cs = samples.map(([lon, lat]) => cellOfLL(lon, lat)).filter((c) => c.a >= 0 && c.b >= 0 && c.a < world.nx && c.b < world.nz);
  if (!cs.length) continue;
  const openN = cs.filter((c) => sailNear(c.a, c.b)).length;
  const widths = cs.map((c) => 2 * clrNear(c.a, c.b) * REAL);
  const ids = [...new Set(samples.flatMap(([lon, lat]) => passNear(lon, lat)))];
  candidates.push({
    name: st.name, kind: 'sound', osm: st.id, lat: r5(st.c.lat), lon: r5(st.c.lon),
    realWidthM: Math.round(Math.min(...widths)), lengthM: st.pts.length > 1 ? Math.round(lineLenM(st.pts)) : null,
    today: ids.length ? 'closed' : openN === cs.length ? 'open' : openN ? 'partly open' : 'closed (dead end, on no trip)',
    passes: ids,
  });
}
const FAVOURITES = new Set(['Vrakevik (Felix)', 'Kråksundsgap (Felix)', 'Skarvesäter', 'Vasholmarna', 'Grundsunds hamn', 'Grundsunds Marina', 'Gullholmens gästhamn', 'Käringön fiskehamn', 'Käringöns gästhamn', 'Grundsund', 'Käringön', 'Gullholmen', 'Fiskebäckskil', 'Lysekil']);
for (const pl of places) {
  const r = D.routeToBody(grid, { a: pl.a, b: pl.b }, main);
  candidates.push({
    name: pl.name, kind: pl.kind === 'harbour' ? 'harbour' : pl.kind === 'favourite' ? 'favourite' : 'place', favourite: FAVOURITES.has(pl.id) || undefined, lat: r5(pl.lat), lon: r5(pl.lon),
    today: r === null ? 'closed (no real water route)' : r.open ? 'open' : 'closed', approachM: r && !r.open ? Math.round(r.blocked.length * world.pxM * REAL) : 0,
    realWidthM: r && !r.open && r.blocked.length ? Math.round(2 * Math.min(...r.blocked.map(([a, b]) => clear[b * world.nx + a])) * REAL) : null,
    passes: passNear(pl.lon, pl.lat, 500),
  });
}
candidates.sort((p, q) => (p.kind > q.kind ? 1 : -1) || p.name.localeCompare(q.name, 'sv'));
writeFileSync(dir + 'pass-candidates.json', JSON.stringify({
  ...{ generated: new Date().toISOString().slice(0, 10), source: 'OpenStreetMap contributors, ODbL 1.0; Felix\'s favourites from GAME-DESIGN.md', credit: '© OpenStreetMap contributors', licence: 'ODbL 1.0', licenceUrl: 'https://www.openstreetmap.org/copyright', region: REGION },
  note: 'today = what the game raster allows now with the boat\'s hull (src/shore.js): open, or closed. For a sound, realWidthM is the narrowest real water along it; lengthM the OSM strait line where it has one. passes = the carve passes (passes.json) within 350 m (500 m for places).',
  counts: { total: candidates.length, open: candidates.filter((c) => c.today === 'open').length, closed: candidates.filter((c) => c.today.startsWith('closed')).length },
  candidates,
}, null, 1) + '\n');

const head = {
  generated: new Date().toISOString().slice(0, 10),
  source: 'OpenStreetMap contributors, ODbL 1.0 (natural=coastline, natural=strait via Overpass), tools/build-passes.mjs',
  credit: '© OpenStreetMap contributors', licence: 'ODbL 1.0', licenceUrl: 'https://www.openstreetmap.org/copyright',
  region: REGION, hullRadiusGameM: HULL_RADIUS_M, scale: '1:10 (1 game m = 10 real m)',
};
writeFileSync(dir + 'passes.json', JSON.stringify({
  ...head,
  note: 'Each pass is a carve polygon (lon/lat rings, even-odd) = the real water of the channel from OSM plus a tube at the boat\'s minimum width, tuned so the game\'s collision (shore.js isBlocked, hull 2.5 game m) lets a boat through end to end. Apply with src/passes.js applyPasses(world, passes). tier: ship = the recommended first batch (light carves, at most 2x the real width); later = light carves worth doing after; eye = widened more than 2x, or a real channel under 20 m, or not navigable: NOT shipped, needs Felix\'s eye (see eyeReason).',
  counts: { total: passes.length, ship: passes.filter((p) => p.tier === 'ship').length, later: passes.filter((p) => p.tier === 'later').length, eye: passes.filter((p) => p.tier === 'eye').length },
  passes,
}, null, 1) + '\n');
console.log('passes', passes.length, passes.map((p) => p.tier[0]).join(''), '| candidates', candidates.length, candidates.filter((c) => c.today === 'open').length, 'open');
for (const p of passes) console.log(p.tier.padEnd(6), String(p.score).padStart(5), p.id.padEnd(28), `real ${p.realWidthM} m x ${p.lengthM} m -> ${p.carveWidthM} m (x${p.widenFactor})`, `trips ${p.finiteTrips}/${p.unlockTrips}`, p.unnavigable ? `UNNAVIGABLE (${p.why})` : `land ${p.landRemovedM2} m2`);
export { places, straits, distTo, lineLenM, cellOfLL, fromGame, clear, sail, label, main, world, passes, head };
