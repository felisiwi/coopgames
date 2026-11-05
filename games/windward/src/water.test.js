// node games/windward/src/water.test.js — guards the W0.7 low-poly sea:
// seaHeightCPU() (the JS mirror used to bob the boat in game.js) must stay
// within its boat-scale amplitude bound, return finite values everywhere,
// and stay in lockstep with the injected GLSL, since a mismatch would put
// the boat visibly off the sea it's drawn against.
import assert from 'node:assert/strict';
import { seaHeightCPU, SEA_HEIGHT_GLSL, glslFloat, WAVE_AMP, WAVE_LEN, WAVE_SPEED, SEG, SIZE, createWaveState, stepWaves } from './water.js';

// Phases a wave state would have after t seconds of steady wind (test helper).
const SPEED_MULS = [1.0, 1.35, -0.75, 1.9];
const START = [0, 1.7, 4.2, 2.9];
const phasesAt = (t, strength) => START.map((p0, i) => p0 + t * WAVE_SPEED * (0.4 + 0.6 * strength) * SPEED_MULS[i]);

let passed = 0;

function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

check('seaHeightCPU stays within +-WAVE_AMP at full wind strength, any position/time/wind dir', () => {
  for (const windDir of [0, 0.7, Math.PI, -2.1, 5.9]) {
    for (let x = -50; x <= 50; x += 12.5) {
      for (let z = -50; z <= 50; z += 12.5) {
        for (let t = 0; t < 6; t += 1.3) {
          const h = seaHeightCPU(x, z, phasesAt(t, 1), windDir, 1);
          assert.ok(Number.isFinite(h), `at (${x},${z},t=${t},wind=${windDir}) got non-finite ${h}`);
          assert.ok(Math.abs(h) <= WAVE_AMP + 1e-9, `at (${x},${z},t=${t},wind=${windDir}) got ${h}, expected within +-${WAVE_AMP}`);
        }
      }
    }
  }
});

check('seaHeightCPU never fully flattens at zero wind strength (min amplitude fraction)', () => {
  let maxAbs = 0;
  for (let x = -50; x <= 50; x += 10) {
    for (let t = 0; t < 6; t += 1) {
      maxAbs = Math.max(maxAbs, Math.abs(seaHeightCPU(x, 0, phasesAt(t, 0), 0.3, 0)));
    }
  }
  assert.ok(maxAbs > 0, 'expected some non-zero swell even at wind strength 0');
});

check('seaHeightCPU matches a from-scratch reimplementation of the same wave components', () => {
  const strength = 0.72;
  const windDirRad = 2.1;
  const DEG = Math.PI / 180;
  const COMPONENTS = [
    { weight: 0.4, angleOffsetDeg: 0, wavelengthMul: 1.0, speedMul: 1.0, phase: 0 },
    { weight: 0.25, angleOffsetDeg: 32, wavelengthMul: 0.6, speedMul: 1.35, phase: 1.7 },
    { weight: 0.2, angleOffsetDeg: -24, wavelengthMul: 1.4, speedMul: -0.75, phase: 4.2 },
    { weight: 0.15, angleOffsetDeg: 55, wavelengthMul: 0.8, speedMul: 1.9, phase: 2.9 },
  ];

  for (const [x, z, t] of [[0, 0, 0], [10, -5, 3.2], [-30, 40, 1.1], [5.5, 5.5, 4.9]]) {
    const amp = WAVE_AMP * (0.3 + 0.7 * strength);
    const speedScale = WAVE_SPEED * (0.4 + 0.6 * strength);
    let expected = 0;
    for (const c of COMPONENTS) {
      const angle = windDirRad + c.angleOffsetDeg * DEG;
      const d = x * Math.sin(angle) + z * Math.cos(angle);
      const freq = (2 * Math.PI) / (WAVE_LEN * c.wavelengthMul);
      expected += amp * c.weight * Math.sin(d * freq + t * (speedScale * c.speedMul) + c.phase);
    }
    const actual = seaHeightCPU(x, z, phasesAt(t, strength), windDirRad, strength);
    assert.ok(Math.abs(actual - expected) < 1e-9, `at (${x},${z},t=${t}) expected ${expected}, got ${actual}`);
  }
});

check('SEA_HEIGHT_GLSL embeds the exact same amplitude/speed formula as seaHeightCPU', () => {
  assert.ok(
    SEA_HEIGHT_GLSL.includes(`float amp = ${glslFloat(WAVE_AMP)} * (0.3 + 0.7 * windStrength);`),
    'shader amplitude formula does not match WAVE_AMP',
  );
  assert.ok(SEA_HEIGHT_GLSL.includes('vec4 phases'), 'shader must take the accumulated phases, not a time');
  assert.ok(!/\bt \*/.test(SEA_HEIGHT_GLSL), 'shader must not multiply by absolute time any more');
});

check('glslFloat always emits a valid GLSL float literal (decimal point present)', () => {
  for (const n of [0, 1, -1, 0.4, -2.1, 32 * (Math.PI / 180)]) {
    assert.ok(/^-?\d+\.\d+(e-?\d+)?$/.test(glslFloat(n)), `glslFloat(${n}) = "${glslFloat(n)}" is not a valid float literal`);
  }
});

check('vertex spacing is well under the shortest target wavelength (no aliasing)', () => {
  const spacing = SIZE / SEG;
  const shortestWavelength = WAVE_LEN * 0.6; // smallest wavelengthMul among WAVE_COMPONENTS
  assert.ok(spacing < shortestWavelength / 2, `spacing ${spacing}m too coarse for wavelength ${shortestWavelength}m`);
});

check('no fast wobble when the wind changes, however long you have played or how far you have sailed (2026-11-05)', () => {
  // Hold the boat still and change the wind over 10 s, starting 10 minutes in.
  // Before the fix: 4.9 cycles/s (strength rising) and 3.0 cycles/s (wind
  // turning, 400 m from the origin). A calm sea moves at ~0.1-0.3.
  for (const [label, x, z, change] of [['strength', 0, 0, 's'], ['turn', 400, 0, 'd'], ['both', -300, 650, 'sd']]) {
    const state = createWaveState(1.0);
    const dt = 1 / 240;
    for (let t = 0; t < 600; t += 0.1) stepWaves(state, 0.1, { dir: 1.0, strength: 0.4 }, x, z); // ten minutes of play
    let prev = null;
    let crossings = 0;
    for (let k = 0; k < 2400; k++) {
      const f = k / 2400;
      const wind = { dir: change.includes('d') ? 1.0 + f * 1.5 : 1.0, strength: change.includes('s') ? 0.4 + 0.6 * f : 0.4 };
      stepWaves(state, dt, wind, x, z);
      const h = seaHeightCPU(x, z, state.phases, wind.dir, wind.strength);
      if (prev !== null && Math.sign(h) !== Math.sign(prev)) crossings++;
      prev = h;
    }
    const cps = crossings / 2 / 10;
    assert.ok(cps < 0.6, `${label}: ${cps.toFixed(2)} wave cycles/s at the boat`);
  }
});

check('phases stay wrapped to [0, 2pi) so the shader never loses precision', () => {
  const state = createWaveState(0);
  for (let i = 0; i < 100000; i++) stepWaves(state, 0.05, { dir: i * 0.001, strength: 1 }, 1234, -987);
  for (const p of state.phases) assert.ok(p >= 0 && p < Math.PI * 2, `phase ${p}`);
});

console.log(`\n${passed}/${passed} assertions passed`);
