// node games/windward/src/phone.test.js — phone-control maths (the touch and
// drawing parts need a real phone; these are the bits that can be silently wrong).
import assert from 'node:assert/strict';
import { CONFIG } from './config.js';
import { headingTo, avoidNoGo, turnTowards, ropeTrim, boomAngle, wrapPi, ghostSpot, ropeGeom, ropeHit, ropeSlack, ropeSag, swipeTrim, SECOND_FINGER_SHEET, ROPE_HIT_HALF_W } from './phone.js';
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

// ---- the rope control (1c phone test, refined: a small rope, swiped)
const phoneGeom = ropeGeom(390, 844);
check('rope: swipe down = pull in (trim down), swipe up = let out, relative to where the trim is now', () => {
  assert.ok(swipeTrim(0.8, 40, phoneGeom) < 0.8, 'down sheets in');
  assert.ok(swipeTrim(0.8, -40, phoneGeom) > 0.8, 'up lets out');
  assert.equal(swipeTrim(0.8, 0, phoneGeom), 0.8, 'no movement, no change: nothing jumps on touch');
  const range = CONFIG.TRIM_MAX - CONFIG.TRIM_MIN;
  assert.ok(Math.abs(swipeTrim(CONFIG.TRIM_MAX, phoneGeom.len, phoneGeom) - CONFIG.TRIM_MIN) < 1e-9, 'one rope length of swipe is the whole range');
  assert.equal(swipeTrim(0.3, 5000, phoneGeom), CONFIG.TRIM_MIN, 'clamped at fully in');
  assert.equal(swipeTrim(0.3, -5000, phoneGeom), CONFIG.TRIM_MAX, 'clamped at fully out');
  assert.ok(Math.abs(swipeTrim(0.5, 10, phoneGeom) - swipeTrim(swipeTrim(0.5, 4, phoneGeom), 6, phoneGeom)) < 1e-9, 'a swipe adds up the same in parts');
  assert.ok(range > 0);
});
check('rope: it shows the trim by its shape: taut and straight when sheeted in, sagging when eased', () => {
  assert.equal(ropeSag(CONFIG.TRIM_MIN, phoneGeom), 0, 'sheeted in: no sag');
  assert.ok(ropeSag(CONFIG.TRIM_MAX, phoneGeom) > 20, 'eased right out: a deep curve');
  assert.ok(ropeSag(CONFIG.TRIM_MAX, phoneGeom) < phoneGeom.len / 4, 'but still a rope, not a loop');
  let last = -1;
  for (let t = CONFIG.TRIM_MIN; t <= CONFIG.TRIM_MAX + 1e-9; t += 0.1) { const v = ropeSag(t, phoneGeom); assert.ok(v >= last); last = v; }
  assert.equal(ropeSlack(CONFIG.TRIM_MIN), 0);
  assert.equal(ropeSlack(CONFIG.TRIM_MAX), 1);
});
check('rope: small to look at, thumb-sized to touch, on screen on small and large phones; the rest of the screen is not the rope', () => {
  assert.ok(ROPE_HIT_HALF_W * 2 >= 80, 'at least 80 px wide to touch');
  for (const [W, H] of [[390, 844], [360, 640], [430, 932], [320, 568]]) {
    const g = ropeGeom(W, H);
    assert.ok(g.len <= 190 && g.len >= 140, 'a short rope: little screen space');
    assert.ok(g.x + ROPE_HIT_HALF_W <= W + 1 && g.y0 - 34 >= 0 && g.y1 + 34 <= H, `${W}x${H} fits`);
    assert.ok(g.x > W * 0.7, 'bottom right');
    assert.equal(ropeHit(g, g.x, (g.y0 + g.y1) / 2), true);
    assert.equal(ropeHit(g, g.x - 40, g.y1 + 20), true, 'a thumb a little off the thin line still has it');
    assert.equal(ropeHit(g, W / 2, (g.y0 + g.y1) / 2), false, 'steering anywhere else is steering');
    assert.equal(ropeHit(g, g.x, g.y0 - 80), false, 'above the rope is the water');
  }
});
check('the second-finger sheet is off for now (only the rope and the keyboard trim)', () => {
  assert.equal(SECOND_FINGER_SHEET, false);
});

console.log(`\n${passed} passed`);
