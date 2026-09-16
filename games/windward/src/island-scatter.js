// Scatters a field of islands across the world (src/config.js's
// ISLAND_SCATTER_* block): large/medium "landmark" islands reserved first,
// a base grid of skerries filling in behind them (see scatterIslands
// below). Every island is the Skerry shape (CONFIG's ISLAND_* block, tuned
// in island-lab.html) scaled to its own radius, plus a per-island seed
// offset for coastline/terrain/tree variation — not a copy of the same
// island at different sizes. Deterministic from the session `seed` alone:
// host and guest each compute the identical field with zero placement data
// on the wire (AGENTS.md's "world must be identical on both peers").
//
// I2, 2026-09-16 — third placement design, first two measured out as
// failures rather than under-tuned:
//   - v1, cluster reservation + independent rejection sampling: hard
//     density ceiling around 60-70 islands even at a generous 2400m world,
//     no matter how its knobs were turned.
//   - v2, single flat jittered grid (one pitch for every island size,
//     weighted small/medium/large draw per cell): measured directly —
//     pitch (75m) was sized off the TARGET mean spacing, not off actual
//     footprint sizes, so 93% of grid cells (237/256) exhausted every
//     retry and placed nothing (candidates kept landing inside a
//     neighbour's exclusion zone). Windowed-occupancy check confirmed it:
//     68-74% of 135m windows were completely empty, 0% ever had 2+
//     islands — "one island, empty sea," not an archipelago.
// v3 (this version) fixes the root cause both previous versions shared:
// pitch must be measured from what's actually being placed, not guessed
// from a target output number.
//   - cameraViewWidth() below measures VIEW — the fixed camera's real
//     visible width at max zoom-out — from FIXED_CAMERA_DISTANCE/FOV/
//     ZOOM_MAX. gridPitch() derives the base grid pitch from VIEW (see
//     config.js's Island scattering comment), clamped to a sane range.
//   - large/medium islands are reserved FIRST (their own random-cell picks
//     off the live grid), each clearing every grid cell within its own
//     (radius + CELL_EXCLUSION_GAP) of its centre — so nothing placed
//     after it can land on top of it. Then skerries fill every surviving
//     cell, one per cell, jittered — and SKERRY_MAX_RADIUS is kept under
//     half the pitch, so two adjacent skerries can never reach each other
//     and no overlap check is needed for the fill pass.
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

// Assumed camera aspect ratio for cameraViewWidth() below — three.js's
// PerspectiveCamera.aspect is actually set from the live canvas size at
// runtime (game.js), not a CONFIG constant, but 16:9 is the same assumption
// config.js's own FIXED_CAMERA_DISTANCE comment already bakes into its
// "~120m across the screen" figure. Good enough for sizing a placement
// grid; not claimed to be exact for every window size.
const ASSUMED_ASPECT = 16 / 9;

// How far past the boat, along the fixed camera's own view axis, the first
// (guaranteed) island's near coastline is placed — see scatterIslands's
// header for the full derivation. 30m sits comfortably inside the ~54m
// dead-ahead sight bound at zoom=1 config.js works out from src/camera.js's
// geometry, with margin for the +-BOAT_SPAWN_OFFSET gap between host/guest
// spawns and wave bob perturbing the boat's exact position slightly.
export const STARTER_NEAR_EDGE_DISTANCE_M = 30;

// The world-space direction, from spawn, that's actually inside the fixed
// camera's frame — i.e. "away from camera", the same direction the camera
// looks. camera.js's `_fixedDirection` points from boat TO camera
// (sin(az), cos(az)); what's visible in frame beyond the boat continues
// further in the opposite direction, so this is that vector negated.
export function starterBearing() {
  const az = (CONFIG.FIXED_CAMERA_AZIMUTH_DEG * Math.PI) / 180;
  return { x: -Math.sin(az), z: -Math.cos(az) };
}

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

