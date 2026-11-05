// Terrain Style Lab (terrain-lab.html): the real Grundsund coast, the game's camera, light, sea and Skagen
// palette, with the land-cover style switchable from a phone-sized panel. The style itself lives in
// terrain-style.js; this file is only the page around it. Nothing here is used by the game.
//
// URL: ?preset=<current|crisp|rocks|terraced|painted>, or single keys (crisp, soft, rock, slope, terrace, step,
// line, grain); ?at=<place name>; ?zoom=<0.4..3>; ?view=<x>,<z> (game metres); ?ssmooth=<blur passes>.
// Look-panel params (LOOK_*) are honoured too, so a link can combine both.
import * as THREE from '../vendor/three/three.module.js';
import { CONFIG } from './config.js';
import { applyValues, parseLookParams } from './look-presets.js';
import { refreshPalette } from './island-look.js';
import { loadRealCoast } from './coast-world.js';
import { createWater, createWaveState, stepWaves } from './water.js';
import { createSky } from './sky.js';
import { snapFixedCamera } from './camera.js';
import { STYLE_SPECS, PRESET_LABELS, STYLE_PRESETS, attachTerrainStyle, parseStyleParams, presetMatching, styleToSearch } from './terrain-style.js';

const $ = (id) => document.getElementById(id);
const loading = $('loading');
const query = new URLSearchParams(window.location.search);
const PLACE_NAMES = ['Grundsund', 'Käringön', 'Gullholmen', 'Fiskebäckskil', 'Lysekil', 'Härmanö', 'Måseskär'];

