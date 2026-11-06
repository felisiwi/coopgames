// node tools/plan-busy-coast.mjs  ->  games/windward/data/busy-world.json
// Plans the busy coast's GEOMETRY offline (era-neutral: which boats, how many and when come from data/busy-eras.json), on the real coast built exactly as the game builds its collision (tools/lib/game-world.mjs):
//   - the Vasttrafik 847 ferry route (Lysekil Sodra hamnen - Ostersidan - Fiskebackskil brygga, stops from OpenStreetMap, tools/data/ferry-847-osm.json),
//   - a handful of sailing / motorboat routes between real harbours (shore-shy: open water when there is any),
//   - berths for moored boats in the guest harbours (alongside the shore and on buoys, never across the way in).
// Coordinates are stored as lon/lat so the game converts them with its own toGame(); the test re-checks every point against the real collision.
import { readFileSync, writeFileSync } from 'node:fs';
import { loadGameWorld, WINDWARD } from './lib/game-world.mjs';
import { makeGrid, nearestFree, planSmoothRoute, planBerths, planLoop, openWaterSpots, pullDock, simplify, smoothValid, pathLength, hashN } from './lib/busy-planner.mjs';

const gw = await loadGameWorld();
const { world } = gw;
const grid = makeGrid(world, gw.blocked);
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const ll = (p) => { const [lo, la] = gw.fromGame(p[0], p[1]); return [r6(lo), r6(la)]; };
const harbourNode = (name) => { const h = gw.seamarks.harbours.find((x) => x.name === name); if (!h) throw new Error(`no harbour ${name}`); return h; };
const quayOf = (name) => { const h = harbourNode(name); const p = nearestFree(grid, ...gw.toGame(h.lon, h.lat), { maxR: 70 }); if (!p) throw new Error(`no free water near ${name}`); return p; };
const report = [];

// ---- harbour entrance lanes ----------------------------------------------------------------------------------------------------
// Planned first, because nothing (a ferry at its quay, a moored boat) may sit across the way into a harbour. SITES lists every harbour that gets
// moored boats; its `wayIn` runs from the quay out to open water. The story harbour's gate also has a lane (from the gate straight out to sea).
const SITES = [
  { id: 'fiskebackskil-smabatshamn', harbour: 'Fiskebäckskils småbåtshamn', village: 'Fiskebäckskil', maxAlong: 5, maxBuoy: 4 },
  { id: 'fiskebackskil-gullmarsstrand', harbour: 'Gullmarsstrands småbåtshamn', village: 'Fiskebäckskil', maxAlong: 5, maxBuoy: 3 },
  { id: 'grundsund-hamn', harbour: 'Grundsunds hamn', village: 'Grundsund', maxAlong: 5, maxBuoy: 5 },
  { id: 'grundsund-marina', harbour: 'Grundsunds Marina', village: 'Grundsund', maxAlong: 4, maxBuoy: 4 },
  { id: 'karingon-gasthamn', harbour: 'Käringöns gästhamn', village: 'Käringön', maxAlong: 5, maxBuoy: 5 },
  { id: 'gullholmen-gasthamn', harbour: 'Gullholmens gästhamn', village: 'Gullholmen', maxAlong: 5, maxBuoy: 5 },
  { id: 'lysekil-norra-hamnen', harbour: 'Norra Hamnens gästhamn', village: 'Lysekil', maxAlong: 5, maxBuoy: 5 },
  { id: 'lysekil-fiskhamnen', harbour: 'Fiskhamnens gästhamn', village: 'Lysekil', maxAlong: 5, maxBuoy: 4 },
  { id: 'lysekil-havsbadet', harbour: 'Havsbadets gästhamn', village: 'Lysekil', maxAlong: 4, maxBuoy: 4 },
];
// the ferry's quays (its first and last OSM stop): a marina whose quay is within 20 m of one SHARES it. The ferry owns the quay then, and the marina
// keeps its berths (kept clear of the docked hull) but has no way-in of its own across the ferry's berth.
const ferryStops0 = (() => { const o = JSON.parse(readFileSync(new URL('./data/ferry-847-osm.json', import.meta.url), 'utf8')); return [o.stops.find((x) => x.id === o.relation.stopOrder[0]), o.stops.find((x) => x.id === o.relation.stopOrder.at(-1))]; })();
const ferryQuays0 = ferryStops0.map((st) => nearestFree(grid, ...gw.toGame(st.lon, st.lat), { maxR: 60 }));
for (const site of SITES) {
  site.quay = quayOf(site.harbour);
  site.sharesFerryQuay = ferryQuays0.some((q) => Math.hypot(q[0] - site.quay[0], q[1] - site.quay[1]) < 20);
  const open = nearestFree(grid, site.quay[0], site.quay[1], { maxR: 220, minClear: 25 }) || site.quay; // the first water within 220 m with 25 m of clearance
  const way = planSmoothRoute(grid, site.quay, open, { want: 24, need: 3 });
  site.corridor = site.sharesFerryQuay ? [] : way.ok ? way.points : [site.quay, open];
}
const gates = gw.seamarks.harbours.filter((h) => h.inventedGate?.mouth).map((h) => {
  const p = gw.toGame(h.inventedGate.mouth.lon, h.inventedGate.mouth.lat), b = (h.inventedGate.enteringBearingDeg * Math.PI) / 180, e = [Math.sin(b), -Math.cos(b)]; // entering direction (harbour-water.js)
  return { name: h.name, p, lane: [[p[0] + e[0] * 12, p[1] + e[1] * 12], [p[0] - e[0] * 45, p[1] - e[1] * 45]] };
});
// a corridor without its first `m` metres: the quay end of a harbour's way in is where its own boats tie up
const trimStart = (pts, m) => { let acc = 0; const out = []; for (let i = 0; i < pts.length; i++) { if (i) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (acc >= m) out.push(pts[i]); } return out; };

