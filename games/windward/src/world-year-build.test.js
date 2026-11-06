// node games/windward/src/world-year-build.test.js — builds BOTH eras from the real coast files (the same ones the game loads) and checks
// what the brief asks: the water level moves the shore, hidden rocks are solid but not drawn as surf, no lights and no modern marks in
// 1700, the settlements follow the data, and Today is still the game's own coast. Slow (~10 s): it builds two terrains.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadWorldFiles, buildWorldForSpec, nearestLand, placeVillages1700, createHiddenRockLayer } from './world-year-build.js';
import { worldAtYear } from './world-year.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const io = {
  json: async (u) => JSON.parse(readFileSync(fileURLToPath(u), 'utf8')),
  bytes: async (u) => new Uint8Array(readFileSync(fileURLToPath(u))),
};
let passed = 0;
async function check(name, fn) { await fn(); passed += 1; console.log(`ok - ${name}`); }

const files = await loadWorldFiles({ coastUrl: new URL('../assets/coast/', import.meta.url).href, dataUrl: new URL('../data/', import.meta.url).href, chartUrl: new URL('../assets/chart/', import.meta.url).href, io });
const s1700 = worldAtYear(files.years, files.sources, 1700);
const sToday = worldAtYear(files.years, files.sources, 2025);
const e1700 = buildWorldForSpec(files, s1700);
const eToday = buildWorldForSpec(files, sToday);
// every named object in the scene; a boat's own parts (its little deck lantern, unlit by day) are not scenery, so boat subtrees are skipped
const names = (era) => { const out = []; const walk = (o) => { if (o.name) out.push(o.name); if (o.name === 'eka-sailing') return; o.children.forEach(walk); }; walk(era.group); return out; };

await check('both worlds build from the game files; the window is the same', async () => {
  assert.equal(e1700.world.nx, eToday.world.nx); assert.equal(e1700.world.nz, eToday.world.nz);
  assert.ok(e1700.spawn && eToday.spawn, 'a start in open water just outside Grundsund');
  assert.ok(e1700.buildMs < 20000 && eToday.buildMs < 20000);
});

await check('the sea stands higher in 1700: the same spot is lower, the shoreline moved, land area shrank a little', async () => {
  let lower = 0, higher = 0, flipped = 0, landT = 0, land1700 = 0, checked = 0;
  const { world: a } = eToday, { world: b } = e1700;
  for (let k = 0; k < a.H.length; k += 7) {
    checked++;
    if (a.H[k] > 0.2) landT++;
    if (b.H[k] > 0.2) land1700++;
    if (a.H[k] > 0.2 && b.H[k] <= 0.2) flipped++;
    if (b.H[k] < a.H[k] - 1e-6) lower++;
    if (b.H[k] > a.H[k] + 1e-4) higher++; // a skerry stamped where today's raster already had (low) land: the islet is a rock in 1700
  }
  assert.ok(lower > checked * 0.2, `most land and sea floor is lower (${lower}/${checked})`);
  assert.ok(higher < checked * 0.005, `almost nothing is higher in 1700 (${higher} skerry cells of ${checked})`);
  assert.ok(flipped > 0, 'some low land went under');
  assert.ok(land1700 < landT && land1700 > landT * 0.9, `land ${landT} -> ${land1700}: smaller, but the same coast`);
  console.log(`   land cells ${landT} -> ${land1700} (${flipped} drowned), of ${checked} sampled`);
});

await check('hidden rocks: the awash ones are gone from the surf layer but stay solid; today they are white surf rings', async () => {
  const hidden = e1700.shoalList.filter((s) => s.hidden);
  assert.equal(hidden.length, s1700.hiddenRockIds.size);
  assert.equal(e1700.shoalList.filter((s) => s.look.look === 'foam' && s.shoal.level === 'awash').length, 0, 'no awash rock keeps its surf ring in 1700');
  assert.ok(e1700.report.hiddenRocks > 20, `${e1700.report.hiddenRocks} hidden rocks are inside the window`);
  assert.equal(e1700.shoalLayer.foamCount, e1700.shoalList.filter((s) => !s.hidden && s.look.look === 'foam').length);
  assert.equal(e1700.hiddenLayer.count, e1700.report.hiddenRocks);
  assert.equal(eToday.shoalLayer.foamCount, eToday.shoalList.filter((s) => s.look.look === 'foam').length);
  assert.ok(eToday.shoalLayer.foamCount > e1700.shoalLayer.foamCount + 150, 'about 200 fewer surf rings in 1700');
  const h = e1700.report.hiddenRockList[0];
  assert.ok(e1700.sailHeightAt(h.x, h.z) >= 1.0, 'a hidden rock is still solid under the keel (the boat slides off it like land)');
  assert.ok(eToday.sailHeightAt(h.x, h.z) >= 1.0, 'it is the same rock today, awash');
  assert.ok(e1700.heightAt(h.x, h.z) < 0.5, 'the coast itself is sea there');
});

await check('1700 has no lighthouses and no modern marks; today has both', async () => {
  assert.equal(e1700.report.lights, 0); assert.ok(eToday.report.lights >= 1);
  assert.equal(e1700.seamarkLayer, null); assert.ok(eToday.seamarkLayer);
  const n1700 = names(e1700).join(' ').toLowerCase();
  assert.ok(!/light|lantern|buoy|beacon/.test(n1700), 'no lighthouse or buoy object in the 1700 scene');
  assert.equal(e1700.group.getObjectByName('seamarks'), undefined);
});

