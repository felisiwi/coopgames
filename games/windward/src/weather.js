// The day's weather: a fixed function of (daySeed, gameTimeS). Pure, no THREE, no clock inside.
//
// Weather is the SOURCE of the wind (docs/ALIVE-SEA.md "Grill: weather and sail feel", decisions 1-4, 7, 9):
// it gives the day's steady wind (direction slowly veering, strength following the day's rhythm), the sea
// state and the visibility. Everything that makes sailing lively on top of it (shifts, gusts, lees,
// funnelling, utomskars) lives in wind-field.js. The same seed + the same clock = the same weather on every phone.
//
// Time: gameTimeS is seconds since midnight of the game day. One game day lasts WEATHER.GAME_DAY_S real
// seconds (30 minutes, tunable). Hour 0..24 is gameTimeS / GAME_DAY_S * 24, wrapping each day.
//
// Directions: `dirDeg` is the compass bearing the wind blows FROM (0 = N, 90 = E, 270 = W: a westerly).
// `dir` is the same in the game's radians (sail.js, wind.js: x = sin(dir), z = cos(dir), north = -z),
// where dir = PI - bearing. Strength is 0..1 as boatSpeed() wants it; windMs() turns it into metres/second.
import { hash01, noise1p, clamp, smoothstep, lerp } from './weather-noise.js';

const DEG = Math.PI / 180;

export const WEATHER = {
  GAME_DAY_S: 1800, // one game day in real seconds (30 min). Tune on the phone.
  WIND_MS_MIN: 2, // m/s at strength 0 (the game's WIND_STRENGTH_MIN_MS; copied so this file stays standalone)
  WIND_MS_MAX: 14, // m/s at strength 1

  // Every day gets a little personal variation from its seed:
  SEED_STRENGTH_JITTER: 0.10, // +-10% on the whole day's strength
  SEED_DIR_JITTER_DEG: 12, // +-12 degrees on the day's direction
  SEED_TIME_JITTER_H: 0.75, // the day's rhythm runs up to 45 minutes early or late
  WANDER_CELLS: 15, // random ups and downs of the strength: this many per day (every 1.6 h). Looping noise, so midnight has no jump
  DIR_WANDER_CELLS: 8, // random veers/backs of the direction: this many per day (every 3 h)

  SEA_LAG_H: 1.5, // the sea state follows the wind with this lag (hours): waves take time to build
  SEA_GAIN: 1.15, // sea state = lagged strength x this, clamped to 0..1
  SEA_MIN: 0.08, // never a perfect mirror

  // Day types. strength: [hour, 0..1]. dir: [hour, compass bearing FROM, degrees]. vis: [hour, 1 = clear].
  // First key hour 0, last key hour 24, same value at both ends so the day wraps without a jump.
  // gustiness scales gust and shift size in wind-field.js (1 = normal). wander = +- strength noise. dirWander = +- degrees.
  // The rhythm of a classic Bohuslan summer day: calm light morning, a westerly sea breeze filling in
  // around midday, fresh in the afternoon, easing in the evening.
  PROFILES: {
    'sea-breeze': {
      label: 'Sea-breeze day',
      strength: [[0, 0.16], [6, 0.10], [9, 0.18], [11, 0.42], [13, 0.66], [16, 0.80], [19, 0.52], [22, 0.26], [24, 0.16]],
      dir: [[0, 300], [6, 170], [9, 200], [11, 240], [14, 270], [18, 285], [22, 300], [24, 300]], // light southerly morning, veering west
      vis: [[0, 1], [24, 1]],
      gustiness: 1.0, wander: 0.04, dirWander: 4, rainMax: 0,
    },
    'grey-westerly': {
      label: 'Grey westerly',
      strength: [[0, 0.52], [7, 0.56], [12, 0.70], [16, 0.72], [20, 0.60], [24, 0.52]],
      dir: [[0, 270], [8, 262], [14, 278], [20, 292], [24, 270]], // a front's veer
      vis: [[0, 0.9], [24, 0.9]],
      gustiness: 1.15, wander: 0.05, dirWander: 6, rainMax: 0,
    },
    'misty-morning': {
      label: 'Misty morning (clears)',
      strength: [[0, 0.06], [6, 0.05], [9, 0.08], [11, 0.18], [13, 0.34], [16, 0.50], [19, 0.40], [22, 0.20], [24, 0.06]],
      dir: [[0, 140], [6, 120], [10, 150], [13, 220], [17, 260], [21, 250], [24, 140]],
      vis: [[0, 0.5], [5, 0.2], [8, 0.18], [10, 0.35], [11.5, 0.7], [13, 1], [22, 1], [24, 0.5]], // thick at dawn, burns off by ~12:00
      gustiness: 0.6, wander: 0.02, dirWander: 5, rainMax: 0,
    },
    unsettled: {
      label: 'Unsettled (showers, squalls)',
      strength: [[0, 0.40], [6, 0.50], [10, 0.60], [14, 0.70], [18, 0.62], [22, 0.50], [24, 0.40]],
      dir: [[0, 250], [6, 235], [12, 260], [18, 290], [24, 250]],
      vis: [[0, 0.85], [24, 0.85]],
      gustiness: 1.35, wander: 0.09, dirWander: 9, rainMax: 1,
    },
  },
  SHOWER_CELLS: 50, // shower chances per day (every ~29 min of game time)
  SHOWER_FROM: 0.62, // noise above this starts a shower ...
  SHOWER_FULL: 0.85, // ... and this is a full one
  SHOWER_VIS_LOSS: 0.2, // a full shower takes this much off visibility
};

export const DAY_TYPES = Object.keys(WEATHER.PROFILES);

