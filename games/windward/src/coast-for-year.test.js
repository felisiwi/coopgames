// node games/windward/src/coast-for-year.test.js — the adapter (src/coast-for-year.js) and the era save keys (src/era-storage.js).
// The oracle is loadRealCoast, the loader the Today game has always used: asking for a Today year must BE that loader, and asking for 1950 must produce a
// coast of the same shape (every field game.js reads), with the 1950 world inside it. Slow (~20 s): it builds a Today terrain and a 1950 terrain.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { eraSuffix, scopedStorage, eraStorage } from './era-storage.js';

// loadRealCoast calls the browser's fetch; Node's fetch cannot read file:// addresses, so a stand-in reads the disk.
globalThis.fetch = async (u) => {
  const buf = readFileSync(fileURLToPath(u));
  return { text: async () => buf.toString('utf8'), json: async () => JSON.parse(buf.toString('utf8')), arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
};
const { loadCoastForYear } = await import('./coast-for-year.js');
const { loadRealCoast } = await import('./coast-world.js');
const { LIGHTHOUSES } = await import('./lighthouses.js');

let passed = 0;
async function check(name, fn) { await fn(); passed += 1; console.log(`ok - ${name}`); }
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), keys: () => [...m.keys()] }; };

// ------------------------------------------------------------------------------------------------ save keys per era
await check('save keys: Today keeps its keys exactly; 1950 adds a suffix; the two never see each other', () => {
  assert.equal(eraSuffix('today'), ''); assert.equal(eraSuffix('1950'), '.1950'); assert.equal(eraSuffix(undefined), '');
  const base = memory();
  const today = eraStorage('today', base), e1950 = eraStorage('1950', base);
  assert.equal(today, base, 'Today gets the real storage: nobody\'s saved progress moves');
  today.setItem('windward.lights.v1', 'T');
  assert.equal(e1950.getItem('windward.lights.v1'), null, 'a Today save is invisible in 1950');
  e1950.setItem('windward.lights.v1', 'N');
  assert.equal(today.getItem('windward.lights.v1'), 'T', 'a 1950 save does not touch Today');
  assert.deepEqual(base.keys().sort(), ['windward.lights.v1', 'windward.lights.v1.1950']);
  e1950.removeItem('windward.lights.v1');
  assert.deepEqual(base.keys(), ['windward.lights.v1'], 'removing in 1950 removes only the 1950 key');
  assert.equal(scopedStorage(null, '.1950'), null, 'blocked storage stays null: the modules already treat that as "no memory"');
});

// ------------------------------------------------------------------------------------------------ the two worlds
const toDisk = { json: async (u) => JSON.parse(readFileSync(fileURLToPath(u), 'utf8')), bytes: async (u) => new Uint8Array(readFileSync(fileURLToPath(u))) };
const oracle = await loadRealCoast({ seed: 1 });
const today = await loadCoastForYear(2015, { seed: 1, io: toDisk });
const c1950 = await loadCoastForYear(1950, { seed: 1, io: toDisk });

// every coast.* field game.js and the modules it feeds read
const FIELDS = ['world', 'group', 'depthMap', 'spawn', 'trees', 'terrain', 'terrainStyle', 'clamp', 'update', 'names', 'summerHouses', 'findOpenWater', 'lights', 'lightList',
  'heightAt', 'sailHeightAt', 'shoalSlowAt', 'sea', 'report', 'granddad', 'era'];

await check('Today through the adapter IS loadRealCoast: same window, same names, same lights, same start; the light list is the game\'s own', () => {
  assert.equal(today.era, 'today');
  assert.equal(today.world.nx, oracle.world.nx); assert.equal(today.world.nz, oracle.world.nz);
  assert.deepEqual(today.names.map((n) => n.id), oracle.names.map((n) => n.id));
  assert.deepEqual(today.lights.map((l) => l.name), oracle.lights.map((l) => l.name));
  assert.deepEqual([today.spawn.x, today.spawn.z], [oracle.spawn.x, oracle.spawn.z]);
  assert.equal(today.lightList, LIGHTHOUSES);
  assert.ok(today.granddad && today.granddad.strange, 'Today has granddad\'s chart');
  for (const k of FIELDS) assert.ok(k in today, `Today lacks ${k}`);
});

