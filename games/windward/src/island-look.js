// The "Bohuslän" ground look (Look Lab, DESIGN.md "Look direction"): smooth
// painted islands, granite-led, with Summer-meadow green only in low,
// flat-ish, sheltered hollows, soft heather tufts, a dark wet band at the
// waterline and barely any sand. Ported from the groundColor "rock" branch
// of ref/look-lab.html — same colours, same smoothstep edges.
//
// Pure functions of (height, slope, x, z) plus a per-island `look` — no
// meshes — so the terrain colours (island.js), the pines (island.js) and the
// houses (settlements.js) all use the SAME green rule and can never disagree
// about where the meadow is.
//
// Deterministic across machines: the lab's noise hashed with
// fract(sin(..)*43758), which can differ in the last bit between JS engines.
// Here the lattice hash is integer maths (Math.imul), so a phone and a laptop
// agree exactly on where pines stand.
import * as THREE from '../vendor/three/three.module.js';
import { CONFIG } from './config.js';

// The paint. Live THREE.Color objects, rebuilt from CONFIG's LOOK_* values by
// refreshPalette() (called at load, and by the ?tune=1 panel after a change).
// Look pass 2 replaced the lab's saturated colours with the Skagen palette; the
// rules below are unchanged. Names keep the lab's: granite2 = pale domes,
// streak = veins, grass/grass2 = meadow.
export const PALETTE = {
  granite: new THREE.Color(),
  granite2: new THREE.Color(),
  streak: new THREE.Color(),
  grass: new THREE.Color(),
  grass2: new THREE.Color(),
  heather: new THREE.Color(),
  sand: new THREE.Color(),
  wet: new THREE.Color(),
};
const _cool = new THREE.Color();
export function refreshPalette() {
  const c = CONFIG;
  // Tints: 0 = as painted. Granite is pulled up to halfway toward its lilac
  // shadow colour; meadow up to fully toward the cooler sage.
  PALETTE.granite.set(c.LOOK_GRANITE).lerp(_cool.set(c.LOOK_GRANITE_SHADOW), c.LOOK_GRANITE_TINT * 0.5);
  PALETTE.granite2.set(c.LOOK_GRANITE_PALE).lerp(_cool.set(c.LOOK_GRANITE_SHADOW), c.LOOK_GRANITE_TINT * 0.5);
  PALETTE.streak.set(c.LOOK_GRANITE_SHADOW);
  PALETTE.grass.set(c.LOOK_MEADOW).lerp(_cool.set(c.LOOK_MEADOW_COOL), c.LOOK_MEADOW_TINT);
  PALETTE.grass2.set(c.LOOK_MEADOW_2).lerp(_cool.set(c.LOOK_MEADOW_COOL), c.LOOK_MEADOW_TINT);
  PALETTE.heather.set(c.LOOK_HEATHER);
  PALETTE.sand.set(c.LOOK_SAND);
  PALETTE.wet.set(c.LOOK_WET);
}
refreshPalette();

// The lab's thresholds were tuned on an island whose land heights have a 90th
// percentile of ~13 m and whose median slope is ~0.51 (measured on the lab's
// own main island). Game islands are much bigger and steeper (a 145 m-radius
// island peaks at ~85 m with a median slope above 1.0), so the literal
// thresholds would paint a large island almost entirely granite — measured:
// 1.6% green on a large island vs the lab's 7.5%. Each island is therefore
// measured once and its heights/slopes are scaled to the lab's statistics
// before the lab's thresholds are applied (see getIslandLook).
export const LAB_REF = { heightP90: 13.04, slopeMedian: 0.51 };

// Matching the percentiles alone left game islands greener than the lab's
// (large 20%, medium 16%, vs 7.5% on the lab's island): game hollows come from
// noise, the lab's from a dome, so the distributions agree but not their
// shape. Fitted by sweep over 24 medium/large islands (seeds 1-3): a factor of
// 1.6 on the normalised slope gives a mean 7.7% meadow, against the lab's 7.5%
// (factor 1.0 -> 17.4%, 1.4 -> 9.9%, 1.8 -> 6.1%).
export const SLOPE_CALIBRATION = 1.6;

// Land is anything above this (matches the lab's measurement).
const LAND_MIN_H = 0.3;
// A pine is not planted on the waterline fringe (the lab: h >= 1.6).
export const PINE_MIN_HEIGHT_M = 1.6;
// Green weight above which a spot counts as "meadow" (pines, houses).
export const GREEN_THRESHOLD = 0.5;

function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

// Integer lattice hash -> [0, 1). Replaces the lab's sin-based hash.
function hash2(ix, iy) {
  let h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ 0x9e3779b9; // the constant keeps lattice point (0, 0) from hashing to 0
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function vnoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const fbm = (x, y) => vnoise(x, y) * 0.55 + vnoise(x * 2.1, y * 2.1) * 0.3 + vnoise(x * 4.3, y * 4.3) * 0.15;

// Sheltered hollows where soil collects (the lab's greenPocket).
export function greenPocket(x, z) {
  return vnoise(x * 0.06 + 3, z * 0.06 - 5) * 0.7 + vnoise(x * 0.15, z * 0.15) * 0.3;
}

// Central-difference slope (rise/run), same technique as the lab's colouring.
export function slopeAt(heightAt, x, z, e) {
  const sx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e);
  const sz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
  return Math.hypot(sx, sz);
}

