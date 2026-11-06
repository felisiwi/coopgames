// node games/windward/src/lure-data.test.js — guards the stage-1b place data against the REAL coast
// (assets/coast + data/place-names.json): Felix's confirmed harbours and pins are placed, descriptions
// attach to the right places, a same-named village/skerry pair is one place, and every village and harbour
// has open water inside its arrival circle (so the moment can actually be triggered by sailing).
// Loads the real 735 x 1197-cell window: about a second.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadCoast } from './coast-data.js';
import { buildCoastWorld, EDGE_FADE_M } from './coast-world.js';
import { LIGHTHOUSES } from './lighthouses.js';
import { buildNameList, createNameBook, displayName, NAME_RADIUS_M, SIGHT_EXTRA_M } from './names.js';
import { ARRIVAL, createArrivals } from './arrival.js';

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`ok - ${name}`);
}
const root = new URL('../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root));
const json = (p) => JSON.parse(read(p).toString('utf8'));

const coast = await loadCoast('assets/coast/', {
  json: async (u) => json(u),
  bytes: async (u) => new Uint8Array(read(u)),
}, ['north']);
const skerries = json('assets/coast/skerries.json').skerries;
const world = buildCoastWorld(coast, { skerries });
const namesJson = json('assets/coast/names.json');
const placeNames = json('data/place-names.json');
const settlements = json('data/settlements-history.json').settlements;
const list = buildNameList({ names: namesJson, villages: settlements, toGame: world.toGame, inside: (x, z) => world.inside(x, z, EDGE_FADE_M), placeNames, lights: LIGHTHOUSES });
// Described in the Map Lab but with no place on today's chart (no OSM entry found / outside the playable window).
const NO_PLACE_YET = ['Stora Kornö']; // (Stångehuvud and Islandsberg are placed since 1c: they are lighthouses)
const byName = (n) => list.filter((e) => e.name === n);

await check('Felix\'s confirmed near-matches and pins are all harbours on the chart', () => {
  for (const n of ['Testholmen', 'Dammholmen', 'Danholmen', 'Vrakevik', 'Kråkholmen', 'Grundsunds hamn']) {
    const e = byName(n);
    assert.equal(e.length, 1, `${n} appears exactly once`);
    assert.equal(e[0].kind, 'harbour', `${n} is a harbour`);
  }
});

await check('his pins sit exactly where he gave them (Vrakevik 58.238711 N 11.385059 E)', () => {
  const [x, z] = world.toGame(11.385059, 58.238711);
  const v = byName('Vrakevik')[0];
  assert.ok(Math.hypot(v.x - x, v.z - z) < 0.01);
  const h = placeNames.extraHarbours.find((e) => e.name === 'Kråkholmen');
  assert.equal(h.lat, 58.104431);
  assert.equal(h.lon, 11.439134);
});

await check('a village and a skerry of the same name are one place (Käringön, Gullholmen, Grundsund)', () => {
  for (const n of ['Käringön', 'Gullholmen']) {
    const e = byName(n);
    assert.equal(e.length, 1, `${n}: ${e.map((x) => x.kind)}`);
    assert.equal(e[0].kind, 'village');
  }
  assert.equal(byName('Dammholmen').length, 1, 'harbour and skerry of the same name: once');
});

await check('every description lands on the place it names; the one without a place yet is listed, not lost', () => {
  const described = list.filter((e) => e.desc).map((e) => `${e.name}=${e.desc}`).sort();
  const expected = Object.entries(placeNames.descriptions).filter(([n]) => !NO_PLACE_YET.includes(n)).map(([n, d]) => `${n}=${d}`).sort();
  assert.deepEqual(described, expected);
  assert.equal(Object.keys(placeNames.descriptions).length, 13);
  for (const n of NO_PLACE_YET) assert.ok(placeNames.descriptionNotes[n].includes('TODO(felix)'), `${n} is flagged for Felix`);
  for (const [n, d] of [['Gåsö', 'Goose Isle'], ['Grundsund', 'the shallow sound'], ['Hättan', 'the Hood'], ['Måseskär', 'the Gull Skerry']]) {
    assert.equal(byName(n)[0].desc, d, n);
  }
});

await check('every lighthouse inside the window is one place of kind "light" (not also a skerry), with its description', () => {
  const lights = list.filter((e) => e.kind === 'light');
  assert.ok(lights.length >= 6, `${lights.length} lighthouses on the chart: ${lights.map((l) => l.name).join(', ')}`);
  for (const l of lights) assert.equal(byName(l.name).length, 1, `${l.name} appears once`);
  for (const n of ['Hättan', 'Måseskär', 'Gäven', 'Islandsberg', 'Stångehuvud']) assert.equal(byName(n)[0].kind, 'light', `${n} is a lighthouse`);
  assert.equal(byName('Stångehuvud')[0].desc, 'the pole headland');
  assert.equal(byName('Islandsberg')[0].desc, 'the island hill');
});

await check('descriptive name first, real name with the description underneath once discovered', () => {
  const hood = byName('Hättan')[0];
  assert.deepEqual(displayName(hood, false), { title: 'the Hood', sub: null });
  assert.deepEqual(displayName(hood, true), { title: 'Hättan', sub: 'the Hood' });
  const unnamed = list.find((e) => !e.desc && e.kind === 'skerry');
  assert.deepEqual(displayName(unnamed, false), { title: null, sub: null }, 'a skerry without a description stays unnamed');
  // and through the name book: sighted from further out than discovered, each at most once
  const store = new Map();
  const book = createNameBook(list, { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) });
  const edge = hood.radius + SIGHT_EXTRA_M - 5;
  const sighted = book.sight(hood.x + edge, hood.z);
  assert.ok(sighted.some((e) => e.name === 'Hättan'), 'sighted at the outer distance');
  assert.equal(book.isKnown(hood.id), false, '...but not yet discovered');
  assert.deepEqual(book.sight(hood.x + edge, hood.z).filter((e) => e.name === 'Hättan'), [], 'sighted once');
  assert.ok(book.update(hood.x + 10, hood.z).some((e) => e.name === 'Hättan'), 'discovered when close');
  assert.deepEqual(book.sight(hood.x, hood.z), [], 'a discovered place is not sighted again');
});

