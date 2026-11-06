// Passes (Felix's option B, GAME-DESIGN.md "Decisions 2026-11-06, morning"): keep the coast at 1:10 and carve a
// hand-picked list of real sounds and natural harbours so the boat can sail through them.
//
// Why: at 1:10 the boat (HULL_RADIUS_M 2.5 game m) acts like an ~80 m ship that needs ~50 m of real gap, and the 20 m
// raster plus its smoothing closes real passes under ~40-60 m. assets/coast/passes.json lists them, each with a carve
// polygon taken from OSM's coastline (the real shape) widened to the boat's minimum at the narrowest point.
//
//   const world = buildCoastWorld(coast, { skerries });        // src/coast-world.js
//   const report = applyPasses(world, passesJson);             // carve land -> water, lower the banks, refresh the depth map
//   const terrain = createCoastTerrain(world);                 // ...AFTER, so meshes and collision see the carved coast
//
// applyPasses is PURE in the sense that it only changes the world's own arrays (H, CL, depthMap) and a small
// world.carvedPasses set: it never touches the scene, the DOM or the network. It is deterministic, and idempotent because
// each pass is carved at most once per world (running it twice changes nothing more).
// Not wired into game.js yet (stage 1d does that).
//
// Credit: the carve shapes derive from OpenStreetMap's coastline, (c) OpenStreetMap contributors, ODbL 1.0.
import { BLOCK_H, HULL_RADIUS_M, isBlocked } from './shore.js';
import { DEEP_M, depthAndShoreFromSigned } from './depthmap.js';

export const PASS_TIERS = ['ship', 'harbour', 'later', 'eye']; // harbour = an approach into a harbour (carved WITH ship, may be wider than x1.7); eye = widened more than 2x: never carved by default
export const LAND_LIFT_M = 0.4; // the coast's land lift (coast-world.js): the carved shore uses the same base
export const CARVE_MIN_DEPTH_M = 1.8; // at the edge of a carved pass the sea is this deep (the boat is blocked above 0.9)
export const CARVE_MAX_DEPTH_M = 4.0; // ...and deepens toward the middle, so the pass looks like a channel, not a ditch
export const CARVE_DEEPEN_PER_M = 0.4; // metres of depth per game metre from the edge
export const BANK_BLEND_M = 12; // land this close to a carved edge is lowered smoothly (game m)
export const BANK_SLOPE = 0.45; // the lowered bank rises this many metres per game metre from the edge

// ---- geometry ----------------------------------------------------------------------------------------------------
// ring: [[lon, lat], ...] -> [[x, z], ...] game metres
const ringToGame = (world, ring) => ring.map(([lon, lat]) => world.toGame(lon, lat));

function pointInRing(x, z, ring) { // even-odd, ring in game metres
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

// The cells (indices) whose centre is inside the pass polygon (rings are even-odd: an inner ring is a hole).
function polygonCells(world, rings) {
  const g = rings.map((r) => ringToGame(world, r));
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const r of g) for (const [x, z] of r) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
  const a0 = Math.max(0, Math.floor((minX - world.x0) / world.pxM)), a1 = Math.min(world.nx - 1, Math.ceil((maxX - world.x0) / world.pxM));
  const b0 = Math.max(0, Math.floor((minZ - world.z0) / world.pxM)), b1 = Math.min(world.nz - 1, Math.ceil((maxZ - world.z0) / world.pxM));
  const cells = [];
  for (let b = b0; b <= b1; b++) {
    const z = world.z0 + (b + 0.5) * world.pxM;
    for (let a = a0; a <= a1; a++) {
      const x = world.x0 + (a + 0.5) * world.pxM;
      let n = 0;
      for (const r of g) if (pointInRing(x, z, r)) n++;
      if (n & 1) cells.push(b * world.nx + a);
    }
  }
  return { cells, box: { a0, a1, b0, b1 } };
}

// Forget which passes were carved (call it when you put the world's height field back, e.g. in a test or a tool).
export const resetPasses = (world) => { world.carvedPasses?.clear(); };

