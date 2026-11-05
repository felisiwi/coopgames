// node games/windward/src/island-look.test.js — guards the "Bohuslän" ground
// look (Look Lab port): granite leads, green only where the ground is low,
// flat-ish and sheltered, a dark wet band at the waterline, pines only in the
// green pockets, and identical results on every machine.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { scatterIslands } from './island-scatter.js';
import { createIsland, createIslandHeightField } from './island.js';
import {
  PALETTE, LAB_REF, SLOPE_CALIBRATION, GREEN_THRESHOLD, PINE_MIN_HEIGHT_M,
  vnoise, greenPocket, greenAmount, groundColor, getIslandLook, slopeAt,
} from './island-look.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

const palette = Object.fromEntries(Object.entries(PALETTE).map(([k, v]) => [k, new THREE.Color(v)]));
const dist = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
const nearestName = (c) => Object.entries(palette).sort((x, y) => dist(c, x[1]) - dist(c, y[1]))[0][0];

// Land samples of one island on a regular grid: { h, slope, x, z }.
function landSamples(island, step) {
  const p = island.params;
  const hf = createIslandHeightField(island.seed, p);
  const look = getIslandLook(island.seed, p, hf);
  const R = p.ISLAND_RADIUS + p.ISLAND_COAST_NOISE_AMPLITUDE;
  const out = [];
  for (let x = p.ISLAND_CENTER_X - R; x < p.ISLAND_CENTER_X + R; x += step) {
    for (let z = p.ISLAND_CENTER_Z - R; z < p.ISLAND_CENTER_Z + R; z += step) {
      const h = hf(x, z);
      if (h < 0.3) continue;
      out.push({ h, slope: slopeAt(hf, x, z, p.ISLAND_GRID_CELL_SIZE), x, z });
    }
  }
  return { out, look, hf, p };
}

const worlds = [1, 2, 3].map((seed) => scatterIslands(seed));
// Medium and large islands (the ones with enough land to judge), 4 per world.
const big = worlds.flatMap((isl) => isl.filter((i) => i.kind === 'medium' || i.kind === 'large').slice(0, 4));
const sampled = big.map((i) => landSamples(i, i.kind === 'large' ? 3 : 1.5));

check('granite leads: on every medium/large island most of the ground reads as granite, with meadow a minority', () => {
  const c = new THREE.Color();
  for (const s of sampled) {
    let granite = 0;
    let green = 0;
    for (const { h, slope, x, z } of s.out) {
      groundColor(h, slope, x, z, s.look, c);
      const name = nearestName(c);
      if (name === 'granite' || name === 'granite2' || name === 'streak') granite++;
      if (name === 'grass' || name === 'grass2') green++;
    }
    const g = granite / s.out.length;
    const m = green / s.out.length;
    assert.ok(g > 0.6, `granite only ${(g * 100).toFixed(0)}% of the ground`);
    assert.ok(m > 0.005 && m < 0.25, `meadow ${(m * 100).toFixed(1)}% of the ground (should be a minority, but present)`);
  }
});

check('meadow coverage matches the lab (7.5% on the lab island): mean within 4-12% across islands', () => {
  const shares = sampled.map((s) => s.out.filter(({ h, slope, x, z }) => greenAmount(h, slope, x, z, s.look) > GREEN_THRESHOLD).length / s.out.length);
  const mean = shares.reduce((a, b) => a + b, 0) / shares.length;
  console.log(`  (mean meadow share ${(mean * 100).toFixed(1)}% over ${shares.length} islands; lab ${7.5}%, calibration factor ${SLOPE_CALIBRATION})`);
  assert.ok(mean > 0.04 && mean < 0.12, `mean meadow ${(mean * 100).toFixed(1)}%`);
});

check('green only where it is low, flat-ish and sheltered — never on a dome top, a steep face, the waterline or outside a pocket', () => {
  for (const s of sampled) {
    for (const { h, slope, x, z } of s.out) {
      const g = greenAmount(h, slope, x, z, s.look);
      const hLab = h * s.look.heightScale;
      const sLab = slope * s.look.slopeScale;
      if (g > GREEN_THRESHOLD) {
        assert.ok(greenPocket(x, z) > 0.43, `green outside a sheltered pocket at (${x.toFixed(0)}, ${z.toFixed(0)})`);
        assert.ok(sLab < 0.52, `green on a steep face (lab slope ${sLab.toFixed(2)})`);
        assert.ok(h > 0.9, `green at the waterline (h ${h.toFixed(2)})`);
        assert.ok(hLab < 11, `green on a dome top (lab height ${hLab.toFixed(1)})`);
      }
      if (hLab >= 11 || sLab >= 0.52 || h <= 0.9 || greenPocket(x, z) <= 0.43) assert.ok(g < 1e-9, `green weight ${g} where a rule forbids it`);
    }
  }
});

