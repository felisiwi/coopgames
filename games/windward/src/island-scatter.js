// Scatters a field of islands across the world (src/config.js's
// ISLAND_SCATTER_* block). Every island is the Skerry shape (CONFIG's
// ISLAND_* block, tuned in island-lab.html) scaled to its own radius, plus a
// per-island seed offset for coastline/terrain/tree variation — not a copy
// of the same island at different sizes. Deterministic from the session
// `seed` alone: host and guest each compute the identical field with zero
// placement data on the wire (AGENTS.md's "world must be identical on both
// peers").
//
// Scaling a shape from radius 75m down to ~15m or up to ~150m can't just
// multiply every ISLAND_* number by the same factor — a coastline wobble of
// 40m is most of a 15m island's whole radius, and copied verbatim it would
// carve the island apart or vanish it in places (the exact "ugly/broken
// island" failure AGENTS.md's audit flagged for the single-island
// generator). Each field scales by physical category instead:
//  - visible landform distances (coastline wobble, beach falloff, peak
//    height, terrain bump size, mesh facet size, sand/grass/tree height
//    bands) scale LINEARLY with radius, so a tiny island reads as a small
//    low rock and a big one as a proper hill — not a shrunk/stretched copy
//    of the same terrain.
//  - noise frequencies scale INVERSELY with radius, so every island gets
//    roughly the same number of coastline wiggles / terrain bumps
//    regardless of size, instead of a huge island looking suspiciously
//    smooth or a tiny one looking like chaotic static.
//  - tree planting attempts scale with radius^2 (area), clamped, so tree
//    DENSITY stays roughly constant instead of raw count.
//  - everything else is physically independent of the island's size and is
//    carried over unscaled from the Skerry preset: the mesh margin (a fixed
//    water-overlap requirement, not a visual size), the underwater
//    shelf/abyss (the sea's own bathymetry, not the island's), slope-angle
//    thresholds, per-tree render scale, and the palette.
import { CONFIG } from './config.js';

const LINEAR_KEYS = [
  'ISLAND_COAST_NOISE_AMPLITUDE',
  'ISLAND_FALLOFF_WIDTH',
  'ISLAND_PEAK_HEIGHT',
  'ISLAND_HEIGHT_NOISE_AMPLITUDE',
  'ISLAND_GRID_CELL_SIZE',
  'ISLAND_SAND_MAX_HEIGHT',
  'ISLAND_GRASS_MAX_HEIGHT',
  'ISLAND_TREE_MIN_HEIGHT',
  'ISLAND_TREE_MAX_HEIGHT',
];

const INVERSE_KEYS = ['ISLAND_COAST_NOISE_FREQ', 'ISLAND_HEIGHT_NOISE_FREQ'];

// Scales with radius^2 (area) below, clamped between MIN/MAX_TREE_ATTEMPTS —
// listed separately from LINEAR_KEYS since it isn't a plain multiply.
const AREA_SCALED_KEYS = ['ISLAND_TREE_ATTEMPTS'];

// Kept exactly as the Skerry preset regardless of this island's radius (see
// header). Not consulted by buildIslandParams below (it starts from a full
// `{ ...CONFIG }` copy already carrying these) — listed for documentation
// and so island-scatter.test.js can assert the scaling categories cover
// every ISLAND_* key with no gaps.
const UNSCALED_KEYS = [
  'ISLAND_MESH_MARGIN',
  'ISLAND_PEAK_SHAPE',
  'ISLAND_ROCK_MIN_SLOPE_DEG',
  'ISLAND_TREE_MAX_SLOPE_DEG',
  'ISLAND_TREE_SCALE_MIN',
  'ISLAND_TREE_SCALE_MAX',
  'ISLAND_SHELF_WIDTH',
  'ISLAND_SHELF_DEPTH',
  'ISLAND_ABYSS_DEPTH',
  'ISLAND_ABYSS_TRANSITION_WIDTH',
  'ISLAND_COLOR_SAND',
  'ISLAND_COLOR_GRASS',
  'ISLAND_COLOR_GRANITE',
  'ISLAND_COLOR_GRANITE_PEAK',
  'ISLAND_COLOR_PINE',
  'ISLAND_COLOR_TRUNK',
];

