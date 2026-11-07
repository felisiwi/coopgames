// The sail-feel lab's own rules for how sailing FEELS (docs/ALIVE-SEA.md decisions 14 to 17). Pure, no THREE, no clock inside.
// Nothing here edits sail.js: it calls boatSpeed() and wraps it. The game can adopt these once Felix has felt them on his phone.
//
//   labTargetSpeed   boatSpeed() plus a light-air floor, so a calm morning or a lee is slow but never dead
//   heelTarget/stepHeel   the boat leans in gusts and strong wind (more close-hauled, less running)
//   stepLuff         the sail flutters when you are headed (the wind shifted toward the bow) or pointing too high: THE shift signal
//   cameraFeel       the camera dips and tightens with speed, looks ahead, and pulls back when slow
import { boatSpeed, speedFactor, trimMultiplier, idealTrimRad, angleOffWind } from './sail.js';
import { smoothstep, clamp } from './weather-noise.js';

const DEG = Math.PI / 180;

export const FEEL = {
  // --- light-air floor (the other agent adds one in sail.js; this one lives only in the lab) ---
  LIGHT_AIR_FLOOR_MS: 2.2, // on a good point of sail the boat still makes at least this much, however little wind
  FLOOR_TRIM_MIN: 0.5, // the floor still cares a little about trim (bad trim = a lower floor), never below this share

  // --- heel ---
  HEEL_MAX_RAD: 0.42, // the most it leans (~24 degrees)
  HEEL_FROM: 0.35, // heel power (strength x point of sail) where leaning starts ...
  HEEL_FULL: 1.1, // ... and where it is at the maximum
  HEEL_RUNNING_RELIEF: 0.6, // dead downwind the boat is this much less heeled
  HEEL_TAU_S: 0.55, // how fast it leans into a gust (and comes back)

  // --- luff flutter ---
  LUFF_REF_TAU_S: 10, // the "course you were settled on" is your angle to the wind averaged over this long
  LUFF_HEADED_FROM_DEG: 3, // headed by this much: the first flutter ...
  LUFF_HEADED_FULL_DEG: 12, // ... by this much: full flapping
  LUFF_EDGE_FROM_DEG: 38, // pointing closer than this to the wind: the sail starts to shiver ...
  LUFF_EDGE_FULL_DEG: 26, // ... and flaps fully near the edge of the no-go zone (22.5)
  LUFF_EDGE_SHARE: 0.85, // edge flutter never quite reaches the full flap of a real header
  LUFF_DECAY_TAU_S: 0.9, // flutter eases off this fast once the cause is gone
  LUFF_FLUTTER_HZ: 7, // flap rate
  LUFF_FLUTTER_RAD: 0.22, // swing of the sail in a full flap (~12 degrees each way)

  // --- camera ---
  CAM_SPEED_FULL_MS: 10, // speed that counts as "fast" for the camera (the game's BOAT_MAX_SPEED)
  CAM_DIP_DEG: 12, // camera drops this much lower at full speed
  CAM_TIGHT: 0.2, // and moves this fraction closer
  CAM_LOOK_AHEAD_M: 45, // and looks this far ahead of the bow at full speed. Measured: at zoom 1.4 the top of the screen sees ~75 m ahead standing still, ~120 m at speed (~15 s of sailing): the 10 to 20 s gust warning
  CAM_TAU_S: 1.4, // the camera's reading of your speed is smoothed over this long (no lurching)

  // --- bow spray ---
  SPRAY_FROM: 0.4, // spray starts at this share of fast
  SPRAY_RATE_MAX: 70, // droplets per second at full tilt (before the slider)
  SPRAY_LIFE_S: 0.75,
  SPRAY_UP_MS: 3.4, // m/s thrown up
  SPRAY_SIDE_MS: 2.6, // m/s thrown sideways
  SPRAY_SIZE_M: 0.5,

  // --- wake ---
  WAKE_FROM_MS: 0.4, // the wake starts above this speed
  WAKE_SIZE_MIN: 0.5, // foam disk size (m) at a crawl ...
  WAKE_SIZE_GAIN: 2.4, // ... plus this x speed share
  WAKE_LIFE_MIN_S: 1.1,
  WAKE_LIFE_GAIN_S: 1.8, // longer trail when fast
  WAKE_OPACITY: 0.55,
};

export const speedShare = (speedMs) => clamp(speedMs / FEEL.CAM_SPEED_FULL_MS, 0, 1.3);

