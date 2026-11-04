// Discoverables (Stage 2, 2026-11-04 — design audit checks 2, 3 and
// "Going somewhere is worth it"). Things on the islands worth sailing to,
// which only count as found when BOTH boats are near at once: one player
// has to bring the other there.
//
// Pure and seed-derived: host and guest compute the same list from the
// same scatterIslands() output, so only "found" events cross the wire.
// No THREE here — props.js builds the visuals, game.js owns the sync.
import { CONFIG } from './config.js';
import { createIslandHeightField } from './island.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One kind per landmark tier. Large islands get the lighthouse (the thing
// you see from far away); medium islands cycle through the rest.
const MEDIUM_KINDS = ['boathouse', 'jetty', 'marker'];

export const KIND_LABELS = {
  lighthouse: 'Lighthouse',
  boathouse: 'Boathouse',
  jetty: 'Jetty',
  marker: 'Channel marker',
  cairn: 'Cairn',
};

// Skerry finds cycle these: small, very west-coast things (sjömärke, röse).
const SKERRY_KINDS = ['marker', 'cairn'];

// Sailable-water test across every island (terrain height < 0 = sea).
// Only islands whose bounding radius covers the point are sampled.
export function makeIsWater(islands) {
  const fields = islands.map((i) => {
    const p = i.params;
    return {
      heightAt: createIslandHeightField(i.seed, p),
      cx: p.ISLAND_CENTER_X,
      cz: p.ISLAND_CENTER_Z,
      r: p.ISLAND_RADIUS + p.ISLAND_COAST_NOISE_AMPLITUDE + 5,
    };
  });
  return function isWater(x, z) {
    for (const f of fields) {
      if (Math.hypot(x - f.cx, z - f.cz) < f.r && f.heightAt(x, z) >= 0) return false;
    }
    return true;
  };
}

// Walk outward from the island centre along `angle` until the terrain drops
// below sea level (height 0). Returns the coast distance from centre.
function coastDistance(heightAt, cx, cz, angle, maxR) {
  const dx = Math.sin(angle);
  const dz = Math.cos(angle);
  for (let r = 0; r <= maxR; r += 0.5) {
    if (heightAt(cx + dx * r, cz + dz * r) < 0) return r;
  }
  return maxR;
}

// islands: scatterIslands(seed) output. Returns
// [{ id, kind, label, x, z, y, facing, visitX, visitZ }]
//   x, z, y  where the prop stands (y = terrain height there, >= 0)
//   facing   outward angle from the island (props face the sea)
//   visitX/Z the point on the water a boat must reach (props on land
//            can't be sailed onto, and boats don't collide with islands)
//
// Two passes: one find on every large and medium island, then a
// farthest-first fill of small finds on skerries — each added at the skerry
// whose surroundings are furthest from any find so far — until the dead
// zone drops under CONFIG.DISCOVER_DEAD_ZONE_TARGET_PCT or
// CONFIG.DISCOVER_SKERRY_MAX is reached.
export function placeDiscoverables(islands, seed, isWater = makeIsWater(islands)) {
  const rand = mulberry32((seed ^ 0x51c0ffee) >>> 0);
  const out = [];
  let mediumIndex = 0;
  islands.forEach((island, index) => {
    if (island.kind !== 'large' && island.kind !== 'medium') return;
    const kind = island.kind === 'large' ? 'lighthouse' : MEDIUM_KINDS[mediumIndex++ % MEDIUM_KINDS.length];
    out.push(placeOne(island, index, kind, rand() * Math.PI * 2, isWater));
  });

  const skerries = islands
    .map((island, index) => ({ island, index }))
    .filter(({ island }) => island.kind === 'skerry');
  const used = new Set();
  let skerryIndex = 0;
  while (skerryIndex < CONFIG.DISCOVER_SKERRY_MAX && skerries.length > used.size) {
    if (deadZoneStats(out, isWater).deadPct < CONFIG.DISCOVER_DEAD_ZONE_TARGET_PCT) break;
    let best = null;
    let bestDist = -1;
    for (const s of skerries) {
      if (used.has(s.index)) continue;
      const p = s.island.params;
      let nearest = Infinity;
      for (const d of out) nearest = Math.min(nearest, distanceToVisit(d, p.ISLAND_CENTER_X, p.ISLAND_CENTER_Z));
      if (nearest > bestDist) {
        bestDist = nearest;
        best = s;
      }
    }
    used.add(best.index);
    const kind = SKERRY_KINDS[skerryIndex++ % SKERRY_KINDS.length];
    out.push(placeOne(best.island, best.index, kind, rand() * Math.PI * 2, isWater));
  }
  return out;
}

