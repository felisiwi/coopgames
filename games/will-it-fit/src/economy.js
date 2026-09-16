// The reserve: the one quantity of material in the game.
//
// There is no separate "tank" and "score". The meter IS the tank. Every
// stage is poured out of it, whatever you spill is gone, and the next stage
// is played with the remainder — so a sloppy run starves itself, and a
// careful one keeps its headroom. Only the milestone refills put material
// back.
//
// Material you CATCH is not consumed; it goes back in the tank between
// stages. Spilling is the only way to lose ground, which keeps the meter a
// measure of skill rather than a countdown you cannot affect.
//
// Kept pure and separate from game.js so it can be tested headlessly — the
// render loop cannot be.
import { SOURCE } from './config.js';
import { generateVessel } from './vessel.js';

export const RESERVE_MAX = 4000;
export const SPILL_COST = 1;                          // per grain lost
export const MILESTONES = [10, 20, 40, 80, 160, 320]; // doubling, forever

// How much material this stage gets: a full measure if the reserve can
// spare one, otherwise everything that is left.
export function stageVolume(seed, stage, reserve) {
  const wanted = Math.round(generateVessel(seed, stage).capacity * SOURCE.FILL_RATIO);
  return Math.max(1, Math.min(reserve, wanted));
}

export function isMilestone(stage) {
  return MILESTONES.includes(stage);
}

// Apply spilled grains to the reserve. Never below zero.
export function drain(reserve, grains) {
  return Math.max(0, reserve - grains * SPILL_COST);
}

// Between stages: refill on a milestone, otherwise carry the remainder.
export function afterStage(reserve, stage) {
  return isMilestone(stage) ? RESERVE_MAX : Math.min(RESERVE_MAX, reserve);
}

// The run is over when there is nothing left to pour, or when a whole
// stage was poured away without a single grain landing — there is no
// recovering from not playing.
export function runOver(reserve, caughtThisStage) {
  return reserve <= 0 || caughtThisStage === 0;
}
