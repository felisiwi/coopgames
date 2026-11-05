// Island depth map for the sea (Look Lab port, 2026-11-05). The water shader
// colours the sea by depth (turquoise shallows -> mid -> deep blue) and draws
// foam rings at the shore; both need to know how deep the water is under any
// point. This bakes that once at start from each island's
// createIslandHeightField — the same seeded functions on both peers, so both
// sides bake the identical map (nothing crosses the wire).
//
// Two numbers per texel:
//   depth  metres below sea level (0 on land / at the waterline), capped at
//          DEEP_M. Drives the colour ramp.
//   shore  metres from the shoreline, scaled to the Look Lab's coast slope
//          (SHORE_SLOPE) so a lab "depth" of 0.35 m means ~1.2 m from the
//          shore. Drives the white edge and the foam rings. Raw depth cannot
//          do that job: the game's shelves range from a gentle 0.1 m/m (small
//          skerries) to sheer cliffs (large islands), so foam read from raw
//          depth would be 6 m wide on a skerry and a 0.3 m hairline on a big
//          island (measured), where the lab's was ~1 m on every coast. The
//          distance is real (to the interpolated shoreline), not a guess from
//          the slope, so it is right for any shelf shape.
//
// Cost control (~1.1M texels at 1.5 m): islands are sampled on a coarse
// lattice (BLOCK x BLOCK texels per cell); only cells at the shoreline are
// evaluated exactly per texel. Plainly-inland cells are filled with 0 and
// plainly-underwater cells are bilinearly interpolated from their corners
// (the depth field is smooth there).
import * as THREE from '../vendor/three/three.module.js';
import { createIslandHeightField } from './island.js';

export const DEEP_M = 10; // depth treated as "deep" — the lab's value
export const TEXEL_M = 1.5; // target metres per texel (brief: ~1-1.5 m keeps shore foam crisp)
export const BLOCK = 4; // texels per coarse cell side (6 m cells at 1.5 m texels)
export const SHORE_SLOPE = 0.3; // metres of "lab depth" per metre from shore (the lab's coast steepness)
const MAX_DIM = 2048; // texels per side; texel size grows past this so the texture stays small enough
const REFINE_NEAR_SURFACE_M = 1.5; // sea cells with a corner this shallow are evaluated exactly (colour + foam live here)
const REFINE_STEEP_M = 1.2; // ...as are cells whose corner depths differ by more than this (cliff faces)...
const REFINE_STEEP_BELOW_M = 4; // ...but only in water shallower than this: deeper, colour barely changes
const INLAND_ABOVE_M = 4; // coarse cells whose corners are all this far above sea are plain land
const SHORE_REACH_M = 6; // shore distance is only computed this far out; beyond it the sea counts as DEEP_M

function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

// Underwater depth for a point `beyond` metres past the coastline — the same
// shelf/abyss curve as island.js's heightAt, used only to know how far out an
// island's depth stays under DEEP_M.
function underwaterDepth(p, beyond) {
  const shelfT = smoothstep(0, p.ISLAND_SHELF_WIDTH, beyond);
  const abyssT = smoothstep(p.ISLAND_SHELF_WIDTH, p.ISLAND_SHELF_WIDTH + p.ISLAND_ABYSS_TRANSITION_WIDTH, beyond);
  return p.ISLAND_SHELF_DEPTH * shelfT + (p.ISLAND_ABYSS_DEPTH - p.ISLAND_SHELF_DEPTH) * abyssT;
}

