// World 1700 Lab (world-1700-lab.html): sail the real coast as it is TODAY and as it was around 1700, flip between the two at the same spot,
// and open the ghost chart (your old Today chart as faint pencil, inked in where you sail in 1700).
//
// Everything era-specific comes from data (data/world-years.json, data/world-1700.json) through src/world-year.js, and is built with
// the game's own world code by src/world-year-build.js, so game.js can adopt the same switch later. This page is only the viewer:
// it reuses the game's sea, sky, light, camera, sailing physics and shore rules, and never touches the game's saved progress (the 1700
// chart is inked into its own storage key; the game's saved chart is read, never written).
//
// URL: ?era=1700|1950|today  ?ghost=saved|demo|full  ?chart=1  ?rock=N (start beside the Nth-nearest hidden rock)  ?at=lon,lat
//      ?near=<settlement or light id> (start in the nearest open water to it, facing it)  ?zoom=<n> (camera distance, 1 = the game's)  ?touch=1|0 (phone controls)  ?inkroute=1 (ink the first part of the demo route)  ?inkreset=1  ?breaker=<s>|all (freeze the breaker clock / hold every breaker on)
import * as THREE from '../vendor/three/three.module.js';
import { CONFIG } from './config.js';
import { boatSpeed, leewardSign, idealTrimRad, angleOffWind } from './sail.js';
import { createWindController, stepWindController } from './wind.js';
import { createBoatMesh } from './boats.js';
import { updateFixedCamera, snapFixedCamera } from './camera.js';
import { spawnPose } from './spawn.js';
import { wantsPhoneControls, createPhoneControls } from './phone.js';
import { seaHeightCPU, createWaveState, stepWaves } from './water.js';
import { createSky } from './sky.js';
import { createWake } from './wake.js';
import { createInputState } from '../../../shared/input.js';
import { createHud, updateHud } from './hud.js';
import { stepAlongShore, shallowFactor, SHORE_BRAKE } from './shore.js';
import { createExplored, exploredStorage, EXPLORED_KEY } from './explored.js';
import { createSeen } from './seen.js';
import { boundsRect } from './chart.js';
import { findOpenWater } from './coast-world.js';
import { loadWorldFiles, buildWorldForSpec } from './world-year-build.js';
import { worldAtYear, yearOfEra } from './world-year.js';
import { createGhostChart, drawGhostChart, fitView, exploredBounds, revealedLabels, readOnlyStorage, demoExplored, fullExplored, INK_EXPLORED_KEY } from './ghost-chart.js';

const $ = (id) => document.getElementById(id);
const loading = $('loading');
const DEG = Math.PI / 180;
const Q = new URLSearchParams(window.location.search);
const tick = () => new Promise((r) => setTimeout(r, 30)); // let the page paint between the heavy builds

const approach = (cur, target, dt) => { const d = target - cur; return cur + Math.sign(d) * Math.min(Math.abs(d), (d >= 0 ? CONFIG.SAIL_FORCE : CONFIG.DRAG) * dt); };
function bobBoat(group, x, z, heading, waves, wind) { // the game's bobBoat (game.js): the boat sits on the sea it is drawn against
  const eps = CONFIG.BOAT_TILT_GRADIENT_EPS, fx = Math.sin(heading), fz = Math.cos(heading), rx = Math.cos(heading), rz = -Math.sin(heading);
  const h = (px, pz) => seaHeightCPU(px, pz, waves.phases, wind.dir, wind.strength);
  const y = h(x, z), max = CONFIG.BOAT_TILT_MAX;
  group.position.y = y;
  group.rotation.x = Math.min(max, Math.max(-max, -((h(x + fx * eps, z + fz * eps) - y) / eps) * CONFIG.BOAT_TILT_GAIN));
  group.rotation.z = Math.min(max, Math.max(-max, ((h(x + rx * eps, z + rz * eps) - y) / eps) * CONFIG.BOAT_TILT_GAIN));
}

