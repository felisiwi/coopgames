// Fog of the chart (stage 1c): which parts of the sea you have sailed. A grid of cells over the detail chart, kept in
// localStorage. Cells within `radius` of the boat are lifted as you sail. Pure apart from the injectable storage.
export const EXPLORED_KEY = 'windward.explored.v1';
export const CELL_M = 24; // game metres (240 m real, the Map Lab's cell)
export const REVEAL_M = 150; // lifted within this of the boat (1.5 km real, the Map Lab default)

export function exploredStorage() {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    s.getItem(EXPLORED_KEY);
    return s;
  } catch {
    return null;
  }
}

const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s); };
const unb64 = (str, n) => { const s = atob(str); const out = new Uint8Array(n); for (let i = 0; i < Math.min(s.length, n); i++) out[i] = s.charCodeAt(i); return out; };

// rect: { x0, z0, x1, z1 } in game metres (the detail chart's extent).
export function createExplored(rect, { cell = CELL_M, radius = REVEAL_M, storage = exploredStorage(), key = EXPLORED_KEY } = {}) {
  const cols = Math.ceil((rect.x1 - rect.x0) / cell);
  const rows = Math.ceil((rect.z1 - rect.z0) / cell);
  let cells = new Uint8Array(cols * rows);
  try {
    const raw = storage && storage.getItem(key);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.v === 1 && d.cols === cols && d.rows === rows && typeof d.data === 'string') cells = unb64(d.data, cols * rows);
    }
  } catch { /* unreadable or a different grid: start with full fog */ }
  let count = 0;
  for (const c of cells) if (c) count++;
  let dirty = 0;
  let version = 0; // bumps whenever a cell is lifted: the chart rebuilds its fog picture only then
  let lastX = NaN;
  let lastZ = NaN;
  const r = Math.ceil(radius / cell);

  const api = {
    cols, rows, cell, rect,
    get cells() { return cells; },
    get version() { return version; },
    count: () => count,
    total: cols * rows,
    indexOf(x, z) {
      const i = Math.floor((x - rect.x0) / cell);
      const j = Math.floor((z - rect.z0) / cell);
      return i < 0 || j < 0 || i >= cols || j >= rows ? -1 : j * cols + i;
    },
    isExplored(x, z) { const k = api.indexOf(x, z); return k >= 0 && cells[k] === 1; },
    // Lift the fog round (x, z). Cheap to call every frame: it does nothing until the boat has moved a third of a cell.
    // Returns the number of cells newly lifted.
    mark(x, z) {
      if (Math.hypot(x - lastX, z - lastZ) < cell / 3) return 0;
      lastX = x; lastZ = z;
      const ci = Math.floor((x - rect.x0) / cell);
      const cj = Math.floor((z - rect.z0) / cell);
      let added = 0;
      for (let j = -r; j <= r; j++) {
        for (let i = -r; i <= r; i++) {
          const a = ci + i;
          const b = cj + j;
          if (a < 0 || b < 0 || a >= cols || b >= rows) continue;
          if (Math.hypot(i, j) * cell > radius) continue;
          const k = b * cols + a;
          if (!cells[k]) { cells[k] = 1; added++; }
        }
      }
      if (added) { count += added; dirty += added; version++; }
      return added;
    },
    // Writes to the device when enough has changed (or force). Never throws.
    save(force = false) {
      if (!dirty || (!force && dirty < 40)) return false;
      dirty = 0;
      try { storage?.setItem(key, JSON.stringify({ v: 1, cols, rows, data: b64(cells) })); } catch { /* blocked: carry on */ }
      return true;
    },
    reset() { cells = new Uint8Array(cols * rows); count = 0; dirty = 1; version++; api.save(true); },
  };
  return api;
}