// ---- the carve ---------------------------------------------------------------------------------------------------
// passes: the parsed assets/coast/passes.json (or just its `passes` array).
// options: { tiers: ['ship'] (which tiers to carve), ids: null (or a list: overrides tiers), depth: true (refresh the water's depth map) }
// Returns { carved: [{ id, cells, lowered }], changedCells, depthMs }.
export function applyPasses(world, passes, { tiers = ['ship', 'harbour'], ids = null, depth = true } = {}) {
  // each pass is carved at most once per world (the bank blend is relative to the current ground, so a repeat would lower it again)
  const done = (world.carvedPasses ??= new Set());
  const list = (Array.isArray(passes) ? passes : passes.passes).filter((p) => (ids ? ids.includes(p.id) : tiers.includes(p.tier)) && !done.has(p.id));
  for (const p of list) done.add(p.id);
  const { nx, nz, pxM, H, CL } = world;
  const touched = new Set();
  const carved = [];
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  for (const p of list) {
    const { cells, box } = polygonCells(world, p.polygon);
    if (!cells.length) { carved.push({ id: p.id, cells: 0, lowered: 0 }); continue; }
    // distances by a small two-pass chamfer on a padded grid: dIn = from each carved cell to the nearest cell outside,
    // dOut = from each outside cell to the nearest carved cell (the padding covers the bank blend)
    const pad = Math.ceil(BANK_BLEND_M / pxM) + 2;
    const W = box.a1 - box.a0 + 1 + 2 * pad, Hh = box.b1 - box.b0 + 1 + 2 * pad;
    const idx = (a, b) => (b - box.b0 + pad) * W + (a - box.a0 + pad);
    const mask = new Uint8Array(W * Hh);
    for (const k of cells) mask[idx(k % nx, (k / nx) | 0)] = 1;
    const chamfer = (arr) => {
      const D1 = 1, D2 = 1.414;
      for (let b = 1; b < Hh - 1; b++) for (let a = 1; a < W - 1; a++) { const i = b * W + a; arr[i] = Math.min(arr[i], arr[i - 1] + D1, arr[i - W] + D1, arr[i - W - 1] + D2, arr[i - W + 1] + D2); }
      for (let b = Hh - 2; b >= 1; b--) for (let a = W - 2; a >= 1; a--) { const i = b * W + a; arr[i] = Math.min(arr[i], arr[i + 1] + D1, arr[i + W] + D1, arr[i + W + 1] + D2, arr[i + W - 1] + D2); }
    };
    const dIn = new Float32Array(W * Hh), dOut = new Float32Array(W * Hh);
    for (let i = 0; i < mask.length; i++) { dIn[i] = mask[i] ? 1e9 : 0; dOut[i] = mask[i] ? 0 : 1e9; }
    chamfer(dIn); chamfer(dOut);
    // 1. carve: inside cells become water, deeper toward the middle
    for (const k of cells) {
      const edge = Math.max(0.5, dIn[idx(k % nx, (k / nx) | 0)]) * pxM; // game m to the edge (a cell centre is half a cell in)
      const d = Math.min(CARVE_MAX_DEPTH_M, CARVE_MIN_DEPTH_M + CARVE_DEEPEN_PER_M * (edge - pxM / 2));
      if (-d < H[k]) H[k] = -d; // never raise water that is already deeper
      CL[k] = 0;
      touched.add(k);
    }
    // 2. the banks: land close to the carved edge is lowered smoothly (a bank, not a cliff)
    let lowered = 0;
    for (let b = Math.max(0, box.b0 - pad + 1); b <= Math.min(nz - 1, box.b1 + pad - 1); b++) {
      for (let a = Math.max(0, box.a0 - pad + 1); a <= Math.min(nx - 1, box.a1 + pad - 1); a++) {
        const k = b * nx + a;
        if (mask[idx(a, b)] || H[k] <= LAND_LIFT_M) continue;
        const d = dOut[idx(a, b)] * pxM; // game m from the carved water
        if (d > BANK_BLEND_M) continue;
        const cap = LAND_LIFT_M + BANK_SLOPE * Math.max(0, d - pxM / 2); // the bank line: a gentle slope up from the carved edge
        // the lowering fades out toward the blend distance (smoothstep), so the bank merges into the original ground: no cliff
        const u = Math.min(1, Math.max(0, (d - 0.35 * BANK_BLEND_M) / (0.65 * BANK_BLEND_M))), t = u * u * (3 - 2 * u);
        const next = cap + (H[k] - cap) * t;
        if (next < H[k] - 1e-6) { H[k] = next; lowered++; touched.add(k); }
      }
    }
    carved.push({ id: p.id, cells: cells.length, lowered });
  }
  let depthMs = 0;
  if (depth && touched.size && world.depthMap) { // the sea's colour / shore foam come from the height field: refresh them
    const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const sgn = new Float32Array(nx * nz);
    for (let k = 0; k < sgn.length; k++) sgn[k] = Math.max(-DEEP_M, Math.min(DEEP_M, -H[k]));
    const { depth: dep, shore } = depthAndShoreFromSigned(sgn, nx, nz, pxM);
    world.depthMap.depth = dep; world.depthMap.shore = shore;
    depthMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t1;
  }
  return { carved, changedCells: touched.size, depthMs, totalMs: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0 };
}

