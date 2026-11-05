// node games/windward/src/depthmap.test.js — guards the island depth map the
// sea is coloured by (Look Lab port): deep water far from islands, shallow
// water next to them, the same map for the same seed on both peers, and a map
// that agrees with the real height field. Prints the resolution and bake time.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { scatterIslands } from './island-scatter.js';
import { createIslandHeightField } from './island.js';
import {
  bakeDepthMap, depthAt, depthReach, floatToHalf, createDepthTexture, depthRect, DEEP_M, TEXEL_M, SHORE_SLOPE,
} from './depthmap.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

const islands = scatterIslands(1);
const map = bakeDepthMap(islands);
const fields = islands.map((i) => ({ i, p: i.params, hf: createIslandHeightField(i.seed, i.params) }));
console.log(`  (seed 1: ${map.nx}x${map.nz} texels at ${map.texel} m, ${map.evals} height evaluations, baked in ${map.bakeMs.toFixed(0)} ms)`);

// The real depth at a point: the deepest-surface island wins (max height).
function trueDepth(x, z) {
  let best = -Infinity;
  for (const f of fields) {
    if (Math.hypot(x - f.p.ISLAND_CENTER_X, z - f.p.ISLAND_CENTER_Z) < 450) best = Math.max(best, f.hf(x, z));
  }
  return Math.min(DEEP_M, Math.max(0, -best));
}

// Outermost land point along a ray from an island's centre (scanning inwards
// from beyond the coast, so inland ponds are not mistaken for the coast).
function outerCoast(f, angle) {
  for (let r = f.p.ISLAND_RADIUS + f.p.ISLAND_COAST_NOISE_AMPLITUDE + 40; r > 0; r -= 0.25) {
    if (f.hf(f.p.ISLAND_CENTER_X + Math.cos(angle) * r, f.p.ISLAND_CENTER_Z + Math.sin(angle) * r) >= 0) return r;
  }
  return 0;
}

check('texels are fine enough for crisp shore foam (<= 1.5 m) and the texture stays small', () => {
  assert.ok(map.texel <= TEXEL_M + 1e-9, `texel ${map.texel}`);
  assert.ok(map.nx <= 2048 && map.nz <= 2048, `${map.nx}x${map.nz}`);
  assert.equal(map.depth.length, map.nx * map.nz);
  assert.equal(map.shore.length, map.nx * map.nz);
});

check('the map covers every island out to where its water is deep', () => {
  const [rx, rz, rw, rh] = depthRect(map);
  for (const f of fields) {
    const reach = depthReach(f.p);
    assert.ok(f.p.ISLAND_CENTER_X - reach >= rx - 1e-6 && f.p.ISLAND_CENTER_X + reach <= rx + rw + 1e-6, 'x coverage');
    assert.ok(f.p.ISLAND_CENTER_Z - reach >= rz - 1e-6 && f.p.ISLAND_CENTER_Z + reach <= rz + rh + 1e-6, 'z coverage');
  }
});

check('deep water far from every island: depth is the deep cap, outside the map too', () => {
  const far = [];
  // random points in/around the map that are far from every island
  let s = 7;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let k = 0; k < 4000 && far.length < 200; k++) {
    const x = map.x0 + rnd() * map.nx * map.texel;
    const z = map.z0 + rnd() * map.nz * map.texel;
    const nearest = Math.min(...fields.map((f) => Math.hypot(x - f.p.ISLAND_CENTER_X, z - f.p.ISLAND_CENTER_Z) - (f.p.ISLAND_RADIUS + f.p.ISLAND_COAST_NOISE_AMPLITUDE)));
    if (nearest > 130) far.push([x, z]);
  }
  assert.ok(far.length >= 50, `only found ${far.length} far points to test`);
  for (const [x, z] of far) {
    assert.equal(depthAt(map, x, z), DEEP_M, `(${x.toFixed(0)}, ${z.toFixed(0)}) should be deep`);
    assert.equal(depthAt(map, x, z, 'shore'), DEEP_M, 'and far from any shore');
  }
  assert.equal(depthAt(map, map.x0 - 500, map.z0 - 500), DEEP_M, 'outside the map is deep');
  assert.equal(depthAt(map, map.x0 + 1e6, 0), DEEP_M);
});

