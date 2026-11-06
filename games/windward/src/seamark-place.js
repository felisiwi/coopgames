// Where to put an invented harbour-mouth gate (a red port mark + a green starboard mark) so a harbour with no real
// marks in OSM still has something to steer for. Pure: it needs only the coast world's height field (the same one the
// boat collides with: src/coast-world.js buildCoastWorld, src/shore.js BLOCK_H), so it runs in Node and in tests.
//
// Method (all distances in GAME metres; the coast is 1:10, so 1 game metre = 10 real metres):
//   1. sailable water = the field is at or below shore.js BLOCK_H and at least SAIL_D from anything blocked
//   2. a route from the harbour out to open water (distance-to-land >= OPEN_D), cheapest when it keeps mid-channel
//   3. the MOUTH = the narrowest point of that route that is at least MIN_FROM_HARBOUR from the quay (ties go to the
//      seaward end), i.e. where the water funnels into the harbour
//   4. the GATE: across the channel at the mouth, centred between the two shores, marks GATE_MARGIN inside each shore
//      (clamped to GATE_MIN..GATE_MAX apart). Entering from seaward, RED is to PORT (left), GREEN to starboard (IALA A).
// The marks it returns are data, flagged invented: true by tools/invent-harbour-marks.mjs; the game draws them exactly
// like real ones and only the chart / debug view shows the flag.
import { BLOCK_H } from './shore.js';

export const SAIL_D = 3.0; // a cell is sailable when this far (game m) from blocked water: a bit over the hull radius
export const OPEN_D = 24; // "open water": this far from land (about a kilometre of sea across, real)
export const MIN_FROM_HARBOUR = 15; // the mouth is at least this far (game m) from the quay (150 m real)
export const NEAR_REACH = 40; // a mouth further than this from the quay (400 m real) ...
export const NARROW_FAR = 15; // ... must be this narrow (150 m real): a long inlet has a far mouth, a wide bay does not
export const GATE_MARGIN = 1.6; // a mark sits this far inside the shore
export const GATE_MIN = 4.5;
export const GATE_MAX = 10; // 100 m real between the marks at most
export const DCAP = 30; // distance-to-land is only measured out to here (game m)
export const MIN_BODY_CELLS = 200; // a sailable region must have at least this many cells to count as the sea
const WINDOW_CELLS = 95; // search window half-size around the harbour (190 game m = 1.9 km real)

export function cellOf(world, x, z) { return [Math.floor((x - world.x0) / world.pxM), Math.floor((z - world.z0) / world.pxM)]; }
export function cellCentre(world, a, b) { return [world.x0 + (a + 0.5) * world.pxM, world.z0 + (b + 0.5) * world.pxM]; }

// game metres -> lon / lat, the inverse of world.toGame (coast.toPx / pxM)
export function makeFromGame(meta, pxM) {
  const mpp = meta.metersPerPixelReal, P = meta.projection;
  return (x, z) => [meta.bbox.w + ((x / pxM) * mpp) / P.metersPerDegLon, meta.bbox.n - ((z / pxM) * mpp) / P.metersPerDegLat];
}

// min-heap on cost (small, local: the search is a few tens of thousands of cells)
class Heap {
  constructor() { this.a = []; }
  push(c, v) { const a = this.a; a.push([c, v]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() {
    const a = this.a; const top = a[0]; const last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (;;) { let m = i; const l = 2 * i + 1, r = l + 1; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } }
    return top;
  }
  get size() { return this.a.length; }
}

// Distance (game m) from each cell of the window to the nearest blocked cell, capped at DCAP. Cells outside the world
// count as open sea (the world edge fades to deep water).
function distanceField(world, a0, b0, w, h) {
  const R = Math.ceil(DCAP / world.pxM);
  const blocked = (a, b) => a >= 0 && b >= 0 && a < world.nx && b < world.nz && world.H[b * world.nx + a] > BLOCK_H;
  const D = new Float32Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const a = a0 + i, b = b0 + j;
      let best = DCAP;
      if (blocked(a, b)) best = 0;
      else {
        for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
          if (!blocked(a + di, b + dj)) continue;
          const d = Math.hypot(di, dj) * world.pxM;
          if (d < best) best = d;
        }
      }
      D[j * w + i] = best;
    }
  }
  return D;
}

const ray = (world, x, z, dx, dz, max = 30) => { // distance from (x,z) along (dx,dz) to the first blocked point
  for (let d = 0; d <= max; d += 0.5) if (world.heightAt(x + dx * d, z + dz * d) > BLOCK_H) return d;
  return max;
};

