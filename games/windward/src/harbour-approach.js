// Harbour approaches: can a boat sail from open water INTO a harbour (the inner basin, up to the quay), not just to within
// 80 m of it? And where it cannot, the route and carve shape that opens it (tier "harbour" in assets/coast/passes.json).
// Pure (no files, no GPU): tools/build-harbours.mjs feeds it OSM and the game world; tests feed it synthetic ones.
// Builds on src/pass-derive.js (real-water raster, clearance) and src/passes.js (applyPasses, findRoute).
//
// Units: game metres (x east, z south, origin = the coast window's corner); the coast is 1:10, so 1 game m = 10 real m.
// The boat's hull is 2.5 game m (shore.js), so the closest its CENTRE can get to a shore is about 2.5 game m plus the
// raster's smoothing: "reached the harbour" is therefore defined as HARBOUR_REACH_M game m (60 m real) from the quay water.
//
// Credit: coastline, quays and marks are OpenStreetMap, (c) OpenStreetMap contributors, ODbL 1.0.
import { CARVE_MIN_CLEAR_M } from './pass-derive.js';
import { findRoute } from './passes.js';

export const HARBOUR_REACH_M = 6; // the boat's centre can get this close (game m) to the quay water: "in the harbour"
export const ANCHOR_MAX_M = 15; // a target's quay water is the real water nearest to it within this (game m)
export const ANCHOR_TRUST_M = 7; // ... and beyond this the target's point is on land (a village origin, an islet centre): lower confidence
export const BERTH_BACK_M = 3.5; // the carve stops this far (game m) short of the quay water, so the quay itself stays land

// ---- targets ----------------------------------------------------------------------------------------------------
// The real water nearest to a game point: { x, z, d } or null. env: { water (1 = real water), wF, hF, cellF, x0, z0 }.
export function realWaterNear(env, x, z, r = ANCHOR_MAX_M) {
  const { water, wF, hF, cellF, x0, z0 } = env;
  const n = Math.ceil(r / cellF), fa0 = Math.floor((x - x0) / cellF), fb0 = Math.floor((z - z0) / cellF);
  let best = null, bd = Infinity;
  for (let dj = -n; dj <= n; dj++) for (let di = -n; di <= n; di++) {
    const fa = fa0 + di, fb = fb0 + dj;
    if (fa < 0 || fb < 0 || fa >= wF || fb >= hF || !water[fb * wF + fa]) continue;
    const d = Math.hypot(di, dj) * cellF;
    if (d < bd && d <= r) { bd = d; best = { x: x0 + (fa + 0.5) * cellF, z: z0 + (fb + 0.5) * cellF, d }; }
  }
  return best;
}

// How close the boat's centre can get to (x, z) from open water: the distance (game m) to the nearest sailable cell of the
// body `target` (the main sea), or Infinity within `rmax`.
export function reachFromSea({ nx, nz, pxM, x0, z0, sail, label }, target, x, z, rmax = 40) {
  const a0 = Math.floor((x - x0) / pxM), b0 = Math.floor((z - z0) / pxM), n = Math.ceil(rmax / pxM);
  let bd = Infinity;
  for (let dj = -n; dj <= n; dj++) for (let di = -n; di <= n; di++) {
    const a = a0 + di, b = b0 + dj;
    if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
    const k = b * nx + a;
    if (!sail[k] || label[k] !== target) continue;
    const d = Math.hypot(x0 + (a + 0.5) * pxM - x, z0 + (b + 0.5) * pxM - z);
    if (d < bd) bd = d;
  }
  return bd;
}

