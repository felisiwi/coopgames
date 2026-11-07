// Landmark Lab (landmark-lab.html): the landmark kit from landmark-assets.js on the game's own sea, sky, light and fixed camera angle (the same approach as era-asset-lab.js).
// SHELF: every type and variant that stood in an era, on granite plinths, each with a 1.5 m figure for scale. "Game camera" = the in-game angle and height; drag to orbit instead.
// Dusk lights the windows and lanterns (emissive only: no new lights). Everything in the panel is mirrored in the web address (see landmark-lab-params.js).
// Nothing here is used by the game.
import * as THREE from '../vendor/three/three.module.js';
import { CONFIG } from './config.js';
import { createWater, createWaveState, stepWaves } from './water.js';
import { createSky } from './sky.js';
import { createAsset } from './era-assets.js';
import { TYPE_IDS, LANDMARK_TYPES, createLandmark } from './landmark-assets.js';
import { LAB_DEFAULTS, LAB_ERAS, parseLabParams, labParamsToSearch, shelfEntries, layoutShelf } from './landmark-lab-params.js';

const $ = (id) => document.getElementById(id);
const loading = $('loading');
const DEG = Math.PI / 180;
const PLINTH_TOP = 0.3; // the granite plinths stand a little proud of the sea

// Dusk in the lab = a blue-hour evening (ART.md: never grim). Day = config.js as it is.
const NIGHT = {
  SUN_COLOR: 0xaab8e8, SUN_INTENSITY: 0.85, HEMI_SKY_COLOR: 0x92a2d4, HEMI_GROUND_COLOR: 0x544c78, HEMI_INTENSITY: 1.5,
  SKY_HORIZON_COLOR: 0x4a5a8c, SKY_ZENITH_COLOR: 0x1c2650, HAZE_COLOR: 0x34406c, LOOK_SEA_BRIGHTNESS: 0.62,
};
const DAY = Object.fromEntries(Object.keys(NIGHT).map((k) => [k, CONFIG[k]]));
const ERA_LABEL = { 1703: '1703', 1950: '1950', today: 'Today', all: 'All eras (+ 1800s)' };
const plinthMat = new THREE.MeshLambertMaterial({ color: 0xe3c9c1, flatShading: true });

