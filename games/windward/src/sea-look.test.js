// node games/windward/src/sea-look.test.js — how gusts and lulls are DRAWN (src/sea-look.js, the shader block in src/sail-feel-water.js). Guards against the camouflage look that
// Felix's phone showed (small hard-edged pale/dark blotches over the whole sea). The wind maths is not tested here (wind-field.test.js): only the picture of it.
import assert from 'node:assert/strict';
import { LOOK, gustAmount, lullAmount, blurGrid, smoothstep } from './sea-look.js';
import { patchWaterSource } from './sail-feel-water.js';
import { WATER_FRAGMENT_GLSL } from './water.js';
import { createWindField } from './wind-field.js';
import { timeOfHour } from './weather.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }

const block = (() => { const out = patchWaterSource(WATER_FRAGMENT_GLSL); const body = out.slice(out.indexOf('void main() {')); return body.slice(body.indexOf('// sail-feel: the real wind field'), body.indexOf('// wind lines')); })();

check('the shader block has no fleck term and no thresholded noise on the gust (the pale blobs of the camouflage look)', () => {
  assert.ok(block.length > 800);
  assert.ok(!/rip\b/.test(block), 'the old `rip` fleck noise is gone');
  assert.ok(!/smoothstep\(0\.5[0-9]?, 0\.8[0-9]?, (rip|shimmer)\)/.test(block), 'no smoothstep threshold on noise at all for the gust/lull');
  assert.ok(!/vec3\(0\.13, 0\.18, 0\.21\)/.test(block), 'no pale fleck colour added inside gusts');
  assert.ok(/shimmer/.test(block) && /vnp\(vLocal \* 0\.07/.test(block), 'the only noise in a gust is the slow smooth shimmer (cells of 14 m and 5 m)');
});

check('every smoothstep in the weather block has edge0 < edge1 (GLSL leaves a reversed pair undefined: a phone may differ from a desktop)', () => {
  const re = /smoothstep\(\s*(-?[0-9.]+)\s*,\s*(-?[0-9.]+)\s*,/g; let m; let n = 0;
  while ((m = re.exec(block))) { n++; assert.ok(Number(m[1]) < Number(m[2]), `smoothstep(${m[1]}, ${m[2]}, ...)`); }
  assert.ok(n >= 8, `${n} smoothsteps checked`);
});

check('a gust shows only from +10%, grows smoothly to full at +34%; a lull from -3% to full at -22%; nothing for ordinary wind; both are monotonic', () => {
  assert.equal(gustAmount(1.0), 0); assert.equal(gustAmount(1.04), 0, 'the old look started at +4%: now a +4% puff is not drawn at all'); assert.equal(gustAmount(1.10), 0);
  assert.equal(gustAmount(1.34), 1); assert.ok(gustAmount(1.2) > 0.3 && gustAmount(1.2) < 0.7);
  assert.equal(lullAmount(1.0), 0); assert.equal(lullAmount(0.97), 0); assert.equal(lullAmount(0.78), 1);
  for (let r = 0.5; r < 1.6; r += 0.01) { assert.ok(gustAmount(r + 0.01) >= gustAmount(r) - 1e-12); assert.ok(lullAmount(r + 0.01) <= lullAmount(r) + 1e-12); }
});

check('contrast is low: at full strength a gust darkens the water by at most ~18% and a lull lightens it by a fifth of the way to the sky', () => {
  for (const c of LOOK.GUST_DARKEN) assert.ok(c >= 0.8 && c <= 1);
  assert.ok(LOOK.LULL_MIX <= 0.2);
  assert.ok(LOOK.GUST_SHIMMER <= 0.15, 'the shimmer inside a gust is small');
});

check('blurring: a single sharp texel becomes a soft bump (sigma ~32 m), keeps its total, and a flat field stays flat', () => {
  const n = 48; const g = new Float32Array(n * n); g[24 * n + 24] = 1;
  const b = blurGrid(g, n, LOOK.BLUR_SIGMA_TEXELS);
  let sum = 0; for (const v of b) sum += v;
  assert.ok(Math.abs(sum - 1) < 1e-3 && b[24 * n + 24] < 0.1 && b[24 * n + 24] > 0.01, `peak ${b[24 * n + 24].toFixed(3)}`);
  const flat = blurGrid(new Float32Array(n * n).fill(1.2), n, LOOK.BLUR_SIGMA_TEXELS);
  assert.ok(flat.every((v) => Math.abs(v - 1.2) < 1e-5), 'edges clamp, so a flat field is unchanged');
});

// the picture a phone gets: the 48 x 48 texture over 512 m (10.67 m texels), blurred, mapped through the ramps, looked at through a 70 x 100 m window
const N = 48; const CELL = 512 / N;
const bil = (g, x, z) => { const fx = Math.min(N - 1.001, Math.max(0, x / CELL - 0.5)); const fz = Math.min(N - 1.001, Math.max(0, z / CELL - 0.5)); const i = Math.floor(fx); const j = Math.floor(fz); const u = fx - i; const w = fz - j; const m = (a, b, t) => a + (b - a) * t; return m(m(g[j * N + i], g[j * N + i + 1], u), m(g[(j + 1) * N + i], g[(j + 1) * N + i + 1], u), w); };
function picture(sigma, gustFn, seeds, days) {
  let cov = 0; let half = 0; let n = 0; let maxGrad = 0; const runs = []; let lull = 0;
  for (const seed of seeds) for (const day of days) {
    const f = createWindField({ daySeed: seed, dayType: day });
    for (let t = 0; t < 1800; t += 45) {
      const raw = new Float32Array(N * N); const o = {};
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) raw[j * N + i] = f.windAt(2516 - 256 + (i + 0.5) * CELL, 8109 - 256 + (j + 0.5) * CELL, timeOfHour(11) + t, o).local;
      const g = sigma > 0 ? blurGrid(raw, N, sigma) : raw;
      let pc = 0; let lc = 0; let m = 0;
      for (let z = 156; z <= 356; z += 10) for (let x = 221; x <= 291; x += 7) { const r = bil(g, x, z); m++; if (gustFn(r) > 0.15) pc++; if (lullAmount(r) > 0.15) lc++; }
      cov += pc / m; lull += lc / m; if (pc / m > 0.5) half++; n++;
      let prev = null; let run = 0;
      for (let x = 56; x < 456; x += 2) { const a = gustFn(bil(g, x, 256)); if (prev !== null) maxGrad = Math.max(maxGrad, Math.abs(a - prev) / 2); prev = a; if (a > 0.15) run += 2; else { if (run) runs.push(run); run = 0; } }
    }
  }
  return { gustArea: cov / n, lullArea: lull / n, halfShare: half / n, steepestEdge: maxGrad, patchWidth: runs.length ? runs.reduce((a, b) => a + b, 0) / runs.length : 0 };
}
const SEEDS = [11, 4242, 77]; const DAYS = ['sea-breeze', 'grey-westerly', 'unsettled'];
const oldLook = picture(0, (r) => smoothstep(1.04, 1.30, r), SEEDS, DAYS);
const newLook = picture(LOOK.BLUR_SIGMA_TEXELS, gustAmount, SEEDS, DAYS);

check('coverage: gusts are occasional areas, not a pattern: well under the old coverage, rarely more than half the phone view', () => {
  console.log(`   old look: gust area ${(100 * oldLook.gustArea).toFixed(0)}%, >50% of the view ${(100 * oldLook.halfShare).toFixed(0)}% of the time | new look: ${(100 * newLook.gustArea).toFixed(0)}%, ${(100 * newLook.halfShare).toFixed(0)}%`);
  assert.ok(newLook.gustArea < oldLook.gustArea * 0.7, 'clearly less of the sea is drawn as gust than before');
  assert.ok(newLook.gustArea < 0.13, 'on average about a tenth of the view or less');
  assert.ok(newLook.halfShare < 0.08, 'rarely more than half the view');
});

check('edges are soft: the steepest edge of a patch changes by well under 7% per metre (the old look had up to ~19%), and a patch is large: wider than the phone view', () => {
  console.log(`   steepest edge: old ${(100 * oldLook.steepestEdge).toFixed(1)}%/m, new ${(100 * newLook.steepestEdge).toFixed(1)}%/m; mean patch width old ${oldLook.patchWidth.toFixed(0)} m, new ${newLook.patchWidth.toFixed(0)} m`);
  assert.ok(newLook.steepestEdge < 0.07 && newLook.steepestEdge < oldLook.steepestEdge * 0.5);
  assert.ok(newLook.patchWidth >= 60, `a gust is ~${newLook.patchWidth.toFixed(0)} m across: the whole phone screen (70 m) or more`);
});

check('lulls and lees cover a modest share and stay barely visible (the old look covered about the same area at 3 times the strength)', () => {
  assert.ok(newLook.lullArea < 0.2);
  assert.ok(LOOK.LULL_MIX * 1 < 0.62 / 3 + 0.01);
});

console.log(`${passed} sea-look checks passed`);
