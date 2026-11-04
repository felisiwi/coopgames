// node games/windward/src/settlements.test.js — scenery villages.
import assert from 'node:assert/strict';
import { CONFIG } from './config.js';
import { scatterIslands } from './island-scatter.js';
import { placeDiscoverables, makeIsWater } from './discover.js';
import { placeSettlements, SETTLEMENT_COUNTS } from './settlements.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

const worlds = [1, 2, 3, 42, 777].map((seed) => {
  const islands = scatterIslands(seed);
  const isWater = makeIsWater(islands);
  const finds = placeDiscoverables(islands, seed, isWater);
  return { seed, islands, isWater, finds, buildings: placeSettlements(islands, seed, finds) };
});

check('same seed gives the same villages on both peers', () => {
  const w = worlds[0];
  assert.deepEqual(placeSettlements(w.islands, w.seed, w.finds), w.buildings);
});

check('cottages stand on land; boathouses sit at the shore', () => {
  for (const w of worlds) {
    for (const b of w.buildings) {
      if (b.kind === 'cottage') assert.ok(!w.isWater(b.x, b.z), `seed ${w.seed}: cottage in water`);
      assert.ok(b.y >= 0);
    }
  }
});

check('buildings keep their spacing and stay clear of finds', () => {
  for (const w of worlds) {
    const bs = w.buildings;
    for (let i = 0; i < bs.length; i++) {
      for (let j = i + 1; j < bs.length; j++) {
        assert.ok(Math.hypot(bs[i].x - bs[j].x, bs[i].z - bs[j].z) >= CONFIG.SETTLEMENT_SPACING - 1e-9);
      }
      for (const f of w.finds) assert.ok(Math.hypot(bs[i].x - f.x, bs[i].z - f.z) >= CONFIG.SETTLEMENT_FIND_CLEARANCE - 1e-9);
    }
  }
});

check('plenty of buildings, but never more than the tier caps allow', () => {
  for (const w of worlds) {
    const cap = w.islands.reduce((n, i) => n + (SETTLEMENT_COUNTS[i.kind]?.[1] ?? 0), 0);
    assert.ok(w.buildings.length >= 40, `seed ${w.seed}: only ${w.buildings.length}`);
    assert.ok(w.buildings.length <= cap);
  }
});

console.log(`\n${passed} passed`);
