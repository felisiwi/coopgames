// node games/windward/src/shoal-look.test.js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from '../vendor/three/three.module.js';
import { shoalLook, buildShoalList, shoalHit, createShoalLayer, SHOAL_MIN_R_M } from './shoal-look.js';
import { HULL_RADIUS_M } from './shore.js';

const shoals = JSON.parse(readFileSync(fileURLToPath(new URL('../assets/coast/shoals.json', import.meta.url)), 'utf8')).shoals;
let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }

check('every one of the 292 shoals gets a look: foam for awash / dry / named, dark for everything under the water', () => {
  assert.ok(shoals.length > 250);
  for (const s of shoals) {
    const l = shoalLook(s);
    assert.ok(['foam', 'dark'].includes(l.look), s.id);
    assert.ok(l.visualRadiusM > 0 && l.collisionRadiusM > 0 && l.collisionRadiusM < l.visualRadiusM, `${s.id} radii`);
    assert.ok(l.opacity > 0 && l.opacity <= 1 && l.slow > 0 && l.slow <= 1);
    const above = (s.kind === 'rock' && (s.level === 'awash' || s.level === 'dry')) || s.kind === 'named_shoal';
    assert.equal(l.look, above ? 'foam' : 'dark', `${s.id} ${s.kind} ${s.level}`);
    assert.equal(l.blocks, l.look === 'foam', 'foam rocks block (hard), dark ones are soft');
    if (l.look === 'foam') assert.ok(l.innerRadiusM > 0 && l.innerRadiusM < l.visualRadiusM); else assert.equal(l.innerRadiusM, 0);
  }
});

check('the severity order: dry >= awash > shallow submerged > submerged > unknown, in collision radius and slowdown', () => {
  const r = (level, extra = {}) => shoalLook({ kind: 'rock', level, ...extra });
  assert.ok(r('dry').collisionRadiusM >= r('awash').collisionRadiusM);
  assert.ok(r('awash').collisionRadiusM > r('covers').collisionRadiusM);
  assert.ok(r('covers').collisionRadiusM > r('submerged').collisionRadiusM);
  assert.ok(r('submerged', { depthM: 1 }).collisionRadiusM > r('submerged').collisionRadiusM, 'a known shallow depth is worse');
  assert.ok(r('submerged', { depthM: 1 }).slow < r('submerged').slow);
  assert.ok(r('unknown').opacity < r('submerged').opacity, 'unknown depth is drawn faintest');
  assert.ok(r('submerged', { depthM: 4 }).collisionRadiusM === r('submerged').collisionRadiusM, 'deep enough: no extra');
});

check('named shoals use the OSM outline (x10 real->game, x3 exaggeration, at least the minimum); wrecks and obstructions are soft', () => {
  const small = shoalLook({ kind: 'named_shoal', name: 'x', radiusM: 3 }), big = shoalLook({ kind: 'named_shoal', name: 'y', radiusM: 40 });
  assert.equal(small.collisionRadiusM, SHOAL_MIN_R_M);
  assert.ok(Math.abs(big.collisionRadiusM - 12) < 1e-9, `40 m -> ${big.collisionRadiusM}`);
  assert.ok(big.visualRadiusM > big.collisionRadiusM);
  const w = shoalLook({ kind: 'wreck', radiusM: 9 }), o = shoalLook({ kind: 'obstruction' });
  assert.ok(!w.blocks && !o.blocks && w.look === 'dark' && o.look === 'dark');
  assert.throws(() => shoalLook({ kind: 'dragon' }), /unknown shoal kind/);
});

check('shoalHit: the rock radius plus the hull decides; deepest overlap wins; a clear boat gets null', () => {
  const list = buildShoalList([
    { id: 'a', kind: 'rock', level: 'awash', lat: 0, lon: 0 },
    { id: 'b', kind: 'rock', level: 'submerged', lat: 0, lon: 0 },
  ], (lon, lat) => [lon * 100 + (lat > 0 ? 0 : 0), 0]);
  list[0].x = 0; list[0].z = 0; list[1].x = 20; list[1].z = 0;
  const reachA = list[0].look.collisionRadiusM + HULL_RADIUS_M; // awash: 2.4 + 2.5
  assert.ok(shoalHit(list, reachA - 0.3, 0), 'just inside the reach: hit');
  assert.equal(shoalHit(list, reachA + 0.3, 0), null, 'just outside: clear');
  const hit = shoalHit(list, 0.5, 0);
  assert.ok(hit.blocks && hit.item === list[0] && hit.depth > 4);
  const soft = shoalHit(list, 20.5, 0);
  assert.ok(!soft.blocks && soft.slow < 1 && soft.item === list[1]);
  assert.equal(shoalHit(list, 0, 50), null);
  assert.ok(shoalHit(list, reachA + 0.3, 0, 4), 'a bigger hull reaches further');
});

check('every real shoal: one tap of the hit test at its own position finds it (look and collision agree)', () => {
  const list = buildShoalList(shoals, (lon, lat) => [(lon - 11.25) * 58693, (58.3 - lat) * 111195].map((v) => v / 10));
  for (let i = 0; i < list.length; i += 7) {
    const h = shoalHit(list, list[i].x, list[i].z);
    assert.ok(h && h.depth > 0, list[i].shoal.id);
  }
});

check('the layer: instanced foam rings + granite stubs + dark patches, soft edges (vertex alpha), no lights, surf breathes', () => {
  const list = buildShoalList(shoals, (lon, lat) => [(lon - 11.25) * 5869, (58.3 - lat) * 11119]);
  const layer = createShoalLayer(list);
  const foamN = list.filter((s) => s.look.look === 'foam').length, darkN = list.filter((s) => s.look.look === 'dark').length;
  assert.equal(layer.foamCount, foamN); assert.equal(layer.darkCount, darkN);
  assert.equal(foamN + darkN, shoals.length);
  const by = (n) => layer.group.getObjectByName(n);
  assert.equal(by('shoal-foam').count, foamN); assert.equal(by('shoal-rocks').count, foamN); assert.equal(by('shoal-dark').count, darkN);
  for (const n of ['shoal-foam', 'shoal-dark']) {
    const g = by(n).geometry.attributes.color;
    assert.equal(g.itemSize, 4, 'rgba vertex colours');
    let min = 1, max = 0; for (let i = 0; i < g.count; i++) { min = Math.min(min, g.getW(i)); max = Math.max(max, g.getW(i)); }
    assert.ok(min < 0.01 && max > 0.99, `${n} fades from 1 to 0 (${min}..${max})`);
  }
  layer.group.traverse((o) => assert.ok(!o.isLight));
  layer.update(0); const a = by('shoal-foam').material.opacity; layer.update(1.5); assert.notEqual(by('shoal-foam').material.opacity, a);
  const mat = new THREE.Matrix4(); by('shoal-foam').getMatrixAt(0, mat);
  const first = list.find((s) => s.look.look === 'foam');
  assert.ok(Math.abs(mat.elements[12] - first.x) < 1e-3 && Math.abs(mat.elements[14] - first.z) < 1e-3, 'instance 0 sits on its rock');
  layer.dispose();
});

console.log(`\n${passed} checks passed`);
