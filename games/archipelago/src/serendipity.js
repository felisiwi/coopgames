// Serendipity map (design-audit tooling, 2026-11-04). Answers one question
// headlessly: how much of the walkable island is further than
// CONFIG.SERENDIPITY_DEAD_ZONE_TILES from anything worth discovering?
//
// "Discoverable" is defined in games/archipelago/design-checks.md and mirrored
// here as CONFIG.DISCOVERABLE_TYPES — today that's only the single
// `landmark` tile. Distance is WALKING distance (4-neighbour BFS over land,
// the same moves tryStartMove allows), not straight-line: a landmark across
// a bay you can't wade is not "near".
//
// No DOM, no canvas — the design audit imports this in node as evidence, and
// render.js reuses the same distance field for the ?debug=serendipity
// overlay, so the overlay and the number can never disagree.
import { CONFIG } from './config.js';

const WATER_TYPES = new Set(['deep_water', 'shallow_water']);

// Larger than any maxDist, so unreachable land always counts as dead.
export const UNREACHED = 0x7fffffff;

export function isWalkable(type) {
  return !WATER_TYPES.has(type);
}

// Returns { distance, walkable, dead, deadPct, discoverables, maxDist }.
// distance: Int32Array indexed y * size + x — walking steps to the nearest
// discoverable, -1 for water, UNREACHED for land no discoverable can reach
// (every tile, when an island has no discoverables at all).
export function serendipityField(island, opts = {}) {
  const maxDist = opts.maxDist ?? CONFIG.SERENDIPITY_DEAD_ZONE_TILES;
  const types = new Set(opts.discoverableTypes ?? CONFIG.DISCOVERABLE_TYPES);
  const { size, grid } = island;
  const distance = new Int32Array(size * size).fill(UNREACHED);

  const queue = [];
  let walkable = 0;
  let discoverables = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const type = grid[y][x].type;
      if (!isWalkable(type)) {
        distance[i] = -1;
        continue;
      }
      walkable++;
      if (types.has(type)) {
        distance[i] = 0;
        queue.push(i);
        discoverables++;
      }
    }
  }

  // Multi-source BFS from every discoverable at once.
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const x = i % size;
    const y = (i - x) / size;
    const next = distance[i] + 1;
    const neighbours = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of neighbours) {
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const j = ny * size + nx;
      if (distance[j] === -1 || distance[j] <= next) continue;
      distance[j] = next;
      queue.push(j);
    }
  }

  let dead = 0;
  for (let i = 0; i < distance.length; i++) {
    if (distance[i] > maxDist) dead++;
  }
  const deadPct = walkable ? (100 * dead) / walkable : 0;
  return { distance, walkable, dead, deadPct, discoverables, maxDist };
}

// Convenience for the audit: one number per seed.
export function deadZonePct(island, opts) {
  return serendipityField(island, opts).deadPct;
}
