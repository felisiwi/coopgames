// Era Asset Lab (era-asset-lab.html): the Today and 1700 kits from era-assets.js on the game's own sea, sky, light and fixed
// camera angle (the same approach as boat-lab.js). "Game camera" = the in-game angle and height; drag to orbit instead.
// Dusk lights the windows (emissive only: no new lights). Everything in the panel is mirrored in the web address.
// Nothing here is used by the game. URL keys: see era-assets.js parseLabParams().
import * as THREE from '../vendor/three/three.module.js';
import { CONFIG } from './config.js';
import { createWater, createWaveState, stepWaves } from './water.js';
import { createSky } from './sky.js';
import { ASSETS, LAB_DEFAULTS, LAB_ORDER, FOCUS, COMPARE_GAP, createAsset, createCompare, defaultVariant, parseLabParams, labParamsToSearch, STRIPES, HOUSE_COLOURS } from './era-assets.js';

const $ = (id) => document.getElementById(id);
const loading = $('loading');
const DEG = Math.PI / 180;

// Dusk in the lab = a blue-hour evening (ART.md: never grim): dim cool light, a darker sea and sky. Day = config.js as it is.
const NIGHT = {
  SUN_COLOR: 0xaab8e8, SUN_INTENSITY: 0.85, HEMI_SKY_COLOR: 0x92a2d4, HEMI_GROUND_COLOR: 0x544c78, HEMI_INTENSITY: 1.5,
  SKY_HORIZON_COLOR: 0x4a5a8c, SKY_ZENITH_COLOR: 0x1c2650, HAZE_COLOR: 0x34406c, LOOK_SEA_BRIGHTNESS: 0.62,
};
const DAY = Object.fromEntries(Object.keys(NIGHT).map((k) => [k, CONFIG[k]]));
const LABELS = { navy: 'Navy', coral: 'Coral', sage: 'Sage', sand: 'Sand', cream: 'Cream', sky: 'Sky blue', rose: 'Falu rose', a: 'A · turf', b: 'B · tile + shed', c: 'C · long, chimney', d: 'D · sail brailed' };
const EKA_LABELS = { a: 'A · tarred, rust sail', b: 'B · grey, linen sail', c: 'C · ochre, patched, nets', d: 'D · sail brailed up' };
const VARIANT_TITLE = { sailboat: 'Stripe colour', motorboat: 'Stripe colour', summerhouse: 'Paint', cottage: 'Cottage', eka: 'Eka' };
const SWATCH = { ...Object.fromEntries(Object.entries(STRIPES).map(([k, v]) => [k, v])), ...Object.fromEntries(Object.entries(HOUSE_COLOURS).map(([k, v]) => [k, v])) };
const hex6 = (n) => `#${n.toString(16).padStart(6, '0')}`;

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

  const water = createWater(null); // open sea: no islands in the lab
  scene.add(water.mesh);
  const wind = { dir: 0.6, strength: 0.3 }; // a light breeze: the sea moves a little, nothing swallows the hulls
  const waves = createWaveState(wind.dir);

  // ---- the shown asset ----
  let shown = null;
  const target = new THREE.Vector3();
  function build() {
    if (shown) { scene.remove(shown.group); shown.dispose(); }
    shown = S.asset === 'compare' ? createCompare({ night: !!S.night }) : createAsset(S.asset, { variant: S.v, sails: !!S.sails, night: !!S.night });
    scene.add(shown.group);
  }
  // how far the camera must be to fit the asset on screen (phone portrait is the narrow case)
  const fitDist = () => {
    const frame = S.asset === 'compare' ? (S.focus === 'both' ? 29 : 31) : ASSETS[S.asset].frame;
    const aspect = canvas.clientWidth && canvas.clientHeight ? canvas.clientWidth / canvas.clientHeight : 0.46;
    return (frame * 1.15) / (Math.tan((CONFIG.FIXED_CAMERA_FOV_DEG * DEG) / 2) * Math.min(aspect, 1));
  };
  const targetFor = () => {
    const z = S.asset === 'compare' ? (S.focus === 'today' ? -COMPARE_GAP : S.focus === '1700' ? COMPARE_GAP : 0) : 0;
    return target.set(0, S.asset === 'compare' ? 0 : ASSETS[S.asset].frame * 0.1, z);
  };
  const GAME = { az: CONFIG.FIXED_CAMERA_AZIMUTH_DEG, el: CONFIG.FIXED_CAMERA_ELEVATION_DEG };
  const view = () => (S.cam === 'game' ? { az: GAME.az, el: GAME.el, dist: fitDist() * S.zoom } : { az: S.az, el: S.el, dist: S.dist });
  function placeCamera() {
    const v = view();
    const a = v.az * DEG, e = v.el * DEG;
    const t = targetFor();
    camera.position.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(v.dist).add(t);
    camera.near = Math.min(CONFIG.CAMERA_NEAR, Math.max(0.05, v.dist * 0.05));
    camera.far = Math.max(2500, v.dist * 8);
    camera.updateProjectionMatrix();
    camera.lookAt(t);
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
      if (S.cam === 'game') S.zoom = Math.min(3, Math.max(0.05, dist0 * f)); else S.dist = Math.min(300, Math.max(3, dist0 * f));
      refreshPanel();
    }
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const f = Math.exp(e.deltaY * 0.001);
    if (S.cam === 'game') S.zoom = Math.min(3, Math.max(0.05, S.zoom * f)); else S.dist = Math.min(300, Math.max(3, S.dist * f));
    refreshPanel(); writeUrl();
  }, { passive: false });

  // ---- panel ----
  function writeUrl() { window.history.replaceState(null, '', window.location.pathname + labParamsToSearch(window.location.search, S) + window.location.hash); }
  const chipsIn = (host, items, isOn, onPick) => {
    const els = items.map(([id, label, swatch]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip';
      if (swatch != null) b.innerHTML = `<span class="dot" style="background:${hex6(swatch)}"></span>`;
      b.append(document.createTextNode(label));
      b.addEventListener('click', () => onPick(id));
      host.appendChild(b);
      return [id, b];
    });
    return () => { for (const [id, b] of els) b.classList.toggle('on', isOn(id)); };
  };
  const refreshers = [];
  const pickAsset = (id) => { S.asset = id; S.v = defaultVariant(id); S.rot = LAB_DEFAULTS.rot; S.zoom = 1; build(); applyLight(); refreshPanel(); writeUrl(); };
  refreshers.push(chipsIn($('todays'), LAB_ORDER.filter((id) => ASSETS[id]?.era === 'today').map((id) => [id, ASSETS[id].label]), (id) => S.asset === id, pickAsset));
  refreshers.push(chipsIn($('olds'), LAB_ORDER.filter((id) => ASSETS[id]?.era === '1700').map((id) => [id, ASSETS[id].label]), (id) => S.asset === id, pickAsset));
  refreshers.push(chipsIn($('compare'), [['compare', 'Today vs 1700']], (id) => S.asset === id, pickAsset));
  refreshers.push(chipsIn($('focus'), [['both', 'Both'], ['today', 'Today'], ['1700', '1700']], (id) => S.focus === id, (id) => { S.focus = id; refreshPanel(); writeUrl(); }));
  refreshers.push(chipsIn($('cams'), [['game', 'Game camera'], ['orbit', 'Orbit'], ['scale', 'True game scale']], (id) => S.cam === id && id !== 'scale', (id) => {
    if (id === 'game') { S.cam = 'game'; S.zoom = 1; } else if (id === 'scale') { S.cam = 'game'; S.zoom = CONFIG.FIXED_CAMERA_DISTANCE / fitDist(); } else toOrbit();
    refreshPanel(); writeUrl();
  }));
  // variant chips are rebuilt whenever the asset changes
  function rebuildVariants() {
    const host = $('variants');
    host.replaceChildren();
    const def = ASSETS[S.asset];
    const list = S.asset !== 'compare' && def ? def.variants : [];
    $('variantBox').hidden = list.length === 0;
    if (!list.length) return () => {};
    $('variantLabel').textContent = VARIANT_TITLE[S.asset] ?? 'Variant';
    return chipsIn(host, list.map((v) => [v, S.asset === 'eka' ? EKA_LABELS[v] : (LABELS[v] ?? v), SWATCH[v]]), (id) => S.v === id, (id) => { S.v = id; build(); applyLight(); refreshPanel(); writeUrl(); });
  }
  let variantRefresh = () => {};
  function rebuildToggles() {
    const host = $('togBox');
    host.replaceChildren();
    const toggles = S.asset !== 'compare' ? ASSETS[S.asset]?.toggles ?? [] : [];
    for (const t of toggles) {
      const l = document.createElement('label'); l.className = 'tog';
      const i = document.createElement('input'); i.type = 'checkbox'; i.checked = !!S[t];
      const s = document.createElement('span'); s.textContent = 'Sails up';
      l.append(i, s); host.appendChild(l);
      i.addEventListener('change', () => { S[t] = i.checked ? 1 : 0; build(); applyLight(); writeUrl(); });
    }
  }
  const slider = (id, key, fmt, onInput) => {
    const el = $(id), out = $(`${id}Out`);
    el.addEventListener('input', () => { S[key] = Number(el.value); out.textContent = fmt(S[key]); onInput?.(); writeUrl(); });
    return () => { el.value = S[key]; out.textContent = fmt(S[key]); };
  };
  refreshers.push(slider('zoom', 'zoom', (v) => `×${v.toFixed(2)}`, () => { S.cam = 'game'; refreshPanel(); }));
  refreshers.push(slider('rot', 'rot', (v) => `${Math.round(v)}°`));
  let builtFor = '';
  function refreshPanel() {
    if (builtFor !== S.asset) { variantRefresh = rebuildVariants(); rebuildToggles(); builtFor = S.asset; }
    for (const r of refreshers) r();
    variantRefresh();
    const def = S.asset === 'compare' ? null : ASSETS[S.asset];
    $('zoom').closest('label').hidden = S.cam !== 'game';
    $('rotBox').hidden = S.asset === 'compare';
    $('focusBox').hidden = S.asset !== 'compare';
    const name = S.asset === 'compare' ? 'Today vs 1700' : def.label;
    $('tname').textContent = name;
    $('headname').textContent = `Era Asset Lab: ${name}, ${S.night ? 'dusk' : 'day'}`;
    $('dusk').textContent = S.night ? 'Dusk' : 'Day';
    $('dusk').classList.toggle('on', !!S.night);
    $('dusk').setAttribute('aria-pressed', String(!!S.night));
  }
  const step = (d) => { const i = LAB_ORDER.indexOf(S.asset); pickAsset(LAB_ORDER[(i + d + LAB_ORDER.length) % LAB_ORDER.length]); };
  $('prev').addEventListener('click', () => step(-1));
  $('next').addEventListener('click', () => step(1));
  $('dusk').addEventListener('click', () => { S.night = S.night ? 0 : 1; applyLight(); refreshPanel(); writeUrl(); });
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
    shown.setNight(!!S.night);
  }
  build();
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
    if (S.asset !== 'compare') shown.group.rotation.y = S.rot * DEG;
    const v = placeCamera();
    water.update(waves, wind, target, dt, camera.position);
    sun.position.copy(target).add(sunOffset);
    sun.target.position.copy(target);
    scene.fog.color.set(CONFIG.HAZE_COLOR);
    scene.fog.near = v.dist * CONFIG.HAZE_MESH_NEAR_MUL;
    scene.fog.far = v.dist * CONFIG.HAZE_MESH_FAR_MUL;
    sky.update(camera);
    renderer.render(scene, camera);
    if (++frames % 15 === 0) {
      const d = shown.describe();
      const part = d.today != null ? ` (Today ${d.today.toLocaleString('en')} + 1700 ${d.y1700.toLocaleString('en')})` : '';
      $('tsub').textContent = `${d.triangles.toLocaleString('en')} triangles${part} · ${fps.toFixed(0)} fps`;
      $('stats').textContent = `${d.triangles.toLocaleString('en')} triangles in ${d.meshes} meshes${d.windows != null ? ` (${d.windows} of them windows)` : ''}${S.asset === 'compare' ? '' : `. Budget: ${ASSETS[S.asset].maxTris.toLocaleString('en')}`}. The sea, sky and light are the game's.`;
    }
    requestAnimationFrame(frame);
  }
  loading.remove();
  requestAnimationFrame(frame);

  // Handle for the headless checks; not used by the page.
  window.__eraLab = { ready: true, state: S, get shown() { return shown; }, describe: () => shown.describe(), renderer, scene, camera, setState(next) { Object.assign(S, next); build(); applyLight(); refreshPanel(); writeUrl(); } };
}

try { main(); } catch (err) {
  console.error(err);
  loading.className = 'err';
  loading.textContent = `the era asset lab failed to start:\n${(err && err.stack) || err}`;
}