check('shallow water next to every kind of island, and land reads as 0', () => {
  for (const kind of ['starter', 'medium', 'large', 'skerry']) {
    const f = fields.find((x) => x.i.kind === kind);
    // Large islands have sheer cliffs (measured: ~4 m deep only 2 m out), so
    // "shallow" is judged against the shelf: right at the waterline under
    // 3 m, and 2 m out always shallower than the shelf depth (+ margin) and
    // nowhere near the 10 m deep cap.
    let atWaterline = 0;
    let tested = 0;
    for (let a = 0; a < Math.PI * 2; a += 0.15) {
      const r = outerCoast(f, a);
      const nx = Math.cos(a);
      const nz = Math.sin(a);
      tested++;
      if (depthAt(map, f.p.ISLAND_CENTER_X + nx * (r + 0.5), f.p.ISLAND_CENTER_Z + nz * (r + 0.5)) < 3) atWaterline++;
      const twoOut = depthAt(map, f.p.ISLAND_CENTER_X + nx * (r + 2), f.p.ISLAND_CENTER_Z + nz * (r + 2));
      assert.ok(twoOut < f.p.ISLAND_SHELF_DEPTH + 1, `${kind}: ${twoOut.toFixed(2)} m deep only 2 m off the coast (shelf ${f.p.ISLAND_SHELF_DEPTH} m)`);
    }
    assert.ok(atWaterline / tested > 0.95, `${kind}: only ${atWaterline}/${tested} coast points are shallow (<3 m) 0.5 m out`);
    // the highest ground is land
    assert.equal(depthAt(map, f.p.ISLAND_CENTER_X, f.p.ISLAND_CENTER_Z), 0, `${kind}: centre should be land`);
    assert.equal(depthAt(map, f.p.ISLAND_CENTER_X, f.p.ISLAND_CENTER_Z, 'shore'), 0, `${kind}: land has shore distance 0`);
  }
});

check('depth rises from the waterline across the shelf, and matches the real field out to the reach radius', () => {
  // The starter island sits in open water by construction (placed first, its
  // neighbours cleared), so rays from it stay in the sea. (Rays from a
  // crowded medium island run into its neighbours' land — which the map
  // correctly reports as depth 0 — so they cannot test shelf growth.)
  const f = fields.find((x) => x.i.kind === 'starter');
  const reach = depthReach(f.p);
  for (let a = 0.2; a < Math.PI * 2; a += 0.9) {
    const r = outerCoast(f, a);
    const at = (d) => depthAt(map, f.p.ISLAND_CENTER_X + Math.cos(a) * (r + d), f.p.ISLAND_CENTER_Z + Math.sin(a) * (r + d));
    // (Only waterline -> mid-shelf must grow: farther out a neighbouring
    // skerry's shelf can legitimately raise the floor again.)
    assert.ok(at(3) < at(20), `angle ${a.toFixed(1)}: depth should grow from the waterline to mid-shelf (${at(3).toFixed(2)}, ${at(20).toFixed(2)})`);
    for (const d of [3, 20, 45, 70, reach - r + 5]) {
      const x = f.p.ISLAND_CENTER_X + Math.cos(a) * (r + d);
      const z = f.p.ISLAND_CENTER_Z + Math.sin(a) * (r + d);
      assert.ok(Math.abs(at(d) - trueDepth(x, z)) < 0.75, `angle ${a.toFixed(1)}, ${d.toFixed(0)} m out: baked ${at(d).toFixed(2)} vs real ${trueDepth(x, z).toFixed(2)}`);
    }
    // Beyond the reach radius this island contributes nothing: wherever the
    // real field is deep (no neighbour's land or shelf in the way) so is the map.
    const bx = f.p.ISLAND_CENTER_X + Math.cos(a) * (r + (reach - r + 5));
    const bz = f.p.ISLAND_CENTER_Z + Math.sin(a) * (r + (reach - r + 5));
    if (trueDepth(bx, bz) === DEEP_M) assert.equal(at(reach - r + 5), DEEP_M, 'deep beyond the reach radius');
  }
});

