// The 3D half of the Seamarks Lab (seamarks-lab.html): the real coast (src/coast-world.js), the game's own sea, sky,
// light and fixed camera, with the sea-marks (src/seamark-meshes.js), the shoal rings (src/shoal-look.js) and a koster
// for scale. Loaded only when the page switches to 3D. Nothing here is used by the game.
//
// "Same look" rule (Felix, 2026-11-06): an invented harbour-mouth mark is drawn exactly like a real one. The DEBUG
// toggle adds a magenta ring round the invented ones; it is off by default.
import * as THREE from '../vendor/three/three.module.js';
import { CONFIG } from './config.js';
import { createWater, createWaveState, stepWaves, seaHeightCPU } from './water.js';
import { createSky } from './sky.js';
import { loadRealCoast } from './coast-world.js';
import { createSeamarkMesh, lightIsOn, lightPattern, MARK_SAMPLES } from './seamark-meshes.js';
import { createShoalLayer, buildShoalList } from './shoal-look.js';
import { createBoatMesh } from './boats.js';

const DEG = Math.PI / 180;
// Night in the lab = the blue-hour dusk of boat-lab.js (ART.md: never grim): dim cool light, darker sea and sky.
const NIGHT = {
  SUN_COLOR: 0xaab8e8, SUN_INTENSITY: 0.85, HEMI_SKY_COLOR: 0x92a2d4, HEMI_GROUND_COLOR: 0x544c78, HEMI_INTENSITY: 1.5,
  SKY_HORIZON_COLOR: 0x4a5a8c, SKY_ZENITH_COLOR: 0x1c2650, HAZE_COLOR: 0x34406c, LOOK_SEA_BRIGHTNESS: 0.62,
};
const DAY = Object.fromEntries(Object.keys(NIGHT).map((k) => [k, CONFIG[k]]));
export const VISIBLE_MARK_RADIUS_M = 420; // marks this close to the focus are shown (game metres)