check('the lab thresholds are applied to lab-scaled height and slope (a big steep island is not painted all granite)', () => {
  for (const s of sampled) {
    const hs = s.out.map((q) => q.h).sort((a, b) => a - b);
    const ss = s.out.map((q) => q.slope).sort((a, b) => a - b);
    const p90 = hs[Math.floor(hs.length * 0.9)];
    const med = ss[Math.floor(ss.length * 0.5)];
    assert.ok(Math.abs(p90 * s.look.heightScale - LAB_REF.heightP90) / LAB_REF.heightP90 < 0.25, `p90 height maps to ${(p90 * s.look.heightScale).toFixed(1)}, lab ${LAB_REF.heightP90}`);
    const expectedMedian = LAB_REF.slopeMedian * SLOPE_CALIBRATION;
    assert.ok(Math.abs(med * s.look.slopeScale - expectedMedian) / expectedMedian < 0.3, `median slope maps to ${(med * s.look.slopeScale).toFixed(2)}, expected ${expectedMedian.toFixed(2)}`);
  }
});

check('dark wet rock right at the waterline, pale domes up high, no sand except the odd cove', () => {
  const look = sampled[0].look;
  const c = new THREE.Color();
  for (const slope of [0.1, 0.6, 1.2]) {
    groundColor(0.2, slope, 40, 40, look, c);
    assert.ok(dist(c, palette.wet) < 1e-6, `waterline should be exactly the wet colour (slope ${slope})`);
  }
  // high up: closer to the pale granite than to wet rock or meadow
  groundColor(60, 0.4, 40, 40, look, c);
  assert.ok(['granite', 'granite2', 'streak'].includes(nearestName(c)), `a high dome reads ${nearestName(c)}`);
  // sand is rare: well under 3% of ground
  let sand = 0;
  let total = 0;
  for (const s of sampled) {
    for (const { h, slope, x, z } of s.out) {
      groundColor(h, slope, x, z, s.look, c);
      total++;
      if (nearestName(c) === 'sand') sand++;
    }
  }
  assert.ok(sand / total < 0.03, `sand ${(100 * sand / total).toFixed(2)}% of ground`);
});

check('pines stand only in the green pockets (the same rule that paints the meadow), never on bare granite or the waterline', () => {
  const m4 = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  let checked = 0;
  for (const island of big.slice(0, 6)) {
    const { group, heightAt, look } = createIsland(island.seed, island.params);
    const trunks = group.children[1].children[0];
    for (let i = 0; i < trunks.count; i++) {
      trunks.getMatrixAt(i, m4);
      pos.setFromMatrixPosition(m4);
      const h = heightAt(pos.x, pos.z);
      const g = greenAmount(h, slopeAt(heightAt, pos.x, pos.z, island.params.ISLAND_GRID_CELL_SIZE), pos.x, pos.z, look);
      assert.ok(g >= GREEN_THRESHOLD - 1e-9, `pine at (${pos.x.toFixed(0)}, ${pos.z.toFixed(0)}) on ground with green weight ${g.toFixed(2)}`);
      assert.ok(h >= PINE_MIN_HEIGHT_M, `pine at the waterline (h ${h.toFixed(2)})`);
      checked++;
    }
  }
  assert.ok(checked > 100, `only ${checked} pines to check`);
});

check('islands still get a sensible number of pines: big islands are wooded in their pockets, specks of rock are bare', () => {
  for (const isl of worlds) {
    let large = 0;
    let largeN = 0;
    let skerry = 0;
    let skerryN = 0;
    for (const i of isl) {
      if (i.kind === 'large') { large += createIsland(i.seed, i.params).group.children[1].children[0].count; largeN++; }
      if (i.kind === 'skerry') { skerry += createIsland(i.seed, i.params).group.children[1].children[0].count; skerryN++; }
    }
    assert.ok(large / largeN > 80, `large islands average ${(large / largeN).toFixed(0)} pines`);
    assert.ok(skerry / skerryN < 3, `skerries average ${(skerry / skerryN).toFixed(1)} pines (should be mostly bare rock)`);
  }
});

