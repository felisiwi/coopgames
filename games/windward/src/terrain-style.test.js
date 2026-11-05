// node games/windward/src/terrain-style.test.js — the mask / threshold / rule maths of terrain-style.js.
// (The GLSL in that file mirrors these functions; the lab page checks the shader compiles and renders.)
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import {
  ZONES, ZONE_OF_CLASS, SLOPE_CAP, blur121, bakeZoneMasks, bakeSlopeMap, sharesFromTexel, edgeHalfWidth, slopeHalfWidth, topTwo, signedGap, zoneWeights,
  slopeTan, slopeTanFromDeg, steepAmount, applySteep, terraceParts, riserAmount, riserFacing, riserWidthPx, terraceFade, lineAmount,
  STYLE_DEFAULT, STYLE_PRESETS, STYLE_KEYS, parseStyleParams, styleToSearch, presetMatching, cleanStyleValue,
  zonePalette, createTerrainStyle, attachTerrainStyle, TERRACE_ANCHOR_M,
} from './terrain-style.js';
import { PALETTE } from './island-look.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b} (eps ${eps})`);
const NAMES = ['water', 'bare_rock', 'heath', 'meadow', 'scrub', 'forest', 'village']; // meta.json class order

// ---- blur -----------------------------------------------------------------------------------
{
  const nx = 9, nz = 7;
  const flat = new Float32Array(nx * nz).fill(0.4);
  blur121(flat, nx, nz, 5);
  for (const v of flat) near(v, 0.4, 1e-5); // a constant field stays constant, edges included (clamped)

  const f = new Float32Array(nx * nz);
  f[3 * nx + 4] = 1; // one bright cell in the middle
  blur121(f, nx, nz, 1);
  near(f[3 * nx + 4], 0.25, 1e-6); // centre 1/2 * 1/2
  near(f[3 * nx + 3], 0.125, 1e-6);
  near(f[2 * nx + 4], 0.125, 1e-6);
  near(f[2 * nx + 3], 0.0625, 1e-6);
  near(f.reduce((p, q) => p + q, 0), 1, 1e-5); // mass kept away from the border
}

// ---- mask baking ----------------------------------------------------------------------------
{
  // 24 x 12: left half meadow (3), right half forest (5), a water column at x=0, a village block, a rock block.
  const nx = 24, nz = 12;
  const CL = new Uint8Array(nx * nz);
  for (let b = 0; b < nz; b++) for (let a = 1; a < nx; a++) CL[b * nx + a] = a < 12 ? 3 : 5;
  for (let b = 0; b < nz; b++) CL[b * nx] = 0; // water edge
  const data = bakeZoneMasks(CL, NAMES, nx, nz, 4);
  assert.equal(data.length, nx * nz * 4);
  const at = (a, b) => sharesFromTexel(...data.subarray((b * nx + a) * 4, (b * nx + a) * 4 + 4));

  const meadowCoast = at(1, 6); // meadow right next to water: water must not dilute it
  assert.ok(meadowCoast[2] > 0.97, `coastal meadow share ${meadowCoast[2]}`);
  const deepForest = at(21, 6);
  assert.ok(deepForest[4] > 0.99 && deepForest[2] < 0.01);
  for (let k = 0; k < nx * nz; k++) { // the five shares sum to 1 on land
    if (!CL[k]) continue;
    const s = sharesFromTexel(...data.subarray(k * 4, k * 4 + 4));
    near(s.reduce((p, q) => p + q, 0), 1, 0.02);
    assert.ok(s.every((v) => v >= 0));
  }
  const mid = at(11, 6), mid2 = at(12, 6); // across the meadow|forest border the winner flips
  assert.ok(mid[2] > mid[4] && mid2[4] > mid2[2]);

  // village folds into meadow; bare_rock is the remainder; pure water far from land = no share anywhere
  const CL2 = new Uint8Array(nx * nz).fill(6);
  const d2 = bakeZoneMasks(CL2, NAMES, nx, nz, 3);
  assert.ok(d2[(6 * nx + 12) * 4 + 1] > 250, 'village counts as meadow (G channel)');
  const CL3 = new Uint8Array(nx * nz).fill(1);
  const d3 = bakeZoneMasks(CL3, NAMES, nx, nz, 3);
  assert.deepEqual([...d3.subarray(0, 4)], [0, 0, 0, 0]);
  near(sharesFromTexel(...d3.subarray(0, 4))[0], 1);
  const d4 = bakeZoneMasks(new Uint8Array(nx * nz), NAMES, nx, nz, 3); // all water
  assert.ok(d4.every((v) => v === 0));
}

