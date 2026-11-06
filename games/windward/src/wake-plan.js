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
  tries: 240,            // beaches to try (shared between the villages)
  mainlandStepM: 4,      // the land-connectivity grid (game metres)
  mainlandBoxM: 700,     // ... covering this far round the seed village
  // WHERE ON THE PHONE SCREEN Svalan should show at the start. Measured: the camera shows about +-25 m sideways (~7 px per metre) and north is up, with the HUD (compass,
  // wind panel) across the top right. So the start is NORTH of the beach: she appears straight below the boat, in the free lower half.
  startNorthM: 22,       // the start is looked for this far north of the beach (a short slide to open water is allowed)
  screenDxM: 12,         // the beach may be this far to either side of the boat ...
  screenDzM: [10, 36],   // ... and this far south of it
  maxViolationM: 12,     // accept a beach this far outside the box (the best of the tries), else give up (the game then falls back to the old start)
});

// Which ground is joined to the ground at `from` (a village on the mainland shore)? A flood fill on a coarse grid over a box round it; returns has(x, z).
// Used to put the wreck on Skaftö's own shore and never on a skerry that happens to be nearby. A seed that is on water slides to the nearest land first.
export function landConnectedTo({ heightAt, from, boxM = WAKE.mainlandBoxM, stepM = WAKE.mainlandStepM, level = 0.2 }) {
  const n = Math.ceil((2 * boxM) / stepM), x0 = from.x - boxM, z0 = from.z - boxM;
  const idx = (i, j) => j * n + i;
  const land = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) land[idx(i, j)] = heightAt(x0 + (i + 0.5) * stepM, z0 + (j + 0.5) * stepM) > level ? 1 : 0;
  let si = Math.floor((from.x - x0) / stepM), sj = Math.floor((from.z - z0) / stepM);
  if (!land[idx(si, sj)]) { // slide to the nearest land cell (rings of growing size)
    let found = false;
    for (let r = 1; r < 40 && !found; r++) for (let dj = -r; dj <= r && !found; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const i = si + di, j = sj + dj;
      if (i >= 0 && j >= 0 && i < n && j < n && land[idx(i, j)]) { si = i; sj = j; found = true; break; }
    }
    if (!found) return () => false;
  }
  const seen = new Uint8Array(n * n), stack = [idx(si, sj)];
  seen[stack[0]] = 1;
  while (stack.length) {
    const c = stack.pop(), i = c % n, j = (c - i) / n;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= n || b >= n) continue;
      const k = idx(a, b);
      if (land[k] && !seen[k]) { seen[k] = 1; stack.push(k); }
    }
  }
  return (x, z) => {
    const i = Math.floor((x - x0) / stepM), j = Math.floor((z - z0) / stepM);
    if (i < 0 || j < 0 || i >= n || j >= n) return false;
    // the beach itself is a thin strip: accept it if it, or a neighbour cell, is joined to the mainland ground
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < n && b < n && seen[idx(a, b)]) return true; }
    return false;
  };
}

// world: { heightAt }; nears: [{ x, z }] the villages the boatbuilder's yard could be by (Grundsund, Fiskebäckskil), tried in turn; onMainland(x, z) -> bool (optional: only
// beaches that are true); avoid: [{ x, z }] (houses and sheds); helpers: { shoreSpot, findOpenWater }. `near` (one point) still works.
export function planWake({ world, near, nears = near ? [near] : [], onMainland = null, avoid = [], helpers, seed = 1 }) {
  const { shoreSpot, findOpenWater } = helpers;
  let best = null;
  for (let k = 0; k < WAKE.tries; k++) {
    const rand = mulberry32((0x51ab ^ seed) + k * 7919);
    const beach = shoreSpot(world, nears[k % nears.length], avoid, { minR: 20, maxR: WAKE.maxRadiusM, clear: WAKE.clearOfHousesM, rand, yMin: WAKE.beachHeightM[0], yMax: WAKE.beachHeightM[1], maxSlope: WAKE.maxSlopeDeg });
    if (!beach) continue;
    if (onMainland && !onMainland(beach.x, beach.z)) continue;
    const spawn = findOpenWater(world, beach.x, beach.z - WAKE.startNorthM, { clear: 8, maxR: 14 });
    if (!spawn) continue;
    { // the water must run from the shore out to the start: little land between the first 12 m off the beach and the boat
      const ex = spawn.x - beach.x, ez = spawn.z - beach.z, L = Math.hypot(ex, ez);
      let blocked = 0; for (let d = 12; d < L; d += 4) if (world.heightAt(beach.x + (ex / L) * d, beach.z + (ez / L) * d) > 0.3) blocked++;
      if (blocked > 2) continue;
    }
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