// ---- the ferry ---------------------------------------------------------------------------------------------------------
// Docked "slightly off the quay in clear water": for each terminal the planner tries 18 approach directions from open water, slides the dock point
// back along each approach until the WHOLE hull (design length, beam, plus a gap ahead of the bow) is in free water, and takes the shortest pull that
// also keeps the hull axis off every harbour's way in and off the story harbour's gate lane. The ferry backs out along the lane it came in on.
// Play scale: the biggest ferry the docks are planned for is 2 x the player's 8 m boat (Svalan); the era profile picks its actual length (<= this).
const FERRY = { maxLengthM: 16, beamM: 4.5, bowGapM: 3, laneKeepM: 6, marinaLaneKeepM: 1 };
const osm = JSON.parse(readFileSync(new URL('./data/ferry-847-osm.json', import.meta.url), 'utf8'));
const byId = Object.fromEntries(osm.stops.map((s) => [s.id, s]));
const allStops = osm.relation.stopOrder.map((id) => byId[id]);
// The real line also calls at Östersidan, but at 1:10 that quay is ~10 game m from the story harbour's gate with no water for a hull beside the way in,
// and only 28 m from the brygga. The game's ferry therefore runs Lysekil Södra hamnen <-> Fiskebäckskil brygga (the first and last stop).
const SKIPPED = allStops.slice(1, -1);
const stops = [allStops[0], allStops.at(-1)];
const quays = stops.map((s) => { const p = nearestFree(grid, ...gw.toGame(s.lon, s.lat), { maxR: 60 }); if (!p) throw new Error(`no free water by ${s.name}`); return p; });
// the story harbour's gate lane is strict; another marina's way in keeps the hull off its line (a marina that shares the ferry's quay has no way in of its own)
const keepLines = [...gates.map((g) => ({ pts: g.lane, r: FERRY.laneKeepM + FERRY.beamM / 2 })), ...SITES.filter((st) => !st.sharesFerryQuay).map((st) => ({ pts: trimStart(st.corridor, 10), r: FERRY.marinaLaneKeepM + FERRY.beamM / 2 })).filter((k) => k.pts.length >= 2)];
const dockOpts = { free: (x, z) => !gw.dockBlocked(x, z), halfLen: FERRY.maxLengthM / 2, halfBeam: FERRY.beamM / 2, bowGap: FERRY.bowGapM, keepAway: gates.map((g) => ({ p: g.p, r: FERRY.maxLengthM / 2 + 8 })), keepLines };
const approachOf = (quay) => { // the best way into a quay: { open (where the approach starts), dock, dir, points (open -> dock) }
  let best = null;
  for (let a = 0; a < 360; a += 20) {
    const rad = (a * Math.PI) / 180, open = nearestFree(grid, quay[0] + Math.sin(rad) * 50, quay[1] + Math.cos(rad) * 50, { maxR: 25, minClear: 14 });
    if (!open) continue;
    const r = planSmoothRoute(grid, open, quay, { want: 30, need: 4, endRelax: 30, relaxNear: [{ p: quay, r: 55 }] });
    if (!r.ok) continue;
    const d = pullDock(grid, r.points, 'end', dockOpts);
    if (!d.ok) continue;
    const score = d.pulled + 0.05 * pathLength(r.points);
    if (!best || score < best.score) best = { score, open, dock: d.dock, dir: d.dir, points: d.points, pulled: d.pulled };
  }
  if (!best) throw new Error(`no ferry dock found by the quay at ${quay.map(Math.round)}`);
  return best;
};
const apps = quays.map(approachOf);
const plan = (a, b) => { const r = planSmoothRoute(grid, a, b, { want: 30, minClear: FERRY.maxLengthM / 2 - 1, need: 6, endRelax: 25, relaxNear: [{ p: a, r: 30 }, { p: b, r: 30 }] }); if (!r.ok) throw new Error(`ferry leg: ${r.reason}`); return r; };
const rev = (pts) => [...pts].reverse();
const legAB = plan(apps[0].open, apps[1].open);
// A (leave the quay: the approach reversed) -> open A -> open B -> B
const toA = rev(apps[0].points), inB = apps[1].points;
// the approaches are straight and the crossing leaves them at an angle: corner-cut the whole route (still in clear water, the two dock ends untouched)
// The last HOLD m of each approach stay exactly as planned (the straight lane the dock was checked on); only the middle is simplified and smoothed.
const HOLD = 24;
const slicePolyline = (pts, a, b) => { // the part of a polyline between arc lengths a and b
  const out = []; let acc = 0;
  const lerp2 = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  for (let i = 0; i < pts.length - 1; i++) {
    const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]), lo = Math.max(a, acc), hi = Math.min(b, acc + L);
    if (hi > lo) { if (!out.length) out.push(lerp2(pts[i], pts[i + 1], (lo - acc) / L)); out.push(lerp2(pts[i], pts[i + 1], (hi - acc) / L)); }
    acc += L;
  }
  return out;
};
const rawFerry = [...toA, ...legAB.points.slice(1), ...inB.slice(1)], rawLen = pathLength(rawFerry);
const midFerry = smoothValid(grid, simplify(grid, slicePolyline(rawFerry, HOLD, rawLen - HOLD), { floor: 4 }), 6, { endRelax: 0 });
const ferryPts = [...slicePolyline(rawFerry, 0, HOLD), ...midFerry.slice(1), ...slicePolyline(rawFerry, rawLen - HOLD, rawLen).slice(1)];
const stopAt = [0, Math.round(pathLength(ferryPts) * 10) / 10];
const docks = apps.map((a) => ({ dock: a.dock, dir: a.dir, pulled: a.pulled }));
const stopG = stops.map((st) => gw.toGame(st.lon, st.lat));
report.push(`ferry: ${ferryPts.length} points, ${Math.round(pathLength(ferryPts))} m; docks pulled back ${docks.map((d) => d.pulled.toFixed(1)).join(' / ')} m; dock to the OSM stop ${docks.map((d, i) => Math.round(Math.hypot(d.dock[0] - stopG[i][0], d.dock[1] - stopG[i][1]))).join(' / ')} m`);
for (const g of gates) { const dd = Math.min(...docks.map((d) => Math.hypot(d.dock[0] - g.p[0], d.dock[1] - g.p[1]))); if (dd < 45) report.push(`  harbour gate ${g.name}: nearest ferry dock ${dd.toFixed(1)} m`); }
// the water a docked ferry occupies (centre to bow tip + the gap): berths keep away from it
const dockBows = docks.map((d) => [d.dock, [d.dock[0] + d.dir[0] * (FERRY.maxLengthM / 2 + FERRY.bowGapM), d.dock[1] + d.dir[1] * (FERRY.maxLengthM / 2 + FERRY.bowGapM)]]);