// ---- slope map ------------------------------------------------------------------------------
{
  const nx = 61, nz = 41, pxM = 2;
  const half = (data, a, b) => THREE.DataUtils.fromHalfFloat(data[b * nx + a]);
  // a plane rising 0.5 m per cell east (0.25 rise/run): exact in the interior, whatever the blur
  const plane = new Float32Array(nx * nz);
  for (let b = 0; b < nz; b++) for (let a = 0; a < nx; a++) plane[b * nx + a] = 0.5 * a;
  const sp = bakeSlopeMap(plane, nx, nz, pxM, 6);
  for (const [a, b] of [[30, 20], [25, 15], [35, 25]]) near(half(sp, a, b), 0.25, 0.002);
  // flat ground: no slope; a cliff is capped (and stays a finite half float)
  assert.equal(half(bakeSlopeMap(new Float32Array(nx * nz).fill(3), nx, nz, pxM, 6), 30, 20), 0);
  const cliff = new Float32Array(nx * nz);
  for (let b = 0; b < nz; b++) for (let a = 0; a < nx; a++) cliff[b * nx + a] = a < 30 ? 0 : 5000;
  const cl = bakeSlopeMap(cliff, nx, nz, pxM, 0);
  assert.ok(half(cl, 30, 20) <= SLOPE_CAP && half(cl, 30, 20) > 7.9, `cliff capped at ${half(cl, 30, 20)}`);
  // source heights in 1 m steps (the real data): the raw slope flickers 0 / 0.5, the baked one is steady
  const steps = new Float32Array(nx * nz);
  for (let b = 0; b < nz; b++) for (let a = 0; a < nx; a++) steps[b * nx + a] = 0.5 * Math.floor(a / 3); // 0.5 m risers every 3 cells: mean 0.5 / 6 m = 0.083
  const spread = (data) => { const v = []; for (let a = 20; a < 40; a++) v.push(half(data, a, 20)); return Math.max(...v) - Math.min(...v); };
  const raw = spread(bakeSlopeMap(steps, nx, nz, pxM, 0));
  const baked = spread(bakeSlopeMap(steps, nx, nz, pxM, 6));
  assert.ok(raw > 0.1, `raw staircase slope flickers (${raw.toFixed(3)})`);
  assert.ok(baked < 0.02, `baked slope is steady (${baked.toFixed(3)})`);
  near(half(bakeSlopeMap(steps, nx, nz, pxM, 6), 30, 20), 0.5 / 6, 0.01);
  console.log(`slope flicker on 1 m steps: raw ${raw.toFixed(3)} -> baked ${baked.toFixed(4)} (rise/run)`);
}

