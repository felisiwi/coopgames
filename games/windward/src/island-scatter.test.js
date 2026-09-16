// node games/windward/src/island-scatter.test.js — guards island-scatter.js
// against the failure modes that matter for a multiplayer world: islands
// overlapping or crowding, sizes outside their kind's tuned range, an
// island parked on top of spawn, empty-sea coverage regressions, and (most
// important for multiplayer) any nondeterminism that would let host and
// guest disagree about where the islands are.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG } from './config.js';
import {
  scatterIslands,
  buildIslandParams,
  footprintRadius,
  starterBearing,
  STARTER_NEAR_EDGE_DISTANCE_M,
  cameraViewWidth,
  gridPitch,
  windowOccupancy,
} from './island-scatter.js';

let passed = 0;

function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

check('every ISLAND_* config key (besides scatter/position/radius) is assigned a scaling category', () => {
  const source = readFileSync(new URL('./island-scatter.js', import.meta.url), 'utf8');
  // Cheap re-derivation instead of importing the private lists: every
  // ISLAND_* CONFIG key must appear somewhere in island-scatter.js's source
  // (as a scaling-category member) or be one of the three keys the scatter
  // itself overwrites per-island (RADIUS/CENTER_X/CENTER_Z).
  const overwritten = new Set(['ISLAND_RADIUS', 'ISLAND_CENTER_X', 'ISLAND_CENTER_Z']);
  const islandKeys = Object.keys(CONFIG).filter((k) => k.startsWith('ISLAND_') && !k.startsWith('ISLAND_SCATTER_'));
  for (const key of islandKeys) {
    if (overwritten.has(key)) continue;
    assert.ok(source.includes(`'${key}'`), `${key} isn't listed in any scaling category in island-scatter.js`);
  }
});

check('scatterIslands is deterministic: same seed produces an identical field', () => {
  const a = scatterIslands(12345);
  const b = scatterIslands(12345);
  assert.equal(a.length, b.length, 'island counts diverged for the same seed');
  for (let i = 0; i < a.length; i++) {
    assert.equal(a[i].seed, b[i].seed, `island ${i} seed diverged`);
    assert.equal(a[i].kind, b[i].kind, `island ${i} kind diverged`);
    assert.equal(a[i].params.ISLAND_RADIUS, b[i].params.ISLAND_RADIUS, `island ${i} radius diverged`);
    assert.equal(a[i].params.ISLAND_CENTER_X, b[i].params.ISLAND_CENTER_X, `island ${i} X diverged`);
    assert.equal(a[i].params.ISLAND_CENTER_Z, b[i].params.ISLAND_CENTER_Z, `island ${i} Z diverged`);
  }
});

check('different seeds produce a different field', () => {
  const a = scatterIslands(1);
  const b = scatterIslands(2);
  const same =
    a.length === b.length &&
    a.every((island, i) => island.params.ISLAND_CENTER_X === b[i].params.ISLAND_CENTER_X && island.params.ISLAND_CENTER_Z === b[i].params.ISLAND_CENTER_Z);
  assert.ok(!same, 'two different seeds produced an identical island field (suspiciously deterministic)');
});

check("every island's radius matches its own kind's configured range (starter counts as skerry-sized)", () => {
  const ranges = {
    starter: [CONFIG.ISLAND_SCATTER_SKERRY_MIN_RADIUS, CONFIG.ISLAND_SCATTER_SKERRY_MAX_RADIUS],
    skerry: [CONFIG.ISLAND_SCATTER_SKERRY_MIN_RADIUS, CONFIG.ISLAND_SCATTER_SKERRY_MAX_RADIUS],
    medium: [CONFIG.ISLAND_SCATTER_MEDIUM_MIN_RADIUS, CONFIG.ISLAND_SCATTER_MEDIUM_MAX_RADIUS],
    large: [CONFIG.ISLAND_SCATTER_LARGE_MIN_RADIUS, CONFIG.ISLAND_SCATTER_LARGE_MAX_RADIUS],
  };
  const islands = scatterIslands(777);
  for (const { params, kind } of islands) {
    const [min, max] = ranges[kind];
    assert.ok(
      params.ISLAND_RADIUS >= min - 1e-6 && params.ISLAND_RADIUS <= max + 1e-6,
      `${kind} radius ${params.ISLAND_RADIUS} outside [${min}, ${max}]`,
    );
  }
});

check('ISLAND_SCATTER_SKERRY_MAX_RADIUS stays under half the grid pitch (what makes the no-overlap-check skerry fill safe)', () => {
  const pitch = gridPitch();
  assert.ok(
    CONFIG.ISLAND_SCATTER_SKERRY_MAX_RADIUS < pitch / 2,
    `skerry max radius ${CONFIG.ISLAND_SCATTER_SKERRY_MAX_RADIUS}m is not under half the ${pitch.toFixed(1)}m pitch`,
  );
});