// ---- traffic -----------------------------------------------------------------------------------------------------------
// class: sail | motor | fish. Which boat, how fast and how long it waits is the era profile's job (data/busy-eras.json).
const TRAFFIC = [ // harbour to harbour: kind 'harbour', shape 'line'
  { id: 'lysekil-grundsund', from: 'Norra Hamnens gästhamn', to: 'Grundsunds hamn', class: 'sail' },
  { id: 'grundsund-gullholmen', from: 'Grundsunds hamn', to: 'Gullholmens gästhamn', class: 'motor' },
  { id: 'lysekil-gullholmen', from: 'Fiskhamnens gästhamn', to: 'Gullholmens gästhamn', class: 'motor' },
  { id: 'grundsund-karingon', from: 'Grundsunds Marina', to: 'Käringöns gästhamn', class: 'sail' },
  { id: 'fiskebackskil-lysekil', from: 'Fiskebäckskils småbåtshamn', to: 'Havsbadets gästhamn', class: 'sail' },
  { id: 'grundsund-fiskebackskil', from: 'Grundsunds hamn', to: 'Gullmarsstrands småbåtshamn', class: 'sail' },
  { id: 'gullholmen-karingon', from: 'Gullholmens gästhamn', to: 'Käringön fiskehamn', class: 'motor' },
  { id: 'karingon-hallevik', from: 'Käringöns gästhamn', to: 'Hälleviksstrands Hamn', class: 'motor' },
];
// offshore cruising loops round named islands (kind 'cruise', shape 'loop'): a ring of anchors round the feature, planned through open water
const CRUISE = [
  { id: 'cruise-gaven', name: 'Gäven', R: 110, class: 'sail' }, { id: 'cruise-stangholmen', name: 'Stångholmen', R: 90, class: 'motor' },
  { id: 'cruise-bonden', name: 'Bonden', nth: 1, R: 120, class: 'sail' }, { id: 'cruise-vallero', name: 'Vallerö', R: 110, class: 'sail' },
  { id: 'cruise-hattan', name: 'Hättan', R: 110, class: 'sail' }, { id: 'cruise-karingon', name: 'Käringön', R: 130, class: 'motor' },
  { id: 'cruise-maseskar', name: 'Måseskär', R: 120, class: 'sail' }, { id: 'cruise-danholmen', name: 'Danholmen', R: 100, class: 'sail' },
];
const traffic = [];
const addTraffic = (e, points, loop) => {
  traffic.push({ ...e, shape: loop ? 'loop' : 'line', seed: Math.round(hashN(traffic.length + 101) * 1e6) / 1e6, lengthM: Math.round(pathLength(points) * 10) / 10, route: points.map(ll) });
};
for (const t of TRAFFIC) {
  const r = planSmoothRoute(grid, quayOf(t.from), quayOf(t.to), { want: 24, need: 4 });
  if (!r.ok) { report.push(`traffic ${t.id}: NO ROUTE (${r.reason}) - dropped`); continue; }
  addTraffic({ id: t.id, kind: 'harbour', class: t.class, from: t.from, to: t.to }, r.points, false);
  report.push(`traffic ${t.id}: ${r.points.length} points, ${Math.round(r.length)} m, min clearance ${r.minClear.toFixed(1)} m`);
}
for (const c of CRUISE) {
  const f = gw.names.islands.filter((i) => i.name === c.name)[c.nth ?? 0];
  if (!f) { report.push(`cruise ${c.id}: no feature "${c.name}" - dropped`); continue; }
  const [cx, cz] = gw.toGame(f.lon, f.lat), anchors = [];
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.4; const p = nearestFree(grid, cx + Math.sin(a) * c.R, cz + Math.cos(a) * c.R, { maxR: 60, minClear: 22 }); if (p && !anchors.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 40)) anchors.push(p); }
  const loop = anchors.length >= 3 ? planLoop(grid, anchors, { want: 40, need: 6 }) : { ok: false, reason: 'fewer than 3 anchors' };
  if (!loop.ok) { report.push(`cruise ${c.id}: ${loop.reason} - dropped`); continue; }
  addTraffic({ id: c.id, kind: 'cruise', class: c.class, area: c.name }, loop.points, true);
  report.push(`cruise ${c.id}: ${loop.points.length} points, ${Math.round(loop.length)} m round ${c.name}`);
}
// fishing grounds: slow circles in the most open water, one per band of the coast, away from every harbour
const harbourPts = [...quays, ...gw.seamarks.harbours.map((h) => gw.toGame(h.lon, h.lat))];
const spots = openWaterSpots(grid, { minClear: 32, spacing: 330, near: { points: harbourPts, min: 160, max: 520 } });
for (const [i, c] of spots.slice(0, 4).entries()) {
  const anchors = []; for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; anchors.push([c[0] + Math.sin(a) * 26, c[1] + Math.cos(a) * 26]); }
  const loop = planLoop(grid, anchors, { want: 30, need: 6 });
  if (!loop.ok) { report.push(`fish-${i + 1}: ${loop.reason} - dropped`); continue; }
  addTraffic({ id: `fish-${i + 1}`, kind: 'fish', class: 'fish', area: `open water ${i + 1}` }, loop.points, true);
  report.push(`fish-${i + 1}: ${loop.points.length} points, ${Math.round(loop.length)} m, circle at ${c.map(Math.round)}`);
}

