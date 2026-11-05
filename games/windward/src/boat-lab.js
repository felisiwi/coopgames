// Boat Lab (boat-lab.html): the two boats from boats.js on the game's own sea, sky, light and fixed camera.
// "Game camera" shows a boat exactly as the game would (52 degrees up, 45 degrees round, 125 m away at zoom 1);
// drag to orbit instead. Everything in the panel is mirrored in the web address, so a link carries the setup.
// Nothing here is used by the game. URL keys: see boats.js parseLabParams().
import * as THREE from '../vendor/three/three.module.js';
import { CONFIG } from './config.js';
import { createWater, createWaveState, stepWaves, seaHeightCPU } from './water.js';
import { createSky } from './sky.js';
import { createBoatMesh, KOSTER_RIGS, DECK_ITEMS, parseLabParams, labParamsToSearch } from './boats.js';

const $ = (id) => document.getElementById(id);
const loading = $('loading');
const DEG = Math.PI / 180;

// Night in the lab = a blue-hour dusk (ART.md: never grim): dim cool light, a darker sea and sky. Day = config.js as it is.
const NIGHT = {
  SUN_COLOR: 0xaab8e8, SUN_INTENSITY: 0.85, HEMI_SKY_COLOR: 0x92a2d4, HEMI_GROUND_COLOR: 0x544c78, HEMI_INTENSITY: 1.5,
  SKY_HORIZON_COLOR: 0x4a5a8c, SKY_ZENITH_COLOR: 0x1c2650, HAZE_COLOR: 0x34406c, LOOK_SEA_BRIGHTNESS: 0.62,
};
const DAY = Object.fromEntries(Object.keys(NIGHT).map((k) => [k, CONFIG[k]]));

