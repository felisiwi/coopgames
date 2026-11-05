// node games/windward/src/harbour-moment.test.js — guards the harbour moment (src/harbour-moment.js): a person
// appears on the shore and waves, a fish flies to the deck and lands in a visible slot that rides with the boat,
// the bell / gulls / splash are asked for, and the deck is restored from the device next session.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { createHarbourMoment, shorePointNear, tossPosition, MOMENT_S, TOSS_AT_S, DECK_SLOTS_LOCAL } from './harbour-moment.js';
import { createDeck, DECK_SLOTS } from './deck.js';
import { createArrivals, giftFor } from './arrival.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}
const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};
// A quay: dry land (1.2 m) east of x = 100, sea everywhere else.
const heightAt = (x) => (x > 100 ? 1.2 : -4);
const makeAudio = () => {
  const calls = [];
  return { calls, arrival: (k) => calls.push(`arrival:${k}`), plop: () => calls.push('plop') };
};
function setup(store = memoryStorage()) {
  const scene = new THREE.Scene();
  const boatGroup = new THREE.Group();
  scene.add(boatGroup);
  const deck = createDeck(store);
  const audio = makeAudio();
  const moment = createHarbourMoment({ THREE, scene, boatGroup, heightAt, deck, audio });
  return { scene, boatGroup, deck, audio, moment, store };
}
const place = { id: 'village:Vik', name: 'Vik', kind: 'village', x: 110, z: 0 };

check('the shore point is dry land near the boat, or null in open sea', () => {
  const p = shorePointNear(heightAt, 80, 0);
  assert.ok(p && p.x > 100 && p.y === 1.2 && p.distM >= 20 && p.distM <= 60, JSON.stringify(p));
  assert.equal(shorePointNear(() => -4, 0, 0), null);
});

check('a tossed fish goes from the hand to the deck in an arc', () => {
  const a = { x: 0, y: 2, z: 0 };
  const b = { x: 10, y: 0.5, z: 0 };
  assert.deepEqual(tossPosition(a, b, 0), a);
  assert.deepEqual(tossPosition(a, b, 1), b);
  assert.ok(tossPosition(a, b, 0.5).y > 3, 'flies higher than both ends');
});

check('arrival: the bell sounds, the person waves for 9 s, the fish lands in slot 0 and stays', () => {
  const { scene, boatGroup, deck, audio, moment } = setup();
  const person = scene.children.find((c) => c.isGroup && c !== boatGroup);
  assert.equal(person.visible, false, 'nobody before an arrival');
  moment.trigger(place, giftFor(place), { x: 80, z: 0 }, 0);
  assert.deepEqual(audio.calls, ['arrival:village']);
  assert.equal(deck.count(), 1, 'the gift is stored at once (a reload mid-toss keeps it)');
  moment.update(0.016, 0.5);
  assert.equal(person.visible, true);
  assert.ok(person.position.x > 100, 'standing on the quay');
  assert.equal(moment.stats.flying, 0, 'not thrown yet');
  assert.equal(boatGroup.children.filter((c) => c.children.length).length, 0, 'nothing on the deck yet');
  moment.update(0.016, TOSS_AT_S + 0.1);
  assert.equal(moment.stats.flying, 1, 'the fish is in the air');
  for (let t = TOSS_AT_S + 0.1; t < TOSS_AT_S + 3; t += 0.05) moment.update(0.05, t);
  assert.equal(moment.stats.flying, 0);
  assert.deepEqual(audio.calls, ['arrival:village', 'plop']);
  const slot0 = boatGroup.children[0];
  assert.equal(slot0.children.length, 1, 'a fish lies in the first deck slot');
  assert.deepEqual([slot0.position.x, slot0.position.y, slot0.position.z], DECK_SLOTS_LOCAL[0]);
  moment.update(0.016, MOMENT_S + 1);
  assert.equal(person.visible, false, 'the person goes after the moment');
  assert.equal(slot0.children.length, 1, 'but the fish stays');
});

check('the deck fills over several harbours, then replaces the oldest; fish ride with the boat', () => {
  const { boatGroup, deck, moment } = setup();
  let t = 0;
  for (let i = 0; i < DECK_SLOTS + 1; i++) {
    moment.trigger({ ...place, id: `village:V${i}` }, { kind: ['cod', 'herring', 'mackerel', 'flounder', 'cod'][i], from: `village:V${i}` }, { x: 80, z: 0 }, t);
    for (let k = 0; k < 80; k++) { t += 0.05; moment.update(0.05, t); }
    t += 20;
  }
  assert.equal(deck.count(), DECK_SLOTS);
  const kinds = boatGroup.children.map((s) => s.children[0] && s.children[0].material.color.getHex());
  assert.equal(kinds.length, DECK_SLOTS);
  assert.ok(kinds.every((k) => typeof k === 'number'), 'every slot has a fish');
  boatGroup.position.set(50, 0, 50);
  boatGroup.updateMatrixWorld(true);
  const world = new THREE.Vector3();
  boatGroup.children[0].getWorldPosition(world);
  assert.ok(Math.abs(world.x - (50 + DECK_SLOTS_LOCAL[0][0])) < 1e-6, 'the slot moves with the boat');
});

check('next session: fish already on the deck are shown straight away', () => {
  const first = setup();
  first.moment.trigger(place, giftFor(place), { x: 80, z: 0 }, 0);
  const second = setup(first.store);
  assert.equal(second.deck.count(), 1);
  assert.equal(second.boatGroup.children[0].children.length, 1);
});

check('no shore nearby: no person, the fish still arrives', () => {
  const scene = new THREE.Scene();
  const boatGroup = new THREE.Group();
  scene.add(boatGroup);
  const deck = createDeck(memoryStorage());
  const moment = createHarbourMoment({ THREE, scene, boatGroup, heightAt: () => -4, deck, audio: makeAudio() });
  moment.trigger(place, giftFor(place), { x: 0, z: 0 }, 0);
  for (let t = 0; t < 6; t += 0.05) moment.update(0.05, t);
  assert.equal(moment.stats.personShown, false);
  assert.equal(boatGroup.children[0].children.length, 1);
});

check('end to end: sailing slowly into a harbour gives the fish; sailing past fast does not', () => {
  const { boatGroup, deck, moment } = setup();
  const arrivals = createArrivals([place]);
  let now = 0;
  const sail = (x, speed) => {
    now += 0.5;
    for (const p of arrivals.update(x, 0, speed, now)) moment.trigger(p, giftFor(p), { x, z: 0 }, now);
    moment.update(0.5, now);
  };
  for (let x = 0; x < 120; x += 6) sail(x, 8); // flies past at 8 m/s
  assert.equal(deck.count(), 0);
  arrivals.update(400, 0, 1, now += 1);
  for (let x = 300; x > 60; x -= 6) sail(x, 2); // eases in
  assert.equal(deck.count(), 1);
  void boatGroup;
});

console.log(`${passed} checks passed`);
