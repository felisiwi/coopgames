// Offline planning for the busy Today coast (tools/plan-busy-today.mjs): routes that stay in open water, and berths along the shore.
// Pure (no THREE, no files): everything takes a `blocked(x, z)` rule and a grid description, so a synthetic world can test it.
// Game metres throughout. A "grid" is { nx, nz, pxM, x0, z0, free: Uint8Array (1 = a boat's centre may be here), clear: Float32Array
// (metres from this cell's centre to the nearest blocked cell centre; 0 on blocked cells) }.

const SQ2 = Math.SQRT2;

export function makeGrid({ nx, nz, pxM, x0, z0 }, blocked) {
  const free = new Uint8Array(nx * nz);
  for (let b = 0; b < nz; b++) for (let a = 0; a < nx; a++) free[b * nx + a] = blocked(x0 + (a + 0.5) * pxM, z0 + (b + 0.5) * pxM) ? 0 : 1;
  const clear = new Float32Array(nx * nz);
  const INF = 1e9;
  for (let k = 0; k < clear.length; k++) clear[k] = free[k] ? INF : 0;
  // two-pass chamfer distance transform (metres)
  for (let b = 0; b < nz; b++) for (let a = 0; a < nx; a++) {
    const k = b * nx + a; let d = clear[k];
    if (a > 0) d = Math.min(d, clear[k - 1] + pxM);
    if (b > 0) { d = Math.min(d, clear[k - nx] + pxM); if (a > 0) d = Math.min(d, clear[k - nx - 1] + pxM * SQ2); if (a < nx - 1) d = Math.min(d, clear[k - nx + 1] + pxM * SQ2); }
    clear[k] = d;
  }
  for (let b = nz - 1; b >= 0; b--) for (let a = nx - 1; a >= 0; a--) {
    const k = b * nx + a; let d = clear[k];
    if (a < nx - 1) d = Math.min(d, clear[k + 1] + pxM);
    if (b < nz - 1) { d = Math.min(d, clear[k + nx] + pxM); if (a < nx - 1) d = Math.min(d, clear[k + nx + 1] + pxM * SQ2); if (a > 0) d = Math.min(d, clear[k + nx - 1] + pxM * SQ2); }
    clear[k] = d;
  }
  for (let k = 0; k < clear.length; k++) if (clear[k] > 5000) clear[k] = 5000; // a world with no land at all
  return { nx, nz, pxM, x0, z0, free, clear };
}

export const cellOf = (g, x, z) => [Math.floor((x - g.x0) / g.pxM), Math.floor((z - g.z0) / g.pxM)];
export const centreOf = (g, a, b) => [g.x0 + (a + 0.5) * g.pxM, g.z0 + (b + 0.5) * g.pxM];
const inGrid = (g, a, b) => a >= 0 && b >= 0 && a < g.nx && b < g.nz;
export function clearAt(g, x, z) { // clearance of the cell holding (x, z); 0 outside the grid or on blocked cells
  const [a, b] = cellOf(g, x, z);
  return inGrid(g, a, b) ? g.clear[b * g.nx + a] : 0;
}
export const isFree = (g, x, z) => { const [a, b] = cellOf(g, x, z); return inGrid(g, a, b) && g.free[b * g.nx + a] === 1; };

// The nearest free cell centre to (x, z), searching rings out to maxR metres; optionally one with at least `minClear` metres of clearance.
export function nearestFree(g, x, z, { maxR = 120, minClear = 0 } = {}) {
  const [a0, b0] = cellOf(g, x, z);
  const R = Math.ceil(maxR / g.pxM);
  let best = null, bestD = Infinity;
  for (let r = 0; r <= R; r++) {
    for (let db = -r; db <= r; db++) for (let da = -r; da <= r; da++) {
      if (Math.max(Math.abs(da), Math.abs(db)) !== r) continue;
      const a = a0 + da, b = b0 + db;
      if (!inGrid(g, a, b)) continue;
      const k = b * g.nx + a;
      if (!g.free[k] || g.clear[k] < minClear) continue;
      const c = centreOf(g, a, b), d = Math.hypot(c[0] - x, c[1] - z);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best && r * g.pxM > bestD + g.pxM) break;
  }
  return best;
}

