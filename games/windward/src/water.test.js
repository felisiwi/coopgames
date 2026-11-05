// node games/windward/src/water.test.js — guards the W0.7 low-poly sea:
// seaHeightCPU() (the JS mirror used to bob the boat in game.js) must stay
// within its boat-scale amplitude bound, return finite values everywhere,
// and stay in lockstep with the injected GLSL, since a mismatch would put
// the boat visibly off the sea it's drawn against.
import assert from 'node:assert/strict';
import {
  seaHeightCPU, SEA_HEIGHT_GLSL, glslFloat, WAVE_AMP, WAVE_LEN, WAVE_SPEED, SEG, SIZE, createWaveState, stepWaves,
  seaSlopeCPU, SEA_SLOPE_GLSL, WATER_VERTEX_GLSL, WATER_FRAGMENT_GLSL, createMarkState, stepMarks, markCoord, markDriftSpeed,
  createWater, waterSunDirection, WATER_LIGHT_ELEVATION_DEG,
} from './water.js';
import { CONFIG } from './config.js';

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

// --- Look Lab port (2026-11-05): smooth normals, wind marks, haze ----------------

check('seaSlopeCPU is the true derivative of seaHeightCPU (finite differences agree)', () => {
  const e = 1e-4;
  for (const windDir of [0, 0.7, 2.4, -1.3]) {
    for (const strength of [0, 0.5, 1]) {
      for (const [x, z, t] of [[0, 0, 0], [13.7, -8.2, 2.1], [-120, 75, 5.5], [310, 410, 0.3]]) {
        const ph = phasesAt(t, strength);
        const num = {
          x: (seaHeightCPU(x + e, z, ph, windDir, strength) - seaHeightCPU(x - e, z, ph, windDir, strength)) / (2 * e),
          z: (seaHeightCPU(x, z + e, ph, windDir, strength) - seaHeightCPU(x, z - e, ph, windDir, strength)) / (2 * e),
        };
        const got = seaSlopeCPU(x, z, ph, windDir, strength);
        assert.ok(Math.abs(got.x - num.x) < 1e-6 && Math.abs(got.z - num.z) < 1e-6, `at (${x},${z}) wind ${windDir}/${strength}: analytic (${got.x}, ${got.z}) vs numeric (${num.x}, ${num.z})`);
      }
    }
  }
});

check('the sea is gentle enough for smooth shading: slopes stay under ~0.25 even at full wind', () => {
  let max = 0;
  for (let x = -100; x <= 100; x += 7) for (let z = -100; z <= 100; z += 7) {
    const s = seaSlopeCPU(x, z, phasesAt(1.7, 1), 0.9, 1);
    max = Math.max(max, Math.hypot(s.x, s.z));
  }
  assert.ok(max < 0.25, `max slope ${max}`);
});

