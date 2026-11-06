// Where the player wakes in 1950 (stage 1e, batch 2): a bit of flat shore on Skaftö near Grundsund where the storm threw Svalan up, and the open water just off it where
// the player starts in the borrowed eka. Pure: no THREE and no DOM; the helpers (shoreSpot, findOpenWater) are passed in so tests can run it on the real coast.
//
// beach: { x, y, z, facing } the spot where Svalan lies; facing = the way DOWNHILL, i.e. towards the water (water is at (sin facing, cos facing) from the beach).
// spawn: { x, z } open water for the player.   figures: where the two people stand (the boatbuilder's son beside Svalan, Britta a few metres off, both looking at the sea).
// null if no beach is found (the game then falls back to the old start).
const mulberry32 = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

export const WAKE = Object.freeze({
  maxRadiusM: 400,       // how far from the old start (outside Grundsund's harbour) to look for the beach
  beachHeightM: [0.3, 1.3], // low ground a boat could be thrown onto
  maxSlopeDeg: 14,
  clearOfHousesM: 16,
  tries: 90,             // beaches to try
  // WHERE ON THE PHONE SCREEN Svalan should show at the start. Measured: the camera shows about +-25 m sideways (~7 px per metre) and north is up, with the HUD (compass,
  // wind panel) across the top right. So the start is NORTH of the beach: she appears straight below the boat, in the free lower half.
  startNorthM: 22,       // the start is looked for this far north of the beach (a short slide to open water is allowed)
  screenDxM: 12,         // the beach may be this far to either side of the boat ...
  screenDzM: [10, 36],   // ... and this far south of it
  maxViolationM: 12,     // accept a beach this far outside the box (the best of the tries), else give up (the game then falls back to the old start)
});

// world: { heightAt }; near: { x, z } (the old start); avoid: [{ x, z }] (houses and sheds); helpers: { shoreSpot, findOpenWater }.
export function planWake({ world, near, avoid = [], helpers, seed = 1 }) {
  const { shoreSpot, findOpenWater } = helpers;
  let best = null;
  for (let k = 0; k < WAKE.tries; k++) {
    const rand = mulberry32((0x51ab ^ seed) + k * 7919);
    const beach = shoreSpot(world, near, avoid, { minR: 20, maxR: WAKE.maxRadiusM, clear: WAKE.clearOfHousesM, rand, yMin: WAKE.beachHeightM[0], yMax: WAKE.beachHeightM[1], maxSlope: WAKE.maxSlopeDeg });
    if (!beach) continue;
    const spawn = findOpenWater(world, beach.x, beach.z - WAKE.startNorthM, { clear: 8, maxR: 14 });
    if (!spawn) continue;
    const dx = beach.x - spawn.x, dz = beach.z - spawn.z; // where the beach is, seen from the boat (dz > 0: south, lower on the screen)
    const violation = Math.max(0, Math.abs(dx) - WAKE.screenDxM) + Math.max(0, WAKE.screenDzM[0] - dz) + Math.max(0, dz - WAKE.screenDzM[1]);
    if (!best || violation < best.violation) best = { beach, spawn, violation, off: Math.hypot(dx, dz) };
    if (violation === 0) break;
  }
  if (!best || best.violation > WAKE.maxViolationM) return null;
  const { beach, spawn, off } = best;
  const dir = [Math.sin(beach.facing), Math.cos(beach.facing)];
  // the people: the boatbuilder's son beside Svalan's bow end, Britta a little way along the shore; both look out to sea
  const along = [Math.cos(beach.facing), -Math.sin(beach.facing)]; // along the shore (perpendicular to downhill)
  const spot = (a, d) => { const x = beach.x + along[0] * a + dir[0] * d, z = beach.z + along[1] * a + dir[1] * d; return { x, z, y: world.heightAt(x, z) }; };
  const figures = { boatbuilder: { ...spot(-4.5, 1.5), look: Math.atan2(spawn.x - (beach.x - along[0] * 4.5), spawn.z - (beach.z - along[1] * 4.5)) }, britta: { ...spot(5.5, 2.5), look: Math.atan2(spawn.x - (beach.x + along[0] * 5.5), spawn.z - (beach.z + along[1] * 5.5)) } };
  return { beach, spawn: { x: spawn.x, z: spawn.z }, offshoreM: off, figures };
}
