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
import { createBoatMesh, loadBoatModel } from './src/boats.js';
import { updateChaseCamera, snapChaseCamera, updateFixedCamera, snapFixedCamera } from './src/camera.js';
import { createHud, updateHud, setLegendVisible, setNotice } from './src/hud.js';
import { spawnPose } from './src/spawn.js';
import { partnerState } from './src/partner.js';
import { placeDiscoverables, makeIsWater, bothNear, distanceToVisit } from './src/discover.js';
import { createPropForDiscoverable, createFlare, createBuilding } from './src/props.js';
import { placeSettlements } from './src/settlements.js';
import { wantsPhoneControls, createPhoneControls } from './src/phone.js';
import { createWater, seaHeightCPU, createWaveState, stepWaves, SIZE as WATER_SIZE } from './src/water.js';
import { createWindArrow } from './src/windArrow.js';
import { createScatter } from './src/scatter.js';
import { createIsland, recolorTerrain, applyIslandLook } from './src/island.js';
import { refreshPalette } from './src/island-look.js';
import { applyValues, parseLookParams } from './src/look-presets.js';
import { scatterIslands, cameraViewWidth, gridPitch, windowOccupancy } from './src/island-scatter.js';
import { bakeDepthMap } from './src/depthmap.js';
import { createWake } from './src/wake.js';
import { createSky } from './src/sky.js';
import { createSunGlow } from './src/sunGlow.js';
import { createInputState } from '../../shared/input.js';
import { createDebugOverlay } from './src/debug-overlay.js';
import { stepAlongShore, shallowFactor, SHORE_BRAKE } from './src/shore.js';
import { createNameBook } from './src/names.js';
import { createNameLabels } from './src/name-labels.js';
import { createChartController } from './src/chart-controller.js';
import { parseGameStyle } from './src/terrain-style.js';
import { createArrivals, giftFor } from './src/arrival.js';
import { createDeck } from './src/deck.js';
import { createAudio } from './src/audio.js';
import { createLife } from './src/life.js';
import { createHarbourMoment } from './src/harbour-moment.js';

