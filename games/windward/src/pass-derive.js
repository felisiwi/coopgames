// Finding the passes the 1:10 raster closes (Felix's option B, GAME-DESIGN.md "Decisions 2026-11-06, morning").
// Pure (no files, no GPU): tools/build-passes.mjs feeds it OSM coastline and the game world; tests feed it synthetic ones.
//
// Idea: the game's 20 m raster (plus smoothing, plus the boat's hull radius) closes real sounds and natural-harbour
// entrances that are 10-60 m wide. OSM's coastline is sharp, so rasterise it at 5 m and compare:
//   REAL clearance  = how far each metre of real water is from real land (a distance transform of the 5 m raster)
//   GAME sailable   = cells where the boat is not blocked (src/shore.js isBlocked: the same rule the game uses)
// A PASS is a route of real water the game blocks that joins two different large bodies of sailable water.
// Everything is in game metres (x east, z south, origin = the coast window's corner). The coast is 1:10: 1 game m = 10 real m.
//
// Credit: the coastline is OpenStreetMap, (c) OpenStreetMap contributors, ODbL 1.0.

// ---- OSM ways -> segments in game metres, split where the geometry leaves the query box (null points) ----------
// elements: Overpass `out geom` ways. toGame(lon, lat) -> [x, z]. Returns a Float64Array [ax, az, bx, bz, ...].
export function segmentsFromWays(elements, toGame) {
  const out = [];
  for (const el of elements) {
    if (el.type !== 'way' || !el.geometry) continue;
    let prev = null;
    for (const p of el.geometry) {
      if (!p) { prev = null; continue; }
      const g = toGame(p.lon, p.lat);
      if (prev) out.push(prev[0], prev[1], g[0], g[1]);
      prev = g;
    }
  }
  return Float64Array.from(out);
}

// ---- real water: even-odd scanline fill. 1 = water, 0 = land. ---------------------------------------------------
// The raster's WEST edge is assumed to be open sea (the query box reaches 3 km further west); a row with an odd number
// of crossings has land running on to the east (a coast that leaves the box).
export function rasterWater(segs, { x0, z0, w, h, cell }) {
  const rows = Array.from({ length: h }, () => []);
  for (let i = 0; i < segs.length; i += 4) {
    let ax = segs[i], az = segs[i + 1], bx = segs[i + 2], bz = segs[i + 3];
    if (az === bz) continue;
    if (az > bz) { [ax, bx] = [bx, ax]; [az, bz] = [bz, az]; }
    const j0 = Math.max(0, Math.ceil((az - z0) / cell - 0.5)), j1 = Math.min(h - 1, Math.ceil((bz - z0) / cell - 0.5) - 1);
    for (let j = j0; j <= j1; j++) {
      const zc = z0 + (j + 0.5) * cell;
      rows[j].push(ax + ((zc - az) / (bz - az)) * (bx - ax));
    }
  }
  const mask = new Uint8Array(w * h).fill(1);
  for (let j = 0; j < h; j++) {
    const xs = rows[j].sort((p, q) => p - q);
    for (let k = 0; k < xs.length; k += 2) {
      const a = Math.max(0, Math.ceil((xs[k] - x0) / cell - 0.5));
      const b = k + 1 < xs.length ? Math.min(w - 1, Math.ceil((xs[k + 1] - x0) / cell - 0.5) - 1) : w - 1;
      for (let i = a; i <= b; i++) mask[j * w + i] = 0;
    }
  }
  return mask;
}

// ---- exact Euclidean distance (cells) from every water cell to the nearest land cell (Felzenszwalb) ---------------
function edt1d(f, n, d, v, z) { // lower envelope of parabolas (Felzenszwalb & Huttenlocher)
  let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}
export function distanceToLand(water, w, h) {
  const INF = 1e12, out = new Float32Array(w * h);
  const m = Math.max(w, h), f = new Float64Array(m), d = new Float64Array(m), v = new Int32Array(m), z = new Float64Array(m + 1);
  const tmp = new Float64Array(w * h);
  for (let i = 0; i < w; i++) { // columns
    for (let j = 0; j < h; j++) f[j] = water[j * w + i] ? INF : 0;
    edt1d(f, h, d, v, z);
    for (let j = 0; j < h; j++) tmp[j * w + i] = d[j];
  }
  for (let j = 0; j < h; j++) { // rows
    for (let i = 0; i < w; i++) f[i] = tmp[j * w + i];
    edt1d(f, w, d, v, z);
    for (let i = 0; i < w; i++) out[j * w + i] = water[j * w + i] ? Math.sqrt(d[i]) : 0;
  }
  return out;
}

