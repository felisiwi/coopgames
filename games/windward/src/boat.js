// Boat mesh: hull + mast + a sail that swings around the mast for trim
// (games/windward/DESIGN.md). The swing angle/side is computed by the
// caller (src/sail.js's leewardSign + the current trim) and passed to
// setSailAngle — this module only builds and poses geometry.
import * as THREE from '../vendor/three/three.module.js';

const HULL_LENGTH = 6;

// The mesh's bow faces local +Z. game.js drives `group.rotation.y = heading`
// and moves the boat along (sin(heading), 0, cos(heading)) — rotating local
// +Z by rotation.y=heading lands on exactly that vector, so this constant
// must stay local +Z for the mesh to visually face its direction of travel.
export const BOW_LOCAL_DIRECTION = new THREE.Vector3(0, 0, 1);

export function createBoatMesh(color) {
  const group = new THREE.Group();

  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.6, HULL_LENGTH),
    new THREE.MeshStandardMaterial({ color: 0x8a5a34 }),
  );
  hull.position.y = 0.3;
  group.add(hull);

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a2a1a }),
  );
  mast.position.set(0, 2.3, -0.5);
  group.add(mast);

  // Pivots around the mast's vertical axis; the sail sits offset from the
  // pivot along local Z so rotating the pivot swings the boom sideways.
  const sailPivot = new THREE.Group();
  sailPivot.position.set(0, 2.3, -0.5);
  group.add(sailPivot);

  const sail = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 3, 2.4),
    new THREE.MeshStandardMaterial({ color }),
  );
  sail.position.set(0, 0.2, 1.2);
  sailPivot.add(sail);

  return {
    group,
    setSailAngle(angleRad) {
      sailPivot.rotation.y = angleRad;
    },
  };
}