class Heap {
  constructor() { this.h = []; }
  get size() { return this.h.length; }
  push(c, v) { const h = this.h; h.push([c, v]); let i = h.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (h[p][0] <= h[i][0]) break; [h[p], h[i]] = [h[i], h[p]]; i = p; } }
  pop() {
    const h = this.h, top = h[0], last = h.pop();
    if (h.length) { h[0] = last; let i = 0; for (;;) { let m = i; const l = 2 * i + 1, r = l + 1; if (l < h.length && h[l][0] < h[m][0]) m = l; if (r < h.length && h[r][0] < h[m][0]) m = r; if (m === i) break; [h[m], h[i]] = [h[i], h[m]]; i = m; } }
    return top;
  }
}

// Shore-shy shortest path: cost per metre is 1 + K * ((want - clearance) / want)^2 inside `want` metres of shore, so the path takes open
// water when there is any and squeezes through a sound only when it must. minClear (m) forbids tighter water, except within `relaxNear`
// ([{ p: [x, z], r }]) of the ends (a quay is by definition at the shore). Returns { ok, length, path: [[x, z]...] } (cell centres).
export function planRoute(g, from, to, { want = 24, K = 5, minClear = 0, relaxNear = [], margin = 260 } = {}) {
  const [fa, fb] = cellOf(g, from[0], from[1]), [ta, tb] = cellOf(g, to[0], to[1]);
  const a0 = Math.max(0, Math.min(fa, ta) - Math.ceil(margin / g.pxM)), a1 = Math.min(g.nx - 1, Math.max(fa, ta) + Math.ceil(margin / g.pxM));
  const b0 = Math.max(0, Math.min(fb, tb) - Math.ceil(margin / g.pxM)), b1 = Math.min(g.nz - 1, Math.max(fb, tb) + Math.ceil(margin / g.pxM));
  const W = a1 - a0 + 1, Hh = b1 - b0 + 1;
  const key = (a, b) => (b - b0) * W + (a - a0);
  const near = relaxNear.map((n) => ({ ...n, r2: n.r * n.r }));
  const ok = (a, b) => {
    const k = b * g.nx + a;
    if (!g.free[k]) return false;
    if (g.clear[k] >= minClear) return true;
    const c = centreOf(g, a, b);
    return near.some((n) => (c[0] - n.p[0]) ** 2 + (c[1] - n.p[1]) ** 2 <= n.r2);
  };
  if (!ok(fa, fb) || !ok(ta, tb)) return { ok: false, length: Infinity, path: [], reason: 'an end is not free water' };
  const dist = new Float64Array(W * Hh).fill(Infinity), prev = new Int32Array(W * Hh).fill(-1);
  const heap = new Heap();
  dist[key(fa, fb)] = 0; heap.push(0, key(fa, fb));
  const goal = key(ta, tb);
  while (heap.size) {
    const [c, k] = heap.pop();
    if (c > dist[k]) continue;
    if (k === goal) break;
    const a = (k % W) + a0, b = ((k / W) | 0) + b0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const na = a + di, nb = b + dj;
      if (na < a0 || nb < b0 || na > a1 || nb > b1 || !ok(na, nb)) continue;
      if (di && dj && (!ok(a + di, b) || !ok(a, b + dj))) continue; // no squeezing through a diagonal corner
      const d = g.clear[nb * g.nx + na], pen = d >= want ? 0 : ((want - d) / want) ** 2;
      const nk = key(na, nb), nc = c + (di && dj ? SQ2 : 1) * g.pxM * (1 + K * pen);
      if (nc < dist[nk]) { dist[nk] = nc; prev[nk] = k; heap.push(nc, nk); }
    }
  }
  if (dist[goal] === Infinity) return { ok: false, length: Infinity, path: [], reason: 'no route' };
  const path = [];
  for (let k = goal; k >= 0; k = prev[k]) path.push(centreOf(g, (k % W) + a0, ((k / W) | 0) + b0));
  path.reverse();
  return { ok: true, length: pathLength(path), path };
}