// ---- game side ---------------------------------------------------------------------------------------------------
// sailable[k] = 1 where a boat centred on cell k is not blocked (isBlocked(heightAt, x, z), the game's rule).
export function sailableMask(world, isBlocked) {
  const out = new Uint8Array(world.nx * world.nz);
  for (let b = 0; b < world.nz; b++) {
    const z = world.z0 + (b + 0.5) * world.pxM;
    for (let a = 0; a < world.nx; a++) out[b * world.nx + a] = isBlocked(world.heightAt, world.x0 + (a + 0.5) * world.pxM, z) ? 0 : 1;
  }
  return out;
}

// 8-neighbour connected components of a mask. Returns { label: Int32Array (-1 = none), sizes: number[] }.
export function components(mask, w, h) {
  const label = new Int32Array(w * h).fill(-1), sizes = [];
  const stack = [];
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || label[s] !== -1) continue;
    const id = sizes.length; let n = 0; stack.push(s); label[s] = id;
    while (stack.length) {
      const i = stack.pop(); n++;
      const ia = i % w, ib = (i / w) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const na = ia + di, nb = ib + dj;
        if ((!di && !dj) || na < 0 || nb < 0 || na >= w || nb >= h) continue;
        const ni = nb * w + na;
        if (mask[ni] && label[ni] === -1) { label[ni] = id; stack.push(ni); }
      }
    }
    sizes.push(n);
  }
  return { label, sizes };
}

// Per game cell: the largest real clearance (game m) of any of its (ratio x ratio) fine cells.
export function cellClearance(clearFine, wF, ratio, nx, nz, cellF) {
  const out = new Float32Array(nx * nz);
  for (let b = 0; b < nz; b++) for (let a = 0; a < nx; a++) {
    let best = 0;
    for (let dj = 0; dj < ratio; dj++) {
      const row = (b * ratio + dj) * wF + a * ratio;
      for (let di = 0; di < ratio; di++) { const c = clearFine[row + di]; if (c > best) best = c; }
    }
    out[b * nx + a] = Math.max(0, best - 0.5) * cellF; // centre-to-land distance minus half a cell, in game m
  }
  return out;
}

class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(c, v) { const a = this.a; a.push([c, v]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (;;) { let m = i; const l = 2 * i + 1, r = l + 1; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } }
    return top;
  }
}

// ---- the bridge finder --------------------------------------------------------------------------------------------
export const BIG_BODY_CELLS = 250; // a body of sailable water counts as "a sea" from this many cells (1000 game m^2 = 100,000 m^2 real)
export const CARVE_MIN_CLEAR_M = 0.55; // real clearance (game m) a cell needs to count as real, passable water (11 m real across)
export const MAX_ROUTE_CELLS = 70;
const COST_LIMIT = 150;

