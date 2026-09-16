// Contract entry point (games/README.md). The hub (or the solo dev entry in
// this folder's index.html) calls this directly; it never imports PeerJS or
// shared/net.js itself — `net` is handed in.
//
// W0 Batch 2: boat, wind, tacking, 20 Hz sync (games/windward/DESIGN.md).
// Must run correctly with zero remote players from t=0 and pick up a guest
// connecting at any later moment (games/README.md's "Drop-in play").
import * as THREE from './vendor/three/three.module.js';
import { CONFIG } from './src/config.js';
import { boatSpeed, idealTrimRad, angleOffWind, leewardSign } from './src/sail.js';
import { initialWind, createWindController, stepWindController } from './src/wind.js';
import { createBoatMesh, loadBoatModel } from './src/boat.js';
import { updateChaseCamera, snapChaseCamera, updateFixedCamera, snapFixedCamera } from './src/camera.js';
import { createHud, updateHud } from './src/hud.js';
import { createWater, seaHeightCPU } from './src/water.js';
import { createWindArrow } from './src/windArrow.js';
import { createScatter } from './src/scatter.js';
import { createIsland } from './src/island.js';
import { createWake } from './src/wake.js';
import { createSky } from './src/sky.js';
import { createSunGlow } from './src/sunGlow.js';
import { createInputState } from '../../shared/input.js';

// Bobs and tilts a boat on the wave surface (W0.6, games/windward/DESIGN.md).
// `seaHeightCPU` (src/water.js) is the JS mirror of the water shader's vertex
// displacement, so the boat sits exactly on the sea it's drawn against.
// Pitch/roll come from a finite-difference gradient of that same function
// sampled a short distance ahead/right of the boat, clamped so a steep local
// slope can't flip it.
function bobBoat(group, x, z, headingRad, nowS, wind) {
  const eps = CONFIG.BOAT_TILT_GRADIENT_EPS;
  const fwd = { x: Math.sin(headingRad), z: Math.cos(headingRad) };
  const right = { x: Math.cos(headingRad), z: -Math.sin(headingRad) };

  const y = seaHeightCPU(x, z, nowS, wind.dir, wind.strength);
  const yFwd = seaHeightCPU(x + fwd.x * eps, z + fwd.z * eps, nowS, wind.dir, wind.strength);
  const yRight = seaHeightCPU(x + right.x * eps, z + right.z * eps, nowS, wind.dir, wind.strength);

  const slopeForward = (yFwd - y) / eps;
  const slopeRight = (yRight - y) / eps;
  const max = CONFIG.BOAT_TILT_MAX;

  group.position.y = y;
  group.rotation.x = Math.min(max, Math.max(-max, -slopeForward * CONFIG.BOAT_TILT_GAIN));
  group.rotation.z = Math.min(max, Math.max(-max, slopeRight * CONFIG.BOAT_TILT_GAIN));
}

// Eases self.speed toward the sail model's instantaneous target
// (src/sail.js's boatSpeed) at CONFIG.SAIL_FORCE m/s^2 when speeding up,
// CONFIG.DRAG m/s^2 when shedding speed, instead of snapping to a new speed
// the instant heading/trim/wind changes — gives the boat some weight (W0.8
// item 3).
function approachSpeed(current, target, dt) {
  const diff = target - current;
  const rate = diff >= 0 ? CONFIG.SAIL_FORCE : CONFIG.DRAG;
  const step = Math.sign(diff) * Math.min(Math.abs(diff), rate * dt);
  return current + step;
}