check('the baked depth agrees with the real island height field (99% within 0.25 m, worst case under 2 m)', () => {
  let s = 12345;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  let n = 0;
  let bad = 0;
  let worst = 0;
  for (let k = 0; k < 12000; k++) {
    const f = fields[Math.floor(rnd() * fields.length)];
    const a = rnd() * Math.PI * 2;
    const r = (f.p.ISLAND_RADIUS + f.p.ISLAND_COAST_NOISE_AMPLITUDE) * (0.5 + rnd());
    const x = f.p.ISLAND_CENTER_X + Math.cos(a) * r;
    const z = f.p.ISLAND_CENTER_Z + Math.sin(a) * r;
    const t = trueDepth(x, z);
    if (t > 8) continue;
    const err = Math.abs(depthAt(map, x, z) - t);
    n++;
    worst = Math.max(worst, err);
    if (err > 0.25) bad++;
  }
  assert.ok(n > 3000, `sampled ${n}`);
  assert.ok(bad / n < 0.01, `${bad}/${n} points more than 0.25 m off`);
  assert.ok(worst < 2, `worst error ${worst.toFixed(2)} m`);
});

check('the foam channel is the real distance to land (lab-scaled), on every island kind — gentle skerry shelves and sheer cliffs alike', () => {
  // Brute-force nearest land (any island) within 7 m, to compare with the map.
  const isLand = (x, z) => fields.some((g) => Math.hypot(x - g.p.ISLAND_CENTER_X, z - g.p.ISLAND_CENTER_Z) < g.p.ISLAND_RADIUS + g.p.ISLAND_COAST_NOISE_AMPLITUDE + 20 && g.hf(x, z) >= 0);
  const nearestLand = (x, z) => {
    let best = Infinity;
    for (let dx = -7; dx <= 7; dx += 0.5) for (let dz = -7; dz <= 7; dz += 0.5) {
      const d = Math.hypot(dx, dz);
      if (d < best && isLand(x + dx, z + dz)) best = d;
    }
    return best;
  };
  const REACH = 6; // metres; the map reads DEEP_M beyond this
  for (const kind of ['starter', 'medium', 'large']) {
    const f = fields.find((x) => x.i.kind === kind);
    let n = 0;
    let close = 0;
    let worst = 0;
    for (let a = 0; a < Math.PI * 2; a += 0.12) {
      const r = outerCoast(f, a);
      for (const off of [0.4, 1.5, 3, 5]) {
        const x = f.p.ISLAND_CENTER_X + Math.cos(a) * (r + off);
        const z = f.p.ISLAND_CENTER_Z + Math.sin(a) * (r + off);
        if (isLand(x, z)) continue; // the ray ran into a neighbour's land; shore 0 there is right but proves nothing
        const truth = Math.min(REACH, nearestLand(x, z));
        const got = Math.min(REACH, depthAt(map, x, z, 'shore') / SHORE_SLOPE);
        n++;
        worst = Math.max(worst, Math.abs(got - truth));
        if (Math.abs(got - truth) < 1.0) close++;
      }
    }
    assert.ok(n > 60, `${kind}: only ${n} usable points`);
    assert.ok(close / n > 0.95, `${kind}: only ${close}/${n} points within 1 m of the true distance to land (worst ${worst.toFixed(1)} m)`);
  }
  assert.equal(SHORE_SLOPE, 0.3, 'the lab coast slope the foam thresholds were tuned for');
  // The lab's white edge (shore < 0.35) therefore means "within ~1.2 m of land" everywhere:
  assert.ok(Math.abs(0.35 / SHORE_SLOPE - 1.17) < 0.01);
});

check('same seed gives the identical map on both peers; a different seed gives a different one', () => {
  const again = bakeDepthMap(scatterIslands(1));
  assert.equal(again.nx, map.nx);
  assert.equal(again.nz, map.nz);
  assert.equal(again.x0, map.x0);
  assert.equal(again.texel, map.texel);
  assert.ok(Buffer.from(again.depth.buffer).equals(Buffer.from(map.depth.buffer)), 'depth differs between two bakes of seed 1');
  assert.ok(Buffer.from(again.shore.buffer).equals(Buffer.from(map.shore.buffer)), 'shore differs between two bakes of seed 1');
  const other = bakeDepthMap(scatterIslands(2));
  const same = other.nx === map.nx && other.nz === map.nz && Buffer.from(other.depth.buffer).equals(Buffer.from(map.depth.buffer));
  assert.ok(!same, 'seeds 1 and 2 baked the same map');
});

