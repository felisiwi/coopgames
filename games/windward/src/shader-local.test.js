// node games/windward/src/shader-local.test.js — the precision-safe coordinates of the weather's sea shader (src/shader-local.js): the camera-local form gives the
// SAME noise as absolute world coordinates, and unlike them it survives 16-bit (mediump) rounding. This is the regression guard for the phone's blocky sea.
import assert from 'node:assert/strict';
import { LATTICE, wrapL, rippleOffsets, crestOffsets, vnp, RIPPLE, CREST } from './shader-local.js';
import { q16 } from './shader-fp16.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }

const SPOTS = [[2516, 8109], [300, 400], [-1200, 5000], [1470, 2394]]; // game coordinates incl. the real coast's size
const DRIFTS = [[0, 0], [1800, 500], [-3200, 2600], [123456.789, -98765.4]]; // the air's drift, minutes to hours in
const TRAV = [Math.sin(1.1), Math.cos(1.1)];
const view = (f) => { for (let lx = -150; lx <= 150; lx += 7.3) for (let lz = -150; lz <= 150; lz += 7.3) f(lx, lz); }; // a 300 m square round the camera target

check('wrapping is seamless: the local form gives EXACTLY the noise the absolute world coordinate would (ripples and crest streaks, any origin, any drift)', () => {
  for (const [ox, oz] of SPOTS) for (const [dx, dz] of DRIFTS) {
    const r = rippleOffsets(ox, oz, dx, dz); const c = crestOffsets(ox, oz, TRAV[0], TRAV[1]);
    let worst = 0;
    view((lx, lz) => {
      const wx = ox + lx; const wz = oz + lz;
      const abs1 = vnp((wx - dx) * RIPPLE.F1, (wz - dz) * RIPPLE.F1); const loc1 = vnp(lx * RIPPLE.F1 + r[0], lz * RIPPLE.F1 + r[1]);
      const abs2 = vnp((wx - dx) * RIPPLE.F2 + RIPPLE.SHIFT2, (wz - dz) * RIPPLE.F2 + RIPPLE.SHIFT2); const loc2 = vnp(lx * RIPPLE.F2 + r[2], lz * RIPPLE.F2 + r[3]);
      const sa = (wx * -TRAV[1] + wz * TRAV[0]) * CREST.ALONG; const sb = (wx * TRAV[0] + wz * TRAV[1]) * CREST.ACROSS;
      const la = (lx * -TRAV[1] + lz * TRAV[0]) * CREST.ALONG; const lb = (lx * TRAV[0] + lz * TRAV[1]) * CREST.ACROSS;
      const abs3 = vnp(sa + CREST.A[0], sb + CREST.A[1]); const loc3 = vnp(la + c[0], lb + c[1]);
      const abs4 = vnp(sa * CREST.F2 + CREST.B[0], sb * CREST.F2 + CREST.B[1]); const loc4 = vnp(la * CREST.F2 + c[2], lb * CREST.F2 + c[3]);
      worst = Math.max(worst, Math.abs(abs1 - loc1), Math.abs(abs2 - loc2), Math.abs(abs3 - loc3), Math.abs(abs4 - loc4));
    });
    assert.ok(worst < 1e-6, `origin ${ox},${oz} drift ${dx},${dz}: worst difference ${worst}`);
  }
});

check('every offset handed to the shader is small (< 128): a 16-bit float holds it to better than 0.07 of a lattice cell', () => {
  for (const [ox, oz] of SPOTS) for (const [dx, dz] of DRIFTS) for (const v of [...rippleOffsets(ox, oz, dx, dz), ...crestOffsets(ox, oz, TRAV[0], TRAV[1])]) { assert.ok(v >= 0 && v < LATTICE); assert.ok(Math.abs(q16(v) - v) <= 0.0625, `${v}`); }
  assert.equal(wrapL(-1), LATTICE - 1); assert.equal(wrapL(LATTICE * 3 + 5), 5);
});

check('THE REGRESSION: with 16-bit coordinates the old absolute form is corrupted (the phone\'s mosaic), the local form is not', () => {
  const err = (form) => { let sum = 0; let bad = 0; let n = 0; for (const [ox, oz] of SPOTS.slice(0, 2)) { const dx = 1800; const dz = 500; const r = rippleOffsets(ox, oz, dx, dz); view((lx, lz) => {
    const wx = ox + lx; const wz = oz + lz;
    const exact = vnp((wx - dx) * RIPPLE.F1, (wz - dz) * RIPPLE.F1);
    const got = form === 'absolute16'
      ? vnp(q16(q16(wx) - q16(dx)) * RIPPLE.F1, q16(q16(wz) - q16(dz)) * RIPPLE.F1) // what the first version did on a 16-bit GPU
      : vnp(q16(lx) * RIPPLE.F1 + q16(r[0]), q16(lz) * RIPPLE.F1 + q16(r[1])); // the fix on a 16-bit GPU (the local position is what the vertex shader passes down)
    const e = Math.abs(exact - got); sum += e; n++; if (e > 0.15) bad++; }); } return { mean: sum / n, bad: bad / n }; };
  const old = err('absolute16'); const fix = err('local16');
  assert.ok(old.mean > 0.08 && old.bad > 0.2, `the absolute form is wrong over ${(100 * old.bad).toFixed(0)}% of the sea (mean error ${old.mean.toFixed(3)})`);
  assert.ok(fix.mean < 0.01 && fix.bad === 0, `the local form is not (mean error ${fix.mean.toFixed(4)}, ${(100 * fix.bad).toFixed(1)}% wrong)`);
});

check('the periodic noise is smooth (no hard steps between neighbouring pixels) and repeats exactly every 128 cells', () => {
  let worst = 0; for (let x = 0; x < 30; x += 0.01) worst = Math.max(worst, Math.abs(vnp(x + 0.01, 3.3) - vnp(x, 3.3)));
  assert.ok(worst < 0.05, `largest step per 0.01 cell ${worst.toFixed(4)}`);
  assert.ok(Math.abs(vnp(5.37, 9.1) - vnp(5.37 + LATTICE, 9.1 + LATTICE)) < 1e-9);
  let lo = 1; let hi = 0; for (let i = 0; i < 4000; i++) { const v = vnp(i * 0.37, i * 0.11); lo = Math.min(lo, v); hi = Math.max(hi, v); } assert.ok(lo < 0.15 && hi > 0.85, 'it still uses the whole range');
});

console.log(`${passed} shader-local checks passed`);
