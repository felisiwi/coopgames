// Looks for the time of day (stage 1e, batch 2b): the values the sky, the lights, the haze and the sea read from CONFIG every frame, as a named set that can be
// blended. Written for the opening (blue hour over today's Fiskebäckskil, then a storm night, then the grey dawn of 1950) but deliberately NOT tied to it: the later
// day/night stage reuses these sets (BLUE_HOUR for summer dusks, STORM_NIGHT for real darkness) and blendLook() to move between them. Pure: no THREE, no DOM.
import { CONFIG } from './config.js';

// Every CONFIG key a look sets. Terrain colours are NOT here: the ground is baked into vertex colours, so it darkens through the lights (hemisphere + sun) instead.
export const LOOK_KEYS = [
  'HEMI_SKY_COLOR', 'HEMI_GROUND_COLOR', 'HEMI_INTENSITY', 'SUN_COLOR', 'SUN_INTENSITY', 'LIGHT_ELEVATION_DEG',
  'SKY_HORIZON_COLOR', 'SKY_ZENITH_COLOR', 'HAZE_COLOR', 'GLOW_COLOR', 'GLOW_OPACITY',
  'LOOK_SEA_DEEP', 'LOOK_SEA_MID', 'LOOK_SEA_SHALLOW', 'LOOK_SEA_BRIGHTNESS',
];

// Blue hour: the sun is down, the sky is deep blue with a warm rim at the horizon, windows and boat lights are the warmest thing on the coast.
export const BLUE_HOUR = Object.freeze({
  HEMI_SKY_COLOR: 0x7596d6, HEMI_GROUND_COLOR: 0x222f5e, HEMI_INTENSITY: 1.15,
  SUN_COLOR: 0xe89a74, SUN_INTENSITY: 0.4, LIGHT_ELEVATION_DEG: 4,
  SKY_HORIZON_COLOR: 0xe39a7c, SKY_ZENITH_COLOR: 0x1d2c5a, HAZE_COLOR: 0x6e7ea6, GLOW_COLOR: 0xff9c68, GLOW_OPACITY: 0.55,
  LOOK_SEA_DEEP: 0x172c4d, LOOK_SEA_MID: 0x24456e, LOOK_SEA_SHALLOW: 0x45708f, LOOK_SEA_BRIGHTNESS: 0.78,
});

// A storm at night: nearly black, cold, the haze a little lighter than the sky so fog still reads.
export const STORM_NIGHT = Object.freeze({
  HEMI_SKY_COLOR: 0x2c3850, HEMI_GROUND_COLOR: 0x10131d, HEMI_INTENSITY: 0.5,
  SUN_COLOR: 0x7f93b8, SUN_INTENSITY: 0.12, LIGHT_ELEVATION_DEG: 25,
  SKY_HORIZON_COLOR: 0x1b2433, SKY_ZENITH_COLOR: 0x070a11, HAZE_COLOR: 0x1d2531, GLOW_COLOR: 0x7f93b8, GLOW_OPACITY: 0,
  LOOK_SEA_DEEP: 0x0a111b, LOOK_SEA_MID: 0x101b29, LOOK_SEA_SHALLOW: 0x1b2e40, LOOK_SEA_BRIGHTNESS: 0.55,
});

// The grey, cold first light of 1950: a low sun behind cloud, a pale haze. The game then blends it into its own day look.
export const GREY_DAWN = Object.freeze({
  HEMI_SKY_COLOR: 0xb4c0cf, HEMI_GROUND_COLOR: 0x6b6f86, HEMI_INTENSITY: 1.6,
  SUN_COLOR: 0xf4cdb0, SUN_INTENSITY: 1.0, LIGHT_ELEVATION_DEG: 9,
  SKY_HORIZON_COLOR: 0xe6cbbc, SKY_ZENITH_COLOR: 0x8fa3bd, HAZE_COLOR: 0xc3c8d2, GLOW_COLOR: 0xffd2ad, GLOW_OPACITY: 0.5,
  LOOK_SEA_DEEP: 0x4a6a88, LOOK_SEA_MID: 0x6f93ad, LOOK_SEA_SHALLOW: 0x9cc3c5, LOOK_SEA_BRIGHTNESS: 0.92,
});

const channel = (c, shift) => (c >> shift) & 255;
const lerpColour = (a, b, k) => {
  const m = (s) => Math.round(channel(a, s) + (channel(b, s) - channel(a, s)) * k);
  return (m(16) << 16) | (m(8) << 8) | m(0);
};
// Colours are the numbers config.js writes as 0xRRGGBB (the key says so: *_COLOR, LOOK_SEA_DEEP/MID/SHALLOW); the rest blend as plain numbers.
const isColourKey = (key) => /COLOR$|^LOOK_SEA_(DEEP|MID|SHALLOW)$/.test(key);

// What CONFIG says right now for the keys a look sets: the day look to blend back to. Call it BEFORE applying a look.
export function snapshotLook(config = CONFIG) {
  const out = {};
  for (const k of LOOK_KEYS) out[k] = config[k];
  return out;
}

// From a to b at k (0..1, clamped). Both must carry every key.
export function blendLook(a, b, k) {
  const t = Math.min(1, Math.max(0, k));
  const out = {};
  for (const key of LOOK_KEYS) out[key] = isColourKey(key) ? lerpColour(a[key], b[key], t) : a[key] + (b[key] - a[key]) * t;
  return out;
}

// Puts a look into CONFIG (water, sky, glow and haze read CONFIG every frame; the game's lights are pushed by its applyLook()).
export function applyLook(look, config = CONFIG) {
  for (const key of LOOK_KEYS) if (look[key] !== undefined) config[key] = look[key];
  return config;
}
