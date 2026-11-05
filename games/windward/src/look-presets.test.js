// node games/windward/src/look-presets.test.js — guards the ?tune=1 look presets and URL format
// (look pass 2): Before/Skagen cover the same keys, the URL round-trips, bad input is ignored
// or clamped, and the panel can only ever be loaded on request.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { CONFIG } from './config.js';
import { LOOK_SPECS, LOOK_KEYS, BEFORE, SKAGEN, PRESETS, applyValues, parseLookParams, lookToSearch, cleanValue } from './look-presets.js';
import { SLIDERS } from './tune.js';
import { foamStrength, createFoamWind, stepFoamWind, FOAM_MIN, shallowSrgb } from './water.js';
import { PALETTE, refreshPalette } from './island-look.js';
import { createIsland, recolorTerrain, applyIslandLook } from './island.js';
import { scatterIslands } from './island-scatter.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }
const snapshot = () => Object.fromEntries(LOOK_KEYS.map((k) => [k, CONFIG[k]]));
const restore = (s) => { Object.assign(CONFIG, s); refreshPalette(); };
const start = snapshot();

check('Skagen is exactly what config.js says, and Before covers the same keys', () => {
  assert.deepEqual(Object.keys(BEFORE).sort(), LOOK_KEYS.slice().sort());
  assert.deepEqual(SKAGEN, start, 'Skagen must be captured from config.js');
  assert.deepEqual(Object.keys(PRESETS).sort(), ['before', 'skagen']);
  for (const k of LOOK_KEYS) assert.notEqual(cleanValue(k, BEFORE[k]), undefined, `Before.${k} out of its own range`);
  assert.ok(BEFORE.LOOK_SEA_SHALLOW !== SKAGEN.LOOK_SEA_SHALLOW && BEFORE.HEMI_INTENSITY !== SKAGEN.HEMI_INTENSITY, 'the two presets must differ');
});

check('Skagen follows the brief: pale sea-glass shallows (not turquoise), cool fill, sage meadow, pink-lilac granite', () => {
  const hue = (hex) => { const c = new THREE.Color(hex); const o = {}; c.getHSL(o, THREE.SRGBColorSpace); return o; };
  const shallow = hue(SKAGEN.LOOK_SEA_SHALLOW);
  const before = hue(BEFORE.LOOK_SEA_SHALLOW);
  assert.ok(shallow.s < before.s * 0.7, `shallow saturation ${shallow.s.toFixed(2)} vs before ${before.s.toFixed(2)}`);
  assert.ok(hue(SKAGEN.LOOK_MEADOW).s < hue(BEFORE.LOOK_MEADOW).s * 0.7, 'meadow is sage, not neon');
  assert.ok(SKAGEN.HEMI_INTENSITY > BEFORE.HEMI_INTENSITY * 3, 'the fill is much stronger than before (the real reason islands read dark)');
  assert.ok(hue(SKAGEN.LOOK_GRANITE).l > 0.75, 'granite is high-key');
  assert.equal(SKAGEN.LOOK_SEA_DEEP, 0x5f8fb0);
  assert.equal(SKAGEN.LOOK_SEA_SHALLOW, 0xa9d3cf);
  assert.equal(SKAGEN.LOOK_FOAM, 0xf4f6f2);
});

check('URL round trip: any set of values survives lookToSearch -> parseLookParams, and defaults are omitted', () => {
  assert.equal(lookToSearch('?seed=1&tune=1', SKAGEN), '?seed=1&tune=1', 'no overrides = nothing added');
  const values = { ...SKAGEN, LOOK_SHALLOW_SAT: 0.37, LOOK_GRANITE: 0xabcdef, HEMI_INTENSITY: 3.25, LOOK_FOAM_WIND_AMOUNT: 0 };
  const search = lookToSearch('?seed=1&tune=1', values);
  assert.ok(search.startsWith('?seed=1&tune=1'), 'keeps other params');
  assert.ok(/LOOK_GRANITE=abcdef/.test(search), search);
  assert.equal((search.match(/LOOK_/g) ?? []).length, 3, `only changed keys are written: ${search}`);
  assert.deepEqual(parseLookParams(search), { LOOK_SHALLOW_SAT: 0.37, LOOK_GRANITE: 0xabcdef, HEMI_INTENSITY: 3.25, LOOK_FOAM_WIND_AMOUNT: 0 });
  // a whole preset round-trips
  const back = { ...SKAGEN, ...parseLookParams(lookToSearch('', BEFORE)) };
  assert.deepEqual(back, BEFORE);
});

