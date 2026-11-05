// node games/windward/src/shore.test.js — guards land collision (src/shore.js): the boat can
// never enter land or a skerry, a head-on approach stops softly (no bounce), a glancing one
// slides along the shore, a boat already too close can leave, and shallow water slows a little.
import assert from 'node:assert/strict';
import { stepAlongShore, isBlocked, shallowFactor, hullHeight, BLOCK_H, SHALLOW_MIN_FACTOR } from './shore.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

// A straight coast: land to the east. Field rises 0.4 m per metre (like the coast's shelf), 0 at x = 0.
const straight = (x) => Math.max(-10, 0.4 * x);
const flat = (x, z) => straight(x);
// A round skerry of radius 6 m at (100, 0): a cone peaking at +1.3 m, sea floor -4 m.
const rock = (x, z) => Math.max(-4, 1.3 - 0.9 * Math.hypot(x - 100, z));

function sail(field, start, dir, steps, speed = 8, dt = 1 / 60) {
  let { x, z } = start;
  let worstContact = 0;
  const path = [{ x, z }];
  for (let i = 0; i < steps; i++) {
    const r = stepAlongShore(field, x, z, dir.x * speed * dt, dir.z * speed * dt);
    x = r.x;
    z = r.z;
    worstContact = Math.max(worstContact, r.contact);
    path.push({ x, z });
  }
  return { x, z, worstContact, path };
}

check('open water: the move is untouched and contact is 0', () => {
  const r = stepAlongShore(flat, -60, 0, 0.13, 0.05);
  assert.equal(r.x, -60 + 0.13);
  assert.equal(r.z, 0.05);
  assert.equal(r.contact, 0);
});

check('head-on into a straight coast: stops short of the land, never inside, contact near 1', () => {
  const r = sail(flat, { x: -40, z: 0 }, { x: 1, z: 0 }, 60 * 12);
  assert.ok(!isBlocked(flat, r.x, r.z), 'the hull stays out of the blocked band');
  assert.ok(hullHeight(flat, r.x, r.z) <= BLOCK_H + 1e-6);
  assert.ok(r.x < 0, `stopped before the shoreline (x=${r.x.toFixed(2)})`);
  assert.ok(r.worstContact > 0.95, `head-on contact ${r.worstContact}`);
  // no bounce: after arriving it never moves back out
  const tail = r.path.slice(-120);
  assert.ok(tail.every((p) => p.x >= tail[0].x - 1e-9), 'no bounce away from the shore');
});

check('a glancing approach slides along the shore instead of stopping', () => {
  // heading mostly north (+z) but 25 degrees into the coast
  const a = (25 * Math.PI) / 180;
  const r = sail(flat, { x: -8, z: 0 }, { x: Math.sin(a), z: Math.cos(a) }, 60 * 10);
  assert.ok(!isBlocked(flat, r.x, r.z));
  assert.ok(r.z > 40, `slid a long way along the coast (z=${r.z.toFixed(1)})`);
  assert.ok(r.worstContact > 0.1 && r.worstContact < 0.6, `grazing contact ${r.worstContact.toFixed(2)}`);
});

check('a round skerry: the boat never enters it, whichever way it sails at it', () => {
  for (let k = 0; k < 24; k++) {
    const ang = (k / 24) * Math.PI * 2;
    const start = { x: 100 + Math.sin(ang) * 40, z: Math.cos(ang) * 40 };
    const dir = { x: -Math.sin(ang), z: -Math.cos(ang) };
    const r = sail(rock, start, dir, 60 * 8);
    for (const p of r.path) assert.ok(!isBlocked(rock, p.x, p.z), `entered the skerry at ${p.x.toFixed(1)},${p.z.toFixed(1)}`);
    assert.ok(Math.hypot(r.x - 100, r.z) > 4.5, 'ends outside the rock (hull radius 2.5 m + the shallow rim)');
  }
});

check('random sailing near a coast and a skerry never ends up on land (5000 steps x 20 runs)', () => {
  const field = (x, z) => Math.max(flat(x, z), rock(x, z));
  let seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let run = 0; run < 20; run++) {
    let x = -30 + rnd() * 10;
    let z = (rnd() - 0.5) * 60;
    let heading = rnd() * Math.PI * 2;
    for (let i = 0; i < 5000; i++) {
      if (i % 90 === 0) heading += (rnd() - 0.5) * 2.2;
      const r = stepAlongShore(field, x, z, Math.sin(heading) * 0.15, Math.cos(heading) * 0.15);
      x = r.x;
      z = r.z;
      assert.ok(!isBlocked(field, x, z), `run ${run} step ${i}: on land at ${x.toFixed(1)},${z.toFixed(1)}`);
    }
  }
});

check('a boat already inside the blocked band can leave (spawn / teleport)', () => {
  assert.ok(isBlocked(flat, -3, 0));
  const out = stepAlongShore(flat, -3, 0, -0.2, 0);
  assert.ok(out.x < -3, 'moving away is allowed');
  const deeper = stepAlongShore(flat, -3, 0, 0.2, 0);
  assert.ok(deeper.x <= -3 + 1e-9, 'moving deeper into the land is not');
});

check('shallow water slows the boat a little but never stops it', () => {
  assert.equal(shallowFactor(() => -10, 0, 0), 1);
  const nearShore = shallowFactor(() => -1.0, 0, 0);
  assert.ok(nearShore >= SHALLOW_MIN_FACTOR && nearShore < 0.7, `shallowest factor ${nearShore}`);
  assert.ok(shallowFactor(() => -2, 0, 0) > nearShore && shallowFactor(() => -2, 0, 0) < 1);
});

console.log(`${passed} checks passed`);
