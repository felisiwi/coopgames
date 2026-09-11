// Scaffold stub. Real procedural generation (radial falloff + simplex
// coastline, water-margin/landmass/spawn invariants from AGENTS.md Step 0)
// lands in Batch 3. For now this returns a flat all-water placeholder grid
// so the render pipeline has something to draw end-to-end.
import { CONFIG } from './config.js';

export function generateIsland(seed) {
  const size = CONFIG.MAP_SIZE;
  const grid = [];
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      row.push({ type: 'water' });
    }
    grid.push(row);
  }
  return { seed, size, grid, spawnA: null, spawnB: null };
}