check('large islands respect ISLAND_SCATTER_LARGE_MIN_SPACING from each other, for seeds 1-3', () => {
  for (const seed of [1, 2, 3]) {
    const large = scatterIslands(seed).filter((isl) => isl.kind === 'large');
    for (let i = 0; i < large.length; i++) {
      for (let j = i + 1; j < large.length; j++) {
        const dist = Math.hypot(
          large[i].params.ISLAND_CENTER_X - large[j].params.ISLAND_CENTER_X,
          large[i].params.ISLAND_CENTER_Z - large[j].params.ISLAND_CENTER_Z,
        );
        assert.ok(
          dist >= CONFIG.ISLAND_SCATTER_LARGE_MIN_SPACING - 1e-6,
          `seed ${seed}: large islands ${i} and ${j} are ${dist.toFixed(0)}m apart, need >= ${CONFIG.ISLAND_SCATTER_LARGE_MIN_SPACING}m`,
        );
      }
    }
  }
});

check('all ISLAND_SCATTER_LARGE_COUNT and ISLAND_SCATTER_MEDIUM_COUNT landmarks place at default config, for seeds 1-3', () => {
  for (const seed of [1, 2, 3]) {
    const islands = scatterIslands(seed);
    const large = islands.filter((isl) => isl.kind === 'large').length;
    const medium = islands.filter((isl) => isl.kind === 'medium').length;
    assert.equal(large, CONFIG.ISLAND_SCATTER_LARGE_COUNT, `seed ${seed}: placed ${large}/${CONFIG.ISLAND_SCATTER_LARGE_COUNT} large islands`);
    assert.equal(medium, CONFIG.ISLAND_SCATTER_MEDIUM_COUNT, `seed ${seed}: placed ${medium}/${CONFIG.ISLAND_SCATTER_MEDIUM_COUNT} medium islands`);
  }
});

check('coverage: VIEW x VIEW windows are mostly non-empty and mostly hold 2+ islands, for seeds 1-3 (prints the histogram)', () => {
  // The metric that actually answers "does this read as empty sea" —
  // config.js's Island scattering comment has why mean nearest-neighbour
  // distance was the wrong metric (measured: it hid two failed placement
  // designs that were 68-93% empty by this measure).
  const view = cameraViewWidth();
  console.log(`    VIEW=${view.toFixed(1)}m pitch=${gridPitch().toFixed(1)}m`);
  for (const seed of [1, 2, 3]) {
    const islands = scatterIslands(seed);
    const { histogram, median, totalWindows } = windowOccupancy(islands, CONFIG.ISLAND_SCATTER_AREA, view);
    console.log(
      `    seed ${seed}: placed=${islands.length} windows(n=${totalWindows}) 0=${histogram.pct0.toFixed(1)}% 1=${histogram.pct1.toFixed(1)}% ` +
        `2=${histogram.pct2.toFixed(1)}% 3+=${histogram.pct3plus.toFixed(1)}% median=${median}`,
    );
    assert.ok(histogram.pct0 < 10, `seed ${seed}: ${histogram.pct0.toFixed(1)}% of windows are empty, expected < 10%`);
    assert.ok(median >= 2, `seed ${seed}: median window has ${median} islands, expected >= 2`);
  }
});

check('placed island count at default config stays in a sane range, for seeds 1-3', () => {
  for (const seed of [1, 2, 3]) {
    const count = scatterIslands(seed).length;
    assert.ok(count >= 80 && count <= 150, `seed ${seed}: placed ${count} islands, expected [80, 150]`);
  }
});

check('the spawn cell (world origin) never gets a randomly-placed island — only the starter is allowed that close', () => {
  const pitch = gridPitch();
  const area = CONFIG.ISLAND_SCATTER_AREA;
  const half = area / 2;
  const spawnI = Math.min(Math.round(area / pitch) - 1, Math.max(0, Math.floor(half / pitch)));
  const cellLo = -half + pitch * spawnI;
  const cellHi = cellLo + pitch;

  const islands = scatterIslands(99);
  for (const { params, isStarter } of islands) {
    if (isStarter) continue;
    const inSpawnCell = params.ISLAND_CENTER_X > cellLo && params.ISLAND_CENTER_X < cellHi && params.ISLAND_CENTER_Z > cellLo && params.ISLAND_CENTER_Z < cellHi;
    assert.ok(!inSpawnCell, `island at (${params.ISLAND_CENTER_X.toFixed(0)}, ${params.ISLAND_CENTER_Z.toFixed(0)}) was placed inside the forced-empty spawn cell [${cellLo.toFixed(0)}, ${cellHi.toFixed(0)}]`);
  }
});