function main() {
  const S = parseLabParams(window.location.search);
  const canvas = $('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const isPhone = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isPhone ? CONFIG.PHONE_MAX_PIXEL_RATIO : Infinity));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const sky = createSky();
  scene.add(sky.mesh);
  const camera = new THREE.PerspectiveCamera(CONFIG.FIXED_CAMERA_FOV_DEG, 1, 1, 2500);
  const hemi = new THREE.HemisphereLight(CONFIG.HEMI_SKY_COLOR, CONFIG.HEMI_GROUND_COLOR, CONFIG.HEMI_INTENSITY);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(CONFIG.SUN_COLOR, CONFIG.SUN_INTENSITY);
  const az = CONFIG.LIGHT_AZIMUTH_DEG * DEG, el = CONFIG.LIGHT_ELEVATION_DEG * DEG;
  const sunOffset = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { near: 1, far: 600, left: -150, right: 150, top: 150, bottom: -150 });
  sun.shadow.bias = CONFIG.SUN_SHADOW_BIAS;
  sun.shadow.normalBias = 0.25;
  scene.add(sun, sun.target);
  scene.fog = new THREE.Fog(CONFIG.HAZE_COLOR, 1e6, 2e6);

  const water = createWater(null); // open sea: no islands in the shelf
  scene.add(water.mesh);
  const wind = { dir: 0.6, strength: 0.3 }; // a light breeze: the sea moves a little
  const waves = createWaveState(wind.dir);

  // ---- the shelf ----
  let shown = null; // { group, items, layout, setNight, describe, dispose }
  const target = new THREE.Vector3();
  const aspectNow = () => (canvas.clientWidth && canvas.clientHeight ? canvas.clientWidth / canvas.clientHeight : 0.46);
  function build() {
    if (shown) { scene.remove(shown.group); shown.dispose(); }
    $('labels').replaceChildren();
    const entries = shelfEntries({ era: S.era, type: S.type, v: S.v });
    $('labels').classList.toggle('dense', entries.length > 12);
    const smallOnes = entries.every((e) => LANDMARK_TYPES[e.type].frame <= 8);
    const lay = layoutShelf(entries, { perRow: S.v ? 1 : aspectNow() < 0.9 ? (smallOnes ? 3 : 2) : smallOnes ? 4 : 3 });
    const group = new THREE.Group();
    const items = [];
    for (const it of lay.items) {
      const lm = createLandmark(it.type, { variant: it.variant, era: it.era, night: !!S.night, ...it.opts });
      const k = S.rs ? lm.readScale : 1;
      lm.group.scale.setScalar(k);
      const box = new THREE.Box3().setFromObject(lm.group);
      const r = Math.max(1.5, 0.52 * Math.hypot(box.max.x - box.min.x, box.max.z - box.min.z)); // the plinth fits the real footprint
      const cell = new THREE.Group();
      cell.position.set(it.x, 0, it.z);
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.15, 0.9, 9), plinthMat);
      plinth.position.y = PLINTH_TOP - 0.45; plinth.castShadow = true; plinth.receiveShadow = true;
      lm.group.position.y = PLINTH_TOP;
      lm.group.rotation.y = 0;
      cell.add(plinth, lm.group);
      let fig = null;
      if (S.fig) { fig = createAsset('figure1950', { variant: 'boy', night: !!S.night }); fig.group.position.set(r * 0.85, PLINTH_TOP, r * 0.5); cell.add(fig.group); }
      group.add(cell);
      const el2 = document.createElement('div');
      el2.className = 'lab';
      const esc = (t) => String(t).replace(/</g, '&lt;');
      const m = it.label.match(/^(.*?) \((.*)\)$/), c = it.label.split(': ');
      const main = m ? m[1] : c.length > 1 ? c.slice(1).join(': ') : it.label;
      const sub = m ? m[2] : c.length > 1 ? c[0] : '';
      el2.innerHTML = `${esc(main)}${sub ? `<small>${esc(sub)}</small>` : ''}${S.era === 'all' ? `<small>${esc(it.eraLabel ?? '')}</small>` : ''}`;
      $('labels').appendChild(el2);
      items.push({ it, lm, fig, cell, label: el2, anchor: new THREE.Vector3(it.x, 0.35, it.z + r * 1.1), height: box.max.y, turn: lm.group });
    }
    scene.add(group);
    shown = {
      group, items, layout: lay, entries,
      setNight(on) { for (const x of items) { x.lm.setNight(on); x.fig?.setNight(on); } },
      describe: () => ({ entries: items.length, triangles: items.reduce((s, x) => s + x.lm.describe().triangles, 0), items: items.map((x) => x.lm.describe()) }),
      dispose() { for (const x of items) { x.lm.dispose(); x.fig?.dispose(); } },
    };
  }
  // how far the camera must be to fit the whole shelf on screen (phone portrait is the narrow case)
  const fitDist = () => {
    const lay = shown.layout, asp = aspectNow();
    const fov = CONFIG.FIXED_CAMERA_FOV_DEG * DEG, e = CONFIG.FIXED_CAMERA_ELEVATION_DEG * DEG;
    const tall = Math.max(4, ...shown.items.map((x) => x.height));
    const needW = (lay.width / 2 + 1.5) / (Math.tan(fov / 2) * Math.min(asp, 5));
    const needD = ((lay.depth * Math.sin(e) + tall * Math.cos(e)) / 2 + 1.5) / Math.tan(fov / 2);
    return Math.max(needW, needD) * (shown.items.length > 12 ? 1.3 : 1.12); // a dense shelf gets extra room so nothing is cut off at the edge
  };
  const GAME = { az: CONFIG.FIXED_CAMERA_AZIMUTH_DEG, el: CONFIG.FIXED_CAMERA_ELEVATION_DEG };
  const view = () => (S.cam === 'game' ? { az: GAME.az, el: GAME.el, dist: fitDist() * S.zoom } : { az: S.az, el: S.el, dist: S.dist });
  function placeCamera() {
    const v = view();
    const a = v.az * DEG, e = v.el * DEG;
    const tall = Math.max(4, ...shown.items.map((x) => x.height));
    target.set(0, tall * 0.28, 0);
    camera.position.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(v.dist).add(target);
    camera.near = Math.min(CONFIG.CAMERA_NEAR, Math.max(0.05, v.dist * 0.05));
    camera.far = Math.max(2500, v.dist * 8);
    camera.updateProjectionMatrix();
    camera.lookAt(target);
    const s = Math.min(150, Math.max(14, v.dist * 0.9));
    if (sun.shadow.camera.right !== s) { Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s }); sun.shadow.camera.updateProjectionMatrix(); }
    return v;
  }
  const toOrbit = () => { if (S.cam === 'game') { const v = view(); Object.assign(S, { cam: 'orbit', az: v.az, el: v.el, dist: Math.min(300, v.dist) }); refreshPanel(); writeUrl(); } };
  const pointers = new Map();
  let pinch0 = 0, dist0 = 1;
  canvas.addEventListener('pointerdown', (e) => {
    try { canvas.setPointerCapture(e.pointerId); } catch { /* the pointer already ended */ }
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
      if (S.cam === 'game') S.zoom = Math.min(3, Math.max(0.05, dist0 * f)); else S.dist = Math.min(400, Math.max(3, dist0 * f));
      refreshPanel();
    }
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const f = Math.exp(e.deltaY * 0.001);
    if (S.cam === 'game') S.zoom = Math.min(3, Math.max(0.05, S.zoom * f)); else S.dist = Math.min(400, Math.max(3, S.dist * f));
    refreshPanel(); writeUrl();
  }, { passive: false });

  // ---- panel ----
  function writeUrl() { window.history.replaceState(null, '', window.location.pathname + labParamsToSearch(window.location.search, S) + window.location.hash); }
  const chipsIn = (host, items, isOn, onPick) => {
    const els = items.map(([id, label]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = label;
      b.addEventListener('click', () => onPick(id));
      host.appendChild(b);
      return [id, b];
    });
    return () => els.forEach(([id, b]) => b.classList.toggle('on', isOn(id)));
  };
  const rebuild = () => { build(); fillVariants(); applyLight(); refreshPanel(); writeUrl(); };
  const setType = (t) => { S.type = t; S.v = ''; S.zoom = 1; rebuild(); };
  const typeLabel = (t) => (t === 'all' ? 'All types' : LANDMARK_TYPES[t].label.replace(/ \(.*/, ''));
  const syncEras = chipsIn($('eras'), LAB_ERAS.map((e) => [e, ERA_LABEL[e]]), (id) => S.era === id, (id) => { S.era = id; S.zoom = 1; rebuild(); });
  const syncTypes = chipsIn($('types'), ['all', ...TYPE_IDS].map((t) => [t, typeLabel(t)]), (id) => S.type === id && !S.v, setType);
  let syncVariants = () => {};
  function fillVariants() {
    $('variants').replaceChildren();
    const here = shown.entries.filter((e) => S.type === 'all' || e.type === S.type).filter((e, i, a) => a.findIndex((x) => x.variant === e.variant) === i);
    $('variantBox').hidden = S.type === 'all';
    syncVariants = chipsIn($('variants'), [['', 'Whole shelf'], ...here.map((e) => [e.variant, e.label.replace(/ \(.*/, '').replace(/^[^:]*: /, '')])], (id) => S.v === id, (id) => { S.v = id; S.zoom = 1; rebuild(); });
  }
  const camSync = chipsIn($('cams'), [['game', 'Game camera'], ['orbit', 'Free orbit']], (id) => S.cam === id, (id) => { if (id === 'orbit') toOrbit(); else { S.cam = 'game'; S.zoom = 1; refreshPanel(); writeUrl(); } });
  $('fig').addEventListener('change', (e) => { S.fig = e.target.checked ? 1 : 0; rebuild(); });
  $('rs').addEventListener('change', (e) => { S.rs = e.target.checked ? 1 : 0; rebuild(); });
  $('zoom').addEventListener('input', (e) => { const v = Number(e.target.value); if (S.cam === 'game') S.zoom = v; else S.dist = v * 100; refreshPanel(); });
  $('zoom').addEventListener('change', writeUrl);
  $('rot').addEventListener('input', (e) => { S.rot = Number(e.target.value); refreshPanel(); });
  $('rot').addEventListener('change', writeUrl);
  $('dusk').addEventListener('click', () => { S.night = S.night ? 0 : 1; applyLight(); refreshPanel(); writeUrl(); });
  $('prev').addEventListener('click', () => { const ids = ['all', ...TYPE_IDS]; setType(ids[(ids.indexOf(S.type) + ids.length - 1) % ids.length]); });
  $('next').addEventListener('click', () => { const ids = ['all', ...TYPE_IDS]; setType(ids[(ids.indexOf(S.type) + 1) % ids.length]); });
  $('head').addEventListener('click', () => { const open = $('panel').classList.toggle('open'); $('head').setAttribute('aria-expanded', String(open)); });
  $('copy').addEventListener('click', () => {
    const b = $('copy');
    window.navigator.clipboard?.writeText(window.location.href).then(() => { b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy link'; }, 1500); }, () => {});
  });
  if (new URLSearchParams(window.location.search).get('panel') === '1') $('panel').classList.add('open');

  function refreshPanel() {
    syncEras(); syncTypes(); syncVariants(); camSync();
    $('fig').checked = !!S.fig; $('rs').checked = !!S.rs;
    $('zoom').value = S.cam === 'game' ? S.zoom : S.dist / 100;
    $('zoomOut').textContent = S.cam === 'game' ? `${S.zoom.toFixed(2)}×` : `${S.dist.toFixed(0)} m`;
    $('rot').value = S.rot; $('rotOut').textContent = `${Math.round(S.rot)}°`; $('rotBox').hidden = !S.v;
    const one = S.v ? shown.entries[0] : null;
    $('tname').textContent = one ? one.label : `${typeLabel(S.type)} · ${ERA_LABEL[S.era]}`;
    $('headname').textContent = `Landmark Lab: ${one ? one.label : typeLabel(S.type)}, ${ERA_LABEL[S.era]}, ${S.night ? 'dusk' : 'day'}`;
    $('dusk').textContent = S.night ? 'Dusk' : 'Day';
    $('dusk').classList.toggle('on', !!S.night);
    $('dusk').setAttribute('aria-pressed', String(!!S.night));
    $('info').innerHTML = one ? infoFor(one) : `<b>${shown.items.length}</b> looks on the shelf. Tap one under “One variant” to turn it and read where it comes from.`;
  }
  function infoFor(entry) {
    const t = LANDMARK_TYPES[entry.type], v = t.variants[entry.variant];
    const esc = (s) => String(s ?? '').replace(/</g, '&lt;');
    return `<b>${esc(v.label)}</b><br>Source: ${esc(v.source)} (${esc(v.confidence)}).<br>${esc(v.real?.note ?? '')}${v.real?.heightM ? ` Height from the source: ${v.real.heightM} m.` : ''}${v.eraNote ? `<br>${esc(v.eraNote)}` : ''}<br><i>Designer's choice:</i> ${esc((v.designer ?? []).join('; ') || 'nothing')}.<br>Game read scale: x${t.readScale}.`;
  }
  function applyLight() {
    Object.assign(CONFIG, S.night ? NIGHT : DAY);
    hemi.color.set(CONFIG.HEMI_SKY_COLOR); hemi.groundColor.set(CONFIG.HEMI_GROUND_COLOR); hemi.intensity = CONFIG.HEMI_INTENSITY;
    sun.color.set(CONFIG.SUN_COLOR); sun.intensity = CONFIG.SUN_INTENSITY;
    shown.setNight(!!S.night);
  }
  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
  }
  window.addEventListener('resize', resize);
  resize();
  build();
  fillVariants();
  applyLight();
  refreshPanel();

  const v3 = new THREE.Vector3();
  let last = performance.now(), fps = 60, frames = 0;
  function frame(nowMs) {
    const dt = Math.min(0.1, (nowMs - last) / 1000);
    last = nowMs;
    if (dt > 0) fps += (1 / dt - fps) * 0.1;
    stepWaves(waves, dt, wind, 0, 0);
    if (S.v) for (const x of shown.items) x.turn.rotation.y = S.rot * DEG;
    const v = placeCamera();
    water.update(waves, wind, target, dt, camera.position);
    sun.position.copy(target).add(sunOffset);
    sun.target.position.copy(target);
    scene.fog.color.set(CONFIG.HAZE_COLOR);
    scene.fog.near = v.dist * CONFIG.HAZE_MESH_NEAR_MUL;
    scene.fog.far = v.dist * CONFIG.HAZE_MESH_FAR_MUL;
    sky.update(camera);
    renderer.render(scene, camera);
    // labels follow their landmark
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    for (const x of shown.items) {
      v3.copy(x.anchor).project(camera);
      const on = v3.z < 1 && Math.abs(v3.x) < 1.2 && Math.abs(v3.y) < 1.2;
      x.label.classList.toggle('gone', !on);
      if (on) x.label.style.transform = `translate(${(v3.x * 0.5 + 0.5) * cw}px, ${(-v3.y * 0.5 + 0.5) * ch}px) translate(-50%, 0)`;
    }
    if (++frames % 15 === 0) {
      const d = shown.describe();
      $('tsub').textContent = `${d.entries} on the shelf · ${d.triangles.toLocaleString('en')} triangles · ${fps.toFixed(0)} fps`;
      $('stats').textContent = `${d.entries} looks, ${d.triangles.toLocaleString('en')} triangles in total.`;
    }
    requestAnimationFrame(frame);
  }
  loading.remove();
  requestAnimationFrame(frame);

  // Handle for the headless checks and screenshots; not used by the page.
  window.__landmarkLab = {
    ready: true, state: S, get shown() { return shown; }, describe: () => shown.describe(), renderer, scene, camera,
    setState(next) { Object.assign(S, next); build(); fillVariants(); applyLight(); refreshPanel(); writeUrl(); },
  };
}

try { main(); } catch (err) {
  console.error(err);
  loading.className = 'err';
  loading.textContent = `the landmark lab failed to start:\n${(err && err.stack) || err}`;
}
