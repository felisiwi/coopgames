// Pure sail-speed model (games/windward/DESIGN.md). No Three.js imports —
// must run headless (see sail.test.js).
import { CONFIG } from './config.js';

const DEG = Math.PI / 180;
const NO_GO_HALF_DEG = 22.5;

// Polar curve key points: (degrees off the wind, speed factor before
// strength/trim). Smoothstep-interpolated between consecutive points — one
// continuous curve from the no-go edge through the peak to dead downwind,
// no seams (DESIGN.md's explicit correction over independent pieces).
const CURVE = [
  { deg: NO_GO_HALF_DEG, factor: 0 },
  { deg: 90, factor: 0.95 },
  { deg: 100, factor: 1.0 },
  { deg: 180, factor: 0.8 },
];

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function wrapToPi(angle) {
  let a = angle % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

// Angle between heading and the wind-from direction, folded to [0, PI] —
// port/starboard are symmetric.
export function angleOffWind(headingRad, windFromRad) {
  return Math.abs(wrapToPi(headingRad - windFromRad));
}

export function speedFactor(angleRad) {
  const deg = angleRad / DEG;
  if (deg <= CURVE[0].deg) return 0;
  for (let i = 1; i < CURVE.length; i++) {
    if (deg <= CURVE[i].deg) {
      const a = CURVE[i - 1];
      const b = CURVE[i];
      return a.factor + (b.factor - a.factor) * smoothstep(a.deg, b.deg, deg);
    }
  }
  return CURVE[CURVE.length - 1].factor;
}

// Ideal sheet angle for a given angle off the wind — "sheet at roughly half
// the wind angle" (DESIGN.md): tight close-hauled, eased running.
export function idealTrimRad(angleOffWindRad) {
  return angleOffWindRad / 2;
}

// Forgiving window (W0.8: narrowed from the W0 window of 15). Within this
// many degrees of ideal, full speed — "not pixel-precise" still holds, but
// the old +-15 window ate most of the achievable mistrim range: since
// idealTrim is itself capped at 0..90 (DESIGN.md), the largest diff a player
// can actually produce at a mid-range ideal (e.g. 45 deg, beam reach) is
// only 45 deg either direction, so the old window+floor combo topped out
// around a 1.25x speed spread there — imperceptible (W0.8 item 1 diagnosis).
export const TRIM_FULL_WINDOW_DEG = 8;
// Floor multiplier and the diff at which it's reached — chosen so a beam
// reach's worst achievable mistrim (diff 45, sheet fully in/out against a
// 45deg ideal) lands close to the floor: ~2.9x spread, inside the "roughly
// 2-3x" target. Never all the way to 0 (DESIGN.md: "bad trim is slow, never
// stuck").
const TRIM_FLOOR = 0.25;
const TRIM_FLOOR_AT_DEG = 50;

export function trimMultiplier(actualTrimRad, idealTrimRadValue) {
  const diffDeg = Math.abs(actualTrimRad - idealTrimRadValue) / DEG;
  if (diffDeg <= TRIM_FULL_WINDOW_DEG) return 1;
  if (diffDeg >= TRIM_FLOOR_AT_DEG) return TRIM_FLOOR;
  const t = (diffDeg - TRIM_FULL_WINDOW_DEG) / (TRIM_FLOOR_AT_DEG - TRIM_FULL_WINDOW_DEG);
  return 1 - t * (1 - TRIM_FLOOR);
}

// Which side the sail swings to (leeward) for the boat mesh's sail pivot —
// a sign, not a distance. Rendering-only, not exercised by the speed model.
export function leewardSign(headingRad, windFromRad) {
  return wrapToPi(windFromRad - headingRad) >= 0 ? 1 : -1;
}

// trimRad omitted (or null) means "assume ideal trim" — full speed, used to
// isolate the wind/heading curve from the trim system (tests, and the
// remote peer's boat in W0 whose trim isn't synced over the wire).
//
// This is the *target* speed for the current heading/wind/trim, not
// necessarily the boat's actual instantaneous speed — W0.8's game.js eases
// self.speed toward this target at CONFIG.SAIL_FORCE/DRAG rather than
// snapping to it, so the boat has some weight (see game.js's approachSpeed).
export function boatSpeed(headingRad, windFromRad, strength, trimRad) {
  const angle = angleOffWind(headingRad, windFromRad);
  const factor = speedFactor(angle);
  const trimMult = trimRad == null ? 1 : trimMultiplier(trimRad, idealTrimRad(angle));
  return CONFIG.BOAT_MAX_SPEED * strength * factor * trimMult;
}