// How "meadow" a spot is, 0..1 — the lab's green weight, with height/slope
// expressed in lab units via `look`. Absolute metres (waterline bands) stay
// absolute: they are about the water, not the island's size.
function greenFromPocket(pocket, h, slope, look) {
  const hLab = h * look.heightScale;
  const sLab = slope * look.slopeScale;
  return (
    smoothstep(0.43, 0.49, pocket) *
    (1 - smoothstep(0.4, 0.52, sLab)) *
    smoothstep(0.9, 1.3, h) *
    (1 - smoothstep(10, 11, hLab))
  );
}

export function greenAmount(h, slope, x, z, look) {
  return greenFromPocket(greenPocket(x, z), h, slope, look);
}

const C = PALETTE; // read live, so a refreshPalette() shows on the next groundColor() call

// Writes the ground colour for one spot into `out` (a THREE.Color). Same
// layering as the lab's rock branch; a layer whose weight is 0 is skipped.
export function groundColor(h, slope, x, z, look, out) {
  const hLab = h * look.heightScale;
  const pocket = greenPocket(x, z);
  out.copy(C.granite);
  const pale = smoothstep(7, 11, hLab);
  if (pale > 0) out.lerp(C.granite2, pale);
  const vein = smoothstep(0.62, 0.66, fbm(x * 0.08, z * 0.08)) * 0.6;
  if (vein > 0) out.lerp(C.streak, vein);
  const green = greenFromPocket(pocket, h, slope, look);
  if (green > 0) out.lerp(pocket > 0.64 ? C.grass2 : C.grass, green);
  const tuft = smoothstep(0.8, 0.86, vnoise(x * 0.22 + 9, z * 0.22)) * 0.45 * (1 - green) * smoothstep(1.5, 2.0, h);
  if (tuft > 0) out.lerp(C.heather, tuft);
  const cove = (1 - smoothstep(0.5, 0.9, h)) * smoothstep(0.56, 0.6, pocket); // the odd small cove
  if (cove > 0) out.lerp(C.sand, cove);
  const wet = 1 - smoothstep(0.35, 0.62, h);
  if (wet > 0) out.lerp(C.wet, wet);
  return out;
}

// ---- per-island measurement ------------------------------------------------

const lookCache = new Map();

function percentile(sortedAsc, f) {
  return sortedAsc[Math.min(sortedAsc.length - 1, Math.floor(sortedAsc.length * f))];
}

// Measures one island's land heights and slopes on a coarse 40x40 sample grid
// (~1600 probes, a few thousand height evaluations — cheap) and returns the
// factors that map them onto the lab's statistics. Cached by island identity
// so the terrain, pines and houses all get the identical object.
export function getIslandLook(seed, params, heightAt) {
  const key = `${seed}|${params.ISLAND_CENTER_X}|${params.ISLAND_CENTER_Z}|${params.ISLAND_RADIUS}|${params.ISLAND_PEAK_HEIGHT}`;
  const hit = lookCache.get(key);
  if (hit) return hit;

  const cell = params.ISLAND_GRID_CELL_SIZE;
  const reach = params.ISLAND_RADIUS + params.ISLAND_COAST_NOISE_AMPLITUDE + params.ISLAND_FALLOFF_WIDTH / 2;
  const N = 40;
  const step = (reach * 2) / N;
  const heights = [];
  const slopes = [];
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = params.ISLAND_CENTER_X - reach + (i + 0.5) * step;
      const z = params.ISLAND_CENTER_Z - reach + (j + 0.5) * step;
      const h = heightAt(x, z);
      if (h < LAND_MIN_H) continue;
      heights.push(h);
      slopes.push(slopeAt(heightAt, x, z, cell));
    }
  }

  let look;
  if (heights.length < 12) {
    // A speck of rock: too few land samples to measure. Fall back to its
    // nominal shape (peak height, cone slope) so it still gets sane colours.
    look = {
      heightScale: LAB_REF.heightP90 / Math.max(1, params.ISLAND_PEAK_HEIGHT * 0.7),
      slopeScale: (LAB_REF.slopeMedian / 0.6) * SLOPE_CALIBRATION,
      measured: false,
    };
  } else {
    heights.sort((a, b) => a - b);
    slopes.sort((a, b) => a - b);
    look = {
      heightScale: LAB_REF.heightP90 / Math.max(0.5, percentile(heights, 0.9)),
      slopeScale: (LAB_REF.slopeMedian / Math.max(0.05, percentile(slopes, 0.5))) * SLOPE_CALIBRATION,
      measured: true,
    };
  }
  lookCache.set(key, look);
  return look;
}