// ---- the headline: a thresholded smoothed mask has a smooth contour, the raw raster has stairs --
{
  // Shallow diagonal border y = 0.31 x + 10 between meadow above (3) and forest below (5), on a 64 x 64 grid.
  const N = 64, slopeLine = 0.31, y0 = 10;
  const CL = new Uint8Array(N * N);
  for (let b = 0; b < N; b++) for (let a = 0; a < N; a++) CL[b * N + a] = b + 0.5 < slopeLine * (a + 0.5) + y0 ? 3 : 5;
  const rms = (passes) => {
    const data = passes > 0 ? bakeZoneMasks(CL, NAMES, N, N, passes) : null;
    // meadow share at a texel; passes 0 = the raw class raster
    const share = (a, b) => (passes > 0 ? data[(b * N + a) * 4 + 1] / 255 : CL[b * N + a] === 3 ? 1 : 0);
    let sum = 0, count = 0;
    for (let a = 14; a < 50; a++) {
      // walk down column a (texel centres), find where bilinear interpolation of the share crosses 0.5
      let cross = null;
      for (let b = 4; b < N - 6 && cross === null; b++) {
        const s0 = share(a, b), s1 = share(a, b + 1);
        if (s0 >= 0.5 && s1 < 0.5) cross = b + 0.5 + (s0 - 0.5) / (s0 - s1); // in texel-centre units
      }
      assert.notEqual(cross, null, `no crossing in column ${a}`);
      const ideal = slopeLine * (a + 0.5) + y0 - 0.5; // same units (texel b centre sits at b + 0.5)
      sum += (cross - 0.5 - ideal) ** 2;
      count++;
    }
    return Math.sqrt(sum / count);
  };
  const raw = rms(0), smooth = rms(8);
  assert.ok(raw > 0.2, `raw raster should show stairs (rms ${raw.toFixed(3)} px)`);
  assert.ok(smooth < 0.08, `smoothed contour should hug the line (rms ${smooth.toFixed(3)} px)`);
  assert.ok(smooth < raw / 3, `smoothing should cut the wobble at least 3x (${raw.toFixed(3)} -> ${smooth.toFixed(3)})`);
  console.log(`contour wobble: raw ${raw.toFixed(3)} px -> smoothed ${smooth.toFixed(3)} px`);
}

// ---- zone picking / thresholds --------------------------------------------------------------
{
  near(edgeHalfWidth(0), 0);
  assert.ok(edgeHalfWidth(0.08) < 0.002, 'the crisp end is below one pixel of anti-aliasing');
  assert.ok(edgeHalfWidth(1) > edgeHalfWidth(0.5) && edgeHalfWidth(0.5) > edgeHalfWidth(0.1)); // monotone
  near(edgeHalfWidth(2), edgeHalfWidth(1)); // clamped
  assert.ok(slopeHalfWidth(1) > slopeHalfWidth(0.3));

  assert.deepEqual(topTwo([0.1, 0.5, 0.3, 0.05, 0.05]), { t1: 0.5, t2: 0.3, i1: 1, i2: 2, gap: 0.2 });

  // signedGap: |signedGap| is the gap, and across a border it is a straight ramp through 0 (the V's tip is gone),
  // which is what makes the shader's fwidth(...) a trustworthy anti-aliasing width for the border line.
  near(Math.abs(signedGap([0.1, 0.5, 0.3, 0.05, 0.05])), 0.2);
  const ramp = [];
  for (let i = -4; i <= 4; i++) { const m = 0.5 + i * 0.05; ramp.push(signedGap([0, 0, m, 0, 1 - m])); } // meadow (2) -> forest (4)
  for (let i = 1; i < ramp.length; i++) near(ramp[i] - ramp[i - 1], ramp[1] - ramp[0], 1e-9); // constant step: linear, no kink
  assert.ok(ramp[0] < 0 && ramp[ramp.length - 1] > 0 && Math.abs(ramp[4]) < 1e-12, 'changes sign exactly at the border');

  // deep inside a zone: one-hot, at any softness
  for (const hw of [0, 0.01, 0.2]) {
    const w = zoneWeights([0, 0, 1, 0, 0], hw);
    assert.deepEqual(w.map((x) => +x.toFixed(6)), [0, 0, 1, 0, 0]);
  }
  // exactly on a border: an even split; hw=0 uses the same tie rule
  for (const hw of [0, 0.05]) {
    const w = zoneWeights([0, 0, 0.5, 0, 0.5], hw);
    near(w[2], 0.5); near(w[4], 0.5);
  }
  // weights always sum to 1, and walking across a border moves weight smoothly and monotonically
  let prev = -1;
  for (let i = 0; i <= 20; i++) {
    const meadow = 1 - i / 20; // 1 -> 0
    const n = [0, 0, meadow, 0, 1 - meadow];
    const w = zoneWeights(n, 0.1);
    near(w.reduce((p, q) => p + q, 0), 1, 1e-9);
    assert.ok(w[4] >= prev - 1e-12, 'forest weight rises monotonically'); prev = w[4];
  }
  // a softer edge is wider: at a 0.1 gap, soft blends and crisp has already switched
  const crisp = zoneWeights([0, 0, 0.55, 0, 0.45], 0.002);
  const soft = zoneWeights([0, 0, 0.55, 0, 0.45], 0.2);
  assert.ok(crisp[2] > 0.99 && soft[2] < 0.9 && soft[2] > 0.5 && soft[4] > 0.1, `soft blends the border (${soft[2].toFixed(2)} / ${soft[4].toFixed(2)})`);
  // three-way tie: even thirds
  const t = zoneWeights([0, 1 / 3, 1 / 3, 1 / 3, 0], 0.05);
  near(t[1], 1 / 3, 1e-6); near(t[2], 1 / 3, 1e-6); near(t[3], 1 / 3, 1e-6);
}