const MIN_TREE_ATTEMPTS = 40; // floor so the smallest islands still get a few trees
const MAX_TREE_ATTEMPTS = 1200; // caps InstancedMesh size for the biggest islands
const MAX_PLACEMENT_ATTEMPTS = 200; // per island, before giving up on that one

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The true outer extent of an island's rendered mesh — same formula as
// island.js's createTerrainMesh `half` — used both for placement spacing
// and the exclusion zone around spawn.
export function footprintRadius(params) {
  return (
    params.ISLAND_RADIUS + params.ISLAND_COAST_NOISE_AMPLITUDE + params.ISLAND_FALLOFF_WIDTH / 2 + params.ISLAND_MESH_MARGIN
  );
}

// One island's full ISLAND_* param set (island.js's `params` argument),
// scaled from CONFIG's Skerry shape to `radius`, at world position (x, z).
export function buildIslandParams(radius, x, z) {
  const scale = radius / CONFIG.ISLAND_RADIUS;
  const params = {};
  for (const key of Object.keys(CONFIG)) {
    if (key.startsWith('ISLAND_')) params[key] = CONFIG[key];
  }
  params.ISLAND_RADIUS = radius;
  params.ISLAND_CENTER_X = x;
  params.ISLAND_CENTER_Z = z;

  for (const key of LINEAR_KEYS) params[key] = CONFIG[key] * scale;
  for (const key of INVERSE_KEYS) params[key] = CONFIG[key] / scale;
  for (const key of AREA_SCALED_KEYS) {
    const scaled = Math.round(CONFIG[key] * scale * scale);
    params[key] = Math.min(MAX_TREE_ATTEMPTS, Math.max(MIN_TREE_ATTEMPTS, scaled));
  }

  return params;
}

// Returns [{ seed, params }, ...] — one entry per successfully placed
// island, ready to pass straight to island.js's createIsland(seed, params).
// Deterministic in `seed` alone; CONFIG.ISLAND_SCATTER_* controls count,
// size range, and spacing.
export function scatterIslands(seed) {
  const rand = mulberry32((seed ^ 0x9e3a7cc1) >>> 0);
  const half = CONFIG.ISLAND_SCATTER_AREA / 2;
  const islands = [];

  for (let i = 0; i < CONFIG.ISLAND_SCATTER_COUNT; i++) {
    const radius = CONFIG.ISLAND_SCATTER_MIN_RADIUS + rand() * (CONFIG.ISLAND_SCATTER_MAX_RADIUS - CONFIG.ISLAND_SCATTER_MIN_RADIUS);
    const islandSeed = (seed ^ (0x2f1b4c53 + i * 0x9e3779b9)) >>> 0;
    const params = buildIslandParams(radius, 0, 0);
    const footprint = footprintRadius(params);

    let placed = false;
    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
      const x = (rand() * 2 - 1) * half;
      const z = (rand() * 2 - 1) * half;

      const distFromSpawn = Math.sqrt(x * x + z * z);
      if (distFromSpawn - footprint < CONFIG.ISLAND_SCATTER_SPAWN_CLEARANCE) continue;

      const overlapsExisting = islands.some((other) => {
        const dx = x - other.params.ISLAND_CENTER_X;
        const dz = z - other.params.ISLAND_CENTER_Z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        return dist < footprint + footprintRadius(other.params) + CONFIG.ISLAND_SCATTER_MIN_SPACING;
      });
      if (overlapsExisting) continue;

      params.ISLAND_CENTER_X = x;
      params.ISLAND_CENTER_Z = z;
      islands.push({ seed: islandSeed, params });
      placed = true;
      break;
    }

    // A crowded config (too many/large islands for ISLAND_SCATTER_AREA) can
    // run out of room for one island — skip it rather than looping forever
    // or letting it overlap. Both peers draw the same rand() sequence and
    // hit the same failure, so this stays deterministic either way.
    if (!placed && typeof console !== 'undefined') {
      console.warn(`island-scatter: could not place island ${i} after ${MAX_PLACEMENT_ATTEMPTS} attempts — skipping`);
    }
  }

  return islands;
}