async function main() {
  applyValues(CONFIG, parseLookParams(window.location.search));
  refreshPalette();

  const canvas = $('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const isPhone = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isPhone ? CONFIG.PHONE_MAX_PIXEL_RATIO : Infinity));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap is deprecated in this three.js

  const scene = new THREE.Scene();
  const sky = createSky();
  scene.add(sky.mesh);
  const camera = new THREE.PerspectiveCamera(CONFIG.FIXED_CAMERA_FOV_DEG, 1, CONFIG.CAMERA_NEAR, 2000);
  // Light: the game's (game.js startGame), anchored to the view target instead of the boat.
  const hemi = new THREE.HemisphereLight(CONFIG.HEMI_SKY_COLOR, CONFIG.HEMI_GROUND_COLOR, CONFIG.HEMI_INTENSITY);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(CONFIG.SUN_COLOR, CONFIG.SUN_INTENSITY);
  const az = (CONFIG.LIGHT_AZIMUTH_DEG * Math.PI) / 180;
  const el = (CONFIG.LIGHT_ELEVATION_DEG * Math.PI) / 180;
  const sunOffset = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { near: 1, far: 500, left: -150, right: 150, top: 150, bottom: -150 });
  sun.shadow.radius = 4;
  sun.shadow.bias = CONFIG.SUN_SHADOW_BIAS;
  sun.shadow.normalBias = 0.25;
  scene.add(sun, sun.target);
  scene.fog = new THREE.Fog(CONFIG.HAZE_COLOR, 1e6, 2e6);

  // The real coast, loaded exactly as the game does (terrain chunks, trees near the view, villages, lighthouses).
  const coast = await loadRealCoast({ seed: 1 });
  const world = coast.world;
  const water = createWater(coast.depthMap);
  scene.add(water.mesh, coast.group);
  const wind = { dir: 0.6, strength: 0.5 };
  const waves = createWaveState(wind.dir);

  // The style under test: swaps the terrain meshes' material between the current vertex paint and the shader.
  const passes = Number(query.get('ssmooth'));
  let values = parseStyleParams(window.location.search);
  const hook = attachTerrainStyle(coast.terrain, world, values, passes > 0 ? { passes } : {});

  // ---- view: a target on the ground, the game's fixed camera direction, drag to pan, pinch / wheel to zoom ----
  const target = new THREE.Vector3();
  let zoom = Math.min(3, Math.max(0.4, Number(query.get('zoom')) || 1));
  const places = [];
  if (coast.spawn) places.push({ name: 'Start (Grundsund harbour)', x: coast.spawn.x, z: coast.spawn.z });
  for (const n of PLACE_NAMES) {
    const hit = coast.names.find((e) => e.name === n && !places.some((p) => p.name === n));
    if (hit) places.push({ name: hit.name, x: hit.x, z: hit.z });
  }
  function lookAt(x, z) {
    target.set(x, 0, z);
    clampTarget();
  }
  function clampTarget() {
    const m = 120;
    target.x = Math.min(world.bounds.maxX - m, Math.max(world.bounds.minX + m, target.x));
    target.z = Math.min(world.bounds.maxZ - m, Math.max(world.bounds.minZ + m, target.z));
    target.y = Math.max(0, world.heightAt(target.x, target.z));
  }
  const viewParam = (query.get('view') || '').split(',').map(Number);
  const startPlace = places.find((p) => p.name === query.get('at')) || places[0];
  if (viewParam.length === 2 && viewParam.every(Number.isFinite)) lookAt(viewParam[0], viewParam[1]);
  else lookAt(startPlace.x, startPlace.z);

  const pointers = new Map();
  let pinchStart = 0;
  let zoomStart = 1;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchStart = Math.hypot(a.x - b.x, a.y - b.y); zoomStart = zoom; }
  });
  const endPointer = (e) => pointers.delete(e.pointerId);
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (pointers.size === 1) {
      // metres of ground per screen pixel at the target; the ground is foreshortened vertically by sin(elevation)
      const dist = CONFIG.FIXED_CAMERA_DISTANCE * zoom;
      const mpp = (2 * dist * Math.tan((CONFIG.FIXED_CAMERA_FOV_DEG * Math.PI) / 360)) / (canvas.clientHeight || 1);
      const fx = target.x - camera.position.x;
      const fz = target.z - camera.position.z;
      const len = Math.hypot(fx, fz) || 1;
      const fwd = [fx / len, fz / len];
      const right = [-fwd[1], fwd[0]];
      const vScale = 1 / Math.sin((CONFIG.FIXED_CAMERA_ELEVATION_DEG * Math.PI) / 180);
      target.x += -right[0] * dx * mpp + fwd[0] * dy * mpp * vScale;
      target.z += -right[1] * dx * mpp + fwd[1] * dy * mpp * vScale;
      clampTarget();
    } else if (pointers.size === 2 && pinchStart > 0) {
      const [a, b] = [...pointers.values()];
      zoom = Math.min(3, Math.max(0.4, (zoomStart * pinchStart) / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y))));
    }
  });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoom = Math.min(3, Math.max(0.4, zoom * Math.exp(e.deltaY * 0.001))); }, { passive: false });

  // ---- panel ----
  const controls = $('controls');
  const presetsEl = $('presets');
  const rows = {};
  function writeUrl() {
    const search = styleToSearch(window.location.search, values);
    const params = new URLSearchParams(search);
    const place = places.find((p) => p.name === $('places').value);
    if (place && place !== places[0]) params.set('at', place.name); else params.delete('at');
    const text = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (text ? `?${text}` : '') + window.location.hash);
  }
  function setValues(next) {
    values = { ...next };
    hook.apply(values);
    refreshPanel();
    writeUrl();
  }
  function toggle(key, label) {
    const wrap = document.createElement('label');
    wrap.className = 'tog';
    const input = document.createElement('input');
    input.type = 'checkbox';
    const text = document.createElement('span');
    text.textContent = label;
    wrap.append(input, text);
    input.addEventListener('change', () => setValues({ ...values, [key]: input.checked ? 1 : 0 }));
    controls.appendChild(wrap);
    rows[key] = { wrap, input };
  }
  function slider(key, label, endsLeft, endsRight, step, fmt) {
    const spec = STYLE_SPECS[key];
    const wrap = document.createElement('label');
    wrap.className = 'slider';
    wrap.innerHTML = `<span class="top"><span>${label}</span><output></output></span><input type="range" min="${spec.min}" max="${spec.max}" step="${step}"><span class="ends"><span>${endsLeft}</span><span>${endsRight}</span></span>`;
    const input = wrap.querySelector('input');
    input.addEventListener('input', () => setValues({ ...values, [key]: Number(input.value) }));
    controls.appendChild(wrap);
    rows[key] = { wrap, input, out: wrap.querySelector('output'), fmt };
  }
  toggle('crisp', 'Crisp zones');
  slider('soft', 'Edge softness', 'crisp', 'soft', 0.01, (v) => v.toFixed(2));
  toggle('rock', 'Rock on steep slopes');
  slider('slope', 'Slope threshold', 'gentler', 'steeper', 1, (v) => `${Math.round(v)}°`);
  toggle('terrace', 'Terraces');
  slider('step', 'Terrace step', 'fine', 'coarse', 0.25, (v) => `${v.toFixed(2)} m`);
  toggle('line', 'Edge lines where zones meet');
  toggle('grain', 'Fine grain');
  const presetBtns = {};
  for (const [id, label] of PRESET_LABELS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = label;
    b.addEventListener('click', () => setValues({ ...STYLE_PRESETS[id] }));
    presetsEl.appendChild(b);
    presetBtns[id] = b;
  }
  const dependsOn = { soft: 'crisp', rock: 'crisp', slope: 'rock', terrace: 'crisp', step: 'terrace', line: 'crisp', grain: 'crisp' };
  function refreshPanel() {
    const matched = presetMatching(values);
    for (const [id, b] of Object.entries(presetBtns)) b.classList.toggle('on', id === matched);
    $('headname').textContent = `Terrain style: ${matched ? PRESET_LABELS.find(([id]) => id === matched)[1] : 'custom'}`;
    for (const [key, row] of Object.entries(rows)) {
      if (STYLE_SPECS[key].type === 'bool') row.input.checked = !!values[key];
      else { row.input.value = values[key]; row.out.textContent = row.fmt(values[key]); }
      const dep = dependsOn[key];
      const active = !dep || (values[dep] && (!dependsOn[dep] || values[dependsOn[dep]]));
      row.wrap.classList.toggle('dim', !active);
    }
  }
  const placeSel = $('places');
  for (const p of places) placeSel.add(new Option(p.name, p.name));
  placeSel.value = startPlace.name;
  placeSel.addEventListener('change', () => {
    const p = places.find((q) => q.name === placeSel.value);
    if (p) { lookAt(p.x, p.z); writeUrl(); }
  });
  $('head').addEventListener('click', () => {
    const open = $('panel').classList.toggle('open');
    $('head').setAttribute('aria-expanded', String(open));
  });
  $('copy').addEventListener('click', () => {
    const b = $('copy');
    window.navigator.clipboard?.writeText(window.location.href).then(() => { b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy link'; }, 1500); }, () => {});
  });
  if (query.get('panel') === '1') $('panel').classList.add('open');
  refreshPanel();

  // ---- loop ----
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  let last = performance.now();
  let fps = 60;
  let frames = 0;
  const stats = { fps: 0, calls: 0, triangles: 0, frameMs: 0 };
  function frame(nowMs) {
    const dt = Math.min(0.1, (nowMs - last) / 1000);
    last = nowMs;
    if (dt > 0) fps += (1 / dt - fps) * 0.1;
    coast.update(target.x, target.z); // terrain level of detail + trees around the view, as for the boat
    snapFixedCamera(camera, target, zoom);
    sun.position.copy(target).add(sunOffset);
    sun.target.position.copy(target);
    stepWaves(waves, dt, wind, target.x, target.z);
    water.update(waves, wind, target, dt, camera.position);
    const camDist = camera.position.distanceTo(target);
    scene.fog.color.set(CONFIG.HAZE_COLOR);
    scene.fog.near = camDist * CONFIG.HAZE_MESH_NEAR_MUL;
    scene.fog.far = camDist * CONFIG.HAZE_MESH_FAR_MUL;
    sky.update(camera);
    const t0 = performance.now();
    renderer.render(scene, camera);
    stats.frameMs = performance.now() - t0;
    stats.fps = fps;
    stats.calls = renderer.info.render.calls;
    stats.triangles = renderer.info.render.triangles;
    if (++frames % 20 === 0) {
      $('stats').textContent = `${stats.triangles.toLocaleString('en')} triangles · ${stats.calls} draw calls · ${fps.toFixed(0)} fps · zone masks baked in ${hook.style.bakeMs.toFixed(0)} ms`;
    }
    requestAnimationFrame(frame);
  }
  loading.remove();
  requestAnimationFrame(frame);

  // Handle for the headless checks (render-presets script): not used by the page itself.
  window.__lab = {
    ready: true,
    setValues,
    getValues: () => ({ ...values }),
    lookAt: (x, z, z2) => { lookAt(x, z); if (z2) zoom = z2; },
    setZoom: (z) => { zoom = z; },
    places,
    stats,
    info: () => ({ triangles: renderer.info.render.triangles, calls: renderer.info.render.calls, geometries: renderer.info.memory.geometries, programs: renderer.info.programs?.length }),
    terrainStats: coast.terrain.stats,
    styleBakeMs: hook.style.bakeMs,
    renderer, scene, camera,
  };
}

main().catch((err) => {
  console.error(err);
  loading.className = 'err';
  loading.textContent = `the terrain lab failed to start:\n${(err && err.stack) || err}`;
  window.__labError = String((err && err.stack) || err);
});
