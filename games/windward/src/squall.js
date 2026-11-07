// Squalls on unsettled days (docs/ALIVE-SEA.md decision 12): an approaching dark line, wind +~60% and a ~30 degree
// swing, rain, passing in 1 to 2 minutes, with plenty of warning. Pure, no THREE, no clock inside.
//
// A squall is a line that moves downwind across the sea at SQUALL.SPEED_MS. It is a fixed event of the day:
// squallPlanFor(daySeed, dayType) decides when each one crosses the arena centre, so both phones agree with no
// messages. squallAt() then says, for any point and moment, how hard the squall is blowing there, and how far
// ahead of you the line still is (that distance is what the lab draws as the dark cloud + dark line on the water).
import { weatherAt, timeOfHour } from './weather.js';
import { hash01, smoothstep, lerp, clamp } from './weather-noise.js';

const DEG = Math.PI / 180;

export const SQUALL = {
  PER_DAY_MIN: 2, // squalls on an unsettled day ...
  PER_DAY_MAX: 3, // ... (other day types have none)
  FROM_HOUR: 10, // they come between these game hours
  TO_HOUR: 20,
  MIN_GAP_S: 240, // never two squalls closer than this at the same place (real seconds)
  SPEED_MS: 9, // m/s the line travels downwind
  DURATION_MIN_S: 60, // how long a point sits inside it (squall depth = speed x this)
  DURATION_MAX_S: 120,
  RAMP_M: 70, // the front rises over this distance (~8 s at 9 m/s): a gust front, not a step
  BODY_FRACTION: 0.5, // the strongest part lasts this fraction of the depth, then it fades
  GAIN: 0.6, // wind +60% at the heart
  SWING_DEG: 30, // direction swing at the heart (veering or backing, set by the seed)
  PRELUDE_M: 150, // the calm before: wind dips this far ahead of the line ...
  PRELUDE_DIP: 0.15, // ... by up to this fraction
  WIDTH_M: 3000, // the line is this long across
  EDGE_M: 500, // and fades at its two ends over this
  BAND_AHEAD_M: 80, // the dark line on the water starts this far ahead of the front ...
  BAND_BEHIND_M: 60, // ... and the front's own dark edge fades over this far behind it, into the squall body
  WARNING_M: 700, // the dark cloud is visible this far ahead of the line (about 75 s at 9 m/s)
  RAIN_AHEAD_M: 120, // rain starts just before the front
};

// An event: when the line crosses `center`, which way it travels, how deep it is.
// dirDeg = compass bearing the wind (and so the squall) comes FROM.
export function makeSquall(daySeed, index, tArrive, center, dirDeg) {
  const travel = (dirDeg + 180) * DEG; // compass bearing it travels TOWARDS
  const east = Math.sin(travel);
  const north = Math.cos(travel);
  const duration = lerp(SQUALL.DURATION_MIN_S, SQUALL.DURATION_MAX_S, hash01(daySeed, 800 + index, 1));
  return {
    index,
    tArrive,
    speed: SQUALL.SPEED_MS,
    durationS: duration,
    depthM: SQUALL.SPEED_MS * duration,
    center: { x: center.x, z: center.z },
    // unit vectors in game (x, z): travel (downwind) and across; north = -z
    tx: east, tz: -north,
    px: north, pz: east, // across = travel rotated 90 degrees (right-hand side)
    lateralM: (hash01(daySeed, 800 + index, 2) - 0.5) * 600, // the line's centre is up to 300 m off the arena centre
    swingSign: hash01(daySeed, 800 + index, 3) < 0.65 ? 1 : -1, // mostly a veer
  };
}

// The day's squalls, sorted by arrival time. `center` = the arena centre (game metres).
export function squallPlanFor(daySeed, dayType, center = { x: 0, z: 0 }) {
  if (dayType !== 'unsettled') return [];
  const n = SQUALL.PER_DAY_MIN + Math.floor(hash01(daySeed, 790) * (SQUALL.PER_DAY_MAX - SQUALL.PER_DAY_MIN + 1));
  const span = SQUALL.TO_HOUR - SQUALL.FROM_HOUR;
  const plan = [];
  let lastT = -Infinity;
  for (let i = 0; i < n; i++) {
    // one in each of n equal slices of the window, jittered inside the middle 60% of the slice
    const hour = SQUALL.FROM_HOUR + ((i + 0.2 + 0.6 * hash01(daySeed, 791, i)) / n) * span;
    const t = Math.max(timeOfHour(hour), lastT + SQUALL.MIN_GAP_S);
    lastT = t;
    plan.push(makeSquall(daySeed, i, t, center, weatherAt(daySeed, t, dayType).dirDeg));
  }
  return plan;
}