// ---- the fairway: where the red / green marks and leading lines say the channel is --------------------------------
// marks: [{ x, z, side: 'port' | 'starboard' }] (game m); lines: [[[x, z], ...], ...] leading / clearing lines.
// Returns Float32Array nx*nz, 1 = ordinary water, `discount` (< 1) = in the marked channel: the route prefers it.
export function fairwayMask({ nx, nz, pxM, x0, z0 }, marks, lines = [], { gateMaxM = 25, width = 3, discount = 0.45 } = {}) {
  const out = new Float32Array(nx * nz).fill(1);
  const stamp = (x, z, r) => {
    const a0 = Math.floor((x - r - x0) / pxM), a1 = Math.floor((x + r - x0) / pxM), b0 = Math.floor((z - r - z0) / pxM), b1 = Math.floor((z + r - z0) / pxM);
    for (let b = Math.max(0, b0); b <= Math.min(nz - 1, b1); b++) for (let a = Math.max(0, a0); a <= Math.min(nx - 1, a1); a++) {
      if (Math.hypot(x0 + (a + 0.5) * pxM - x, z0 + (b + 0.5) * pxM - z) <= r) out[b * nx + a] = discount;
    }
  };
  const ports = marks.filter((m) => m.side === 'port'), stbds = marks.filter((m) => m.side === 'starboard');
  const gates = [];
  for (const p of ports) {
    let best = null, bd = Infinity;
    for (const s of stbds) { const d = Math.hypot(p.x - s.x, p.z - s.z); if (d < bd) { bd = d; best = s; } }
    if (best && bd <= gateMaxM) gates.push([(p.x + best.x) / 2, (p.z + best.z) / 2, bd]);
  }
  for (const [x, z, d] of gates) stamp(x, z, Math.max(width, d / 2 + 1));
  for (const line of lines) for (let i = 1; i < line.length; i++) {
    const [ax, az] = line[i - 1], [bx, bz] = line[i], L = Math.hypot(bx - ax, bz - az), steps = Math.max(1, Math.ceil(L / (pxM / 2)));
    for (let s = 0; s <= steps; s++) stamp(ax + ((bx - ax) * s) / steps, az + ((bz - az) * s) / steps, 1.5);
  }
  return { mask: out, gates };
}