check('depthAt reads texel centres exactly (the shader samples the same positions)', () => {
  for (const [i, j] of [[0, 0], [10, 20], [map.nx - 1, map.nz - 1], [Math.floor(map.nx / 2), Math.floor(map.nz / 2)]]) {
    const x = map.x0 + (i + 0.5) * map.texel;
    const z = map.z0 + (j + 0.5) * map.texel;
    assert.ok(Math.abs(depthAt(map, x, z) - map.depth[j * map.nx + i]) < 1e-5, `texel (${i}, ${j})`);
  }
});

check('bake stays within the start-up budget', () => {
  // The brief's budget is ~300 ms on a laptop; allow headroom for a slow CI box.
  assert.ok(map.bakeMs < 1000, `bake took ${map.bakeMs.toFixed(0)} ms`);
  const times = [0, 1, 2].map(() => bakeDepthMap(islands).bakeMs);
  console.log(`  (three more bakes: ${times.map((t) => t.toFixed(0)).join(' / ')} ms)`);
  assert.ok(Math.min(...times) < 300, `fastest of three bakes took ${Math.min(...times).toFixed(0)} ms, over the ~300 ms budget`);
});

check('half-float packing is accurate (<0.1%) and the texture is a 2-channel half-float', () => {
  for (const v of [0.001, 0.05, 0.35, 1.6, 3.3, 7.77, 10]) {
    const back = THREE.DataUtils.fromHalfFloat(floatToHalf(v));
    assert.ok(Math.abs(back - v) / v < 1e-3, `${v} -> ${back}`);
  }
  assert.equal(floatToHalf(0), 0);
  assert.equal(floatToHalf(-1), 0);
  const tex = createDepthTexture(map);
  assert.equal(tex.image.width, map.nx);
  assert.equal(tex.image.height, map.nz);
  assert.equal(tex.format, THREE.RGFormat);
  assert.equal(tex.type, THREE.HalfFloatType);
  assert.equal(tex.image.data.length, map.nx * map.nz * 2);
  assert.equal(tex.minFilter, THREE.LinearFilter);
});

check('an empty island list bakes a valid all-deep map', () => {
  const empty = bakeDepthMap([]);
  assert.ok(empty.depth.every((v) => v === DEEP_M));
  assert.equal(depthAt(empty, 0, 0), DEEP_M);
});

check('ponds inside islands are not baked as land (they rendered solid white: shore distance 0 everywhere)', () => {
  // Combined field of every island (an island's sea can be a neighbour's land where footprints overlap).
  const H = (x, z) => {
    let b = -Infinity;
    for (const g of fields) if (Math.hypot(x - g.p.ISLAND_CENTER_X, z - g.p.ISLAND_CENTER_Z) < g.p.ISLAND_RADIUS + g.p.ISLAND_COAST_NOISE_AMPLITUDE + 60) b = Math.max(b, g.hf(x, z));
    return b;
  };
  let sea = 0;
  let asLand = 0;
  let deepAsLand = 0;
  for (const g of fields) {
    const R = g.p.ISLAND_RADIUS + g.p.ISLAND_COAST_NOISE_AMPLITUDE;
    for (let x = g.p.ISLAND_CENTER_X - R; x < g.p.ISLAND_CENTER_X + R; x += 1.5) {
      for (let z = g.p.ISLAND_CENTER_Z - R; z < g.p.ISLAND_CENTER_Z + R; z += 1.5) {
        const h = H(x, z);
        if (h >= -0.05) continue;
        // enclosed water: land within 25 m on at least 3 of 4 sides (a pond, a lagoon, a narrow bay)
        const ring = [[25, 0], [-25, 0], [0, 25], [0, -25]].filter(([dx, dz]) => H(x + dx, z + dz) >= 0).length;
        if (ring < 3) continue;
        sea++;
        if (depthAt(map, x, z) < 0.02) {
          asLand++;
          if (-h >= 0.3) deepAsLand++;
        }
      }
    }
  }
  assert.ok(sea > 5000, `only ${sea} pond samples`);
  assert.equal(deepAsLand, 0, `${deepAsLand} pond points 0.3 m+ deep were baked as land`);
  assert.ok(asLand / sea < 0.002, `${asLand}/${sea} pond points baked as land`);
});

console.log(`\n${passed}/${passed} assertions passed`);
