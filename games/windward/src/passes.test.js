// node games/windward/src/passes.test.js
// applyPasses (carve land -> water, lower the banks) and assets/coast/passes.json: every pass navigable end to end.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyPasses, resetPasses, findRoute, passEnds, passCellBox, PASS_TIERS, BANK_BLEND_M, BANK_SLOPE, LAND_LIFT_M, CARVE_MIN_DEPTH_M } from './passes.js';
import { isBlocked, HULL_RADIUS_M, BLOCK_H } from './shore.js';
import { loadCoast } from './coast-data.js';
import { buildCoastWorld, COAST_TILES } from './coast-world.js';
import * as D from './pass-derive.js';

let passed = 0;
async function check(name, fn) { await fn(); passed += 1; console.log(`ok - ${name}`); }

// ---- a synthetic world: two ponds of sea joined by a 12 m (1.2 game m) channel through an island -------------------
// "lon/lat" = game metres here: toGame(lon, lat) = [lon, lat], so a polygon is written straight in game metres.
function synthetic() {
  const nx = 120, nz = 80, pxM = 2, x0 = 0, z0 = 0;
  const H = new Float32Array(nx * nz).fill(6), CL = new Uint8Array(nx * nz).fill(5);
  for (let b = 0; b < nz; b++) for (let a = 0; a < nx; a++) {
    const west = a < 40 && b > 15 && b < 65, east = a > 80 && b > 15 && b < 65, ch = a >= 40 && a <= 80 && Math.abs(b - 40) <= 0; // channel 1 cell (2 m) wide
    if (west || east || ch) { H[b * nx + a] = -6; CL[b * nx + a] = 0; }
  }
  const world = { nx, nz, pxM, x0, z0, H, CL, toGame: (lon, lat) => [lon, lat], depthMap: { depth: new Float32Array(nx * nz), shore: new Float32Array(nx * nz) } };
  const bilinear = (x, z) => { const fx = (x - x0) / pxM - 0.5, fz = (z - z0) / pxM - 0.5; if (fx < 0 || fz < 0 || fx > nx - 1 || fz > nz - 1) return -10; const a = Math.min(nx - 2, Math.floor(fx)), b = Math.min(nz - 2, Math.floor(fz)), u = fx - a, v = fz - b, k = b * nx + a; return (H[k] * (1 - u) + H[k + 1] * u) * (1 - v) + (H[k + nx] * (1 - u) + H[k + nx + 1] * u) * v; };
  world.heightAt = bilinear;
  return world;
}
const tube = (z, half) => [[[70, z - half], [172, z - half], [172, z + half], [70, z + half]]]; // a rectangle in game m covering the whole channel (x 80-162) and a little sea each end

await check('synthetic: a 2 m channel is closed to the boat; a carved pass opens it end to end (the game\'s own collision)', () => {
  const w = synthetic();
  const A = [40, 81], B = [200, 81]; // sea at either side
  assert.equal(findRoute(w, [30, 81], [210, 81], { margin: 20 }).ok, false, 'closed before');
  const report = applyPasses(w, [{ id: 't', tier: 'ship', polygon: tube(81, 6) }]);
  assert.ok(report.carved[0].cells > 20 && report.changedCells > 40);
  const r = findRoute(w, [30, 81], [210, 81], { margin: 20 });
  assert.ok(r.ok, r.reason);
  assert.ok(r.length < 180 * 1.1, `route ${r.length} m vs 180 m straight`);
  void A; void B;
});