// ---- berths ------------------------------------------------------------------------------------------------------------
// a polyline without its first and last `m` metres (the harbour end of a route, where its boat is meant to be near the berths)
const trim = (pts, m) => {
  const total = pathLength(pts), out = [];
  const lerpPt = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  let s0 = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]), a = s0, b = s0 + L;
    const lo = Math.max(a, m), hi = Math.min(b, total - m); // the part of this segment inside [m, total - m]
    if (hi > lo) { if (!out.length) out.push(lerpPt(pts[i], pts[i + 1], (lo - a) / L)); out.push(lerpPt(pts[i], pts[i + 1], (hi - a) / L)); }
    s0 = b;
  }
  return out;
};
const throughRoutes = traffic.map((t) => (t.shape === 'loop' ? t.route.map((p) => gw.toGame(p[0], p[1])) : trim(t.route.map((p) => gw.toGame(p[0], p[1])), 25))).filter((p) => p.length >= 2);
const moorings = [];
for (const [i, s] of SITES.entries()) {
  const { quay } = s;
  const corridor = s.corridor.length >= 2 ? s.corridor : [quay, quay]; // a shared quay: the ferry's berth is kept clear by the dock-bow avoid below
  const berths = planBerths(grid, quay, corridor, { seed: i + 1, maxAlong: s.maxAlong, maxBuoy: s.maxBuoy, avoid: [{ pts: ferryPts, keep: 11 }, ...dockBows.map((pts) => ({ pts, keep: 9 })), ...throughRoutes.map((pts) => ({ pts, keep: 8 }))] });
  // validate each berth AS STORED (lon/lat rounded to 6 decimals, ~0.1 game m): a cell-centre berth can sit right on the edge of the blocked zone
  const stored = [];
  let dropped = 0;
  for (const b of berths) {
    const [lon, lat] = ll([b.x, b.z]);
    const [px, pz] = gw.toGame(lon, lat);
    const fx = Math.sin(b.heading) * b.L / 2, fz = Math.cos(b.heading) * b.L / 2;
    const ok = !gw.blocked(px, pz) && (b.how !== 'alongside' || (!gw.blocked(px + fx, pz + fz) && !gw.blocked(px - fx, pz - fz)));
    if (!ok) { dropped++; continue; }
    stored.push({ lon, lat, heading: Math.round(b.heading * 1000) / 1000, class: b.kind, how: b.how, fitL: b.L, seed: Math.round(b.seed * 1e6) / 1e6 });
  }
  moorings.push({ id: s.id, harbour: s.harbour, village: s.village, quay: ll(quay), wayIn: corridor.map(ll), berths: stored });
  if (dropped) report.push(`  (${s.id}: dropped ${dropped} berth(s) that fell on the blocked edge after rounding)`);
  report.push(`berths ${s.id}: ${stored.filter((b) => b.how === 'alongside').length} alongside + ${stored.filter((b) => b.how === 'buoy').length} on buoys; way in ${Math.round(pathLength(corridor))} m`);
}