// The fixed camera's real visible width (metres, at world/sea-level depth)
// at a given zoom — src/camera.js's own geometry: horizontal FOV from the
// vertical FOV/ASSUMED_ASPECT, width = 2 * distance * tan(hFOV/2), distance
// scaling linearly with zoom. Defaults to ZOOM_MAX (max zoom-out, the
// widest the fixed camera ever shows) since that's what bounds how many
// islands can be in frame at once.
export function cameraViewWidth(zoom = CONFIG.ZOOM_MAX) {
  const vFov = (CONFIG.FIXED_CAMERA_FOV_DEG * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * ASSUMED_ASPECT);
  const distance = CONFIG.FIXED_CAMERA_DISTANCE * zoom;
  return 2 * distance * Math.tan(hFov / 2);
}

// Base placement-grid pitch — CONFIG.ISLAND_SCATTER_PITCH_OVERRIDE
// (index.html's ?pitch=) wins outright if set; otherwise derived from
// cameraViewWidth() at max zoom-out (config.js's Island scattering
// comment), clamped to [PITCH_MIN, PITCH_MAX].
export function gridPitch() {
  if (CONFIG.ISLAND_SCATTER_PITCH_OVERRIDE) return CONFIG.ISLAND_SCATTER_PITCH_OVERRIDE;
  const base = cameraViewWidth(CONFIG.ZOOM_MAX) / CONFIG.ISLAND_SCATTER_PITCH_VIEW_DIVISOR;
  return Math.min(CONFIG.ISLAND_SCATTER_PITCH_MAX, Math.max(CONFIG.ISLAND_SCATTER_PITCH_MIN, base));
}

function cellKey(i, j) {
  return `${i},${j}`;
}

// Every grid cell's NOMINAL (unjittered) centre, covering ISLAND_SCATTER_AREA
// at the given pitch. Exclusion checks (excludeNear below) use these fixed
// centres — matches "removing every cell whose centre is..." literally, and
// means a cell that ends up excluded before it's ever chosen never costs a
// rand() call, keeping the field reproducible regardless of placement order.
function buildCellGrid(pitch, area) {
  const half = area / 2;
  const n = Math.max(1, Math.round(area / pitch));
  const cells = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      cells.push({ i, j, cx: -half + pitch * (i + 0.5), cz: -half + pitch * (j + 0.5) });
    }
  }
  return { cells, n, half };
}

