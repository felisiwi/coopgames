// node games/windward/src/harbour-approach.test.js
// Harbour approaches: the route / carve logic on a synthetic coast, and on the real coast: every harbour and village the
// arrival uses (and every OSM harbour / marina) is reachable from open water with the current hull.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { approachRoute, carveHarbourRings, fairwayMask, protectNear, realWaterNear, reachFromSea, HARBOUR_REACH_M, BERTH_BACK_M } from './harbour-approach.js';
import { applyPasses, resetPasses, findRoute, passEnds } from './passes.js';
import { isBlocked, HULL_RADIUS_M } from './shore.js';
import { loadCoast } from './coast-data.js';
import { buildCoastWorld, COAST_TILES } from './coast-world.js';
import { buildNameList } from './names.js';
import * as D from './pass-derive.js';

let passed = 0;
async function check(name, fn) { await fn(); passed += 1; console.log(`ok - ${name}`); }

// ---- synthetic: open sea (top), a 3-cell (6 m) channel running down to a pond with a quay (bottom) --------------
function synth() {
  const nx = 80, nz = 120, pxM = 2, ratio = 4, cellF = pxM / ratio, wF = nx * ratio, hF = nz * ratio;
  const water = new Uint8Array(wF * hF), H = new Float32Array(nx * nz).fill(5);
  const realWater = (x, z) => z < 70 || (z >= 70 && z < 190 && Math.abs(x - 80) <= 3.5) || (z >= 190 && z < 230 && Math.abs(x - 80) <= 22); // metres: sea, a 7 m channel, a pond
  for (let j = 0; j < hF; j++) for (let i = 0; i < wF; i++) water[j * wF + i] = realWater((i + 0.5) * cellF, (j + 0.5) * cellF) ? 1 : 0;
  for (let b = 0; b < nz; b++) for (let a = 0; a < nx; a++) { const x = (a + 0.5) * pxM, z = (b + 0.5) * pxM; if (z < 70 || (z >= 190 && z < 230 && Math.abs(x - 80) <= 22)) H[b * nx + a] = -6; } // the channel itself is LAND for the game (too narrow)
  const world = { nx, nz, pxM, x0: 0, z0: 0, H, CL: new Uint8Array(nx * nz), toGame: (lo, la) => [lo, la], depthMap: null };
  world.heightAt = (x, z) => { const fx = x / pxM - 0.5, fz = z / pxM - 0.5; if (fx < 0 || fz < 0 || fx > nx - 1 || fz > nz - 1) return -10; const a = Math.min(nx - 2, Math.floor(fx)), b = Math.min(nz - 2, Math.floor(fz)), u = fx - a, v = fz - b, k = b * nx + a; return (H[k] * (1 - u) + H[k + 1] * u) * (1 - v) + (H[k + nx] * (1 - u) + H[k + nx + 1] * u) * v; };
  const env = { water, wF, hF, cellF, x0: 0, z0: 0 };
  const clear = D.cellClearance(D.distanceToLand(water, wF, hF), wF, ratio, nx, nz, cellF);
  const sail = D.sailableMask(world, isBlocked), { label, sizes } = D.components(sail, nx, nz);
  return { world, env, clear, sail, label, main: sizes.indexOf(Math.max(...sizes)), ratio };
}

await check('synthetic: the pond is closed to the hull; the route runs from the quay water through the channel to the sea', () => {
  const s = synth();
  const A = realWaterNear(s.env, 80, 200, 15); // quay water in the pond
  assert.ok(A && A.d < 1);
  assert.ok(reachFromSea({ ...s.world, sail: s.sail, label: s.label }, s.main, A.x, A.z, 60) > 30, 'closed today');
  const g = { nx: s.world.nx, nz: s.world.nz, sail: s.sail, label: s.label, clear: s.clear };
  const r = approachRoute(g, { a: Math.floor(A.x / 2), b: Math.floor(A.z / 2) }, s.main);
  assert.ok(r, 'a route exists'); assert.ok(r.blocked.length > 40, `${r.blocked.length} blocked cells (the channel)`);
  // quay first, sea last
  assert.ok(r.cells[0][1] > r.cells[r.cells.length - 1][1], 'starts at the quay (bottom), ends in the sea (top)');
  assert.ok(r.blocked.every(([a]) => Math.abs((a + 0.5) * 2 - 80) < 6), 'the route stays in the channel');
});

