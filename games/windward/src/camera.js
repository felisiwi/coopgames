// Two camera modes, selected by CONFIG.CAMERA_MODE (games/windward/DESIGN.md):
// - 'fixed' (default, W0.5): a constant compass-bearing three-quarter view
//   that never rotates with the boat — only position translates to follow
//   it — so wind direction and the compass stay legible regardless of
//   heading.
// - 'chase': the original behind-the-boat cam, kept for comparison.
// Both are damped with dt-based exponential smoothing so they track
// framerate correctly instead of a fixed per-frame lerp constant.
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

// Constant world-space offset from boat to camera — the whole point of the
// fixed camera is that this vector never changes, so the view direction
// never rotates with the boat's heading, only translates with its position.
const _fixedOffset = new THREE.Vector3();
(function computeFixedOffset() {
  const elevation = (CONFIG.FIXED_CAMERA_ELEVATION_DEG * Math.PI) / 180;
  const azimuth = (CONFIG.FIXED_CAMERA_AZIMUTH_DEG * Math.PI) / 180;
  const groundDistance = CONFIG.FIXED_CAMERA_DISTANCE * Math.cos(elevation);
  const height = CONFIG.FIXED_CAMERA_DISTANCE * Math.sin(elevation);
  _fixedOffset.set(Math.sin(azimuth) * groundDistance, height, Math.cos(azimuth) * groundDistance);
})();
const _fixedDesired = new THREE.Vector3();

export function snapFixedCamera(camera, boatPosition) {
  _fixedDesired.copy(boatPosition).add(_fixedOffset);
  camera.position.copy(_fixedDesired);
  camera.lookAt(boatPosition);
}

export function updateFixedCamera(camera, boatPosition, dt) {
  _fixedDesired.copy(boatPosition).add(_fixedOffset);
  const smoothing = 1 - Math.exp(-CONFIG.FIXED_CAMERA_DAMPING_RATE * dt);
  camera.position.lerp(_fixedDesired, smoothing);
  camera.lookAt(boatPosition);
}