// Returns [{ seed, params, isStarter, kind }, ...] — one entry per placed
// island, ready to pass straight to island.js's createIsland(seed, params).
// Deterministic in `seed` alone — no placement data crosses the wire
// (AGENTS.md's "world must be identical on both peers").
//
// Single base grid (config.js's Island scattering comment has the "why" —
// third design, the first two measured out as failures): gridPitch() above
// sizes one pitch for the whole world from the camera's actual visible
// width, not a guessed target spacing. Landmarks (large, then medium) are
// reserved FIRST by picking random cells off the live grid — each one
// removes every cell within (its own radius + CELL_EXCLUSION_GAP) of its
// centre so nothing later can land on it, and LARGE_MIN_SPACING is an
// extra floor between large centres specifically (the general cell-removal
// alone doesn't guarantee two large islands read as separate landmarks,
// since it's sized off whichever one placed first). Skerries then fill
// every cell that's still alive, one per cell with a small jitter — no
// overlap check needed, since SKERRY_MAX_RADIUS is kept under half the
// pitch (config.js), so two adjacent cells' skerries can never reach each
// other.
//
// The starter island (always islands[0], `isStarter: true`) is placed
// before any of this — Felix, 2026-09-16: "I want islands in view from the
// moment the game loads, not after sailing." Skerry-sized, exact position:
// its centre sits along starterBearing() (the one world direction inside
// the fixed camera's frame) at whatever distance puts its NEAR coastline
// exactly STARTER_NEAR_EDGE_DISTANCE_M past spawn. It clears its own
// exclusion zone from the grid just like a landmark would. The grid cell
// containing world origin (where both boats spawn) is removed outright
// before anything else is placed, regardless of the starter's own
// exclusion — simpler and more literal than the old SPAWN_CLEARANCE radius
// check it replaces.
export function scatterIslands(seed) {
  const rand = mulberry32((seed ^ 0x9e3a7cc1) >>> 0);
  const area = CONFIG.ISLAND_SCATTER_AREA;
  const pitch = gridPitch();
  const { cells: allCells, n, half } = buildCellGrid(pitch, area);

  const removed = new Set();
  // Force the spawn cell empty (replaces the old SPAWN_CLEARANCE check).
  const spawnI = Math.min(n - 1, Math.max(0, Math.floor(half / pitch)));
  removed.add(cellKey(spawnI, spawnI));

  const islands = [];
  let seedCounter = 0;
  const nextIslandSeed = () => {
    seedCounter++;
    return (seed ^ (0x2f1b4c53 + seedCounter * 0x9e3779b9)) >>> 0;
  };

  function place(radius, x, z, isStarter, kind) {
    const params = buildIslandParams(radius, x, z);
    islands.push({ seed: nextIslandSeed(), params, isStarter: !!isStarter, kind });
  }

  function excludeNear(x, z, radius) {
    const gap = radius + CONFIG.ISLAND_SCATTER_CELL_EXCLUSION_GAP;
    for (const cell of allCells) {
      const key = cellKey(cell.i, cell.j);
      if (removed.has(key)) continue;
      if (Math.hypot(cell.cx - x, cell.cz - z) <= gap) removed.add(key);
    }
  }

  // Seeded Fisher-Yates over whatever cells are still alive right now —
  // "picking cells at random" for the landmark/skerry passes below.
  function shuffledAvailable() {
    const avail = allCells.filter((c) => !removed.has(cellKey(c.i, c.j)));
    for (let i = avail.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [avail[i], avail[j]] = [avail[j], avail[i]];
    }
    return avail;
  }

  // Starter island — always islands[0]. See header.
  {
    const radius = CONFIG.ISLAND_SCATTER_SKERRY_MIN_RADIUS + rand() * (CONFIG.ISLAND_SCATTER_SKERRY_MAX_RADIUS - CONFIG.ISLAND_SCATTER_SKERRY_MIN_RADIUS);
    const bearing = starterBearing();
    const footprint = footprintRadius(buildIslandParams(radius, 0, 0));
    const dist = STARTER_NEAR_EDGE_DISTANCE_M + footprint;
    const x = bearing.x * dist;
    const z = bearing.z * dist;
    place(radius, x, z, true, 'starter');
    excludeNear(x, z, radius);
  }

  // Large landmarks. LARGE_MIN_SPACING is checked ONLY against other large
  // centres — a cell that's merely too close to a large stays available for
  // a later medium or skerry, it's just skipped for THIS pass.
  const largeCenters = [];
  {
    const candidates = shuffledAvailable();
    for (const cell of candidates) {
      if (largeCenters.length >= CONFIG.ISLAND_SCATTER_LARGE_COUNT) break;
      if (removed.has(cellKey(cell.i, cell.j))) continue; // excluded by an earlier large this same pass
      const tooCloseToAnotherLarge = largeCenters.some(
        (c) => Math.hypot(cell.cx - c.x, cell.cz - c.z) < CONFIG.ISLAND_SCATTER_LARGE_MIN_SPACING,
      );
      if (tooCloseToAnotherLarge) continue;
      const radius = CONFIG.ISLAND_SCATTER_LARGE_MIN_RADIUS + rand() * (CONFIG.ISLAND_SCATTER_LARGE_MAX_RADIUS - CONFIG.ISLAND_SCATTER_LARGE_MIN_RADIUS);
      place(radius, cell.cx, cell.cz, false, 'large');
      largeCenters.push({ x: cell.cx, z: cell.cz });
      excludeNear(cell.cx, cell.cz, radius);
    }
    if (largeCenters.length < CONFIG.ISLAND_SCATTER_LARGE_COUNT && typeof console !== 'undefined') {
      console.warn(`island-scatter: only placed ${largeCenters.length}/${CONFIG.ISLAND_SCATTER_LARGE_COUNT} large islands — world too small/crowded at this seed`);
    }
  }

  // Medium landmarks — same mechanism, no extra medium-medium spacing rule
  // beyond the general cell-exclusion.
  {
    const candidates = shuffledAvailable();
    let mediumPlaced = 0;
    for (const cell of candidates) {
      if (mediumPlaced >= CONFIG.ISLAND_SCATTER_MEDIUM_COUNT) break;
      if (removed.has(cellKey(cell.i, cell.j))) continue;
      const radius = CONFIG.ISLAND_SCATTER_MEDIUM_MIN_RADIUS + rand() * (CONFIG.ISLAND_SCATTER_MEDIUM_MAX_RADIUS - CONFIG.ISLAND_SCATTER_MEDIUM_MIN_RADIUS);
      place(radius, cell.cx, cell.cz, false, 'medium');
      excludeNear(cell.cx, cell.cz, radius);
      mediumPlaced++;
    }
    if (mediumPlaced < CONFIG.ISLAND_SCATTER_MEDIUM_COUNT && typeof console !== 'undefined') {
      console.warn(`island-scatter: only placed ${mediumPlaced}/${CONFIG.ISLAND_SCATTER_MEDIUM_COUNT} medium islands — world too small/crowded at this seed`);
    }
  }

  // Skerry fill — every remaining cell, jittered, no overlap check (see
  // header). ISLAND_SCATTER_COUNT_CAP (index.html's ?count=) caps this pass
  // only; landmarks above are unaffected.
  {
    const jitterAmp = CONFIG.ISLAND_SCATTER_JITTER_FRACTION * pitch;
    const cap = CONFIG.ISLAND_SCATTER_COUNT_CAP;
    const candidates = shuffledAvailable();
    let skerryCount = 0;
    for (const cell of candidates) {
      if (cap && skerryCount >= cap) break;
      const radius = CONFIG.ISLAND_SCATTER_SKERRY_MIN_RADIUS + rand() * (CONFIG.ISLAND_SCATTER_SKERRY_MAX_RADIUS - CONFIG.ISLAND_SCATTER_SKERRY_MIN_RADIUS);
      const x = cell.cx + (rand() * 2 - 1) * jitterAmp;
      const z = cell.cz + (rand() * 2 - 1) * jitterAmp;
      place(radius, x, z, false, 'skerry');
      skerryCount++;
    }
  }

  return islands;
}