// Tries the seeded angle first, then rotates in 30° steps until the boat's
// arrival point is open water — a ray can run straight into a neighbouring
// island, and pushing further out along it never escapes (seed 2: medium
// islands 6 and 11 sit ~35m apart).
function placeOne(island, index, kind, angle, isWater) {
  let fallback = null;
  for (let k = 0; k < 12; k++) {
    const d = placeAt(island, index, kind, angle + (k * Math.PI) / 6, isWater);
    if (isWater(d.visitX, d.visitZ)) return d;
    fallback ??= d;
  }
  return fallback;
}

function placeAt(island, index, kind, angle, isWater) {
  {
    const p = island.params;
    const cx = p.ISLAND_CENTER_X;
    const cz = p.ISLAND_CENTER_Z;
    const heightAt = createIslandHeightField(island.seed, p);
    const maxR = p.ISLAND_RADIUS + p.ISLAND_COAST_NOISE_AMPLITUDE + 40;
    const coast = coastDistance(heightAt, cx, cz, angle, maxR);
    // Lighthouses stand a little inland; boathouse and jetty sit on the
    // waterline; channel markers stand in the water off the coast.
    const standR = kind === 'lighthouse' ? Math.max(0, coast - 6)
      : kind === 'marker' ? coast + 14
      : kind === 'cairn' ? Math.max(0, coast - 3)
      : coast;
    const dx = Math.sin(angle);
    const dz = Math.cos(angle);
    // Push the visit point out until it's open water — a neighbouring
    // skerry can sit right where the boat would need to arrive.
    let visitR = Math.max(coast + CONFIG.DISCOVER_VISIT_OFFSET, standR);
    for (let k = 0; k < 30 && !isWater(cx + dx * visitR, cz + dz * visitR); k++) visitR += 2;
    const x = cx + dx * standR;
    const z = cz + dz * standR;
    return {
      id: `${index}-${kind}`,
      kind,
      label: KIND_LABELS[kind],
      x,
      z,
      y: Math.max(0, heightAt(x, z)),
      facing: angle,
      visitX: cx + dx * visitR,
      visitZ: cz + dz * visitR,
    };
  }
}

export function distanceToVisit(d, x, z) {
  return Math.hypot(d.visitX - x, d.visitZ - z);
}

// The co-op rule: found only when both boats are within reach at once.
// `a`, `b` are { x, z } or null (b null = no partner yet).
export function bothNear(d, a, b, radius = CONFIG.DISCOVER_RADIUS) {
  if (!a || !b) return false;
  return distanceToVisit(d, a.x, a.z) <= radius && distanceToVisit(d, b.x, b.z) <= radius;
}

// Dead-zone measurement for the design audit: the share of open water in
// the play area further than maxDist from anything discoverable. Samples a
// grid; `isWater(x, z)` decides what counts as sailable.
export function deadZoneStats(discoverables, isWater, opts = {}) {
  const maxDist = opts.maxDist ?? CONFIG.DISCOVER_DEAD_ZONE_M;
  const step = opts.step ?? 20;
  const half = (opts.area ?? CONFIG.ISLAND_SCATTER_AREA) / 2;
  let water = 0;
  let dead = 0;
  for (let x = -half; x <= half; x += step) {
    for (let z = -half; z <= half; z += step) {
      if (!isWater(x, z)) continue;
      water++;
      let nearest = Infinity;
      for (const d of discoverables) nearest = Math.min(nearest, distanceToVisit(d, x, z));
      if (nearest > maxDist) dead++;
    }
  }
  return { water, dead, deadPct: water ? (100 * dead) / water : 0, maxDist };
}