// Routes of real water the game blocks, joining two different big sailable bodies.
// in: { nx, nz, pxM, sail (Uint8Array), label/sizes (components of sail), clear (Float32 game m per cell) }
// out: [{ from, to (component ids), cells: [[a, b], ...] (the BLOCKED cells in order, from `from` to `to`), cost }]
export function findBridges({ nx, nz, sail, label, sizes, clear }, { maxPerPair = 4, bigCells = BIG_BODY_CELLS, minClear = CARVE_MIN_CLEAR_M } = {}) {
  const carvable = (k) => !sail[k] && clear[k] >= minClear;
  const cellCost = (k) => 1 + 20 * Math.max(0, (3 - clear[k]) / 3); // prefer the wide parts: the middle of the channel
  const big = sizes.map((n, i) => (n >= bigCells ? i : -1)).filter((i) => i >= 0);
  const results = [];
  // boundary cells of each big body: carvable cells touching it
  const touching = new Map(big.map((id) => [id, []]));
  for (let b = 0; b < nz; b++) for (let a = 0; a < nx; a++) {
    const k = b * nx + a;
    if (!carvable(k)) continue;
    const seen = new Set();
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const na = a + di, nb = b + dj;
      if (na < 0 || nb < 0 || na >= nx || nb >= nz) continue;
      const l = label[nb * nx + na];
      if (l >= 0 && touching.has(l) && !seen.has(l)) { seen.add(l); touching.get(l).push(k); }
    }
  }
  for (const A of big) {
    const starts = touching.get(A);
    if (!starts.length) continue;
    const cost = new Float32Array(nx * nz).fill(Infinity), prev = new Int32Array(nx * nz).fill(-1), steps = new Int32Array(nx * nz);
    const heap = new Heap();
    for (const k of starts) { cost[k] = cellCost(k); steps[k] = 1; heap.push(cost[k], k); }
    while (heap.size) {
      const [c, k] = heap.pop();
      if (c > cost[k]) continue;
      const a = k % nx, b = (k / nx) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const na = a + di, nb = b + dj;
        if (na < 0 || nb < 0 || na >= nx || nb >= nz) continue;
        const nk = nb * nx + na;
        if (!carvable(nk) || steps[k] >= MAX_ROUTE_CELLS) continue;
        const nc = c + cellCost(nk) * (di && dj ? 1.414 : 1);
        if (nc < cost[nk] && nc < COST_LIMIT) { cost[nk] = nc; prev[nk] = k; steps[nk] = steps[k] + 1; heap.push(nc, nk); }
      }
    }
    // landings: reached cells touching another big body B > A; best few per B, spatially separate
    const landings = new Map();
    for (let k = 0; k < cost.length; k++) {
      if (cost[k] === Infinity) continue;
      const a = k % nx, b = (k / nx) | 0, seen = new Set();
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const na = a + di, nb = b + dj;
        if (na < 0 || nb < 0 || na >= nx || nb >= nz) continue;
        const l = label[nb * nx + na];
        if (l > A && touching.has(l) && !seen.has(l)) { seen.add(l); if (!landings.has(l)) landings.set(l, []); landings.get(l).push(k); }
      }
    }
    for (const [B, ks] of landings) {
      ks.sort((p, q) => cost[p] - cost[q]);
      const used = new Set(), picked = [];
      for (const k of ks) {
        if (picked.length >= maxPerPair) break;
        const cells = [];
        for (let c = k; c >= 0; c = prev[c]) cells.push(c);
        if (cells.some((c) => used.has(c))) continue;
        picked.push({ from: A, to: B, cells: cells.reverse().map((c) => [c % nx, (c / nx) | 0]), cost: cost[k] });
        for (const c of cells) for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) { const na = (c % nx) + di, nb = ((c / nx) | 0) + dj; if (na >= 0 && nb >= 0 && na < nx && nb < nz) used.add(nb * nx + na); }
      }
      results.push(...picked);
    }
  }
  return results;
}

// ---- routing from a place out to the main sea ----------------------------------------------------------------------
// The least-cost route from `src` ({ a, b }: a cell) to any cell of the sailable body `target`, over sailable cells
// (almost free) and real-but-blocked "carvable" cells (cost by narrowness, so it keeps to the middle of the channel).
// Returns { open: true } when the source already sits in the target body, or
// { open: false, cells: [[a, b], ...] (the whole route from the source), blocked: [...] (only the cells the game
// blocks), cost }, or null when no route of real water exists within the limits.
export function routeToBody({ nx, nz, sail, label, clear }, src, target, { minClear = CARVE_MIN_CLEAR_M, maxCells = 160, startRadius = 12 } = {}) {
  const carvable = (k) => !sail[k] && clear[k] >= minClear;
  const stepCost = (k) => (sail[k] ? 0.05 : 1 + 20 * Math.max(0, (3 - clear[k]) / 3));
  const start = [];
  for (let dj = -startRadius; dj <= startRadius; dj++) for (let di = -startRadius; di <= startRadius; di++) {
    const a = src.a + di, b = src.b + dj;
    if (a < 0 || b < 0 || a >= nx || b >= nz || di * di + dj * dj > startRadius * startRadius) continue;
    const k = b * nx + a;
    if (sail[k] || carvable(k)) start.push([k, Math.hypot(di, dj)]);
  }
  if (!start.length) return null;
  if (start.some(([k, d]) => d <= 4 && sail[k] && label[k] === target)) return { open: true };
  const cost = new Float32Array(nx * nz).fill(Infinity), prev = new Int32Array(nx * nz).fill(-1), steps = new Int32Array(nx * nz);
  const heap = new Heap();
  for (const [k, d] of start) { const c = d * 0.3; if (c < cost[k]) { cost[k] = c; heap.push(c, k); } }
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
  cells.reverse();
  const xy = (k) => [k % nx, (k / nx) | 0];
  return { open: false, cells: cells.map(xy), blocked: cells.filter((k) => !sail[k]).map(xy), cost: cost[hit] };
}

