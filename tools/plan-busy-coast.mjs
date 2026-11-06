// node tools/plan-busy-coast.mjs  ->  games/windward/data/busy-world.json
// Plans the busy coast's GEOMETRY offline (era-neutral: which boats, how many and when come from data/busy-eras.json), on the real coast built exactly as the game builds its collision (tools/lib/game-world.mjs):
//   - the Vasttrafik 847 ferry route (Lysekil Sodra hamnen - Ostersidan - Fiskebackskil brygga, stops from OpenStreetMap, tools/data/ferry-847-osm.json),
//   - a handful of sailing / motorboat routes between real harbours (shore-shy: open water when there is any),
//   - berths for moored boats in the guest harbours (alongside the shore and on buoys, never across the way in).
// Coordinates are stored as lon/lat so the game converts them with its own toGame(); the test re-checks every point against the real collision.
import { readFileSync, writeFileSync } from 'node:fs';
import { loadGameWorld, WINDWARD } from './lib/game-world.mjs';
import { makeGrid, nearestFree, planSmoothRoute, planBerths, pathLength, hashN } from './lib/busy-planner.mjs';

const gw = await loadGameWorld();
const { world } = gw;
const grid = makeGrid(world, gw.blocked);
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const ll = (p) => { const [lo, la] = gw.fromGame(p[0], p[1]); return [r6(lo), r6(la)]; };
const harbourNode = (name) => { const h = gw.seamarks.harbours.find((x) => x.name === name); if (!h) throw new Error(`no harbour ${name}`); return h; };
const quayOf = (name) => { const h = harbourNode(name); const p = nearestFree(grid, ...gw.toGame(h.lon, h.lat), { maxR: 70 }); if (!p) throw new Error(`no free water near ${name}`); return p; };
const report = [];

// ---- the ferry ---------------------------------------------------------------------------------------------------------
const osm = JSON.parse(readFileSync(new URL('./data/ferry-847-osm.json', import.meta.url), 'utf8'));
const byId = Object.fromEntries(osm.stops.map((s) => [s.id, s]));
const stops = osm.relation.stopOrder.map((id) => byId[id]);
const docks = stops.map((s) => { const p = nearestFree(grid, ...gw.toGame(s.lon, s.lat), { maxR: 60 }); if (!p) throw new Error(`no free water by ${s.name}`); return p; });
const ferryLegs = [];
for (let i = 0; i < docks.length - 1; i++) {
  const leg = planSmoothRoute(grid, docks[i], docks[i + 1], { want: 30, minClear: 6, need: 6, endRelax: 40, relaxNear: [{ p: docks[i], r: 45 }, { p: docks[i + 1], r: 45 }] });
  if (!leg.ok) throw new Error(`ferry leg ${i}: ${leg.reason}`);
  ferryLegs.push(leg);
}
const ferryPts = [...ferryLegs[0].points, ...ferryLegs[1].points.slice(1)];
const stopAt = []; // cumulative metres of each stop along the polyline
{ let s = 0; stopAt.push(0); for (let l = 0; l < ferryLegs.length; l++) { s += ferryLegs[l].length; stopAt.push(Math.round(s * 10) / 10); } }
report.push(`ferry: ${ferryPts.length} points, ${Math.round(pathLength(ferryPts))} m; legs ${ferryLegs.map((l) => `${Math.round(l.length)} m (min clearance ${l.minClear.toFixed(1)} m)`).join(', ')}`);

// ---- traffic -----------------------------------------------------------------------------------------------------------
const TRAFFIC = [ // class: sail | motor. Which boat, how fast and how long it waits is the era profile's job (data/busy-eras.json).
  { id: 'lysekil-grundsund', from: 'Norra Hamnens gästhamn', to: 'Grundsunds hamn', class: 'sail' },
  { id: 'grundsund-gullholmen', from: 'Grundsunds hamn', to: 'Gullholmens gästhamn', class: 'motor' },
  { id: 'lysekil-gullholmen', from: 'Fiskhamnens gästhamn', to: 'Gullholmens gästhamn', class: 'motor' },
  { id: 'grundsund-karingon', from: 'Grundsunds Marina', to: 'Käringöns gästhamn', class: 'sail' },
  { id: 'fiskebackskil-lysekil', from: 'Fiskebäckskils småbåtshamn', to: 'Havsbadets gästhamn', class: 'sail' },
  { id: 'grundsund-fiskebackskil', from: 'Grundsunds hamn', to: 'Gullmarsstrands småbåtshamn', class: 'sail' },
  { id: 'gullholmen-karingon', from: 'Gullholmens gästhamn', to: 'Käringön fiskehamn', class: 'motor' },
  { id: 'karingon-hallevik', from: 'Käringöns gästhamn', to: 'Hälleviksstrands Hamn', class: 'motor' },
];
const traffic = [];
for (const [i, t] of TRAFFIC.entries()) {
  const a = quayOf(t.from), b = quayOf(t.to);
  const r = planSmoothRoute(grid, a, b, { want: 24, need: 4 });
  if (!r.ok) { report.push(`traffic ${t.id}: NO ROUTE (${r.reason}) - dropped`); continue; }
  traffic.push({ id: t.id, from: t.from, to: t.to, class: t.class, seed: Math.round(hashN(i + 101) * 1e6) / 1e6, lengthM: Math.round(r.length * 10) / 10, route: r.points.map(ll) });
  report.push(`traffic ${t.id}: ${r.points.length} points, ${Math.round(r.length)} m, min clearance ${r.minClear.toFixed(1)} m`);
}

// ---- berths ------------------------------------------------------------------------------------------------------------
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
const throughRoutes = traffic.map((t) => trim(t.route.map((p) => gw.toGame(p[0], p[1])), 25)).filter((p) => p.length >= 2);
const moorings = [];
for (const [i, s] of SITES.entries()) {
  const quay = quayOf(s.harbour);
  // the way in: from the quay out to water with 25 m of clearance (the first such cell within 220 m)
  const open = nearestFree(grid, quay[0], quay[1], { maxR: 220, minClear: 25 }) || quay;
  const way = planSmoothRoute(grid, quay, open, { want: 24, need: 3 });
  const corridor = way.ok ? way.points : [quay, open];
  const berths = planBerths(grid, quay, corridor, { seed: i + 1, maxAlong: s.maxAlong, maxBuoy: s.maxBuoy, avoid: [{ pts: ferryPts, keep: 15 }, ...throughRoutes.map((pts) => ({ pts, keep: 8 }))] });
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
  moorings.push({ id: s.id, harbour: s.harbour, village: s.village, quay: ll(quay), berths: stored });
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
    stops: stops.map((s, i) => ({ name: s.name, osm: s.id, lon: s.lon, lat: s.lat, dock: ll(docks[i]), atM: stopAt[i] })),
    route: ferryPts.map(ll), lengthM: Math.round(pathLength(ferryPts) * 10) / 10,
  },
  traffic,
  moorings,
};
writeFileSync(WINDWARD + 'data/busy-world.json', JSON.stringify(out) + '\n');
const totalBoats = moorings.reduce((n, m) => n + m.berths.length, 0);
console.log(report.join('\n'));
console.log(`\nwrote data/busy-world.json: ferry + ${traffic.length} traffic routes + ${moorings.length} harbours with ${totalBoats} berths (${Math.round(JSON.stringify(out).length / 1024)} KB)`);
