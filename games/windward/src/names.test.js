// node games/windward/src/names.test.js — guards name discovery (src/names.js): nothing is named
// until the boat is near, each name is found once, it is remembered on the device (and the game
// carries on if storage is blocked), and the real names.json accounts for all 15 of Felix's harbours.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildNameList, createNameBook, NAME_RADIUS_M, STORAGE_KEY } from './names.js';
import { labelScreenPos, createLabelQueue } from './name-labels.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}
const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m };
};
const entries = [
  { id: 'a', name: 'Alpha', kind: 'island', x: 0, z: 0, radius: NAME_RADIUS_M.island },
  { id: 'b', name: 'Beta', kind: 'skerry', x: 500, z: 0, radius: NAME_RADIUS_M.skerry },
  { id: 'c', name: 'Gamma', kind: 'harbour', x: 0, z: 800, radius: NAME_RADIUS_M.harbour },
];

check('nothing is named until the boat is near', () => {
  const book = createNameBook(entries, memoryStorage());
  assert.deepEqual(book.update(2000, 2000), []);
  assert.equal(book.count(), 0);
  assert.equal(book.isKnown('a'), false);
});

check('a name is found when the boat comes within its distance, once only', () => {
  const book = createNameBook(entries, memoryStorage());
  assert.deepEqual(book.update(210, 0).map((e) => e.name), ['Alpha'], 'island found at 210 m');
  assert.deepEqual(book.update(0, 0), [], 'not announced a second time');
  assert.equal(book.isKnown('a'), true);
});

check('reach depends on the kind: an island is seen from further than a skerry', () => {
  const book = createNameBook(entries, memoryStorage());
  assert.deepEqual(book.update(500, 150), [], 'skerry 150 m away is not seen yet (110 m)');
  assert.deepEqual(book.update(500, 100).map((e) => e.name), ['Beta']);
});

check('names are remembered on this device across sessions', () => {
  const store = memoryStorage();
  createNameBook(entries, store).update(0, 0);
  assert.ok(store._m.get(STORAGE_KEY).includes('"a"'));
  const next = createNameBook(entries, store); // a new session
  assert.equal(next.isKnown('a'), true);
  assert.deepEqual(next.update(0, 0), [], 'already known: not shown again');
  assert.equal(next.update(0, 800).length, 1, 'but new places are still discovered');
});

check('remembered ids that no longer exist are dropped; corrupt storage starts fresh', () => {
  const store = memoryStorage();
  store.setItem(STORAGE_KEY, JSON.stringify(['a', 'gone']));
  assert.equal(createNameBook(entries, store).count(), 1);
  store.setItem(STORAGE_KEY, '{not json');
  assert.equal(createNameBook(entries, store).count(), 0);
});

check('blocked storage (private mode) never breaks discovery', () => {
  const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const book = createNameBook(entries, blocked);
  assert.equal(book.update(0, 0).length, 1);
  assert.equal(createNameBook(entries, null).update(0, 0).length, 1, 'no storage at all');
});

check('buildNameList keeps only places inside the region and gives each kind its reach', () => {
  const list = buildNameList({
    names: {
      islands: [{ osm: 'relation/1', name: 'In', kind: 'island', lon: 1, lat: 1 }, { osm: 'relation/2', name: 'Out', kind: 'skerry', lon: 99, lat: 99 }],
      harbours: [{ name: 'Hav', lon: 2, lat: 2 }],
    },
    villages: [{ name: 'Vik', lon: 3, lat: 3 }, { name: 'NoCoords' }],
    toGame: (lon, lat) => [lon * 10, lat * 10],
    inside: (x) => x < 100,
  });
  assert.deepEqual(list.map((e) => `${e.kind}:${e.name}`), ['island:In', 'harbour:Hav', 'village:Vik']);
  assert.equal(list[1].radius, NAME_RADIUS_M.harbour);
  assert.equal(list[2].id, 'village:Vik');
});

check('labels clamp inside the screen so an off-screen island still shows its name', () => {
  assert.deepEqual(labelScreenPos(0, 0, 400, 800), { x: 200, y: 400 });
  const p = labelScreenPos(5, -5, 400, 800);
  assert.ok(p.x <= 360 && p.y >= 0 && p.y <= 720, JSON.stringify(p));
});

check('label queue: at most 3 at once, staggered, villages and harbours before skerries, stale ones dropped', () => {
  const q = createLabelQueue();
  const item = (name, kind) => ({ entry: { name, kind } });
  for (const [n, k] of [['s1', 'skerry'], ['s2', 'skerry'], ['isl', 'island'], ['vil', 'village'], ['har', 'harbour'], ['s3', 'skerry']]) q.push(item(n, k), 0);
  assert.equal(q.pop(0, 0).entry.name, 'vil', 'village first');
  assert.equal(q.pop(0.3, 1), null, 'staggered: too soon after the last one');
  assert.equal(q.pop(1, 1).entry.name, 'har');
  assert.equal(q.pop(2, 2).entry.name, 'isl');
  assert.equal(q.pop(3, 3), null, 'three already showing');
  assert.equal(q.pop(3, 2).entry.name, 's1', 'then skerries, in the order found');
  assert.equal(q.pop(20, 0), null, 'everything left was stale (waited > 8 s) and is dropped');
  assert.equal(q.size, 0);
});

check('names.json accounts for all 15 of Felix\'s harbours, and the spawn is Grundsunds hamn', () => {
  const data = JSON.parse(fs.readFileSync(new URL('../assets/coast/names.json', import.meta.url), 'utf8'));
  const felix = ['Rammen', 'Bredholmen', 'Skarvesäter', 'Usholmen', 'Testholmarna-Usholmen', 'DammholmeSkären', 'Porsholmen', 'Västra Danholmen', 'Kråkesundsgap', 'Altarholmen', 'Skaboholmen', 'Smörasken', 'Assholmen', 'Jonsborg', 'Vasholmarna'];
  const placed = data.harbours.map((h) => h.name);
  const unplaced = data.unplaced.map((u) => u.name);
  assert.deepEqual([...placed, ...unplaced].sort(), [...felix].sort(), 'every harbour is placed or listed as unplaced, none twice');
  for (const h of data.harbours) assert.ok(h.lat >= data.region.s && h.lat <= data.region.n && h.lon >= data.region.w && h.lon <= data.region.e, `${h.name} inside the region`);
  for (const u of data.unplaced) assert.ok(u.reason, `${u.name} has a reason`);
  assert.equal(data.spawn.name, 'Grundsunds hamn');
  assert.ok(data.islands.length > 200);
});

console.log(`${passed} checks passed`);