// Bobs and tilts a boat on the wave surface (W0.6, games/windward/DESIGN.md).
// `seaHeightCPU` (src/water.js) is the JS mirror of the water shader's vertex
// displacement, so the boat sits exactly on the sea it's drawn against.
// Pitch/roll come from a finite-difference gradient of that same function
// sampled a short distance ahead/right of the boat, clamped so a steep local
// slope can't flip it.
function bobBoat(group, x, z, headingRad, waves, wind) {
  const eps = CONFIG.BOAT_TILT_GRADIENT_EPS;
  const fwd = { x: Math.sin(headingRad), z: Math.cos(headingRad) };
  const right = { x: Math.cos(headingRad), z: -Math.sin(headingRad) };

  const y = seaHeightCPU(x, z, waves.phases, wind.dir, wind.strength);
  const yFwd = seaHeightCPU(x + fwd.x * eps, z + fwd.z * eps, waves.phases, wind.dir, wind.strength);
  const yRight = seaHeightCPU(x + right.x * eps, z + right.z * eps, waves.phases, wind.dir, wind.strength);

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

// Entry point. The real Bohuslän coast is the default world (stage 1a); ?coast=proc keeps the old procedural
// islands (a plain synchronous start, as before). The real coast has to load its data first, so the game starts
// a moment later; src/coast-world.js is only downloaded in that case. Messages from the other player that arrive
// during the load are queued and replayed to the game, so nothing is dropped (the net contract has no way to
// unsubscribe, so one listener stays attached and forwards).
export default function start(args) {
  const q = new URLSearchParams(window.location.search);
  if (q.get('coast') === 'proc') return startGame(args, null);
  const note = document.createElement('div');
  note.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#eaf6ff;font:14px monospace;pointer-events:none;z-index:5';
  note.textContent = 'loading the coast…';
  document.body.appendChild(note);
  const queue = [];
  let live = null;
  args.net.onMessage((msg) => (live ? live(msg) : queue.push(msg)));
  const net = {
    send: (msg) => args.net.send(msg),
    onMessage: (fn) => { live = fn; for (const m of queue.splice(0)) fn(m); },
    peerId: args.net.peerId,
    isHost: args.net.isHost,
  };
  const num = (k) => (q.has(k) && Number.isFinite(Number(q.get(k))) ? Number(q.get(k)) : undefined);
  return import('./src/coast-world.js')
    .then((m) => m.loadRealCoast({ vex: num('cvex'), step: num('cstep'), smooth: num('csmooth'), seed: args.seed, style: parseGameStyle(window.location.search), at: q.has('cat') ? q.get('cat').split(',').map(Number) : undefined }))
    .then((coast) => { note.remove(); window.__coastReport = coast.report; startGame({ ...args, net }, coast); })
    .catch((err) => { note.textContent = `the coast failed to load: ${err && err.message}`; console.error(err); window.__coastError = String((err && err.stack) || err); });
}

function startGame({ canvas, net, seed, role }, coast) {
  // ?tune=1 (look pass 2): a link can carry look values (src/look-presets.js);
  // apply them over config.js BEFORE anything is built. Without tune=1 nothing
  // here runs and the panel never exists.
  const tuning = new URLSearchParams(window.location.search).get('tune') === '1';
  if (tuning) {
    applyValues(CONFIG, parseLookParams(window.location.search));
    refreshPalette();
  }
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  // ?debug=1: performance overlay (src/debug-overlay.js). Not created otherwise.
  const debugOverlay = new URLSearchParams(window.location.search).get('debug') === '1' ? createDebugOverlay(renderer) : null;
  // Phones: cap render resolution (a 3x screen is 9x the pixels for little
  // visible gain on flat shapes).
  const isPhone = wantsPhoneControls();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isPhone ? CONFIG.PHONE_MAX_PIXEL_RATIO : Infinity));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap is deprecated in this three.js (it logged a warning and fell back to this)

  const scene = new THREE.Scene();
  const sky = createSky();
  scene.add(sky.mesh);

  const isFixedCamera = CONFIG.CAMERA_MODE === 'fixed';
  const cameraFov = isFixedCamera ? CONFIG.FIXED_CAMERA_FOV_DEG : CONFIG.CHASE_CAMERA_FOV_DEG;
  // Near plane: CONFIG.CAMERA_NEAR for the fixed camera (see config.js); the
  // legacy chase cam sits ~12 m away, so it keeps 0.1. ?near=<m> overrides
  // (A/B test of the shoreline flicker: ?near=0.1 = old behaviour).
  const nearParam = parseFloat(new URLSearchParams(window.location.search).get('near'));
  const cameraNear = Number.isFinite(nearParam)
    ? Math.min(20, Math.max(0.01, nearParam))
    : (isFixedCamera ? CONFIG.CAMERA_NEAR : 0.1);
  const camera = new THREE.PerspectiveCamera(cameraFov, 1, cameraNear, 2000);

  // Golden-hour lighting (2026-09-16 pass, shared/ART.md): warm low sun,
  // cool-tinted HemisphereLight fill so shadowed faces read blue against
  // golden lit ones. Low elevation (CONFIG.LIGHT_ELEVATION_DEG) so the
  // sea's flat-shaded facets actually vary in brightness and shadows run
  // long — a near-overhead light barely shades small facet tilts.
  const hemi = new THREE.HemisphereLight(CONFIG.HEMI_SKY_COLOR, CONFIG.HEMI_GROUND_COLOR, CONFIG.HEMI_INTENSITY);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(CONFIG.SUN_COLOR, CONFIG.SUN_INTENSITY);
  // The sun is kept as a constant offset (not an absolute position) so
  // updateSunPosition() below can re-anchor it to the boat every frame.
  // Recomputed by setSunOffset() when the tuning panel changes the elevation.
  const sunOffset = new THREE.Vector3();
  function setSunOffset() {
    const lightAz = (CONFIG.LIGHT_AZIMUTH_DEG * Math.PI) / 180;
    const lightEl = (CONFIG.LIGHT_ELEVATION_DEG * Math.PI) / 180;
    sunOffset
      .set(Math.sin(lightAz) * Math.cos(lightEl), Math.sin(lightEl), Math.cos(lightAz) * Math.cos(lightEl))
      .multiplyScalar(20);
  }
  setSunOffset();

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
  // Smooth terrain normals (Look Lab port) at a 10 degree sun make self-shadow
  // stripes ("acne") likelier than flat facets did; a small offset along the
  // normal removes them. TODO(felix): confirm on a phone — raise if stripes
  // show on the granite, lower if shadows detach from the houses.
  sun.shadow.normalBias = 0.25;
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

  // Islands first: the sea is coloured by the depth under it, baked once from
  // every island's height field. Same seed -> same map on both peers.
  const scatteredIslands = coast ? [] : scatterIslands(seed); // real coast: the islands are the coast
  const depthMap = coast ? coast.depthMap : bakeDepthMap(scatteredIslands);
  console.log(
    `depth-map: ${depthMap.nx}x${depthMap.nz} texels @ ${depthMap.texel}m (${((depthMap.nx * depthMap.nz) / 1e6).toFixed(2)}M), ` +
      `${depthMap.evals} height evals, baked in ${depthMap.bakeMs.toFixed(0)} ms`,
  );

  const water = createWater(depthMap);
  scene.add(water.mesh);

  // Golden distance haze: fog for the meshes (the sea mixes the same colour
  // in its own shader). near/far follow the camera-to-boat distance each
  // frame, so the haze reads the same at every zoom.
  scene.fog = new THREE.Fog(CONFIG.HAZE_COLOR, 1e6, 2e6);

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

  if (!coast) scene.add(createScatter(seed));
  // (scatteredIslands is built above, before the water.)
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
  if (!coast) {
    const view = cameraViewWidth();
    const { histogram, median, totalWindows } = windowOccupancy(scatteredIslands, CONFIG.ISLAND_SCATTER_AREA, view);
    console.log(
      `island-scatter: VIEW=${view.toFixed(1)}m pitch=${gridPitch().toFixed(1)}m placed=${scatteredIslands.length} span=${CONFIG.ISLAND_SCATTER_AREA}m ` +
        `windows(${view.toFixed(0)}m, n=${totalWindows}): 0=${histogram.pct0.toFixed(1)}% 1=${histogram.pct1.toFixed(1)}% 2=${histogram.pct2.toFixed(1)}% 3+=${histogram.pct3plus.toFixed(1)}% median=${median}`,
    );
  }
  const islandGroups = [];
  for (const island of scatteredIslands) {
    const { group } = createIsland(island.seed, island.params);
    islandGroups.push(group);
    scene.add(group);
  }

  if (coast) scene.add(coast.group); // terrain, trees near the boat, villages, lighthouses

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

  // Applies CONFIG's look values to everything already built. Water, sky,
  // glow and fog read CONFIG every frame; the rest is pushed here. Repainting
  // ~300k ground vertices is the slow part, so it waits 200 ms after the last
  // change (dragging a slider stays smooth on a phone).
  const GROUND_PAINT = /^LOOK_(GRANITE|MEADOW|HEATHER|SAND|WET)/;
  let repaintTimer = 0;
  function applyLook(key) {
    hemi.color.set(CONFIG.HEMI_SKY_COLOR);
    hemi.groundColor.set(CONFIG.HEMI_GROUND_COLOR);
    hemi.intensity = CONFIG.HEMI_INTENSITY;
    sun.color.set(CONFIG.SUN_COLOR);
    sun.intensity = CONFIG.SUN_INTENSITY;
    setSunOffset();
    for (const g of islandGroups) applyIslandLook(g);
    if (key === '*' || GROUND_PAINT.test(key)) {
      clearTimeout(repaintTimer);
      repaintTimer = setTimeout(() => {
        refreshPalette();
        coast?.terrainStyle.style.refreshPalette(); // the crisp-zone material reads the palette too
        for (const g of islandGroups) recolorTerrain(g.children[0]);
      }, 200);
    }
  }
  if (tuning) import('./src/tune.js').then((m) => m.createTunePanel({ CONFIG, apply: applyLook }));

  const windArrow = createWindArrow();
  scene.add(windArrow.object);

  loadBoatModel(); // once, before any createBoatMesh() call (self or lazy other)

  const selfColor = role === 'host' ? 0xffcc66 : 0x66ccff;
  const otherColor = role === 'host' ? 0x66ccff : 0xffcc66;

  // Boats (src/boats.js, docs/boat-lab/README.md): today = Svalan, granddad's koster (gaff + jib, deck items, wear 0.8: the
  // defaults). The player colour is the masthead pennant only. ?boat=eka = the ~1700 eka (rust sail) until the jump exists.
  const boatType = new URLSearchParams(window.location.search).get('boat') === 'eka' ? 'eka' : 'koster';
  const boatOptions = boatType === 'eka' ? { type: 'eka', sailTone: 'rust' } : { type: 'koster' };
  const selfBoat = createBoatMesh(selfColor, boatOptions);
  scene.add(selfBoat.group);
  const selfWake = createWake();
  scene.add(selfWake.group);
  let otherBoat = null; // created lazily on the peer's first 'pos' (drop-in play)
  let otherWake = null; // created alongside otherBoat

  // Stage 1: spawn facing across the wind at ideal trim (src/spawn.js) —
  // previously fixed east/west, sheeted in, and ~1 in 8 seeds started
  // stuck in the no-go zone.
  const self = { ...spawnPose(seed, role), speed: 0 };
  if (coast && coast.spawn) { // just outside Grundsund's harbour; the guest starts a boat-width beside the host
    self.x = coast.spawn.x + (role === 'host' ? 0 : CONFIG.BOAT_SPAWN_OFFSET * 2);
    self.z = coast.spawn.z;
  }
  // Names are discovered (src/names.js): shown once when the boat is near, remembered on this device.
  const nameBook = coast ? createNameBook(coast.names) : null;
  const nameLabels = coast ? createNameLabels(document.body, { onCancelTarget: () => chartCtl?.clearTarget() }) : null;
  // Names already known from an earlier session show again when you are near them (no announcement).
  if (coast) for (const e of coast.names) if (nameBook.isKnown(e.id)) nameLabels.track(e, Math.max(0, coast.heightAt(e.x, e.z)) + 8);
  const namesLine = () => `names       ${nameBook.count()} / ${nameBook.total} discovered`;
  if (coast && debugOverlay) {
    debugOverlay.set('names', namesLine());
    window.__names = nameBook; // headless checks
    window.__self = self;
    window.__labels = nameLabels;
    window.__coastStyle = coast.terrainStyle;
    window.__coastHeight = coast.heightAt;
  }
  // Stage 1b, the lure: arriving slowly in a harbour (a bell, a wave, a fish on deck), small life on the water.
  // Sound starts only after the first tap (browser rule, src/audio.js). Real coast only.
  // ?lure=0 switches the harbour moment and the animals off (to compare frame rate on a phone).
  const lureOn = !!coast && new URLSearchParams(window.location.search).get('lure') !== '0';
  const audio = lureOn ? createAudio() : null;
  audio?.armOnFirstGesture();
  const arrivals = lureOn ? createArrivals(coast.names) : null;
  const deck = lureOn ? createDeck() : null;
  const moment = lureOn ? createHarbourMoment({ THREE, scene, boatGroup: selfBoat.group, heightAt: coast.heightAt, deck, audio, boatType }) : null;
  const life = lureOn
    ? createLife({
      THREE, scene, heightAt: coast.heightAt, places: coast.names, lights: coast.lights,
      seaY: (x, z) => seaHeightCPU(x, z, waves.phases, wind.dir, wind.strength), // (waves / wind are set up below)
      inside: (x, z) => coast.world.inside(x, z, 100),
      onCry: () => audio.gull(0, 0.5),
    })
    : null;
  if (coast && debugOverlay) window.__wind = () => wind;
  if (coast && debugOverlay) window.__lureOn = lureOn;
  if (lureOn && debugOverlay) window.__lure = { arrivals, deck, moment, life, audio, names: coast.names }; // headless checks
  // The HUD counter on the real coast: places you have named (there are no "finds" to count).
  const progressText = () => (coast ? `places named ${nameBook.count()}` : `found ${found.size}/${discoverables.length}`);
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
  const waves = createWaveState(wind.dir); // src/water.js: per-component wave phases
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
        otherBoat = createBoatMesh(otherColor, boatOptions);
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

  // Zoom. The procedural islands keep the old wheel zoom; the real coast has the new zoom + chart (src/chart-controller.js).
  let zoom = 1;
  function onWheel(e) {
    e.preventDefault();
    zoom = Math.min(CONFIG.ZOOM_MAX, Math.max(CONFIG.ZOOM_MIN, zoom + e.deltaY * CONFIG.ZOOM_WHEEL_SENSITIVITY));
  }
  if (!coast) canvas.addEventListener('wheel', onWheel, { passive: false });
  const viewTarget = new THREE.Vector3(); // where the camera, sun and sea follow: the boat, or a lighthouse on a visit
  let ctlView = null;

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
  // The HUD boxes that are on screen (compass, wind text, trim bar, notice, key legend): names keep clear of them.
  const hudRects = () => [...[hud.rose, hud.text, hud.bar, hud.notice, hud.legend].filter((el) => el && el.style.display !== 'none')
    .map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0).map((r) => ({ x: r.left, y: r.top, w: r.width, h: r.height })), ...(chartCtl ? chartCtl.rects() : []), ...(phone && phone.ropeRect() ? [phone.ropeRect()] : [])];
  if (coast && debugOverlay) {
    const r = coast.report;
    const t = r.timings;
    debugOverlay.set('coast', `coast       load+decode ${t.loadDecodeMs.toFixed(0)} ms, field ${t.fieldMs.toFixed(0)}, depth map ${t.depthMs.toFixed(0)}, terrain ${t.terrainMs.toFixed(0)}, props ${t.propsMs.toFixed(0)}; total ${t.buildMs.toFixed(0)} ms`);
    debugOverlay.set('coast2', `            ${(r.bytesDownloadedByLoader / 1048576).toFixed(2)} MB coast data; terrain ${(r.terrain.fullTriangles / 1000).toFixed(0)}k full + ${(r.terrain.coarseTriangles / 1000).toFixed(0)}k coarse tris in ${r.terrain.chunks} chunks; ${r.buildings} houses, ${r.skerries} skerries; region ${r.window.metres.join(' x ')} m`);
  }

  // Phone controls (src/phone.js): hold to aim, second-thumb sheet, arc,
  // wind at the boat. The corner HUD and keyboard legend are hidden there.
  const phone = isPhone ? createPhoneControls({ canvas, camera, onPing: () => doPing() }) : null;
  // Stage 1c: zoom out into the chart, the minimap, lighthouse visits. ?debug=1 adds a "jump here" button to a visit.
  const chartCtl = coast
    ? createChartController({
      canvas, coast, nameBook, getMarks: () => (life ? life.marks : []), debug: !!debugOverlay, assetsBase: new URL('./assets/chart/', import.meta.url).href,
      onJump: (x, z) => { const w = coast.findOpenWater(x, z, { clear: 14 }); if (w) { self.x = w.x; self.z = w.z; self.speed = 0; } },
      // "Navigate here": the target's edge tag (src/name-labels.js); null clears it
      onTarget: (entry, titleFn) => nameLabels.setTarget(entry, entry ? Math.max(0, coast.heightAt(entry.x, entry.z)) + 8 : 0, titleFn),
      // a lighthouse visit: its name label is up while you look at it (the real name if found, else its description)
      onVisit: (entry) => {
        const known = nameBook.isKnown(entry.id);
        if (known || entry.desc) nameLabels.show(entry, Math.max(0, coast.heightAt(entry.x, entry.z)) + 8, performance.now() / 1000, !known);
      },
    })
    : null;
  chartCtl?.setPhoneInterrupt(() => phone?.interrupt());
  if (chartCtl && debugOverlay) window.__chart = chartCtl;
  if (phone) {
    for (const el of [hud.rose, hud.text, hud.bar, hud.legend]) el.style.display = 'none';
    hud.notice.style.bottom = '44px';
    windArrow.object.visible = false; // the no-go wedge + streaks show the wind instead
  }

  selfBoat.group.position.set(self.x, 0, self.z);
  selfBoat.group.rotation.y = self.heading;
  viewTarget.copy(selfBoat.group.position);
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

    const frozen = !!(chartCtl && chartCtl.visiting); // a lighthouse visit: the camera goes, the boat stays put
    if (!frozen) phone?.apply(self, wind, dt);
    if (!frozen && (input.left || input.right)) hasSteered = true;
    if (input.up || input.down) hasTrimmed = true;
    if (!frozen && input.left) self.heading -= CONFIG.TURN_RATE * dt;
    if (!frozen && input.right) self.heading += CONFIG.TURN_RATE * dt;
    if (!frozen && input.up) self.trim = Math.max(CONFIG.TRIM_MIN, self.trim - CONFIG.TRIM_RATE * dt);
    if (!frozen && input.down) self.trim = Math.min(CONFIG.TRIM_MAX, self.trim + CONFIG.TRIM_RATE * dt);

    const targetSpeed = boatSpeed(self.heading, wind.dir, wind.strength, self.trim);
    self.speed = frozen ? 0 : approachSpeed(self.speed, targetSpeed, dt);
    if (coast) {
      // Real coast: very shallow water slows the boat a little; the shore is solid but gentle: the boat slides along
      // it and a head-on approach brakes softly (src/shore.js). No damage, no bounce.
      const v = self.speed * shallowFactor(coast.heightAt, self.x, self.z);
      const mv = stepAlongShore(coast.heightAt, self.x, self.z, Math.sin(self.heading) * v * dt, Math.cos(self.heading) * v * dt);
      self.x = mv.x;
      self.z = mv.z;
      if (mv.contact > 0) self.speed = Math.max(0, self.speed - mv.contact * SHORE_BRAKE * dt);
      coast.clamp(self); // the region has an edge; hold the boat just inside it
      if (coast.update(ctlView ? ctlView.focus.x : self.x, ctlView ? ctlView.focus.z : self.z)) { // terrain and trees follow the view
        const s = coast.trees.stats;
        const t = coast.terrain.stats;
        debugOverlay?.set('trees', `trees       ${s.trees} near boat (query ${s.queryMs.toFixed(1)} ms) | chunks ${t.shownFull} full + ${t.shownCoarse} coarse of ${t.chunks}`);
      }
      // names need the land to be revealed by the fog first (src/seen.js, via the chart controller)
      const canSee = (e) => !chartCtl || chartCtl.canSee(e);
      const discovered = nameBook.update(self.x, self.z, canSee);
      for (const e of discovered) nameLabels.show(e, Math.max(0, coast.heightAt(e.x, e.z)) + 8, nowS);
      // Approaching a described place that is not yet named: its descriptive name ("the Hood") first.
      for (const e of nameBook.sight(self.x, self.z, canSee)) nameLabels.show(e, Math.max(0, coast.heightAt(e.x, e.z)) + 8, nowS, true);
      if (discovered.length) debugOverlay?.set('names', namesLine());
      if (lureOn) for (const place of arrivals.update(self.x, self.z, self.speed, nowS)) moment.trigger(place, giftFor(place), self, nowS);
    } else {
      self.x += Math.sin(self.heading) * self.speed * dt;
      self.z += Math.cos(self.heading) * self.speed * dt;
    }

    selfBoat.group.position.set(self.x, 0, self.z);
    selfBoat.group.rotation.y = self.heading;
    stepWaves(waves, dt, wind, self.x, self.z); // before anything samples the sea this frame
    bobBoat(selfBoat.group, self.x, self.z, self.heading, waves, wind);
    selfBoat.setSailAngle(leewardSign(self.heading, wind.dir) * self.trim);
    selfWake.update(dt, selfBoat.group.position, self.heading, self.speed);
    updateSunPosition(viewTarget);
    if (lureOn) {
      moment.update(dt, nowS);
      life.update(self, dt, nowS);
    }

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
      bobBoat(otherBoat.group, other.x, other.z, other.heading, waves, wind);
      // Trim isn't synced (DESIGN.md) — approximate the other boat's sail
      // with the ideal trim for its current point of sail.
      const otherIdeal = idealTrimRad(angleOffWind(other.heading, wind.dir));
      otherBoat.setSailAngle(leewardSign(other.heading, wind.dir) * otherIdeal);
      otherWake.update(dt, otherBoat.group.position, other.heading, other.speed);
    }

    // Stage 1c: zoom, chart, minimap, visit (src/chart-controller.js). Where the camera looks is the boat unless on a visit.
    ctlView = chartCtl
      ? chartCtl.update(dt, nowS, { x: self.x, z: self.z, heading: self.heading, speed: self.speed }, canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, Math.min(window.devicePixelRatio || 1, 2), partnerPos ? [{ x: partnerPos.x, z: partnerPos.z, heading: partnerPos.heading }] : [])
      : null;
    const lookAt = ctlView ? ctlView.focus : self;
    viewTarget.set(lookAt.x, ctlView && ctlView.visiting ? 0 : selfBoat.group.position.y, lookAt.z);
    water.update(waves, wind, viewTarget, dt, camera.position);
    windArrow.update(selfBoat.group.position, wind);

    if (wireGrid) {
      const cell = CONFIG.DEBUG_WIREFRAME_GRID_CELL;
      wireGrid.position.x = Math.round(selfBoat.group.position.x / cell) * cell;
      wireGrid.position.z = Math.round(selfBoat.group.position.z / cell) * cell;
      forceWireframe();
    }

    if (isFixedCamera) {
      updateFixedCamera(camera, viewTarget, dt, ctlView ? ctlView.zoom : zoom, ctlView && ctlView.zooming ? 14 : undefined);
    } else {
      updateChaseCamera(camera, selfBoat.group.position, self.heading, dt, zoom);
    }
    // Haze distances track the camera (after it moved, before it renders).
    const camToBoat = camera.position.distanceTo(viewTarget);
    scene.fog.color.set(CONFIG.HAZE_COLOR);
    scene.fog.near = camToBoat * CONFIG.HAZE_MESH_NEAR_MUL;
    scene.fog.far = camToBoat * CONFIG.HAZE_MESH_FAR_MUL;
    sky.update(camera);
    sunGlow.update(camera);
    if (!phone) setLegendVisible(hud, !(hasSteered && hasTrimmed));
    const bearingTo = (x, z) => Math.atan2(x - self.x, z - self.z);
    const friendPing = [...pings].reverse().find((p) => p.fromFriend);
    updateHud(hud, wind, self.trim, idealTrimRad(angleOffWind(self.heading, wind.dir)), self.heading, self.speed, {
      foundText: progressText(),
      partnerBearing: partnerPos ? bearingTo(partnerPos.x, partnerPos.z) : null,
      pingBearing: friendPing ? bearingTo(friendPing.x, friendPing.z) : null,
    });

    if (nameLabels) {
      nameLabels.setHidden(!!ctlView && ctlView.t > 0.05); // the chart has its own names
      nameLabels.update(camera, canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, nowS, ctlView ? ctlView.focus : self, hudRects);
    }
    if (!(ctlView && ctlView.skip3D)) renderer.render(scene, camera); // the chart covers the whole view: skip the 3D render
    debugOverlay?.frame(now);
    phone?.setRopeVisible(!(ctlView && ctlView.t > 0.05)); // the chart covers the view: no rope
    phone?.draw(nowS, {
      partner: partnerPos,
      pings,
      foundText: progressText(),
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
