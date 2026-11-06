// Harbour water (stage 1d follow-up): "inside the harbour" as a real region, not a circle round a village point. The sailable water connected to the
// quay, on the harbour side of the mouth gate, found by a flood fill over the game's own collision (the hull-radius rule of shore.js, hard shoals
// included). Pure (no THREE): `blocked(x, z)` says whether the boat cannot be there.
//
// Why: Fiskebäckskil's village point is about 45 game m from its harbour, and the Navigate arrival is a 70 m circle round that point, so a boat could
// "arrive" in water that is not the harbour (or run aground outside it). The reward moment needs the boat to have ENTERED the harbour.
export const HARBOUR_STEP_M = 1; // grid step, game metres. Carved channels are 6 m wide and the hull needs 2.5 m each side, so the free band for the boat's CENTRE is about 1 m: a coarser grid steps over it
export const HARBOUR_RADIUS_M = 100; // the region reaches this far from the quay (the mouth of a long inlet is up to about 75 m out)

const key = (i, j) => i * 100003 + j;

// quay, mouth: { x, z } game metres. bearingDeg: the compass bearing a boat takes entering (180 = southward); the harbour side of the mouth is where
// (p - mouth) . entering >= 0. Returns { contains(x, z), cells, start, reachedMouth } or null if no sailable water is found near the quay.
export function createHarbourWater({ blocked, quay, mouth, bearingDeg, step = HARBOUR_STEP_M, radius = HARBOUR_RADIUS_M }) {
  const b = (bearingDeg * Math.PI) / 180;
  const ex = Math.sin(b); // entering direction in game metres: x east, z south, compass bearing b
  const ez = -Math.cos(b);
  const insideSide = (x, z) => (x - mouth.x) * ex + (z - mouth.z) * ez >= -0.01;
  // the start: the nearest unblocked cell to the quay point (the quay is on the shore, the water is a step away)
  let start = null;
  for (let r = 0; r <= 24 && !start; r += step) {
    for (let a = 0; a < 6.28 && !start; a += 0.4) {
      const x = quay.x + Math.sin(a) * r, z = quay.z + Math.cos(a) * r;
      if (!blocked(x, z) && insideSide(x, z)) start = { x, z };
    }
  }
  if (!start) return null;
  const ox = start.x, oz = start.z;
  const cells = new Set();
  const q = [[0, 0]];
  cells.add(key(0, 0));
  let reachedMouth = false;
  while (q.length) {
    const [i, j] = q.pop();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj, k = key(ni, nj);
      if (cells.has(k)) continue;
      const x = ox + ni * step, z = oz + nj * step;
      if (Math.hypot(x - quay.x, z - quay.z) > radius) continue;
      if (!insideSide(x, z)) { if (!blocked(x, z)) reachedMouth = true; continue; } // seaward of the gate: not the harbour (but the water continues out)
      if (blocked(x, z)) continue;
      cells.add(k);
      q.push([ni, nj]);
    }
  }
  return {
    start, cells: cells.size, reachedMouth,
    // is the boat's centre in the harbour water? (the nearest grid cell, with one cell of slack for the rounding)
    contains(x, z) {
      const i = Math.round((x - ox) / step), j = Math.round((z - oz) / step);
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) if (cells.has(key(i + di, j + dj)) && Math.hypot(ox + (i + di) * step - x, oz + (j + dj) * step - z) <= step * 0.8) return true;
      return false;
    },
  };
}

// Can a boat sail from `from` to `to`? A flood fill over the same collision rule, coarse (a step a bit over the hull radius), limited to a box.
// Used by tests and the headless check, not per frame. Returns { reachable, cellsVisited }.
export function canSail(blocked, from, to, { step = 1, box = null, maxCells = 4000000 } = {}) {
  const x0 = box ? box.x0 : Math.min(from.x, to.x) - 400, x1 = box ? box.x1 : Math.max(from.x, to.x) + 400;
  const z0 = box ? box.z0 : Math.min(from.z, to.z) - 400, z1 = box ? box.z1 : Math.max(from.z, to.z) + 400;
  const toI = Math.round((to.x - from.x) / step), toJ = Math.round((to.z - from.z) / step);
  const seen = new Set([key(0, 0)]);
  const q = [[0, 0]];
  let visited = 0;
  while (q.length && visited < maxCells) {
    const [i, j] = q.pop();
    visited++;
    if (Math.abs(i - toI) <= 1 && Math.abs(j - toJ) <= 1) return { reachable: true, cellsVisited: visited };
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj, k = key(ni, nj);
      if (seen.has(k)) continue;
      seen.add(k);
      const x = from.x + ni * step, z = from.z + nj * step;
      if (x < x0 || x > x1 || z < z0 || z > z1 || blocked(x, z)) continue;
      q.push([ni, nj]);
    }
  }
  return { reachable: false, cellsVisited: visited };
}
