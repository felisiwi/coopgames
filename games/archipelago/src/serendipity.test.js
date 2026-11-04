// Headless checks for the serendipity field. Run: node games/archipelago/src/serendipity.test.js
import assert from 'node:assert/strict';
import { generateIsland } from './island.js';
import { serendipityField, isWalkable, UNREACHED } from './serendipity.js';
import { CONFIG } from './config.js';

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`ok - ${name}`);
}

// Hand-built 5x1 strip: water, land, landmark, land, land.
function strip(types) {
  return { size: types.length, grid: Array.from({ length: types.length }, (_, y) =>
    types.map((type, x) => ({ type: y === 0 ? type : 'deep_water' }))) };
}

test('distance is walking steps from the landmark, water is -1', () => {
  const island = strip(['deep_water', 'sand', 'landmark', 'grass_1', 'rock']);
  const f = serendipityField(island, { maxDist: 1 });
  assert.deepEqual(Array.from(f.distance.slice(0, 5)), [-1, 1, 0, 1, 2]);
  assert.equal(f.walkable, 4);
  assert.equal(f.dead, 1); // only the rock, 2 steps away
  assert.equal(f.deadPct, 25);
});

test('water blocks: a landmark across water does not count as near', () => {
  const island = strip(['landmark', 'deep_water', 'sand']);
  const f = serendipityField(island, { maxDist: 5 });
  assert.equal(f.distance[2], UNREACHED);
  assert.equal(f.dead, 1);
});

test('no discoverables at all means every walkable tile is dead', () => {
  const island = strip(['sand', 'grass_1', 'rock']);
  const f = serendipityField(island);
  assert.equal(f.discoverables, 0);
  assert.equal(f.deadPct, 100);
});

test('same seed gives the same field (both peers agree)', () => {
  const a = serendipityField(generateIsland(7));
  const b = serendipityField(generateIsland(7));
  assert.deepEqual(a.distance, b.distance);
});

test('real seeds: one landmark each, counts are consistent', () => {
  for (const seed of [1, 2, 3]) {
    const island = generateIsland(seed);
    const f = serendipityField(island);
    let land = 0;
    island.grid.forEach((row) => row.forEach((t) => { if (isWalkable(t.type)) land++; }));
    assert.equal(f.walkable, land);
    assert.equal(f.discoverables, 1);
    assert.equal(f.maxDist, CONFIG.SERENDIPITY_DEAD_ZONE_TILES);
    assert.ok(f.dead >= 0 && f.dead <= f.walkable);
  }
});

console.log(`\n${passed} passed`);
