// Swell and surfing (docs/ALIVE-SEA.md decision 16): outside the skerries a long, low swell rolls in from the open sea and you
// can surf it on a broad reach or run; in among the skerries the water is flat. Pure, no THREE, no clock inside.
//
// The swell is a single travelling sine wave, h = amp x exposure x sin(k (x tx + z tz) + phase), phase = -k c t. Everything that needs the
// sea's height (the water shader, the boat's bob, the surf rule) uses THIS formula, so they always agree. Its direction and length
// are fixed for the day (a real swell is a separate system from the local wind, and a fixed length keeps the crests continuous
// through the whole day); only its height follows the day's sea state.
import { weatherAt } from './weather.js';
import { hash01, smoothstep, clamp } from './weather-noise.js';

const DEG = Math.PI / 180;

export const SWELL = {
  // Where it comes from (compass bearing it travels FROM) per day type, +-DIR_JITTER from the seed: the open Skagerrak, W to SW.
  DIR_FROM_DEG: { 'sea-breeze': 255, 'grey-westerly': 265, 'misty-morning': 235, unsettled: 270 },
  DIR_JITTER_DEG: 8,
  LENGTH_M: 26, // crest to crest (about 4 boat lengths): readable on a phone and long enough to ride
  SPEED_MS: 6.4, // how fast the crests travel (c). Slower than a fast boat, so a fast boat overtakes crests and drops down their fronts
  AMP_MIN_M: 0.15, // a flat day still breathes ...
  AMP_MAX_M: 0.85, // ... and a big sea day rolls this high (crest to trough 1.7 m, slope up to ~12 degrees)
  SEA_FROM: 0.1, // sea state at which the swell starts to build ...
  SEA_FULL: 0.9, // ... and where it is at the maximum
  EXPOSURE_FROM: 0.35, // open-water exposure (0..1) below this: flat. This is "flat in among the skerries" ...
  EXPOSURE_FULL: 0.9, // ... and at this it is the full swell
  EDGE_FADE: 0.15, // the swell fades out over the outer 15% of the painted window (no hard edge on screen)

  // Surfing: a speed burst while you ride down the front of a crest on a broad reach or run.
  SURF_MAX_MS: 3.2, // extra target speed at the best spot of the best wave
  SURF_AMP_REF_M: 0.5, // swell height at which the burst is at its full size (smaller swell = a smaller burst)
  SURF_ALIGN_FROM: 0.34, // cos of the angle between your heading and the way the swell travels: wider than 70 degrees: nothing ...
  SURF_ALIGN_FULL: 0.82, // ... within 35 degrees: full (a broad reach to a run)
  SURF_SPEED_FROM: 2, // you must be moving to be caught by a wave: nothing below this ...
  SURF_SPEED_FULL: 4, // ... full from here
  SURF_FACE_POWER: 1.2, // the burst follows how steep the front face is under you, to this power
};

// The day's swell. Returns { dirDeg (FROM, compass), dir (game radians FROM), tx, tz (unit vector it TRAVELS along, game x/z),
// amp (metres, before exposure), k (rad/m), c (m/s), lengthM }.
export function swellFor(daySeed, dayType, gameTimeS) {
  const from = SWELL.DIR_FROM_DEG[dayType] ?? 260;
  const dirDeg = from + (hash01(daySeed, 61) - 0.5) * 2 * SWELL.DIR_JITTER_DEG;
  const dir = Math.PI - dirDeg * DEG; // the game's wind-style direction (weather.js compassToDir)
  const sea = weatherAt(daySeed, gameTimeS, dayType).seaState;
  const amp = SWELL.AMP_MIN_M + (SWELL.AMP_MAX_M - SWELL.AMP_MIN_M) * smoothstep(SWELL.SEA_FROM, SWELL.SEA_FULL, sea);
  return { dirDeg, dir, tx: -Math.sin(dir), tz: -Math.cos(dir), amp, k: (2 * Math.PI) / SWELL.LENGTH_M, c: SWELL.SPEED_MS, lengthM: SWELL.LENGTH_M };
}

// How much of the swell an open-water exposure lets through: flat among the skerries, the whole thing outside.
export const exposureGain = (exposure) => smoothstep(SWELL.EXPOSURE_FROM, SWELL.EXPOSURE_FULL, exposure);

// The wave's phase argument at (x, z) at game time t.
export const swellTheta = (sw, x, z, t) => sw.k * (x * sw.tx + z * sw.tz - sw.c * t);
// The phase the shader gets as a uniform: -k c t, kept small so float32 stays exact (the x, z part is added per vertex).
export const swellPhaseUniform = (sw, t) => { const p = -sw.k * sw.c * t; return ((p % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); };

// Height of the swell (metres) at (x, z), t, for an open-water exposure.
export const swellHeight = (sw, x, z, t, exposure) => sw.amp * exposureGain(exposure) * Math.sin(swellTheta(sw, x, z, t));

// The speed burst for riding down a crest's front. headingRad: your heading (x = sin, z = cos); speed in m/s.
// Returns metres per second to add to the target speed (>= 0).
export function surfBoost(sw, headingRad, x, z, t, exposure, speed) {
  const E = exposureGain(exposure);
  if (E <= 0) return 0;
  const face = Math.max(0, -Math.cos(swellTheta(sw, x, z, t))); // 1 mid-way down the front of a crest, 0 on the back or the top
  if (face <= 0) return 0;
  const align = smoothstep(SWELL.SURF_ALIGN_FROM, SWELL.SURF_ALIGN_FULL, Math.sin(headingRad) * sw.tx + Math.cos(headingRad) * sw.tz);
  const caught = smoothstep(SWELL.SURF_SPEED_FROM, SWELL.SURF_SPEED_FULL, speed);
  const size = clamp((sw.amp * E) / SWELL.SURF_AMP_REF_M, 0, 1);
  return SWELL.SURF_MAX_MS * Math.pow(face, SWELL.SURF_FACE_POWER) * align * caught * size;
}
