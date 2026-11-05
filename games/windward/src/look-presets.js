// Look presets and the ?tune=1 URL format (look pass 2, 2026-11-05).
//
// Every value the tuning panel can change lives in config.js; this module only
// knows WHICH keys are tunable, what range each may take, the "Before" values
// (the golden-hour look of pass 1, kept so Felix can flip back and forth), and
// how to turn a set of values into URL parameters and back. No DOM here, so it
// is all testable in node.
//
// "Skagen" is not stored: it is captured from config.js when this module loads
// (game.js imports it before any URL override is applied), so config.js stays
// the single source of truth.
import { CONFIG } from './config.js';

// key -> { type: 'color' | 'num', min?, max? }. A colour is a 0xRRGGBB number.
export const LOOK_SPECS = {
  // sea
  LOOK_SEA_DEEP: { type: 'color' },
  LOOK_SEA_MID: { type: 'color' },
  LOOK_SEA_SHALLOW: { type: 'color' },
  LOOK_SHALLOW_SAT: { type: 'num', min: 0, max: 1.5 },
  LOOK_SEA_BRIGHTNESS: { type: 'num', min: 0.5, max: 1.5 },
  LOOK_FOAM: { type: 'color' },
  LOOK_FOAM_WIND_AMOUNT: { type: 'num', min: 0, max: 1 },
  // ground
  LOOK_GRANITE: { type: 'color' },
  LOOK_GRANITE_PALE: { type: 'color' },
  LOOK_GRANITE_SHADOW: { type: 'color' },
  LOOK_MEADOW: { type: 'color' },
  LOOK_MEADOW_2: { type: 'color' },
  LOOK_MEADOW_COOL: { type: 'color' },
  LOOK_HEATHER: { type: 'color' },
  LOOK_SAND: { type: 'color' },
  LOOK_WET: { type: 'color' },
  LOOK_PINE: { type: 'color' },
  LOOK_TRUNK: { type: 'color' },
  LOOK_GRANITE_TINT: { type: 'num', min: 0, max: 1 },
  LOOK_MEADOW_TINT: { type: 'num', min: 0, max: 1 },
  LOOK_ISLAND_BRIGHTNESS: { type: 'num', min: 0.5, max: 1.8 },
  // light, sky, haze
  SUN_COLOR: { type: 'color' },
  SUN_INTENSITY: { type: 'num', min: 0, max: 6 },
  LIGHT_ELEVATION_DEG: { type: 'num', min: 5, max: 60 },
  HEMI_SKY_COLOR: { type: 'color' },
  HEMI_GROUND_COLOR: { type: 'color' },
  HEMI_INTENSITY: { type: 'num', min: 0, max: 5 },
  SKY_HORIZON_COLOR: { type: 'color' },
  SKY_ZENITH_COLOR: { type: 'color' },
  GLOW_COLOR: { type: 'color' },
  HAZE_COLOR: { type: 'color' },
};
export const LOOK_KEYS = Object.keys(LOOK_SPECS);

const pick = (src) => Object.fromEntries(LOOK_KEYS.map((k) => [k, src[k]]));

// Skagen = whatever config.js says right now, at import (before any override).
export const SKAGEN = pick(CONFIG);

// The pass-1 "golden hour" look, exactly as the preview showed it.
export const BEFORE = {
  LOOK_SEA_DEEP: 0x1c66b8,
  LOOK_SEA_MID: 0x298ccc,
  LOOK_SEA_SHALLOW: 0x5cd1d1,
  LOOK_SHALLOW_SAT: 1,
  LOOK_SEA_BRIGHTNESS: 1,
  LOOK_FOAM: 0xf5fcff,
  LOOK_FOAM_WIND_AMOUNT: 0,
  LOOK_GRANITE: 0xf0d3cd,
  LOOK_GRANITE_PALE: 0xfdeee9,
  LOOK_GRANITE_SHADOW: 0xddb6ad,
  LOOK_MEADOW: 0xa8e851,
  LOOK_MEADOW_2: 0x74d24b,
  LOOK_MEADOW_COOL: 0xa8e851,
  LOOK_HEATHER: 0xc9a0d4,
  LOOK_SAND: 0xfbe9a8,
  LOOK_WET: 0x9a7f7a,
  LOOK_PINE: 0x35694c,
  LOOK_TRUNK: 0x928164,
  LOOK_GRANITE_TINT: 0,
  LOOK_MEADOW_TINT: 0,
  LOOK_ISLAND_BRIGHTNESS: 1,
  SUN_COLOR: 0xffd9a6,
  SUN_INTENSITY: 1.4,
  LIGHT_ELEVATION_DEG: 10,
  HEMI_SKY_COLOR: 0xcbc9ad,
  HEMI_GROUND_COLOR: 0x21406a,
  HEMI_INTENSITY: 0.45,
  SKY_HORIZON_COLOR: 0xecf8f1,
  SKY_ZENITH_COLOR: 0x00faff,
  GLOW_COLOR: 0xffe5b8,
  HAZE_COLOR: 0xe9d3a6,
};

export const PRESETS = { before: BEFORE, skagen: SKAGEN };

// Clamp/validate one value; returns undefined if it is not usable.
export function cleanValue(key, v) {
  const spec = LOOK_SPECS[key];
  if (!spec) return undefined;
  if (spec.type === 'color') return Number.isInteger(v) && v >= 0 && v <= 0xffffff ? v : undefined;
  return Number.isFinite(v) ? Math.min(spec.max, Math.max(spec.min, v)) : undefined;
}

// Writes values into a config object (only known, valid keys). Returns the keys set.
export function applyValues(target, values) {
  const set = [];
  for (const [k, raw] of Object.entries(values)) {
    const v = cleanValue(k, raw);
    if (v !== undefined) {
      target[k] = v;
      set.push(k);
    }
  }
  return set;
}

// URL <-> values. Colours are written as 6 hex digits, numbers as decimals;
// only values that differ from `defaults` (Skagen) are written, so the link
// stays short and a bare ?tune=1 means "Skagen as configured".
const HEX6 = /^[0-9a-fA-F]{6}$/;
export function parseLookParams(search) {
  const out = {};
  const params = new URLSearchParams(search);
  for (const key of LOOK_KEYS) {
    if (!params.has(key)) continue;
    const text = params.get(key);
    const v = LOOK_SPECS[key].type === 'color' ? (HEX6.test(text) ? parseInt(text, 16) : undefined) : (text.trim() === '' ? undefined : Number(text));
    const clean = cleanValue(key, v);
    if (clean !== undefined) out[key] = clean;
  }
  return out;
}

const round = (n) => Math.round(n * 1000) / 1000;
export function lookToSearch(search, values, defaults = SKAGEN) {
  const params = new URLSearchParams(search);
  for (const key of LOOK_KEYS) params.delete(key);
  for (const key of LOOK_KEYS) {
    const v = values[key];
    if (v === undefined || v === defaults[key]) continue;
    params.set(key, LOOK_SPECS[key].type === 'color' ? v.toString(16).padStart(6, '0') : String(round(v)));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}