export async function createLab3D({ canvas, shoals, marks, harbours, initial = {}, onStatus = () => {} }) {
  const S = { night: !!initial.night, zoom: initial.zoom ?? 1, shoals: initial.shoals ?? true, boat: initial.boat ?? true, debug: !!initial.debug, pinT: initial.t ?? null };
  onStatus('loading the real coast…');
  const focusLL = initial.focus ?? [11.4620, 58.2490];
  const coast = await loadRealCoast({ at: focusLL });
  const world = coast.world;

  const isPhone = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isPhone ? CONFIG.PHONE_MAX_PIXEL_RATIO : Infinity));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const sky = createSky();
  scene.add(sky.mesh);
  const camera = new THREE.PerspectiveCamera(CONFIG.FIXED_CAMERA_FOV_DEG, 1, 1, 4000);
  const hemi = new THREE.HemisphereLight(CONFIG.HEMI_SKY_COLOR, CONFIG.HEMI_GROUND_COLOR, CONFIG.HEMI_INTENSITY);
  const sun = new THREE.DirectionalLight(CONFIG.SUN_COLOR, CONFIG.SUN_INTENSITY);
  const az = (CONFIG.LIGHT_AZIMUTH_DEG * Math.PI) / 180, el = (CONFIG.LIGHT_ELEVATION_DEG * Math.PI) / 180;
  const sunOffset = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { near: 1, far: 500, left: -150, right: 150, top: 150, bottom: -150 });
  sun.shadow.bias = CONFIG.SUN_SHADOW_BIAS;
  sun.shadow.normalBias = 0.25;
  scene.add(hemi, sun, sun.target);
  scene.fog = new THREE.Fog(CONFIG.HAZE_COLOR, 1e6, 2e6);
  const water = createWater(world.depthMap);
  scene.add(water.mesh, coast.group);
  const wind = { dir: 0.6, strength: 0.4 };
  const waves = createWaveState(wind.dir);

  // ---- the marks (all of them, shown only near the focus) ----
  onStatus('building the marks…');
  const items = marks.map((spec) => {
    const [x, z] = world.toGame(spec.lon, spec.lat);
    const m = createSeamarkMesh(spec, { night: S.night });
    const onLand = m.form !== 'buoy';
    m.group.position.set(x, 0, z);
    const entry = { spec, m, x, z, baseY: onLand ? Math.max(0, world.heightAt(x, z)) : 0, ring: null };
    if (spec.invented) { // the debug ring: only shown when the debug toggle is on
      const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.3, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3fb8, transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
      ring.position.set(x, 0.55, z); ring.visible = false; ring.renderOrder = 3;
      scene.add(ring); entry.ring = ring;
    }
    scene.add(m.group);
    return entry;
  });
  const shoalLayer = createShoalLayer(buildShoalList(shoals, world.toGame));
  scene.add(shoalLayer.group);

  // ---- the boat, for scale ----
  const boat = createBoatMesh(0xffcc66, { type: 'koster' });
  boat.setSailAngle(24 * DEG);
  scene.add(boat.group);

  // ---- "all mark types": every variant in a row on the sea beside the boat (a chip in the lab) ----
  const sampler = { on: false, group: new THREE.Group(), marks: MARK_SAMPLES.map((spec) => createSeamarkMesh(spec, { night: S.night })) };
  sampler.group.visible = false;
  sampler.marks.forEach((m) => sampler.group.add(m.group));
  scene.add(sampler.group);

  // ---- focus + camera ----
  const focus = new THREE.Vector3(0, 0, 0);
  let boatHeading = 0; // radians, the game's convention: forward = (sin h, cos h) in (x, z)
  const GAME = { az: CONFIG.FIXED_CAMERA_AZIMUTH_DEG, el: CONFIG.FIXED_CAMERA_ELEVATION_DEG };
  // target: { lat, lon, bearingDeg? (the way a boat enters), boatBackM? }
  function focusOn(target) {
    const [x, z] = world.toGame(target.lon, target.lat);
    focus.set(x, 0, z);
    if (target.bearingDeg !== undefined) { // park the boat seaward of the mouth, pointing in
      const b = target.bearingDeg * DEG, back = target.boatBackM ?? 15;
      boat.group.position.set(x - Math.sin(b) * back, 0, z + Math.cos(b) * back);
      boatHeading = Math.PI - b;
    } else {
      const spot = world.inside(x, z, 100) ? findNearbyWater(x, z) : { x, z };
      boat.group.position.set(spot.x, 0, spot.z);
      boatHeading = Math.atan2(x - spot.x, z - spot.z);
    }
    boat.group.rotation.y = boatHeading;
    coast.update(focus.x, focus.z);
  }
  function findNearbyWater(x, z) { // a spot of open sea within sight of the harbour
    for (let r = 14; r <= 120; r += 6) for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
      if (world.heightAt(px, pz) < -3 && world.heightAt(px + 6, pz) < -2 && world.heightAt(px - 6, pz) < -2) return { x: px, z: pz };
    }
    return { x, z };
  }
  function placeSampler() { // two rows across the screen, 3.4 m apart, centred on the focus (the sea at the mouth)
    const a = GAME.az * DEG, rx = Math.cos(a), rz = -Math.sin(a), fx = -Math.sin(a), fz = -Math.cos(a), per = 6;
    sampler.marks.forEach((m, i) => {
      const col = i % per, row = Math.floor(i / per);
      const u = (col - (per - 1) / 2) * 3.6, v = (row - 0.5) * 7 + 6; // v: toward the far side of the screen
      m.baseX = focus.x + rx * u + fx * v; m.baseZ = focus.z + rz * u + fz * v;
      m.group.position.set(m.baseX, 0, m.baseZ);
    });
  }
  function placeCamera() {
    const a = GAME.az * DEG, e = GAME.el * DEG, dist = CONFIG.FIXED_CAMERA_DISTANCE * S.zoom;
    camera.position.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(dist).add(focus);
    camera.near = Math.min(CONFIG.CAMERA_NEAR, Math.max(0.1, dist * 0.04));
    camera.updateProjectionMatrix();
    camera.lookAt(focus);
    const s = Math.min(150, Math.max(18, dist * 1.1));
    if (sun.shadow.camera.right !== s) { Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s }); sun.shadow.camera.updateProjectionMatrix(); }
    return dist;
  }
  // drag pans the focus over the ground; pinch / wheel zoom
  const pointers = new Map();
  let pinch0 = 0, zoom0 = 1;
  canvas.addEventListener('pointerdown', (e) => {
    try { canvas.setPointerCapture(e.pointerId); } catch { /* the pointer already ended */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = S.zoom; }
  });
  const end = (e) => pointers.delete(e.pointerId);
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 1) {
      const mPerPx = (2 * Math.tan((CONFIG.FIXED_CAMERA_FOV_DEG * DEG) / 2) * CONFIG.FIXED_CAMERA_DISTANCE * S.zoom) / (canvas.clientHeight || 800);
      const a = GAME.az * DEG; // screen right = (cos a, -sin a); screen "down" on the ground = away from the camera
      focus.x -= (dx * Math.cos(a) + dy * Math.sin(a) * 1.5) * mPerPx;
      focus.z -= (-dx * Math.sin(a) + dy * Math.cos(a) * 1.5) * mPerPx;
      coast.update(focus.x, focus.z);
    } else if (pointers.size === 2 && pinch0 > 0) {
      const [a, b] = [...pointers.values()];
      S.zoom = Math.min(3, Math.max(0.1, zoom0 * (pinch0 / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)))));
      api.onZoom?.(S.zoom);
    }
  });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); S.zoom = Math.min(3, Math.max(0.1, S.zoom * Math.exp(e.deltaY * 0.001))); api.onZoom?.(S.zoom); }, { passive: false });

  function applyLight() {
    Object.assign(CONFIG, S.night ? NIGHT : DAY);
    hemi.color.set(CONFIG.HEMI_SKY_COLOR); hemi.groundColor.set(CONFIG.HEMI_GROUND_COLOR); hemi.intensity = CONFIG.HEMI_INTENSITY;
    sun.color.set(CONFIG.SUN_COLOR); sun.intensity = CONFIG.SUN_INTENSITY;
    boat.setNight(S.night);
    for (const it of items) it.m.setNight(S.night);
    for (const m of sampler.marks) m.setNight(S.night);
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
  }
  window.addEventListener('resize', resize);

  let running = false, last = performance.now(), clock = 0, frames = 0, fps = 60;
  const shown = new Set();
  function frame(nowMs) {
    if (!running) return;
    const dt = Math.min(0.1, (nowMs - last) / 1000); last = nowMs;
    if (dt > 0) fps += (1 / dt - fps) * 0.1;
    clock += dt;
    const t = S.pinT ?? clock;
    stepWaves(waves, dt, wind, 0, 0);
    // the marks near the focus: shown, bobbing on the real wave height, blinking at night
    shown.clear();
    for (const it of items) {
      const near = Math.hypot(it.x - focus.x, it.z - focus.z) <= VISIBLE_MARK_RADIUS_M;
      it.m.group.visible = near;
      if (it.ring) it.ring.visible = near && S.debug;
      if (!near) continue;
      shown.add(it);
      const seaY = seaHeightCPU(it.x, it.z, waves.phases, wind.dir, wind.strength);
      it.m.step(t, { seaY: it.m.bobs ? seaY : null });
      if (!it.m.bobs) it.m.group.position.y = it.baseY;
    }
    if (sampler.on) for (const m of sampler.marks) m.step(t, { seaY: m.bobs ? seaHeightCPU(m.baseX, m.baseZ, waves.phases, wind.dir, wind.strength) : 0 });
    shoalLayer.group.visible = S.shoals;
    shoalLayer.update(t);
    boat.group.visible = S.boat;
    const by = seaHeightCPU(boat.group.position.x, boat.group.position.z, waves.phases, wind.dir, wind.strength);
    boat.group.position.y = by;
    boat.group.rotation.y = boatHeading;
    water.update(waves, wind, focus, dt, camera.position);
    const dist = placeCamera();
    sun.position.copy(focus).add(sunOffset); sun.target.position.copy(focus);
    scene.fog.color.set(CONFIG.HAZE_COLOR);
    scene.fog.near = dist * CONFIG.HAZE_MESH_NEAR_MUL; scene.fog.far = dist * CONFIG.HAZE_MESH_FAR_MUL;
    sky.update(camera);
    renderer.render(scene, camera);
    if (++frames % 15 === 0) api.onStats?.({ fps, marks: shown.size, lit: [...shown].filter((i) => i.m.lampLit).length });
    requestAnimationFrame(frame);
  }

  const api = {
    world, scene, camera, renderer, S, focus,
    focusOn,
    setNight(on) { S.night = !!on; applyLight(); },
    setZoom(z) { S.zoom = z; },
    setShoals(on) { S.shoals = !!on; },
    setBoat(on) { S.boat = !!on; },
    setSampler(on) { sampler.on = !!on; sampler.group.visible = sampler.on; if (sampler.on) placeSampler(); },
    setDebug(on) { S.debug = !!on; },
    pin(t) { S.pinT = t; },
    // the pinned time at which the most lit marks near the focus are flashing (for a still picture of the rhythm)
    bestFlashTime() {
      const lit = items.filter((it) => it.m.light && Math.hypot(it.x - focus.x, it.z - focus.z) <= VISIBLE_MARK_RADIUS_M * 0.6);
      let best = 0, bestN = -1;
      for (let t = 0; t < 30; t += 0.05) {
        const n = lit.filter((it) => lightIsOn(it.m.light, t + hashPhase(it) * lightPattern(it.m.light).period)).length;
        if (n > bestN) { bestN = n; best = t; }
      }
      return { t: best, lit: lit.length, on: bestN };
    },
    start() { if (running) return; running = true; resize(); last = performance.now(); requestAnimationFrame(frame); },
    stop() { running = false; },
    resize,
    onZoom: null, onStats: null,
  };
  // same phase the mesh uses (seamark-meshes.js hash01 of the id): re-derived through the mesh by sampling is
  // unnecessary because the mesh exposes its own timing via lampLit; this keeps bestFlashTime() honest
  function hashPhase(it) {
    const s = it.spec.id ?? `${it.spec.lat},${it.spec.lon}`;
    let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return ((h >>> 0) % 100000) / 100000;
  }
  applyLight();
  const first = initial.target ?? { lat: focusLL[1], lon: focusLL[0] };
  focusOn(first);
  if (S.pinT === null && initial.flash) { const f = api.bestFlashTime(); S.pinT = f.t; }
  return api;
}
