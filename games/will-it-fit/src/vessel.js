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
  const tightness = Math.min(1, (stage - 1) / 30);
  const apMax = Math.round(13 - 7 * tightness);
  const aperture = Math.max(4, pick(Math.max(4, apMax - 3), apMax));

  const shapeStage = stage >= 10;
  const belly = shapeStage
    ? Math.min(GRID.W - 4, aperture + pick(4, 16))
    : Math.min(GRID.W - 4, aperture + pick(4, 9));
  const height = shapeStage ? pick(30, GRID.H - 4) : pick(28, 40);
  const neckLen = shapeStage ? pick(2, 10) : pick(2, 5);
  const flareLen = Math.max(2, pick(3, 8));

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
  return {
    rows,
    height,
    aperture,
    belly,
    neckLen,
    mouth: { l: rows[0].l, r: rows[0].r },
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
  if (vessel.capacity < 120) problems.push(`capacity ${vessel.capacity} too small`);
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
