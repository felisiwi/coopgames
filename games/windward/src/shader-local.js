// Precision-safe coordinates for the weather's sea shader. Pure: no THREE, no DOM. (src/sail-feel-water.js uses these; shader-local.test.js proves them.)
//
// THE BUG THIS FIXES (2026-11-07, a phone): the first version of the weather paint did high-frequency noise on ABSOLUTE world coordinates in the fragment
// shader (x about 2500, z about 8100, less the air's drift of thousands of metres). A phone that runs fragment shaders at 16-bit (mediump) can only
// represent a number near 4000 in steps of 2, so fract()/floor() noise collapsed into hard-edged squares: a mosaic over the whole sea, with the weather
// on. A desktop GPU runs the same shader at 32 bits and shows nothing. (Measured: src/shader-fp16.js emulates it; the noise lookups' errors with 16-bit
// coordinates were 0.13 to 0.22 for the new ones against 0.006 to 0.014 for the old low-frequency ones.)
//
// THE RULE: the fragment shader only ever sees SMALL numbers. The vertex shader (always full precision) hands it the position relative to the camera
// target (`vLocal`, within a few hundred metres). Everything big is folded into small constants here in JS (64-bit): the target's absolute position and the
// air's drift become an offset in noise-lattice units, wrapped into [0, LATTICE). That only works if the noise REPEATS every LATTICE cells, so the shader
// uses a periodic noise (vnp: the hash of the cell index mod LATTICE) and the wrapped offset gives exactly the same value as the absolute coordinate would.
export const LATTICE = 128;
export const wrapL = (v) => ((v % LATTICE) + LATTICE) % LATTICE;

// The noise lookups of the water shader, as numbers (the GLSL in sail-feel-water.js uses the same ones).
export const RIPPLE = { F1: 0.07, F2: 0.19, SHIFT2: 7 }; // the slow shimmer inside a gust: vnp(p * F1) and vnp(p * F2 + SHIFT2), p = the position relative to the air's drift (sea-look.js SHIMMER_FREQ; the first version used 0.55 and 1.3, and a threshold on them made the pale blobs)
export const CREST = { ALONG: 0.075, ACROSS: 0.55, A: [3, 9], F2: 2.3, B: [11, 4] }; // crest foam streaks, long along the crest

// origin: the camera target (world x, z); drift: where the air has carried a patch from the origin of time. Returns [x1, y1, x2, y2] lattice offsets, each in [0, LATTICE).
export function rippleOffsets(ox, oz, dx, dz) {
  const bx = ox - dx; const bz = oz - dz; // the target's position in the air's own frame
  return [wrapL(bx * RIPPLE.F1), wrapL(bz * RIPPLE.F1), wrapL(bx * RIPPLE.F2 + RIPPLE.SHIFT2), wrapL(bz * RIPPLE.F2 + RIPPLE.SHIFT2)];
}
// trav: the unit vector (x, z) the swell travels along. The streaks are fixed to the world (the crests move through them).
export function crestOffsets(ox, oz, travX, travZ) {
  const alongX = -travZ; const alongZ = travX;
  const ra = (ox * alongX + oz * alongZ) * CREST.ALONG; const rb = (ox * travX + oz * travZ) * CREST.ACROSS;
  return [wrapL(ra + CREST.A[0]), wrapL(rb + CREST.A[1]), wrapL(ra * CREST.F2 + CREST.B[0]), wrapL(rb * CREST.F2 + CREST.B[1])];
}

// ---- CPU mirrors of the shader's noise, for tests ----
const fract = (x) => x - Math.floor(x);
export function h21(px, py) { let a = fract(px * 0.1031); let b = fract(py * 0.1031); let c = fract(px * 0.1031); const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33); a += d; b += d; c += d; return fract((a + b) * c); }
const hp = (i, j) => h21(((i % LATTICE) + LATTICE) % LATTICE, ((j % LATTICE) + LATTICE) % LATTICE); // the periodic hash: the cell index mod LATTICE
export function vnp(x, y) {
  const i = Math.floor(x); const j = Math.floor(y); const fx = x - i; const fy = y - j;
  const ux = fx * fx * (3 - 2 * fx); const uy = fy * fy * (3 - 2 * fy);
  const m = (p, q, t) => p + (q - p) * t;
  return m(m(hp(i, j), hp(i + 1, j), ux), m(hp(i, j + 1), hp(i + 1, j + 1), ux), uy);
}