// Radius around an island's centre beyond which the sea is certainly deeper
// than DEEP_M. Conservative on the coastline (edgeR <= RADIUS + AMPLITUDE).
export function depthReach(p) {
  let lo = 0;
  let hi = p.ISLAND_SHELF_WIDTH + p.ISLAND_ABYSS_TRANSITION_WIDTH;
  if (underwaterDepth(p, hi) < DEEP_M) return p.ISLAND_RADIUS + p.ISLAND_COAST_NOISE_AMPLITUDE + hi;
  for (let k = 0; k < 24; k++) {
    const mid = (lo + hi) / 2;
    if (underwaterDepth(p, mid) >= DEEP_M) hi = mid;
    else lo = mid;
  }
  return p.ISLAND_RADIUS + p.ISLAND_COAST_NOISE_AMPLITUDE + hi;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// Bakes the map for a scatterIslands() list. Pure data (Float32Arrays), no GPU:
// createDepthTexture() below uploads it.
export function bakeDepthMap(islands, opts = {}) {
  const t0 = now();
  let texel = opts.texel ?? TEXEL_M;
  let evals = 0;

  const items = islands.map((isl) => {
    const p = isl.params;
    return { p, hf: createIslandHeightField(isl.seed, p), reach: depthReach(p), cx: p.ISLAND_CENTER_X, cz: p.ISLAND_CENTER_Z };
  });
  if (items.length === 0) {
    const n = BLOCK * BLOCK;
    return { x0: 0, z0: 0, texel, nx: BLOCK, nz: BLOCK, depth: new Float32Array(n).fill(DEEP_M), shore: new Float32Array(n).fill(DEEP_M), bakeMs: now() - t0, evals: 0 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const it of items) {
    minX = Math.min(minX, it.cx - it.reach);
    maxX = Math.max(maxX, it.cx + it.reach);
    minZ = Math.min(minZ, it.cz - it.reach);
    maxZ = Math.max(maxZ, it.cz + it.reach);
  }
  const extent = Math.max(maxX - minX, maxZ - minZ);
  if (extent / texel > MAX_DIM) texel = extent / MAX_DIM;

  const cs = texel * BLOCK; // coarse cell size
  const x0 = Math.floor(minX / cs) * cs;
  const z0 = Math.floor(minZ / cs) * cs;
  const cellsX = Math.ceil((maxX - x0) / cs);
  const cellsZ = Math.ceil((maxZ - z0) / cs);
  const nx = cellsX * BLOCK;
  const nz = cellsZ * BLOCK;
  // Signed field: metres of water above the sea floor (positive in the sea,
  // <= 0 on land). Islands combine by min (land anywhere wins); depth is its
  // positive part. The shoreline is where it changes sign.
  const sgn = new Float32Array(nx * nz).fill(DEEP_M);

  for (const it of items) {
    const ci0 = Math.max(0, Math.floor((it.cx - it.reach - x0) / cs));
    const ci1 = Math.min(cellsX - 1, Math.floor((it.cx + it.reach - x0) / cs));
    const cj0 = Math.max(0, Math.floor((it.cz - it.reach - z0) / cs));
    const cj1 = Math.min(cellsZ - 1, Math.floor((it.cz + it.reach - z0) / cs));
    const w = ci1 - ci0 + 2; // coarse nodes per row
    const rows = cj1 - cj0 + 2;
    const hC = new Float32Array(w * rows);
    for (let b = 0; b < rows; b++) {
      for (let a = 0; a < w; a++) {
        hC[b * w + a] = it.hf(x0 + (ci0 + a) * cs, z0 + (cj0 + b) * cs);
        evals++;
      }
    }
    const reachSq = (it.reach + cs) * (it.reach + cs);
    for (let cj = cj0; cj <= cj1; cj++) {
      for (let ci = ci0; ci <= ci1; ci++) {
        const dxc = x0 + (ci + 0.5) * cs - it.cx;
        const dzc = z0 + (cj + 0.5) * cs - it.cz;
        if (dxc * dxc + dzc * dzc > reachSq) continue; // beyond the island's reach: stays deep
        const a = ci - ci0;
        const b = cj - cj0;
        const h00 = hC[b * w + a];
        const h10 = hC[b * w + a + 1];
        const h01 = hC[(b + 1) * w + a];
        const h11 = hC[(b + 1) * w + a + 1];
        // Signed corner values (positive = sea, <= 0 = land), capped at
        // +-DEEP_M: below that the colour is flat, so slope there is invisible
        // (the abyss slopes steeply but is all "deep").
        const s00 = h00 > DEEP_M ? -DEEP_M : h00 < -DEEP_M ? DEEP_M : -h00;
        const s10 = h10 > DEEP_M ? -DEEP_M : h10 < -DEEP_M ? DEEP_M : -h10;
        const s01 = h01 > DEEP_M ? -DEEP_M : h01 < -DEEP_M ? DEEP_M : -h01;
        const s11 = h11 > DEEP_M ? -DEEP_M : h11 < -DEEP_M ? DEEP_M : -h11;
        const sMin = Math.min(s00, s10, s01, s11);
        const sMax = Math.max(s00, s10, s01, s11);
        const tx0 = ci * BLOCK;
        const tz0 = cj * BLOCK;
        // Exact per-texel evaluation only where it matters: the shoreline
        // passes through (mixed signs) or the sea floor is steep. All-land
        // and flat all-sea cells interpolate their corners — the contour
        // cannot be inside them.
        let exact;
        if (sMin <= 0 && sMax > 0) exact = true; // shoreline in this cell
        else if (sMin > 0) {
          if (sMin >= DEEP_M) continue; // all deep: already DEEP_M
          // Right at the surface, or a steep face in shallow water. A long
          // steady ramp (the abyss slope) interpolates exactly, so it is skipped.
          exact = sMin < REFINE_NEAR_SURFACE_M || (sMin < REFINE_STEEP_BELOW_M && sMax - sMin > REFINE_STEEP_M);
        } else exact = false; // all land
        if (sMax <= 0 && -sMax >= INLAND_ABOVE_M && -sMin >= INLAND_ABOVE_M) {
          for (let tz = tz0; tz < tz0 + BLOCK; tz++) {
            const row = tz * nx;
            for (let tx = tx0; tx < tx0 + BLOCK; tx++) if (sgn[row + tx] > -1) sgn[row + tx] = -1;
          }
        } else if (!exact) {
          for (let k = 0; k < BLOCK; k++) {
            const v = (k + 0.5) / BLOCK;
            const row = (tz0 + k) * nx + tx0;
            for (let m = 0; m < BLOCK; m++) {
              const u = (m + 0.5) / BLOCK;
              const d = (s00 * (1 - u) + s10 * u) * (1 - v) + (s01 * (1 - u) + s11 * u) * v;
              if (d < sgn[row + m]) sgn[row + m] = d;
            }
          }
        } else {
          for (let k = 0; k < BLOCK; k++) {
            const z = z0 + (tz0 + k + 0.5) * texel;
            const row = (tz0 + k) * nx + tx0;
            for (let m = 0; m < BLOCK; m++) {
              let v = -it.hf(x0 + (tx0 + m + 0.5) * texel, z);
              evals++;
              if (v > DEEP_M) v = DEEP_M;
              else if (v < -DEEP_M) v = -DEEP_M;
              if (v < sgn[row + m]) sgn[row + m] = v;
            }
          }
        }
      }
    }
  }

  const depth = new Float32Array(nx * nz);
  for (let i = 0; i < depth.length; i++) depth[i] = sgn[i] > 0 ? sgn[i] : 0;

  // Shore distance: find every place the signed field changes sign between
  // two neighbouring texels, put the shoreline point at the linearly
  // interpolated zero (sub-texel), and for each such point record the
  // distance to it in the texels within SHORE_REACH_M. Only the ~1 point per
  // 1.5 m of coast matters, so this is cheap and exact for any shelf shape.
  const R = Math.ceil(SHORE_REACH_M / texel);
  const reachTexels = SHORE_REACH_M / texel;
  const best = new Float32Array(nx * nz).fill(reachTexels * reachTexels); // squared texel distance
  const splat = (px, pz) => {
    const ci = Math.round(px);
    const cj = Math.round(pz);
    for (let j = Math.max(0, cj - R); j <= Math.min(nz - 1, cj + R); j++) {
      const dz = j - pz;
      const row = j * nx;
      for (let i = Math.max(0, ci - R); i <= Math.min(nx - 1, ci + R); i++) {
        const dx = i - px;
        const d2 = dx * dx + dz * dz;
        if (d2 < best[row + i]) best[row + i] = d2;
      }
    }
  };
  for (let tz = 0; tz < nz; tz++) {
    for (let tx = 0; tx < nx; tx++) {
      const idx = tz * nx + tx;
      const a = sgn[idx];
      if (tx + 1 < nx) {
        const b = sgn[idx + 1];
        if (a > 0 !== b > 0) splat(tx + a / (a - b), tz);
      }
      if (tz + 1 < nz) {
        const b = sgn[idx + nx];
        if (a > 0 !== b > 0) splat(tx, tz + a / (a - b));
      }
    }
  }
  const shore = new Float32Array(nx * nz);
  for (let i = 0; i < shore.length; i++) {
    shore[i] = sgn[i] <= 0 ? 0 : best[i] >= reachTexels * reachTexels ? DEEP_M : SHORE_SLOPE * Math.sqrt(best[i]) * texel;
  }

  return { x0, z0, texel, nx, nz, depth, shore, bakeMs: now() - t0, evals };
}

// Bilinear lookup of a baked map at world (x, z) — the CPU twin of the
// shader's texture fetch (texel centres at (i + 0.5) * texel). `channel` is
// 'depth' or 'shore'. Outside the map the sea is deep.
export function depthAt(map, x, z, channel = 'depth') {
  const data = map[channel];
  const fx = (x - map.x0) / map.texel - 0.5;
  const fz = (z - map.z0) / map.texel - 0.5;
  if (fx < -0.5 || fz < -0.5 || fx > map.nx - 0.5 || fz > map.nz - 0.5) return DEEP_M;
  const i0 = Math.floor(fx);
  const j0 = Math.floor(fz);
  const u = fx - i0;
  const v = fz - j0;
  const at = (i, j) => data[Math.min(map.nz - 1, Math.max(0, j)) * map.nx + Math.min(map.nx - 1, Math.max(0, i))];
  return (at(i0, j0) * (1 - u) + at(i0 + 1, j0) * u) * (1 - v) + (at(i0, j0 + 1) * (1 - u) + at(i0 + 1, j0 + 1) * u) * v;
}

// float32 -> float16 bits (round to nearest). Inputs here are 0..DEEP_M, so
// no NaN/Inf/negative handling beyond a flush-to-zero for tiny values.
const _f32 = new Float32Array(1);
const _u32 = new Uint32Array(_f32.buffer);
export function floatToHalf(v) {
  if (!(v > 6.103515625e-5)) return 0;
  if (v >= 65504) return 0x7bff;
  _f32[0] = v;
  const x = _u32[0];
  const mant = x & 0x7fffff;
  let h = ((((x >>> 23) & 0xff) - 112) << 10) | (mant >>> 13);
  if (mant & 0x1000) h += 1;
  return h;
}

// Uploads a baked map as a 2-channel half-float texture (R = depth,
// G = shore). Half float rather than 8-bit: 8-bit depth steps (0.04 m) would
// stair-step the foam ring edges; half float filters linearly in WebGL2.
export function createDepthTexture(map) {
  const n = map.nx * map.nz;
  const data = new Uint16Array(n * 2);
  for (let i = 0; i < n; i++) {
    data[i * 2] = floatToHalf(map.depth[i]);
    data[i * 2 + 1] = floatToHalf(map.shore[i]);
  }
  const tex = new THREE.DataTexture(data, map.nx, map.nz, THREE.RGFormat, THREE.HalfFloatType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

// World rectangle the texture covers, for the shader: (x0, z0, width, depth).
export function depthRect(map) {
  return [map.x0, map.z0, map.nx * map.texel, map.nz * map.texel];
}

// A 1x1 "all deep" texture for callers with no islands to bake (island-lab).
export function createDeepTexture() {
  const tex = new THREE.DataTexture(new Uint16Array([floatToHalf(DEEP_M), floatToHalf(DEEP_M)]), 1, 1, THREE.RGFormat, THREE.HalfFloatType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