export const pathLength = (p) => { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; };

// Every point of the segment a-b, sampled every `step` metres, is free water with at least `need` metres clearance (or free, if need = 0).
export function segmentOk(g, a, b, need = 0, step = 1.5) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / step));
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
    if (!isFree(g, x, z) || clearAt(g, x, z) < need) return false;
  }
  return true;
}

// Greedy string pulling: from each point jump to the farthest later point whose straight line keeps at least 80% of the tightest clearance
// the original stretch had (never more than `cap` m, never less than `floor`), so a shortcut never cuts closer to land than the path was.
export function simplify(g, path, { cap = 12, floor = 3, lookahead = 80 } = {}) {
  const out = [path[0]];
  let i = 0;
  while (i < path.length - 1) {
    let j = Math.min(path.length - 1, i + lookahead), found = i + 1;
    for (; j > i + 1; j--) {
      let tight = Infinity;
      for (let k = i; k <= j; k++) tight = Math.min(tight, clearAt(g, path[k][0], path[k][1]));
      if (segmentOk(g, path[i], path[j], Math.max(floor, Math.min(cap, tight * 0.8)))) { found = j; break; }
    }
    out.push(path[found]);
    i = found;
  }
  return out;
}

// Chaikin corner cutting (ends kept), `iters` rounds.
export function chaikin(pts, iters) {
  let p = pts;
  for (let it = 0; it < iters; it++) {
    const q = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const [a, b] = [p[i], p[i + 1]];
      q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    q.push(p[p.length - 1]);
    p = q;
  }
  return p;
}
// Smooth as much as is still valid: 3, 2, 1 or 0 rounds, every segment of the result free water with `need` metres of clearance
// (the first / last `endRelax` metres excused, quays being at the shore).
export function smoothValid(g, pts, need, { endRelax = 0 } = {}) {
  const valid = (p) => {
    let s = 0;
    for (let i = 0; i < p.length - 1; i++) {
      const segLen = Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]);
      const nearEnd = s < endRelax || s + segLen > pathLength(p) - endRelax;
      if (!segmentOk(g, p[i], p[i + 1], nearEnd ? 0 : need)) return false;
      s += segLen;
    }
    return true;
  };
  for (const it of [3, 2, 1]) { const c = chaikin(pts, it); if (valid(c)) return c; }
  return pts;
}

// Plan one route: shore-shy path, simplified, smoothed, validated. Returns { ok, points, length, minClear } (game metres).
export function planSmoothRoute(g, from, to, opts = {}) {
  const { want = 24, minClear = 0, relaxNear = [], need = 3, endRelax = 0 } = opts;
  const r = planRoute(g, from, to, { want, minClear, relaxNear });
  if (!r.ok) return { ok: false, reason: r.reason, points: [], length: 0, minClear: 0 };
  const simple = simplify(g, r.path, { floor: Math.max(3, need) });
  const points = smoothValid(g, simple, Math.max(2, need - 1), { endRelax });
  let mc = Infinity;
  for (let i = 0; i < points.length - 1; i++) { const a = points[i], b = points[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2)); for (let k = 0; k <= n; k++) mc = Math.min(mc, clearAt(g, a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n)); }
  return { ok: true, points, length: pathLength(points), minClear: mc };
}

// ---- berths -----------------------------------------------------------------------------------------------------------
// Water connected to `start` (4-neighbour flood fill) within `radius` metres: Set of cell keys (b * nx + a).
export function floodFree(g, start, radius) {
  const [sa, sb] = cellOf(g, start[0], start[1]);
  const seen = new Set([sb * g.nx + sa]), q = [[sa, sb]];
  while (q.length) {
    const [a, b] = q.pop();
    for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const na = a + da, nb = b + db;
      if (!inGrid(g, na, nb)) continue;
      const k = nb * g.nx + na;
      if (seen.has(k) || !g.free[k]) continue;
      const c = centreOf(g, na, nb);
      if (Math.hypot(c[0] - start[0], c[1] - start[1]) > radius) continue;
      seen.add(k); q.push([na, nb]);
    }
  }
  return seen;
}