async function main() {
  const canvas = $('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const isPhone = wantsPhoneControls();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isPhone ? CONFIG.PHONE_MAX_PIXEL_RATIO : Infinity));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const sky = createSky();
  scene.add(sky.mesh);
  const camera = new THREE.PerspectiveCamera(CONFIG.FIXED_CAMERA_FOV_DEG, 1, CONFIG.CAMERA_NEAR, 2000);
  const hemi = new THREE.HemisphereLight(CONFIG.HEMI_SKY_COLOR, CONFIG.HEMI_GROUND_COLOR, CONFIG.HEMI_INTENSITY);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(CONFIG.SUN_COLOR, CONFIG.SUN_INTENSITY);
  const laz = CONFIG.LIGHT_AZIMUTH_DEG * DEG, lel = CONFIG.LIGHT_ELEVATION_DEG * DEG;
  const sunOffset = new THREE.Vector3(Math.sin(laz) * Math.cos(lel), Math.sin(lel), Math.cos(laz) * Math.cos(lel)).multiplyScalar(20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { near: 1, far: 500, left: -150, right: 150, top: 150, bottom: -150 });
  sun.shadow.radius = 4; sun.shadow.bias = CONFIG.SUN_SHADOW_BIAS; sun.shadow.normalBias = 0.25;
  scene.add(sun, sun.target);
  scene.fog = new THREE.Fog(CONFIG.HAZE_COLOR, 1e6, 2e6);

  // ---- the data and both worlds (built up front: the toggle is then instant) ----
  loading.textContent = 'loading the coast and the 1700 data…';
  const files = await loadWorldFiles();
  const ERA_IDS = files.years.eras.map((e) => e.id);
  const first = ERA_IDS.includes(Q.get('era')) ? Q.get('era') : '1700';
  const order = [first, ...ERA_IDS.filter((id) => id !== first)];
  const specs = {}, eras = {};
  for (const id of order) {
    loading.textContent = `building the coast of ${id === 'today' ? 'today' : id}…`;
    await tick();
    specs[id] = worldAtYear(files.years, files.sources, yearOfEra(files.years, id));
    eras[id] = buildWorldForSpec(files, specs[id]);
  }

  // Dusk = a blue-hour evening (ART.md: never grim): dim cool light, a darker sea and sky; lit windows and lighthouses show. Day = config.js as it is.
  const NIGHT = { SUN_COLOR: 0xaab8e8, SUN_INTENSITY: 0.85, HEMI_SKY_COLOR: 0x92a2d4, HEMI_GROUND_COLOR: 0x544c78, HEMI_INTENSITY: 1.5, SKY_HORIZON_COLOR: 0x4a5a8c, SKY_ZENITH_COLOR: 0x1c2650, HAZE_COLOR: 0x34406c, LOOK_SEA_BRIGHTNESS: 0.62 };
  const DAY = Object.fromEntries(Object.keys(NIGHT).map((k) => [k, CONFIG[k]]));
  let night = Q.get('night') === '1' ? 1 : 0;
  const applyLight = () => { Object.assign(CONFIG, night ? NIGHT : DAY); hemi.color.set(CONFIG.HEMI_SKY_COLOR); hemi.groundColor.set(CONFIG.HEMI_GROUND_COLOR); hemi.intensity = CONFIG.HEMI_INTENSITY; sun.color.set(CONFIG.SUN_COLOR); sun.intensity = CONFIG.SUN_INTENSITY; era?.setNight?.(!!night); $('dusk').textContent = night ? 'Dusk' : 'Day'; $('dusk').classList.toggle('on', !!night); $('dusk').setAttribute('aria-pressed', String(!!night)); };

  // ---- the boat, the wind, the sea ----
  const self = { ...spawnPose(1, 'host'), speed: 0 };
  const startEra = eras[first];
  const at = Q.has('at') ? Q.get('at').split(',').map(Number) : null;
  const sp = at && at.length === 2 && at.every(Number.isFinite) ? findOpenWater(startEra.world, ...startEra.world.toGame(at[0], at[1])) : startEra.spawn;
  self.x = sp.x; self.z = sp.z;
  const boatFor = (spec) => createBoatMesh(0xffcc66, spec.boats.kit === 'eka' ? { type: 'eka', sailTone: 'rust', deck: [null, null, null] } : { type: 'koster', deck: ['crate', 'barrel', null] });
  const boats = {};
  const wake = createWake();
  scene.add(wake.group);
  const nowS0 = performance.now() / 1000;
  let windController = createWindController(3, nowS0);
  let wind = windController.current;
  const waves = createWaveState(wind.dir);
  const seaAt = (x, z) => seaHeightCPU(x, z, waves.phases, wind.dir, wind.strength);
  const input = createInputState();
  const phone = isPhone ? createPhoneControls({ canvas, camera, onPing: () => {} }) : null;
  const hud = isPhone ? null : createHud(canvas);
  let zoom = Number.isFinite(Number(Q.get('zoom'))) && Q.has('zoom') ? Math.min(CONFIG.ZOOM_MAX, Math.max(CONFIG.ZOOM_MIN, Number(Q.get('zoom')))) : 1;
  if (!isPhone) canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoom = Math.min(CONFIG.ZOOM_MAX, Math.max(CONFIG.ZOOM_MIN, zoom + e.deltaY * CONFIG.ZOOM_WHEEL_SENSITIVITY)); }, { passive: false });

  // ---- the two charts: the old (Today, read only) and the new (1700, inked as you sail) ----
  const rectOf = (world) => (files.chartCfg ? boundsRect(world.toGame, files.chartCfg.detail) : { x0: world.bounds.minX, z0: world.bounds.minZ, x1: world.bounds.maxX, z1: world.bounds.maxZ });
  const rect = rectOf(eras.today.world);
  const store = exploredStorage();
  let todayExplored = createExplored(rect, { storage: readOnlyStorage(store), key: EXPLORED_KEY });
  let ghostSource = 'saved';
  const settle = (id) => specs['1700'].settlements.find((s) => s.id === id);
  const routePts = ['grundsund', 'fiskebackskil', 'lysekil', 'gullholmen', 'harmano'].map(settle).filter(Boolean).map((s) => { const [x, z] = eras.today.world.toGame(s.lon, s.lat); return { x, z }; });
  const ghostMode = Q.get('ghost');
  if (ghostMode === 'full') { todayExplored = fullExplored(rect); ghostSource = 'full'; }
  else if (ghostMode === 'demo' || todayExplored.count() === 0) { todayExplored = demoExplored(rect, routePts); ghostSource = ghostMode === 'demo' ? 'demo' : 'demo (no saved Today chart on this device)'; }
  else ghostSource = 'saved game on this device';
  const inkExplored = createExplored(rect, { storage: store, key: INK_EXPLORED_KEY });
  if (Q.get('inkreset') === '1') inkExplored.reset();
  if (Q.get('inkroute') === '1') { const pts = routePts.slice(0, 3); for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k <= 30; k++) inkExplored.reveal(pts[i].x + ((pts[i + 1].x - pts[i].x) * k) / 30, pts[i].z + ((pts[i + 1].z - pts[i].z) * k) / 30, 150); }
  const seen = createSeen({ explored: inkExplored, heightAt: eras['1700'].heightAt }); // the game's rule for revealing a name (src/seen.js): revealed land within 150 m
  const ghost = createGhostChart({ today: eras.today, era: eras['1700'], todayExplored, inkExplored, source: ghostSource });

  // ---- which era is on screen ----
  let eraId = null, era = null, selfBoat = null;
  const toast = (text, ms = 3200) => { const t = $('toast'); t.textContent = text; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), ms); };
  const labelEls = new Map();
  const labelHost = $('labels');
  function setEra(id, { announce = true } = {}) {
    if (eraId === id) return;
    if (era) { scene.remove(era.group, era.water.mesh); if (selfBoat) scene.remove(selfBoat.group); }
    eraId = id; era = eras[id];
    scene.add(era.water.mesh, era.group);
    boats[id] ??= boatFor(era.spec);
    selfBoat = boats[id];
    scene.add(selfBoat.group);
    // the same spot: if the other era has rock or shore there, ease to the nearest clear water
    if (era.sailHeightAt(self.x, self.z) > -1.5) {
      const w = findOpenWater(era.world, self.x, self.z, { clear: 14, maxR: 400 });
      if (w) { self.x = w.x; self.z = w.z; }
    }
    self.speed = 0;
    labelEls.forEach((el) => el.remove()); labelEls.clear();
    for (const l of era.labels) if (l.text) { const el = document.createElement('div'); el.className = `plabel${l.uncertain ? ' uncertain' : ''}`; el.textContent = l.text; if (l.year && id !== 'today') { const s = document.createElement('small'); s.textContent = String(l.year); el.appendChild(s); } el.style.display = 'none'; labelHost.appendChild(el); labelEls.set(l.id, el); }
    for (const b of document.querySelectorAll('#era button')) b.classList.toggle('on', b.dataset.era === id);
    $('chartBtn').hidden = id !== '1700';
    $('year').textContent = id === 'today' ? 'Today · the game\'s coast' : `around ${era.spec.year} · sea ${era.spec.waterOffsetM} m higher${id === '1950' ? ' (a few cm)' : ''}`;
    document.title = `Windward World Lab: ${era.spec.label}`;
    fillInfo();
    applyLight();
    if (announce) toast(id === 'today' ? 'Today: lights, buoys and red cottages' : id === '1950' ? `1950: ${era.report.lightsLit} lights lit, ${era.report.keepers} keepers' houses, wooden boats` : `1700: no lights, ${era.report.hiddenRocks} rocks just under the surface`);
    const u = new URL(window.location.href); u.searchParams.set('era', id); window.history.replaceState(null, '', u);
  }
  function fillInfo() {
    const r = era.report, sp = era.spec;
    const li = (t) => `<li>${t}</li>`;
    const level = sp.waterOffsetM ? `sea ${sp.waterOffsetM} m higher than today (our arithmetic on SMHI${sp.era === '1700' ? ', uncertain' : ': a few centimetres'})` : 'sea as today';
    const lightsLine = sp.era === '1950' ? `${r.lights} lighthouses: ${r.lightsLit} lit, ${r.lightsDark} dark, ${r.keepers} keepers' houses` : `${r.lights} lighthouses${sp.modernMarks ? ', modern buoys and beacons' : ', no modern marks'}`;
    let h = `<h3>${sp.label}</h3><ul>${li(level)}${li(lightsLine)}${li(`${r.cottages} ${sp.era === '1950' ? 'houses' : 'cottages'}, ${r.boathouses} sea-sheds${r.racks ? `, ${r.racks} drying racks` : ''}${r.factories ? `, ${r.factories} canning factories` : ''}`)}${r.marks ? li(sp.era === '1950' ? `${r.buoys} buoys and ${r.marks - r.buoys} beacons in the marks of the time` : `${r.marks} cairns and painted rocks`) : ''}${r.mooredEkas + r.sailingEkas ? li(`${r.mooredEkas} ekas moored, ${r.sailingEkas} sailing`) : ''}${r.mooredBoats + r.sailingBoats ? li(`${r.mooredBoats} wooden boats moored, ${r.sailingBoats} fishing boats at work, ferry: ${r.ferry}`) : ''}${r.hiddenRocks ? li(`<b>${r.hiddenRocks}</b> rocks just under the surface in this window: a pale patch, an odd breaker`) : ''}</ul>`;
    if (sp.era !== 'today') {
      h += `<h3>Settlements (sizes from the data)</h3><ul>${r.villages.map((v) => li(`${v.name}: ${v.placed} of ${v.wanted} ${sp.era === '1950' ? 'houses' : 'cottages'}${v.uncertain ? ' <i>(doubtful for this year)</i>' : ''}${v.note ? ` <i>(${v.note})</i>` : ''}`)).join('')}</ul>`;
      if (sp.era === '1700') h += `<h3>Names in 1700</h3><ul>${sp.labels.map((l) => li(`${l.modern}: ${l.text ? `${l.text} <i>(${l.year}${l.uncertain ? ', uncertain' : ''})</i>` : '<i>no documented form: no name shown</i>'}`)).join('')}</ul>`;
      if (sp.era === '1950' && sp.lighthouses) h += `<h3>Lights in 1950</h3><ul>${sp.lighthouses.map((l) => li(`${l.name}: ${l.lit && l.manned !== 'dark' ? 'lit' : 'dark'}, ${l.manned}${l.keeperHouse ? ', keeper\'s house' : ''}`)).join('')}</ul>`;
      h += `<h3>Honest notes</h3><ul>${[...sp.notes, ...r.notes.filter((n) => !sp.notes.includes(n))].map(li).join('')}${sp.era === '1700' ? li('boats: type of the c.1700 eka is a design choice (BOAT-BRIEF); the quiet coast is a recommendation') : li('boat counts and the house scale (one house per ~25 people, capped) are ours; see docs/WORLD-1950.md')}</ul>`;
    }
    $('infoBody').innerHTML = h;
    $('infoName').textContent = `${sp.label}: ${r.cottages} ${sp.era === '1950' ? 'houses' : 'cottages'} · ${r.lights} lights${r.hiddenRocks ? ` · ${r.hiddenRocks} hidden rocks` : ''}`;
  }

  // ---- the chart overlay ----
  const chartEl = $('chart'), chartCanvas = $('chartCanvas');
  const cctx = chartCanvas.getContext('2d');
  const inkCanvas = document.createElement('canvas');
  let inkVersion = -1;
  let view = null, chartOpen = false, lastChartDraw = 0;
  const chartPointers = new Map();
  function chartSize() { const w = chartCanvas.clientWidth, h = chartCanvas.clientHeight, d = Math.min(window.devicePixelRatio || 1, 2); if (chartCanvas.width !== Math.round(w * d)) { chartCanvas.width = Math.round(w * d); chartCanvas.height = Math.round(h * d); } return { w, h, d }; }
  function drawChart() {
    const { w, h, d } = chartSize();
    view ??= fitView(exploredBounds([todayExplored, inkExplored]) || rect, w, h); // open on whatever has been drawn
    const pic = ghost.ink();
    if (pic.version !== inkVersion) { inkCanvas.width = pic.w; inkCanvas.height = pic.h; inkCanvas.getContext('2d').putImageData(new ImageData(pic.rgba, pic.w, pic.h), 0, 0); inkVersion = pic.version; }
    cctx.setTransform(d, 0, 0, d, 0, 0);
    drawGhostChart(cctx, w, h, view, ghost, { x: self.x, z: self.z, heading: self.heading }, inkCanvas, revealedLabels(eras['1700'].labels.filter((l) => l.chartName !== false), seen)); // old names only where the ink has reached and a name is documented
  }
  const openChart = (on) => { chartOpen = on; chartEl.classList.toggle('on', on); if (on) { view = null; $('chartSource').textContent = `Old chart: ${ghost.source}.`; drawChart(); } phone?.setRopeVisible(!on); };
  $('chartBtn').addEventListener('click', () => openChart(true));
  $('chartClose').addEventListener('click', () => openChart(false));
  $('chartReset').addEventListener('click', () => { inkExplored.reset(); seen.setExplored(inkExplored); drawChart(); toast('The 1700 chart is blank again; the pencil stays'); });
  chartCanvas.addEventListener('pointerdown', (e) => { chartCanvas.setPointerCapture(e.pointerId); chartPointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); });
  const endChart = (e) => chartPointers.delete(e.pointerId);
  chartCanvas.addEventListener('pointerup', endChart); chartCanvas.addEventListener('pointercancel', endChart);
  let pinch0 = 0, scale0 = 1;
  chartCanvas.addEventListener('pointermove', (e) => {
    const p = chartPointers.get(e.pointerId); if (!p || !view) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (chartPointers.size === 1) { view.cx -= dx / view.scale; view.cz -= dy / view.scale; }
    else if (chartPointers.size === 2) { const [a, b] = [...chartPointers.values()]; const dist = Math.hypot(a.x - b.x, a.y - b.y); if (!pinch0) { pinch0 = dist; scale0 = view.scale; } view.scale = Math.min(2, Math.max(0.05, scale0 * dist / pinch0)); }
    if (chartPointers.size < 2) pinch0 = 0;
    drawChart();
  });
  chartCanvas.addEventListener('wheel', (e) => { e.preventDefault(); if (view) { view.scale = Math.min(2, Math.max(0.05, view.scale * Math.exp(-e.deltaY * 0.0015))); drawChart(); } }, { passive: false });

  // ---- panel, toggle ----
  for (const b of document.querySelectorAll('#era button')) b.addEventListener('click', () => setEra(b.dataset.era));
  $('dusk').addEventListener('click', () => { night = night ? 0 : 1; applyLight(); const u = new URL(window.location.href); if (night) u.searchParams.set('night', '1'); else u.searchParams.delete('night'); window.history.replaceState(null, '', u); });
  $('infoHead').addEventListener('click', () => { const open = $('info').classList.toggle('open'); $('infoHead').setAttribute('aria-expanded', String(open)); });
  if (Q.get('info') === '1') $('info').classList.add('open');

  setEra(first, { announce: false });
  // ?rock=N: start 28 m from the Nth-nearest hidden rock (counting from the spawn), heading for it
  if (Q.has('rock') && eras['1700'].report.hiddenRockList) {
    const list = [...eras['1700'].report.hiddenRockList].sort((a, b) => Math.hypot(a.x - self.x, a.z - self.z) - Math.hypot(b.x - self.x, b.z - self.z));
    const rock = list[Math.max(0, Math.min(list.length - 1, (Number(Q.get('rock')) || 1) - 1))];
    const E = eras['1700'];
    for (let k = 0; k < 24; k++) {
      const a = k * Math.PI / 12, x = rock.x + Math.sin(a) * 28, z = rock.z + Math.cos(a) * 28;
      if (E.sailHeightAt(x, z) < -3 && E.sailHeightAt(rock.x + Math.sin(a) * 14, rock.z + Math.cos(a) * 14) < -2) { self.x = x; self.z = z; self.heading = Math.atan2(rock.x - x, rock.z - z); break; }
    }
  }
  // ?near=grundsund | fiskebackskil | maseskar ...: start in the nearest open water to a settlement or light of the era on screen, facing it
  if (Q.has('near')) {
    const id = Q.get('near');
    const v = era.report.villages.find((x) => x.id === id && x.at);
    const l = era.labels.find((x) => x.id === `light-${id}` || x.id === id);
    const c = v ? v.at : l ? { x: l.x, z: l.z } : null;
    if (c) {
      let best = null;
      for (let r = 6; r <= 200 && !best; r += 3) for (let k = 0; k < 48 && !best; k++) { const a = k / 48 * Math.PI * 2, x = c.x + Math.sin(a) * r, z = c.z + Math.cos(a) * r; if (era.sailHeightAt(x, z) < -2.2 && era.heightAt(x, z) < -2.2) best = { x, z }; }
      if (best) { self.x = best.x; self.z = best.z; self.heading = Math.atan2(c.x - best.x, c.z - best.z); }
    }
  }
  const viewTarget = new THREE.Vector3(self.x, 0, self.z);
  selfBoat.group.position.set(self.x, 0, self.z);
  snapFixedCamera(camera, viewTarget, zoom);
  if (Q.get('chart') === '1') openChart(true);

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (chartOpen) drawChart();
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- the loop: the game's sailing, on the era on screen ----
  const proj = new THREE.Vector3();
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const nowS = now / 1000;
    windController = stepWindController(windController, nowS); wind = windController.current;
    phone?.apply(self, wind, dt);
    if (input.left) self.heading -= CONFIG.TURN_RATE * dt;
    if (input.right) self.heading += CONFIG.TURN_RATE * dt;
    if (input.up) self.trim = Math.max(CONFIG.TRIM_MIN, self.trim - CONFIG.TRIM_RATE * dt);
    if (input.down) self.trim = Math.min(CONFIG.TRIM_MAX, self.trim + CONFIG.TRIM_RATE * dt);
    self.speed = approach(self.speed, boatSpeed(self.heading, wind.dir, wind.strength, self.trim), dt);
    // sailing height = the coast plus the solid shoals (hidden rocks are solid): the shore and rocks slide the boat, never hurt it
    const v = self.speed * shallowFactor(era.sailHeightAt, self.x, self.z) * era.shoalSlowAt(self.x, self.z);
    const mv = stepAlongShore(era.sailHeightAt, self.x, self.z, Math.sin(self.heading) * v * dt, Math.cos(self.heading) * v * dt);
    self.x = mv.x; self.z = mv.z;
    if (mv.contact > 0) self.speed = Math.max(0, self.speed - mv.contact * SHORE_BRAKE * dt);
    era.clamp(self);
    stepWaves(waves, dt, wind, self.x, self.z);
    era.update(self.x, self.z, dt, Number.isFinite(Number(Q.get('breaker'))) && Q.has('breaker') ? Number(Q.get('breaker')) : nowS, seaAt);
    if (Q.get('breaker') === 'all') era.hiddenLayer?.rings.forEach((r) => { r.mat.opacity = 0.5; }); // debug: hold every breaker on, for a still picture
    selfBoat.group.position.set(self.x, 0, self.z);
    selfBoat.group.rotation.y = self.heading;
    bobBoat(selfBoat.group, self.x, self.z, self.heading, waves, wind);
    selfBoat.setSailAngle(leewardSign(self.heading, wind.dir) * self.trim);
    wake.update(dt, selfBoat.group.position, self.heading, self.speed);
    if (eraId === '1700') { inkExplored.mark(self.x, self.z); inkExplored.save(); } // sailing inks the 1700 chart; Today's chart is never written
    viewTarget.set(self.x, selfBoat.group.position.y, self.z);
    sun.position.copy(viewTarget).add(sunOffset); sun.target.position.copy(viewTarget);
    era.water.update(waves, wind, viewTarget, dt, camera.position);
    updateFixedCamera(camera, viewTarget, dt, zoom);
    const cam = camera.position.distanceTo(viewTarget);
    scene.fog.color.set(CONFIG.HAZE_COLOR); scene.fog.near = cam * CONFIG.HAZE_MESH_NEAR_MUL; scene.fog.far = cam * CONFIG.HAZE_MESH_FAR_MUL;
    sky.update(camera);
    // names: only those with a documented form (1700) or the modern name (today), when you are near
    const W = canvas.clientWidth || window.innerWidth, H = canvas.clientHeight || window.innerHeight;
    for (const l of era.labels) {
      const el = labelEls.get(l.id); if (!el) continue;
      const near = Math.hypot(l.x - self.x, l.z - self.z) < 200;
      if (!near || chartOpen) { el.style.display = 'none'; continue; }
      proj.set(l.x, Math.max(0, era.heightAt(l.x, l.z)) + 9, l.z).project(camera);
      if (proj.z > 1) { el.style.display = 'none'; continue; }
      el.style.display = 'block'; el.style.left = `${(proj.x * 0.5 + 0.5) * W}px`; el.style.top = `${(-proj.y * 0.5 + 0.5) * H}px`;
    }
    if (hud) updateHud(hud, wind, self.trim, idealTrimRad(angleOffWind(self.heading, wind.dir)), self.heading, self.speed, { foundText: era.spec.label });
    if (!chartOpen) renderer.render(scene, camera); // the chart covers the whole view
    else if (now - lastChartDraw > 200) { lastChartDraw = now; drawChart(); }
    phone?.draw(nowS, { partner: null, pings: [], foundText: era.spec.label });
    requestAnimationFrame(frame);
  }
  loading.remove();
  requestAnimationFrame(frame);

  window.__w1700 = {
    ready: true, self, eras, specs, ghost, files, inkExplored, todayExplored,
    get era() { return era; }, get eraId() { return eraId; }, setEra, openChart, drawChart,
    stats: () => ({ era: eraId, ...era.report, villages: undefined, hiddenRockList: undefined, chart: ghost.stats() }),
    inkRoute(points, r = 150) { for (let i = 0; i < points.length - 1; i++) for (let k = 0; k <= 30; k++) inkExplored.reveal(points[i].x + ((points[i + 1].x - points[i].x) * k) / 30, points[i].z + ((points[i + 1].z - points[i].z) * k) / 30, r); },
    teleport(x, z, heading) { self.x = x; self.z = z; if (heading !== undefined) self.heading = heading; self.speed = 0; },
  };
}

main().catch((err) => {
  console.error(err);
  loading.className = 'err';
  loading.textContent = `the world lab failed to start:\n${(err && err.stack) || err}`;
});