check('the starter island always exists (islands[0], isStarter: true, kind: starter) and its near coastline sits exactly STARTER_NEAR_EDGE_DISTANCE_M past spawn, on the camera-visible bearing', () => {
  const seeds = [1, 2, 3, 4, 5, 42, 989370];
  const bearing = starterBearing();
  assert.ok(Math.abs(Math.hypot(bearing.x, bearing.z) - 1) < 1e-9, 'starterBearing should be a unit vector');

  for (const seed of seeds) {
    const islands = scatterIslands(seed);
    const starter = islands.find((isl) => isl.isStarter);
    assert.ok(starter, `seed ${seed}: no starter island was placed at all`);
    assert.equal(islands[0], starter, `seed ${seed}: starter island should always be islands[0]`);
    assert.equal(starter.kind, 'starter', `seed ${seed}: starter island's kind should be 'starter'`);

    const { params } = starter;
    const distFromSpawn = Math.hypot(params.ISLAND_CENTER_X, params.ISLAND_CENTER_Z);
    const nearEdge = distFromSpawn - footprintRadius(params);
    assert.ok(
      Math.abs(nearEdge - STARTER_NEAR_EDGE_DISTANCE_M) < 1e-6,
      `seed ${seed}: starter island's near edge is ${nearEdge.toFixed(1)}m past spawn, expected exactly ${STARTER_NEAR_EDGE_DISTANCE_M}m`,
    );

    // Its centre should lie along starterBearing() from the origin, not off to the side.
    const observedBearingX = params.ISLAND_CENTER_X / distFromSpawn;
    const observedBearingZ = params.ISLAND_CENTER_Z / distFromSpawn;
    assert.ok(Math.abs(observedBearingX - bearing.x) < 1e-9 && Math.abs(observedBearingZ - bearing.z) < 1e-9, `seed ${seed}: starter island isn't on starterBearing()`);
  }
});

check('buildIslandParams scales landform distances up and down with radius, keeping frequency*radius roughly constant', () => {
  const small = buildIslandParams(CONFIG.ISLAND_SCATTER_SKERRY_MIN_RADIUS, 0, 0);
  const base = buildIslandParams(CONFIG.ISLAND_RADIUS, 0, 0);
  const large = buildIslandParams(CONFIG.ISLAND_SCATTER_LARGE_MAX_RADIUS, 0, 0);

  assert.ok(small.ISLAND_PEAK_HEIGHT < base.ISLAND_PEAK_HEIGHT, 'a smaller island should have a lower peak');
  assert.ok(large.ISLAND_PEAK_HEIGHT > base.ISLAND_PEAK_HEIGHT, 'a bigger island should have a higher peak');

  // Wiggle count around the coastline ~= circumference * frequency; holding
  // radius * frequency constant holds that count constant across sizes.
  const wiggleSmall = small.ISLAND_RADIUS * small.ISLAND_COAST_NOISE_FREQ;
  const wiggleBase = base.ISLAND_RADIUS * base.ISLAND_COAST_NOISE_FREQ;
  const wiggleLarge = large.ISLAND_RADIUS * large.ISLAND_COAST_NOISE_FREQ;
  assert.ok(Math.abs(wiggleSmall - wiggleBase) < 1e-9, 'small island wiggle count drifted from base');
  assert.ok(Math.abs(wiggleLarge - wiggleBase) < 1e-9, 'large island wiggle count drifted from base');

  // Sea bathymetry and the mesh's water-overlap margin are physically
  // independent of island size — must stay exactly the Skerry values.
  assert.equal(small.ISLAND_ABYSS_DEPTH, CONFIG.ISLAND_ABYSS_DEPTH);
  assert.equal(large.ISLAND_ABYSS_DEPTH, CONFIG.ISLAND_ABYSS_DEPTH);
  assert.equal(small.ISLAND_MESH_MARGIN, CONFIG.ISLAND_MESH_MARGIN);
  assert.equal(large.ISLAND_MESH_MARGIN, CONFIG.ISLAND_MESH_MARGIN);
});

check('tree attempts scale with area (radius^2) and stay within sane bounds', () => {
  const small = buildIslandParams(CONFIG.ISLAND_SCATTER_SKERRY_MIN_RADIUS, 0, 0);
  const large = buildIslandParams(CONFIG.ISLAND_SCATTER_LARGE_MAX_RADIUS, 0, 0);
  assert.ok(small.ISLAND_TREE_ATTEMPTS > 0, 'smallest island should still attempt to plant some trees');
  assert.ok(large.ISLAND_TREE_ATTEMPTS > small.ISLAND_TREE_ATTEMPTS, 'a bigger island should attempt more trees than a smaller one');
  assert.ok(large.ISLAND_TREE_ATTEMPTS <= 1200, 'tree attempts should be capped for the biggest islands');
});

console.log(`\n${passed}/${passed} assertions passed`);
