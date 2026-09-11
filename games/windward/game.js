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
import { initialWind, nextWind, nextChangeDelaySeconds } from './src/wind.js';
import { createBoatMesh } from './src/boat.js';
import { updateChaseCamera, snapChaseCamera } from './src/camera.js';
import { createHud, updateHud } from './src/hud.js';
import { createInputState } from '../../shared/input.js';

export default function start({ canvas, net, seed, role }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x89c4f4);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(5, 10, 5);
  scene.add(sun);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshStandardMaterial({ color: 0x2d6ea6 }),
  );
  water.rotation.x = -Math.PI / 2;
  scene.add(water);

  const selfColor = role === 'host' ? 0xffcc66 : 0x66ccff;
  const otherColor = role === 'host' ? 0x66ccff : 0xffcc66;

  const selfBoat = createBoatMesh(selfColor);
  scene.add(selfBoat.group);
  let otherBoat = null; // created lazily on the peer's first 'pos' (drop-in play)

  const self = {
    x: role === 'host' ? -CONFIG.BOAT_SPAWN_OFFSET : CONFIG.BOAT_SPAWN_OFFSET,
    z: 0,
    heading: role === 'host' ? Math.PI / 2 : -Math.PI / 2,
    trim: 0,
    speed: 0,
  };
  const other = { x: null, z: null, heading: 0, speed: 0 };

  // --- wind: seed-derived until the first real message, host-authoritative
  // after that (games/windward/DESIGN.md's "Net contract gap" section) ---
  let wind = initialWind(seed);
  let windSeq = role === 'host' ? 0 : -1; // guest applies any real message (seq >= 0)
  let heardFromPeer = false;
  let windChangeAt = performance.now() / 1000 + nextChangeDelaySeconds();
  let windHeartbeatAt = performance.now() / 1000 + CONFIG.WIND_HEARTBEAT_S;

  function sendWind() {
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
      }
    } else if (msg.type === 'wind' && role === 'guest') {
      if (msg.seq > windSeq) {
        wind = { dir: msg.dir, strength: msg.strength };
        windSeq = msg.seq;
      }
    }
  });

  const input = createInputState();

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
  snapChaseCamera(camera, selfBoat.group.position, self.heading);

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const nowS = now / 1000;

    if (role === 'host') {
      if (nowS >= windChangeAt) {
        windSeq += 1;
        wind = nextWind();
        windChangeAt = nowS + nextChangeDelaySeconds();
        windHeartbeatAt = nowS + CONFIG.WIND_HEARTBEAT_S;
        sendWind();
      } else if (nowS >= windHeartbeatAt) {
        windHeartbeatAt = nowS + CONFIG.WIND_HEARTBEAT_S;
        sendWind();
      }
    }

    if (input.left) self.heading -= CONFIG.TURN_RATE * dt;
    if (input.right) self.heading += CONFIG.TURN_RATE * dt;
    if (input.up) self.trim = Math.max(CONFIG.TRIM_MIN, self.trim - CONFIG.TRIM_RATE * dt);
    if (input.down) self.trim = Math.min(CONFIG.TRIM_MAX, self.trim + CONFIG.TRIM_RATE * dt);

    self.speed = boatSpeed(self.heading, wind.dir, wind.strength, self.trim);
    self.x += Math.sin(self.heading) * self.speed * dt;
    self.z += Math.cos(self.heading) * self.speed * dt;

    selfBoat.group.position.set(self.x, 0, self.z);
    selfBoat.group.rotation.y = self.heading;
    selfBoat.setSailAngle(leewardSign(self.heading, wind.dir) * self.trim);

    if (otherBoat && other.x !== null) {
      otherBoat.group.position.set(other.x, 0, other.z);
      otherBoat.group.rotation.y = other.heading;
      // Trim isn't synced (DESIGN.md) — approximate the other boat's sail
      // with the ideal trim for its current point of sail.
      const otherIdeal = idealTrimRad(angleOffWind(other.heading, wind.dir));
      otherBoat.setSailAngle(leewardSign(other.heading, wind.dir) * otherIdeal);
    }

    updateChaseCamera(camera, selfBoat.group.position, self.heading, dt);
    updateHud(hud, wind, self.trim, idealTrimRad(angleOffWind(self.heading, wind.dir)));

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.addEventListener('beforeunload', () => {
    clearInterval(posInterval);
    window.removeEventListener('resize', resize);
    input.destroy();
  });
}