await check('a place with no description is never sighted, only discovered', () => {
  const plain = list.find((e) => !e.desc && e.kind === 'skerry');
  const book = createNameBook(list, null);
  assert.ok(!book.sight(plain.x, plain.z).some((e) => e.id === plain.id));
  assert.ok(book.update(plain.x, plain.z).some((e) => e.id === plain.id));
});

await check('every village and harbour has open sea inside its arrival circle', () => {
  const rows = [];
  for (const p of createArrivals(list).places) {
    const reach = ARRIVAL.reachM[p.kind];
    let best = null;
    for (let r = 0; r <= reach && !best; r += 2) {
      for (let k = 0, n = Math.max(1, Math.round((2 * Math.PI * r) / 3)); k < n && !best; k++) {
        const a = (k / n) * 2 * Math.PI;
        const x = p.x + Math.sin(a) * r;
        const z = p.z + Math.cos(a) * r;
        if (world.heightAt(x, z) <= -1.0 && world.inside(x, z, 40)) best = r;
      }
    }
    rows.push(`${p.kind.padEnd(7)} ${p.name.padEnd(16)} open sea ${best === null ? 'NONE' : best + ' m'} from the point (reach ${reach})`);
    assert.notEqual(best, null, `${p.name} has no open sea within ${reach} m`);
  }
  console.log(rows.join('\n'));
});

console.log(`${passed} checks passed; ${list.length} places on the chart (${list.filter((e) => e.desc).length} described)`);
