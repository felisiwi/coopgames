// Trees only near the boat (real-coast pass 2). Pure and deterministic.
//
// The world is cut into square cells, CELL game-metres on a side. With CELL = 10 a cell is
// exactly 100 m^2, so a density of "trees per 100 m^2" means "expected trees per cell".
// What grows in a cell depends ONLY on the cell's integer coordinates and the seed (through a
// hash), never on where the query is centred: the same spot always gets the same trees, so
// both players (and every frame) agree without sending anything over the network.
//
// Not wired into the game yet: it only needs a way to ask "which vegetation class is at
// (x, z)?". classSamplerFromCoast() builds that from src/coast-data.js.

export const CELL = 10;
export const DEFAULT_RADIUS = 250;
// Trees per 100 m^2 of GAME ground. Mirrors assets/coast/trees.json (written by tools/build-coast.mjs).
export const DENSITY = { bare_rock: 0, heath: 0.05, meadow: 0.02, scrub: 0.5, forest: 1.0, village: 0.1 };
// What grows where: [kind, weight] lists per class.
const KINDS = {
  forest: [['pine', 8], ['spruce', 2]],
  scrub: [['bush', 7], ['juniper', 3]],
  heath: [['juniper', 1]],
  meadow: [['birch', 1]],
  village: [['birch', 2], ['bush', 3]],
};

// 32-bit integer hash of (ix, iz, salt) -> [0, 1). Same inputs always give the same number.
export function hash01(ix, iz, salt) {
  let h = Math.imul(ix | 0, 0x1b873593) ^ Math.imul(iz | 0, 0x85ebca6b) ^ Math.imul(salt | 0, 0xc2b2ae35);
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function pickKind(cls, r) {
  const list = KINDS[cls];
  if (!list) return 'bush';
  const total = list.reduce((n, [, w]) => n + w, 0);
  let t = r * total;
  for (const [kind, w] of list) { if ((t -= w) < 0) return kind; }
  return list[0][0];
}

// classAt(x, z) -> class name ('forest', ...) or null/'water' for no land.
// Returns treesNear(x, z, radius = 250) -> [{ x, z, kind, size, cls }], ordered by cell then index.
export function makeTreesNear({ classAt, density = DENSITY, seed = 1, cell = CELL }) {
  const cellArea100 = (cell * cell) / 100;
  return function treesNear(x, z, radius = DEFAULT_RADIUS) {
    const out = [];
    const r2 = radius * radius;
    const ix0 = Math.floor((x - radius) / cell), ix1 = Math.floor((x + radius) / cell);
    const iz0 = Math.floor((z - radius) / cell), iz1 = Math.floor((z + radius) / cell);
    for (let iz = iz0; iz <= iz1; iz++) {
      for (let ix = ix0; ix <= ix1; ix++) {
        const cx = (ix + 0.5) * cell, cz = (iz + 0.5) * cell;
        const reach = radius + cell * 0.75;                          // cheap reject before the class lookup
        if ((cx - x) ** 2 + (cz - z) ** 2 > reach * reach) continue;
        const cls = classAt(cx, cz);
        const d = cls ? density[cls] : 0;
        if (!d) continue;
        // stochastic rounding: expected count = density, same answer every time for this cell
        const n = Math.floor(d * cellArea100 + hash01(ix, iz, seed));
        for (let k = 0; k < n; k++) {
          const tx = (ix + hash01(ix, iz, seed * 31 + 2 * k + 1)) * cell;
          const tz = (iz + hash01(iz, ix, seed * 31 + 2 * k + 2)) * cell;
          if ((tx - x) ** 2 + (tz - z) ** 2 > r2) continue;
          out.push({
            x: tx, z: tz, cls,
            kind: pickKind(cls, hash01(ix + 7919, iz - 104729, seed * 31 + k)),
            size: 0.8 + 0.5 * hash01(ix - 15485863, iz + 32452843, seed * 31 + k),
          });
        }
      }
    }
    return out;
  };
}

// Bridge to the coast data: game metres (x east, z south, origin = north-west corner of the plane)
// at world scale 1:`scale` -> vegetation class name at that spot.
export function classSamplerFromCoast(coast, scale) {
  const names = coast.meta.classes.map((c) => c.name);
  const pxPerGameM = scale / coast.mpp;                              // raster px per game metre
  return (gx, gz) => {
    const v = coast.classAt(Math.floor(gx * pxPerGameM), Math.floor(gz * pxPerGameM));
    return v ? names[v] : null;
  };
}
