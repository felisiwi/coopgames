// Seeded reference-object scatter (games/windward/DESIGN.md, W0.5 Batch 3):
// throwaway buoys/rocks so movement reads against something — W1 replaces
// this with real islands. Same seed on both peers (games/README.md's world
// must be identical on both) since it's derived from the session `seed`,
// not net traffic.
import * as THREE from '../vendor/three/three.module.js';
import { CONFIG } from './config.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BUOY_COLORS = [0xff5533, 0xffcc33];

// MeshLambertMaterial + flatShading, not MeshStandardMaterial (shared/ART.md's
// Materials rule: no PBR metalness, no specular highlights).
function createBuoy(rand, index) {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6),
    new THREE.MeshLambertMaterial({ color: 0x333333, flatShading: true }),
  );
  pole.position.y = 0.8;
  pole.castShadow = true;
  pole.receiveShadow = true;
  const float = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 6),
    new THREE.MeshLambertMaterial({ color: BUOY_COLORS[index % BUOY_COLORS.length], flatShading: true }),
  );
  float.position.y = 1.5;
  float.castShadow = true;
  float.receiveShadow = true;
  group.add(pole, float);
  return group;
}

function createRock(rand) {
  const rock = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.7 + rand() * 0.7, 0),
    new THREE.MeshLambertMaterial({ color: 0x776f64, flatShading: true }),
  );
  rock.castShadow = true;
  rock.receiveShadow = true;
  return rock;
}

// XOR'd off `seed` so this scatter's stream doesn't collide with wind.js's
// use of the same seed for initial wind.
export function createScatter(seed) {
  const rand = mulberry32((seed ^ 0x51ed270b) >>> 0);
  const group = new THREE.Group();
  const half = CONFIG.SCATTER_AREA / 2;

  for (let i = 0; i < CONFIG.SCATTER_COUNT; i++) {
    const isRock = rand() < 0.4;
    const object = isRock ? createRock(rand) : createBuoy(rand, i);
    object.position.x = (rand() * 2 - 1) * half;
    object.position.z = (rand() * 2 - 1) * half;
    if (isRock) object.position.y = 0.2;
    group.add(object);
  }

  return group;
}