export default function start({ canvas, net, seed, role }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const sky = createSky();
  scene.add(sky.mesh);

  const isFixedCamera = CONFIG.CAMERA_MODE === 'fixed';
  const cameraFov = isFixedCamera ? CONFIG.FIXED_CAMERA_FOV_DEG : CONFIG.CHASE_CAMERA_FOV_DEG;
  const camera = new THREE.PerspectiveCamera(cameraFov, 1, 0.1, 2000);

  // Golden-hour lighting (2026-09-16 pass, shared/ART.md): warm low sun,
  // cool-tinted HemisphereLight fill so shadowed faces read blue against
  // golden lit ones. Low elevation (CONFIG.LIGHT_ELEVATION_DEG) so the
  // sea's flat-shaded facets actually vary in brightness and shadows run
  // long — a near-overhead light barely shades small facet tilts.
  scene.add(new THREE.HemisphereLight(CONFIG.HEMI_SKY_COLOR, CONFIG.HEMI_GROUND_COLOR, CONFIG.HEMI_INTENSITY));
  const sun = new THREE.DirectionalLight(CONFIG.SUN_COLOR, CONFIG.SUN_INTENSITY);
  const lightAz = (CONFIG.LIGHT_AZIMUTH_DEG * Math.PI) / 180;
  const lightEl = (CONFIG.LIGHT_ELEVATION_DEG * Math.PI) / 180;
  // Same azimuth/elevation as before, kept as a constant offset (not an
  // absolute position) so updateSunPosition() below can re-anchor it to the
  // boat every frame instead of the light staying fixed near world origin
  // while the boat sails away from it.
  const sunOffset = new THREE.Vector3(
    Math.sin(lightAz) * Math.cos(lightEl),
    Math.sin(lightEl),
    Math.cos(lightAz) * Math.cos(lightEl),
  ).multiplyScalar(20);

  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 500;
  sun.shadow.camera.left = -150;
  sun.shadow.camera.right = 150;
  sun.shadow.camera.top = 150;
  sun.shadow.camera.bottom = -150;
  sun.shadow.radius = 4; // blur, for "soft"
  sun.shadow.bias = CONFIG.SUN_SHADOW_BIAS; // reduce acne at the low elevation
  scene.add(sun);
  scene.add(sun.target); // target must be in the scene graph for its matrixWorld to update

  const sunGlow = createSunGlow();
  scene.add(sunGlow.sprite);

  // Keeps the shadow frustum (fixed size, boat-centred) travelling with the
  // boat instead of drifting out of range as it sails from spawn.
  function updateSunPosition(boatPosition) {
    sun.position.copy(boatPosition).add(sunOffset);
    sun.target.position.copy(boatPosition);
  }

  const water = createWater();
  scene.add(water.mesh);

  scene.add(createScatter(seed));
  scene.add(createIsland(seed).group);

  const windArrow = createWindArrow();
  scene.add(windArrow.object);

  loadBoatModel(); // once, before any createBoatMesh() call (self or lazy other)

  const selfColor = role === 'host' ? 0xffcc66 : 0x66ccff;
  const otherColor = role === 'host' ? 0x66ccff : 0xffcc66;

  const selfBoat = createBoatMesh(selfColor);
  scene.add(selfBoat.group);
  const selfWake = createWake();
  scene.add(selfWake.group);
  let otherBoat = null; // created lazily on the peer's first 'pos' (drop-in play)
  let otherWake = null; // created alongside otherBoat

  const self = {
    x: role === 'host' ? -CONFIG.BOAT_SPAWN_OFFSET : CONFIG.BOAT_SPAWN_OFFSET,
    z: 0,
    heading: role === 'host' ? Math.PI / 2 : -Math.PI / 2,
    trim: 0,
    speed: 0,
  };
  const other = { x: null, z: null, heading: 0, speed: 0 };

  // --- wind: seed-derived until the first real message, host-authoritative
  // after that (games/windward/DESIGN.md's "Net contract gap" section).
  // Host runs a hold/transition state machine (src/wind.js's
  // stepWindController); the guest only ever applies incoming 'wind'
  // messages, never runs its own timer (W0.8: replaces the old instant
  // snap-to-new-wind with a gradual ease, see DESIGN.md's "Wind" section).
  const nowS0 = performance.now() / 1000;
  let windController = role === 'host' ? createWindController(seed, nowS0) : null;
  let wind = role === 'host' ? windController.current : initialWind(seed);
  let windSeq = role === 'host' ? 0 : -1; // guest applies any real message (seq >= 0)
  let heardFromPeer = false;
  let windHeartbeatAt = nowS0 + CONFIG.WIND_HEARTBEAT_S; // hold-phase resend cadence
  let windTransitionSendAt = nowS0; // transition-phase resend cadence (faster, so the guest eases too)

  function sendWind() {
    windSeq += 1;
    net.send({ type: 'wind', dir: wind.dir, strength: wind.strength, seq: windSeq });
  }

  net.onMessage((msg) => {
    if (!msg || typeof msg !== 'object') return;

    if (!heardFromPeer) {
      heardFromPeer = true;
      // Covers a late/already-connected guest without relying on
      // net.onConnect, which games don't have (games/README.md's contract
      // is send/onMessage/peerId/isHost only).
      if (role === 'host') sendWind();
    }

    if (msg.type === 'pos') {
      other.x = msg.x;
      other.z = msg.z;
      other.heading = msg.heading;
      other.speed = msg.speed;
      if (!otherBoat) {
        otherBoat = createBoatMesh(otherColor);
        scene.add(otherBoat.group);
        otherWake = createWake();
        scene.add(otherWake.group);
      }
    } else if (msg.type === 'wind' && role === 'guest') {
      if (msg.seq > windSeq) {
        wind = { dir: msg.dir, strength: msg.strength };
        windSeq = msg.seq;
      }
    }
  });

  const input = createInputState();

  let zoom = 1;
  function onWheel(e) {
    e.preventDefault();
    zoom = Math.min(CONFIG.ZOOM_MAX, Math.max(CONFIG.ZOOM_MIN, zoom + e.deltaY * CONFIG.ZOOM_WHEEL_SENSITIVITY));
  }
  canvas.addEventListener('wheel', onWheel, { passive: false });

  const posInterval = setInterval(() => {
    net.send({
      type: 'pos',
      x: self.x,
      z: self.z,
      heading: self.heading,
      speed: self.speed,
      ts: Date.now(),
    });
  }, 1000 / CONFIG.NET_SEND_HZ);

  function resize() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  const hud = createHud(canvas);

  selfBoat.group.position.set(self.x, 0, self.z);
  selfBoat.group.rotation.y = self.heading;
  updateSunPosition(selfBoat.group.position);
  if (isFixedCamera) {
    snapFixedCamera(camera, selfBoat.group.position, zoom);
  } else {
    snapChaseCamera(camera, selfBoat.group.position, self.heading, zoom);
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const nowS = now / 1000;

    if (role === 'host') {
      const prevPhase = windController.phase;
      windController = stepWindController(windController, nowS);
      wind = windController.current;
      const justChangedPhase = windController.phase !== prevPhase;

      if (windController.phase === 'transition') {
        if (justChangedPhase || nowS >= windTransitionSendAt) {
          windTransitionSendAt = nowS + CONFIG.WIND_TRANSITION_SEND_INTERVAL_S;
          windHeartbeatAt = nowS + CONFIG.WIND_HEARTBEAT_S;
          sendWind();
        }
      } else if (justChangedPhase || nowS >= windHeartbeatAt) {
        windHeartbeatAt = nowS + CONFIG.WIND_HEARTBEAT_S;
        sendWind();
      }
    }

    if (input.left) self.heading -= CONFIG.TURN_RATE * dt;
    if (input.right) self.heading += CONFIG.TURN_RATE * dt;
    if (input.up) self.trim = Math.max(CONFIG.TRIM_MIN, self.trim - CONFIG.TRIM_RATE * dt);
    if (input.down) self.trim = Math.min(CONFIG.TRIM_MAX, self.trim + CONFIG.TRIM_RATE * dt);

    const targetSpeed = boatSpeed(self.heading, wind.dir, wind.strength, self.trim);
    self.speed = approachSpeed(self.speed, targetSpeed, dt);
    self.x += Math.sin(self.heading) * self.speed * dt;
    self.z += Math.cos(self.heading) * self.speed * dt;

    selfBoat.group.position.set(self.x, 0, self.z);
    selfBoat.group.rotation.y = self.heading;
    bobBoat(selfBoat.group, self.x, self.z, self.heading, nowS, wind);
    selfBoat.setSailAngle(leewardSign(self.heading, wind.dir) * self.trim);
    selfWake.update(dt, selfBoat.group.position, self.heading, self.speed);
    updateSunPosition(selfBoat.group.position);

    if (otherBoat && other.x !== null) {
      otherBoat.group.position.set(other.x, 0, other.z);
      otherBoat.group.rotation.y = other.heading;
      bobBoat(otherBoat.group, other.x, other.z, other.heading, nowS, wind);
      // Trim isn't synced (DESIGN.md) — approximate the other boat's sail
      // with the ideal trim for its current point of sail.
      const otherIdeal = idealTrimRad(angleOffWind(other.heading, wind.dir));
      otherBoat.setSailAngle(leewardSign(other.heading, wind.dir) * otherIdeal);
      otherWake.update(dt, otherBoat.group.position, other.heading, other.speed);
    }

    water.update(nowS, wind, selfBoat.group.position);
    windArrow.update(selfBoat.group.position, wind);

    if (isFixedCamera) {
      updateFixedCamera(camera, selfBoat.group.position, dt, zoom);
    } else {
      updateChaseCamera(camera, selfBoat.group.position, self.heading, dt, zoom);
    }
    sky.update(camera);
    sunGlow.update(camera);
    updateHud(hud, wind, self.trim, idealTrimRad(angleOffWind(self.heading, wind.dir)), self.heading, self.speed);

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.addEventListener('beforeunload', () => {
    clearInterval(posInterval);
    window.removeEventListener('resize', resize);
    canvas.removeEventListener('wheel', onWheel);
    input.destroy();
  });
}
