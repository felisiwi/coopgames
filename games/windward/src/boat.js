// Boat mesh: a vendored CC0 model (games/windward/assets/LICENSE.txt) with a
// sail that swings around its mount point for trim (games/windward/DESIGN.md).
// The swing angle/side is computed by the caller (src/sail.js's leewardSign
// + the current trim) and passed to setSailAngle.
//
// Loading is async (GLTFLoader) and explicit: game.js calls loadBoatModel()
// once at startup (W0.6 — previously createBoatMesh() triggered the load
// itself, so merely importing/exercising this module in node, as
// boat.test.js does, threw an unhandled `fetch` rejection for the
// file:// GLTF url). createBoatMesh() returns `group` synchronously so the
// caller can scene.add() it immediately (games/README.md's "run correctly
// from t=0"); if loadBoatModel() has already been called (by any caller),
// the model is attached to `group` once it resolves. setSailAngle queues
// its last value so a call before load-complete isn't lost.
import * as THREE from '../vendor/three/three.module.js';
import { GLTFLoader } from '../vendor/three/loaders/GLTFLoader.js';

// The mesh's bow faces local +Z (verified against the source model: its hull
// tapers to a point at +Z on its bow-stern axis, wide at -Z). game.js drives
// `group.rotation.y = heading` and moves the boat along
// (sin(heading), 0, cos(heading)) — rotating local +Z by rotation.y=heading
// lands on exactly that vector, so this constant must stay local +Z.
export const BOW_LOCAL_DIRECTION = new THREE.Vector3(0, 0, 1);

const MODEL_URL = new URL('../assets/ship-small.glb', import.meta.url).href;
// The source hull measures ~8.8m along its bow-stern (Z) axis; scale to
// DESIGN.md's "boat ~6m long" target.
const MODEL_SCALE = 6 / 8.8;

// The sail-a mesh is modeled symmetric about its own mount point (local X
// spans roughly -2.2..2.2, checked against the source .glb directly) rather
// than hanging off one edge of the mast — so a pure Y-axis rotation swings
// a shape that's already centered on the pivot, which reads as a subtle
// lean rather than "the boom slung hard over to leeward" (W0.8 item 2,
// reported as "the sail only ever sits on one side"). Coupling a lateral
// slide to the rotation makes the swing unambiguous regardless of viewing
// angle: at full ease the boom's mount point itself moves this many meters
// toward the leeward side, on top of rotating.
const SAIL_SWING_OFFSET = 1.4; // meters, at full 90deg trim

let gltfPromise = null;
// Kicks off the (one-time, shared) model fetch. Call once from game.js
// before creating any boats; createBoatMesh() only attaches the result if
// this has already been called, it never starts the load itself.
export function loadBoatModel() {
  if (!gltfPromise) gltfPromise = new GLTFLoader().loadAsync(MODEL_URL);
  return gltfPromise;
}

export function createBoatMesh(color) {
  const group = new THREE.Group();
  let sailPivot = null;
  let sailMountX = 0;
  let pendingAngle = 0;

  if (gltfPromise) {
    gltfPromise.then((gltf) => {
      const model = gltf.scene.clone(true); // shares geometry/materials; only the sail's material is cloned below
      model.scale.setScalar(MODEL_SCALE);

      const hull = model.getObjectByName('ship-small');
      const sail = model.getObjectByName('sail-a');

      // Distinguish self/other by tinting the sail only (hull/flags stay the
      // model's natural colors, shared across boat instances).
      sail.material = sail.material.clone();
      sail.material.color.set(color);

      // Reparent the sail under a pivot at its mount point so rotating the
      // pivot swings the boom sideways, same trick as the W0 placeholder boat.
      sailPivot = new THREE.Group();
      sailPivot.position.copy(sail.position);
      sailMountX = sailPivot.position.x;
      sail.position.set(0, 0, 0);
      hull.add(sailPivot);
      sailPivot.add(sail);
      applySailAngle(sailPivot, sailMountX, pendingAngle);

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      group.add(model);
    }).catch((err) => {
      console.error('[windward] failed to load boat model', err);
    });
  }

  return {
    group,
    setSailAngle(angleRad) {
      pendingAngle = angleRad;
      if (sailPivot) applySailAngle(sailPivot, sailMountX, angleRad);
    },
  };
}

// Rotates the boom pivot AND slides its mount point toward the swing side
// (see SAIL_SWING_OFFSET above) — the two together read as an unmistakable
// swing to leeward, instead of a symmetric mesh quietly rotating in place.
function applySailAngle(sailPivot, mountX, angleRad) {
  sailPivot.rotation.y = angleRad;
  sailPivot.position.x = mountX + Math.sin(angleRad) * SAIL_SWING_OFFSET;
}
