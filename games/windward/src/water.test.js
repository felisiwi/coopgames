// node games/windward/src/water.test.js — guards the W0.7 low-poly sea:
// seaHeightCPU() (the JS mirror used to bob the boat in game.js) must stay
// within its boat-scale amplitude bound, return finite values everywhere,
// and stay in lockstep with the injected GLSL, since a mismatch would put
// the boat visibly off the sea it's drawn against.
import assert from 'node:assert/strict';
import { seaHeightCPU, SEA_HEIGHT_GLSL, glslFloat, WAVE_AMP, WAVE_LEN, WAVE_SPEED, SEG, SIZE } from './water.js';

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
          const h = seaHeightCPU(x, z, t, windDir, 1);
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
      maxAbs = Math.max(maxAbs, Math.abs(seaHeightCPU(x, 0, t, 0.3, 0)));
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
    const actual = seaHeightCPU(x, z, t, windDirRad, strength);
    assert.ok(Math.abs(actual - expected) < 1e-9, `at (${x},${z},t=${t}) expected ${expected}, got ${actual}`);
  }
});

check('SEA_HEIGHT_GLSL embeds the exact same amplitude/speed formula as seaHeightCPU', () => {
  assert.ok(
    SEA_HEIGHT_GLSL.includes(`float amp = ${glslFloat(WAVE_AMP)} * (0.3 + 0.7 * windStrength);`),
    'shader amplitude formula does not match WAVE_AMP',
  );
  assert.ok(
    SEA_HEIGHT_GLSL.includes(`float speedScale = ${glslFloat(WAVE_SPEED)} * (0.4 + 0.6 * windStrength);`),
    'shader speed formula does not match WAVE_SPEED',
  );
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

console.log(`\n${passed}/${passed} assertions passed`);