// ---- trips: which closed passes would actually shorten a sail between two places -----------------------------------
// Dial's algorithm (a bucket queue) on integer step costs: fast enough for hundreds of searches over the whole window.
// enter[k] = cost of stepping INTO cell k (0 = impassable). A diagonal step costs 1.4x. Returns { dist: Int32Array (-1 = unreached), prev }.
export function bucketField(nx, nz, sources, enter, limit) {
  const n = nx * nz, dist = new Int32Array(n).fill(-1), prev = new Int32Array(n).fill(-1);
  const best = new Int32Array(n).fill(0x7fffffff);
  let maxEnter = 1; for (let k = 0; k < n; k++) if (enter[k] > maxEnter) maxEnter = enter[k];
  const R = Math.ceil(maxEnter * 1.5) + 2, buckets = Array.from({ length: R }, () => []);
  let pending = 0;
  for (const s of sources) { if (best[s] > 0) { best[s] = 0; buckets[0].push(s); pending++; } }
  for (let d = 0; pending > 0 && d <= limit; d++) {
    const bucket = buckets[d % R];
    while (bucket.length) {
      const k = bucket.pop(); pending--;
      if (best[k] !== d || dist[k] !== -1) continue;
      dist[k] = d;
      const a = k % nx, b = (k / nx) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const na = a + di, nb = b + dj;
        if (na < 0 || nb < 0 || na >= nx || nb >= nz) continue;
        const nk = nb * nx + na, e = enter[nk];
        if (!e || dist[nk] !== -1) continue;
        const nd = d + (di && dj ? Math.round(e * 1.4) : e);
        if (nd < best[nk] && nd <= limit) { best[nk] = nd; prev[nk] = k; buckets[nd % R].push(nk); pending++; }
      }
    }
  }
  return { dist, prev };
}
export const pathFrom = (prev, k) => { const out = []; for (let c = k; c >= 0; c = prev[c]) out.push(c); return out.reverse(); };

export const TRIP_UNIT = 10; // integer cost of one open cell step
export const CARVE_PENALTY = 3; // extra cost (in steps) per carved cell: a shortcut must be worth the cutting
// places: [{ id, name, a, b }] (cells). grid: { nx, nz, sail, clear }.
// Returns the closed stretches that make a trip clearly shorter:
// [{ key, cells (the blocked cells, in order), savedCells (the best FINITE saving, in cells), savedTotalCells (summed over
//    distinct trips), finiteTrips, unlockTrips (trips whose destination the game cannot reach at all without it), trips }]
export function tripShortcuts({ nx, nz, sail, clear }, places, { minClear = CARVE_MIN_CLEAR_M, saveMinCells = 10, ratio = 0.8, rangeCells = 700 } = {}) {
  const n = nx * nz;
  const enterG = new Int16Array(n), enterN = new Int16Array(n);
  for (let k = 0; k < n; k++) {
    if (sail[k]) enterG[k] = enterN[k] = TRIP_UNIT;
    else if (clear[k] >= minClear) enterN[k] = Math.round(TRIP_UNIT * (1 + CARVE_PENALTY + 6 * Math.max(0, (3 - clear[k]) / 3)));
  }
  // each place starts from the nearest cell the N network has (a sailable one if close)
  const snap = (p) => {
    let best = -1, bd = Infinity;
    for (let dj = -14; dj <= 14; dj++) for (let di = -14; di <= 14; di++) {
      const a = p.a + di, b = p.b + dj;
      if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
      const k = b * nx + a, d = Math.hypot(di, dj) + (sail[k] ? 0 : 3);
      if ((sail[k] || enterN[k]) && d < bd) { bd = d; best = k; }
    }
    return best;
  };
  const cells = places.map(snap);
  const found = new Map(); // key = a stretch's middle cell bucket
  const limit = rangeCells * TRIP_UNIT * 3;
  for (let i = 0; i < places.length; i++) {
    if (cells[i] < 0) continue;
    const G = bucketField(nx, nz, [cells[i]], enterG, limit), N = bucketField(nx, nz, [cells[i]], enterN, limit);
    for (let j = i + 1; j < places.length; j++) {
      const t = cells[j];
      if (t < 0 || N.dist[t] < 0) continue;
      const nd = N.dist[t], gd = G.dist[t] < 0 ? Infinity : G.dist[t];
      if (!(nd + saveMinCells * TRIP_UNIT < gd && nd < ratio * gd)) continue;
      const path = pathFrom(N.prev, t);
      // contiguous runs of blocked cells along the path (with the sailable cell either side of each: the stretch's two ends)
      let run = [], startIdx = 0;
      const flush = (endIdx) => {
        if (run.length) {
          const mid = run[run.length >> 1];
          const key = `${Math.round((mid % nx) / 8)},${Math.round(((mid / nx) | 0) / 8)}`;
          const finite = Number.isFinite(gd), saved = finite ? (gd - nd) / TRIP_UNIT : 0;
          const rec = found.get(key) ?? { key, runs: [], savedCells: 0, savedTotalCells: 0, finiteTrips: 0, unlockTrips: 0, trips: [] };
          rec.runs.push({ cells: run.slice(), before: startIdx > 0 ? path[startIdx - 1] : -1, after: endIdx < path.length ? path[endIdx] : -1 });
          rec.savedCells = Math.max(rec.savedCells, saved); rec.savedTotalCells += saved;
          if (finite) rec.finiteTrips++; else rec.unlockTrips++;
          rec.trips.push([places[i].id, places[j].id, finite ? Math.round(saved) : null]);
          found.set(key, rec);
        }
        run = [];
      };
      for (let pi = 0; pi < path.length; pi++) {
        const k = path[pi];
        if (!sail[k]) { if (!run.length) startIdx = pi; run.push(k); } else flush(pi);
      }
      flush(path.length);
    }
  }
  return [...found.values()].map((r) => {
    // the longest run is the stretch; the others are the same channel found from other trips
    const longest = r.runs.sort((p, q) => q.cells.length - p.cells.length)[0];
    const xy = (k) => (k >= 0 ? [k % nx, (k / nx) | 0] : null);
    return { key: r.key, cells: longest.cells.map(xy), before: xy(longest.before), after: xy(longest.after), savedCells: r.savedCells, savedTotalCells: r.savedTotalCells, finiteTrips: r.finiteTrips, unlockTrips: r.unlockTrips, trips: r.trips };
  });
}

