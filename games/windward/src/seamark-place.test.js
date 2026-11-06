// node games/windward/src/seamark-place.test.js
// The invented harbour-mouth gates: the placement rule on a synthetic coast (where the right answer is known), and the
// generated gates in assets/coast/seamarks.json checked against the real coast raster.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { findHarbourMouth, portIsLeft, makeFromGame, SAIL_D, GATE_MIN, GATE_MAX } from './seamark-place.js';
import { BLOCK_H, isBlocked } from './shore.js';
import { loadCoast } from './coast-data.js';
import { buildCoastWorld, COAST_TILES } from './coast-world.js';

const dir = fileURLToPath(new URL('../assets/coast/', import.meta.url));
let passed = 0;
async function check(name, fn) { await fn(); passed += 1; console.log(`ok - ${name}`); }

// ---- a synthetic coast: land everywhere except a pond (the harbour, bottom), a straight channel 5 cells wide going
// north, and open sea across the top. 2 m cells. z grows southward like the game's.
function syntheticWorld() {
  const nx = 160, nz = 260, pxM = 2, x0 = 0, z0 = 0;
  const H = new Float32Array(nx * nz).fill(1.5);
  const cx = 80;
  for (let b = 0; b < nz; b++) for (let a = 0; a < nx; a++) {
    const sea = b < 150; // open sea in the north (inside the search window: it reaches 95 cells from the harbour)
    const channel = b >= 150 && b < 200 && Math.abs(a - cx) <= 2; // 5 cells = 10 m wide, 100 m long
    const pond = b >= 200 && b < 230 && Math.abs(a - cx) <= 14;
    if (sea || channel || pond) H[b * nx + a] = -6;
  }
  const heightAt = (x, z) => {
    const a = Math.floor((x - x0) / pxM), b = Math.floor((z - z0) / pxM);
    if (a < 0 || b < 0 || a >= nx || b >= nz) return -30;
    return H[b * nx + a];
  };
  return { nx, nz, pxM, x0, z0, H, heightAt, cx };
}

await check('synthetic coast: the gate is at the narrow channel (not in the pond or the open sea), across it, red on the port side', () => {
  const w = syntheticWorld();
  const harbour = [(w.cx + 0.5) * w.pxM, 215 * w.pxM]; // in the pond
  const r = findHarbourMouth(w, harbour);
  assert.ok(r.ok, r.reason);
  const chanX = (w.cx + 0.5) * w.pxM;
  assert.ok(Math.abs(r.centre[0] - chanX) < 3, `gate centred on the channel (${r.centre[0]} vs ${chanX})`);
  assert.ok(r.centre[1] > 145 * w.pxM && r.centre[1] < 200 * w.pxM, 'gate in the channel, not the pond or the sea');
  assert.ok(r.widthM < 14, `width ${r.widthM}`);
  assert.ok(r.mouthFromHarbourM >= 15, 'not on the quay');
  // entering from the north sea into the pond = heading south; port (left) is EAST
  assert.ok(r.heading[1] > 0.95, 'heading south');
  assert.ok(r.port[0] > r.starboard[0], 'port (red) is east when heading south');
  assert.ok(portIsLeft(r.heading, r.port, r.starboard));
  for (const p of [r.port, r.starboard]) assert.ok(w.heightAt(p[0], p[1]) <= BLOCK_H - 0.3, 'marks in water');
  assert.ok(!isBlocked(w.heightAt, ...r.centre) || r.widthM < 8, 'a boat fits between the marks');
  assert.ok(Math.abs(r.port[0] - r.starboard[0]) >= 1.5 && Math.abs(r.port[0] - r.starboard[0]) <= GATE_MAX + 1e-6);
});

await check('synthetic coast: a harbour boxed in by land has no gate, and says why', () => {
  const w = syntheticWorld();
  const r = findHarbourMouth(w, [20, 20 * 2]); // in the land, nowhere near water... the sea is at b<50 so go far east/south
  const far = findHarbourMouth(w, [150 * 2, 250 * 2]);
  assert.ok(far.ok === false && /no real body of water/.test(far.reason), JSON.stringify(far).slice(0, 120));
  assert.ok(r.ok || typeof r.reason === 'string');
});

// ---- the real generated gates ----
const io = { json: async (u) => JSON.parse(readFileSync(u, 'utf8')), bytes: async (u) => new Uint8Array(readFileSync(u)) };
const coast = await loadCoast(dir, io, COAST_TILES);
const skerries = JSON.parse(readFileSync(dir + 'skerries.json', 'utf8')).skerries;
const world = buildCoastWorld(coast, { skerries });
const file = JSON.parse(readFileSync(dir + 'seamarks.json', 'utf8'));
const invented = file.marks.filter((m) => m.invented);
const gates = file.harbours.filter((h) => h.inventedGate?.ids);
const mark = (id) => file.marks.find((m) => m.id === id);
const bearingToHeading = (deg) => [Math.sin((deg * Math.PI) / 180), -Math.cos((deg * Math.PI) / 180)]; // (x east, z south)