const out = {
  about: 'The busy coast\'s geometry: the ferry crossing, harbour-to-harbour routes and berths for moored boats, planned offline on the real coast by tools/plan-busy-coast.mjs. Era-neutral: no vessel types, counts or speeds here (those are data/busy-eras.json). Do not edit by hand: re-run the tool. Points are [lon, lat]; the game converts them with its own toGame(). src/busy-today.test.js re-checks every route point and berth against the real collision (shore.js isBlocked) and the real clearance.',
  generated: '2026-11-06',
  credit: '© OpenStreetMap contributors (ODbL 1.0): the ferry stops, harbour positions and the coast they were planned on',
  ferry: {
    line: '847', operator: 'Västtrafik', name: osm.relation.name, osmRelation: osm.relation.id,
    note: 'Stops, their order and the shape of the crossing are from OpenStreetMap (today\'s line 847). Which vessel sails it, how fast and the timetable are era data (data/busy-eras.json). TODO(felix): did a Lysekil-Fiskebäckskil ferry run in 1950, and over which route?',
    skippedStops: SKIPPED.map((s) => ({ name: s.name, osm: s.id, why: 'about 10 game m from the story harbour gate and 28 m from the brygga at 1:10: no room for a hull that leaves the way in clear' })),
    stops: stops.map((s, i) => ({ name: s.name, osm: s.id, lon: s.lon, lat: s.lat, dock: ll(docks[i].dock), atM: stopAt[i] })),
    route: ferryPts.map(ll), lengthM: Math.round(pathLength(ferryPts) * 10) / 10,
    maxLengthM: FERRY.maxLengthM, beamM: FERRY.beamM, bowGapM: FERRY.bowGapM, // the docks are planned for ferries up to this size (hull + a gap ahead of the bow in clear water)
  },
  traffic,
  moorings,
};
writeFileSync(WINDWARD + 'data/busy-world.json', JSON.stringify(out) + '\n');
const totalBoats = moorings.reduce((n, m) => n + m.berths.length, 0);
console.log(report.join('\n'));
console.log(`\nwrote data/busy-world.json: ferry + ${traffic.length} traffic routes + ${moorings.length} harbours with ${totalBoats} berths (${Math.round(JSON.stringify(out).length / 1024)} KB)`);