// Direction (unit vector) from (x, z) to the nearest blocked cell centre within 12 m, or null. Boats lying alongside the shore turn
// their side to it: the heading is perpendicular to this.
export function towardShore(g, x, z) {
  let best = null, bd = Infinity;
  const R = 12 / g.pxM;
  const [a0, b0] = cellOf(g, x, z);
  for (let db = -Math.ceil(R); db <= Math.ceil(R); db++) for (let da = -Math.ceil(R); da <= Math.ceil(R); da++) {
    const a = a0 + da, b = b0 + db;
    if (!inGrid(g, a, b) || g.free[b * g.nx + a]) continue;
    const c = centreOf(g, a, b), d = Math.hypot(c[0] - x, c[1] - z);
    if (d < bd) { bd = d; best = [(c[0] - x) / (d || 1), (c[1] - z) / (d || 1)]; }
  }
  return best;
}

const hash = (n) => { let h = Math.imul(n | 0, 0x9e3779b1) ^ 0x85ebca6b; h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15; return (h >>> 0) / 4294967296; };
export { hash as hashN };

// Berths for one harbour. quay = the free water cell nearest the marina node. Boats lie alongside the shore (ALONG) or on a mooring
// buoy a little off it (BUOY), never inside `keep` metres of the entrance corridor (a polyline from the quay out to open water), so the
// player's way into the harbour stays open. Returns [{ x, z, heading, kind: 'sail'|'motor', stripe, L, lit, how: 'alongside'|'buoy' }].
export function planBerths(g, quay, corridor, { seed = 1, radius = 85, maxAlong = 5, maxBuoy = 5, keep = 9, windHeading = 3.9, avoid = [] } = {}) {
  const region = floodFree(g, quay, radius);
  const cells = [...region].map((k) => [k % g.nx, (k / g.nx) | 0]).map(([a, b]) => ({ c: centreOf(g, a, b), d: g.clear[b * g.nx + a] }));
  const distToLine = (pts, x, z) => { let m = Infinity; for (let i = 0; i < pts.length - 1; i++) { const [p, q] = [pts[i], pts[i + 1]]; const dx = q[0] - p[0], dz = q[1] - p[1], L2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (z - p[1]) * dz) / L2)); m = Math.min(m, Math.hypot(x - (p[0] + dx * t), z - (p[1] + dz * t))); } return m; };
  const distToCorridor = (x, z) => { let m = Infinity; for (let i = 0; i < corridor.length - 1; i++) { const [p, q] = [corridor[i], corridor[i + 1]]; const dx = q[0] - p[0], dz = q[1] - p[1], L2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (z - p[1]) * dz) / L2)); m = Math.min(m, Math.hypot(x - (p[0] + dx * t), z - (p[1] + dz * t))); } return m; };
  const out = [];
  let n = 0;
  const pick = (cand, how, max, minGap) => {
    cand.sort((p, q) => Math.hypot(p.c[0] - quay[0], p.c[1] - quay[1]) - Math.hypot(q.c[0] - quay[0], q.c[1] - quay[1]));
    let taken = 0;
    for (const { c, d } of cand) {
      if (taken >= max) break;
      if (distToCorridor(c[0], c[1]) < keep) continue;
      if (avoid.some((v) => distToLine(v.pts, c[0], c[1]) < v.keep)) continue; // e.g. the ferry's way in: a ferry at its quay needs the water all round it
      const r = hash(seed * 977 + n++);
      const kind = r < 0.62 ? 'sail' : 'motor';
      const L = kind === 'sail' ? 7.2 + hash(seed * 31 + n) * 2.4 : 5.2 + hash(seed * 17 + n) * 1.2;
      if (out.some((o) => Math.hypot(o.x - c[0], o.z - c[1]) < (o.L + L) / 2 * 0.9 + 0.8 + (how === 'buoy' ? 4 : 0))) continue; // about a boat length apart: two hulls never overlap
      let heading;
      if (how === 'alongside') {
        const s = towardShore(g, c[0], c[1]);
        if (!s) continue;
        heading = Math.atan2(-s[1], s[0]) + (hash(seed * 13 + n) < 0.5 ? 0 : Math.PI); // along the shore, bow either way
        // the boat is L long: both ends must stay in free water
        const fx = Math.sin(heading) * L / 2, fz = Math.cos(heading) * L / 2;
        if (!isFree(g, c[0] + fx, c[1] + fz) || !isFree(g, c[0] - fx, c[1] - fz)) continue;
      } else heading = windHeading + (hash(seed * 7 + n) - 0.5) * 0.9; // swung to the wind on its buoy
      out.push({ x: c[0], z: c[1], heading, kind, L: Math.round(L * 10) / 10, seed: hash(seed * 5 + n), how });
      taken++;
    }
  };
  pick(cells.filter((q) => q.d >= g.pxM && q.d <= 4.5), 'alongside', maxAlong, 0);
  pick(cells.filter((q) => q.d >= 7 && q.d <= 22), 'buoy', maxBuoy, 0);
  return out;
}

