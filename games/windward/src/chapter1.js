// The end of chapter 1 (stage 1d, batch B): what grandma gives you and what you have seen. Kept on this device (`windward.chapter1.v1`).
//   chest       granddad's sea chest is on Svalan's deck (and his chart is open: the favourites and the strange mark are on the chart)
//   towerSeen   you saw the old Måseskär tower flash: chapter 1 is complete
export const CHAPTER_KEY = 'windward.chapter1.v1';

export function chapterStorage() {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    s.getItem(CHAPTER_KEY);
    return s;
  } catch { return null; }
}

export function createChapter1(storage = chapterStorage()) {
  let chest = false;
  let towerSeen = false;
  try {
    const d = JSON.parse((storage && storage.getItem(CHAPTER_KEY)) || 'null');
    if (d) { chest = d.chest === true; towerSeen = chest && d.towerSeen === true; } // the tower only counts once the chart showed it
  } catch { /* unreadable: nothing yet */ }
  const save = () => { try { storage?.setItem(CHAPTER_KEY, JSON.stringify({ v: 1, chest, towerSeen })); } catch { /* blocked: carry on */ } };
  return {
    get chest() { return chest; },
    get chartOpen() { return chest; }, // granddad's chart comes with the chest
    get towerSeen() { return towerSeen; },
    get complete() { return towerSeen; },
    giveChest() { if (!chest) { chest = true; save(); } },
    markTowerSeen() { if (chest && !towerSeen) { towerSeen = true; save(); } },
    reset() { chest = false; towerSeen = false; save(); },
  };
}
