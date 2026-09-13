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
export function generateVessel(seed, stage = 1) {
  const rand = rng((seed ^ (stage * 0x9e3779b1)) >>> 0);
  const pick = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

  // BOWLS AND CUPS, not flasks. A tall, long-necked flask is physically
  // spill-proof below about 90° of tilt — measured at seed 3, its lower rim
  // corner sat 57.7 cells above a liquid surface reaching only 41.3 — so
  // tilting could never threaten anything and the catcher had no game to
  // play. A vessel whose rim is WIDE and LOW is the shape where a modest
  // lean genuinely spills, and where how full it is decides how much.
  //
  // Row 0 is the rim and is the widest part; the body tapers inward toward
  // the base. All sizes are in the fine grid (config CELL).
  const tightness = Math.min(1, (stage - 1) / 30);

  // The rim narrows with the stages — that is the "harder to catch" dial.
  const rimMax = Math.round(34 - 18 * tightness);
  const rim = Math.max(13, pick(Math.max(13, rimMax - 6), rimMax));

  // And the vessel gets SHALLOWER — that is the "easier to spill" dial,
  // because material reaches a low rim sooner.
  const depthMax = Math.round(34 - 14 * tightness);
  const height = Math.max(17, pick(Math.max(17, depthMax - 8), depthMax));

  // Taper to the base. A steeper taper is a rounder bowl, a gentle one is
  // closer to a straight-sided cup.
  const taper = Math.min(rim - 8, pick(2, Math.max(3, rim >> 1)));
  const base = Math.max(6, rim - taper);

  const rows = [];
  const mid = GRID.W >> 1;
  for (let y = 0; y < height; y++) {
    // Integer lerp from rim at the top to base at the bottom.
    const width = height === 1
      ? rim
      : rim - Math.round(((rim - base) * y) / (height - 1));
    const half = width >> 1;
    rows.push({ l: mid - half, r: mid - half + width });
  }

  const aperture = rim;
  const belly = rim;
  const neckLen = 0;

  const capacity = rows.reduce((n, r) => n + (r.r - r.l), 0);
  // Widest extent, so the sim can tell "clipped the shoulder and deflected
  // off it" from "missed the vessel entirely and just kept falling".
  const minL = Math.min(...rows.map((r) => r.l));
  const maxR = Math.max(...rows.map((r) => r.r));
  return {
    rows,
    height,
    aperture,
    belly,
    neckLen,
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
  // Bowls taper inward toward the base, so every row must be no wider than
  // the rim above it — an overhang would trap material the CA cannot drain.
  for (let y = 1; y < vessel.height; y++) {
    if (vessel.rows[y].r - vessel.rows[y].l > vessel.rows[y - 1].r - vessel.rows[y - 1].l) {
      problems.push(`row ${y} overhangs the row above`);
      break;
    }
  }
  return problems;
}