await check('1700 settlements follow the data: sizes, only on land, hamlets smaller than villages', async () => {
  const v = Object.fromEntries(e1700.report.villages.map((x) => [x.id, x]));
  assert.equal(Object.keys(v).length, s1700.settlements.length);
  for (const s of s1700.settlements) { assert.ok(v[s.id].placed >= Math.ceil(s.cottages * 0.7), `${s.name}: ${v[s.id].placed} of ${s.cottages} placed`); assert.ok(v[s.id].placed <= s.cottages); }
  assert.ok(v.lysekil.placed > v.grundsund.placed && v.gullholmen.placed > v.harmano.placed);
  let onLand = 0, total = 0;
  e1700.props.traverse((o) => { if (o.name === 'cottage' || o.name === 'boathouse' || o.name === 'racks') { total++; if (e1700.heightAt(o.position.x, o.position.z) >= 0.4) onLand++; } });
  assert.equal(onLand, total, 'every building stands on land');
  assert.equal(e1700.report.cottages, Object.values(v).reduce((n, x) => n + x.placed, 0));
  assert.ok(e1700.report.boathouses >= 2 && e1700.report.racks >= 1, 'the bigger villages get a sea-shed and racks');
});

await check('1700 kit: cairns and painted rocks at the marks, ekas moored and sailing; today has none of them', async () => {
  const n = names(e1700);
  assert.ok(n.includes('kummel') && n.includes('painted-rock'));
  assert.equal(n.filter((x) => x === 'kummel' || x === 'painted-rock').length, e1700.report.marks);
  assert.ok(e1700.report.marks >= 5);
  assert.equal(e1700.report.mooredEkas, s1700.boats.moored);
  assert.ok(e1700.report.sailingEkas >= 1, 'at least one working eka found a clear line');
  assert.ok(!names(eToday).some((x) => x === 'kummel' || x.startsWith('eka')));
});

await check('the 1700 labels carry only documented names; today carries the modern ones', async () => {
  const l = Object.fromEntries(e1700.labels.map((x) => [x.id, x]));
  assert.equal(l.karingon.text, 'Kierlingøon'); assert.equal(l.fiskebackskil.text, null);
  assert.ok(eToday.labels.some((x) => x.text === 'Gullholmen') && eToday.labels.length >= 5);
});

await check('Today is the game coast: its terrain equals what loadRealCoast would build (same heights, no offset)', async () => {
  const { buildCoastWorld } = await import('./coast-world.js');
  const ref = buildCoastWorld(files.coast, { skerries: files.skerries.skerries });
  (await import('./passes.js')).applyPasses(ref, files.passes, { tiers: (await import('./sea-truth.js')).GAME_PASS_TIERS }); // the game carves the real passes after building the world
  assert.equal(ref.H.length, eToday.world.H.length);
  for (let k = 0; k < ref.H.length; k += 997) assert.equal(ref.H[k], eToday.world.H[k]);
});

await check('animation: moored ekas ride the sea, the sailing ones move along their line', async () => {
  const ek = []; e1700.props.traverse((o) => { if (o.name === 'eka-sailing') ek.push(o); });
  const p0 = ek.map((o) => o.position.clone());
  for (let i = 0; i < 20; i++) e1700.update(spawnX(), spawnZ(), 0.5, i * 0.5, () => 0.1);
  assert.ok(ek.some((o, i) => o.position.distanceTo(p0[i]) > 3), 'a sailing eka moved');
  const moored = []; e1700.props.traverse((o) => { if (o.name === 'eka-moored') moored.push(o); });
  assert.ok(moored.every((o) => Math.abs(o.position.y - 0.05) < 1e-9), 'moored ekas follow the sea height');
  function spawnX() { return e1700.spawn.x; } function spawnZ() { return e1700.spawn.z; }
});

await check('placement helpers: nearestLand finds land, a hidden-rock layer has patches and four breaker groups', async () => {
  const l = nearestLand(e1700.world, ...e1700.world.toGame(11.3636, 58.1099));
  assert.ok(l && e1700.heightAt(l.x, l.z) >= 0.9);
  assert.equal(nearestLand(e1700.world, e1700.spawn.x, e1700.spawn.z, 12), null, 'open water: no land within 12 m');
  const layer = createHiddenRockLayer([{ x: 1, z: 2, look: { visualRadiusM: 3.4 } }, { x: 5, z: 5, look: { visualRadiusM: 3.4 } }]);
  assert.equal(layer.rings.length, 4); assert.equal(layer.patches.count, 2);
  layer.update(1.7); assert.ok(layer.rings.every((r) => r.mat.opacity >= 0 && r.mat.opacity <= 0.6));
  const a = placeVillages1700(e1700.world, s1700.settlements, 3), b = placeVillages1700(e1700.world, s1700.settlements, 3);
  assert.deepEqual(a.buildings.map((x) => [x.kind, Math.round(x.x), Math.round(x.z)]), b.buildings.map((x) => [x.kind, Math.round(x.x), Math.round(x.z)]), 'seeded: the same every time');
});

console.log(`\n${passed} checks passed`);
void root;
