// node games/windward/src/discover.test.js — Stage 2 discoverables.
import assert from 'node:assert/strict';
import { CONFIG } from './config.js';
import { scatterIslands } from './island-scatter.js';
import { placeDiscoverables, makeIsWater, bothNear, distanceToVisit, deadZoneStats, KIND_LABELS } from './discover.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

const SEEDS = [1, 2, 3, 42, 777];
const worlds = new Map(SEEDS.map((seed) => {
  const islands = scatterIslands(seed);
  const isWater = makeIsWater(islands);
  return [seed, { islands, isWater, ds: placeDiscoverables(islands, seed, isWater) }];
}));

check('same seed gives the same finds on both peers', () => {
  for (const seed of [1, 777]) {
    const islands = scatterIslands(seed);
    assert.deepEqual(placeDiscoverables(islands, seed), worlds.get(seed).ds);
  }
});

check('every large and medium island gets a find; ids unique; labels known', () => {
  for (const { islands, ds } of worlds.values()) {
    const landmarks = islands.filter((i) => i.kind === 'large' || i.kind === 'medium').length;
    assert.equal(ds.filter((d) => ['lighthouse', 'boathouse', 'jetty'].includes(d.kind) || d.id.includes('-marker') && islands[+d.id.split('-')[0]].kind === 'medium').length, landmarks);
    assert.equal(new Set(ds.map((d) => d.id)).size, ds.length);
    for (const d of ds) assert.ok(KIND_LABELS[d.kind], d.kind);
  }
});

check('every visit point is open water (a boat can actually get there)', () => {
  for (const [seed, { isWater, ds }] of worlds) {
    for (const d of ds) assert.ok(isWater(d.visitX, d.visitZ), `seed ${seed} ${d.id}`);
  }
});

check('dead zone: at most ~25% of open water is >150m from any find', () => {
  for (const [seed, { isWater, ds }] of worlds) {
    const st = deadZoneStats(ds, isWater);
    assert.ok(st.deadPct <= CONFIG.DISCOVER_DEAD_ZONE_TARGET_PCT + 0.5, `seed ${seed}: ${st.deadPct.toFixed(1)}%`);
    assert.ok(ds.length <= 13 + CONFIG.DISCOVER_SKERRY_MAX);
  }
});

check('co-op rule: both boats near finds it; one boat, or a far partner, does not', () => {
  const d = worlds.get(1).ds[0];
  const at = (r) => ({ x: d.visitX + r, z: d.visitZ });
  const R = CONFIG.DISCOVER_RADIUS;
  assert.equal(bothNear(d, at(0), at(R - 1)), true);
  assert.equal(bothNear(d, at(0), null), false);
  assert.equal(bothNear(d, at(0), at(R + 1)), false);
  assert.ok(Math.abs(distanceToVisit(d, d.visitX + 3, d.visitZ + 4) - 5) < 1e-9);
});

console.log(`\n${passed} passed`);