// ---- slope rule -----------------------------------------------------------------------------
{
  for (const deg of [5, 20, 32, 45, 60]) {
    const r = (deg * Math.PI) / 180;
    near(slopeTan(Math.sin(r), Math.cos(r), 0), Math.tan(r), 1e-9); // from a unit normal
    near(slopeTanFromDeg(deg), Math.tan(r), 1e-12);
  }
  assert.ok(Number.isFinite(slopeTan(1, 0, 0)) && slopeTan(1, 0, 0) > 100, 'a vertical wall (horizontal normal) does not divide by zero');
  const thr = slopeTanFromDeg(32), hw = 0.05;
  near(steepAmount(thr, thr, hw), 0.5);
  assert.ok(steepAmount(slopeTanFromDeg(20), thr, hw) === 0 && steepAmount(slopeTanFromDeg(45), thr, hw) === 1);
  assert.equal(steepAmount(thr - 0.001, thr, 0), 0); // hard step when the half-width is 0
  assert.equal(steepAmount(thr + 0.001, thr, 0), 1);

  const meadow = [0, 0, 1, 0, 0];
  for (const s of [0, 0.3, 0.5, 1]) near(applySteep(meadow, s).reduce((p, q) => p + q, 0), 1, 1e-12); // still sums to 1
  assert.deepEqual(applySteep(meadow, 1), [1, 0, 0, 0, 0]); // steep = pure granite
  assert.deepEqual(applySteep(meadow, 0), meadow);
  const half = zoneWeights(applySteep(meadow, 0.5), 0.001); // the border sits exactly at the threshold
  near(half[0], 0.5, 1e-6); near(half[2], 0.5, 1e-6);
  // a flat meadow stays meadow, a steep forest turns to granite
  assert.equal(topTwo(applySteep([0, 0, 0, 0, 1], steepAmount(slopeTanFromDeg(50), thr, 0.001))).i1, 0);
  assert.equal(topTwo(applySteep([0, 0, 0, 0, 1], steepAmount(slopeTanFromDeg(10), thr, 0.001))).i1, 4);
}

// ---- terraces -------------------------------------------------------------------------------
{
  const step = 2;
  const a = terraceParts(TERRACE_ANCHOR_M, step);
  assert.deepEqual([a.band, a.frac], [0, 0]);
  const b = terraceParts(TERRACE_ANCHOR_M + 2.5 * step, step);
  assert.equal(b.band, 2); near(b.frac, 0.5);
  const below = terraceParts(0, step); // under the anchor: band -1, still a valid fraction
  assert.equal(below.band, -1); assert.ok(below.frac >= 0 && below.frac < 1);
  // the band index is monotone in height; the fraction stays in [0, 1)
  let last = -Infinity;
  for (let h = -1; h < 40; h += 0.05) { const p = terraceParts(h, 1.3); assert.ok(p.band >= last && p.frac >= 0 && p.frac < 1); last = p.band; }

  const hpp = 0.05; // height per pixel
  assert.ok(riserAmount(0.999, step, hpp) > 0.99, 'the top of a band is the riser');
  assert.ok(riserAmount(0.5, step, hpp) < 0.001, 'mid-tread is not');
  assert.ok(riserAmount(0.0, step, hpp) < 0.001);
  // the riser stays ~1-2 px wide whatever the step: height-distance-to-edge / hpp
  const widthPx = (st) => { let n = 0; for (let f = 0; f < 1; f += 0.0005) if (riserAmount(f, st, hpp) > 0.5) n += 0.0005 * st / hpp; return n; };
  assert.ok(widthPx(1) > 0.5 && widthPx(1) < 1.6 && Math.abs(widthPx(1) - widthPx(4)) < 0.1, `riser width ${widthPx(1).toFixed(2)} / ${widthPx(4).toFixed(2)} px`);
  // facing: a slope whose downhill side faces the camera gets a thick riser, one facing away stays thin, flat ground thin
  const toCam = [0.7071, 0.7071];
  near(riserFacing([0.7071, 0.7071], toCam, 0.5), 1, 1e-3);            // squarely toward the camera
  assert.equal(riserFacing([-0.7071, -0.7071], toCam, 0.5), 0);        // facing away
  assert.equal(riserFacing([0.7071, 0.7071], toCam, 0), 0);            // flat: no cliff face
  near(riserFacing([1, 0], [0, 1], 0.5), 0, 1e-9);                      // side-on: nothing
  assert.ok(riserWidthPx(1) > 3 * riserWidthPx(0) && riserWidthPx(0) > 0.5);
  assert.ok(riserAmount(0.9, step, hpp, riserWidthPx(1)) > riserAmount(0.9, step, hpp, riserWidthPx(0)), 'a camera-facing riser is wider');
  assert.equal(terraceFade(2, 2), 0); // bands closer than ~3 px fade away (no shimmer)
  assert.equal(terraceFade(2, 0.1), 1);
  assert.ok(terraceFade(2, 0.3) > 0 && terraceFade(2, 0.3) < 1);
}

