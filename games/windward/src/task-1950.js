// The 1950 job (stage 1e, batch 3): the storm has put out the automatic gas (AGA) lights. In order:
//   gas      sail to the depot on the Lysekil quay and take the tubes (and a sack of post) aboard
//   lights   relight the four automatic lights (Hättan, Gäven, Stångholmen, Fredagsholmen), each with a tube
//   keeper   take the post to the keeper on Måseskär (it is lit and manned: it needs no relight)
//   report   tell Britta in Fiskebäckskil: Svalan is relaunched, repaired and freshly painted
//   done
// It wraps src/lighthouse-task.js (the same mooring, relight and harbour rules, the same saved progress) and adds the two steps around the lights.
// Pure: no THREE, no DOM. The extra progress lives in the era-scoped storage under `windward.task1950.v1` (a missing or blocked storage just means no memory).
import { createLighthouseTask, MOOR_M, MOOR_MAX_SPEED, HINT_RANGE_M, HINT_COOLDOWN_S } from './lighthouse-task.js';

export const TASK1950_KEY = 'windward.task1950.v1';

// lights: the era's light name-list entries ({ id, name, x, z }); lightNames: the four to relight; keeperName: the manned light; depot: { x, z } (the quay).
export function createTask1950({ lights, lightNames, keeperName, depot, storage = null, spawn = { x: 0, z: 0 } }) {
  const four = lightNames.map((n) => lights.find((l) => l.name === n)).filter(Boolean);
  const keeperLight = lights.find((l) => l.name === keeperName) || null;
  const base = createLighthouseTask({ lights: four, spawn, storage, count: four.length });
  let gas = false, keeper = false;
  try {
    const d = JSON.parse((storage && storage.getItem(TASK1950_KEY)) || 'null');
    if (d) { gas = d.gas === true; keeper = d.keeper === true; }
    if (base.restoredCount > 0) gas = true; // a light cannot have been relit without gas (a save from before this existed, or a debug jump)
    if (!base.all) keeper = false;           // the post goes out after the lights
  } catch { /* unreadable: nothing yet */ }
  const save = () => { try { storage?.setItem(TASK1950_KEY, JSON.stringify({ v: 1, gas, keeper })); } catch { /* blocked: carry on */ } };
  let lastGasHintAt = -Infinity, lastStopHintAt = -Infinity;
  const phase = () => (base.done ? 'done' : !gas ? 'gas' : !base.all ? 'lights' : !keeper ? 'keeper' : 'report');
  const near = (p, x, z) => !!p && Math.hypot(p.x - x, p.z - z) <= MOOR_M;
  const api = {
    // delegated to the base task (explicitly: a spread would freeze its getters at their first values)
    ids: base.ids, lights: base.lights, total: base.total,
    get restoredCount() { return base.restoredCount; },
    get all() { return base.all; },
    get done() { return base.done; },
    isTaskLight: (id) => base.isTaskLight(id),
    isDark: (id) => base.isDark(id),
    restore: (id) => base.restore(id),
    depot, keeperLight,
    get phase() { return phase(); },
    get hasGas() { return gas; },
    get keeperMet() { return keeper; },
    // the tubes still in the boat: one for each light not yet relit (four after the depot)
    get tubes() { return gas ? base.total - base.restoredCount : 0; },
    // The dark light the boat has moored at: only with gas aboard.
    arrival(x, z, speed) { return gas ? base.arrival(x, z, speed) : null; },
    // Too fast near a dark light (with gas): the old "ease off" hint. Without gas: gasHint() instead.
    hint(x, z, speed, nowS) { return gas ? base.hint(x, z, speed, nowS) : null; },
    // Near a dark light with no gas: "fetch the tubes first" (at most every HINT_COOLDOWN_S). true or false.
    gasHint(x, z, nowS) {
      if (gas || nowS - lastGasHintAt < HINT_COOLDOWN_S) return false;
      if (four.some((l) => base.isDark(l.id) && Math.hypot(l.x - x, l.z - z) <= HINT_RANGE_M)) { lastGasHintAt = nowS; return true; }
      return false;
    },
    // The depot quay: moored (close and slow) in phase 'gas': 'load' = take the gas now; 'hint' = near but too fast (at most every HINT_COOLDOWN_S); null otherwise.
    depotArrival(x, z, speed, nowS) { return stop('gas', depot, x, z, speed, nowS); },
    // Måseskär: moored in phase 'keeper': 'deliver' = the keeper takes the post.
    keeperArrival(x, z, speed, nowS) { const r = stop('keeper', keeperLight, x, z, speed, nowS); return r === 'load' ? 'deliver' : r; },
    loadGas() { if (!gas) { gas = true; save(); } },
    meetKeeper() { if (gas && base.all && !keeper) { keeper = true; save(); } },
    // Britta's harbour: only after the keeper.
    harbourEntry(inHarbour, speed, nowS) { return phase() === 'report' ? base.harbourEntry(inHarbour, speed, nowS) : null; },
    finish() { if (phase() === 'report') base.finish(); },
    reset() { base.reset(); gas = false; keeper = false; save(); },
    progressText() { const p = phase(); return p === 'gas' ? 'fetch the gas' : p === 'lights' ? `lights ${base.restoredCount}/${base.total}` : p === 'keeper' ? 'post for Måseskär' : p === 'report' ? 'tell Britta' : ''; },
  };
  function stop(wanted, where, x, z, speed, nowS) {
    if (phase() !== wanted || !near(where, x, z)) return null;
    if (speed <= MOOR_MAX_SPEED) return 'load';
    if (nowS - lastStopHintAt >= HINT_COOLDOWN_S) { lastStopHintAt = nowS; return 'hint'; }
    return null;
  }
  return api;
}
