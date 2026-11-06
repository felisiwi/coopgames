// The first story beats of chapter 1 in 1950 (stage 1e, batch 2c): where you are in them, kept on this device (era-scoped: `windward.beats1950.v1`).
//   find     the boy finds you on the beach (the cards play after the dawn); then he sends you to Grundsund
//   errand   sail to Grundsund and fetch the fittings (the chandler's card)
//   return   take the fittings back to the yard (the boy: "it'll be a while ... someone in Fiskebäckskil was asking for help")
//   help     sail to Britta's jetty in Fiskebäckskil (batch 3: her cards, the gas tanks from her shed)
//   free     the chapter's job: the four lights, the keeper, back to Britta
// Pure: no THREE, no DOM. A missing or blocked storage just means no memory (the beats start again).
export const BEATS_KEY = 'windward.beats1950.v1';
export const PHASES = ['find', 'errand', 'return', 'help', 'free'];
export const ARRIVE_M = 30;        // close enough to tie up (game metres)
export const ARRIVE_MAX_SPEED = 3; // m/s: slow enough (the same gentle tie-up as everywhere)
export const HINT_COOLDOWN_S = 25;

// grundsund: { x, z } where the quay is; yard: { x, z } the open water off the boatbuilder's beach.
export function createBeats({ storage = null, grundsund, yard, britta = null }) {
  let phase = 'find';
  try {
    const d = JSON.parse((storage && storage.getItem(BEATS_KEY)) || 'null');
    if (d && PHASES.includes(d.phase)) phase = d.phase;
  } catch { /* unreadable: from the start */ }
  const save = () => { try { storage?.setItem(BEATS_KEY, JSON.stringify({ v: 1, phase })); } catch { /* blocked: carry on */ } };
  let lastHintAt = -Infinity;
  const stop = (wanted, where, x, z, speed, nowS) => {
    if (phase !== wanted || !where || Math.hypot(where.x - x, where.z - z) > ARRIVE_M) return null;
    if (speed <= ARRIVE_MAX_SPEED) return 'arrive';
    if (nowS - lastHintAt >= HINT_COOLDOWN_S) { lastHintAt = nowS; return 'hint'; }
    return null;
  };
  return {
    get phase() { return phase; },
    get done() { return phase === 'free'; },
    // To the next phase (once; 'free' stays). Returns the new phase.
    advance() { const i = PHASES.indexOf(phase); if (i < PHASES.length - 1) { phase = PHASES[i + 1]; save(); } return phase; },
    reset() { phase = 'find'; save(); },
    // Moored (close and slow) at Grundsund in the errand: 'arrive'; near but too fast: 'hint' (at most every HINT_COOLDOWN_S); else null.
    errandArrival(x, z, speed, nowS) { return stop('errand', grundsund, x, z, speed, nowS); },
    // Back at the yard with the fittings.
    returnArrival(x, z, speed, nowS) { return stop('return', yard, x, z, speed, nowS); },
    // At Britta's jetty, once the boy has sent you.
    helpArrival(x, z, speed, nowS) { return stop('help', britta, x, z, speed, nowS); },
    // Where the Navigate tag points in this phase (null in 'find' and 'free').
    goal() { return phase === 'errand' ? grundsund : phase === 'return' ? yard : phase === 'help' ? britta : null; },
  };
}
