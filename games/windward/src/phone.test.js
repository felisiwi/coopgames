// node games/windward/src/phone.test.js — phone-control maths (the touch and
// drawing parts need a real phone; these are the bits that can be silently wrong).
import assert from 'node:assert/strict';
import { CONFIG } from './config.js';
import { headingTo, avoidNoGo, turnTowards, ropeTrim, boomAngle, wrapPi, ghostSpot, ropeGeom, ropeHit, swipeTrim, ropeScrollStep, ROPE_STRIPE_PERIOD, ropeNeed, ropeGuideStep, SECOND_FINGER_SHEET, ROPE_HIT_HALF_W } from './phone.js';
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
check('rope: the stripes run with the swipe (down = pulling in, up = letting out) and ease to a stop after you let go', () => {
  const down = ropeScrollStep(0, 300, 0.1, true);
  assert.ok(Math.abs(down.offset - 3) < 1e-9, 'a downward run of 300 px/s for 0.1 s moves the stripes 30 px = 3 px past a whole period');
  assert.equal(ropeScrollStep(2, 100, 0.01, true).offset > 2, true);
  assert.equal(ropeScrollStep(2, -100, 0.01, true).offset < 2, true, 'up moves them up');
  let o = 4; let v = 400;
  const held = ropeScrollStep(o, v, 0.016, true);
  assert.equal(held.vel, 400, 'while the finger is on the rope the run keeps its speed');
  let t = 0; let prev = Math.abs(v);
  for (let i = 0; i < 200; i++) { ({ offset: o, vel: v } = ropeScrollStep(o, v, 0.016, false)); t += 0.016; assert.ok(Math.abs(v) <= prev + 1e-9, 'only slows down'); prev = Math.abs(v); }
  assert.equal(v, 0, 'and stops');
  assert.ok(t < 4);
  const stopped = ropeScrollStep(5, 0, 0.5, false);
  assert.equal(stopped.offset, 5, 'at rest the stripes sit still');
  for (const off of [-30, 0, 4, 12345]) { const r = ropeScrollStep(off, 50, 0.1, true).offset; assert.ok(r >= 0 && r < ROPE_STRIPE_PERIOD, 'offset stays within one period'); }
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

check('rope guidance: the arrows say which way to trim, and are gone when trimmed', () => {
  const ideal = 0.7;
  assert.equal(ropeNeed(1.3, ideal), -1, 'sail too far out: pull in (sheet in, down)');
  assert.equal(ropeNeed(0.1, ideal), 1, 'sail too far in: let out (ease, up)');
  assert.equal(ropeNeed(0.7, ideal), 0, 'trimmed');
  assert.equal(ropeNeed(0.7 + 0.13, ideal), 0, 'inside the window (8 degrees) still counts as trimmed');
  assert.equal(ropeNeed(0.7 + 0.2, ideal), -1, 'just outside it does not');
  let g = 1;
  for (let i = 0; i < 40; i++) g = ropeGuideStep(g, true, 0.016);
  assert.equal(g, 0, 'faded out once trimmed');
  assert.ok(ropeGuideStep(1, true, 0.016) < 1 && ropeGuideStep(1, true, 0.016) > 0.9, 'a gentle fade, not a cut');
  for (let i = 0; i < 40; i++) g = ropeGuideStep(g, false, 0.016);
  assert.equal(g, 1, 'and back when the sail drifts off the trim');
});
console.log(`\n${passed} passed`);
