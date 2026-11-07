// The sail-feel lab's THREE-side effects: bow spray, a wake that grows with speed, and the camera that dips and tightens
// with speed (docs/ALIVE-SEA.md decision 14). The numbers live in sail-feel-model.js (FEEL) so they are tested and tunable.
import * as THREE from '../vendor/three/three.module.js';
import { CONFIG } from './config.js';
import { FEEL, cameraFeel, smoothShare, wakeSize, wakeLife } from './sail-feel-model.js';

const DEG = Math.PI / 180;

// ---- bow spray: a fixed pool of droplets thrown up and out from the bow, falling back under gravity ----
export function createSpray(max = 96) {
  const geometry = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3).fill(-9999);
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const material = new THREE.PointsMaterial({ color: 0xffffff, size: FEEL.SPRAY_SIZE_M, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.name = 'bow-spray';
  const p = Array.from({ length: max }, () => ({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }));
  let next = 0;
  let carry = 0;
  return {
    points,
    // rate: droplets per second (sprayRate()); boat: {x, y, z}; heading in radians; speed m/s
    update(dt, boat, heading, speed, rate) {
      carry += rate * dt;
      const fx = Math.sin(heading); const fz = Math.cos(heading);
      const rx = Math.cos(heading); const rz = -Math.sin(heading);
      while (carry >= 1) {
        carry -= 1;
        const d = p[next]; next = (next + 1) % max;
        const side = Math.random() < 0.5 ? -1 : 1;
        d.life = FEEL.SPRAY_LIFE_S * (0.7 + 0.6 * Math.random());
        d.x = boat.x + fx * 2.8 + rx * side * 0.5; d.y = boat.y + 0.35; d.z = boat.z + fz * 2.8 + rz * side * 0.5;
        const out = FEEL.SPRAY_SIDE_MS * (0.5 + Math.random());
        d.vx = fx * speed * 0.35 + rx * side * out; d.vz = fz * speed * 0.35 + rz * side * out;
        d.vy = FEEL.SPRAY_UP_MS * (0.6 + 0.8 * Math.random());
      }
      for (let i = 0; i < max; i++) {
        const d = p[i];
        if (d.life > 0) {
          d.life -= dt;
          d.vy -= 9.8 * dt;
          d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
          if (d.life <= 0 || d.y < boat.y - 0.2) { d.life = 0; pos[i * 3 + 1] = -9999; continue; }
          pos[i * 3] = d.x; pos[i * 3 + 1] = d.y; pos[i * 3 + 2] = d.z;
        } else pos[i * 3 + 1] = -9999;
      }
      geometry.attributes.position.needsUpdate = true;
    },
  };
}

// ---- wake: foam disks left behind the stern; bigger, brighter and longer-lived the faster you go ----
export function createFeelWake(pool = 48) {
  const group = new THREE.Group();
  group.name = 'feel-wake';
  const disks = [];
  for (let i = 0; i < pool; i++) {
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 12), new THREE.MeshBasicMaterial({ color: 0xf2fbff, transparent: true, opacity: 0, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    group.add(mesh);
    disks.push({ mesh, age: Infinity, life: 1, size: 1 });
  }
  let next = 0;
  let since = 0;
  return {
    group,
    update(dt, boat, heading, speed) {
      since += dt;
      const every = 0.1 / (0.6 + Math.min(1.2, speed / FEEL.CAM_SPEED_FULL_MS)); // faster = denser
      if (speed > FEEL.WAKE_FROM_MS && since >= every) {
        since = 0;
        const d = disks[next]; next = (next + 1) % pool;
        d.age = 0; d.life = wakeLife(speed); d.size = wakeSize(speed);
        d.mesh.position.set(boat.x - Math.sin(heading) * CONFIG.WAKE_STERN_OFFSET, boat.y + 0.06, boat.z - Math.cos(heading) * CONFIG.WAKE_STERN_OFFSET);
        d.mesh.visible = true;
      }
      for (const d of disks) {
        if (d.age === Infinity) continue;
        d.age += dt;
        const t = d.age / d.life;
        if (t >= 1) { d.age = Infinity; d.mesh.visible = false; continue; }
        d.mesh.scale.setScalar(d.size * (0.5 + t * 1.3));
        d.mesh.material.opacity = FEEL.WAKE_OPACITY * (1 - t) * (1 - t * 0.3);
      }
    },
  };
}

// ---- the camera: the game's fixed rig (north up, same angle and distance), plus the speed feel ----
// speed up: the camera drops lower, moves closer, and looks ahead of the bow; slow: it pulls back and centres on the boat.
const AHEAD_SIDE_M = 6; // metres of look-ahead allowed sideways per unit of zoom
const AHEAD_DOWN_M = 7; // and toward the bottom of the screen
// How far the view may slide ahead of the boat without losing it: lots up the screen (north: the screen is tall), a little sideways and down
// (a portrait phone is narrow, and there is little sea below the boat). Measured at 500 x 757: half-width ~ 30 m, bottom ~ 28 m at zoom 1.
// Returns { x, z } in game metres, to add to the boat's position. Shared by the lab's camera and the game's.
export function lookAheadVector(heading, lookM, zoom, out = { x: 0, z: 0 }) {
  const lx = Math.max(-AHEAD_SIDE_M * zoom, Math.min(AHEAD_SIDE_M * zoom, Math.sin(heading) * lookM));
  const lzRaw = Math.cos(heading) * lookM; // negative = north = up the screen
  out.x = lx;
  out.z = lzRaw > AHEAD_DOWN_M * zoom ? AHEAD_DOWN_M * zoom : lzRaw;
  return out;
}
export function createFeelCamera(camera) {
  const ahead = new THREE.Vector3(); // how far the view has slid ahead of the boat (smoothed)
  const aheadTarget = new THREE.Vector3();
  const focus = new THREE.Vector3();
  const desired = new THREE.Vector3();
  let share = 0;
  function place(boat, heading, zoom, f, dt, snap) {
    const la = lookAheadVector(heading, f.lookAheadM, zoom);
    aheadTarget.set(la.x, 0, la.z);
    if (snap) ahead.copy(aheadTarget); else ahead.lerp(aheadTarget, 1 - Math.exp(-2 * dt));
    focus.set(boat.x + ahead.x, boat.y, boat.z + ahead.z);
    const elev = (CONFIG.FIXED_CAMERA_ELEVATION_DEG - f.elevDropDeg) * DEG;
    const az = CONFIG.FIXED_CAMERA_AZIMUTH_DEG * DEG;
    const dist = CONFIG.FIXED_CAMERA_DISTANCE * zoom * f.distMul;
    desired.set(focus.x + Math.sin(az) * Math.cos(elev) * dist, focus.y + Math.sin(elev) * dist, focus.z + Math.cos(az) * Math.cos(elev) * dist);
    if (snap) camera.position.copy(desired); else camera.position.lerp(desired, 1 - Math.exp(-CONFIG.FIXED_CAMERA_DAMPING_RATE * dt));
    camera.lookAt(focus);
  }
  return {
    snap(boat, heading, zoom = 1) { share = 0; place(boat, heading, zoom, cameraFeel(0), 0, true); },
    update(dt, boat, heading, speed, { zoom = 1, dip = true, look = true } = {}) {
      share = smoothShare(share, speed, dt);
      place(boat, heading, zoom, cameraFeel(share, { dip, look }), dt, false);
    },
    share: () => share,
    get ahead() { return ahead; },
  };
}