// ---- docks, loops and fishing grounds ----------------------------------------------------------------------------------------
export const pointAt = (pts, s) => {
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    if (s <= acc + L || i === pts.length - 2) { const t = L ? Math.max(0, Math.min(1, (s - acc) / L)) : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]; }
    acc += L;
  }
  return pts[0];
};
// Unit direction of travel along a polyline at arc length s (looking 6 m either side).
export function tangentAt(pts, s, span = 6) {
  const total = pathLength(pts), a = pointAt(pts, Math.max(0, s - span)), b = pointAt(pts, Math.min(total, s + span));
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
}

// (`free(x, z)` says whether the hull may be at a point; the default is a place the player's boat centre may be.)
// Is the whole hull (length 2 * halfLen, half-beam halfBeam, bow towards the unit vector `dir`) in free water, with `bowGap` metres of free
// water beyond the bow? Every sample point must be a place a boat's CENTRE may be (so there is also the game's 2.5 m hull margin round it).
export function footprintFree(g, c, dir, halfLen, halfBeam, bowGap = 3, step = 1.5, free = (x, z) => isFree(g, x, z)) {
  const right = [dir[1], -dir[0]]; // (cos, -sin) of the heading: the starboard side
  for (let l = -halfLen; l <= halfLen + bowGap + 1e-9; l += step) for (const lat of [-halfBeam - 0.5, 0, halfBeam + 0.5]) {
    if (!free(c[0] + dir[0] * l + right[0] * lat, c[1] + dir[1] * l + right[1] * lat)) return false;
  }
  return true;
}
// Distance from (x, z) to the nearest point of a polyline.
export function distToPolyline(pts, x, z) {
  let m = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [p, q] = [pts[i], pts[i + 1]], dx = q[0] - p[0], dz = q[1] - p[1], L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (z - p[1]) * dz) / L2));
    m = Math.min(m, Math.hypot(x - (p[0] + dx * t), z - (p[1] + dz * t)));
  }
  return m;
}
// Dock a vessel at one end of a planned polyline: slide the dock point back along the approach (at most maxPull m) until the whole hull fits in
// clear water with `bowGap` m in front of the bow ("slightly off the quay"), no `keepAway` point ({ p: [x, z], r }) is within r of the centre and
// no `keepLines` polyline ({ pts, r }) comes within r of the hull axis.
// mode 'end': the vessel arrives at the end of the polyline (bow = direction of travel); 'start': it leaves the start (bow = the reverse).
// Returns { ok, points (the polyline shortened to the dock), dock: [x, z], dir (bow direction), pulled (m) }.
export function pullDock(g, pts, mode, { halfLen, halfBeam, bowGap = 3, maxPull = 80, keepAway = [], keepLines = [], free = undefined } = {}) {
  const total = pathLength(pts);
  for (let pull = 0; pull <= maxPull; pull += 0.5) {
    const s = mode === 'end' ? total - pull : pull;
    if (s < 0 || s > total) break;
    const c = pointAt(pts, s), t = tangentAt(pts, s), dir = mode === 'end' ? t : [-t[0], -t[1]];
    if (keepAway.some((k) => Math.hypot(c[0] - k.p[0], c[1] - k.p[1]) < k.r)) continue;
    if (!footprintFree(g, c, dir, halfLen, halfBeam, bowGap, 1.5, free)) continue;
    // the hull axis (stern to bow tip) stays `r` metres off each line (the way into a harbour, the lane at its gate)
    let onLane = false;
    for (let l = -halfLen; l <= halfLen + bowGap && !onLane; l += 2) onLane = keepLines.some((k) => distToPolyline(k.pts, c[0] + dir[0] * l, c[1] + dir[1] * l) < k.r);
    if (onLane) continue;
    const kept = [];
    let acc = 0;
    for (let i = 0; i < pts.length; i++) {
      if (i) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (mode === 'end' ? acc < s : acc > s) kept.push(pts[i]);
    }
    const points = mode === 'end' ? [...kept, c] : [c, ...kept];
    return { ok: true, points, dock: c, dir, pulled: pull };
  }
  return { ok: false, points: pts, dock: mode === 'end' ? pts.at(-1) : pts[0], dir: null, pulled: Infinity };
}

