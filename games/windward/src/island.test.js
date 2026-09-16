// node games/windward/src/island.test.js — guards the I1 island heightfield
// and mesh against the two failure modes that would be hardest to notice
// visually: a seam at the coastline (landFactor not actually continuous)
// and a host/guest shape mismatch (seeding not deterministic).
import assert from 'node:assert/strict';
import { CONFIG } from './config.js';
import { createIslandHeightField, createIsland } from './island.js';

let passed = 0;

function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

const { ISLAND_CENTER_X: CX, ISLAND_CENTER_Z: CZ } = CONFIG;

check('heightAt is finite everywhere, near the island and far out to sea', () => {
  const heightAt = createIslandHeightField(1);
  for (let x = -800; x <= 800; x += 100) {
    for (let z = -800; z <= 800; z += 100) {
      const h = heightAt(x, z);
      assert.ok(Number.isFinite(h), `non-finite height at (${x},${z}): ${h}`);
    }
  }
});

check('island centre is well above sea level, roughly at the configured peak', () => {
  const heightAt = createIslandHeightField(1);
  const h = heightAt(CX, CZ);
  assert.ok(h > CONFIG.ISLAND_PEAK_HEIGHT * 0.5, `centre height ${h} too low for a ${CONFIG.ISLAND_PEAK_HEIGHT}m peak`);
  assert.ok(h < CONFIG.ISLAND_PEAK_HEIGHT + CONFIG.ISLAND_HEIGHT_NOISE_AMPLITUDE, `centre height ${h} exceeds peak + noise bound`);
});

check('far out to sea, depth settles near the configured abyss depth', () => {
  const heightAt = createIslandHeightField(1);
  const farBeyond = CONFIG.ISLAND_SHELF_WIDTH + CONFIG.ISLAND_ABYSS_TRANSITION_WIDTH + 100;
  const h = heightAt(CX + CONFIG.ISLAND_RADIUS + farBeyond, CZ);
  assert.ok(
    Math.abs(h + CONFIG.ISLAND_ABYSS_DEPTH) < 1,
    `expected depth near -${CONFIG.ISLAND_ABYSS_DEPTH}m at ${farBeyond}m beyond the shelf, got ${h}`,
  );
});

check('no seam at the coastline: adjacent samples never jump more than a gentle slope would allow', () => {
  const heightAt = createIslandHeightField(1);
  const step = 1; // metre, finer than ISLAND_GRID_CELL_SIZE
  // Scan straight through the island centre, across both coastlines.
  const span = CONFIG.ISLAND_RADIUS + CONFIG.ISLAND_COAST_NOISE_AMPLITUDE + CONFIG.ISLAND_FALLOFF_WIDTH;
  let prev = heightAt(CX - span, CZ);
  let maxJump = 0;
  for (let x = -span + step; x <= span; x += step) {
    const h = heightAt(CX + x, CZ);
    maxJump = Math.max(maxJump, Math.abs(h - prev));
    prev = h;
  }
  // Steepest intended slope is the falloff band: full land-to-sea swing
  // over ISLAND_FALLOFF_WIDTH, plus the dome/noise layered on top — bound
  // generously above that, tight enough to still catch an actual seam
  // (a coded discontinuity would jump the full height range in one step).
  const plausibleMaxSlope = (CONFIG.ISLAND_PEAK_HEIGHT + CONFIG.ISLAND_ABYSS_DEPTH) / (CONFIG.ISLAND_FALLOFF_WIDTH / 4);
  assert.ok(maxJump < plausibleMaxSlope * step, `found a ${maxJump.toFixed(2)}m jump over ${step}m — looks like a seam`);
});

check('same seed is deterministic; different seeds produce different coastlines', () => {
  const a1 = createIslandHeightField(42);
  const a2 = createIslandHeightField(42);
  const b = createIslandHeightField(43);
  const probeX = CX + CONFIG.ISLAND_RADIUS * 0.7;
  const probeZ = CZ + CONFIG.ISLAND_RADIUS * 0.3;
  assert.equal(a1(probeX, probeZ), a2(probeX, probeZ), 'same seed produced different heights');
  assert.notEqual(a1(probeX, probeZ), b(probeX, probeZ), 'different seeds produced identical heights (suspiciously deterministic)');
});

check('createIsland builds a terrain mesh with valid vertex colours and at least one planted tree', () => {
  const { group, heightAt } = createIsland(7);
  assert.equal(group.children.length, 2, 'expected [terrainMesh, treesGroup]');

  const [terrain, trees] = group.children;
  const colorAttr = terrain.geometry.getAttribute('color');
  assert.ok(colorAttr, 'terrain mesh missing vertex colours');
  for (let i = 0; i < colorAttr.count; i += 37) {
    // sample, not every vertex — thousands of them, this is enough to catch a bad channel
    for (let c = 0; c < 3; c++) {
      const v = colorAttr.getComponent(i, c);
      assert.ok(v >= 0 && v <= 1, `vertex colour component out of range at ${i}: ${v}`);
    }
  }

  const [trunks, canopies] = trees.children;
  assert.ok(trunks.count > 0, 'expected at least one tree to pass the height/slope filter');
  assert.equal(trunks.count, canopies.count, 'trunk/canopy instance counts diverged');
  assert.ok(trunks.count <= CONFIG.ISLAND_TREE_ATTEMPTS, 'planted more trees than attempts made');

  assert.ok(typeof heightAt === 'function', 'expected heightAt to be exposed for later gameplay sampling');
});

console.log(`\n${passed}/${passed} assertions passed`);
