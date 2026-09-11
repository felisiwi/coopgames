// Wind state (games/windward/DESIGN.md). Host is authoritative for every
// change after the first; the guest only ever applies incoming 'wind'
// messages, never runs its own change timer.
import { CONFIG } from './config.js';

// Deterministic mulberry32 PRNG — the *initial* wind is derived from `seed`
// identically on host and guest, so the guest's boat behaves sanely before
// any 'wind' message arrives. Nothing after the first wind is seeded this
// way (see nextWind() below).
function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function initialWind(seed) {
  const rand = mulberry32(seed);
  return {
    dir: rand() * Math.PI * 2,
    strength: 0.5 + rand() * 0.5,
  };
}

// Host-only. Not seed-derived — the guest never generates one of these
// itself, so there's nothing to keep in sync between two independent RNGs.
export function nextWind() {
  return {
    dir: Math.random() * Math.PI * 2,
    strength: 0.4 + Math.random() * 0.6,
  };
}

export function nextChangeDelaySeconds() {
  return CONFIG.WIND_CHANGE_MIN_S + Math.random() * (CONFIG.WIND_CHANGE_MAX_S - CONFIG.WIND_CHANGE_MIN_S);
}