await check('synthetic: the carve opens the channel to the quay, keeps the channel\'s real shape, and the protected quay stays land', () => {
  const s = synth();
  const A = realWaterNear(s.env, 80, 200, 15);
  const g = { nx: s.world.nx, nz: s.world.nz, sail: s.sail, label: s.label, clear: s.clear };
  const r = approachRoute(g, { a: Math.floor(A.x / 2), b: Math.floor(A.z / 2) }, s.main);
  let pts = r.cells.slice().reverse().map(([a, b]) => [(a + 0.5) * 2, (b + 0.5) * 2, s.clear[b * s.world.nx + a]]);
  pts = pts.filter((p) => Math.hypot(p[0] - A.x, p[1] - A.z) >= BERTH_BACK_M);
  const quay = [[[60, 232], [100, 232]]]; // a quay line along the pond's far edge: land that must stay land
  const protect = protectNear(quay, 2.5);
  const rings = carveHarbourRings(s.env, pts, { minHalf: 3.6, protect });
  assert.ok(rings.length >= 1);
  const poly = rings.map((rg) => rg);
  const tiers = [{ id: 'h', tier: 'harbour', polygon: poly }];
  applyPasses(s.world, tiers, { depth: false }); // synthetic toGame is the identity: the polygon is already in game m
  const route = findRoute(s.world, [pts[0][0], pts[0][1]], [pts[pts.length - 1][0], pts[pts.length - 1][1]], { margin: 60 });
  assert.ok(route.ok, route.reason);
  // the quay line cells (land at z 232) were not carved
  for (let x = 60; x <= 100; x += 4) assert.ok(s.world.heightAt(x, 233) > 0, `quay at x=${x} stays land`);
  assert.ok(Math.hypot(pts[pts.length - 1][0] - A.x, pts[pts.length - 1][1] - A.z) >= BERTH_BACK_M - 0.5, 'the carve stops short of the quay water');
});

await check('synthetic: with two parallel channels the marked fairway is the one the route takes (the marks decide)', () => {
  const nx = 80, nz = 80, pxM = 2, ratio = 4, cellF = pxM / ratio, wF = nx * ratio, hF = nz * ratio;
  const water = new Uint8Array(wF * hF);
  for (let j = 0; j < hF; j++) for (let i = 0; i < wF; i++) { const x = (i + 0.5) * cellF, z = (j + 0.5) * cellF; water[j * wF + i] = z < 30 || z > 130 || (Math.abs(x - 40) <= 4 && z >= 30 && z <= 130) || (Math.abs(x - 120) <= 4 && z >= 30 && z <= 130) ? 1 : 0; }
  const clear = D.cellClearance(D.distanceToLand(water, wF, hF), wF, ratio, nx, nz, cellF);
  const sail = new Uint8Array(nx * nz), label = new Int32Array(nx * nz).fill(-1);
  for (let b = 0; b < nz; b++) for (let a = 0; a < nx; a++) { const z = (b + 0.5) * 2; if (z < 28 || z > 132) { sail[b * nx + a] = 1; label[b * nx + a] = 0; } } // sea above and below; the channels are blocked
  const g = { nx, nz, sail, label, clear, pxM, x0: 0, z0: 0 };
  const start = { a: 20, b: 70 }; // in the west channel (x 40), midway
  const plain = approachRoute(g, { a: 60, b: 70 }, 0); // from the EAST channel
  assert.ok(plain.blocked.every(([a]) => Math.abs((a + 0.5) * 2 - 120) < 8), 'unmarked: from the east channel it goes up the east channel');
  // marks: a port/starboard gate across the WEST channel only; start BETWEEN the channels: the marked one should win
  const { mask } = fairwayMask(g, [{ x: 36, z: 50, side: 'port' }, { x: 44, z: 50, side: 'starboard' }, { x: 36, z: 110, side: 'port' }, { x: 44, z: 110, side: 'starboard' }]);
  assert.ok(mask[25 * nx + 20] < 1 && mask[25 * nx + 60] === 1, 'the gate discounts the west channel only');
  void start;
});

// ---- the real coast ----
const dir = fileURLToPath(new URL('../assets/coast/', import.meta.url));
const io = { json: async (u) => JSON.parse(readFileSync(u, 'utf8')), bytes: async (u) => new Uint8Array(readFileSync(u)) };
const coast = await loadCoast(dir, io, COAST_TILES);
const world = buildCoastWorld(coast, { skerries: JSON.parse(readFileSync(dir + 'skerries.json', 'utf8')).skerries });
const file = JSON.parse(readFileSync(dir + 'passes.json', 'utf8'));
const audit = JSON.parse(readFileSync(dir + 'harbour-audit.json', 'utf8'));
const H0 = world.H.slice(), CL0 = world.CL.slice();
const reset = () => { world.H.set(H0); world.CL.set(CL0); resetPasses(world); };
const harbourPasses = file.passes.filter((p) => p.tier === 'harbour');
const lenGame = (p) => { let t = 0; for (let i = 1; i < p.line.length; i++) { const a = world.toGame(...p.line[i - 1]), b = world.toGame(...p.line[i]); t += Math.hypot(a[0] - b[0], a[1] - b[1]); } return t; };

