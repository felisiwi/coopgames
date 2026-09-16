// node games/windward/src/wind.test.js — plain node, no DOM. Covers the
// W0.8 "wind model" item: hold-then-shift cadence, direction never jumping
// faster than the transition window allows, and bounded strength.
import assert from 'node:assert/strict';
import {
  initialWind,
  interpolateWind,
  createWindController,
  stepWindController,
} from './wind.js';
import { CONFIG } from './config.js';

const DEG = Math.PI / 180;
let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

function shortestAngleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

check('initialWind(seed) is deterministic (host and guest derive the same value)', () => {
  const a = initialWind(42);
  const b = initialWind(42);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, initialWind(43));
});

check('interpolateWind: t=0 is exactly `from`, t=1 is exactly `to`', () => {
  const from = { dir: 0.2, strength: 0.3 };
  const to = { dir: 2.5, strength: 0.9 };
  const at0 = interpolateWind(from, to, 0);
  const at1 = interpolateWind(from, to, 1);
  assert.ok(Math.abs(at0.dir - from.dir) < 1e-9 && Math.abs(at0.strength - from.strength) < 1e-9);
  assert.ok(Math.abs(at1.dir - to.dir) < 1e-9 && Math.abs(at1.strength - to.strength) < 1e-9);
});

check('interpolateWind: direction takes the shortest path across the 0/2PI wrap', () => {
  const from = { dir: 0.1, strength: 0.5 };
  const to = { dir: Math.PI * 2 - 0.1, strength: 0.5 }; // just short of a full turn the "long way"
  const mid = interpolateWind(from, to, 0.5);
  // shortest path from 0.1 to -0.1 (equivalent) is a tiny step backwards
  // through 0, not a near-full lap forward through PI.
  assert.ok(Math.abs(shortestAngleDelta(from.dir, mid.dir)) < 0.2, `got mid dir ${mid.dir}`);
});

check('hold/transition cadence: durations land inside their configured ranges', () => {
  let nowS = 0;
  let state = createWindController(1234, nowS);
  assert.equal(state.phase, 'hold');
  assert.ok(state.phaseDurationS >= CONFIG.WIND_HOLD_MIN_S && state.phaseDurationS <= CONFIG.WIND_HOLD_MAX_S);

  for (let i = 0; i < 20000; i++) {
    nowS += 0.25;
    const prevPhase = state.phase;
    state = stepWindController(state, nowS);
    if (state.phase !== prevPhase) {
      const range =
        state.phase === 'transition'
          ? [CONFIG.WIND_TRANSITION_MIN_S, CONFIG.WIND_TRANSITION_MAX_S]
          : [CONFIG.WIND_HOLD_MIN_S, CONFIG.WIND_HOLD_MAX_S];
      assert.ok(
        state.phaseDurationS >= range[0] && state.phaseDurationS <= range[1],
        `phase ${state.phase} duration ${state.phaseDurationS} outside [${range}]`,
      );
    }
  }
});

check('wind never changes direction faster than the transition window allows', () => {
  let nowS = 0;
  let state = createWindController(99, nowS);
  const dt = 1 / 30;
  let prevDir = state.current.dir;

  for (let i = 0; i < 60000; i++) {
    nowS += dt;
    state = stepWindController(state, nowS);
    const delta = Math.abs(shortestAngleDelta(prevDir, state.current.dir));
    // Smoothstep's steepest instantaneous rate is 1.5x the average rate
    // (peaks at t=0.5); bound generously against the shortest possible
    // transition duration, plus a small epsilon for float/step noise.
    const maxRatePerSecond = (1.5 * Math.PI) / CONFIG.WIND_TRANSITION_MIN_S;
    assert.ok(
      delta <= maxRatePerSecond * dt + 1e-6,
      `direction jumped ${(delta / DEG).toFixed(2)}deg in one step (max allowed ${((maxRatePerSecond * dt) / DEG).toFixed(2)}deg)`,
    );
    prevDir = state.current.dir;
  }
});

check('strength stays within [0, 1] even with transition noise', () => {
  let nowS = 0;
  let state = createWindController(7, nowS);
  for (let i = 0; i < 40000; i++) {
    nowS += 0.1;
    state = stepWindController(state, nowS);
    assert.ok(state.current.strength >= 0 && state.current.strength <= 1, `strength out of bounds: ${state.current.strength}`);
  }
});

console.log(`\n${passed}/${passed} assertions passed`);
