// Cheap wake (games/windward/DESIGN.md, W0.5 Batch 3): a fixed pool of
// fading/growing foam disks spawned behind the boat while it's moving,
// reused round-robin instead of allocated/disposed per spawn.
import * as THREE from '../vendor/three/three.module.js';
import { CONFIG } from './config.js';

export function createWake() {
  const group = new THREE.Group();
  const pool = [];
  for (let i = 0; i < CONFIG.WAKE_POOL_SIZE; i++) {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(1, 10),
      new THREE.MeshBasicMaterial({ color: 0xf2fbff, transparent: true, opacity: 0, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    group.add(mesh);
    pool.push({ mesh, age: Infinity, baseScale: 1 });
  }
  let nextSlot = 0;
  let sinceSpawn = 0;

  function spawn(x, z, speed) {
    const slot = pool[nextSlot];
    nextSlot = (nextSlot + 1) % pool.length;
    slot.age = 0;
    slot.baseScale = 0.4 + Math.min(1, speed / CONFIG.MAX_SPEED) * 1.2;
    slot.mesh.position.set(x, 0.05, z);
    slot.mesh.visible = true;
  }

  function update(dt, boatPosition, headingRad, speed) {
    sinceSpawn += dt;
    if (speed > 0.3 && sinceSpawn >= CONFIG.WAKE_SPAWN_INTERVAL_S) {
      sinceSpawn = 0;
      const sternX = boatPosition.x - Math.sin(headingRad) * CONFIG.WAKE_STERN_OFFSET;
      const sternZ = boatPosition.z - Math.cos(headingRad) * CONFIG.WAKE_STERN_OFFSET;
      spawn(sternX, sternZ, speed);
    }

    for (const slot of pool) {
      if (slot.age === Infinity) continue;
      slot.age += dt;
      const t = slot.age / CONFIG.WAKE_LIFETIME_S;
      if (t >= 1) {
        slot.age = Infinity;
        slot.mesh.visible = false;
        continue;
      }
      slot.mesh.scale.setScalar(slot.baseScale * (0.6 + t * 1.2));
      slot.mesh.material.opacity = 0.5 * (1 - t);
    }
  }

  return { group, update };
}