await check('1950 has every field the game reads, and the same window as Today (one coast, two moments)', () => {
  for (const k of FIELDS) assert.ok(k in c1950 && c1950[k] !== undefined, `1950 lacks ${k}`);
  assert.equal(c1950.era, '1950');
  assert.equal(c1950.world.nx, oracle.world.nx); assert.equal(c1950.world.nz, oracle.world.nz);
  assert.equal(c1950.granddad, null, 'granddad\'s chest chart does not exist yet in 1950');
  assert.ok(c1950.spawn && Math.hypot(c1950.spawn.x - oracle.spawn.x, c1950.spawn.z - oracle.spawn.z) < 450, 'the start is still by Grundsund (the wake beach is searched for within 400 m of the old start)');
  assert.deepEqual([c1950.spawn.x, c1950.spawn.z], [c1950.wake.spawn.x, c1950.wake.spawn.z], '1950 starts where the wake plan says');
  const t = c1950.report.timings;
  for (const k of ['loadDecodeMs', 'fieldMs', 'depthMs', 'terrainMs', 'propsMs', 'buildMs']) assert.ok(Number.isFinite(t[k]), `report.timings.${k}`);
  assert.ok(Number.isFinite(c1950.report.terrain.fullTriangles) && Number.isFinite(c1950.report.bytesDownloadedByLoader));
});

await check('1950 lights: the eight that stood and can be placed, each with the lantern glow the game reuses; the list replaces today\'s', () => {
  assert.equal(c1950.lights.length, 8, 'seven from the data plus Kråksundsgap Södra\'s small iron lantern');
  assert.equal(c1950.lightList.length, 8);
  const kr = c1950.lightList.find((l) => l.name === 'Kråksundsgap Södra');
  assert.ok(kr && kr.lit && kr.model === 'fyrkur' && kr.light.count === 2 && kr.light.period === 7, 'the 1941 iron lantern, two flashes every 7 s');
  assert.ok(c1950.lights.find((l) => l.name === 'Kråksundsgap Södra').group, 'it is placed in the 1950 world');
  assert.ok(c1950.lights.every((l) => l.group && l.fx && typeof l.fx.setLit === 'function' && Number.isFinite(l.x)), 'group + lantern fx on each');
  const lightNames = c1950.names.filter((n) => n.kind === 'light').map((n) => n.name).sort();
  assert.deepEqual(lightNames, c1950.lightList.map((l) => l.name).sort(), 'the name list carries exactly the 1950 lights (id light:<name>)');
  for (const dark of ['Islandsberg', 'Stångehuvud']) assert.equal(c1950.lightList.find((l) => l.name === dark).lit, false, `${dark} was dark in 1950`);
  assert.equal(c1950.lightList.find((l) => l.name === 'Måseskär').lit, true);
  assert.equal(c1950.lightsNotDrawn.length, 4, 'the four fyrkurar with no position are reported, never guessed');
});

await check('1950 sea: one shoal layer (the game\'s own), no modern marks, the harbours kept for the reporting step', () => {
  assert.equal(c1950.sea.marks.length, 0, 'no modern sea marks: the builder stamps the period marks');
  assert.ok(c1950.sea.shoalList.length > 50);
  assert.ok(c1950.sea.harbours.some((h) => h.name.startsWith('Fiskebäckskil')));
  let shoalGroups = 0; c1950.group.traverse((o) => { if (o.name && /shoal/i.test(o.name)) shoalGroups++; });
  assert.equal(shoalGroups, 0, 'the builder\'s shoal layer was taken out of the scene');
  assert.equal(today.sea.marks.length > 100, true, 'Today still has its marks');
});

await check('1950 houses and period marks stand; the builder draws no boats of its own (the busy coast does)', () => {
  assert.ok(c1950.report.cottages > 40, `cottages ${c1950.report.cottages}`);
  assert.ok(c1950.report.marks > 10, `period marks ${c1950.report.marks}`);
  assert.equal(c1950.report.mooredBoats + c1950.report.sailingBoats, 0);
  assert.equal(c1950.report.ferry, 'none');
  assert.deepEqual(c1950.summerHouses, []);
});

await check('update(x, z, dt, t, seaAt) runs on both: Today ignores the extras, 1950 animates its buoys and breakers', () => {
  const sx = c1950.spawn.x, sz = c1950.spawn.z;
  assert.equal(typeof c1950.update(sx, sz, 0.016, 1, () => 0), 'boolean');
  assert.equal(typeof c1950.update(sx + 300, sz, 0.016, 2, () => 0.2), 'boolean');
  assert.equal(typeof today.update(today.spawn.x, today.spawn.z, 0.016, 1, () => 0), 'boolean');
  assert.doesNotThrow(() => c1950.setNight(true)); assert.doesNotThrow(() => c1950.setNight(false));
  const self = { x: 1e9, z: -1e9 }; c1950.clamp(self);
  assert.ok(Math.abs(self.x) < 1e6 && Math.abs(self.z) < 1e6, 'clamp holds the boat inside the window');
});

console.log(`\n${passed} checks passed`);
