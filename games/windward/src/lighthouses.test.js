// node games/windward/src/lighthouses.test.js — guards the lighthouse kit:
// every tower builds, stands on y=0, is within 15% of its game height
// (6 + 0.5 x realHeight), uses only flat Lambert materials, stays under the
// triangle budget and has exactly one glass mesh a later glow pass can find.
// Also: the list is sorted by build year and every position is on the coast.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { LIGHTHOUSES, createLighthouse, triangleCount, gameHeight } from './lighthouses.js';

const MAX_TRIS = 600;
let passed = 0;

function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

check('list is sorted by built (oldest first)', () => {
  for (let i = 1; i < LIGHTHOUSES.length; i++) {
    assert.ok(LIGHTHOUSES[i - 1].built <= LIGHTHOUSES[i].built, `${LIGHTHOUSES[i].name} out of order`);
  }
});

check('entries have the data the lab needs; names are unique', () => {
  const names = new Set();
  for (const l of LIGHTHOUSES) {
    assert.ok(!names.has(l.name), `duplicate ${l.name}`);
    names.add(l.name);
    assert.ok(Number.isInteger(l.built) && l.built >= 1700 && l.built <= 2025, `${l.name} built`);
    assert.ok(l.station === null || (Number.isInteger(l.station) && l.station < l.built), `${l.name} station`);
    assert.ok(l.realHeight > 0 && l.realHeight < 60, `${l.name} realHeight`);
    assert.ok(l.area && l.description.length > 10, `${l.name} area/description`);
  }
  assert.throws(() => createLighthouse('Nowhere'));
});

check('every lat/lon is inside Bohuslän / Göteborg', () => {
  for (const l of LIGHTHOUSES) {
    assert.ok(l.lat > 57.4 && l.lat < 59.0, `${l.name} lat ${l.lat}`);
    assert.ok(l.lon > 10.9 && l.lon < 12.0, `${l.name} lon ${l.lon}`);
  }
});

const heights = new Map();
console.log('name | built | game height | triangles');
for (const entry of LIGHTHOUSES) {
  const { name } = entry;
  const g = createLighthouse(name);
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  const height = box.max.y - box.min.y;
  const target = gameHeight(entry);
  const tris = triangleCount(g);
  heights.set(name, height);
  console.log(`   ${name} | ${entry.built} | ${height.toFixed(1)} m (target ${target}) | ${tris}`);

  check(`${name}: sits on y=0`, () => {
    assert.ok(Math.abs(box.min.y) < 0.1, `min y ${box.min.y}`);
  });
  check(`${name}: within 15% of 6 + 0.5 x ${entry.realHeight} = ${target} m`, () => {
    assert.ok(Math.abs(height - target) <= 0.15 * target, `height ${height}`);
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
  check(`${name}: exactly one lantern-glass`, () => {
    let glass = 0;
    g.traverse((o) => { if (o.name === 'lantern-glass') glass += 1; });
    assert.equal(glass, 1);
  });
}

check('height order matches real life (Pater Noster tallest, then Måseskär)', () => {
  const sorted = [...heights.entries()].sort((a, b) => b[1] - a[1]);
  assert.equal(sorted[0][0], 'Pater Noster');
  assert.ok(sorted.findIndex(([n]) => n === 'Måseskär') <= 2, 'Måseskär among the tallest');
  const h = (n) => heights.get(n);
  assert.ok(h('Pater Noster') > h('Måseskär'), 'Pater Noster > Måseskär');
  assert.ok(h('Måseskär') > h('Hållö'), 'Måseskär > Hållö');
  assert.ok(h('Stångehuvud') < h('Eggskär'), 'house lights are the smallest');
});

console.log(`${passed} checks passed`);
