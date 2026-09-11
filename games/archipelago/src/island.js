// Procedural island generator. A radial falloff mask (keeps land away from
// the map edges) combined with one layer of simplex noise (coastline
// texture) produces a raw elevation field; a threshold turns that into
// land/water. Three invariants from AGENTS.md Step 0 audit #2 are then
// enforced as hard post-processing passes rather than left to tuning luck:
//   - a forced water margin on every edge
//   - exactly one landmass (flood-fill from the centre, drop the rest)
//   - two deterministic land spawns >= SPAWN_DISTANCE apart
import { CONFIG } from './config.js';
import { SimplexNoise2D } from '../../../shared/noise.js';

const RADIUS_FACTOR = 0.8;
const NOISE_FREQ = 0.07;
const LAND_THRESHOLD = 0.52;
const CORNER_NORM = Math.sqrt(0.5 * 0.5 + 0.5 * 0.5);

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(array, rand) {
  const out = array.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Raw elevation -> boolean land mask, before any invariant is enforced.
function generateRawLandMask(seed, size) {
  const noise = new SimplexNoise2D(seed);
  const mask = [];
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      const nx = x / size - 0.5;
      const ny = y / size - 0.5;
      const dist = Math.sqrt(nx * nx + ny * ny) / CORNER_NORM;
      const falloff = Math.max(0, 1 - Math.pow(dist / RADIUS_FACTOR, 2));
      const n01 = (noise.noise2D(x * NOISE_FREQ, y * NOISE_FREQ) + 1) / 2;
      const elevation = falloff * 0.7 + n01 * 0.3;
      row.push(elevation > LAND_THRESHOLD);
    }
    mask.push(row);
  }
  return mask;
}

// Step 0 audit #2(a): hard water margin, not left to falloff tuning.
function enforceWaterMargin(mask, size, margin) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (x < margin || x >= size - margin || y < margin || y >= size - margin) {
        mask[y][x] = false;
      }
    }
  }
}

// Step 0 audit #2(b): exactly one landmass. Flood-fill from the land tile
// nearest the map centre; any land not reached is dropped to water.
function keepOnlyMainLandmass(mask, size) {
  const cx = Math.floor(size / 2);
  const cy = Math.floor(size / 2);

  let start = null;
  for (let r = 0; r < size && !start; r++) {
    for (let dy = -r; dy <= r && !start; dy++) {
      for (let dx = -r; dx <= r && !start; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (mask[y][x]) start = { x, y };
      }
    }
  }
  if (!start) return 0; // no land at all — caller handles the empty case

  const reached = Array.from({ length: size }, () => new Uint8Array(size));
  const stack = [start];
  reached[start.y][start.x] = 1;
  let landCount = 0;

  while (stack.length) {
    const { x, y } = stack.pop();
    landCount++;
    const neighbors = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      if (!mask[ny][nx] || reached[ny][nx]) continue;
      reached[ny][nx] = 1;
      stack.push({ x: nx, y: ny });
    }
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (mask[y][x] && !reached[y][x]) mask[y][x] = false;
    }
  }
  return landCount;
}

// Multi-source BFS distance from every tile to the nearest tile where
// `isSource` is true. Used both for coast distance (land -> nearest water)
// and shore distance (water -> nearest land).
function distanceTo(mask, size, isSource) {
  const dist = Array.from({ length: size }, () => new Int16Array(size).fill(-1));
  const queue = [];
  let head = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (isSource(mask[y][x])) {
        dist[y][x] = 0;
        queue.push([x, y]);
      }
    }
  }
  while (head < queue.length) {
    const [x, y] = queue[head++];
    const d = dist[y][x];
    const neighbors = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      if (dist[ny][nx] !== -1) continue;
      dist[ny][nx] = d + 1;
      queue.push([nx, ny]);
    }
  }
  return dist;
}

function hash2(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Interior tiles (past the grass belt) mix forest and rock in patches
// driven by low-frequency noise, rather than a uniform ring — a solid
// rock disc reads as a grey blob, not a mountainous interior.
function classifyTile(isLand, coastDist, shoreDist, x, y, seed, interiorNoise) {
  if (!isLand) {
    return shoreDist <= 2 ? 'shallow_water' : 'deep_water';
  }
  if (coastDist <= 1) return 'sand';
  if (coastDist <= 3) return hash2(x, y, seed) < 0.5 ? 'grass_1' : 'grass_2';
  if (interiorNoise > 0.62) return 'rock';
  const r = hash2(x, y, seed);
  return r < 0.34 ? 'forest_1' : r < 0.67 ? 'forest_2' : 'forest_3';
}

function pickSpawns(landTiles, seed, spawnDistance) {
  const rand = mulberry32(seed ^ 0x5eed5eed);
  const shuffled = shuffle(landTiles, rand);
  const spawnA = shuffled[0];

  let spawnB = null;
  for (const tile of shuffled) {
    const d = Math.abs(tile.x - spawnA.x) + Math.abs(tile.y - spawnA.y);
    if (d >= spawnDistance) {
      spawnB = tile;
      break;
    }
  }
  if (!spawnB) {
    // Fallback: the farthest available land tile (island too small to hit
    // SPAWN_DISTANCE exactly) — still deterministic.
    let best = null;
    let bestDist = -1;
    for (const tile of landTiles) {
      const d = Math.abs(tile.x - spawnA.x) + Math.abs(tile.y - spawnA.y);
      if (d > bestDist) {
        bestDist = d;
        best = tile;
      }
    }
    spawnB = best;
  }
  return { spawnA, spawnB };
}

export function generateIsland(seed) {
  const size = CONFIG.MAP_SIZE;
  const mask = generateRawLandMask(seed, size);
  enforceWaterMargin(mask, size, CONFIG.WATER_MARGIN);
  keepOnlyMainLandmass(mask, size);

  const coastDist = distanceTo(mask, size, (isLand) => !isLand); // land -> nearest water
  const shoreDist = distanceTo(mask, size, (isLand) => isLand); // water -> nearest land
  const interiorNoise = new SimplexNoise2D(seed ^ 0x9e3779b9);

  const grid = [];
  const landTiles = [];
  let maxCoastDist = -1;
  let landmarkCandidate = null;

  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      const isLand = mask[y][x];
      const n01 = (interiorNoise.noise2D(x * 0.12, y * 0.12) + 1) / 2;
      const type = classifyTile(isLand, coastDist[y][x], shoreDist[y][x], x, y, seed, n01);
      row.push({ type });
      if (isLand) {
        landTiles.push({ x, y });
        if (coastDist[y][x] > maxCoastDist) {
          maxCoastDist = coastDist[y][x];
          landmarkCandidate = { x, y };
        }
      }
    }
    grid.push(row);
  }

  if (landmarkCandidate) {
    grid[landmarkCandidate.y][landmarkCandidate.x].type = 'landmark';
  }

  const { spawnA, spawnB } = landTiles.length
    ? pickSpawns(landTiles, seed, CONFIG.SPAWN_DISTANCE)
    : { spawnA: null, spawnB: null };

  return { seed, size, grid, spawnA, spawnB };
}