check('the terrain mesh is smooth (unit normals pointing up, no flatShading) with in-range vertex colours', () => {
  const island = big[0];
  const { group } = createIsland(island.seed, island.params);
  const terrain = group.children[0];
  assert.equal(terrain.material.flatShading, false, 'terrain must not be flat-shaded');
  assert.equal(terrain.material.vertexColors, true);
  const n = terrain.geometry.getAttribute('normal');
  const c = terrain.geometry.getAttribute('color');
  assert.equal(n.count, terrain.geometry.getAttribute('position').count);
  for (let i = 0; i < n.count; i += 11) {
    const len = Math.hypot(n.getX(i), n.getY(i), n.getZ(i));
    assert.ok(Math.abs(len - 1) < 1e-4, `normal ${i} length ${len}`);
    assert.ok(n.getY(i) > 0, 'normals point up');
    for (let k = 0; k < 3; k++) assert.ok(c.getComponent(i, k) >= 0 && c.getComponent(i, k) <= 1);
  }
});

check('underwater cells nobody can see are culled, but all land and shoreline is kept', () => {
  const island = big.find((i) => i.kind === 'medium');
  const { group, heightAt } = createIsland(island.seed, island.params);
  const geo = group.children[0].geometry;
  const pos = geo.getAttribute('position');
  let min = Infinity;
  for (let i = 0; i < pos.count; i++) min = Math.min(min, pos.getY(i));
  assert.ok(min > -12, `lowest kept vertex ${min.toFixed(1)} m — the deep shelf should not be built`);
  // a point just above sea level near the coast must lie under the mesh footprint (no holes): every
  // land sample's x/z falls inside the kept vertices' bounding box.
  geo.computeBoundingBox();
  const p = island.params;
  for (let a = 0; a < Math.PI * 2; a += 0.3) {
    for (let r = 0; r < p.ISLAND_RADIUS + p.ISLAND_COAST_NOISE_AMPLITUDE; r += 6) {
      const x = p.ISLAND_CENTER_X + Math.cos(a) * r;
      const z = p.ISLAND_CENTER_Z + Math.sin(a) * r;
      if (heightAt(x, z) > 0) assert.ok(x >= geo.boundingBox.min.x && x <= geo.boundingBox.max.x && z >= geo.boundingBox.min.z && z <= geo.boundingBox.max.z, 'land outside the mesh');
    }
  }
  // triangle indices are all valid and counter-clockwise from above
  const index = geo.getIndex();
  for (let t = 0; t < index.count; t += 3 * 97) {
    const [a, b, c] = [index.getX(t), index.getX(t + 1), index.getX(t + 2)];
    assert.ok(a < pos.count && b < pos.count && c < pos.count);
    const ux = pos.getX(b) - pos.getX(a);
    const uz = pos.getZ(b) - pos.getZ(a);
    const vx = pos.getX(c) - pos.getX(a);
    const vz = pos.getZ(c) - pos.getZ(a);
    assert.ok(uz * vx - ux * vz > 0, 'triangle should face up');
  }
});

check('deterministic: the noise is integer-hashed (pinned values), and repeated builds give identical meshes and pines', () => {
  // Pinned so an accidental change to the hash (which would put pines in different places on
  // different peers or after an edit) fails loudly. Pure integer maths: same on every engine.
  assert.equal(vnoise(3, 5), vnoise(3, 5));
  // (Measured 2026-11-05 from this implementation. Only +, - and * on doubles after the integer hash, so IEEE
  // arithmetic gives the same bits in V8, JavaScriptCore and SpiderMonkey.)
  assert.equal(vnoise(0, 0), 0.9497471370268613);
  assert.equal(vnoise(2.5, -7.25), 0.29575900246345554);
  assert.equal(greenPocket(100, -50), 0.5635156552423722);
  const island = big[0];
  const a = createIsland(island.seed, island.params);
  const b = createIsland(island.seed, island.params);
  assert.ok(Buffer.from(a.group.children[0].geometry.getAttribute('color').array.buffer).equals(Buffer.from(b.group.children[0].geometry.getAttribute('color').array.buffer)), 'colours differ between builds');
  assert.equal(a.group.children[1].children[0].count, b.group.children[1].children[0].count, 'pine count differs between builds');
  assert.equal(getIslandLook(island.seed, island.params, a.heightAt), a.look, 'look is cached and shared');
});

console.log(`\n${passed}/${passed} assertions passed`);
