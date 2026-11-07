// Deterministic hash + value noise for the weather modules (weather.js, wind-field.js, squall.js).
// Pure: the same integers in give the same number out on every phone, no Math.random, no Date.now.
// Weather is a fixed function of (daySeed, gameTimeS), so two players see the same gusts with no messages.

// Four integers in, one unsigned 32-bit hash out (a small avalanche mix; good enough for gameplay noise).
export function hash32(a, b = 0, c = 0, d = 0) {
  let h = (a | 0) ^ Math.imul(b | 0, 0x9e3779b1) ^ Math.imul(c | 0, 0x85ebca6b) ^ Math.imul(d | 0, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

// The same hash as a number in [0, 1).
export const hash01 = (a, b = 0, c = 0, d = 0) => hash32(a, b, c, d) / 4294967296;

const smooth = (t) => t * t * (3 - 2 * t);

// 1-D value noise in [0, 1]: random values at whole numbers of x, smoothly blended between.
export function noise1(seed, x) {
  const i = Math.floor(x);
  const f = smooth(x - i);
  return hash01(seed, i) * (1 - f) + hash01(seed, i + 1) * f;
}

// Value noise that loops: `cells` random values around the circle of x in [0, cells), so x = 0 and x = cells match.
// Used for things that repeat every game day, so midnight has no jump.
export function noise1p(seed, x, cells) {
  const i = Math.floor(x);
  const f = smooth(x - i);
  const a = ((i % cells) + cells) % cells;
  const b = (a + 1) % cells;
  return hash01(seed, a) * (1 - f) + hash01(seed, b) * f;
}

// The same, centred: [-1, 1].
export const noise1s = (seed, x) => noise1(seed, x) * 2 - 1;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const smoothstep = (e0, e1, x) => smooth(clamp((x - e0) / (e1 - e0), 0, 1));
export const lerp = (a, b, t) => a + (b - a) * t;
