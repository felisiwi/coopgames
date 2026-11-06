// The opening's flags and timeline helpers (stage 1e, batch 2b). The opening itself is drawn by src/opening-stage.js in the game engine (the SVG cut-out scene of batch 2 is
// gone). Shown once: the flags live on the device, per era (src/era-storage.js); a missing or blocked storage just means it plays again. Pure: no THREE, no DOM.
import { OPENING_PLAN, OPENING_TOTAL_S } from './story-1950.js';

export const OPENING_KEY = 'windward.opening.v1'; // the opening has played (or was skipped)
export const INTRO_KEY = 'windward.intro.v1';     // the whole first-minutes sequence (opening, dawn, the first story beats) has been through once

const flag = (storage, key) => { try { return !!storage && storage.getItem(key) === '1'; } catch { return false; } };
const setFlag = (storage, key) => { try { storage?.setItem(key, '1'); } catch { /* blocked: carry on */ } };
export const hasSeenOpening = (storage) => flag(storage, OPENING_KEY);
export const markOpeningSeen = (storage) => setFlag(storage, OPENING_KEY);
export const hasSeenIntro = (storage) => flag(storage, INTRO_KEY);
export const markIntroSeen = (storage) => setFlag(storage, INTRO_KEY);
export const resetIntro = (storage) => { try { storage?.removeItem(OPENING_KEY); storage?.removeItem(INTRO_KEY); } catch { /* blocked */ } };

// The phase at t seconds: { id, at, dur, u (0..1 through it) }, or null outside the opening.
export function phaseAt(t, plan = OPENING_PLAN) {
  if (t < 0 || t >= plan.reduce((m, p) => Math.max(m, p.at + p.dur), 0)) return null;
  for (const p of plan) if (t >= p.at && t < p.at + p.dur) return { ...p, u: (t - p.at) / p.dur };
  return null;
}

// The opening plays in the 1950 game only, the first time (or ?opening=1); ?opening=0 never.
export function shouldShowOpening({ era, seen, param }) {
  if (era !== '1950') return false;
  if (param === '0') return false;
  if (param === '1') return true;
  return !seen;
}

// How bright a lightning flash is at t (0 = none): a sharp rise, a fast fall, with a flicker. flashes: [{ at }].
export function flashLevel(t, flashes) {
  let best = 0;
  for (const f of flashes) {
    const d = t - f.at;
    if (d < 0 || d > 0.55) continue;
    const base = d < 0.06 ? d / 0.06 : Math.exp(-(d - 0.06) * 7);
    const flicker = 0.85 + 0.15 * Math.sin(d * 70);
    best = Math.max(best, base * flicker);
  }
  return Math.min(1, best);
}

export { OPENING_TOTAL_S };
