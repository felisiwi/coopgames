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

  // Aperture tightens as stages climb, with a floor that always admits the
  // stream. Widened by a random slack so two stages never feel identical.
  // All sizes are in the fine grid (config CELL), so they are double what
  // the same vessel measured before the grain size was halved.
  const tightness = Math.min(1, (stage - 1) / 30);
  const apMax = Math.round(26 - 14 * tightness);
  const aperture = Math.max(8, pick(Math.max(8, apMax - 6), apMax));

  const shapeStage = stage >= 10;
  const belly = shapeStage
    ? Math.min(GRID.W - 8, aperture + pick(8, 32))
    : Math.min(GRID.W - 8, aperture + pick(8, 18));
  const height = shapeStage ? pick(60, GRID.H - 8) : pick(56, 80);
  const neckLen = shapeStage ? pick(4, 20) : pick(4, 10);
  const flareLen = Math.max(4, pick(6, 16));

  const rows = [];
  const mid = GRID.W >> 1;
  for (let y = 0; y < height; y++) {
    let width;
    if (y < neckLen) {
      width = aperture;
    } else if (y < neckLen + flareLen) {
      // Ease from neck to belly. Integer lerp, no floats in the result.
      const t = y - neckLen + 1;
      width = aperture + Math.round(((belly - aperture) * t) / flareLen);
    } else {
      width = belly;
    }
    const half = width >> 1;
    rows.push({ l: mid - half, r: mid - half + width });
  }

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
  if (vessel.capacity < 450) problems.push(`capacity ${vessel.capacity} too small`);
  if (vessel.height > GRID.H) problems.push(`height ${vessel.height} exceeds grid`);
  for (let y = 0; y < vessel.height; y++) {
    const row = vessel.rows[y];
    if (row.l < 0 || row.r > GRID.W) problems.push(`row ${y} outside grid`);
    if (row.r - row.l < 1) problems.push(`row ${y} has no interior`);
  }
  // A belly wider than the mouth is the point; a belly NARROWER than the
  // mouth would trap material against an overhang the CA can't drain.
  if (vessel.belly < vessel.aperture) problems.push('belly narrower than mouth');
  return problems;
}