// A closed loop through anchor points (each leg planned shore-shy, then the whole thing smoothed and re-validated). Returns { ok, points (first == last), length }.
// Chaikin corner cutting on a CLOSED polyline (pts without the repeated first point): the corner between the last and first point is cut too.
export function chaikinClosed(pts, iters) {
  let p = pts;
  for (let it = 0; it < iters; it++) {
    const q = [];
    for (let i = 0; i < p.length; i++) { const [a, b] = [p[i], p[(i + 1) % p.length]]; q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
    p = q;
  }
  return p;
}
// A closed loop through anchor points: each leg is planned shore-shy and simplified on its own (a closed loop cannot be simplified as one path:
// its first and last points coincide), then the loop is smoothed with closed corner cutting as far as it stays valid. Returns { ok, points
// (first == last, so a route of it can be closed), length }.
export function planLoop(g, anchors, { want = 40, need = 6 } = {}) {
  const pts = [];
  for (let i = 0; i < anchors.length; i++) {
    const leg = planRoute(g, anchors[i], anchors[(i + 1) % anchors.length], { want });
    if (!leg.ok) return { ok: false, points: [], length: 0, reason: `leg ${i}: ${leg.reason}` };
    const simple = simplify(g, leg.path, { floor: Math.max(3, need - 1) });
    pts.push(...simple.slice(0, -1)); // the last point is the next leg's first
  }
  const valid = (p) => p.every((q, i) => segmentOk(g, q, p[(i + 1) % p.length], Math.max(2, need - 2)));
  let best = pts;
  for (const it of [2, 1]) { const c = chaikinClosed(pts, it); if (valid(c)) { best = c; break; } }
  const closed = [...best, best[0]];
  return { ok: true, points: closed, length: pathLength(closed) };
}

// Open-water spots (clearance >= minClear), the best (most open) first, no two closer than `spacing`. For fishing grounds.
export function openWaterSpots(g, { minClear = 40, spacing = 250, near = null, inset = 150 } = {}) {
  const cand = [];
  const [x0, z0] = [g.x0 + inset, g.z0 + inset], [x1, z1] = [g.x0 + g.nx * g.pxM - inset, g.z0 + g.nz * g.pxM - inset];
  for (let b = 0; b < g.nz; b += 3) for (let a = 0; a < g.nx; a += 3) {
    const k = b * g.nx + a;
    if (!g.free[k] || g.clear[k] < minClear) continue;
    const c = centreOf(g, a, b);
    if (c[0] < x0 || c[0] > x1 || c[1] < z0 || c[1] > z1) continue;
    if (near) { const d = Math.min(...near.points.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1]))); if (d < near.min || d > near.max) continue; }
    cand.push({ c, d: g.clear[k] });
  }
  cand.sort((p, q) => q.d - p.d);
  const out = [];
  for (const { c } of cand) if (!out.some((o) => Math.hypot(o[0] - c[0], o[1] - c[1]) < spacing)) out.push(c);
  return out;
}
