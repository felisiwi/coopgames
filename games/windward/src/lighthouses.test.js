// node games/windward/src/lighthouses.test.js — guards the lighthouse kit:
// every tower builds, stands on y=0, is 12-18 game metres tall, uses only flat
// Lambert materials, stays under the triangle budget, and has a glass mesh a
// later glow pass can find.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { LIGHTHOUSES, createLighthouse, triangleCount } from './lighthouses.js';

const MIN_H = 12;
const MAX_H = 18;
const MAX_TRIS = 600;
let passed = 0;

function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

check('twelve lighthouses with real coordinates in Bohuslän', () => {
  assert.equal(LIGHTHOUSES.length, 12);
  for (const l of LIGHTHOUSES) {
    assert.ok(l.lat > 57 && l.lat < 59, `${l.name} lat`);
    assert.ok(l.lon > 10.9 && l.lon < 12, `${l.name} lon`);
    assert.ok(l.description.length > 10, `${l.name} description`);
  }
  assert.throws(() => createLighthouse('Nowhere'));
});

for (const { name } of LIGHTHOUSES) {
  const g = createLighthouse(name);
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  const height = box.max.y - box.min.y;
  const tris = triangleCount(g);
  console.log(`   ${name}: height ${height.toFixed(1)} m, ${tris} triangles`);

  check(`${name}: sits on y=0`, () => {
    assert.ok(Math.abs(box.min.y) < 0.1, `min y ${box.min.y}`);
  });
  check(`${name}: ${MIN_H}-${MAX_H} m tall`, () => {
    assert.ok(height >= MIN_H && height <= MAX_H, `height ${height}`);
  });
  check(`${name}: flat Lambert only`, () => {
    g.traverse((o) => {
      if (!o.isMesh) return;
      assert.ok(o.material instanceof THREE.MeshLambertMaterial, 'Lambert');
      assert.equal(o.material.flatShading, true, 'flatShading');
    });
  });
  check(`${name}: under ${MAX_TRIS} triangles`, () => {
    assert.ok(tris < MAX_TRIS, `${tris} triangles`);
  });
  check(`${name}: has a lantern-glass mesh`, () => {
    let glass = 0;
    g.traverse((o) => { if (o.name === 'lantern-glass') glass += 1; });
    assert.equal(glass, 1);
  });
}

console.log(`${passed} checks passed`);