// The day type a seed gets when nothing forces one.
export function dayTypeFor(daySeed) {
  return DAY_TYPES[Math.floor(hash01(daySeed, 1) * DAY_TYPES.length) % DAY_TYPES.length];
}

// ---- the clock --------------------------------------------------------------------------------------------------
export function hourOf(gameTimeS) {
  const h = ((gameTimeS / WEATHER.GAME_DAY_S) * 24) % 24;
  return h < 0 ? h + 24 : h;
}
export const timeOfHour = (hour) => (hour / 24) * WEATHER.GAME_DAY_S;
export function formatClock(gameTimeS) {
  const h = hourOf(gameTimeS);
  const hh = Math.floor(h);
  return `${String(hh).padStart(2, '0')}:${String(Math.floor((h - hh) * 60)).padStart(2, '0')}`;
}
// '14:00' or '14.5' or '14' -> hours, or null if it is neither.
export function parseClock(text) {
  if (text == null) return null;
  const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(String(text).trim());
  if (m) { const h = Number(m[1]) + Number(m[2] || 0) / 60; return h <= 24 ? h : null; }
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 && n <= 24 ? n : null;
}

// ---- units and angles -------------------------------------------------------------------------------------------
export const windMs = (strength) => WEATHER.WIND_MS_MIN + (WEATHER.WIND_MS_MAX - WEATHER.WIND_MS_MIN) * strength;
export const compassToDir = (bearingDeg) => Math.PI - bearingDeg * DEG; // bearing the wind comes FROM -> the game's dir
export const dirToCompass = (dir) => { const b = (180 - dir / DEG) % 360; return b < 0 ? b + 360 : b; };
export const wrapPi = (a) => { let r = a % (2 * Math.PI); if (r > Math.PI) r -= 2 * Math.PI; if (r < -Math.PI) r += 2 * Math.PI; return r; };
// Blend two game directions the short way round.
export const lerpDir = (a, b, t) => a + wrapPi(b - a) * t;

// ---- keyframes --------------------------------------------------------------------------------------------------
function segment(keys, hour) {
  for (let i = 1; i < keys.length; i++) {
    if (hour <= keys[i][0]) {
      const [h0, v0] = keys[i - 1];
      const [h1, v1] = keys[i];
      return { v0, v1, t: h1 === h0 ? 0 : smoothstep(0, 1, (hour - h0) / (h1 - h0)) };
    }
  }
  const last = keys[keys.length - 1][1];
  return { v0: last, v1: last, t: 0 };
}
const keyed = (keys, hour) => { const s = segment(keys, hour); return lerp(s.v0, s.v1, s.t); };
const keyedAngleDeg = (keys, hour) => { // short way round between compass bearings
  const s = segment(keys, hour);
  let d = (s.v1 - s.v0) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return s.v0 + d * s.t;
};
const wrapHour = (h) => { const r = h % 24; return r < 0 ? r + 24 : r; };

// The day's steady strength at an hour, before the small random wander (used for the sea-state lag too).
function rhythmStrength(P, daySeed, hour) {
  const shift = (hash01(daySeed, 11) - 0.5) * 2 * WEATHER.SEED_TIME_JITTER_H;
  const jitter = 1 + (hash01(daySeed, 12) - 0.5) * 2 * WEATHER.SEED_STRENGTH_JITTER;
  return keyed(P.strength, wrapHour(hour + shift)) * jitter;
}

// The weather at a moment. dayType omitted = the seed's own. Returns:
//   type, hour, strength (0..1), dirDeg (compass FROM), dir (game radians), seaState (0..1), visibility (1 = clear),
//   rain (0..1), gustiness (scales gusts and shifts).
export function weatherAt(daySeed, gameTimeS, dayType = dayTypeFor(daySeed)) {
  const P = WEATHER.PROFILES[dayType];
  if (!P) throw new Error(`unknown day type: ${dayType}`);
  const hour = hourOf(gameTimeS);

  let strength = rhythmStrength(P, daySeed, hour);
  strength += (noise1p(daySeed + 3, (hour / 24) * WEATHER.WANDER_CELLS, WEATHER.WANDER_CELLS) * 2 - 1) * P.wander;
  strength = clamp(strength, 0.03, 1);

  const shift = (hash01(daySeed, 11) - 0.5) * 2 * WEATHER.SEED_TIME_JITTER_H;
  let dirDeg = keyedAngleDeg(P.dir, wrapHour(hour + shift));
  dirDeg += (hash01(daySeed, 13) - 0.5) * 2 * WEATHER.SEED_DIR_JITTER_DEG;
  dirDeg += (noise1p(daySeed + 4, (hour / 24) * WEATHER.DIR_WANDER_CELLS, WEATHER.DIR_WANDER_CELLS) * 2 - 1) * P.dirWander;
  dirDeg = ((dirDeg % 360) + 360) % 360;

  // The sea builds with the wind some time later: average the rhythm over the last SEA_LAG_H hours.
  let lagged = 0;
  for (let k = 0; k < 5; k++) lagged += rhythmStrength(P, daySeed, hour - (k / 4) * WEATHER.SEA_LAG_H);
  lagged /= 5;
  const seaState = clamp(Math.max(WEATHER.SEA_MIN, lagged * WEATHER.SEA_GAIN), 0, 1);

  const rain = P.rainMax * smoothstep(WEATHER.SHOWER_FROM, WEATHER.SHOWER_FULL, noise1p(daySeed + 5, (hour / 24) * WEATHER.SHOWER_CELLS, WEATHER.SHOWER_CELLS));
  const visibility = clamp(keyed(P.vis, hour) - rain * WEATHER.SHOWER_VIS_LOSS, 0.05, 1);

  return { type: dayType, hour, strength, dirDeg, dir: compassToDir(dirDeg), seaState, visibility, rain, gustiness: P.gustiness };
}