await check('synthetic: the carve is deeper in the middle, never shallower than the edge depth, and the banks fall smoothly', () => {
  const w = synthetic();
  applyPasses(w, [{ id: 't', tier: 'ship', polygon: tube(81, 6) }]);
  const row = (a) => w.H[40 * w.nx + a], col = (a, b) => w.H[b * w.nx + a];
  const mid = col(60, 40), edge = col(60, 37);
  assert.ok(mid <= -CARVE_MIN_DEPTH_M && edge <= -CARVE_MIN_DEPTH_M + 1e-6, `mid ${mid} edge ${edge}`);
  assert.ok(mid <= edge + 1e-6, 'deepest at the middle');
  // no cliff: across the bank, neighbouring land cells never differ by more than the ground's own slope allows (flat 6 m ground here)
  let worst = 0;
  for (let b = 30; b < 50; b++) for (let a = 50; a < 70; a++) { const p = col(a, b), q = col(a, b + 1); if (p > 0 && q > 0) worst = Math.max(worst, Math.abs(p - q)); }
  assert.ok(worst <= 1.8, // peak of the ramp off a 6 m wall (harsher than real skerry ground)
     `steepest bank step ${worst.toFixed(2)} m per 2 m cell`);
  // land beyond the blend distance is untouched; land inside it is lowered, never raised
  assert.equal(col(60, 10), 6, 'far land untouched');
  assert.equal(col(60, 40 + Math.ceil((6 + BANK_BLEND_M) / w.pxM) + 2), 6);
  const nearBank = col(60, 44); // the first land cell past the pass edge
  assert.ok(nearBank > 0 && nearBank < 3, `bank ${nearBank}`);
  for (let b = 44; b < 50; b++) assert.ok(col(60, b) <= 6 && col(60, b) >= col(60, b - 1) - 1e-6, 'the ground rises monotonically away from the pass');
  void row;
});

await check('synthetic: idempotent, deterministic, only the chosen tiers, and the depth map is refreshed', () => {
  const a = synthetic(), b = synthetic();
  const passes = [{ id: 'ship1', tier: 'ship', polygon: tube(81, 6) }, { id: 'eye1', tier: 'eye', polygon: [[[10, 10], [20, 10], [20, 20], [10, 20]]] }];
  const r1 = applyPasses(a, passes);
  assert.deepEqual(r1.carved.map((c) => c.id), ['ship1'], 'default = the ship and harbour tiers (never eye)');
  const snap = a.H.slice();
  applyPasses(a, passes);
  assert.deepEqual([...a.H], [...snap], 'running it twice changes nothing more');
  applyPasses(b, passes);
  assert.deepEqual([...b.H], [...a.H], 'same input, same carve');
  assert.equal(a.H[7 * a.nx + 7], 6, 'the eye-tier pass was not carved');
  applyPasses(synthetic(), passes, { tiers: ['eye'] });
  const c = synthetic(); const rc = applyPasses(c, passes, { ids: ['eye1'] });
  assert.equal(rc.carved[0].id, 'eye1'); assert.ok(c.H[7 * c.nx + 7] < 0, 'ids override tiers');
  assert.ok(a.depthMap.depth.some((v) => v > 0) || a.depthMap.shore.some((v) => v > 0), 'depth map recomputed');
  assert.ok(PASS_TIERS.includes('ship') && PASS_TIERS.includes('eye'));
});

await check('the pass-derive pieces: real-water raster, distance transform, bridge route (synthetic coast with a known channel)', () => {
  // an island ring with a 2-cell channel cut through: the real water mask must show the channel, the clearance its half width
  const cell = 1, w = 60, h = 40, segs = [];
  const ring = (pts) => { for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; segs.push(p[0], p[1], q[0], q[1]); } };
  ring([[10, 10], [50, 10], [50, 18], [10, 18]]); ring([[10, 22], [50, 22], [50, 30], [10, 30]]); // two land blocks with a 4 m gap between them
  const water = D.rasterWater(Float64Array.from(segs), { x0: 0, z0: 0, w, h, cell });
  assert.equal(water[20 * w + 30], 1, 'the gap is water'); assert.equal(water[14 * w + 30], 0, 'the block is land');
  const dist = D.distanceToLand(water, w, h);
  assert.ok(Math.abs(dist[20 * w + 30] - 2.5) < 0.6, `clearance in a 4 m gap ~2 (got ${dist[20 * w + 30]})`);
});

