// The thing you're trying to fill. A vessel is a per-row interior span:
// for each grid row, which columns are inside. That representation is why
// bellies, necks and tapers are all the same code, and why "did this cell
// hit a wall" is two integer comparisons rather than geometry.
//
// Row 0 is the MOUTH (top). Rows increase downward, matching the CA's
// gravity direction at zero tilt.
import { GRID } from './config.js';

// Deterministic PRNG. Same seed, same vessel, on every machine — the hub
// hands both peers the same seed, so nothing about the vessel needs to
// cross the wire.
export function rng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stage 1-20 vary aperture; 10+ also vary shape and height (DESIGN.md Q15).
// Everything returned is integer grid units.
// The four shapes, rotating stage by stage. They are deliberately opposed:
// a plate is trivial to pour into and impossible to hold steady, a wine
// bottle is the reverse. Alternating them means the skill being tested
// changes from stage to stage rather than just getting numerically harder.
export const ARCHETYPES = ['bowl', 'bottle', 'plate', 'wine'];

export function archetypeFor(stage) {
  return ARCHETYPES[(stage - 1) % ARCHETYPES.length];
}

export function generateVessel(seed, stage = 1) {
  const rand = rng((seed ^ (stage * 0x9e3779b1)) >>> 0);
  const pick = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const tightness = Math.min(1, (stage - 1) / 30);
  const kind = archetypeFor(stage);
  const mid = GRID.W >> 1;

  // Each archetype is a list of [rows, width] segments from the rim down.
  // One representation, four silhouettes — and because a segment can be
  // narrower than the one below it, necks and bellies cost no extra code.
  let segments;
  if (kind === 'plate') {
    // Barely a lip. Catching is easy, holding it is not.
    const rim = Math.max(40, Math.round((74 - 20 * tightness) - pick(0, 8)));
    const h = Math.max(5, Math.round((9 - 3 * tightness)));
    segments = [[h, rim], [2, Math.max(12, rim - pick(10, 18))]];
  } else if (kind === 'bowl') {
    const rim = Math.max(26, Math.round((56 - 22 * tightness) - pick(0, 8)));
    const h = Math.max(10, Math.round(rim * (0.58 - 0.16 * tightness)));
    segments = [[h, rim], [Math.max(3, h >> 1), Math.max(12, rim - pick(8, 16))]];
  } else if (kind === 'bottle') {
    const neck = Math.max(9, Math.round((17 - 6 * tightness) - pick(0, 3)));
    const neckLen = pick(7, 12);
    const belly = Math.max(neck + 10, Math.round((44 - 12 * tightness) - pick(0, 6)));
    const bellyLen = pick(20, 28);
    segments = [[neckLen, neck], [5, Math.round((neck + belly) / 2)], [bellyLen, belly]];
  } else {
    // Wine: a long narrow throat over a deep body. Very hard to fill,
    // almost impossible to spill.
    const neck = Math.max(7, Math.round((12 - 4 * tightness) - pick(0, 2)));
    const neckLen = pick(16, 22);
    const belly = Math.max(neck + 14, Math.round((38 - 10 * tightness) - pick(0, 5)));
    const bellyLen = pick(22, 30);
    segments = [[neckLen, neck], [6, Math.round((neck + belly) / 2)], [bellyLen, belly]];
  }

  const rows = [];
  for (const [len, width] of segments) {
    for (let i = 0; i < len && rows.length < GRID.H - 2; i++) {
      const w = Math.min(width, GRID.W - 4);
      const half = w >> 1;
      rows.push({ l: mid - half, r: mid - half + w });
    }
  }

  const height = rows.length;
  const capacity = rows.reduce((n, r) => n + (r.r - r.l), 0);
  const minL = Math.min(...rows.map((r) => r.l));
  const maxR = Math.max(...rows.map((r) => r.r));
  return {
    kind,
    rows,
    height,
    aperture: rows[0].r - rows[0].l,
    belly: maxR - minL,
    neckLen: segments[0][0],
    mouth: { l: rows[0].l, r: rows[0].r },
    minL,
    maxR,
    capacity,
  };
}

// Is this grid cell inside the vessel?
export function inside(vessel, x, y) {
  if (y < 0 || y >= vessel.height) return false;
  const row = vessel.rows[y];
  return x >= row.l && x < row.r;
}

// Sanity gate for generated vessels (DESIGN.md risk 5): a vessel must be
// fillable and must not narrow below the stream it has to catch.
export function validate(vessel, nozzle) {
  const problems = [];
  if (vessel.aperture < nozzle) {
    problems.push(`aperture ${vessel.aperture} narrower than nozzle ${nozzle}`);
  }
  if (vessel.capacity < 150) problems.push(`capacity ${vessel.capacity} too small`);
  if (vessel.height > GRID.H) problems.push(`height ${vessel.height} exceeds grid`);
  for (let y = 0; y < vessel.height; y++) {
    const row = vessel.rows[y];
    if (row.l < 0 || row.r > GRID.W) problems.push(`row ${y} outside grid`);
    if (row.r - row.l < 1) problems.push(`row ${y} has no interior`);
  }
  // Bellies are the point now, so "no row wider than the one above" is out.
  // What matters instead is that every cell can actually be reached from
  // the mouth: a pocket the falling material can never get into would be
  // capacity that can never be filled. Flood fill from the rim.
  const seen = new Set();
  const stack = [];
  for (let x = vessel.rows[0].l; x < vessel.rows[0].r; x++) stack.push([x, 0]);
  while (stack.length) {
    const [x, y] = stack.pop();
    const key = y * 1000 + x;
    if (seen.has(key) || !inside(vessel, x, y)) continue;
    seen.add(key);
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  if (seen.size !== vessel.capacity) {
    problems.push(`${vessel.capacity - seen.size} cells unreachable from the mouth`);
  }
  return problems;
}
