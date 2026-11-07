// The boats shelf (boats-lab.html): which boats stand on it. Pure: no DOM, no rendering. A shelf is the boats an era would put on the water, drawn the SAME way the game draws traffic:
// vesselFor(class block, seed) picks the asset, length and hull name from the profile, and the kit's look(seed) (src/boat-looks.js) draws the rest. So what the shelf shows is what the game shows.
import { vesselFor, profileForYear } from './busy-era.js';
import { getKit, buildAsset } from './busy-kits.js';
import { Mesher } from './era-assets.js';

export const SHELF_ERAS = { '1950': 1950, today: 2026 }; // the year each shelf takes its profile from
export const SHELF_MIX = [['sail', 0.4], ['motor', 0.3], ['fish', 0.3]]; // about the share of each traffic class on the shelf (the era's own mix is the profile's; this just shows all three)

// n boats for an era: [{ i, cls, seed, v (vesselFor's result), assetId, opts }] with seeds spread over [0, 1) the way the ambient boats' seeds are (golden ratio steps), so they differ from each other.
export function shelfFor(eras, era, n = 20) {
  const profile = profileForYear(eras, SHELF_ERAS[era]);
  const kit = getKit(profile.kit);
  const out = [];
  let k = 0;
  const counts = SHELF_MIX.map(([, share]) => Math.round(n * share));
  counts[counts.length - 1] = n - counts.slice(0, -1).reduce((a, b) => a + b, 0); // the last class takes the remainder, so there are exactly n
  SHELF_MIX.forEach(([cls], ci) => {
    for (let c = 0; c < counts[ci]; c++, k++) {
      const seed = (0.137 + k * 0.6180339887) % 1;
      const v = vesselFor(profile.traffic.classes[cls], seed);
      out.push({ i: out.length, cls, seed, v, assetId: v.asset, opts: { L: v.L, stripe: v.stripe, sailsUp: true, lit: true, seed: v.seed } });
    }
  });
  return { profile, kit, boats: out };
}

// Stamp a shelf into one pair of Meshers in a grid (boats point +x, so the camera sees them side on). Returns { S, G, placed: [{ i, x, z, look, triangles }] }.
export function stampShelf(shelf, { cols = 5, dx = 15, dz = 11 } = {}) {
  const S = new Mesher(), G = { on: new Mesher(), off: new Mesher() };
  S.peers = [G.on, G.off];
  const rows = Math.ceil(shelf.boats.length / cols), placed = [];
  shelf.boats.forEach((b, i) => {
    const x = ((i % cols) - (cols - 1) / 2) * dx, z = (Math.floor(i / cols) - (rows - 1) / 2) * dz;
    const before = S.triangles + G.on.triangles + G.off.triangles;
    let look = null;
    S.at({ p: [x, 0, z], ry: Math.PI / 2 }, () => { look = buildAsset(shelf.kit, b.assetId, b.opts, S, G); });
    placed.push({ i, x, z, look, boat: b, triangles: S.triangles + G.on.triangles + G.off.triangles - before });
  });
  return { S, G, placed, cols, rows, width: (cols - 1) * dx + 11, depth: (rows - 1) * dz + 8 };
}
