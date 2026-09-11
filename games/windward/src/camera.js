// Chase camera (games/windward/DESIGN.md): follows behind and above the
// boat, damped with dt-based exponential smoothing so it tracks framerate
// correctly instead of a fixed per-frame lerp constant.
import * as THREE from '../vendor/three/three.module.js';
import { CONFIG } from './config.js';

const _forward = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _lookAt = new THREE.Vector3();

export function updateChaseCamera(camera, boatPosition, headingRad, dt) {
  _forward.set(Math.sin(headingRad), 0, Math.cos(headingRad));

  _desired
    .copy(boatPosition)
    .addScaledVector(_forward, -CONFIG.CAMERA_DISTANCE)
    .setY(boatPosition.y + CONFIG.CAMERA_HEIGHT);

  const smoothing = 1 - Math.exp(-CONFIG.CAMERA_DAMPING_RATE * dt);
  camera.position.lerp(_desired, smoothing);

  _lookAt.copy(boatPosition).addScaledVector(_forward, CONFIG.CAMERA_LOOKAHEAD);
  camera.lookAt(_lookAt);
}