check('SEA_SLOPE_GLSL embeds the same amplitude formula, the same phases, and one cos term per wave component', () => {
  assert.ok(SEA_SLOPE_GLSL.includes(`float amp = ${glslFloat(WAVE_AMP)} * (0.3 + 0.7 * windStrength);`));
  assert.ok(SEA_SLOPE_GLSL.includes('vec4 phases'));
  assert.equal((SEA_SLOPE_GLSL.match(/cos\(d \*/g) ?? []).length, 4, 'one cos(d * freq + phase) per component');
  for (const lane of ['x', 'y', 'z', 'w']) assert.ok(SEA_SLOPE_GLSL.includes(`phases.${lane}`), `phases.${lane}`);
  assert.ok(WATER_VERTEX_GLSL.includes('seaHeight(') && WATER_VERTEX_GLSL.includes('seaSlope('), 'vertex shader uses both');
});

check('no shader reads absolute time: motion comes from accumulated state (the wobble rule)', () => {
  for (const [name, src] of [['vertex', WATER_VERTEX_GLSL], ['fragment', WATER_FRAGMENT_GLSL]]) {
    assert.ok(!/\buTime\b/.test(src), `${name} shader references uTime`);
    assert.ok(!/\bt \*/.test(src), `${name} shader multiplies by a time`);
  }
  assert.ok(WATER_FRAGMENT_GLSL.includes('uMarkOffset') && WATER_FRAGMENT_GLSL.includes('uRingPhase'), 'marks and foam use accumulated uniforms');
});

check('wind marks never jump when the wind strengthens or turns, even ten minutes in and far from the origin (control: the lab formula does)', () => {
  // Same scenario as the wave wobble test: boat held still, wind changes over
  // 10 s, starting 10 minutes in. The field coordinate AT THE BOAT must only
  // ever move by the drift speed (<= 12 m/s), never leap.
  const MAX_SPEED = markDriftSpeed(1) * 1.001;
  for (const [label, bx, bz, change] of [['strength', 0, 0, 's'], ['turn', 400, 0, 'd'], ['both', -300, 650, 'sd']]) {
    const state = createMarkState(1.0);
    for (let t = 0; t < 600; t += 0.1) stepMarks(state, 0.1, { dir: 1.0, strength: 0.4 }, bx, bz);
    const dt = 1 / 120;
    let prev = markCoord(state, 1.0, bx, bz);
    let worst = 0;
    for (let k = 0; k < 1200; k++) {
      const f = k / 1200;
      const wind = { dir: change.includes('d') ? 1.0 + f * 1.5 : 1.0, strength: change.includes('s') ? 0.4 + 0.6 * f : 0.4 };
      stepMarks(state, dt, wind, bx, bz);
      const cur = markCoord(state, wind.dir, bx, bz);
      worst = Math.max(worst, Math.hypot(cur.x - prev.x, cur.y - prev.y) / dt);
      prev = cur;
    }
    assert.ok(worst <= MAX_SPEED, `${label}: pattern at the boat moved ${worst.toFixed(1)} m/s (limit ${MAX_SPEED.toFixed(1)})`);
  }
  // Control: the lab's `uTime * (3 + 9 * wind)` drift, strength 0.4 -> 1.0 over 10 s at t = 600 s.
  const labDrift = (t, strength) => t * (3 + 9 * strength);
  const labSpeed = (labDrift(610, 1.0) - labDrift(600, 0.4)) / 10;
  assert.ok(labSpeed > 300, `control should show the old formula sliding at hundreds of m/s, got ${labSpeed.toFixed(0)}`);
});

check('foam ring phase stays in [0, 1) and advances at the lab rate', () => {
  const s = createMarkState(0);
  for (let i = 0; i < 20000; i++) stepMarks(s, 0.05, { dir: 0.3, strength: 0.6 }, 5, 5);
  assert.ok(s.ring >= 0 && s.ring < 1, `ring ${s.ring}`);
  const s2 = createMarkState(0);
  stepMarks(s2, 1, { dir: 0, strength: 0.5 }, 0, 0);
  assert.ok(Math.abs(s2.ring - 0.55) < 1e-9, `one second advances ${s2.ring}, expected 0.55`);
});

check('painted light bands use the game sun azimuth at the lab elevation, so a flat sea sits between the two bands', () => {
  const sun = waterSunDirection();
  assert.ok(Math.abs(sun.length() - 1) < 1e-9, 'unit vector');
  assert.ok(Math.abs(Math.asin(sun.y) * 180 / Math.PI - WATER_LIGHT_ELEVATION_DEG) < 1e-9);
  const az = Math.atan2(sun.x, sun.z) * 180 / Math.PI;
  assert.ok(Math.abs(az - CONFIG.LIGHT_AZIMUTH_DEG) < 1e-9, `azimuth ${az}`);
  assert.ok(sun.y > 0.36 && sun.y < 0.52, `flat-sea light ${sun.y} must sit between the 0.30-0.36 and 0.52-0.58 band edges`);
});

check('createWater builds in node, follows the boat in whole vertex steps, and scales haze with camera distance', () => {
  const water = createWater(null);
  const waves = createWaveState(0.5);
  const spacing = SIZE / SEG;
  const wind = { dir: 0.5, strength: 0.7 };
  water.update(waves, wind, { x: 100.3, y: 0, z: -57.9 }, 0.016, { x: 180, y: 120, z: 90 });
  const u = water.mesh.material.uniforms;
  assert.ok(Math.abs(water.mesh.position.x / spacing - Math.round(water.mesh.position.x / spacing)) < 1e-9, 'snapped to the vertex lattice');
  assert.equal(u.uWind.value, 0.7);
  const cam = Math.hypot(180 - 100.3, 120, 90 + 57.9);
  assert.ok(Math.abs(u.uHazeRange.value.x - cam * CONFIG.HAZE_WATER_NEAR_MUL) < 1e-6);
  assert.ok(Math.abs(u.uHazeRange.value.y - cam * CONFIG.HAZE_WATER_FAR_MUL) < 1e-6);
  assert.equal(u.uHazeStrength.value, CONFIG.HAZE_WATER_STRENGTH);
  // no camera given (island-lab): haze stays off
  const lab = createWater(null);
  lab.update(waves, wind, { x: 0, y: 0, z: 0 });
  assert.equal(lab.mesh.material.uniforms.uHazeStrength.value, 0);
});

console.log(`\n${passed}/${passed} assertions passed`);