// boatSpeed() with a floor. Pointing inside the no-go zone is still 0 (you cannot sail into the wind);
// anywhere else the target is at least LIGHT_AIR_FLOOR_MS x (how good the point of sail is) x (a bit of trim).
export function labTargetSpeed(headingRad, windFromRad, strength, trimRad) {
  const base = boatSpeed(headingRad, windFromRad, strength, trimRad);
  const angle = angleOffWind(headingRad, windFromRad);
  const factor = speedFactor(angle);
  if (factor <= 0) return base;
  const trimMult = trimRad == null ? 1 : trimMultiplier(trimRad, idealTrimRad(angle));
  const floor = FEEL.LIGHT_AIR_FLOOR_MS * factor * (FEEL.FLOOR_TRIM_MIN + (1 - FEEL.FLOOR_TRIM_MIN) * trimMult);
  return Math.max(base, floor);
}

// ---- heel ----
// How hard the wind presses on the sail: strength, less so running downwind.
export const heelPower = (strength, angleOffRad) => strength * (1 - FEEL.HEEL_RUNNING_RELIEF * smoothstep(100 * DEG, 180 * DEG, angleOffRad));
export const heelTarget = (strength, angleOffRad) => FEEL.HEEL_MAX_RAD * smoothstep(FEEL.HEEL_FROM, FEEL.HEEL_FULL, heelPower(strength, angleOffRad));
export function stepHeel(heel, target, dt) { return heel + (target - heel) * (1 - Math.exp(-dt / FEEL.HEEL_TAU_S)); }

// ---- luff flutter ----
export const createLuffState = () => ({ ref: null, luff: 0, headedDeg: 0 });
// angleOffRad: how far off the wind you are pointing now (0 = into it, PI = running). Returns the state (luff 0..1; headedDeg > 0 = headed).
export function stepLuff(state, angleOffRad, dt) {
  if (state.ref === null) state.ref = angleOffRad;
  const headed = (state.ref - angleOffRad) / DEG; // positive: now closer to the wind than you were settled
  state.headedDeg = headed;
  const fromHeader = smoothstep(FEEL.LUFF_HEADED_FROM_DEG, FEEL.LUFF_HEADED_FULL_DEG, headed);
  const fromEdge = FEEL.LUFF_EDGE_SHARE * smoothstep(FEEL.LUFF_EDGE_FROM_DEG, FEEL.LUFF_EDGE_FULL_DEG, angleOffRad / DEG);
  const target = Math.max(fromHeader, fromEdge);
  state.luff = target >= state.luff ? target : state.luff + (target - state.luff) * (1 - Math.exp(-dt / FEEL.LUFF_DECAY_TAU_S)); // flutter starts at once, fades gently
  state.ref += (angleOffRad - state.ref) * (1 - Math.exp(-dt / FEEL.LUFF_REF_TAU_S)); // you slowly get used to the new angle
  return state;
}
// The sail's flap, in radians to add to the sail angle, for a luff 0..1 at time tS (two sines so it never looks metronomic).
export const luffFlutter = (luff, tS) => luff <= 0 ? 0 : luff * FEEL.LUFF_FLUTTER_RAD * (0.65 * Math.sin(tS * FEEL.LUFF_FLUTTER_HZ * 2 * Math.PI) + 0.35 * Math.sin(tS * FEEL.LUFF_FLUTTER_HZ * 3.1 * Math.PI + 1.3));

// ---- camera ----
// share = speedShare() smoothed; returns how the camera differs from the game's fixed rig.
export function cameraFeel(share, { dip = true, look = true } = {}) {
  const s = clamp(share, 0, 1.2);
  return { elevDropDeg: dip ? FEEL.CAM_DIP_DEG * s : 0, distMul: dip ? 1 - FEEL.CAM_TIGHT * s : 1, lookAheadM: look ? FEEL.CAM_LOOK_AHEAD_M * s : 0 };
}
export const smoothShare = (current, speedMs, dt) => current + (speedShare(speedMs) - current) * (1 - Math.exp(-dt / FEEL.CAM_TAU_S));

// ---- spray + wake ----
export const sprayRate = (share, strength, amount = 1) => FEEL.SPRAY_RATE_MAX * amount * smoothstep(FEEL.SPRAY_FROM, 1, share) * (0.6 + 0.4 * clamp(strength, 0, 1.25));
export const wakeSize = (speedMs) => FEEL.WAKE_SIZE_MIN + FEEL.WAKE_SIZE_GAIN * clamp(speedMs / FEEL.CAM_SPEED_FULL_MS, 0, 1.2);
export const wakeLife = (speedMs) => FEEL.WAKE_LIFE_MIN_S + FEEL.WAKE_LIFE_GAIN_S * clamp(speedMs / FEEL.CAM_SPEED_FULL_MS, 0, 1.2);