const NONE = Object.freeze({ intensity: 0, strengthMul: 1, swingRad: 0, aheadM: null, behindM: null, etaS: null, cloud: 0, rain: 0, band: 0, index: -1, event: null });

// How the plan's squalls act on point (x, z) at game time t. Returns:
//   intensity 0..1 (1 = the heart), strengthMul (multiply the wind by this), swingRad (add to the wind's dir),
//   aheadM (metres the line is still ahead of you, null when none is coming/here), etaS (seconds until it reaches you),
//   cloud 0..1 (how strongly the dark cloud/line shows: 0 beyond WARNING_M, 1 at your door), rain 0..1,
//   band 0..1 (how dark the WATER is here: a dark line at the front, then the squall body), behindM (metres behind the front, null while ahead), event (the plan entry).
// The event nearest in time wins when two overlap (they never do on a plan: MIN_GAP_S).
export function squallAt(plan, x, z, t) {
  let best = NONE;
  for (const e of plan) {
    const s = (x - e.center.x) * e.tx + (z - e.center.z) * e.tz; // my position along the travel axis
    const c = (x - e.center.x) * e.px + (z - e.center.z) * e.pz - e.lateralM; // across, from the line's centre
    const front = e.speed * (t - e.tArrive); // the line's position along the axis now
    const ahead = s - front; // > 0: the line has not reached me yet
    const behind = -ahead;
    if (ahead > SQUALL.WARNING_M || behind > e.depthM + SQUALL.RAMP_M) continue;
    const lateral = 1 - smoothstep(SQUALL.WIDTH_M / 2 - SQUALL.EDGE_M, SQUALL.WIDTH_M / 2, Math.abs(c));
    if (lateral <= 0) continue;
    let intensity = 0;
    let dip = 0;
    if (ahead > 0) {
      dip = SQUALL.PRELUDE_DIP * (1 - smoothstep(0, SQUALL.PRELUDE_M, ahead)) * lateral;
    } else {
      intensity = smoothstep(0, SQUALL.RAMP_M, behind) * (1 - smoothstep(e.depthM * SQUALL.BODY_FRACTION, e.depthM, behind)) * lateral;
    }
    const cloud = ahead > 0 ? (1 - clamp(ahead / SQUALL.WARNING_M, 0, 1)) * lateral : lateral * (1 - smoothstep(e.depthM * 0.7, e.depthM, behind));
    const rain = lateral * (ahead > SQUALL.RAIN_AHEAD_M ? 0 : ahead > 0 ? 1 - ahead / SQUALL.RAIN_AHEAD_M : 1 - smoothstep(e.depthM * 0.6, e.depthM, behind));
    const band = lateral * (ahead > 0 ? 1 - smoothstep(0, SQUALL.BAND_AHEAD_M, ahead) : Math.max(intensity * 0.85, 1 - smoothstep(0, SQUALL.BAND_BEHIND_M, behind)));
    if (cloud > best.cloud || intensity > best.intensity) {
      best = {
        band,
        event: e,
        behindM: ahead > 0 ? null : behind,
        intensity,
        strengthMul: (1 + SQUALL.GAIN * intensity) * (1 - dip),
        swingRad: SQUALL.SWING_DEG * DEG * intensity * e.swingSign,
        aheadM: ahead > 0 ? ahead : null,
        etaS: ahead > 0 ? ahead / e.speed : null,
        cloud,
        rain,
        index: e.index,
      };
    }
  }
  return best;
}

// Warning check for the lab/HUD: seconds until the next squall line reaches (x, z), or null. Looks at the whole day.
export function nextSquallEtaS(plan, x, z, t) {
  let best = null;
  for (const e of plan) {
    const s = (x - e.center.x) * e.tx + (z - e.center.z) * e.tz;
    const eta = e.tArrive + s / e.speed - t;
    if (eta > 0 && (best === null || eta < best)) best = eta;
  }
  return best;
}
