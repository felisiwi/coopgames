// The first task (stage 1d): a storm has put the five lighthouses nearest the start out of action. Sail to each (close enough and slow: the boat
// moors, the camera circles, the light comes back on), then return to grandma in Fiskebäckskil to report. Pure state plus the rules, no THREE
// and no DOM; the progress lives on the device (localStorage, `windward.lights.v1`) and a missing or blocked storage just means no memory.
export const TASK_KEY = 'windward.lights.v1';
export const TASK_COUNT = 5;
export const MOOR_M = 45; // close enough: game metres from the lighthouse (the camera sees about 45 m, so the tower is in view). The nearest sailable water is 4 to 12 m from each rock. TODO(felix): confirm by feel
export const MOOR_MAX_SPEED = 3; // m/s: slow enough (the same "easing in" as arriving in a harbour, src/arrival.js)
export const HINT_RANGE_M = 130; // near a dark light but going too fast: a quiet hint
export const HINT_COOLDOWN_S = 25;
export const GRANDMA_ID = 'village:Fiskebäckskil';
export const HARBOUR_ENTRY_MAX_SPEED = 3; // m/s: tie up gently, like mooring at a lighthouse (and like a village arrival, src/arrival.js)
export const REWARD_DELAY_S = 4.5; // from entering the harbour to the end card: the reward moment plays in between (TODO(felix): the reward details)

// The start screen is shown once: this flag lives on the device (a missing or blocked storage just means it is shown again).
export const START_KEY = 'windward.start.v1';
export function hasSeenStart(storage = taskStorage()) {
  try { return !!(storage && JSON.parse(storage.getItem(START_KEY) || 'null')?.seen === true); } catch { return false; }
}
export function markStartSeen(storage = taskStorage()) {
  try { storage?.setItem(START_KEY, JSON.stringify({ v: 1, seen: true })); } catch { /* blocked: carry on */ }
}
export function resetStart(storage = taskStorage()) {
  try { storage?.removeItem?.(START_KEY); storage?.setItem(START_KEY, JSON.stringify({ v: 1, seen: false })); } catch { /* blocked */ }
}

export function taskStorage() {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    s.getItem(TASK_KEY);
    return s;
  } catch { return null; }
}

// lights: name-list entries { id, name, x, z } of the lighthouses; the n nearest to the spawn are dark. Pure, stable order (nearest first).
// Is a tower's lantern burning? A task light is lit exactly when restored, whatever the light data says (Islandsberg and Stångehuvud are dark in real life,
// yet they start dark AND stay lit once restored, also after a reload). Any other tower follows the light data (`lit: false` = dark for decades). Pure.
export function towerLit({ isTaskLight, restored, dataLit }) {
  return isTaskLight ? !!restored : dataLit !== false;
}

export function pickTaskLights(lights, spawn, n = TASK_COUNT) {
  return [...lights].sort((a, b) => Math.hypot(a.x - spawn.x, a.z - spawn.z) - Math.hypot(b.x - spawn.x, b.z - spawn.z) || (a.id < b.id ? -1 : 1)).slice(0, n);
}

export function createLighthouseTask({ lights, spawn, storage = taskStorage(), count = TASK_COUNT }) {
  const picked = pickTaskLights(lights, spawn, count);
  const ids = picked.map((l) => l.id);
  const byId = new Map(picked.map((l) => [l.id, l]));
  const restored = new Set();
  let done = false;
  try {
    const d = JSON.parse((storage && storage.getItem(TASK_KEY)) || 'null');
    if (d && Array.isArray(d.restored)) for (const id of d.restored) if (byId.has(id)) restored.add(id);
    if (d && d.done === true && restored.size === picked.length) done = true;
  } catch { /* unreadable: start fresh */ }
  const save = () => { try { storage?.setItem(TASK_KEY, JSON.stringify({ v: 1, restored: [...restored], done })); } catch { /* blocked: carry on */ } };
  let lastHintAt = -Infinity;
  let lastEntryHintAt = -Infinity;
  const api = {
    ids, lights: picked, total: picked.length,
    get restoredCount() { return restored.size; },
    get all() { return restored.size === picked.length; },
    get done() { return done; },
    // 'lights' (restore them) -> 'report' (return to grandma) -> 'done'
    get phase() { return done ? 'done' : restored.size === picked.length ? 'report' : 'lights'; },
    isTaskLight: (id) => byId.has(id),
    isDark: (id) => byId.has(id) && !restored.has(id),
    // The light came back on. Returns { count, all, already }.
    restore(id) {
      if (!byId.has(id)) return null;
      const already = restored.has(id);
      restored.add(id);
      save();
      return { count: restored.size, all: restored.size === picked.length, already };
    },
    finish() { if (restored.size === picked.length) { done = true; save(); } },
    reset() { restored.clear(); done = false; save(); },
    // The dark lighthouse the boat has moored at: close enough AND slow. null otherwise.
    arrival(x, z, speed) {
      for (const l of picked) if (!restored.has(l.id) && Math.hypot(l.x - x, l.z - z) <= MOOR_M && speed <= MOOR_MAX_SPEED) return l;
      return null;
    },
    // Near a dark light but too fast to moor: a quiet hint (at most every HINT_COOLDOWN_S). Returns the entry or null.
    hint(x, z, speed, nowS) {
      if (speed <= MOOR_MAX_SPEED || nowS - lastHintAt < HINT_COOLDOWN_S) return null;
      for (const l of picked) {
        const d = Math.hypot(l.x - x, l.z - z);
        if (!restored.has(l.id) && d <= HINT_RANGE_M) { lastHintAt = nowS; return l; } // also inside the moor distance: that is exactly when you arrive too fast
      }
      return null;
    },
    // Reporting to grandma (phase 'report'): is the boat IN the harbour (the water inside the mouth, src/harbour-water.js), and slow enough to tie up?
    // 'enter' = the reward moment starts; 'hint' = inside but too fast (at most every HINT_COOLDOWN_S); null otherwise.
    harbourEntry(inHarbour, speed, nowS) {
      if (api.phase !== 'report' || !inHarbour) return null;
      if (speed <= HARBOUR_ENTRY_MAX_SPEED) return 'enter';
      if (nowS - lastEntryHintAt >= HINT_COOLDOWN_S) { lastEntryHintAt = nowS; return 'hint'; }
      return null;
    },
    // The subtle HUD line: "lights 2/5" while there are lights to restore, "report to grandma" after the last one, nothing when done.
    progressText() { return api.phase === 'lights' ? `lights ${restored.size}/${picked.length}` : api.phase === 'report' ? 'report to grandma' : ''; },
  };
  return api;
}