// ---- the carve shape ----------------------------------------------------------------------------------------------
// line: [[x, z, clr], ...] game metres along the pass (clr = the real clearance there, game m). Returns rings (game m).
// The shape is the union of (a) the REAL water of the channel (OSM's coastline at 5 m) within a corridor around the
// line, so the real shape is kept wherever it is already wide enough, and (b) a tube of half-width `minHalf` along the
// line, which widens only the narrow places up to the boat's minimum.
function distToLine(px, pz, line) { // nearest point on the polyline: { d, clr }
  let best = Infinity, clr = 0;
  for (let i = 0; i + 1 < line.length; i++) {
    const [ax, az, ac] = line[i], [bx, bz, bc] = line[i + 1];
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
    const t = L2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2)) : 0;
    const d = Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
    if (d < best) { best = d; clr = ac + t * (bc - ac); }
  }
  return { d: best, clr };
}

export function carveRings({ water, wF, hF, cellF, x0, z0 }, line, { minHalf, corridorPad = 1.0, simplify = 0.3 } = {}) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxClr = 0;
  for (const [x, z, c] of line) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); maxClr = Math.max(maxClr, c); }
  const reach = Math.max(minHalf, maxClr + corridorPad) + 2 * cellF;
  const i0 = Math.max(0, Math.floor((minX - reach - x0) / cellF)), i1 = Math.min(wF - 1, Math.ceil((maxX + reach - x0) / cellF));
  const j0 = Math.max(0, Math.floor((minZ - reach - z0) / cellF)), j1 = Math.min(hF - 1, Math.ceil((maxZ + reach - z0) / cellF));
  const w = i1 - i0 + 1, h = j1 - j0 + 1;
  const carve = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = x0 + (i0 + i + 0.5) * cellF, z = z0 + (j0 + j + 0.5) * cellF;
      const { d, clr } = distToLine(x, z, line);
      if (d <= minHalf || (water[(j0 + j) * wF + (i0 + i)] && d <= Math.max(clr + corridorPad, 0))) carve[j * w + i] = 1;
    }
  }
  // boundary edges, clockwise around each carved cell, linked into loops
  const vkey = (i, j) => j * (w + 1) + i;
  const out = new Map(); // start vertex -> [end vertices]
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
  for (const [start] of [...out]) {
    while (out.get(start)?.length) {
      const ring = [start]; let cur = start;
      for (;;) {
        const nexts = out.get(cur); if (!nexts?.length) break;
        const nxt = nexts.pop(); if (nxt === start) break;
        ring.push(nxt); cur = nxt;
      }
      if (ring.length >= 4) rings.push(ring);
    }
  }
  const toXZ = (v) => [x0 + (i0 + (v % (w + 1))) * cellF, z0 + (j0 + Math.floor(v / (w + 1))) * cellF];
  const dp = (pts, tol) => { // Douglas-Peucker on an open polyline
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
