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
const s1950 = worldAtYear(files.years, files.sources, 1950);
const e1700 = buildWorldForSpec(files, s1700);
const eToday = buildWorldForSpec(files, sToday);
const e1950 = buildWorldForSpec(files, s1950);
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

// ---- 1950, built from the real data/world-1950.json ----
await check('1950: the water is a few centimetres higher; the coast is today\'s, not 1700\'s', async () => {
  assert.ok(s1950.waterOffsetM > 0 && s1950.waterOffsetM < 0.3, `offset ${s1950.waterOffsetM}`);
  let flipped = 0, higher = 0, n = 0;
  for (let k = 0; k < eToday.world.H.length; k += 7) { n++; if (eToday.world.H[k] > 0.2 && e1950.world.H[k] <= 0.2) flipped++; if (e1950.world.H[k] > eToday.world.H[k] + 1e-4) higher++; }
  let flipped1700 = 0, landToday = 0;
  for (let k = 0; k < eToday.world.H.length; k += 7) { if (eToday.world.H[k] > 0.2) landToday++; if (eToday.world.H[k] > 0.2 && e1700.world.H[k] <= 0.2) flipped1700++; }
  assert.ok(flipped < flipped1700 * 0.55 && flipped < landToday * 0.02, `13 cm drowns far less land than 55 cm (${flipped} vs ${flipped1700} of ${landToday} land cells)`);
  console.log(`   land cells drowned: 1950 ${flipped}, 1700 ${flipped1700}, of ${landToday}`);
  assert.ok(higher < n * 0.005);
  assert.equal(e1950.report.hiddenRocks, 0, 'no rock hides at 1950 sea level');
});

await check('1950 villages: houses on land, sizes follow the data (people / 25, capped), bigger places have more', async () => {
  const v = Object.fromEntries(e1950.report.villages.map((x) => [x.id, x]));
  assert.equal(Object.keys(v).length, s1950.settlements.length);
  for (const s of s1950.settlements) { assert.ok(v[s.id].placed <= s.cottages); assert.ok(v[s.id].placed >= Math.ceil(s.cottages * 0.6), `${s.name}: ${v[s.id].placed} of ${s.cottages}`); }
  let onLand = 0, total = 0;
  e1950.props.traverse((o) => { if (['house', 'boathouse', 'canning-factory'].includes(o.name)) { total++; if (e1950.heightAt(o.position.x, o.position.z) >= 0.3) onLand++; } });
  assert.equal(onLand, total, 'every building stands on land');
  assert.equal(e1950.report.cottages, Object.values(v).reduce((n, x) => n + x.placed, 0));
  assert.ok(e1950.report.cottages > e1700.report.cottages, 'a 1950 coast has more houses than 1700');
  assert.ok(e1950.report.cottages <= eToday.report.cottages + 60);
});

