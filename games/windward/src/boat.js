// Boat mesh: a vendored CC0 model (games/windward/assets/LICENSE.txt) with a
// sail that swings around its mount point for trim (games/windward/DESIGN.md).
// The swing angle/side is computed by the caller (src/sail.js's leewardSign
// + the current trim) and passed to setSailAngle.
//
// Loading is async (GLTFLoader); createBoatMesh returns `group` synchronously
// so the caller can scene.add() it immediately (games/README.md's "run
// correctly from t=0"), and the model is added to `group` once it resolves.
// setSailAngle queues its last value so a call before load-complete isn't lost.
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

const loader = new GLTFLoader();
let gltfPromise = null;
function loadShipGltf() {
  if (!gltfPromise) gltfPromise = loader.loadAsync(MODEL_URL);
  return gltfPromise;
}

export function createBoatMesh(color) {
  const group = new THREE.Group();
  let sailPivot = null;
  let pendingAngle = 0;

  loadShipGltf().then((gltf) => {
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
    sail.position.set(0, 0, 0);
    hull.add(sailPivot);
    sailPivot.add(sail);
    sailPivot.rotation.y = pendingAngle;

    group.add(model);
  }).catch((err) => {
    console.error('[windward] failed to load boat model', err);
  });

  return {
    group,
    setSailAngle(angleRad) {
      pendingAngle = angleRad;
      if (sailPivot) sailPivot.rotation.y = angleRad;
    },
  };
}
