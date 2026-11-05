// node games/windward/src/arrival.test.js — guards harbour arrival (src/arrival.js) and the fish deck (src/deck.js).
// (That every real harbour can be reached lives in lure-data.test.js, which loads the real coast.)
import assert from 'node:assert/strict';
import { createArrivals, giftFor, ARRIVAL, FISH_KINDS } from './arrival.js';
import { createDeck, DECK_KEY, DECK_SLOTS } from './deck.js';

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
const places = [
  { id: 'village:Vik', name: 'Vik', kind: 'village', x: 0, z: 0 },
  { id: 'harbour:Hamn', name: 'Hamn', kind: 'harbour', x: 1000, z: 0 },
  { id: 'osm/1', name: 'Skär', kind: 'skerry', x: 0, z: 1000 },
];
const SLOW = ARRIVAL.maxSpeed - 0.5;
const FAST = 7;

check('sailing slowly into a harbour triggers the moment, once', () => {
  const a = createArrivals(places);
  a.update(500, 0, SLOW, 0); // outside everything: arms the village
  assert.deepEqual(a.update(60, 0, SLOW, 1).map((p) => p.name), ['Vik']);
  assert.deepEqual(a.update(20, 0, SLOW, 2), [], 'not again while still inside');
});

check('sailing through fast does not trigger; easing off inside does', () => {
  const a = createArrivals(places);
  a.update(500, 0, FAST, 0);
  assert.deepEqual(a.update(50, 0, FAST, 1), [], 'too fast');
  assert.deepEqual(a.update(40, 0, SLOW, 2).map((p) => p.name), ['Vik'], 'slowed down inside the reach');
});

check('villages and natural harbours have their own reach; skerries never arrive', () => {
  const a = createArrivals(places);
  a.update(500, 500, SLOW, 0);
  assert.deepEqual(a.update(1000, 60, SLOW, 1), [], 'a harbour reaches less far than a village (60 m is outside its 45 m)');
  assert.deepEqual(a.update(1000, 40, SLOW, 2).map((p) => p.name), ['Hamn']);
  assert.deepEqual(a.update(0, 1000, SLOW, 3), [], 'a skerry is not a harbour');
  assert.equal(a.places.length, 2);
});

check('after arriving: leave, wait out the cooldown, come back, and it fires again', () => {
  const a = createArrivals(places);
  a.update(500, 0, SLOW, 0);
  assert.equal(a.update(30, 0, SLOW, 1).length, 1);
  assert.deepEqual(a.update(200, 0, SLOW, 10), [], 'left');
  assert.deepEqual(a.update(30, 0, SLOW, 20), [], 'back inside, but the cooldown (90 s) has not passed');
  a.update(200, 0, SLOW, 100); // out again, past the re-arm distance
  assert.equal(a.update(30, 0, SLOW, 101).length, 1, 'cooldown over and re-armed');
});

check('hovering just outside the reach never re-arms early (needs 1.8 x the reach)', () => {
  const a = createArrivals(places);
  a.update(500, 0, SLOW, 0);
  a.update(30, 0, SLOW, 1);
  a.update(100, 0, SLOW, 200); // 100 m > reach 70 but < 1.8 x 70 = 126
  assert.deepEqual(a.update(30, 0, SLOW, 300), [], 'still disarmed');
});

check('starting inside a harbour (the spawn) is not a welcome', () => {
  const a = createArrivals(places);
  assert.deepEqual(a.update(40, 0, 0, 0), [], 'spawned inside, standing still');
  assert.deepEqual(a.update(30, 0, 0, 5), []);
  a.update(300, 0, SLOW, 10); // leaves
  assert.equal(a.update(30, 0, SLOW, 11).length, 1, 'but a real arrival later works');
});

check('each harbour has its own fish, always the same one', () => {
  for (const p of places) {
    const g = giftFor(p);
    assert.ok(FISH_KINDS.includes(g.kind));
    assert.equal(g.from, p.id);
    assert.deepEqual(giftFor(p), g);
  }
});

check('the deck fills in order, then replaces the oldest fish', () => {
  const d = createDeck(memoryStorage());
  assert.equal(d.count(), 0);
  for (let i = 0; i < DECK_SLOTS; i++) assert.equal(d.add({ kind: 'cod', from: `h${i}` }), i);
  assert.equal(d.count(), DECK_SLOTS);
  assert.equal(d.add({ kind: 'herring', from: 'new' }), DECK_SLOTS - 1, 'full: lands in the last slot');
  assert.deepEqual(d.fish.map((f) => f.from), ['h1', 'h2', 'h3', 'new'], 'h0, the oldest, is gone');
});

check('the deck is remembered on this device; blocked or corrupt storage never breaks it', () => {
  const store = memoryStorage();
  createDeck(store).add({ kind: 'cod', from: 'village:Vik' });
  assert.ok(store._m.get(DECK_KEY).includes('village:Vik'));
  assert.equal(createDeck(store).count(), 1, 'a new session sees the fish');
  store.setItem(DECK_KEY, '{not json');
  assert.equal(createDeck(store).count(), 0);
  store.setItem(DECK_KEY, JSON.stringify([{ kind: 1 }, null, { kind: 'cod', from: 'x' }]));
  assert.equal(createDeck(store).count(), 1, 'malformed entries dropped');
  const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const d = createDeck(blocked);
  assert.equal(d.add({ kind: 'cod', from: 'a' }), 0);
  assert.equal(createDeck(null).add({ kind: 'cod', from: 'a' }), 0, 'no storage at all');
});

console.log(`${passed} checks passed`);