check('bad or hostile URL values are ignored or clamped; unknown keys never reach CONFIG', () => {
  const p = parseLookParams('?LOOK_GRANITE=zzzzzz&LOOK_SEA_DEEP=12345&LOOK_SHALLOW_SAT=abc&LOOK_SEA_BRIGHTNESS=99&HEMI_INTENSITY=-4&LOOK_MEADOW_TINT=&WAVE_AMP=50&__proto__=1');
  assert.deepEqual(p, { LOOK_SEA_BRIGHTNESS: LOOK_SPECS.LOOK_SEA_BRIGHTNESS.max, HEMI_INTENSITY: 0 });
  const target = { WAVE_AMP: 0.4 };
  assert.deepEqual(applyValues(target, { WAVE_AMP: 50, LOOK_FOAM: 0xffffff, LOOK_FOAM_WIND_AMOUNT: 7, LOOK_SAND: 'red', LOOK_WET: -1 }), ['LOOK_FOAM', 'LOOK_FOAM_WIND_AMOUNT']);
  assert.equal(target.WAVE_AMP, 0.4);
  assert.equal(target.LOOK_FOAM_WIND_AMOUNT, 1);
});

check('every slider edits a known numeric key with a usable range', () => {
  assert.equal(SLIDERS.length, 7);
  for (const s of SLIDERS) {
    const spec = LOOK_SPECS[s.key];
    assert.ok(spec && spec.type === 'num' && spec.max > spec.min, s.key);
    assert.ok(CONFIG[s.key] >= spec.min && CONFIG[s.key] <= spec.max, `${s.key} default ${CONFIG[s.key]} outside its slider`);
  }
  for (const k of ['LOOK_SHALLOW_SAT', 'LOOK_SEA_BRIGHTNESS', 'LOOK_ISLAND_BRIGHTNESS', 'LOOK_GRANITE_TINT', 'LOOK_MEADOW_TINT', 'HEMI_INTENSITY', 'LOOK_FOAM_WIND_AMOUNT']) assert.ok(SLIDERS.some((s) => s.key === k), `missing slider ${k}`);
});

