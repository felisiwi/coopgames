// node games/windward/src/phone.test.js — phone-control maths (the touch and
// drawing parts need a real phone; these are the bits that can be silently wrong).
import assert from 'node:assert/strict';
import { CONFIG } from './config.js';
import { headingTo, avoidNoGo, turnTowards, ropeTrim, boomAngle, wrapPi, ghostSpot } from './phone.js';
import { angleOffWind, leewardSign } from './sail.js';

const DEG = Math.PI / 180;
let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

check('aim: heading to a point matches the game\'s movement (x += sin h, z += cos h)', () => {
  for (const [dx, dz] of [[0, 10], [10, 0], [0, -10], [-7, 7]]) {
    const h = headingTo(0, 0, dx, dz);
    const d = Math.hypot(dx, dz);
    assert.ok(Math.abs(Math.sin(h) * d - dx) < 1e-9 && Math.abs(Math.cos(h) * d - dz) < 1e-9);
  }
});

check('aim never goes into the no-go zone; outside it, untouched', () => {
  const from = 1.0;
  for (let rel = -40; rel <= 40; rel += 1) {
    const out = avoidNoGo(from + rel * DEG, from);
    assert.ok(angleOffWind(out, from) >= 22.5 * DEG - 1e-9, `rel ${rel}`);
  }
  assert.equal(avoidNoGo(from + 90 * DEG, from), from + 90 * DEG);
});

check('turning takes the short way and stops on the target', () => {
  let h = 0;
  for (let i = 0; i < 100; i++) h = turnTowards(h, -170 * DEG, 0.016);
  assert.ok(Math.abs(wrapPi(h + 170 * DEG)) < 1e-9);
  assert.ok(turnTowards(0, 10 * DEG, 0.016) > 0); // left/right sign
});

check('rope: pulling away hauls in; letting back reaches fully out at the slack ring, never past it', () => {
  const slack = 100;
  assert.ok(ropeTrim(0.8, 300, 350, slack) < 0.8);
  assert.equal(ropeTrim(0.8, 300, slack, slack), CONFIG.TRIM_MAX); // fully out at the ring
  assert.equal(ropeTrim(0.8, 300, 20, slack), CONFIG.TRIM_MAX); // closer than the ring stays fully out
  assert.equal(ropeTrim(0.8, 300, 300, slack), 0.8); // no movement, no change
  assert.equal(ropeTrim(0.2, 300, 5000, slack), CONFIG.TRIM_MIN); // clamped hauled in
  // started almost on the ring: still a usable distance, not a hair trigger
  assert.ok(ropeTrim(0.4, 105, 95, slack) < CONFIG.TRIM_MAX);
});

check('sail angle: aft at zero trim, swung to leeward with trim (matches boat.js)', () => {
  const heading = 0.3;
  const from = heading + 90 * DEG; // wind on the starboard beam
  assert.ok(Math.abs(wrapPi(boomAngle(heading, from, 0) - (heading + Math.PI))) < 1e-9);
  const swing = wrapPi(boomAngle(heading, from, 40 * DEG) - (heading + Math.PI));
  assert.equal(Math.sign(swing), leewardSign(heading, from));
});

check('ghost thumb sits opposite the steering finger, on screen, and well away from it', () => {
  const W = 400, H = 800, bx = 200, by = 440;
  for (const [sx, sy] of [[360, 700], [40, 700], [360, 200], [40, 200], [200, 760], [380, 440]]) {
    const [gx, gy] = ghostSpot(bx, by, sx, sy, W, H);
    assert.ok(gx >= 0 && gx <= W && gy >= 0 && gy <= H, 'on screen');
    assert.ok(Math.hypot(gx - sx, gy - sy) > 180, `too close to the steering finger at ${sx},${sy}`);
    // on the other side of the boat from the finger
    assert.ok((gx - bx) * (sx - bx) + (gy - by) * (sy - by) < 0, `same side as the finger at ${sx},${sy}`);
  }
});

console.log(`\n${passed} passed`);
