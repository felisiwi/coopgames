// node games/windward/src/sail-feel-swell.test.js — swell and surfing (src/sail-feel-swell.js).
import assert from 'node:assert/strict';
import { SWELL, swellFor, exposureGain, swellHeight, swellTheta, swellPhaseUniform, surfBoost } from './sail-feel-swell.js';
import { timeOfHour, DAY_TYPES } from './weather.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }
const DEG = Math.PI / 180;
const at = (seed, type, hour) => swellFor(seed, type, timeOfHour(hour));
const headingOf = (sw, offDeg = 0) => Math.atan2(sw.tx, sw.tz) + offDeg * DEG; // heading with the swell (0 = straight downwind)

check('the swell comes from the west-ish open sea, travelling east; deterministic per seed, fixed through the day', () => {
  for (const type of DAY_TYPES) {
    const a = at(3, type, 8); const b = at(3, type, 20);
    assert.ok(a.dirDeg > 220 && a.dirDeg < 285, `${type}: from ${a.dirDeg.toFixed(0)} deg`);
    assert.equal(a.dirDeg, b.dirDeg, 'direction fixed for the day');
    assert.equal(a.k, b.k, 'length fixed for the day (crests stay continuous)');
    assert.ok(Math.abs(Math.hypot(a.tx, a.tz) - 1) < 1e-9);
    assert.ok(a.tx > 0, 'travels east, away from the west');
  }
  assert.notEqual(at(3, 'sea-breeze', 8).dirDeg, at(4, 'sea-breeze', 8).dirDeg);
});

check('the swell\'s height follows the sea state: bigger after the afternoon blow than on a calm morning, within the limits', () => {
  const calm = at(2, 'sea-breeze', 7).amp; const blown = at(2, 'sea-breeze', 17).amp;
  assert.ok(calm < blown, `${calm.toFixed(2)} -> ${blown.toFixed(2)}`);
  assert.ok(calm >= SWELL.AMP_MIN_M && blown <= SWELL.AMP_MAX_M);
  assert.ok(blown > 0.55, 'a proper roll on a fresh day');
  assert.ok(at(2, 'misty-morning', 8).amp < 0.3, 'a glassy low swell in the misty calm');
});

check('flat in among the skerries, the whole swell outside: height scales with exposure', () => {
  const sw = at(2, 'sea-breeze', 16);
  assert.equal(exposureGain(0), 0); assert.equal(exposureGain(SWELL.EXPOSURE_FROM), 0); assert.equal(exposureGain(1), 1);
  let maxIn = 0; let maxOut = 0;
  for (let x = 0; x < 100; x += 0.5) { maxIn = Math.max(maxIn, Math.abs(swellHeight(sw, x, 0, 0, 0.1))); maxOut = Math.max(maxOut, Math.abs(swellHeight(sw, x, 0, 0, 1))); }
  assert.equal(maxIn, 0, 'inside: dead flat');
  assert.ok(Math.abs(maxOut - sw.amp) < 0.02, `outside: ${maxOut.toFixed(2)} m of ${sw.amp.toFixed(2)}`);
  assert.ok(exposureGain(0.6) > 0 && exposureGain(0.6) < 1, 'the edge of the skerries: in between');
});

check('crests travel along the swell direction at the swell speed, and repeat every LENGTH_M', () => {
  const sw = at(2, 'sea-breeze', 16);
  const crestAt = (t) => { for (let s = 0; s < SWELL.LENGTH_M; s += 0.01) { if (Math.abs(swellTheta(sw, s * sw.tx, s * sw.tz, t) % (2 * Math.PI) - Math.PI / 2) < 0.004) return s; } return null; };
  const s0 = crestAt(0); const s1 = crestAt(1);
  assert.ok(s0 !== null && s1 !== null);
  const moved = ((s1 - s0) % SWELL.LENGTH_M + SWELL.LENGTH_M) % SWELL.LENGTH_M;
  assert.ok(Math.abs(moved - SWELL.SPEED_MS) < 0.05, `crest moved ${moved.toFixed(2)} m in 1 s`);
  const h = (s) => swellHeight(sw, s * sw.tx, s * sw.tz, 0, 1);
  assert.ok(Math.abs(h(3) - h(3 + SWELL.LENGTH_M)) < 1e-9, 'periodic in space');
});

