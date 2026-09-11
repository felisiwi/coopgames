// Chase camera (games/windward/DESIGN.md): follows behind and above the
// boat, damped with dt-based exponential smoothing so it tracks framerate
// correctly instead of a fixed per-frame lerp constant.
import * as THREE from '../vendor/three/three.module.js';
import { CONFIG } from './config.js';

const _forward = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _lookAt = new THREE.Vector3();

function chaseTargets(boatPosition, headingRad) {
  _forward.set(Math.sin(headingRad), 0, Math.cos(headingRad));
  _desired
    .copy(boatPosition)
    .addScaledVector(_forward, -CONFIG.CAMERA_DISTANCE)
    .setY(boatPosition.y + CONFIG.CAMERA_HEIGHT);
  _lookAt.copy(boatPosition).addScaledVector(_forward, CONFIG.CAMERA_LOOKAHEAD);
}

// Three.js cameras default to (0,0,0). Without this, the first frames render
// with the camera still there before the lerp below catches up — for a boat
// that spawns facing back toward world origin (as the host does), that reads
// as the bow pointing straight at the camera instead of the camera sitting
// behind the boat. Call once at setup so frame 1 already shows the correct
// chase framing.
export function snapChaseCamera(camera, boatPosition, headingRad) {
  chaseTargets(boatPosition, headingRad);
  camera.position.copy(_desired);
  camera.lookAt(_lookAt);
}

export function updateChaseCamera(camera, boatPosition, headingRad, dt) {
  chaseTargets(boatPosition, headingRad);

  const smoothing = 1 - Math.exp(-CONFIG.CAMERA_DAMPING_RATE * dt);
  camera.position.lerp(_desired, smoothing);
  camera.lookAt(_lookAt);
}
