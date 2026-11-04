// Settlements (2026-11-04, Felix: "we need more buildings in general").
// Scenery only — cottages and extra boathouses that make islands feel
// lived-in, west-coast style. They are NOT discoverables: the found count
// stays about places worth sailing to, not every house.
//
// Pure and seed-derived like discover.js, so both peers build the same
// villages with no network traffic. Buildings sit on gentle ground a little
// inland, facing the sea, kept clear of each other and of the finds.
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

// How many buildings each island tier gets, [min, max] — tune by eye.
export const SETTLEMENT_COUNTS = {
  large: [6, 10],
  medium: [2, 4],
  starter: [1, 1],
  skerry: [0, 0],
};

const WALL_VARIANTS = ['red', 'red', 'red', 'ochre', 'white']; // mostly falu red, like the real coast

function slopeDeg(heightAt, x, z) {
  const e = 0.75;
  const dx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e);
  const dz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
  return (Math.atan(Math.hypot(dx, dz)) * 180) / Math.PI;
}

function coastDistance(heightAt, cx, cz, angle, maxR) {
  for (let r = 0; r <= maxR; r += 0.5) {
    if (heightAt(cx + Math.sin(angle) * r, cz + Math.cos(angle) * r) < 0) return r;
  }
  return maxR;
}

// Returns [{ kind: 'cottage'|'boathouse', variant, x, z, y, facing }].
// `avoid`: points to keep clear of (e.g. discoverables), [{ x, z }].
export function placeSettlements(islands, seed, avoid = []) {
  const rand = mulberry32((seed ^ 0x7e11a9e5) >>> 0);
  const out = [];
  const clear = (x, z, gap) => out.every((b) => Math.hypot(b.x - x, b.z - z) >= gap)
    && avoid.every((a) => Math.hypot(a.x - x, a.z - z) >= CONFIG.SETTLEMENT_FIND_CLEARANCE);

  for (const island of islands) {
    const [lo, hi] = SETTLEMENT_COUNTS[island.kind] ?? [0, 0];
    const want = lo + Math.floor(rand() * (hi - lo + 1));
    if (!want) continue;
    const p = island.params;
    const cx = p.ISLAND_CENTER_X;
    const cz = p.ISLAND_CENTER_Z;
    const heightAt = createIslandHeightField(island.seed, p);
    const maxR = p.ISLAND_RADIUS + p.ISLAND_COAST_NOISE_AMPLITUDE + 40;

    // A village clusters along one stretch of coast rather than spreading
    // evenly round the island — that's how harbour hamlets look.
    const villageAngle = rand() * Math.PI * 2;
    const spread = island.kind === 'large' ? 1.1 : 1.6; // radians of coastline used
    let placed = 0;
    let boathouses = 0;
    for (let attempt = 0; attempt < 200 && placed < want; attempt++) {
      const angle = villageAngle + (rand() - 0.5) * spread * (1 + attempt / 100); // widen the stretch if the coast is steep
      const coast = coastDistance(heightAt, cx, cz, angle, maxR);
      // One boathouse per village on the waterline; the rest are cottages
      // a few metres up from the shore.
      const asBoathouse = boathouses === 0 && placed >= 1 && island.kind !== 'starter';
      const inland = asBoathouse ? 1 : 6 + rand() * 18;
      const r = coast - inland;
      if (r <= 0) continue;
      const x = cx + Math.sin(angle) * r;
      const z = cz + Math.cos(angle) * r;
      const y = heightAt(x, z);
      if (!asBoathouse && (y < 0.6 || slopeDeg(heightAt, x, z) > CONFIG.SETTLEMENT_MAX_SLOPE_DEG)) continue;
      if (!clear(x, z, CONFIG.SETTLEMENT_SPACING)) continue;
      out.push({
        kind: asBoathouse ? 'boathouse' : 'cottage',
        variant: asBoathouse ? 'red' : WALL_VARIANTS[Math.floor(rand() * WALL_VARIANTS.length)],
        x,
        z,
        y: Math.max(0, y),
        // Face the sea, with a little wonk so a row of houses isn't a grid
        // (ART.md: "handmade and a bit wonky").
        facing: angle + (asBoathouse ? 0 : (rand() - 0.5) * 0.5),
      });
      placed++;
      if (asBoathouse) boathouses++;
    }
  }
  return out;
}