// ---- the approach route ---------------------------------------------------------------------------------------------
class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(c, v) { const a = this.a; a.push([c, v]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { let m = i; const l = 2 * i + 1, r = l + 1; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
}

// The least-cost route from the quay water `start` ({ a, b } cell) out to the sailable body `target`, over sailable cells (cheap)
// and real-but-blocked cells (by narrowness), preferring the marked fairway. No early "already open": the caller decides that
// with reachFromSea. Returns { cells: [[a, b], ...] from the quay out to the sea, blocked: [[a, b], ...], cost } or null.
export function approachRoute({ nx, nz, sail, label, clear }, start, target, { fairway = null, minClear = CARVE_MIN_CLEAR_M, maxCells = 260, startRadius = 2 } = {}) {
  const carvable = (k) => !sail[k] && clear[k] >= minClear;
  const fw = (k) => (fairway ? fairway[k] : 1);
  const stepCost = (k) => (sail[k] ? 0.06 : (1 + 14 * Math.max(0, (3 - clear[k]) / 3)) * fw(k));
  const cost = new Float64Array(nx * nz).fill(Infinity), prev = new Int32Array(nx * nz).fill(-1), steps = new Int32Array(nx * nz);
  const heap = new Heap();
  for (let dj = -startRadius; dj <= startRadius; dj++) for (let di = -startRadius; di <= startRadius; di++) {
    const a = start.a + di, b = start.b + dj;
    if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
    const k = b * nx + a;
    if (!sail[k] && !carvable(k)) continue;
    const c = Math.hypot(di, dj) * 0.3;
    if (c < cost[k]) { cost[k] = c; heap.push(c, k); }
  }
  let hit = -1;
  while (heap.size) {
    const [c, k] = heap.pop();
    if (c > cost[k]) continue;
    if (sail[k] && label[k] === target) { hit = k; break; }
    const a = k % nx, b = (k / nx) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const na = a + di, nb = b + dj;
      if (na < 0 || nb < 0 || na >= nx || nb >= nz) continue;
      const nk = nb * nx + na;
      if (!sail[nk] && !carvable(nk)) continue;
      if (steps[k] >= maxCells) continue;
      const nc = c + stepCost(nk) * (di && dj ? 1.414 : 1);
      if (nc < cost[nk]) { cost[nk] = nc; prev[nk] = k; steps[nk] = steps[k] + 1; heap.push(nc, nk); }
    }
  }
  if (hit < 0) return null;
  const cells = [];
  for (let k = hit; k >= 0; k = prev[k]) cells.push(k);
  cells.reverse(); // quay first, sea last (as documented)
  const xy = (k) => [k % nx, (k / nx) | 0];
  return { cells: cells.map(xy), blocked: cells.filter((k) => !sail[k]).map(xy), cost: cost[hit] };
}

// ---- the carve shape: real water + a tube, never into the protected quay ------------------------------------------
// line: [[x, z, clr, half?], ...] from the sea INTO the harbour (game m; clr = real clearance there; half = this stretch's tube half-width, else minHalf). protect(x, z) -> true for a
// cell of land that must stay land (the quay line). Returns rings (game m). Same idea as pass-derive.carveRings.
function distToLine(px, pz, line, dflt) { // nearest point on the polyline: distance, real clearance there, and the tube half-width there (the 4th number of a vertex, else dflt)
  let best = Infinity, clr = 0, half = dflt;
  for (let i = 0; i + 1 < line.length; i++) {
    const [ax, az, ac, ah = dflt] = line[i], [bx, bz, bc, bh = dflt] = line[i + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
    const t = L2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2)) : 0;
    const d = Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
    if (d < best) { best = d; clr = ac + t * (bc - ac); half = ah + t * (bh - ah); }
  }
  return { d: best, clr, half };
}
export function carveHarbourRings({ water, wF, hF, cellF, x0, z0 }, line, { minHalf, corridorPad = 1.0, simplify = 0.3, protect = null, offset = null, bulges = null } = {}) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxClr = 0;
  for (const [x, z, c] of line) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); maxClr = Math.max(maxClr, c); }
  const reach = Math.max(minHalf, maxClr + corridorPad, ...line.map((p) => p[3] ?? 0)) + 2 * cellF;
  const i0 = Math.max(0, Math.floor((minX - reach - x0) / cellF)), i1 = Math.min(wF - 1, Math.ceil((maxX + reach - x0) / cellF));
  const j0 = Math.max(0, Math.floor((minZ - reach - z0) / cellF)), j1 = Math.min(hF - 1, Math.ceil((maxZ + reach - z0) / cellF));
  const w = i1 - i0 + 1, h = j1 - j0 + 1, carve = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = x0 + (i0 + i + 0.5) * cellF, z = z0 + (j0 + j + 0.5) * cellF, { d, clr, half } = distToLine(x, z, line, minHalf);
    const real = water[(j0 + j) * wF + (i0 + i)] === 1;
    if (real && d <= Math.max(clr + corridorPad, 0)) carve[j * w + i] = 1; // the real channel
    else if (d <= half && !(protect && protect(x, z))) carve[j * w + i] = 1; // the widening (per stretch of the route): never into the quay
  }
  // OFFSET mode (offset = { distFine, half }): instead of a tube around the centreline (whose edges are just offsets of ONE line and hide the real
  // banks' bends), grow the REAL water outward by what the boat needs: at each real-water cell near the route the carve extends `half - ridge` game m,
  // where ridge is the local real half-width of the channel (the largest clearance within 3 game m along it). Where the real channel is already wide enough
  // nothing grows, so the outline follows BOTH real banks' bends at a constant minimum width, and wide stretches / basins keep their real shape.
  if (offset) {
    const { distFine, half } = offset, clrW = new Float32Array(w * h), ridge = new Float32Array(w * h), rr = Math.ceil(3 / cellF);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) clrW[j * w + i] = water[(j0 + j) * wF + (i0 + i)] === 1 ? Math.max(0, (distFine[(j0 + j) * wF + (i0 + i)] - 0.5) * cellF) : 0;
    const tmp = new Float32Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { let m = 0; for (let d = -rr; d <= rr; d++) { const a = i + d; if (a >= 0 && a < w) m = Math.max(m, clrW[j * w + a]); } tmp[j * w + i] = m; }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { let m = 0; for (let d = -rr; d <= rr; d++) { const b2 = j + d; if (b2 >= 0 && b2 < h) m = Math.max(m, tmp[b2 * w + i]); } ridge[j * w + i] = m; }
    for (const p of line) { // a pinch (the 5 m raster has cut the real water): the boat's minimum width, as a disc, only there
      if (!p[4]) continue;
      const ci = Math.round((p[0] - x0) / cellF - 0.5) - i0, cj = Math.round((p[1] - z0) / cellF - 0.5) - j0, rc = Math.ceil(half / cellF);
      for (let dj = -rc; dj <= rc; dj++) for (let di = -rc; di <= rc; di++) {
        const a = ci + di, b2 = cj + dj;
        if (a < 0 || b2 < 0 || a >= w || b2 >= h || Math.hypot(di, dj) * cellF > half) continue;
        if (protect && protect(x0 + (i0 + a + 0.5) * cellF, z0 + (j0 + b2 + 0.5) * cellF)) continue;
        carve[b2 * w + a] = 1;
      }
    }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (water[(j0 + j) * wF + (i0 + i)] !== 1) continue;
      const x = x0 + (i0 + i + 0.5) * cellF, z = z0 + (j0 + j + 0.5) * cellF;
      if (distToLine(x, z, line, 0).d > 8) continue; // only near the route
      const need = half - ridge[j * w + i];
      if (need <= 0) continue;
      const rc = Math.ceil(need / cellF);
      for (let dj = -rc; dj <= rc; dj++) for (let di = -rc; di <= rc; di++) {
        const a = i + di, b2 = j + dj;
        if (a < 0 || b2 < 0 || a >= w || b2 >= h || Math.hypot(di, dj) * cellF > need) continue;
        if (protect && water[(j0 + b2) * wF + (i0 + a)] !== 1 && protect(x0 + (i0 + a + 0.5) * cellF, z0 + (j0 + b2 + 0.5) * cellF)) continue;
        carve[b2 * w + a] = 1;
      }
    }
  }
  if (bulges) for (const [bx, bz, br] of bulges) { // local bulges: a disc where the boat would still be blocked (a bend); everything else keeps its width
    const ci = Math.round((bx - x0) / cellF - 0.5) - i0, cj = Math.round((bz - z0) / cellF - 0.5) - j0, rc = Math.ceil(br / cellF);
    for (let dj = -rc; dj <= rc; dj++) for (let di = -rc; di <= rc; di++) {
      const a = ci + di, b2 = cj + dj;
      if (a < 0 || b2 < 0 || a >= w || b2 >= h || Math.hypot(di, dj) * cellF > br) continue;
      if (protect && water[(j0 + b2) * wF + (i0 + a)] !== 1 && protect(x0 + (i0 + a + 0.5) * cellF, z0 + (j0 + b2 + 0.5) * cellF)) continue;
      carve[b2 * w + a] = 1;
    }
  }
  // boundary edges, clockwise around each carved cell, linked into rings
  const vkey = (i, j) => j * (w + 1) + i, out = new Map();
  const edge = (a, b) => { if (!out.has(a)) out.set(a, []); out.get(a).push(b); };
  const on = (i, j) => i >= 0 && j >= 0 && i < w && j < h && carve[j * w + i] === 1;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (!carve[j * w + i]) continue;
    if (!on(i, j - 1)) edge(vkey(i, j), vkey(i + 1, j));
    if (!on(i + 1, j)) edge(vkey(i + 1, j), vkey(i + 1, j + 1));
    if (!on(i, j + 1)) edge(vkey(i + 1, j + 1), vkey(i, j + 1));
    if (!on(i - 1, j)) edge(vkey(i, j + 1), vkey(i, j));
  }
  const rings = [];
  for (const [start] of [...out]) while (out.get(start)?.length) {
    const ring = [start]; let cur = start;
    for (;;) { const nexts = out.get(cur); if (!nexts?.length) break; const nxt = nexts.pop(); if (nxt === start) break; ring.push(nxt); cur = nxt; }
    if (ring.length >= 4) rings.push(ring);
  }
  const toXZ = (v) => [x0 + (i0 + (v % (w + 1))) * cellF, z0 + (j0 + Math.floor(v / (w + 1))) * cellF];
  const dp = (pts, tol) => {
    if (pts.length < 3) return pts;
    let dmax = 0, idx = 0; const [ax, az] = pts[0], [bx, bz] = pts[pts.length - 1], L = Math.hypot(bx - ax, bz - az) || 1e-9;
    for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs((bx - ax) * (az - pts[i][1]) - (ax - pts[i][0]) * (bz - az)) / L; if (d > dmax) { dmax = d; idx = i; } }
    if (dmax <= tol) return [pts[0], pts[pts.length - 1]];
    return [...dp(pts.slice(0, idx + 1), tol).slice(0, -1), ...dp(pts.slice(idx), tol)];
  };
  return rings.map((ring) => {
    const pts = ring.map(toXZ);
    let m = 0, far = 0; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > far) { far = d; m = i; } }
    const a = dp(pts.slice(0, m + 1), simplify), b = dp([...pts.slice(m), pts[0]], simplify);
    return [...a.slice(0, -1), ...b.slice(0, -1)];
  }).filter((r) => r.length >= 3);
}

