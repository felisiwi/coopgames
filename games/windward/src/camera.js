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

function chaseTargets(boatPosition, headingRad, zoom) {
  _forward.set(Math.sin(headingRad), 0, Math.cos(headingRad));
  _desired
    .copy(boatPosition)
    .addScaledVector(_forward, -CONFIG.CAMERA_DISTANCE * zoom)
    .setY(boatPosition.y + CONFIG.CAMERA_HEIGHT * zoom);
  _lookAt.copy(boatPosition).addScaledVector(_forward, CONFIG.CAMERA_LOOKAHEAD);
}

// Three.js cameras default to (0,0,0). Without this, the first frames render
// with the camera still there before the lerp below catches up — for a boat
// that spawns facing back toward world origin (as the host does), that reads
// as the bow pointing straight at the camera instead of the camera sitting
// behind the boat. Call once at setup so frame 1 already shows the correct
// chase framing.
export function snapChaseCamera(camera, boatPosition, headingRad, zoom = 1) {
  chaseTargets(boatPosition, headingRad, zoom);
  camera.position.copy(_desired);
  camera.lookAt(_lookAt);
}

export function updateChaseCamera(camera, boatPosition, headingRad, dt, zoom = 1) {
  chaseTargets(boatPosition, headingRad, zoom);

  const smoothing = 1 - Math.exp(-CONFIG.CAMERA_DAMPING_RATE * dt);
  camera.position.lerp(_desired, smoothing);
  camera.lookAt(_lookAt);
}

// Constant world-space *direction* (unit length) from boat to camera — the
// whole point of the fixed camera is that this direction never changes, so
// the view direction never rotates with the boat's heading, only translates
// with its position. Distance (and therefore zoom) is applied at call time.
const _fixedDirection = new THREE.Vector3();
(function computeFixedDirection() {
  const elevation = (CONFIG.FIXED_CAMERA_ELEVATION_DEG * Math.PI) / 180;
  const azimuth = (CONFIG.FIXED_CAMERA_AZIMUTH_DEG * Math.PI) / 180;
  const groundDistance = Math.cos(elevation);
  const height = Math.sin(elevation);
  _fixedDirection.set(Math.sin(azimuth) * groundDistance, height, Math.cos(azimuth) * groundDistance);
})();
const _fixedDesired = new THREE.Vector3();

export function snapFixedCamera(camera, boatPosition, zoom = 1) {
  _fixedDesired.copy(boatPosition).addScaledVector(_fixedDirection, CONFIG.FIXED_CAMERA_DISTANCE * zoom);
  camera.position.copy(_fixedDesired);
  camera.lookAt(boatPosition);
}

// Where the camera sits for a yaw (radians) turned round the target from the fixed azimuth: yaw 0 is the north-up view; the lighthouse relight
// (src/relight.js) turns it once round, slowly. Same distance and elevation, only the compass bearing changes.
const _yawDirection = new THREE.Vector3();
export function fixedDirectionForYaw(yaw, out = _yawDirection) {
  if (!yaw) return out.copy(_fixedDirection);
  const elevation = (CONFIG.FIXED_CAMERA_ELEVATION_DEG * Math.PI) / 180;
  const azimuth = (CONFIG.FIXED_CAMERA_AZIMUTH_DEG * Math.PI) / 180 + yaw;
  return out.set(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation));
}

// rate: how quickly the camera catches up (1/s). Faster while zooming, so the 3D view stays in step with the chart.
// yaw: extra turn round the target in radians (0 = north-up), for the lighthouse relight's slow circle.
// The same, with the camera dropped `elevDropDeg` lower (the speed feel: sail-feel-model.js cameraFeel). 0 = exactly fixedDirectionForYaw.
export function fixedDirectionFor(yaw, elevDropDeg = 0, out = _yawDirection) {
  if (!elevDropDeg) return fixedDirectionForYaw(yaw, out);
  const elevation = ((CONFIG.FIXED_CAMERA_ELEVATION_DEG - elevDropDeg) * Math.PI) / 180;
  const azimuth = (CONFIG.FIXED_CAMERA_AZIMUTH_DEG * Math.PI) / 180 + yaw;
  return out.set(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation));
}

// feel (optional): { elevDropDeg, distMul } from sail-feel-model.js cameraFeel(): the camera dips and moves in with speed. Omitted = the game's fixed rig, unchanged.
export function updateFixedCamera(camera, boatPosition, dt, zoom = 1, rate = CONFIG.FIXED_CAMERA_DAMPING_RATE, yaw = 0, feel = null) {
  _fixedDesired.copy(boatPosition).addScaledVector(feel ? fixedDirectionFor(yaw, feel.elevDropDeg) : fixedDirectionForYaw(yaw), CONFIG.FIXED_CAMERA_DISTANCE * zoom * (feel ? feel.distMul : 1));
  const smoothing = 1 - Math.exp(-rate * dt);
  camera.position.lerp(_fixedDesired, smoothing);
  camera.lookAt(boatPosition);
}