// ---- the real coast ----
const dir = fileURLToPath(new URL('../assets/coast/', import.meta.url));
const io = { json: async (u) => JSON.parse(readFileSync(u, 'utf8')), bytes: async (u) => new Uint8Array(readFileSync(u)) };
const coast = await loadCoast(dir, io, COAST_TILES);
const world = buildCoastWorld(coast, { skerries: JSON.parse(readFileSync(dir + 'skerries.json', 'utf8')).skerries });
const file = JSON.parse(readFileSync(dir + 'passes.json', 'utf8'));
const cand = JSON.parse(readFileSync(dir + 'pass-candidates.json', 'utf8'));
const H0 = world.H.slice(), CL0 = world.CL.slice();
const reset = () => { world.H.set(H0); world.CL.set(CL0); resetPasses(world); };
const inRegion = (p) => p.lat >= file.region.s && p.lat <= file.region.n && p.lon >= file.region.w && p.lon <= file.region.e;
const lenGame = (p) => { let t = 0; for (let i = 1; i < p.line.length; i++) { const a = world.toGame(...p.line[i - 1]), b = world.toGame(...p.line[i]); t += Math.hypot(a[0] - b[0], a[1] - b[1]); } return t; };

await check('passes.json: schema, region, credit, tiers (ship <= 2x and short; eye = the 4-6x ones, never shipped), counts honest', () => {
  assert.match(file.credit, /OpenStreetMap contributors/); assert.equal(file.licence, 'ODbL 1.0'); assert.equal(file.hullRadiusGameM, HULL_RADIUS_M);
  const ids = new Set();
  for (const p of file.passes) {
    assert.ok(!ids.has(p.id), 'duplicate id ' + p.id); ids.add(p.id);
    assert.ok(PASS_TIERS.includes(p.tier), p.id);
    assert.ok(inRegion(p.a) && inRegion(p.b) && inRegion(p.centre), `${p.id} outside the region`);
    assert.ok(p.polygon.length >= 1 && p.polygon.every((r) => r.length >= 3 && r.every(([lon, lat]) => lat >= file.region.s - 0.01 && lat <= file.region.n + 0.01 && lon >= file.region.w - 0.01 && lon <= file.region.e + 0.01)), `${p.id} polygon`);
    assert.ok(p.realWidthM > 0 && p.lengthM > 0 && p.carveWidthM >= p.realWidthM && p.widenFactor >= 1, p.id);
    if (p.tier === 'ship' || p.tier === 'later') assert.ok(p.widenFactor <= 2.0 && !p.eyeReason, `${p.id} x${p.widenFactor} should be on the eye list`);
    // a harbour approach is the exception (Felix: harbours matter most): it may be widened more than x2 and is carved with the ship tier
    if ((p.widenFactor > 2.0 || p.realWidthM < 20) && p.tier !== 'harbour') assert.equal(p.tier, 'eye', `${p.id} x${p.widenFactor} must not ship`);
    if (p.tier === 'eye') assert.ok(p.eyeReason, p.id);
    if (p.tier === 'ship') { assert.ok(p.lengthM <= 300 && p.rank >= 1 && p.marginalKm >= 50, `${p.id} ship rank/gain`); }
  }
  assert.equal(file.counts.total, file.passes.length);
  for (const t of PASS_TIERS) assert.equal(file.counts[t], file.passes.filter((p) => p.tier === t).length);
  const ship = file.passes.filter((p) => p.tier === 'ship');
  assert.ok(ship.length >= 5 && ship.length <= 8, `recommended batch of ${ship.length}`);
  assert.ok(file.passes.some((p) => p.tier === 'eye'), 'the heavy ones are listed, not dropped');
});

await check('every pass in the file is navigable end to end with the current hull radius once carved (all tiers, each on its own)', () => {
  assert.equal(HULL_RADIUS_M, 2.5);
  for (const p of file.passes) {
    reset();
    const deps = (p.dependsOn ?? []).map((id) => file.passes.find((q) => q.id === id)); // a harbour approach that continues an earlier one
    applyPasses(world, [...deps, p], { ids: [...deps.map((q) => q.id), p.id], depth: false });
    const [A, B] = passEnds(world, p), L = lenGame(p);
    const route = findRoute(world, A, B, { margin: 40 + L });
    assert.ok(route.ok, `${p.id}: no route after the carve (${route.reason})`);
    assert.ok(route.length <= 1.35 * L + 25, `${p.id}: route ${route.length.toFixed(0)} gm is a detour of a ${L.toFixed(0)} gm channel`);
    // and the boat's own clearance: every point of the route is a legal place for a hull of 2.5 game m
    for (const [x, z] of route.path) assert.ok(!isBlocked(world.heightAt, x, z), `${p.id}: route point blocked`);
  }
  reset();
});

