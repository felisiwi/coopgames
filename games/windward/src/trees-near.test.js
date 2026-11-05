// node games/windward/src/trees-near.test.js — trees only near the boat.
// Synthetic tests always run; the real-coast tests run when assets/coast/ has been built.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeTreesNear, classSamplerFromCoast, hash01, DENSITY, CELL } from './trees-near.js';

let passed = 0;
async function check(name, fn) { await fn(); passed += 1; console.log(`ok - ${name}`); }

const allForest = makeTreesNear({ classAt: () => 'forest', seed: 7 });
const allRock = makeTreesNear({ classAt: () => 'bare_rock', seed: 7 });
const allSea = makeTreesNear({ classAt: () => null, seed: 7 });

await check('hash01 is deterministic and in [0, 1)', () => {
  for (const [a, b, c] of [[0, 0, 0], [5, -3, 9], [-100000, 77, 1]]) {
    assert.equal(hash01(a, b, c), hash01(a, b, c));
    assert.ok(hash01(a, b, c) >= 0 && hash01(a, b, c) < 1);
  }
  assert.notEqual(hash01(1, 2, 3), hash01(2, 1, 3));
});

await check('a fully forested disc of radius 250 has fewer than 3000 trees (and about pi*r^2/100)', () => {
  for (const [x, z] of [[0, 0], [1234.5, -987.25], [-40000, 52000.5]]) {
    const n = allForest(x, z, 250).length;
    assert.ok(n < 3000, `${n} trees`);
    const expected = (Math.PI * 250 * 250 / 100) * DENSITY.forest;   // 100 m^2 per unit of density
    assert.ok(Math.abs(n - expected) < expected * 0.1, `${n} trees vs about ${expected.toFixed(0)}`);
  }
});

await check('the same input gives exactly the same output', () => {
  assert.deepEqual(allForest(310.2, -77.7, 250), allForest(310.2, -77.7, 250));
  const again = makeTreesNear({ classAt: () => 'forest', seed: 7 });
  assert.deepEqual(allForest(0, 0, 120), again(0, 0, 120));
});

await check('the same spot always gets the same trees, whatever the query centre', () => {
  const a = allForest(0, 0, 250), b = allForest(60, 40, 250);
  const key = (t) => `${t.x},${t.z},${t.kind},${t.size}`;
  const inB = new Set(b.map(key));
  // trees that are inside both discs must be identical in both answers
  const both = a.filter((t) => Math.hypot(t.x - 60, t.z - 40) <= 250);
  assert.ok(both.length > 1000);
  for (const t of both) assert.ok(inB.has(key(t)), 'tree missing from the shifted query');
});

await check('a different seed gives a different layout', () => {
  const other = makeTreesNear({ classAt: () => 'forest', seed: 8 });
  assert.notDeepEqual(allForest(0, 0, 100), other(0, 0, 100));
});

await check('every tree lies inside the radius; radius 0 and bigger radius behave', () => {
  for (const t of allForest(500, 500, 200)) assert.ok(Math.hypot(t.x - 500, t.z - 500) <= 200 + 1e-9);
  assert.equal(allForest(0, 0, 0).length, 0);
  assert.ok(allForest(0, 0, 100).length < allForest(0, 0, 200).length);
});

await check('rock and sea get no trees; scrub is sparser than forest', () => {
  assert.equal(allRock(0, 0, 250).length, 0);
  assert.equal(allSea(0, 0, 250).length, 0);
  const scrub = makeTreesNear({ classAt: () => 'scrub', seed: 7 })(0, 0, 250).length;
  assert.ok(scrub > 0 && scrub < allForest(0, 0, 250).length * 0.7);
});

await check('classes decide the kinds', () => {
  assert.ok(allForest(0, 0, 250).every((t) => t.kind === 'pine' || t.kind === 'spruce'));
  const scrub = makeTreesNear({ classAt: () => 'scrub', seed: 7 })(0, 0, 250);
  assert.ok(scrub.every((t) => t.kind === 'bush' || t.kind === 'juniper'));
});

await check('a half-forest, half-sea boundary only plants on the forest side', () => {
  const split = makeTreesNear({ classAt: (x) => (x < 0 ? 'forest' : null), seed: 7 });
  const trees = split(0, 0, 250);
  assert.ok(trees.length > 0 && trees.every((t) => t.x < 0));
});

// ---- real coast data (skipped if not built)
const coastDir = fileURLToPath(new URL('../assets/coast/', import.meta.url));
const builtMeta = fs.existsSync(coastDir + 'meta.json') ? JSON.parse(fs.readFileSync(coastDir + 'meta.json', 'utf8')) : null;
if (builtMeta && builtMeta.tiles && fs.existsSync(coastDir + 'routes.json')) {
  const { loadCoast } = await import('./coast-data.js');
  const coast = await loadCoast(coastDir, { json: async (u) => JSON.parse(fs.readFileSync(u)), bytes: async (u) => new Uint8Array(fs.readFileSync(u)) });
  for (const scale of [6, 8, 10]) {
    await check(`real coast 1:${scale}: no 250 m disc anywhere on the map has 3000+ trees; output is repeatable`, () => {
      const trees = makeTreesNear({ classAt: classSamplerFromCoast(coast, scale), seed: 1 });
      const gm = coast.mpp / scale;
      let worst = 0, sampled = 0;
      for (let z = 400; z < coast.height * gm; z += 700) for (let x = 400; x < coast.width * gm; x += 700) {
        const n = trees(x, z, 250).length;
        if (n) sampled++;
        worst = Math.max(worst, n);
      }
      console.log(`   1:${scale}: ${sampled} sampled discs with trees, worst disc = ${worst} trees`);
      assert.ok(sampled > 10 && worst < 3000);
      assert.deepEqual(trees(2000, 3000, 250), trees(2000, 3000, 250));
    });
  }
} else console.log('skip - real-coast tests (assets/coast not built)');

console.log(`\n${passed} passed`);
