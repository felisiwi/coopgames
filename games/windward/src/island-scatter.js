// Scatters a field of island CLUSTERS across the world (src/config.js's
// ISLAND_SCATTER_* block) — tight skerry groups with open water between
// groups, not one evenly-spaced field (see scatterIslands below for the
// two-level placement itself). Every island is the Skerry shape (CONFIG's
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

// Places one cluster's centre: rejection-sampled against ISLAND_SCATTER_AREA
// and every previously placed cluster centre, using clusterRadius (not any
// member's real footprint — members aren't drawn yet) as the reservation
// size. This is deliberately a NOMINAL reservation, not a worst-case one: an
// earlier version reserved `clusterRadius + largest-possible-member-footprint`
// per cluster, which is safe but wildly over-conservative (the biggest
// scatterable island's footprint alone is ~280m) — in a modest world that
// starved almost half of all clusters of a centre at all. The real footprint
// checks in the member-placement loop below are exact and still prevent any
// actual overlap; this step only needs to keep centres from being pointlessly
// close before anyone knows how big their members will be.
function placeClusterCenter(rand, half, clusterRadius, existingCenters) {
  for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
    const cx = (rand() * 2 - 1) * half;
    const cz = (rand() * 2 - 1) * half;
    if (Math.hypot(cx, cz) - clusterRadius < CONFIG.ISLAND_SCATTER_SPAWN_CLEARANCE) continue;

    const tooClose = existingCenters.some(
      (o) => Math.hypot(cx - o.x, cz - o.z) < clusterRadius * 2 + CONFIG.ISLAND_SCATTER_MIN_SPACING,
    );
    if (tooClose) continue;

    return { x: cx, z: cz };
  }
  return null;
}

// Places one member island uniformly inside its cluster's disk (polar
// sampling: r = clusterRadius*sqrt(rand()) gives uniform area density, not
// centre-biased). Checked against every previously placed island in the
// whole field, not just its own cluster — using ISLAND_SCATTER_MIN_SPACING
// against a different cluster's members and the much tighter
// ISLAND_SCATTER_CLUSTER_SPACING against its own cluster-mates, so
// same-cluster islands can sit close (the "tight skerry group") while
// different clusters still keep real open water between them.
function placeClusterMember(rand, center, clusterRadius, footprint, clusterIndex, placedIslands) {
  for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
    const r = clusterRadius * Math.sqrt(rand());
    const theta = rand() * Math.PI * 2;
    const x = center.x + r * Math.cos(theta);
    const z = center.z + r * Math.sin(theta);

    if (Math.hypot(x, z) - footprint < CONFIG.ISLAND_SCATTER_SPAWN_CLEARANCE) continue;

    const overlaps = placedIslands.some((other) => {
      const gapNeeded =
        footprint +
        footprintRadius(other.params) +
        (other.cluster === clusterIndex ? CONFIG.ISLAND_SCATTER_CLUSTER_SPACING : CONFIG.ISLAND_SCATTER_MIN_SPACING);
      return Math.hypot(x - other.params.ISLAND_CENTER_X, z - other.params.ISLAND_CENTER_Z) < gapNeeded;
    });
    if (overlaps) continue;

    return { x, z };
  }
  return null;
}

// Returns [{ seed, params }, ...] — one entry per successfully placed
// island, ready to pass straight to island.js's createIsland(seed, params).
// Deterministic in `seed` alone; CONFIG.ISLAND_SCATTER_* controls cluster
// count/size, size range, and both spacing rules.
//
// Two levels, not one flat scatter: ISLAND_SCATTER_CLUSTER_COUNT cluster
// centres are placed first (spread across the world, ISLAND_SCATTER_MIN_SPACING
// apart), then up to ISLAND_SCATTER_CLUSTER_SIZE islands are scattered inside
// each cluster's ISLAND_SCATTER_CLUSTER_RADIUS disk, packed close
// (ISLAND_SCATTER_CLUSTER_SPACING) — tight skerry groups with real open water
// between groups, not one evenly-spaced field (Felix, 2026-09-16: "Skerry
// fields cluster — tight groups with open water between, not even spacing").
//
// A cluster's members span the full configured size range (15-150m radius),
// so occasionally a cluster draws one of the largest islands and can't fit
// two more of similar size in the same disk without violating spacing —
// that member (or a whole cluster centre, if the world's too crowded) is
// skipped rather than overlapping or looping forever, same "skip and warn"
// behaviour as the flat scatter this replaces. Tuned empirically (12 seeds)
// at the shipped defaults: ~70% of member slots fill, no cluster centre ever
// fails, and where a cluster does get >=2 members their nearest-neighbour
// gap is a median ~50m — see the header note on CLUSTER_RADIUS/CLUSTER_SPACING
// below for why that number is the actual design target.
export function scatterIslands(seed) {
  const rand = mulberry32((seed ^ 0x9e3a7cc1) >>> 0);
  const half = CONFIG.ISLAND_SCATTER_AREA / 2;
  const islands = [];
  const centers = [];

  for (let c = 0; c < CONFIG.ISLAND_SCATTER_CLUSTER_COUNT; c++) {
    const center = placeClusterCenter(rand, half, CONFIG.ISLAND_SCATTER_CLUSTER_RADIUS, centers);
    if (!center) {
      if (typeof console !== 'undefined') {
        console.warn(`island-scatter: could not place cluster ${c}'s centre after ${MAX_PLACEMENT_ATTEMPTS} attempts — skipping`);
      }
      continue;
    }
    centers.push(center);

    for (let m = 0; m < CONFIG.ISLAND_SCATTER_CLUSTER_SIZE; m++) {
      const radius =
        CONFIG.ISLAND_SCATTER_MIN_RADIUS + rand() * (CONFIG.ISLAND_SCATTER_MAX_RADIUS - CONFIG.ISLAND_SCATTER_MIN_RADIUS);
      const islandSeed = (seed ^ (0x2f1b4c53 + (c * CONFIG.ISLAND_SCATTER_CLUSTER_SIZE + m) * 0x9e3779b9)) >>> 0;
      const params = buildIslandParams(radius, 0, 0);
      const footprint = footprintRadius(params);

      const position = placeClusterMember(rand, center, CONFIG.ISLAND_SCATTER_CLUSTER_RADIUS, footprint, c, islands);
      if (!position) {
        if (typeof console !== 'undefined') {
          console.warn(`island-scatter: could not place cluster ${c} member ${m} after ${MAX_PLACEMENT_ATTEMPTS} attempts — skipping`);
        }
        continue;
      }

      params.ISLAND_CENTER_X = position.x;
      params.ISLAND_CENTER_Z = position.z;
      islands.push({ seed: islandSeed, params, cluster: c });
    }
  }

  return islands;
}