// The cells (box in cell coordinates) a pass can change, grown by `pad` cells: where the sailable mask must be re-read.
export function passCellBox(world, pass, pad = 4) {
  const { box } = polygonCells(world, pass.polygon);
  return { a0: Math.max(0, box.a0 - pad), a1: Math.min(world.nx - 1, box.a1 + pad), b0: Math.max(0, box.b0 - pad), b1: Math.min(world.nz - 1, box.b1 + pad) };
}

// ---- is it sailable? -----------------------------------------------------------------------------------------------
// A route from `from` to `to` ([x, z] game m) over the world with the game's own collision rule (shore.js isBlocked,
// hull radius included). Breadth-first over 8-neighbour cell centres, with each step (and diagonal squeeze) tested.
// Stays inside the box of the two points grown by `margin` game m, so "the long way round" does not count.
// Returns { ok, length (game m), path: [[x, z]...] }.
export function findRoute(world, from, to, { margin = 60 } = {}) {
  const { nx, nz, pxM, x0, z0, heightAt } = world;
  const cell = (p) => [Math.floor((p[0] - x0) / pxM), Math.floor((p[1] - z0) / pxM)];
  const [fa, fb] = cell(from), [ta, tb] = cell(to);
  const a0 = Math.max(0, Math.min(fa, ta) - Math.ceil(margin / pxM)), a1 = Math.min(nx - 1, Math.max(fa, ta) + Math.ceil(margin / pxM));
  const b0 = Math.max(0, Math.min(fb, tb) - Math.ceil(margin / pxM)), b1 = Math.min(nz - 1, Math.max(fb, tb) + Math.ceil(margin / pxM));
  const W = a1 - a0 + 1, Hh = b1 - b0 + 1;
  const centre = (a, b) => [x0 + (a + 0.5) * pxM, z0 + (b + 0.5) * pxM];
  const free = new Int8Array(W * Hh).fill(-1);
  const isFree = (a, b) => { const i = (b - b0) * W + (a - a0); if (free[i] < 0) { const c = centre(a, b); free[i] = isBlocked(heightAt, c[0], c[1]) ? 0 : 1; } return free[i] === 1; };
  const key = (a, b) => (b - b0) * W + (a - a0);
  const dist = new Float64Array(W * Hh).fill(Infinity), prev = new Int32Array(W * Hh).fill(-1);
  dist[key(fa, fb)] = 0;
  if (!isFree(fa, fb) || !isFree(ta, tb)) return { ok: false, length: Infinity, path: [], reason: 'an end is blocked' };
  // Dijkstra by a simple bucketed queue would do; a binary heap on a small box is plenty
  const heap = [[0, key(fa, fb)]];
  const push = (c, v) => { heap.push([c, v]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let m = i; const l = 2 * i + 1, r = l + 1; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const goal = key(ta, tb);
  while (heap.length) {
    const [c, k] = pop();
    if (c > dist[k]) continue;
    if (k === goal) break;
    const a = (k % W) + a0, b = ((k / W) | 0) + b0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const na = a + di, nb = b + dj;
      if (na < a0 || nb < b0 || na > a1 || nb > b1 || !isFree(na, nb)) continue;
      if (di && dj && (!isFree(a + di, b) || !isFree(a, b + dj))) continue; // no squeezing through a diagonal corner
      const nk = key(na, nb), nc = c + (di && dj ? 1.414 : 1) * pxM;
      if (nc < dist[nk]) { dist[nk] = nc; prev[nk] = k; push(nc, nk); }
    }
  }
  if (dist[goal] === Infinity) return { ok: false, length: Infinity, path: [], reason: 'no route' };
  const path = [];
  for (let k = goal; k >= 0; k = prev[k]) path.push(centre((k % W) + a0, ((k / W) | 0) + b0));
  return { ok: true, length: dist[goal], path: path.reverse() };
}

export const passEnds = (world, p) => [world.toGame(p.a.lon, p.a.lat), world.toGame(p.b.lon, p.b.lat)];
export { HULL_RADIUS_M, BLOCK_H };
