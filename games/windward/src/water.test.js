// node games/windward/src/water.test.js — guards the W0.6 boat-scale wave
// fix: waveHeight() (the JS mirror used to bob the boat in game.js) must
// stay within the ±0.5m boat-scale bound, and must stay in lockstep with
// VERTEX_SHADER's GLSL, since a mismatch would put the boat visibly off the
// sea it's drawn against.
import assert from 'node:assert/strict';
import { waveHeight, windLocalDir, WAVE_CONFIG, VERTEX_SHADER, glslFloat } from './water.js';

let passed = 0;

function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

const MAX_AMP = WAVE_CONFIG.AMP_BASE + WAVE_CONFIG.AMP_STRENGTH;

check('max amplitude is boat-scale (<=0.5m), not W0.5\'s boat-submerging 4.4m', () => {
  assert.ok(MAX_AMP <= 0.5 + 1e-9, `expected AMP_BASE+AMP_STRENGTH <= 0.5, got ${MAX_AMP}`);
});

check('waveHeight stays within +-0.5m at full wind strength, any position/time', () => {
  const dir = windLocalDir(0.7);
  for (let x = -50; x <= 50; x += 12.5) {
    for (let z = -50; z <= 50; z += 12.5) {
      for (let t = 0; t < 6; t += 1.3) {
        const h = waveHeight(x, z, t, 1, dir);
        assert.ok(Math.abs(h) <= MAX_AMP + 1e-9, `at (${x},${z},t=${t}) got ${h}, expected within +-${MAX_AMP}`);
      }
    }
  }
});

check('waveHeight matches a from-scratch reimplementation of the same WAVE_CONFIG', () => {
  const strength = 0.72;
  const windDirRad = 2.1;
  const dir = windLocalDir(windDirRad);

  for (const [x, z, t] of [[0, 0, 0], [10, -5, 3.2], [-30, 40, 1.1], [5.5, 5.5, 4.9]]) {
    const amp = WAVE_CONFIG.AMP_BASE + strength * WAVE_CONFIG.AMP_STRENGTH;
    const d = x * dir.x + -z * dir.y;
    let expected = 0;
    for (const c of WAVE_CONFIG.COMPONENTS) {
      expected += amp * c.weight * Math.sin(d * c.freq + t * c.speed + c.phase);
    }
    const actual = waveHeight(x, z, t, strength, dir);
    assert.ok(Math.abs(actual - expected) < 1e-9, `at (${x},${z},t=${t}) expected ${expected}, got ${actual}`);
  }
});

check('VERTEX_SHADER embeds the exact same WAVE_CONFIG amplitude/component constants', () => {
  assert.ok(
    VERTEX_SHADER.includes(`float amp = ${glslFloat(WAVE_CONFIG.AMP_BASE)} + uWindStrength * ${glslFloat(WAVE_CONFIG.AMP_STRENGTH)};`),
    'shader amplitude formula does not match WAVE_CONFIG.AMP_BASE/AMP_STRENGTH',
  );
  for (const c of WAVE_CONFIG.COMPONENTS) {
    const term = `h += amp * ${glslFloat(c.weight)} * sin(d * ${glslFloat(c.freq)} + uTime * ${glslFloat(c.speed)} + ${glslFloat(c.phase)});`;
    assert.ok(VERTEX_SHADER.includes(term), `shader is missing/mismatched component term: ${term}`);
  }
});

check('glslFloat always emits a valid GLSL float literal (decimal point present)', () => {
  for (const n of [0, 1, -1, 0.55, -2.1, 4.2]) {
    assert.ok(/^-?\d+\.\d+$/.test(glslFloat(n)), `glslFloat(${n}) = "${glslFloat(n)}" is not a valid float literal`);
  }
});

check('windLocalDir returns a unit vector for any angle', () => {
  for (const rad of [0, 0.3, Math.PI / 2, Math.PI, -1.7, 5.9]) {
    const dir = windLocalDir(rad);
    const len = Math.hypot(dir.x, dir.y);
    assert.ok(Math.abs(len - 1) < 1e-9, `at ${rad} expected unit length, got ${len}`);
  }
});

console.log(`\n${passed}/${passed} assertions passed`);