// Find the mouth of the water that leads out of `harbour` ([x, z] game m). Returns null + reason when it cannot.
export function findHarbourMouth(world, harbour) {
  const [hc, hr] = cellOf(world, harbour[0], harbour[1]);
  const a0 = Math.max(0, hc - WINDOW_CELLS), b0 = Math.max(0, hr - WINDOW_CELLS);
  const w = Math.min(world.nx, hc + WINDOW_CELLS + 1) - a0, h = Math.min(world.nz, hr + WINDOW_CELLS + 1) - b0;
  const D = distanceField(world, a0, b0, w, h);
  const at = (a, b) => ((a - a0) >= 0 && (b - b0) >= 0 && (a - a0) < w && (b - b0) < h ? D[(b - b0) * w + (a - a0)] : 0);

  // start: the nearest sailable cell to the harbour node that belongs to a REAL body of water. The node sits on a quay,
  // and the raster's quay basins are puddles of a few cells cut off from the sea at the hull's width, so a plain
  // "nearest sailable cell" can be a dead end. Label the connected sailable regions and only accept big ones.
  const label = new Int32Array(w * h).fill(-1), sizes = [];
  for (let i0 = 0; i0 < D.length; i0++) {
    if (label[i0] !== -1 || D[i0] < SAIL_D) continue;
    const id = sizes.length; let n = 0; const stack = [i0]; label[i0] = id;
    while (stack.length) {
      const i = stack.pop(); n++;
      const ia = i % w, ib = (i / w) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const na = ia + di, nb = ib + dj;
        if ((!di && !dj) || na < 0 || nb < 0 || na >= w || nb >= h) continue;
        const ni = nb * w + na;
        if (label[ni] === -1 && D[ni] >= SAIL_D) { label[ni] = id; stack.push(ni); }
      }
    }
    sizes.push(n);
  }
  let start = null, bestDist = Infinity;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const l = label[j * w + i];
    if (l < 0 || sizes[l] < MIN_BODY_CELLS) continue;
    const d = Math.hypot(i + a0 - hc, j + b0 - hr);
    if (d < bestDist && d <= 40) { bestDist = d; start = [a0 + i, b0 + j]; }
  }
  if (!start) return { ok: false, reason: 'no real body of water within 800 m of the harbour' };

  // Dijkstra over sailable cells; stepping near a shore costs more, so the route keeps mid-channel. It runs over the
  // whole window (a few tens of thousands of cells) and tracks the plain length too.
  const cost = new Float64Array(w * h).fill(Infinity), len = new Float64Array(w * h), // 64-bit: the heap's costs are doubles, a float32 copy would look 'stale' and drop cells
     prev = new Int32Array(w * h).fill(-1);
  const heap = new Heap();
  const si = (start[1] - b0) * w + (start[0] - a0);
  cost[si] = 0; heap.push(0, si);
  while (heap.size) {
    const [c, i] = heap.pop();
    if (c > cost[i]) continue;
    const ia = i % w, ib = (i / w) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const na = ia + di, nb = ib + dj;
      if (na < 0 || nb < 0 || na >= w || nb >= h) continue;
      const ni = nb * w + na;
      if (D[ni] < SAIL_D) continue;
      const stepLen = Math.hypot(di, dj) * world.pxM;
      const step = stepLen * (1 + 4 * Math.max(0, (6 - D[ni]) / 6));
      if (c + step < cost[ni]) { cost[ni] = c + step; len[ni] = len[i] + stepLen; prev[ni] = i; heap.push(c + step, ni); }
    }
  }
  // target: the cheapest cell in open water (D >= OPEN_D) that is far enough from the quay for a mouth to fit in
  // between; if the window has no open water, the roomiest cell that is far enough.
  const FAR = MIN_FROM_HARBOUR + 10;
  let target = -1, bestCost = Infinity, bestD = -1;
  for (let i = 0; i < D.length; i++) {
    if (cost[i] === Infinity || len[i] < FAR) continue;
    if (D[i] >= OPEN_D) { if (cost[i] < bestCost) { bestCost = cost[i]; target = i; } }
  }
  const reachedOpen = target >= 0;
  if (!reachedOpen) {
    for (let i = 0; i < D.length; i++) {
      if (cost[i] === Infinity || len[i] < FAR) continue;
      if (D[i] > bestD + 0.01 || (Math.abs(D[i] - bestD) <= 0.01 && cost[i] < cost[target])) { bestD = D[i]; target = i; }
    }
  }
  if (target < 0) {
    let reach = 0, maxLen = 0;
    for (let i = 0; i < D.length; i++) if (cost[i] !== Infinity) { reach++; maxLen = Math.max(maxLen, len[i]); }
    return { ok: false, reason: `no route out (body ${sizes[label[si]]} cells, start D ${D[si].toFixed(1)}, ${reach} reachable cells, longest route ${maxLen.toFixed(0)} game m)` };
  }

  // path start -> target
  const path = [];
  for (let i = target; i >= 0; i = prev[i]) path.push(i);
  path.reverse();
  const pts = path.map((i) => cellCentre(world, a0 + (i % w), b0 + ((i / w) | 0)));
  const dist = [0]; // cumulative distance from the harbour along the route (game m)
  for (let k = 1; k < pts.length; k++) dist.push(dist[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  const Dp = path.map((i) => D[i]);

  // the mouth: where the water, measured shore to shore ACROSS the route, is narrowest, at least MIN_FROM_HARBOUR from
  // the quay; ties (within 2 m) go to the seaward end. Both shores must be found (else it is open sea, not a mouth).
  // On open water with no such place, fall back to the point of the route closest to land.
  const crossAt = (k) => {
    const k0 = Math.max(0, k - 6), k1 = Math.min(pts.length - 1, k + 6);
    let px = pts[k0][0] - pts[k1][0], pz = pts[k0][1] - pts[k1][1];
    const pl = Math.hypot(px, pz) || 1; px /= pl; pz /= pl;
    const e = [px, pz]; // direction of travel INTO the harbour = against the route direction (x east, z south)
    const left = [e[1], -e[0]]; // port side when heading e (z points south)
    const [cx, cz] = pts[k];
    const dl = ray(world, cx, cz, left[0], left[1]), dr = ray(world, cx, cz, -left[0], -left[1]);
    return { k, e, left, dl, dr, width: dl + dr, found: dl < 30 && dr < 30, centre: [cx, cz] };
  };
  const cands = [];
  for (let k = 0; k < pts.length; k++) if (dist[k] >= MIN_FROM_HARBOUR) cands.push(crossAt(k));
  if (!cands.length) cands.push(crossAt(pts.length - 1));
  const reach = cands.filter((c) => dist[c.k] <= NEAR_REACH || (c.found && c.width <= NARROW_FAR));
  const pool = reach.length ? reach : cands;
  const closed = pool.filter((c) => c.found);
  let pick;
  if (closed.length) {
    const wmin = Math.min(...closed.map((c) => c.width));
    const tight = closed.filter((c) => c.width <= wmin + 2);
    pick = tight[tight.length - 1];
  } else {
    const dmin = Math.min(...pool.map((c) => Dp[c.k]));
    const tight = pool.filter((c) => Dp[c.k] <= dmin + 1.0);
    pick = tight[tight.length - 1];
  }
  const { k, e, left, dl, dr, width } = pick;
  const [cx, cz] = pick.centre;
  const mid = [cx + left[0] * (dl - dr) / 2, cz + left[1] * (dl - dr) / 2]; // centred between the two shores
  let spacing = Math.min(GATE_MAX, Math.max(GATE_MIN, width - 2 * GATE_MARGIN));
  const inWater = (p) => world.heightAt(p[0], p[1]) <= BLOCK_H - 0.3;
  let port, starboard;
  for (let tries = 0; tries < 8; tries++) {
    port = [mid[0] + left[0] * spacing / 2, mid[1] + left[1] * spacing / 2];
    starboard = [mid[0] - left[0] * spacing / 2, mid[1] - left[1] * spacing / 2];
    if (inWater(port) && inWater(starboard)) break;
    spacing = Math.max(2.5, spacing - 1);
    port = starboard = null;
  }
  if (!port) return { ok: false, reason: 'no room for the marks at the mouth' };
  return {
    ok: true, reachedOpen, start: cellCentre(world, start[0], start[1]), centre: mid, heading: e, left,
    widthM: width, spacing, port, starboard, routeLengthM: dist[dist.length - 1], mouthFromHarbourM: dist[k],
    open: pts[pts.length - 1],
  };
}

// IALA A check used by tests: entering along `heading`, the red (port) mark must be on the left.
export function portIsLeft(heading, port, starboard) {
  const left = [heading[1], -heading[0]];
  return (port[0] - starboard[0]) * left[0] + (port[1] - starboard[1]) * left[1] > 0;
}
