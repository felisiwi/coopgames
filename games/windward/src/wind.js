// Wind state (games/windward/DESIGN.md). Host is authoritative for every
// change after the first; the guest only ever applies incoming 'wind'
// messages, never runs its own timer or state machine.
import { CONFIG } from './config.js';

// Deterministic mulberry32 PRNG — the *initial* wind is derived from `seed`
// identically on host and guest, so the guest's boat behaves sanely before
// any 'wind' message arrives. Nothing after the first wind is seeded this
// way (see nextWindTarget() below).
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

// Host-only, one per transition. Not seed-derived — the guest never
// generates one of these itself, so there's nothing to keep in sync between
// two independent RNGs (games/windward/DESIGN.md's "Wind" section).
export function nextWindTarget() {
  return {
    dir: Math.random() * Math.PI * 2,
    strength: 0.4 + Math.random() * 0.6,
  };
}

export function nextHoldDelaySeconds() {
  return CONFIG.WIND_HOLD_MIN_S + Math.random() * (CONFIG.WIND_HOLD_MAX_S - CONFIG.WIND_HOLD_MIN_S);
}

export function nextTransitionSeconds() {
  return CONFIG.WIND_TRANSITION_MIN_S + Math.random() * (CONFIG.WIND_TRANSITION_MAX_S - CONFIG.WIND_TRANSITION_MIN_S);
}

function smoothstep01(t) {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

// Shortest signed angular delta from `from` to `to`, in (-PI, PI] — so an
// interpolation always takes the short way round instead of the long way
// when dir wraps past 0/2PI.
function shortestAngleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Pure: eases from `from` wind to `to` wind as t goes 0->1, smoothstep so
// there's no snap at either end. Direction takes the shortest angular path.
export function interpolateWind(from, to, t) {
  const eased = smoothstep01(t);
  return {
    dir: from.dir + shortestAngleDelta(from.dir, to.dir) * eased,
    strength: from.strength + (to.strength - from.strength) * eased,
  };
}

// Host-only wind state machine (games/windward/DESIGN.md's "Wind" section):
// holds a steady wind for WIND_HOLD_*_S, then eases to a new random target
// over WIND_TRANSITION_*_S — never an instant snap. `current` is what
// game.js reads every frame and broadcasts. Pure except for the
// Math.random()-backed helpers above (same pattern as the old nextWind()),
// so a node test can still assert the rate bound by driving `nowS` and
// reading `current` back at each step.
export function createWindController(seed, nowS) {
  const initial = initialWind(seed);
  return {
    from: initial,
    to: initial,
    phase: 'hold', // 'hold' | 'transition'
    phaseStartS: nowS,
    phaseDurationS: nextHoldDelaySeconds(),
    current: initial,
  };
}

export function stepWindController(state, nowS) {
  const elapsed = nowS - state.phaseStartS;

  if (state.phase === 'hold') {
    if (elapsed < state.phaseDurationS) return { ...state, current: state.to };
    return {
      from: state.to,
      to: nextWindTarget(),
      phase: 'transition',
      phaseStartS: nowS,
      phaseDurationS: nextTransitionSeconds(),
      current: state.to,
    };
  }

  const t = elapsed / state.phaseDurationS;
  if (t >= 1) {
    return {
      from: state.to,
      to: state.to,
      phase: 'hold',
      phaseStartS: nowS,
      phaseDurationS: nextHoldDelaySeconds(),
      current: state.to,
    };
  }

  // Slight noise (DESIGN.md: "never a snap") — strength only, a slow bounded
  // wobble so a transition doesn't read as a robotic linear fade. Direction
  // stays exactly on the smoothstep path so the "never changes direction
  // faster than the transition allows" guarantee stays clean and testable.
  const eased = interpolateWind(state.from, state.to, t);
  const noise = Math.sin(nowS * CONFIG.WIND_NOISE_FREQ_HZ * Math.PI * 2) * CONFIG.WIND_NOISE_AMPLITUDE;
  const current = { dir: eased.dir, strength: Math.min(1, Math.max(0, eased.strength + noise)) };
  return { ...state, current };
}