// A protect(x, z) predicate from polylines (game m): true within `r` game m of any of them (the quay / breakwater lines).
export function protectNear(lines, r = 0.9) {
  const segs = [];
  for (const line of lines) for (let i = 1; i < line.length; i++) segs.push([line[i - 1][0], line[i - 1][1], line[i][0], line[i][1]]);
  return (x, z) => {
    for (const [ax, az, bx, bz] of segs) {
      if (x < Math.min(ax, bx) - r || x > Math.max(ax, bx) + r || z < Math.min(az, bz) - r || z > Math.max(az, bz) + r) continue;
      const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz, t = L2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)) : 0;
      if (Math.hypot(x - (ax + t * dx), z - (az + t * dz)) <= r) return true;
    }
    return false;
  };
}

// ---- a route between two points, and through a list of waypoints (a harbour that is a through-channel) -------------------
// The least-cost route from cell `from` to cell `to` over sailable cells and real-but-blocked ones (same costs as approachRoute),
// preferring the marked fairway. Returns { cells: [[a, b], ...] from -> to, blocked, cost } or null.
export function routeBetween({ nx, nz, sail, clear }, from, to, { fairway = null, minClear = CARVE_MIN_CLEAR_M, maxCells = 600, goalRadius = 1 } = {}) {
  const carvable = (k) => !sail[k] && clear[k] >= minClear;
  const fw = (k) => (fairway ? fairway[k] : 1);
  const stepCost = (k) => (sail[k] ? 0.06 : (1 + 14 * Math.max(0, (3 - clear[k]) / 3)) * fw(k));
  const cost = new Float64Array(nx * nz).fill(Infinity), prev = new Int32Array(nx * nz).fill(-1), steps = new Int32Array(nx * nz);
  const heap = new Heap();
  const k0 = from.b * nx + from.a;
  cost[k0] = 0; heap.push(0, k0);
  let hit = -1;
  while (heap.size) {
    const [c, k] = heap.pop();
    if (c > cost[k]) continue;
    const a = k % nx, b = (k / nx) | 0;
    if (Math.abs(a - to.a) <= goalRadius && Math.abs(b - to.b) <= goalRadius) { hit = k; break; }
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const na = a + di, nb = b + dj;
      if (na < 0 || nb < 0 || na >= nx || nb >= nz) continue;
      const nk = nb * nx + na;
      if (!sail[nk] && !carvable(nk)) continue;
      if (steps[k] >= maxCells) continue;
      const nc = c + stepCost(nk) * (di && dj ? 1.414 : 1);
      if (nc < cost[nk]) { cost[nk] = nc; prev[nk] = k; steps[nk] = steps[k] + 1; heap.push(nc, nk); }
    }
  }
  if (hit < 0) return null;
  const cells = [];
  for (let k = hit; k >= 0; k = prev[k]) cells.push(k);
  cells.reverse();
  const xy = (k) => [k % nx, (k / nx) | 0];
  return { cells: cells.map(xy), blocked: cells.filter((k) => !sail[k]).map(xy), cost: cost[hit] };
}

