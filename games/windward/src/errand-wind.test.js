// node games/windward/src/errand-wind.test.js: the first errand's scripted wind (src/errand-wind.js): behind you out to Grundsund, behind you home, handed back at the yard.
import assert from 'node:assert/strict';
import { errandWindFor, createErrandWind, bearing } from './errand-wind.js';
import { angleOffWind, speedFactor, boatSpeed } from './sail.js';
import { PHASES } from './beats-1950.js';
import { CONFIG } from './config.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }
const DEG = Math.PI / 180;
const YARD = { x: 120, z: -340 }, GRUND = { x: -800, z: 900 }; // not axis-aligned on purpose
const P = { yard: YARD, grundsund: GRUND };
const NORMAL = { dir: 1.0, strength: 0.4 };
const angDiff = (a, b) => Math.abs(((a - b + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);

check('the wind per phase: dead astern along the line out and along the line home; normal (null) in every other phase', () => {
  const out = errandWindFor('errand', P), home = errandWindFor('return', P);
  assert.ok(Math.abs(angleOffWind(bearing(YARD, GRUND), out.dir) - Math.PI) < 1e-9, 'out: 180 deg off the wind');
  assert.ok(Math.abs(angleOffWind(bearing(GRUND, YARD), home.dir) - Math.PI) < 1e-9, 'home: 180 deg off the wind');
  assert.ok(angDiff(out.dir, home.dir) > 3.1, 'the two winds are opposite');
  assert.equal(out.strength, CONFIG.ERRAND_WIND_STRENGTH); assert.equal(home.strength, CONFIG.ERRAND_WIND_STRENGTH);
  for (const ph of PHASES) if (ph !== 'errand' && ph !== 'return') assert.equal(errandWindFor(ph, P), null, ph);
  assert.equal(errandWindFor('errand', { yard: null, grundsund: GRUND }), null, 'no positions: no script');
  assert.equal(errandWindFor(null, P), null, 'no beats (Today / ?year=2015): no script');
});

check('on the real line the boat sails dead downwind at the scripted strength: the speed the report quotes', () => {
  const out = errandWindFor('errand', P);
  const v = boatSpeed(bearing(YARD, GRUND), out.dir, out.strength, null);
  assert.ok(Math.abs(v - 10 * (0.7 > 0.6 ? 0.7 : 0) * speedFactor(Math.PI)) < 1e-9, `dead downwind at 0.7: ${v}`);
  assert.ok(v > 5 && v < 6, `~5.6 m/s: ${v}`);
});

check('a save loaded at ANY phase gets the right wind from the first frame (no blend); help / free / find get the normal wind exactly', () => {
  for (const ph of PHASES) {
    const w = createErrandWind(P);
    const got = w.step(ph, 500, NORMAL);
    const want = errandWindFor(ph, P) || NORMAL;
    assert.deepEqual(got, want, `phase ${ph} at frame 1`);
    assert.equal(w.blending, false, `${ph}: nothing blending at frame 1`);
  }
  // ?jump=britta lands on 'help', a save past the yard on 'help'/'free', ?year=2015 has no beats (null): all normal from frame 1
  for (const ph of ['help', 'free', null]) assert.deepEqual(createErrandWind(P).step(ph, 1, NORMAL), NORMAL);
});

check('holding a phase keeps the wind steady (scripted stays put; normal follows the normal controller exactly)', () => {
  const w = createErrandWind(P); const first = w.step('errand', 0, NORMAL);
  for (let t = 0.1; t < 30; t += 0.1) assert.deepEqual(w.step('errand', t, { dir: t, strength: 0.9 }), first, 'errand ignores the normal wind');
  const n = createErrandWind(P); n.step('help', 0, NORMAL);
  for (let t = 0.1; t < 30; t += 0.1) { const nw = { dir: 2 + t / 10, strength: 0.5 }; assert.deepEqual(n.step('help', t, nw), nw); }
});

check('the turn at Grundsund: errand -> return swings over SWING_S, smoothly (no snap), ending exactly behind the way home', () => {
  const w = createErrandWind(P); const start = w.step('errand', 100, NORMAL); // t = 100 s on the game clock
  const home = errandWindFor('return', P);
  let prev = start, maxStep = 0, sawBlend = false;
  for (let t = 100.05; t <= 100 + CONFIG.ERRAND_WIND_SWING_S + 1; t += 0.05) {
    const cur = w.step('return', t, NORMAL);
    maxStep = Math.max(maxStep, angDiff(cur.dir, prev.dir));
    if (w.blending) sawBlend = true;
    prev = cur;
  }
  assert.ok(sawBlend, 'blending was reported (the host broadcasts fast while it is true)');
  assert.equal(w.blending, false, 'done afterwards');
  assert.ok(angDiff(prev.dir, home.dir) < 1e-9 && prev.strength === home.strength, 'ends exactly on the wind behind the way home');
  assert.ok(maxStep < 0.12, `no snap: biggest step per 50 ms was ${maxStep.toFixed(3)} rad (a 180 deg swing in 4 s peaks near 0.09)`);
  const mid = createErrandWind(P); mid.step('errand', 0, NORMAL); const m = mid.step('return', 0.0, NORMAL);
  assert.deepEqual(m, errandWindFor('errand', P), 'at the instant of the change nothing has moved yet');
});

check('the hand-back at the yard: return -> help eases to the normal controller over SWING_S, ending on it, no snap', () => {
  const w = createErrandWind(P); const s = w.step('return', 0, NORMAL);
  const first = w.step('help', 10, NORMAL);
  assert.deepEqual(first, s, 'no snap at the instant of the hand-back');
  let prev = first, maxStep = 0;
  for (let t = 10.05; t <= 10 + CONFIG.ERRAND_WIND_SWING_S + 1; t += 0.05) { const cur = w.step('help', t, NORMAL); maxStep = Math.max(maxStep, angDiff(cur.dir, prev.dir), Math.abs(cur.strength - prev.strength)); prev = cur; }
  assert.deepEqual(prev, NORMAL, 'ends exactly on the normal wind');
  assert.ok(maxStep < 0.12, `no snap: ${maxStep.toFixed(3)}`);
  assert.equal(w.blending, false);
});

check('a pause does not eat the swing: the swing runs on the clock it is given (frozen clock = frozen wind)', () => {
  const w = createErrandWind(P); w.step('errand', 50, NORMAL);
  const a = w.step('return', 50, NORMAL), b = w.step('return', 50, NORMAL), c = w.step('return', 50, NORMAL);
  assert.deepEqual(a, b); assert.deepEqual(b, c);
});

check('OFF_STERN_DEG moves the wind off dead astern (the dial for a broad reach)', () => {
  const was = CONFIG.ERRAND_WIND_OFF_STERN_DEG;
  try {
    CONFIG.ERRAND_WIND_OFF_STERN_DEG = 40;
    const out = errandWindFor('errand', P);
    const off = angleOffWind(bearing(YARD, GRUND), out.dir) / DEG;
    assert.ok(Math.abs(off - 140) < 1e-6, `140 deg off the wind: ${off}`);
  } finally { CONFIG.ERRAND_WIND_OFF_STERN_DEG = was; }
});

console.log(`\n${passed} checks passed`);
