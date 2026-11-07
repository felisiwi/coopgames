// How the wind field is DRAWN on the sea. Pure: no THREE, no DOM. The wind maths (wind-field.js) is untouched: this is only how a gust or a lull LOOKS.
//
// WHAT WENT WRONG (2026-11-07, Felix's phone screenshots): the first look was camouflage. Gust and lull patches were drawn from the raw 48 x 48 wind texture through
// hard ramps starting at a +4% change, and a "fleck" term (a hard threshold on fine noise) put 1 to 3 m pale blobs inside every gust. Measured on the field: patches are
// already ~75 m wide (bigger than the 70 m phone view), so the small blotches were never the patches: they were the flecks, and the edges between a patch and clear water
// were hard (up to 19% change per metre). Weak gusts (+4% to +20%) covered most of the painted area and were drawn nearly as strongly as real ones.
//
// WHAT A GUST LOOKS LIKE NOW: a large, soft-edged, slightly darker and bluer area drifting across the water; occasional, not a pattern. The wind field is blurred (a gaussian,
// ~32 m) when it is put into the texture, so edges are soft; only gusts of +10% or more show, fading in smoothly to full at +34%; no thresholded noise anywhere in it;
// a very low-frequency smooth shimmer inside it. A lull or a lee is barely paler and smoother. Whitecaps in a squall are streaks along the crests, not blobs.
export const LOOK = {
  BLUR_SIGMA_TEXELS: 3, // gaussian blur of the wind texture (texel = 10.7 m): ~32 m. Soft edges, small detail gone
  GUST_FROM: 1.10, // a gust shows from +10% over the water's calm wind ...
  GUST_FULL: 1.34, // ... smoothly to full at +34%
  GUST_DARKEN: [0.82, 0.88, 0.95], // at full: the water is up to 18% darker and a little bluer (low contrast)
  GUST_SHIMMER: 0.12, // +-12% of that darkening varies slowly across the gust (smooth noise, no threshold)
  SHIMMER_FREQ: [0.07, 0.19], // lattice cells per metre of the two shimmer octaves (cells 14 m and 5 m)
  LULL_FROM: 0.97, // a lull or a lee shows from -3% ...
  LULL_FULL: 0.78, // ... smoothly to full at -22%
  LULL_COLOR: [0.78, 0.86, 0.92], // the sky in smooth water
  LULL_MIX: 0.18, // barely paler (the old look mixed 62%)
  STORM_DARKEN: [0.40, 0.48, 0.60], // a squall's water
  STORM_MIX: 0.8,
  WHITECAP: 0.26, // squall foam streaks along the crests (brightness added at full)
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smoothstep = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
// How much of the gust look a wind ratio gets (0..1), and of the lull look.
export const gustAmount = (rel) => smoothstep(LOOK.GUST_FROM, LOOK.GUST_FULL, rel);
export const lullAmount = (rel) => 1 - smoothstep(LOOK.LULL_FULL, LOOK.LULL_FROM, rel);

// Gaussian blur of an n x n grid (separable, edges clamped). Returns a new Float32Array (or `out`).
export function blurGrid(src, n, sigma, out = new Float32Array(n * n)) {
  if (sigma <= 0) { out.set(src); return out; }
  const r = Math.ceil(sigma * 2.5);
  const k = new Float32Array(2 * r + 1);
  let sum = 0;
  for (let d = -r; d <= r; d++) { k[d + r] = Math.exp((-d * d) / (2 * sigma * sigma)); sum += k[d + r]; }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  const tmp = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { let a = 0; for (let d = -r; d <= r; d++) a += k[d + r] * src[j * n + Math.min(n - 1, Math.max(0, i + d))]; tmp[j * n + i] = a; }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { let a = 0; for (let d = -r; d <= r; d++) a += k[d + r] * tmp[Math.min(n - 1, Math.max(0, j + d)) * n + i]; out[j * n + i] = a; }
  return out;
}

// The look's GLSL numbers as text (the shader in sail-feel-water.js is built from these, so the test and the shader cannot drift apart).
export const glsl = (n) => (Number.isInteger(n) ? `${n}.0` : String(n));
export const vec3 = (a) => `vec3(${a.map(glsl).join(', ')})`;
