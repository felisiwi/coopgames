// node games/windward/src/island-scatter.test.js — guards island-scatter.js
// against the failure modes that matter for a multiplayer world: islands
// overlapping or crowding, sizes outside the tuned range, an island parked
// on top of spawn, and (most important for multiplayer) any nondeterminism
// that would let host and guest disagree about where the islands are.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG } from './config.js';
import { scatterIslands, buildIslandParams, footprintRadius } from './island-scatter.js';

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

check('radii stay within the configured ISLAND_SCATTER_MIN/MAX_RADIUS range', () => {
  const islands = scatterIslands(777);
  for (const { params } of islands) {
    assert.ok(
      params.ISLAND_RADIUS >= CONFIG.ISLAND_SCATTER_MIN_RADIUS && params.ISLAND_RADIUS <= CONFIG.ISLAND_SCATTER_MAX_RADIUS,
      `radius ${params.ISLAND_RADIUS} outside [${CONFIG.ISLAND_SCATTER_MIN_RADIUS}, ${CONFIG.ISLAND_SCATTER_MAX_RADIUS}]`,
    );
  }
});

check('no two islands crowd closer than their footprints + ISLAND_SCATTER_MIN_SPACING', () => {
  const islands = scatterIslands(4242);
  for (let i = 0; i < islands.length; i++) {
    for (let j = i + 1; j < islands.length; j++) {
      const a = islands[i].params;
      const b = islands[j].params;
      const dist = Math.hypot(a.ISLAND_CENTER_X - b.ISLAND_CENTER_X, a.ISLAND_CENTER_Z - b.ISLAND_CENTER_Z);
      const required = footprintRadius(a) + footprintRadius(b) + CONFIG.ISLAND_SCATTER_MIN_SPACING;
      assert.ok(dist >= required - 1e-6, `islands ${i} and ${j} are ${dist.toFixed(1)}m apart, need >= ${required.toFixed(1)}m`);
    }
  }
});

check('no island footprint encroaches on the spawn clearance around the origin', () => {
  const islands = scatterIslands(99);
  for (const { params } of islands) {
    const distFromSpawn = Math.hypot(params.ISLAND_CENTER_X, params.ISLAND_CENTER_Z);
    const clearance = distFromSpawn - footprintRadius(params);
    assert.ok(
      clearance >= CONFIG.ISLAND_SCATTER_SPAWN_CLEARANCE - 1e-6,
      `island at (${params.ISLAND_CENTER_X}, ${params.ISLAND_CENTER_Z}) leaves only ${clearance.toFixed(1)}m clearance, need >= ${CONFIG.ISLAND_SCATTER_SPAWN_CLEARANCE}`,
    );
  }
});

check('buildIslandParams scales landform distances up and down with radius, keeping frequency*radius roughly constant', () => {
  const small = buildIslandParams(CONFIG.ISLAND_SCATTER_MIN_RADIUS, 0, 0);
  const base = buildIslandParams(CONFIG.ISLAND_RADIUS, 0, 0);
  const large = buildIslandParams(CONFIG.ISLAND_SCATTER_MAX_RADIUS, 0, 0);

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
  const small = buildIslandParams(CONFIG.ISLAND_SCATTER_MIN_RADIUS, 0, 0);
  const large = buildIslandParams(CONFIG.ISLAND_SCATTER_MAX_RADIUS, 0, 0);
  assert.ok(small.ISLAND_TREE_ATTEMPTS > 0, 'smallest island should still attempt to plant some trees');
  assert.ok(large.ISLAND_TREE_ATTEMPTS > small.ISLAND_TREE_ATTEMPTS, 'a bigger island should attempt more trees than a smaller one');
  assert.ok(large.ISLAND_TREE_ATTEMPTS <= 1200, 'tree attempts should be capped for the biggest islands');
});

console.log(`\n${passed}/${passed} assertions passed`);