check('the panel is never loaded without ?tune=1 (dynamic import only, behind the flag)', () => {
  const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
  assert.ok(!/^import .*tune\.js/m.test(game), 'game.js must not import tune.js statically');
  assert.ok(/if \(tuning\) import\('\.\/src\/tune\.js'\)/.test(game), 'tune.js is imported only when tuning');
  assert.ok(/get\('tune'\) === '1'/.test(game), 'the flag is exactly tune=1');
  assert.ok(/if \(tuning\) \{\s*applyValues/.test(game), 'URL look values apply only with tune=1');
});

check('foam: full strength in a breeze, weaker (never gone) in a calm, scaled by the amount, monotonic in wind', () => {
  assert.equal(foamStrength(0.9, 0.7), 1);
  assert.equal(foamStrength(0.0, 0), 1, 'amount 0 = ignores the wind');
  assert.ok(Math.abs(foamStrength(0.0, 1) - FOAM_MIN) < 1e-9);
  const calm = foamStrength(0.05, 0.7);
  assert.ok(calm > 0.6 && calm < 0.8, `calm foam ${calm} should be "a little weaker"`);
  let prev = 0;
  for (let w = 0; w <= 1; w += 0.02) { const f = foamStrength(w, 0.7); assert.ok(f >= prev - 1e-12 && f <= 1 + 1e-12, `w=${w}`); prev = f; }
});

check('foam follows an accumulated, filtered wind: a sudden wind jump moves the foam gradually, at any frame rate', () => {
  for (const dt of [1 / 30, 1 / 60, 1 / 144]) {
    const st = createFoamWind(0.1);
    let prevK = foamStrength(st.value, 1);
    let maxStep = 0;
    for (let t = 0; t < 12; t += dt) {
      stepFoamWind(st, dt, 1.0); // wind snaps from calm to full
      const k = foamStrength(st.value, 1);
      maxStep = Math.max(maxStep, Math.abs(k - prevK) / dt);
      prevK = k;
    }
    assert.ok(maxStep < 0.6, `foam changed ${maxStep.toFixed(2)} per second at dt=${dt.toFixed(4)}`);
    assert.ok(foamStrength(st.value, 1) > 0.99, 'and it settles');
  }
  // same filtered value whatever the frame rate (within 1%)
  const run = (dt) => { const s = createFoamWind(0.1); for (let t = 0; t < 3; t += dt) stepFoamWind(s, dt, 0.9); return s.value; };
  assert.ok(Math.abs(run(1 / 30) - run(1 / 144)) < 0.01);
});

check('shallow saturation: 0 is grey, 1 is the painted colour, more is more vivid', () => {
  const [r0, g0, b0] = shallowSrgb(0xa9d3cf, 0);
  assert.ok(Math.abs(r0 - g0) < 1e-9 && Math.abs(g0 - b0) < 1e-9, 'grey at 0');
  const one = shallowSrgb(0xa9d3cf, 1);
  assert.ok(Math.abs(one[0] - 0xa9 / 255) < 1e-9 && Math.abs(one[2] - 0xcf / 255) < 1e-9);
  const spread = (c) => Math.max(...c) - Math.min(...c);
  assert.ok(spread(shallowSrgb(0xa9d3cf, 1.4)) > spread(one) && spread(one) > spread(shallowSrgb(0xa9d3cf, 0.5)));
  for (const c of shallowSrgb(0x5cd1d1, 1.5)) assert.ok(c >= 0 && c <= 1);
});

check('live recolour: palette tints, island brightness and a repaint all take effect on a built island', () => {
  const isl = scatterIslands(1).find((i) => i.kind === 'medium');
  const { group } = createIsland(isl.seed, isl.params);
  const terrain = group.children[0];
  const col = terrain.geometry.getAttribute('color');
  const before = Array.from(col.array.slice(0, 3000));
  try {
    CONFIG.LOOK_GRANITE = 0x336699; CONFIG.LOOK_GRANITE_PALE = 0x336699; CONFIG.LOOK_MEADOW_TINT = 1; CONFIG.LOOK_ISLAND_BRIGHTNESS = 1.5; CONFIG.LOOK_PINE = 0xff0000;
    refreshPalette();
    assert.equal(PALETTE.granite.getHexString(), '336699');
    assert.equal(PALETTE.grass.getHexString(), new THREE.Color(CONFIG.LOOK_MEADOW_COOL).getHexString(), 'meadow tint 1 = the cool sage');
    recolorTerrain(terrain);
    assert.ok(col.array.slice(0, 3000).some((v, i) => Math.abs(v - before[i]) > 0.05), 'vertex colours changed');
    applyIslandLook(group);
    assert.equal(terrain.material.color.r, 1.5);
    const canopy = group.children[1].children[1];
    assert.ok(Math.abs(canopy.material.color.r - 1.5) < 1e-6 && canopy.material.color.g === 0, 'pines follow LOOK_PINE x brightness');
    for (let i = 0; i < col.count; i += 97) for (let k = 0; k < 3; k++) assert.ok(col.getComponent(i, k) >= 0 && col.getComponent(i, k) <= 1);
  } finally { restore(start); }
  assert.equal(PALETTE.granite.getHexString(), new THREE.Color(start.LOOK_GRANITE).getHexString(), 'palette restored');
});

check('islands are clearly lighter under Skagen than Before: shaded and lit ground both brighter', () => {
  // Lambert: colour * irradiance / pi. Compare the diffuse light a flat top and a slope facing away receive.
  const irradiance = (v, n) => {
    const sky = new THREE.Color(v.HEMI_SKY_COLOR); const gnd = new THREE.Color(v.HEMI_GROUND_COLOR); const sun = new THREE.Color(v.SUN_COLOR);
    const t = 0.5 * n.y + 0.5;
    const hemi = sky.clone().multiplyScalar(t).add(gnd.clone().multiplyScalar(1 - t)).multiplyScalar(v.HEMI_INTENSITY);
    const el = (v.LIGHT_ELEVATION_DEG * Math.PI) / 180, az = (CONFIG.LIGHT_AZIMUTH_DEG * Math.PI) / 180;
    const l = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    const lit = Math.max(0, n.dot(l));
    const total = hemi.add(sun.multiplyScalar(v.SUN_INTENSITY * lit));
    return (total.r + total.g + total.b) / 3 / Math.PI;
  };
  const flat = new THREE.Vector3(0, 1, 0);
  const away = new THREE.Vector3(-Math.sin(0.87) * 0.8, 0.6, -Math.cos(0.87) * 0.8).normalize(); // a slope turned from the sun
  const [fB, fS, aB, aS] = [irradiance(BEFORE, flat), irradiance(SKAGEN, flat), irradiance(BEFORE, away), irradiance(SKAGEN, away)];
  console.log(`  (light received: flat top ${fB.toFixed(2)} -> ${fS.toFixed(2)}, slope away from the sun ${aB.toFixed(2)} -> ${aS.toFixed(2)})`);
  assert.ok(fS > fB * 2.2 && aS > aB * 3, 'much brighter');
  assert.ok(aS > 0.4 && fS < 1.15, 'bright but not blown out');
  assert.ok(fS / aS > 1.25 && fS / aS < 2.5, `shadow side stays readable: lit/shaded ratio ${(fS / aS).toFixed(2)}`);
});

console.log(`\n${passed}/${passed} assertions passed`);