// ---- edge line ------------------------------------------------------------------------------
{
  const aa = 0.01;
  assert.ok(lineAmount(0, aa) > 0.99 && lineAmount(10 * aa, aa) === 0);
  near(lineAmount(1.4 * aa, aa), 0.5, 1e-9); // half-way through the fade, ~1.4 px from the border
  assert.ok(lineAmount(0.5 * aa, aa) > 0.99, 'solid within the first ~0.9 px');
  let prev = 2;
  for (let g = 0; g < 5 * aa; g += aa / 10) { const l = lineAmount(g, aa); assert.ok(l <= prev + 1e-12); prev = l; }
}

// ---- presets and URL ------------------------------------------------------------------------
{
  assert.deepEqual(Object.keys(STYLE_PRESETS), ['current', 'crisp', 'rocks', 'terraced', 'painted']);
  for (const [id, p] of Object.entries(STYLE_PRESETS)) {
    assert.deepEqual(Object.keys(p).sort(), [...STYLE_KEYS].sort(), `${id} has every key`);
    assert.equal(presetMatching(p), id);
    assert.deepEqual(parseStyleParams(styleToSearch('', p)), p, `${id} survives a URL round trip`);
  }
  assert.equal(styleToSearch('', STYLE_PRESETS.current), ''); // the default needs no params
  assert.equal(styleToSearch('', STYLE_PRESETS.painted), '?preset=painted');
  assert.equal(STYLE_PRESETS.current.crisp, 0);
  assert.ok(STYLE_PRESETS.painted.crisp && STYLE_PRESETS.painted.rock && STYLE_PRESETS.painted.terrace && STYLE_PRESETS.painted.line && STYLE_PRESETS.painted.grain, 'Painted = all on');
  assert.ok(STYLE_PRESETS.terraced.terrace && STYLE_PRESETS.terraced.rock && !STYLE_PRESETS.terraced.grain);

  // a custom mix writes only what differs from the default; the look panel's params survive
  const custom = { ...STYLE_PRESETS.crisp, soft: 0.4, slope: 28, rock: 1 };
  const search = styleToSearch('?tune=1&LOOK_SEA_BRIGHTNESS=1.1&preset=painted&crisp=0', custom);
  const sp = new URLSearchParams(search);
  assert.equal(sp.get('tune'), '1'); assert.equal(sp.get('LOOK_SEA_BRIGHTNESS'), '1.1');
  assert.equal(sp.get('preset'), null); assert.equal(sp.get('crisp'), '1'); assert.equal(sp.get('soft'), '0.4');
  assert.equal(sp.get('grain'), null);
  assert.deepEqual(parseStyleParams(search), custom);

  // explicit keys override the preset; junk is ignored; ranges are clamped
  const p = parseStyleParams('?preset=painted&grain=0&slope=500&step=abc&soft=-3&nonsense=1&crisp=yes');
  assert.equal(p.grain, 0); assert.equal(p.slope, 55); assert.equal(p.step, STYLE_DEFAULT.step); assert.equal(p.soft, 0); assert.equal(p.crisp, 1);
  assert.deepEqual(parseStyleParams('?preset=bogus'), STYLE_DEFAULT);
  assert.equal(cleanStyleValue('rock', '1'), 1); assert.equal(cleanStyleValue('rock', '0'), 0); assert.equal(cleanStyleValue('rock', 'x'), undefined);
  assert.equal(cleanStyleValue('soft', ''), undefined);
}

