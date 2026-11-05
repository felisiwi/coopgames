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
import { createHud, updateHud, setLegendVisible, setNotice } from './src/hud.js';
import { spawnPose } from './src/spawn.js';
import { partnerState } from './src/partner.js';
import { placeDiscoverables, makeIsWater, bothNear, distanceToVisit } from './src/discover.js';
import { createPropForDiscoverable, createFlare, createBuilding } from './src/props.js';
import { placeSettlements } from './src/settlements.js';
import { wantsPhoneControls, createPhoneControls } from './src/phone.js';
import { createWater, seaHeightCPU, SIZE as WATER_SIZE } from './src/water.js';
import { createWindArrow } from './src/windArrow.js';
import { createScatter } from './src/scatter.js';
import { createIsland } from './src/island.js';
import { scatterIslands, cameraViewWidth, gridPitch, windowOccupancy } from './src/island-scatter.js';
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
  // Phones: cap render resolution (a 3x screen is 9x the pixels for little
  // visible gain on flat shapes).
  const isPhone = wantsPhoneControls();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isPhone ? CONFIG.PHONE_MAX_PIXEL_RATIO : Infinity));
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

  // Debug wireframe (I3b, 2026-09-16, index.html's ?wire=1, shared/ART.md's
  // one-facet-scale rule) — a 4m GridHelper as a screen ruler, boat-centred
  // and snapped to true world-space 4m multiples (independent of the
  // water tile's own lattice, so the grid reads as an exact reference
  // rather than drifting with whatever spacing the wave shader needs).
  // forceWireframe() (called every frame, below) is what actually turns
  // every mesh's material wireframe-on — trees/boats can still be created
  // or finish loading after this point (async GLTF, lazy otherBoat).
  let wireGrid = null;
  if (CONFIG.DEBUG_WIREFRAME) {
    const cell = CONFIG.DEBUG_WIREFRAME_GRID_CELL;
    wireGrid = new THREE.GridHelper(WATER_SIZE, Math.round(WATER_SIZE / cell), 0xff00ff, 0xff00ff);
    wireGrid.position.y = 0.05; // just above sea level, avoid z-fighting with the water surface
    scene.add(wireGrid);
  }

  // Forces every mesh's material wireframe-on, called every frame below so
  // it also catches meshes created/loaded after this point (async boat
  // GLTF, lazily-created otherBoat) — cheap enough for a debug-only path.
  function forceWireframe() {
    scene.traverse((child) => {
      if (!child.material) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of materials) {
        if (m && 'wireframe' in m) m.wireframe = true;
      }
    });
  }

  scene.add(createScatter(seed));
  const scatteredIslands = scatterIslands(seed);
  // Debug: confirm placement/reachability at a glance without hunting for
  // specks in the rendered scene (Felix, 2026-09-16 — "I need to know
  // whether they're being placed where I can reach them, not whether
  // they're lit"). `kind` is starter/large/medium/skerry — island-scatter.js's
  // scatterIslands.
  console.table(
    scatteredIslands.map((island, i) => ({
      i,
      kind: island.kind,
      seed: island.seed,
      x: Math.round(island.params.ISLAND_CENTER_X),
      z: Math.round(island.params.ISLAND_CENTER_Z),
      radius: Math.round(island.params.ISLAND_RADIUS),
      distFromSpawn: Math.round(Math.hypot(island.params.ISLAND_CENTER_X, island.params.ISLAND_CENTER_Z)),
    })),
  );
  // Aggregate density readout (I2, 2026-09-16, third pass) — VIEW/pitch and
  // a windowed-occupancy histogram (VIEW x VIEW windows), not mean
  // nearest-neighbour distance: that metric hid the "one island, empty sea"
  // problem the first two placement designs actually had (a few close pairs
  // pull the mean down while most of the world stays empty) — config.js's
  // Island scattering comment has the measurement.
  {
    const view = cameraViewWidth();
    const { histogram, median, totalWindows } = windowOccupancy(scatteredIslands, CONFIG.ISLAND_SCATTER_AREA, view);
    console.log(
      `island-scatter: VIEW=${view.toFixed(1)}m pitch=${gridPitch().toFixed(1)}m placed=${scatteredIslands.length} span=${CONFIG.ISLAND_SCATTER_AREA}m ` +
        `windows(${view.toFixed(0)}m, n=${totalWindows}): 0=${histogram.pct0.toFixed(1)}% 1=${histogram.pct1.toFixed(1)}% 2=${histogram.pct2.toFixed(1)}% 3+=${histogram.pct3plus.toFixed(1)}% median=${median}`,
    );
  }
  for (const island of scatteredIslands) {
    scene.add(createIsland(island.seed, island.params).group);
  }

  // Stage 2: discoverables — seeded, identical on both peers, so only
  // "found" events cross the wire. Found only when BOTH boats are near
  // (CONFIG.DISCOVER_REQUIRE_BOTH; the solo dev entry turns it off).
  const discoverables = placeDiscoverables(scatteredIslands, seed, makeIsWater(scatteredIslands));
  const props = new Map();
  for (const d of discoverables) {
    const prop = createPropForDiscoverable(d);
    scene.add(prop.group);
    scene.add(prop.ring);
    props.set(d.id, prop);
  }
  const found = new Set();

  // Settlements: scenery cottages and boathouses, seeded like the finds and
  // kept clear of them (src/settlements.js).
  for (const b of placeSettlements(scatteredIslands, seed, discoverables)) scene.add(createBuilding(b));

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

  // Stage 1: spawn facing across the wind at ideal trim (src/spawn.js) —
  // previously fixed east/west, sheeted in, and ~1 in 8 seeds started
  // stuck in the no-go zone.
  const self = { ...spawnPose(seed, role), speed: 0 };
  const other = { x: null, z: null, heading: 0, speed: 0 };
  let otherLastPosAtS = null; // for partnerState() (src/partner.js)
  let partnerLeftAtS = null; // when the "friend left" notice started
  // Key legend stays up until the player has both steered and trimmed.
  let hasSteered = false;
  let hasTrimmed = false;

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
    // Piggyback the full found list on the host's wind heartbeat, so a guest
    // who joins late (drop-in) or missed a 'found' catches up.
    if (found.size) net.send({ type: 'found-all', ids: [...found] });
  }

  // One notice line at a time (src/hud.js setNotice); `kind` lets a
  // situation clear only its own notice.
  const notice = { text: null, untilS: 0, kind: null };
  function showNotice(text, seconds, kind) {
    notice.text = text;
    notice.untilS = performance.now() / 1000 + seconds;
    notice.kind = kind;
  }

  function markFound(id) {
    if (found.has(id) || !props.has(id)) return;
    found.add(id);
    props.get(id).setFound(true);
    const d = discoverables.find((x) => x.id === id);
    showNotice(`Discovered: ${d.label} (${found.size}/${discoverables.length})`, 4, 'found');
  }

  // Pings: a flare at the pinging boat plus a dot on both compass roses.
  const pings = []; // { flare, startS, x, z, fromFriend }
  let lastPingS = -Infinity;
  function addPing(x, z, fromFriend) {
    const flare = createFlare(x, z);
    scene.add(flare.object);
    pings.push({ flare, startS: performance.now() / 1000, x, z, fromFriend });
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
      otherLastPosAtS = performance.now() / 1000;
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
    } else if (msg.type === 'found' && role === 'guest') {
      markFound(msg.id);
    } else if (msg.type === 'found-all' && role === 'guest' && Array.isArray(msg.ids)) {
      for (const id of msg.ids) if (!found.has(id)) { found.add(id); props.get(id)?.setFound(true); }
    } else if (msg.type === 'ping') {
      addPing(msg.x, msg.z, true);
      showNotice('Your friend pinged — follow the gold dot on the compass', 3, 'ping');
    } else if (msg.type === 'wind' && role === 'guest') {
      if (msg.seq > windSeq) {
        wind = { dir: msg.dir, strength: msg.strength };
        windSeq = msg.seq;
      }
    }
  });

  const input = createInputState();

  function doPing() {
    const nowS = performance.now() / 1000;
    if (nowS - lastPingS < CONFIG.PING_COOLDOWN_S) return;
    lastPingS = nowS;
    addPing(self.x, self.z, false);
    net.send({ type: 'ping', x: self.x, z: self.z });
  }
  function onKeyDown(e) {
    if (e.code !== 'Space' || e.repeat) return;
    e.preventDefault(); // no page scroll
    doPing();
  }
  window.addEventListener('keydown', onKeyDown);

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

  // Phone controls (src/phone.js): hold to aim, second-thumb sheet, arc,
  // wind at the boat. The corner HUD and keyboard legend are hidden there.
  const phone = isPhone ? createPhoneControls({ canvas, camera, onPing: () => doPing() }) : null;
  if (phone) {
    for (const el of [hud.rose, hud.text, hud.bar, hud.legend]) el.style.display = 'none';
    hud.notice.style.bottom = '44px';
    windArrow.object.visible = false; // the no-go wedge + streaks show the wind instead
  }

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

    phone?.apply(self, wind, dt);
    if (input.left || input.right) hasSteered = true;
    if (input.up || input.down) hasTrimmed = true;
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

    // Stage 1: a partner who stops sending 'pos' has left (src/partner.js).
    // Remove their boat rather than leave it frozen; a new 'pos' recreates
    // it via the lazy path in onMessage (drop-in play).
    if (otherBoat && partnerState(otherLastPosAtS, nowS) === 'left') {
      scene.remove(otherBoat.group);
      scene.remove(otherWake.group);
      otherBoat = null;
      otherWake = null;
      other.x = null;
      partnerLeftAtS = nowS;
      showNotice('Your friend has left. Keep sailing, or close the tab.', CONFIG.PARTNER_LEFT_NOTICE_S, 'left');
    }
    if (partnerLeftAtS !== null && partnerState(otherLastPosAtS, nowS) === 'present') {
      if (notice.kind === 'left') notice.untilS = 0; // they're back
      partnerLeftAtS = null;
    }

    // Stage 2: discovery. The host decides (one authority, no races) and
    // tells the guest; the guest only applies 'found' messages.
    const partnerPos = otherBoat && other.x !== null ? other : null;
    for (const d of discoverables) {
      if (found.has(d.id)) continue;
      const selfNear = distanceToVisit(d, self.x, self.z) <= CONFIG.DISCOVER_RADIUS;
      if (!selfNear) continue;
      const together = CONFIG.DISCOVER_REQUIRE_BOTH ? bothNear(d, self, partnerPos) : true;
      if (together && role === 'host') {
        markFound(d.id);
        net.send({ type: 'found', id: d.id });
      } else if (!together && (notice.kind === 'alone' || nowS >= notice.untilS)) {
        showNotice(`${d.label} — bring your friend here to discover it`, 0.3, 'alone');
      }
    }

    // Pings: animate, expire.
    for (let i = pings.length - 1; i >= 0; i--) {
      const t = (nowS - pings[i].startS) / CONFIG.PING_DURATION_S;
      if (t >= 1) {
        scene.remove(pings[i].flare.object);
        pings[i].flare.dispose();
        pings.splice(i, 1);
      } else {
        pings[i].flare.update(t);
      }
    }
    setNotice(hud, nowS < notice.untilS ? notice.text : null);

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

    if (wireGrid) {
      const cell = CONFIG.DEBUG_WIREFRAME_GRID_CELL;
      wireGrid.position.x = Math.round(selfBoat.group.position.x / cell) * cell;
      wireGrid.position.z = Math.round(selfBoat.group.position.z / cell) * cell;
      forceWireframe();
    }

    if (isFixedCamera) {
      updateFixedCamera(camera, selfBoat.group.position, dt, zoom);
    } else {
      updateChaseCamera(camera, selfBoat.group.position, self.heading, dt, zoom);
    }
    sky.update(camera);
    sunGlow.update(camera);
    if (!phone) setLegendVisible(hud, !(hasSteered && hasTrimmed));
    const bearingTo = (x, z) => Math.atan2(x - self.x, z - self.z);
    const friendPing = [...pings].reverse().find((p) => p.fromFriend);
    updateHud(hud, wind, self.trim, idealTrimRad(angleOffWind(self.heading, wind.dir)), self.heading, self.speed, {
      foundText: `found ${found.size}/${discoverables.length}`,
      partnerBearing: partnerPos ? bearingTo(partnerPos.x, partnerPos.z) : null,
      pingBearing: friendPing ? bearingTo(friendPing.x, friendPing.z) : null,
    });

    renderer.render(scene, camera);
    phone?.draw(nowS, {
      partner: partnerPos,
      pings,
      foundText: `found ${found.size}/${discoverables.length}`,
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.addEventListener('beforeunload', () => {
    clearInterval(posInterval);
    window.removeEventListener('resize', resize);
    canvas.removeEventListener('wheel', onWheel);
    window.removeEventListener('keydown', onKeyDown);
    phone?.destroy();
    input.destroy();
  });
}