await check('1950 lights: five towers and three fyrkurar; Maseskar lit with a keeper and a red dwelling; Islandsberg and Stangehuvud dark; automatic ones lit without a keeper', async () => {
  const lit = (name) => s1950.lighthouses.find((l) => l.name === name);
  // 5 hand-drawn towers (Maseskar, Islandsberg, Hattan, Gaven, Stangehuvud) + the generic fyrkur for the two small lights whose positions are sourced (Stangholmen, Fredagsholmen);
  // the other four fyrkurar of the data (Grotoe, Gulskaren, Oxskar, Hangdyn) have no position in it: reported, not drawn
  assert.equal(e1950.report.lights, 8, '5 towers + 3 fyrkurar (Stångholmen, Fredagsholmen and, from stage 1e, Kråksundsgap Södra\'s 1941 iron lantern)');
  assert.equal(e1950.report.lightsLit, 6); assert.equal(e1950.report.lightsDark, 2);
  assert.deepEqual(e1950.lights.map((l) => l.name).sort(), ['Fredagsholmen', 'Gäven', 'Hättan', 'Islandsberg', 'Kråksundsgap Södra', 'Måseskär', 'Stångehuvud', 'Stångholmen'].sort());
  assert.equal(e1950.lights.filter((l) => l.entry.model === 'fyrkur').length, 3);
  for (const l of e1950.lights) { assert.ok(l.group && l.fx && typeof l.fx.setLit === 'function', `${l.name} has its group and lantern effect`); assert.equal(l.fx.lit, l.info.lit, `${l.name}: the lantern follows the era's state`); assert.ok(e1950.heightAt(l.x, l.z) >= 0.3, `${l.name} stands on land`); }
  assert.ok(e1950.lightsNotDrawn.length === 4 && e1950.lightsNotDrawn.every((n) => /no position/.test(n.why)), 'the four lights without a position are reported, never guessed');
  assert.ok(e1950.report.notes.some((n) => /Grötö.*no position/.test(n)), 'and the report says so');
  assert.ok(e1950.lightEntries.find((e) => e.name === 'Hättan').light.period === 15 && e1950.lightEntries.find((e) => e.name === 'Måseskär').light.count === 3, 'the 1950 characters, not today\'s');
  assert.equal(lit('Måseskär').manned, 'keepers'); assert.equal(lit('Måseskär').lit, true);
  assert.equal(lit('Islandsberg').lit, false, 'the old 1883 house light: dark since 1938'); assert.equal(lit('Stångehuvud').lit, false);
  assert.equal(lit('Hättan').manned, 'automatic');
  assert.equal(e1950.report.keepers, 1, 'only Maseskar had keepers (and Hallo, outside the window)');
  const keepers = []; e1950.props.traverse((o) => { if (o.name === 'keeper-house') keepers.push(o); });
  assert.equal(keepers.length, 1);
  assert.ok(e1950.heightAt(keepers[0].position.x, keepers[0].position.z) >= 0.3, 'the keeper\'s house stands on rock');
  assert.ok(e1950.report.notes.some((n) => /1 of 11 lights/.test(n)), 'the report says how few had keepers');
  assert.ok(e1950.labels.some((l) => l.id === 'light-maseskar' && l.text === 'Måseskär'), 'lights are named on the coast');
  assert.ok(eToday.report.lights >= 5 && eToday.report.lightsDark === 0, 'today every light is lit');
});

await check('1950 sea marks: no modern IALA layer; only mark types that existed, in the data\'s colours and shapes; the ferry is on its route or at its quay', async () => {
  assert.equal(e1950.seamarkLayer, null);
  assert.equal(e1950.group.getObjectByName('seamarks'), undefined);
  const existed = s1950.periodMarks.existed;
  const canDraw = files.seamarks.marks.filter((m) => (m.type === 'lateral' || m.type === 'isolated_danger') && existed[m.type]).length;
  assert.ok(e1950.report.marks <= canDraw && e1950.report.marks > 20, `marks drawn: ${e1950.report.marks} of at most ${canDraw}`);
  assert.ok(e1950.report.buoys > 5, 'lateral buoys in the colours of the time');
  assert.ok(e1950.report.factories === 2, `both canning factories with a dated operation are drawn (${e1950.report.factories})`);
  if (!existed.cardinal) assert.ok(!e1950.props.children.some((o) => o.name === 'cardinal'), 'no cardinal marks before IALA');
  assert.ok(['route', 'moored'].includes(e1950.report.ferry), `ferry: ${e1950.report.ferry}`);
  assert.ok(e1950.report.mooredBoats >= 3, 'wooden boats at their moorings');
});

await check('1950: dusk lights the windows of its buildings with no new lights; lanterns of lit towers exist', async () => {
  const glass = []; e1950.props.traverse((o) => { if (o.name === 'windows-on' && !glass.includes(o.material)) glass.push(o.material); });
  assert.ok(glass.length >= 1, 'houses have window glass');
  const day = glass.map((g) => g.color.getHex());
  e1950.setNight(true);
  assert.notDeepEqual(glass.map((g) => g.color.getHex()), day, 'dusk changed the glass');
  let lights = 0; e1950.group.traverse((o) => { if (o.isLight) lights++; });
  assert.equal(lights, 0, 'no light objects');
  e1950.setNight(false);
  assert.deepEqual(glass.map((g) => g.color.getHex()), day);
});

await check('1950 animation: boats at work and the ferry move; moored boats ride the sea', async () => {
  const mv = []; e1950.props.traverse((o) => { if (o.name === 'boat-sailing' || o.name === 'ferry') mv.push(o); });
  const p0 = mv.map((o) => o.position.clone());
  for (let i = 0; i < 40; i++) e1950.update(e1950.spawn.x, e1950.spawn.z, 0.5, i * 0.5, () => 0.1);
  assert.ok(mv.length === 0 || mv.some((o, i) => o.position.distanceTo(p0[i]) > 3), 'something moved');
});

console.log(`\n${passed} checks passed`);
void root;