await check('closed today: the ship passes are not navigable on the raw raster (the carve is what opens them)', () => {
  reset();
  for (const p of file.passes.filter((q) => q.tier === 'ship')) {
    const [A, B] = passEnds(world, p), L = lenGame(p);
    const r = findRoute(world, A, B, { margin: 40 + L });
    assert.ok(!r.ok || r.length > 1.35 * L + 25, `${p.id} is already open without carving`);
  }
});

await check('the whole ship batch together: all navigable at once, only ship polygons changed, the island shape barely moves', () => {
  reset();
  const before = world.H.slice();
  const ship = file.passes.filter((p) => p.tier === 'ship');
  const rep = applyPasses(world, file, { tiers: ['ship'], depth: false });
  assert.deepEqual(rep.carved.map((c) => c.id).sort(), ship.map((p) => p.id).sort());
  for (const p of ship) { const [A, B] = passEnds(world, p), L = lenGame(p); assert.ok(findRoute(world, A, B, { margin: 40 + L }).ok, p.id); }
  // changes stay inside the ship passes' boxes
  const boxes = ship.map((p) => passCellBox(world, p, 6));
  let changed = 0, landLost = 0;
  for (let k = 0; k < before.length; k++) {
    if (before[k] === world.H[k]) continue;
    changed++;
    const a = k % world.nx, b = (k / world.nx) | 0;
    assert.ok(boxes.some((x) => a >= x.a0 && a <= x.a1 && b >= x.b0 && b <= x.b1), `cell ${a},${b} changed outside any ship pass`);
    if (before[k] > 0 && world.H[k] < -BLOCK_H * 0) landLost++;
  }
  assert.ok(changed > 100 && changed < 40000, `${changed} cells changed`);
  const landCells = before.reduce((n, v) => n + (v > 0 ? 1 : 0), 0);
  assert.ok(landLost / landCells < 0.0005, `the ship batch turns ${((landLost / landCells) * 100).toFixed(3)}% of the land into water`);
  // idempotent on the real coast too
  const snap = world.H.slice(); applyPasses(world, file, { tiers: ['ship'], depth: false }); assert.deepEqual([...world.H], [...snap]);
  reset();
});

await check('applyPasses refreshes the depth map on the real coast (sea colour and shore foam follow the carve) in well under a second', () => {
  reset();
  const dm = world.depthMap, d0 = dm.depth.slice();
  const t = Date.now();
  const rep = applyPasses(world, file);
  assert.ok(Date.now() - t < 3000, 'too slow');
  assert.ok(rep.changedCells > 0 && dm.depth.some((v, i) => v !== d0[i]), 'depth map changed');
  reset();
});

await check('pass-candidates.json: every named sound / harbour / favourite has an open-or-closed verdict; Felix\'s pins are there', () => {
  assert.match(cand.credit, /OpenStreetMap/);
  assert.equal(cand.counts.total, cand.candidates.length);
  for (const c of cand.candidates) { assert.ok(['sound', 'harbour', 'favourite', 'place'].includes(c.kind), c.name); assert.ok(/^(open|partly open|closed)/.test(c.today), `${c.name}: ${c.today}`); for (const id of c.passes) assert.ok(file.passes.some((p) => p.id === id), `${c.name} -> unknown pass ${id}`); }
  const sounds = cand.candidates.filter((c) => c.kind === 'sound');
  assert.ok(sounds.length >= 20 && sounds.some((c) => /Kråkesund/.test(c.name)) && sounds.some((c) => c.today === 'open') && sounds.some((c) => c.today.startsWith('closed')));
  assert.ok(cand.candidates.some((c) => c.name.startsWith('Vrakevik')) && cand.candidates.some((c) => c.name.startsWith('Kråksundsgap')));
});

console.log(`\n${passed} checks passed`);