function main() {
  const S = parseLabParams(window.location.search); // the one state object; everything below reads / writes it
  const canvas = $('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const isPhone = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isPhone ? CONFIG.PHONE_MAX_PIXEL_RATIO : Infinity));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap was removed in this three.js; same result as the game's

  const scene = new THREE.Scene();
  const sky = createSky();
  scene.add(sky.mesh);
  const camera = new THREE.PerspectiveCamera(CONFIG.FIXED_CAMERA_FOV_DEG, 1, 1, 2000);
  const hemi = new THREE.HemisphereLight(CONFIG.HEMI_SKY_COLOR, CONFIG.HEMI_GROUND_COLOR, CONFIG.HEMI_INTENSITY);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(CONFIG.SUN_COLOR, CONFIG.SUN_INTENSITY);
  const az = (CONFIG.LIGHT_AZIMUTH_DEG * Math.PI) / 180;
  const el = (CONFIG.LIGHT_ELEVATION_DEG * Math.PI) / 180;
  const sunOffset = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { near: 1, far: 500, left: -150, right: 150, top: 150, bottom: -150 });
  sun.shadow.bias = CONFIG.SUN_SHADOW_BIAS;
  sun.shadow.normalBias = 0.25; // the game's value (game.js): keeps self-shadow streaks off the hull
  scene.add(sun, sun.target);
  scene.fog = new THREE.Fog(CONFIG.HAZE_COLOR, 1e6, 2e6);

  const water = createWater(null); // open sea: no islands in the lab
  scene.add(water.mesh);
  const wind = { dir: 0.6, strength: 0.5 };
  const waves = createWaveState(wind.dir);

  // ---- the boat ----
  let boat = null;
  const boatPos = new THREE.Vector3(0, 0, 0);
  function deckFromItems() { return DECK_ITEMS.map((i) => (S.items.includes(i) ? i : null)); }
  function buildBoat() {
    if (boat) { scene.remove(boat.group); boat.group.traverse((o) => o.geometry?.dispose()); }
    boat = createBoatMesh(S.pennant, { type: S.boat, rig: S.rig, deck: deckFromItems(), night: !!S.night, wear: S.wear });
    boat.setSailAngle(S.sail * DEG);
    scene.add(boat.group);
  }
  buildBoat();
  function bob(group, x, z, headingRad) { // the game's bobBoat (game.js), so the boat sits on the sea as in play
    const eps = CONFIG.BOAT_TILT_GRADIENT_EPS;
    const fx = Math.sin(headingRad), fz = Math.cos(headingRad), rx = Math.cos(headingRad), rz = -Math.sin(headingRad);
    const y = seaHeightCPU(x, z, waves.phases, wind.dir, wind.strength);
    const yF = seaHeightCPU(x + fx * eps, z + fz * eps, waves.phases, wind.dir, wind.strength);
    const yR = seaHeightCPU(x + rx * eps, z + rz * eps, waves.phases, wind.dir, wind.strength);
    const max = CONFIG.BOAT_TILT_MAX;
    group.position.y = y;
    group.rotation.x = Math.min(max, Math.max(-max, -((yF - y) / eps) * CONFIG.BOAT_TILT_GAIN));
    group.rotation.z = Math.min(max, Math.max(-max, ((yR - y) / eps) * CONFIG.BOAT_TILT_GAIN));
  }

  // ---- camera: one spherical model; "game" = the fixed game angle at zoom S.zoom, "orbit" = free ----
  const GAME = { az: CONFIG.FIXED_CAMERA_AZIMUTH_DEG, el: CONFIG.FIXED_CAMERA_ELEVATION_DEG };
  const view = () => (S.cam === 'game'
    ? { az: GAME.az, el: GAME.el, dist: CONFIG.FIXED_CAMERA_DISTANCE * S.zoom, ty: 0 }
    : { az: S.az, el: S.el, dist: S.dist, ty: 1.1 });
  function placeCamera() {
    const v = view();
    const a = v.az * DEG, e = v.el * DEG;
    camera.position.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(v.dist).add(boatPos);
    camera.position.y += v.ty;
    camera.near = Math.min(CONFIG.CAMERA_NEAR, Math.max(0.05, v.dist * 0.05));
    camera.updateProjectionMatrix();
    camera.lookAt(boatPos.x, boatPos.y + v.ty, boatPos.z);
    const s = Math.min(150, Math.max(14, v.dist * 1.1)); // shadow frustum follows the view so close-ups stay sharp
    if (sun.shadow.camera.right !== s) { Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s }); sun.shadow.camera.updateProjectionMatrix(); }
    return v;
  }
  const toOrbit = () => { if (S.cam === 'game') { const v = view(); Object.assign(S, { cam: 'orbit', az: v.az, el: v.el, dist: Math.min(200, v.dist) }); refreshPanel(); writeUrl(); } };
  const pointers = new Map();
  let pinch0 = 0, dist0 = 1;
  canvas.addEventListener('pointerdown', (e) => {
    try { canvas.setPointerCapture(e.pointerId); } catch { /* the pointer already ended: ignore */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dist0 = S.cam === 'game' ? S.zoom : S.dist; }
  });
  const end = (e) => { pointers.delete(e.pointerId); if (pointers.size === 0) writeUrl(); };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 1) {
      toOrbit();
      S.az = (S.az - dx * 0.4 + 360) % 360;
      S.el = Math.min(88, Math.max(4, S.el + dy * 0.3));
    } else if (pointers.size === 2 && pinch0 > 0) {
      const [a, b] = [...pointers.values()];
      const f = pinch0 / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y));
      if (S.cam === 'game') S.zoom = Math.min(2.5, Math.max(0.05, dist0 * f)); else S.dist = Math.min(200, Math.max(4, dist0 * f));
      refreshPanel();
    }
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const f = Math.exp(e.deltaY * 0.001);
    if (S.cam === 'game') S.zoom = Math.min(2.5, Math.max(0.05, S.zoom * f)); else S.dist = Math.min(200, Math.max(4, S.dist * f));
    refreshPanel(); writeUrl();
  }, { passive: false });

  // ---- panel ----
  function writeUrl() {
    window.history.replaceState(null, '', window.location.pathname + labParamsToSearch(window.location.search, S) + window.location.hash);
  }
  const chips = (host, items, isOn, onPick) => {
    const els = items.map(([id, label]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = label;
      b.addEventListener('click', () => onPick(id));
      host.appendChild(b);
      return [id, b];
    });
    return () => { for (const [id, b] of els) b.classList.toggle('on', isOn(id)); return els; };
  };
  const refreshers = [];
  refreshers.push(chips($('boats'), [['koster', 'Koster “Svalan”'], ['eka', 'Eka (1700)']], (id) => S.boat === id, (id) => { S.boat = id; buildBoat(); refreshPanel(); writeUrl(); }));
  const rigLabels = { 'gaff-jib': 'Gaff + jib', 'sprit-jib': 'Sprit + jib', gaff: 'Gaff only' };
  const rigRefresh = chips($('rigs'), KOSTER_RIGS.map((r) => [r, rigLabels[r]]), (id) => S.rig === id, (id) => { S.rig = id; if (S.boat === 'koster') { boat.setRig(id); } refreshPanel(); writeUrl(); });
  refreshers.push(() => { for (const [, b] of rigRefresh()) b.disabled = S.boat !== 'koster'; });
  refreshers.push(chips($('cams'), [['game', 'Game camera'], ['orbit', 'Orbit']], (id) => S.cam === id, (id) => {
    if (id === 'game') { S.cam = 'game'; S.zoom = 1; } else toOrbit();
    refreshPanel(); writeUrl();
  }));
  refreshers.push(chips($('light'), [['0', 'Day'], ['1', 'Night']], (id) => String(S.night) === id, (id) => { S.night = Number(id); applyLight(); refreshPanel(); writeUrl(); }));
  const itemLabels = { crate: 'Fish crate', barrel: 'Barrel', chest: 'Granddad’s chest' };
  const itemBoxes = {};
  for (const item of DECK_ITEMS) {
    const l = document.createElement('label'); l.className = 'tog';
    const i = document.createElement('input'); i.type = 'checkbox';
    const t = document.createElement('span'); t.textContent = itemLabels[item];
    l.append(i, t); $('items').appendChild(l); itemBoxes[item] = i;
    i.addEventListener('change', () => { S.items = DECK_ITEMS.filter((x) => (x === item ? i.checked : S.items.includes(x))); boat.setDeck(deckFromItems()); writeUrl(); });
  }
  const slider = (id, key, fmt, onInput) => {
    const el = $(id), out = $(`${id}Out`);
    el.addEventListener('input', () => { S[key] = Number(el.value); out.textContent = fmt(S[key]); onInput?.(); writeUrl(); });
    return () => { el.value = S[key]; out.textContent = fmt(S[key]); };
  };
  refreshers.push(slider('zoom', 'zoom', (v) => `×${v.toFixed(2)} of game`, () => { S.cam = 'game'; refreshPanel(); }));
  refreshers.push(slider('wear', 'wear', (v) => v.toFixed(2), () => boat.setWear(S.wear)));
  refreshers.push(slider('sail', 'sail', (v) => `${Math.round(v)}°`, () => boat.setSailAngle(S.sail * DEG)));
  refreshers.push(slider('heading', 'heading', (v) => `${Math.round(v)}°`));
  const colorEl = $('pennant');
  const setPennant = (hex) => { S.pennant = hex; boat.setPennantColor(hex); refreshPanel(); writeUrl(); };
  colorEl.addEventListener('input', () => setPennant(parseInt(colorEl.value.slice(1), 16)));
  refreshers.push(chips($('pennants'), [['ffcc66', 'Host'], ['66ccff', 'Guest'], ['e8708a', 'Rose']], (id) => S.pennant === parseInt(id, 16), (id) => setPennant(parseInt(id, 16))));
  function refreshPanel() {
    for (const r of refreshers) r();
    for (const item of DECK_ITEMS) itemBoxes[item].checked = S.items.includes(item);
    colorEl.value = `#${S.pennant.toString(16).padStart(6, '0')}`;
    $('zoom').closest('label').style.display = S.cam === 'game' ? '' : 'none';
    $('headname').textContent = `Boat Lab: ${S.boat === 'koster' ? `Svalan, ${rigLabels[S.rig]}` : 'eka 1700'}, ${S.night ? 'night' : 'day'}`;
  }
  $('head').addEventListener('click', () => { const open = $('panel').classList.toggle('open'); $('head').setAttribute('aria-expanded', String(open)); });
  $('copy').addEventListener('click', () => {
    const b = $('copy');
    window.navigator.clipboard?.writeText(window.location.href).then(() => { b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy link'; }, 1500); }, () => {});
  });
  if (new URLSearchParams(window.location.search).get('panel') === '1') $('panel').classList.add('open');

  function applyLight() {
    Object.assign(CONFIG, S.night ? NIGHT : DAY);
    hemi.color.set(CONFIG.HEMI_SKY_COLOR); hemi.groundColor.set(CONFIG.HEMI_GROUND_COLOR); hemi.intensity = CONFIG.HEMI_INTENSITY;
    sun.color.set(CONFIG.SUN_COLOR); sun.intensity = CONFIG.SUN_INTENSITY;
    boat.setNight(!!S.night);
  }
  applyLight();
  refreshPanel();

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
  }
  window.addEventListener('resize', resize);
  resize();

  let last = performance.now(), fps = 60, frames = 0;
  function frame(nowMs) {
    const dt = Math.min(0.1, (nowMs - last) / 1000);
    last = nowMs;
    if (dt > 0) fps += (1 / dt - fps) * 0.1;
    stepWaves(waves, dt, wind, 0, 0);
    boat.group.position.set(0, 0, 0);
    bob(boat.group, 0, 0, S.heading * DEG);
    boat.group.rotation.y = S.heading * DEG;
    water.update(waves, wind, boatPos, dt, camera.position);
    const v = placeCamera();
    sun.position.copy(boatPos).add(sunOffset);
    sun.target.position.copy(boatPos);
    scene.fog.color.set(CONFIG.HAZE_COLOR);
    scene.fog.near = v.dist * CONFIG.HAZE_MESH_NEAR_MUL;
    scene.fog.far = v.dist * CONFIG.HAZE_MESH_FAR_MUL;
    sky.update(camera);
    renderer.render(scene, camera);
    if (++frames % 15 === 0) {
      const d = boat.describe();
      $('badge').textContent = `${d.triangles.toLocaleString('en')} tris · ${d.meshes} meshes · ${fps.toFixed(0)} fps`;
      $('stats').textContent = `Boat: ${d.triangles.toLocaleString('en')} triangles in ${d.meshes} meshes (the sea, sky and light are the game's). Brief target: under ~3,000 per boat.`;
    }
    requestAnimationFrame(frame);
  }
  loading.remove();
  requestAnimationFrame(frame);

  // Handle for the headless checks; not used by the page.
  window.__boatLab = { ready: true, state: S, get boat() { return boat; }, describe: () => boat.describe(), renderer, scene, camera, setState(next) { Object.assign(S, next); buildBoat(); applyLight(); refreshPanel(); writeUrl(); } };
}

try { main(); } catch (err) {
  console.error(err);
  loading.className = 'err';
  loading.textContent = `the boat lab failed to start:\n${(err && err.stack) || err}`;
  window.__boatLabError = String((err && err.stack) || err);
}