await check('the file has invented gates: pairs of lateral spar buoys with invented: true, ids "invented/<harbour>-port|starboard"', () => {
  assert.equal(invented.length, 20);
  assert.equal(gates.length, 10);
  for (const m of invented) {
    assert.equal(m.type, 'lateral'); assert.equal(m.form, 'buoy'); assert.equal(m.shape, 'spar'); assert.equal(m.system, 'iala-a');
    assert.ok(m.nearHarbour && m.basis?.harbour, m.id);
  }
  for (const h of gates) {
    const [pid, sid] = h.inventedGate.ids;
    assert.equal(mark(pid)?.side, 'port'); assert.equal(mark(sid)?.side, 'starboard');
    assert.deepEqual(mark(pid).colours, ['red']); assert.deepEqual(mark(sid).colours, ['green']);
  }
});

await check('Fiskebäckskil first, then the Käringön fishing harbour: both have a gate; Fiskebäckskil is a real narrow neck', () => {
  const f = file.harbours.find((h) => h.name.startsWith('Fiskebäckskils')), k = file.harbours.find((h) => h.name === 'Käringön fiskehamn');
  assert.ok(f.inventedGate?.ids && k.inventedGate?.ids);
  assert.ok(f.inventedGate.mouthWidthM <= 200, `Fiskebäckskil mouth ${f.inventedGate.mouthWidthM} m wide`);
  assert.ok(f.inventedGate.mouthFromHarbourM >= 150);
  assert.ok(file.harbours.indexOf(f) >= 0);
});

await check('every gate: both marks in water the boat can reach, a boat fits between them, they are 40-110 m apart', () => {
  for (const h of gates) {
    const [p, s] = h.inventedGate.ids.map((id) => world.toGame(mark(id).lon, mark(id).lat));
    for (const q of [p, s]) assert.ok(world.heightAt(...q) <= BLOCK_H - 0.3, `${h.name}: a mark is not in sailable water (${world.heightAt(...q).toFixed(2)})`);
    const mid = [(p[0] + s[0]) / 2, (p[1] + s[1]) / 2];
    assert.ok(!isBlocked(world.heightAt, ...mid) || Math.hypot(p[0] - s[0], p[1] - s[1]) < 7, `${h.name}: gate blocked in the middle`);
    const gap = Math.hypot(p[0] - s[0], p[1] - s[1]) * 10;
    assert.ok(gap >= 40 && gap <= 110, `${h.name}: gate ${gap.toFixed(0)} m`);
  }
});

await check('IALA A: entering from seaward, red (port) is on the LEFT of the heading, for every gate', () => {
  for (const h of gates) {
    const [p, s] = h.inventedGate.ids.map((id) => world.toGame(mark(id).lon, mark(id).lat));
    assert.ok(portIsLeft(bearingToHeading(h.inventedGate.enteringBearingDeg), p, s), `${h.name}: red is on the wrong side`);
  }
});

await check('coverage: every harbour with no real navigational mark within 600 m has a gate, or shares a nearby one', () => {
  const NAV = ['lateral', 'cardinal', 'isolated_danger', 'light'];
  const real = file.marks.filter((m) => !m.invented && NAV.includes(m.type));
  const m = (a, b) => Math.hypot((a.lat - b.lat) * 111195, (a.lon - b.lon) * 111195 * Math.cos((58.19 * Math.PI) / 180));
  let needed = 0;
  for (const h of file.harbours) {
    const bare = !real.some((x) => m(h, x) <= 600);
    if (!bare && !h.name.startsWith('Käringön fiskehamn')) { assert.ok(!h.inventedGate?.ids, `${h.name} has real marks but got a gate`); continue; }
    needed++;
    if (h.inventedGate?.ids) continue;
    const host = file.harbours.find((x) => x.name === h.inventedGate?.sharedWith);
    assert.ok(host?.inventedGate?.ids, `${h.name} has neither a gate nor a shared one (${JSON.stringify(h.inventedGate)})`);
    const a = world.toGame(host.inventedGate.mouth.lon, host.inventedGate.mouth.lat);
    const b = world.toGame(h.lon, h.lat);
    assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) * 10 < 1200, `${h.name} is far from the gate it shares`);
  }
  assert.ok(needed >= 11);
});

await check('real marks are untouched: 206 real rows, none flagged invented; the generator is deterministic (Fiskebäckskil again = the file)', () => {
  assert.equal(file.counts.real, 206);
  assert.ok(file.marks.filter((m) => !m.invented).every((m) => /^(node|way|relation)\//.test(m.id)));
  const f = file.harbours.find((h) => h.name.startsWith('Fiskebäckskils'));
  const r = findHarbourMouth(world, world.toGame(f.lon, f.lat));
  assert.ok(r.ok);
  const fromGame = makeFromGame(coast.meta, world.pxM);
  const [lon, lat] = fromGame(...r.centre);
  assert.ok(Math.abs(lon - f.inventedGate.mouth.lon) < 3e-5 && Math.abs(lat - f.inventedGate.mouth.lat) < 3e-5);
  // and the round trip game <-> lon/lat is exact enough (1 game m = 10 real m)
  const [x, z] = world.toGame(11.4620, 58.2490);
  const [lo2, la2] = fromGame(x, z);
  assert.ok(Math.abs(lo2 - 11.4620) < 1e-9 && Math.abs(la2 - 58.2490) < 1e-9);
});

console.log(`\n${passed} checks passed`);
