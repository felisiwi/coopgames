// node games/windward/src/boat.test.js — guards the heading→velocity convention
// (game.js moves along (sin(heading),0,cos(heading))) against the mesh's bow
// direction (boat.js's BOW_LOCAL_DIRECTION), so a future asset swap (Batch 2)
// can't silently point the hull the wrong way again (root cause of the W0.5
// facing bug was the camera's t=0 snap, not this axis — but this is the
// invariant that bug could plausibly have been).
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { createBoatMesh, BOW_LOCAL_DIRECTION } from './boat.js';

const DEG = Math.PI / 180;
let passed = 0;

function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

check('mesh bow direction matches the forward vector used for movement, at every heading', () => {
  const boat = createBoatMesh(0xffffff);
  for (const deg of [0, 30, 90, 135, 180, -60, -170]) {
    const heading = deg * DEG;
    boat.group.rotation.y = heading;
    boat.group.updateMatrixWorld(true);

    const bowWorld = BOW_LOCAL_DIRECTION.clone()
      .applyQuaternion(boat.group.quaternion)
      .normalize();
    const forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));

    assert.ok(
      bowWorld.distanceTo(forward) < 1e-9,
      `at ${deg}deg expected bow ${forward.toArray()}, got ${bowWorld.toArray()}`,
    );
  }
});

console.log(`\n${passed}/${passed} assertions passed`);