// Tiles `area` (centred on the origin) into `windowSize` x `windowSize`
// windows and counts islands per window by centre point — the metric that
// actually answers "how much of the world reads as empty sea," which mean
// nearest-neighbour distance does not (a few close pairs can pull that
// number down while most of the world stays empty — measured, see
// config.js's Island scattering comment). Returns per-window counts plus a
// 0/1/2/3+ histogram as percentages.
export function windowOccupancy(islands, area, windowSize) {
  const half = area / 2;
  // Round (not ceil) the window count and rescale to that count so windows
  // tile the world EXACTLY, with no overhang past +-half — a window that
  // hangs off the world edge is empty by construction (nothing is placed
  // out there), which inflates the empty-window percentage for reasons that
  // have nothing to do with actual coverage. windowSize is a target, not a
  // fixed size the caller can rely on receiving back unchanged.
  const n = Math.max(1, Math.round(area / windowSize));
  const actualWindowSize = area / n;
  const counts = new Array(n * n).fill(0);
  for (const island of islands) {
    const i = Math.min(n - 1, Math.max(0, Math.floor((island.params.ISLAND_CENTER_X + half) / actualWindowSize)));
    const j = Math.min(n - 1, Math.max(0, Math.floor((island.params.ISLAND_CENTER_Z + half) / actualWindowSize)));
    counts[i * n + j]++;
  }
  const total = counts.length;
  const pctAtLeast = (min) => (100 * counts.filter((c) => c >= min).length) / total;
  const histogram = {
    pct0: 100 * counts.filter((c) => c === 0).length / total,
    pct1: 100 * counts.filter((c) => c === 1).length / total,
    pct2: 100 * counts.filter((c) => c === 2).length / total,
    pct3plus: pctAtLeast(3),
  };
  const sorted = [...counts].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return { totalWindows: total, counts, histogram, median };
}
