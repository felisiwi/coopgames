// node games/windward/src/boat.test.js — guards the heading→velocity convention
// (game.js moves along (sin(heading),0,cos(heading))) against the mesh's bow
// direction (boat.js's BOW_LOCAL_DIRECTION), so a future asset swap (Batch 2)
// can't silently point the hull the wrong way again (root cause of the W0.5
// facing bug was the camera's t=0 snap, not this axis — but this is the
// invariant that bug could plausibly have been).
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { createBoatMesh, BOW_LOCAL_DIRECTION } from './boat.js';
import { leewardSign, angleOffWind } from './sail.js';
import { boomAngle } from './phone.js';

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

check('sail swings to leeward on every heading, and matches the phone arc', () => {
  const windFrom = 0.4;
  for (let deg = -170; deg <= 180; deg += 10) {
    const heading = deg * DEG;
    if (angleOffWind(heading, windFrom) < 25 * DEG) continue; // no-go: no sail force anyway
    const boat = createBoatMesh(0xffcc66);
    const trim = 40 * DEG;
    boat.setSailAngle(leewardSign(heading, windFrom) * trim);
    boat.group.rotation.y = heading;
    boat.group.updateMatrixWorld(true);
    const end = new THREE.Vector3();
    boat.group.getObjectByName('boom-end').getWorldPosition(end);
    // The boom end must be on the side away from the wind: opposite the wind's
    // side of the boat's centreline.
    const wind = new THREE.Vector3(Math.sin(windFrom), 0, Math.cos(windFrom));
    const fwd = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    const across = (v) => fwd.x * v.z - fwd.z * v.x; // sign = which side of the centreline
    assert.ok(Math.sign(across(end)) === -Math.sign(across(wind)), `heading ${deg}: boom on the windward side`);
    // ...and the boom end lies along the phone arc's angle.
    const a = boomAngle(heading, windFrom, trim);
    const flat = Math.atan2(end.x, end.z - 0) ;
    const mast = new THREE.Vector3(0, 0, 0.7).applyAxisAngle(new THREE.Vector3(0, 1, 0), heading);
    const rel = Math.atan2(end.x - mast.x, end.z - mast.z);
    const diff = Math.atan2(Math.sin(rel - a), Math.cos(rel - a));
    assert.ok(Math.abs(diff) < 1e-6, `heading ${deg}: boom ${rel.toFixed(3)} vs arc ${a.toFixed(3)} (flat ${flat.toFixed(2)})`);
  }
});

console.log(`\n${passed}/${passed} assertions passed`);