// Chain routeBetween over waypoints [{ a, b }, ...] (cells). Returns { cells, blocked, legs: [index in cells where each waypoint falls] } or null.
export function routeThrough(grid, waypoints, opts = {}) {
  const cells = [], blocked = [], legs = [0];
  for (let i = 1; i < waypoints.length; i++) {
    const r = routeBetween(grid, waypoints[i - 1], waypoints[i], opts);
    if (!r) return null;
    const startAt = i === 1 ? 0 : 1; // the leg's first cell is the previous leg's last
    for (let j = startAt; j < r.cells.length; j++) cells.push(r.cells[j]);
    for (const c of r.blocked) blocked.push(c);
    legs.push(cells.length - 1);
  }
  return { cells, blocked, legs };
}

// Can the boat sail THROUGH a list of waypoints in order, each leg inside a small box around its two ends? ([x, z] game m)
// The small margin is the point: a through-channel's two ends often open onto the same sea, so a test that only asks "north end to
// south end" is satisfied by sailing round the island. Chaining consecutive legs (north entrance, village, bridge, basin, exit) with a
// tight margin means the boat has to use the channel. legLimits (optional): the expected length of each leg (game m); a leg may be
// at most `detour` times that plus 20 m. Returns { ok, length, legs: [...], path: [[x, z], ...] } or { ok: false, leg, reason, path (what was found before it failed) }.
export function findRouteVia(world, points, { margin = 25, legLimits = null, detour = 1.6 } = {}) {
  const legs = [], path = []; let total = 0;
  for (let i = 1; i < points.length; i++) {
    const r = findRoute(world, points[i - 1], points[i], { margin });
    if (!r.ok) return { ok: false, leg: i, reason: r.reason, path };
    const limit = legLimits ? legLimits[i - 1] * detour + 20 : Infinity;
    if (r.length > limit) return { ok: false, leg: i, reason: 'detour', length: r.length, limit, path };
    legs.push(r.length); total += r.length;
    for (let j = i === 1 ? 0 : 1; j < r.path.length; j++) path.push(r.path[j]);
  }
  return { ok: true, length: total, legs, path };
}