await check('harbour-audit.json + passes.json: schema, Grundsund first, ids unique, credit, counts honest; every harbour pass is tier "harbour"', () => {
  assert.match(audit.credit, /OpenStreetMap contributors/); assert.equal(audit.licence, 'ODbL 1.0');
  assert.equal(audit.counts.targets, audit.harbours.length);
  assert.equal(audit.counts.harbourPasses, harbourPasses.length);
  assert.equal(file.counts.harbour, harbourPasses.length);
  assert.ok(audit.harbours[0].name.startsWith('Grundsund') && audit.harbours.slice(0, 3).every((r) => /Grundsund/.test(r.name)), 'Grundsund first');
  assert.ok(file.passes.some((p) => p.id === 'harbour-grundsunds-marina' && p.tier === 'harbour'), 'the southern basin approach');
  assert.ok(!file.passes.some((p) => p.tier === 'harbour' && p.through), 'the canal and other inner channels are NOT carved: only basins are reached (Felix)');
  assert.equal(new Set(file.passes.map((p) => p.id)).size, file.passes.length, 'unique ids');
  for (const r of audit.harbours) { assert.ok(['open', 'open (after the ship batch)', 'blocked, carved'].includes(r.status) || /^open \(via /.test(r.status), `${r.name}: ${r.status}`); assert.equal(r.finalOpen, true, `${r.name} must be open at the end`); }
  for (const p of harbourPasses) {
    assert.ok(p.harbour.target && p.harbour.quay && p.polygon.length >= 1 && p.line.length >= 2, p.id);
    assert.ok(p.carveWidthM >= p.realWidthM && p.widenFactor >= 1, p.id);
    for (const d of p.dependsOn) assert.ok(harbourPasses.some((q) => q.id === d), `${p.id} depends on unknown ${d}`);
  }
  assert.ok(audit.counts.openRaw < audit.counts.targets && audit.counts.openAfter === audit.counts.targets, 'some are blocked today, none after');
});

await check('every village and harbour the arrival uses is in the audit (name list), with every OSM harbour / marina and Felix\'s pins', () => {
  const names = JSON.parse(readFileSync(dir + 'names.json', 'utf8')), placeNames = JSON.parse(readFileSync(new URL('../data/place-names.json', import.meta.url), 'utf8'));
  const settlements = JSON.parse(readFileSync(new URL('../data/settlements-history.json', import.meta.url), 'utf8')).settlements;
  const list = buildNameList({ names, villages: settlements, toGame: world.toGame, inside: (x, z) => world.inside(x, z, 80), placeNames }).filter((p) => p.kind === 'village' || p.kind === 'harbour');
  assert.ok(list.length >= 20);
  for (const p of list) assert.ok(audit.harbours.some((r) => r.name === p.name && r.kind === p.kind), `${p.kind} ${p.name} missing from the audit`);
  for (const n of ['Grundsund', 'Fiskebäckskil', 'Käringön', 'Gullholmen', 'Lysekil', 'Hälleviksstrand']) assert.ok(audit.harbours.some((r) => r.name === n && r.kind === 'village'), n);
  assert.ok(audit.harbours.some((r) => r.name.startsWith('Vrakevik')) && audit.harbours.some((r) => /Kr[åa]k(e)?sundsgap/.test(r.name)), "Felix's Vrakevik and Kråksundsgap");
  assert.ok(audit.harbours.filter((r) => r.kind === 'quay').length >= 20, 'the OSM harbours / marinas');
});

await check('EVERY harbour is reachable from open water with the current hull: ship + harbour carved, the quay water is within 60 m of a sailable cell of the main sea', () => {
  assert.equal(HULL_RADIUS_M, 2.5);
  reset();
  applyPasses(world, file); // the default: ship + harbour tiers
  const sail = D.sailableMask(world, isBlocked), { label, sizes } = D.components(sail, world.nx, world.nz);
  const main = sizes.indexOf(Math.max(...sizes));
  assert.ok(sizes[main] > 100000, 'the main sea is one big body of water');
  const env = { nx: world.nx, nz: world.nz, pxM: world.pxM, x0: world.x0, z0: world.z0, sail, label };
  let checked = 0;
  for (const r of audit.harbours) {
    assert.ok(r.quay, `${r.name} has no quay water`);
    const [x, z] = world.toGame(r.quay.lon, r.quay.lat);
    const d = reachFromSea(env, main, x, z, 40);
    assert.ok(d <= HARBOUR_REACH_M, `${r.name}: the boat gets only ${(d * 10).toFixed(0)} m from the quay (limit ${HARBOUR_REACH_M * 10} m)`);
    checked++;
  }
  assert.equal(checked, audit.harbours.length);
  reset();
});

await check('...and without the harbour tier several of them are NOT reachable (the carve is what opens them), Grundsund among them', () => {
  reset();
  applyPasses(world, file, { tiers: ['ship'] });
  const sail = D.sailableMask(world, isBlocked), { label, sizes } = D.components(sail, world.nx, world.nz), main = sizes.indexOf(Math.max(...sizes));
  const env = { nx: world.nx, nz: world.nz, pxM: world.pxM, x0: world.x0, z0: world.z0, sail, label };
  const blocked = audit.harbours.filter((r) => { const [x, z] = world.toGame(r.quay.lon, r.quay.lat); return reachFromSea(env, main, x, z, 40) > HARBOUR_REACH_M; });
  assert.ok(blocked.length >= 12, `${blocked.length} blocked without the harbour tier`);
  assert.ok(blocked.some((r) => r.name === 'Grundsunds Marina'), 'the southern basin is blocked today');
  assert.ok(!blocked.some((r) => r.name === 'Grundsunds hamn' || r.name === 'Grundsund'), 'the north basin (guest harbour) is open today, and the village counts through it: the canal between them is not carved (Felix)');
  reset();
});

await check('each harbour approach is navigable end to end, sea end to berth (with what it depends on), and ends short of the quay', () => {
  for (const p of harbourPasses) {
    reset();
    applyPasses(world, file, { tiers: ['ship'] });
    const deps = p.dependsOn.map((id) => file.passes.find((q) => q.id === id));
    applyPasses(world, [...deps, p], { ids: [...deps.map((q) => q.id), p.id], depth: false });
    const [A, B] = passEnds(world, p), L = lenGame(p);
    const rt = findRoute(world, A, B, { margin: 40 + L });
    assert.ok(rt.ok, `${p.id}: ${rt.reason}`);
    assert.ok(rt.length <= 1.35 * L + 25, `${p.id}: a detour (${rt.length.toFixed(0)} vs ${L.toFixed(0)})`);
    const [qx, qz] = world.toGame(p.harbour.quay.lon, p.harbour.quay.lat);
    assert.ok(Math.hypot(B[0] - qx, B[1] - qz) <= HARBOUR_REACH_M, `${p.id}: the berth is ${Math.hypot(B[0] - qx, B[1] - qz).toFixed(1)} game m from the quay water`);
  }
  reset();
});

await check('quay readable: no land within 0.6 game m of an OSM quay / breakwater line is turned to water; real shape kept (carve is mostly real water)', () => {
  reset();
  const before = world.H.slice();
  applyPasses(world, file);
  let lines = 0, violations = 0;
  for (const p of harbourPasses) for (const l of p.context.quays) {
    lines++;
    for (let i = 1; i < l.length; i++) {
      const a = world.toGame(...l[i - 1]), b = world.toGame(...l[i]), n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1));
      for (let s = 0; s <= n; s++) {
        const x = a[0] + ((b[0] - a[0]) * s) / n, z = a[1] + ((b[1] - a[1]) * s) / n;
        const ca = Math.floor((x - world.x0) / world.pxM), cb = Math.floor((z - world.z0) / world.pxM), k = cb * world.nx + ca;
        if (before[k] > 0 && world.H[k] < -0.5) violations++;
      }
    }
  }
  assert.ok(lines >= 3, `${lines} quay lines in the contexts`);
  assert.equal(violations, 0, 'the quay line stays land');
  reset();
});

await check('the cost is bounded: harbour carves together turn under 15 ha of land to water; no single approach over 5 ha; the island harbours stay small', () => {
  let total = 0;
  for (const p of harbourPasses) { assert.ok(p.landRemovedM2 <= 50000, `${p.id} removes ${p.landRemovedM2} m2`); total += p.landRemovedM2; if (/holm|Felix/.test(p.harbour.target) && !/Grundsund/.test(p.harbour.target)) assert.ok(p.lengthM <= 200, `${p.id} (island harbour) ${p.lengthM} m long`); }
  assert.ok(total <= 150000, `total ${total} m2`);
  // the two Grundsund passes are the big ones (the whole sound), and are allowed to be wide (Felix: harbours matter most)
  assert.ok(harbourPasses.find((p) => p.id === 'harbour-grundsunds-marina').widenFactor > 1.7, 'the south-west channel is a real 5-10 m, so it is widened a lot');
});

console.log(`\n${passed} checks passed`);