check('the shader phase uniform matches the CPU formula (height = amp x E x sin(k s + uniform)), even many hours in', () => {
  const sw = at(2, 'sea-breeze', 16);
  for (const t of [0, 1.5, 977, 123456.789]) {
    const x = 1234.5; const z = 8011.25;
    const viaUniform = Math.sin(sw.k * (x * sw.tx + z * sw.tz) + swellPhaseUniform(sw, t));
    assert.ok(Math.abs(viaUniform - Math.sin(swellTheta(sw, x, z, t))) < 1e-6, `t=${t}`);
  }
  assert.ok(swellPhaseUniform(sw, 1e6) >= 0 && swellPhaseUniform(sw, 1e6) < 2 * Math.PI);
});

check('surfing: a burst down the front of a crest on a run or broad reach, only outside, only when moving, only with the swell', () => {
  const sw = at(2, 'sea-breeze', 16);
  const find = (want) => { let best = null; for (let s = 0; s < SWELL.LENGTH_M; s += 0.05) { const b = surfBoost(sw, headingOf(sw, 0), s * sw.tx, s * sw.tz, 0, 1, 7); if (best === null || want(b, best.b)) best = { s, b }; } return best; };
  const top = find((b, c) => b > c); const none = find((b, c) => b < c);
  assert.ok(top.b > 1.5 && top.b <= SWELL.SURF_MAX_MS + 1e-9, `best spot: +${top.b.toFixed(2)} m/s`);
  assert.equal(none.b, 0, 'on the back of a crest: nothing');
  const P = { x: top.s * sw.tx, z: top.s * sw.tz };
  assert.equal(surfBoost(sw, headingOf(sw, 0), P.x, P.z, 0, 0.1, 7), 0, 'inside the skerries: nothing');
  assert.equal(surfBoost(sw, headingOf(sw, 0), P.x, P.z, 0, 1, 0.5), 0, 'not moving: not caught');
  assert.equal(surfBoost(sw, headingOf(sw, 90), P.x, P.z, 0, 1, 7), 0, 'beam on to the swell: nothing');
  assert.equal(surfBoost(sw, headingOf(sw, 180), P.x, P.z, 0, 1, 7), 0, 'against the swell: nothing');
  assert.ok(surfBoost(sw, headingOf(sw, 30), P.x, P.z, 0, 1, 7) > 0.8 * top.b, 'a broad reach (30 off dead downwind) still surfs');
  assert.ok(surfBoost(sw, headingOf(sw, 55), P.x, P.z, 0, 1, 7) < top.b * 0.6, 'wider angles surf less');
});

check('a bigger swell gives a bigger burst, and the boat that outruns the wave rides each front for a few seconds (it surges, not constantly)', () => {
  const big = at(2, 'sea-breeze', 17); const small = at(2, 'misty-morning', 8);
  const best = (sw) => { let m = 0; for (let s = 0; s < SWELL.LENGTH_M; s += 0.05) m = Math.max(m, surfBoost(sw, headingOf(sw, 0), s * sw.tx, s * sw.tz, 0, 1, 7)); return m; };
  assert.ok(best(big) > best(small) + 0.5, `${best(small).toFixed(2)} < ${best(big).toFixed(2)}`);
  // a boat at 8 m/s straight downwind through a 6.4 m/s swell: the boost is on for roughly a third of the time
  const sw = big; let on = 0; let total = 0; let s = 0;
  for (let t = 0; t < 120; t += 0.05) { s += 8 * 0.05; if (surfBoost(sw, headingOf(sw, 0), s * sw.tx, s * sw.tz, t, 1, 8) > 0.3) on++; total++; }
  assert.ok(on / total > 0.15 && on / total < 0.6, `riding ${(100 * on / total).toFixed(0)}% of the time`);
});

console.log(`${passed} swell checks passed`);