// ---- a centreline that follows the real channel's curves ------------------------------------------------------------------------
// The route over the 2 m game cells, smoothed, flattens a winding channel into a near-straight cut. This re-routes between the same two ends over the
// 5 m REAL-water raster, staying within `corridor` game m of the coarse line, in the middle of the real channel (the cost falls with real clearance), so
// the carve's tube follows the real channel's bends. Returns [[x, z, clr], ...] about every `step` game m with the exact end points, or null
// when no real-water path exists inside the corridor (the caller keeps the coarse line).
// env: { water, wF, hF, cellF, x0, z0 }; distFine: distance to land per fine cell (cells), same grid (pass-derive distanceToLand).
export function refineLine(env, distFine, coarse, { corridor = 6, step = 1.0, maxWander = 1.6, smoothPasses = 6 } = {}) {
  const { water, wF, hF, cellF, x0, z0 } = env;
  if (coarse.length < 2) return null;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of coarse) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
  const pad = corridor + 2 * cellF;
  const i0 = Math.max(0, Math.floor((minX - pad - x0) / cellF)), i1 = Math.min(wF - 1, Math.ceil((maxX + pad - x0) / cellF));
  const j0 = Math.max(0, Math.floor((minZ - pad - z0) / cellF)), j1 = Math.min(hF - 1, Math.ceil((maxZ + pad - z0) / cellF));
  const w = i1 - i0 + 1, h = j1 - j0 + 1;
  const xy = (i, j) => [x0 + (i0 + i + 0.5) * cellF, z0 + (j0 + j + 0.5) * cellF];
  const inCorridor = new Uint8Array(w * h), okWater = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const [x, z] = xy(i, j);
    inCorridor[j * w + i] = distToLine(x, z, coarse, 0).d <= corridor ? 1 : 0;
    okWater[j * w + i] = water[(j0 + j) * wF + (i0 + i)] === 1 ? 1 : 0;
  }
  // a cell is passable if it is real water, or (at a high price) within one cell of real water: a pinch the 5 m raster has cut
  const near = (i, j) => { for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < w && b < h && okWater[b * w + a]) return true; } return false; };
  const nearest = (p) => { let best = -1, bd = Infinity; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { if (!inCorridor[j * w + i] || !okWater[j * w + i]) continue; const [x, z] = xy(i, j), d = Math.hypot(x - p[0], z - p[1]); if (d < bd) { bd = d; best = j * w + i; } } return best; };
  const s = nearest(coarse[0]), t = nearest(coarse[coarse.length - 1]);
  if (s < 0 || t < 0) return null;
  const cost = new Float64Array(w * h).fill(Infinity), prev = new Int32Array(w * h).fill(-1), heap = new Heap();
  cost[s] = 0; heap.push(0, s);
  while (heap.size) {
    const [c, k] = heap.pop();
    if (c > cost[k]) continue;
    if (k === t) break;
    const i = k % w, j = (k / w) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= w || b >= h) continue;
      const nk = b * w + a;
      if (!inCorridor[nk]) continue;
      const wet = okWater[nk] === 1;
      if (!wet && !near(a, b)) continue;
      const d = wet ? distFine[(j0 + b) * wF + (i0 + a)] : 0; // clearance in fine cells
      const nc = c + (di && dj ? 1.414 : 1) * cellF * (1 + 7 / (0.4 + d)) * (wet ? 1 : 6);
      if (nc < cost[nk]) { cost[nk] = nc; prev[nk] = k; heap.push(nc, nk); }
    }
  }
  if (!(cost[t] < Infinity)) return null;
  const path = [];
  for (let k = t; k >= 0; k = prev[k]) { const i = k % w, j = (k / w) | 0, [x, z] = xy(i, j); path.push([x, z, Math.max(0, (distFine[(j0 + j) * wF + (i0 + i)] - 0.5) * cellF), okWater[k] ? 0 : 1]); } // 4th: 1 = a pinch (the 5 m raster has cut the water here)
  path.reverse();
  // resample every `step` game m, then ONE light smoothing pass (the curves stay)
  const dense = []; let acc = 0, next = 0, pinchSeen = false;
  for (let i = 0; i < path.length; i++) {
    if (i) acc += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    if (path[i][3]) pinchSeen = true;
    if (acc >= next || i === path.length - 1) { dense.push([path[i][0], path[i][1], path[i][2], pinchSeen ? 1 : 0]); pinchSeen = false; next = acc + step; }
  }
  let sm = dense; // a few light smoothing passes (a 5 m raster cell is jittery; the channel's real bends are about 100 m across, so they stay)
  for (let it = 0; it < smoothPasses; it++) sm = sm.map((p, i) => (i === 0 || i === sm.length - 1 ? p : [(sm[i - 1][0] + 2 * p[0] + sm[i + 1][0]) / 4, (sm[i - 1][1] + 2 * p[1] + sm[i + 1][1]) / 4, p[2]]));
  sm = sm.map((p, i) => [p[0], p[1], p[2], undefined, dense[i][3]]); // [x, z, clr, half (unset), pinch]
  sm[0] = [coarse[0][0], coarse[0][1], sm[0][2], undefined, 0]; sm[sm.length - 1] = [coarse[coarse.length - 1][0], coarse[coarse.length - 1][1], sm[sm.length - 1][2], undefined, 0]; // the exact ends
  const len = (l) => l.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - l[i - 1][0], p[1] - l[i - 1][1]) : 0), 0);
  if (len(sm) > maxWander * len(coarse) + 4) return null; // it wandered: keep the coarse line
  return sm;
}