// ---- palette, material and the one-call adoption hook ---------------------------------------
{
  const pal = zonePalette();
  assert.equal(pal.length, ZONES.length);
  assert.ok(pal[0].equals(PALETTE.granite), 'zone 0 is the Skagen granite');
  for (let i = 1; i < pal.length; i++) assert.ok(!pal[i].equals(pal[0]), `${ZONES[i]} differs from granite`);
  assert.equal(new Set(pal.map((c) => c.getHex())).size, 5, 'five distinct zone colours');

  const nx = 16, nz = 10;
  const CL = new Uint8Array(nx * nz).fill(3);
  const world = { nx, nz, CL, H: new Float32Array(nx * nz).fill(2), names: NAMES, x0: 100, z0: 200, pxM: 2, look: { heightScale: 1 } };
  const style = createTerrainStyle(world, { passes: 2 });
  assert.equal(style.texture.image.width, nx); assert.equal(style.texture.image.height, nz);
  assert.equal(style.slopeTexture.image.data.length, nx * nz); assert.equal(style.slopeTexture.unpackAlignment, 2, 'half-float rows are not 4-byte aligned');
  assert.deepEqual(style.texture.image.data.subarray(0, 4), new Uint8Array([0, 255, 0, 0])); // all meadow
  style.setStyle({ ...STYLE_PRESETS.painted, step: 3, slope: 40, soft: 0.5 });
  const u = style.material.userData; // (uniforms are shared with the shader through onBeforeCompile)
  const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>\n#include <normal_fragment_maps>' };
  style.material.onBeforeCompile(shader);
  near(shader.uniforms.uTerraceStep.value, 3); near(shader.uniforms.uSlopeTan.value, Math.tan((40 * Math.PI) / 180));
  near(shader.uniforms.uEdgeHW.value, edgeHalfWidth(0.5));
  assert.equal(shader.uniforms.uRockOn.value, 1); assert.equal(shader.uniforms.uLineOn.value, 1); assert.equal(shader.uniforms.uGrainOn.value, 1);
  assert.ok(shader.fragmentShader.includes('tsColor(vTsPos') && shader.vertexShader.includes('vTsPos = position'));
  style.setStyle(STYLE_PRESETS.current);
  assert.equal(shader.uniforms.uTerraceStep.value, 0); assert.equal(shader.uniforms.uRockOn.value, 0);
  near(shader.uniforms.uZoneRect.value.z, 1 / (nx * 2)); near(shader.uniforms.uZoneRect.value.x, 100);

  // attachTerrainStyle swaps materials on every terrain mesh
  const original = new THREE.MeshLambertMaterial({ vertexColors: true });
  const group = new THREE.Group();
  const m1 = new THREE.Mesh(new THREE.BufferGeometry(), original);
  const inner = new THREE.Group(); const m2 = new THREE.Mesh(new THREE.BufferGeometry(), original); inner.add(m2);
  group.add(m1, inner);
  const hook = attachTerrainStyle({ group, material: original }, world, STYLE_PRESETS.current, { passes: 1 });
  assert.equal(hook.meshes.length, 2);
  assert.equal(m1.material, original, 'current preset keeps the vertex-colour material');
  hook.apply(STYLE_PRESETS.rocks);
  assert.equal(m1.material, hook.style.material); assert.equal(m2.material, hook.style.material);
  hook.apply(STYLE_PRESETS.current);
  assert.equal(m2.material, original);
}

console.log('terrain-style.test.js: all ok');
