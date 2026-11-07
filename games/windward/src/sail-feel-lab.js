// Sail-feel lab (sail-feel-lab.html): sail the real coast (1950 or today) around Skafto with phone controls, through a day of
// weather: gusts you can SEE coming on the water, calm lees behind islands, a stronger and steadier wind utomskars, shifts that
// make the sail flutter, and the speed feel (camera, spray, wake, heel). Docs: docs/SAIL-FEEL-LAB.md and docs/ALIVE-SEA.md
// ("Grill: weather and sail feel"). New files only: the game itself is untouched. The lab reuses the game's world, sea, boat,
// sky, phone controls and sailing (sail.js boatSpeed) and replaces only the wind.
//
// Every setting lives in the URL (src/sail-feel-params.js); there is no localStorage at all.
import * as THREE from '../vendor/three/three.module.js';
import { CONFIG } from './config.js';
import { angleOffWind, leewardSign, idealTrimRad } from './sail.js';
import { createBoatMesh } from './boats.js';
import { wantsPhoneControls, createPhoneControls } from './phone.js';
import { seaHeightCPU, createWaveState, stepWaves } from './water.js';
import { createSky } from './sky.js';
import { createInputState } from '../../../shared/input.js';
import { createHud, updateHud, msToKnots } from './hud.js';
import { stepAlongShore, shallowFactor, SHORE_BRAKE } from './shore.js';
import { loadWorldFiles, buildWorldForSpec } from './world-year-build.js';
import { worldAtYear, yearOfEra } from './world-year.js';
import { createWindArrow } from './windArrow.js';
import { createWindField, WIND_FIELD } from './wind-field.js';
import { nextSquallEtaS } from './squall.js';
import { WEATHER, weatherAt, formatClock, hourOf, timeOfHour, dirToCompass, windMs, compassToDir } from './weather.js';
import { parseParams, toSearch } from './sail-feel-params.js';
import { FEEL, labTargetSpeed, heelTarget, stepHeel, createLuffState, stepLuff, luffFlutter, sprayRate } from './sail-feel-model.js';
import { createWindPaint } from './sail-feel-water.js';
import { createSpray, createFeelWake, createFeelCamera } from './sail-feel-fx.js';
import { createPanel, compassName } from './sail-feel-panel.js';

const $ = (id) => document.getElementById(id);
const DEG = Math.PI / 180;
const S = parseParams(window.location.search); // the lab's settings; the panel edits these and the URL follows
const layerOn = (id) => !S.off.includes(id);
const tick = () => new Promise((r) => setTimeout(r, 30)); // let the page paint between the heavy builds

const approach = (cur, target, dt) => { const d = target - cur; return cur + Math.sign(d) * Math.min(Math.abs(d), (d >= 0 ? CONFIG.SAIL_FORCE : CONFIG.DRAG) * dt); };

// The game's bobBoat (game.js): the boat sits on the sea it is drawn against. `heel` is extra roll to leeward, added to the wave roll.
function bobBoat(group, x, z, heading, waves, wind, heelRoll) {
  const eps = CONFIG.BOAT_TILT_GRADIENT_EPS; const fx = Math.sin(heading); const fz = Math.cos(heading); const rx = Math.cos(heading); const rz = -Math.sin(heading);
  const h = (px, pz) => seaHeightCPU(px, pz, waves.phases, wind.dir, wind.strength);
  const y = h(x, z); const max = CONFIG.BOAT_TILT_MAX;
  group.position.y = y;
  group.rotation.x = Math.min(max, Math.max(-max, -((h(x + fx * eps, z + fz * eps) - y) / eps) * CONFIG.BOAT_TILT_GAIN));
  group.rotation.z = Math.min(max, Math.max(-max, ((h(x + rx * eps, z + rz * eps) - y) / eps) * CONFIG.BOAT_TILT_GAIN)) + heelRoll;
}

async function main() {
  const canvas = $('c');
  const loading = $('loading');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const isPhone = wantsPhoneControls();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isPhone ? CONFIG.PHONE_MAX_PIXEL_RATIO : Infinity));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const sky = createSky();
  scene.add(sky.mesh);
  const camera = new THREE.PerspectiveCamera(CONFIG.FIXED_CAMERA_FOV_DEG, 1, CONFIG.CAMERA_NEAR, 2000);
  scene.add(new THREE.HemisphereLight(CONFIG.HEMI_SKY_COLOR, CONFIG.HEMI_GROUND_COLOR, CONFIG.HEMI_INTENSITY));
  const sun = new THREE.DirectionalLight(CONFIG.SUN_COLOR, CONFIG.SUN_INTENSITY);
  const laz = CONFIG.LIGHT_AZIMUTH_DEG * DEG; const lel = CONFIG.LIGHT_ELEVATION_DEG * DEG;
  const sunOffset = new THREE.Vector3(Math.sin(laz) * Math.cos(lel), Math.sin(lel), Math.cos(laz) * Math.cos(lel)).multiplyScalar(20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { near: 1, far: 500, left: -150, right: 150, top: 150, bottom: -150 });
  sun.shadow.radius = 4; sun.shadow.bias = CONFIG.SUN_SHADOW_BIAS; sun.shadow.normalBias = 0.25;
  scene.add(sun, sun.target);
  scene.fog = new THREE.Fog(CONFIG.HAZE_COLOR, 1e6, 2e6);

  // ---- the world: the real coast, one era ----
  loading.textContent = `loading the coast of ${S.era === 'today' ? 'today' : S.era}…`;
  const files = await loadWorldFiles();
  await tick();
  const spec = worldAtYear(files.years, files.sources, yearOfEra(files.years, S.era));
  const era = buildWorldForSpec(files, spec, { ownBoats: false });
  scene.add(era.water.mesh, era.group);
  const spawn = era.spawn;

  // ---- the wind field ----
  let field = null;
  const wind = {}; // windAt() fills this each frame: the true wind at the boat
  const layerIds = ['shifts', 'gusts', 'shadows', 'funnel', 'boost', 'squalls'];
  const applyLayers = () => { for (const id of layerIds) field.layers[id] = layerOn(id); };
  function makeField() {
    WIND_FIELD.GUST_DRIFT_FRACTION = S.drift;
    field = createWindField({ daySeed: S.seed, dayType: S.day === 'auto' ? undefined : S.day, heightAt: era.heightAt, bounds: era.world.bounds, center: { x: spawn.x, z: spawn.z } });
    applyLayers();
    field.prewarm(field.base(gt).dir);
  }
  let gt = timeOfHour(S.t); // game time: seconds since midnight of the game day

  // ---- the boat ----
  const boatFor = () => createBoatMesh(0xffcc66, spec.boats.kit === 'eka' ? { type: 'eka', sailTone: 'rust', deck: [null, null, null] } : { type: 'koster', deck: ['crate', 'barrel', null] });
  const selfBoat = boatFor();
  selfBoat.group.rotation.order = 'YXZ'; // yaw first, then pitch and roll in the boat's own frame (so heel rolls along the keel)
  scene.add(selfBoat.group);
  const self = { x: spawn.x, z: spawn.z, heading: 0, speed: 0, trim: 0 };
  const waves = createWaveState(0);
  const seaWind = { dir: 0, strength: 0.3 }; // the sea follows the DAY's wind and sea state (smooth), not the gusts
  const seaAt = (x, z) => seaHeightCPU(x, z, waves.phases, seaWind.dir, seaWind.strength);
  const arrow = createWindArrow();
  scene.add(arrow.object);
  const spray = createSpray();
  scene.add(spray.points);
  const wake = createFeelWake();
  scene.add(wake.group);
  const feelCam = createFeelCamera(camera);
  const luff = createLuffState();
  let heel = 0;
  const input = createInputState();
  const phone = isPhone ? createPhoneControls({ canvas, camera, onPing: () => {} }) : null;
  const hud = isPhone ? null : createHud(canvas);
  const paint = createWindPaint(era.water);

  makeField();
  paint.refreshNow(field, gt, self.x, self.z);

  // ---- finding places ----
  // open water with `clear` metres of sailable sea in all eight directions (so a start never sits against a shore)
  const RING8 = Array.from({ length: 8 }, (_, k) => [Math.sin((k * Math.PI) / 4), Math.cos((k * Math.PI) / 4)]);
  const waterOk = (x, z, clear = 60) => era.world.inside(x, z, 120) && era.sailHeightAt(x, z) < -3 && RING8.every(([dx, dz]) => era.sailHeightAt(x + dx * clear, z + dz * clear) < -2.5);
  // the nearest open water to the spawn (in rings outward) where the wind there satisfies pred(windAt, x, z)
  function findWater(pred, rMax = 1600) {
    const tmp = {};
    for (let r = 0; r <= rMax; r += 24) {
      const n = Math.max(1, Math.round((2 * Math.PI * r) / 24));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * 2 * Math.PI + r * 0.37; const x = spawn.x + Math.sin(a) * r; const z = spawn.z + Math.cos(a) * r;
        if (waterOk(x, z) && pred(field.windAt(x, z, gt, tmp), x, z)) return { x, z };
      }
    }
    return null;
  }
  function placeBoat(x, z, heading, { speedNow = true, trim } = {}) {
    self.x = x; self.z = z; self.heading = heading;
    const w = field.windAt(x, z, gt, wind);
    self.trim = trim ?? idealTrimRad(angleOffWind(heading, w.dir));
    self.speed = speedNow ? labTargetSpeed(heading, w.dir, w.strength, self.trim) : 0;
    luff.ref = null; luff.luff = 0; heel = 0;
    selfBoat.group.position.set(x, 0, z);
    feelCam.snap(selfBoat.group.position, heading, S.zoom);
    paint.refreshNow(field, gt, x, z); // the sea around the new spot, at once
  }
  const reachHeading = (dir) => dir + 100 * DEG; // the game's beam-reach start (wind.dir is where the wind comes FROM)
  function placeStart(kind) {
    const base = field.base(gt);
    let at = spawn;
    if (kind === 'outside') at = findWater((w) => w.exposure > 0.97) || spawn;
    else if (kind === 'inside') at = findWater((w) => w.exposure < 0.25) || spawn;
    placeBoat(at.x, at.z, reachHeading(base.dir));
  }

  // ---- demos: ready-made scenes for ?demo=... (the clock, the day, the boat, the camera) ----
  function applyDemo(name) {
    const day = (type) => { if (S.day === 'auto') { S.day = type; makeField(); } };
    const hour = (h) => { if (!new URLSearchParams(window.location.search).has('t')) { gt = timeOfHour(h); S.t = h; } };
    if (name === 'gust') { // a gust patch about 60 m ahead of a boat sailing north utomskars: the key test
      day('sea-breeze'); hour(14);
      const o = findWater((w) => w.exposure > 0.97) || spawn;
      const heading = Math.PI; const fx = Math.sin(heading); const fz = Math.cos(heading);
      const tmp = {}; const t0 = gt;
      for (let off = 0; off <= 900; off++) {
        const t = t0 + off;
        const here = field.windAt(o.x, o.z, t, tmp).local;
        if (here > 1.12 || here < 0.9) continue;
        const at = (d, side) => field.windAt(o.x + fx * d - fz * side, o.z + fz * d + fx * side, t, tmp).local; // a point d ahead, `side` m to the right
        if (at(50, 0) > 1.4 && at(50, 18) > 1.25 && at(50, -18) > 1.25 && at(35, 0) > 1.1) { gt = t; break; } // a strong, wide gust about 50 m ahead

      }
      placeBoat(o.x, o.z, heading);
    } else if (name === 'lee') { // beside the calm water behind an island
      day('sea-breeze'); hour(14);
      const L = findWater((w) => w.shadow < 0.5 && w.exposure < 0.6);
      if (L) {
        const dir = field.base(gt).dir; const dw = { x: -Math.sin(dir), z: -Math.cos(dir) };
        const side = [[-dw.z, dw.x], [dw.z, -dw.x]].map(([px, pz]) => ({ x: L.x + px * 55, z: L.z + pz * 55 })).find((p) => waterOk(p.x, p.z)) || { x: L.x - dw.x * 60, z: L.z - dw.z * 60 };
        placeBoat(side.x, side.z, Math.atan2(L.x - side.x, L.z - side.z));
      } else placeStart('spawn');
    } else if (name === 'heel') { // fresh afternoon, close reach, leaning
      day('sea-breeze'); hour(16);
      const o = findWater((w) => w.exposure > 0.97) || spawn;
      const base = field.base(gt);
      placeBoat(o.x, o.z, base.dir + 65 * DEG);
    }
  }

  // ---- panel and URL ----
  const toast = (text, ms = 2800) => { const t = $('toast'); t.textContent = text; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), ms); };
  function writeUrl() { S.t = hourOf(gt); const q = toSearch(S, window.location.search); window.history.replaceState(null, '', window.location.pathname + q + window.location.hash); }
  const panel = createPanel({
    settings: S,
    layerOn,
    onToggle(id, on) { S.off = S.off.filter((x) => x !== id); if (!on) S.off.push(id); if (layerIds.includes(id)) applyLayers(); writeUrl(); },
    onSetting(key, value) {
      S[key] = value;
      if (key === 'day' || key === 'seed') makeField();
      if (key === 'drift') WIND_FIELD.GUST_DRIFT_FRACTION = value;
      if (key === 'zoom') feelCam.snap(selfBoat.group.position, self.heading, S.zoom);
      if (key !== 'panel' || true) writeUrl();
    },
    onClock(hour) { gt = timeOfHour(hour); writeUrl(); },
    onStart(kind) { placeStart(kind); S.start = kind; writeUrl(); toast(kind === 'outside' ? 'Utomskärs: open water, west of the skerries' : kind === 'inside' ? 'Inside the skerries' : 'Grundsund'); },
    onCopy() { writeUrl(); return window.location.href; },
  });
  if (S.debug) $('debug').hidden = false;

  // ---- start ----
  if (S.demo) applyDemo(S.demo); else placeStart(S.start);
  writeUrl();

  function resize() {
    const w = canvas.clientWidth || window.innerWidth; const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- readout ----
  const zoneOf = (ex) => (ex >= 0.65 ? 'utomskärs (open water)' : ex <= 0.35 ? 'inside the skerries' : 'the edge of the skerries');
  const stateOf = (w) => {
    if (w.squall > 0.1) return ['in a squall', true];
    if (w.shadow < 0.7) return [`in a lee (${Math.round((w.local - 1) * 100)}%)`, false];
    if (w.funnel > 1.1) return [`funnelled (+${Math.round((w.funnel - 1) * 100)}%)`, false];
    if (w.local > 1.12) return [`in a gust (+${Math.round((w.local - 1) * 100)}%)`, true];
    if (w.local < 0.88) return [`in a lull (${Math.round((w.local - 1) * 100)}%)`, false];
    return ['steady', false];
  };
  let hold = false; // test hook: freeze the boat and the clock for a still picture
  let readoutAt = 0;
  function readout(nowMs) {
    if (nowMs - readoutAt < 250) return;
    readoutAt = nowMs;
    const base = field.base(gt);
    const ms = windMs(wind.strength); const kn = msToKnots(ms);
    const from = dirToCompass(wind.dir);
    const bFrom = dirToCompass(base.dir);
    const [st, warn] = stateOf(wind);
    const eta = nextSquallEtaS(field.squallPlan, self.x, self.z, gt);
    panel.setReadout({
      hour: hourOf(gt),
      clock: formatClock(gt),
      pill: `${formatClock(gt)} · ${WEATHER.PROFILES[field.dayType].label.replace(/ \(.*\)/, '')} · ${ms.toFixed(1)} m/s ${compassName(from)} · ${msToKnots(self.speed).toFixed(1)} kn`,
      rows: [
        ['True wind here', `${ms.toFixed(1)} m/s (${kn.toFixed(1)} kn) from ${compassName(from)} ${Math.round(from)}°`],
        ['The day\'s wind', `${windMs(base.strength).toFixed(1)} m/s from ${compassName(bFrom)} ${Math.round(bFrom)}°`],
        ['Here', st, warn],
        ['Boat speed', `${msToKnots(self.speed).toFixed(1)} kn (${self.speed.toFixed(1)} m/s)`],
        ['Off the wind', `${Math.round(angleOffWind(self.heading, wind.dir) / DEG)}°${luff.luff > 0.15 ? ' · sail luffing' : ''}`],
        ['Where', zoneOf(wind.exposure)],
        ['Next squall', eta === null ? (field.squallPlan.length ? 'none left today' : 'none today') : `in ${Math.round(eta)} s`, eta !== null && eta < 90],
        ['Sea state / visibility', `${Math.round(base.seaState * 100)}% / ${Math.round(base.visibility * 100)}%`],
      ],
    });
  }

  // ---- the loop ----
  const proj = new THREE.Vector3();
  void proj;
  let last = performance.now();
  const frames = []; let paintMs = 0;
  function frame(now) {
    const t0 = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const nowS = now / 1000;
    if (!S.freeze && !hold) gt += dt * (S.ff ? 10 : 1);

    // wind at the boat, and the day behind it
    field.windAt(self.x, self.z, gt, wind);
    const base = field.base(gt);
    seaWind.dir = base.dir; seaWind.strength = Math.max(0.12, base.seaState);

    // steering, trim, speed: the game's sailing on the lab's wind
    phone?.apply(self, wind, dt);
    if (input.left) self.heading -= CONFIG.TURN_RATE * dt;
    if (input.right) self.heading += CONFIG.TURN_RATE * dt;
    if (input.up) self.trim = Math.max(CONFIG.TRIM_MIN, self.trim - CONFIG.TRIM_RATE * dt);
    if (input.down) self.trim = Math.min(CONFIG.TRIM_MAX, self.trim + CONFIG.TRIM_RATE * dt);
    const off = angleOffWind(self.heading, wind.dir);
    self.speed = hold ? 0 : approach(self.speed, labTargetSpeed(self.heading, wind.dir, wind.strength, self.trim), dt);
    const v = self.speed * shallowFactor(era.sailHeightAt, self.x, self.z) * era.shoalSlowAt(self.x, self.z);
    const mv = stepAlongShore(era.sailHeightAt, self.x, self.z, Math.sin(self.heading) * v * dt, Math.cos(self.heading) * v * dt);
    self.x = mv.x; self.z = mv.z;
    if (mv.contact > 0) self.speed = Math.max(0, self.speed - mv.contact * SHORE_BRAKE * dt);
    era.clamp(self);

    // the sea and the boat on it
    stepWaves(waves, dt, seaWind, self.x, self.z);
    era.update(self.x, self.z, dt, nowS, seaAt);
    selfBoat.group.position.set(self.x, 0, self.z);
    selfBoat.group.rotation.y = self.heading;

    // heel: leans to leeward, more in gusts and strong wind, less running
    heel = stepHeel(heel, layerOn('heel') ? heelTarget(wind.strength, off) * S.heel : 0, dt);
    const down = { x: -Math.sin(wind.dir), z: -Math.cos(wind.dir) };
    const leeSide = Math.sign(down.x * Math.cos(self.heading) + down.z * -Math.sin(self.heading)) || 1; // which side the wind pushes toward
    bobBoat(selfBoat.group, self.x, self.z, self.heading, waves, seaWind, -leeSide * heel);

    // luff flutter: the sail shivers when headed (the shift signal) or too close to the wind
    stepLuff(luff, off, dt);
    selfBoat.setSailAngle(leewardSign(self.heading, wind.dir) * self.trim + (layerOn('luff') ? luffFlutter(luff.luff, nowS) : 0));

    // speed feel
    const bp = selfBoat.group.position;
    wake.update(dt, bp, self.heading, self.speed);
    spray.update(dt, bp, self.heading, self.speed, layerOn('spray') ? sprayRate(feelCam.share(), wind.strength, S.spray) : 0);
    arrow.object.visible = layerOn('arrow');
    if (layerOn('arrow')) arrow.update(bp, wind);

    // the wind painted on the water: rebuilt a few rows per frame (about 8 frames per full refresh), so no frame pays for all of it
    const p0 = performance.now(); paint.step(field, gt, self.x, self.z, 6); paintMs = paintMs * 0.95 + (performance.now() - p0) * 0.05;

    const viewTarget = new THREE.Vector3(self.x, bp.y, self.z);
    sun.position.copy(viewTarget).add(sunOffset); sun.target.position.copy(viewTarget);
    era.water.update(waves, seaWind, viewTarget, dt, camera.position);
    feelCam.update(dt, bp, self.heading, self.speed, { zoom: S.zoom, dip: layerOn('dip'), look: layerOn('look') });
    const cam = camera.position.distanceTo(viewTarget);
    scene.fog.color.set(CONFIG.HAZE_COLOR); scene.fog.near = cam * CONFIG.HAZE_MESH_NEAR_MUL; scene.fog.far = cam * CONFIG.HAZE_MESH_FAR_MUL;
    sky.update(camera);

    if (hud) updateHud(hud, wind, self.trim, idealTrimRad(off), self.heading, self.speed, { foundText: '' });
    renderer.render(scene, camera);
    phone?.draw(nowS, { partner: null, pings: [], foundText: '' });
    readout(now);

    frames.push(performance.now() - t0); if (frames.length > 90) frames.shift();
    if (S.debug && Math.floor(nowS * 2) !== frame.lastHalf) {
      frame.lastHalf = Math.floor(nowS * 2);
      const avgCpu = frames.reduce((a, b) => a + b, 0) / frames.length;
      $('debug').textContent = `fps ${(1000 / Math.max(1, frameGap())).toFixed(0)}  cpu ${avgCpu.toFixed(1)} ms/frame\nwind paint ${paintMs.toFixed(1)} ms/frame  buckets ${field.cachedBuckets()}`;
    }
    requestAnimationFrame(frame);
  }
  // frame gap, averaged over the last second, for the debug fps
  const gaps = []; let lastNow = performance.now();
  const frameGap = () => gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length);
  const gapLoop = () => { const n = performance.now(); gaps.push(n - lastNow); lastNow = n; if (gaps.length > 60) gaps.shift(); requestAnimationFrame(gapLoop); };
  requestAnimationFrame(gapLoop);

  loading.remove();
  requestAnimationFrame(frame);

  window.__sfl = {
    ready: true, S, self, era, selfBoat, camera, panel, paint, wind,
    get field() { return field; }, get hold() { return hold; }, set hold(v) { hold = !!v; }, get gt() { return gt; }, set gt(v) { gt = v; },
    fps: () => 1000 / Math.max(1, frameGap()), cpuMs: () => frames.reduce((a, b) => a + b, 0) / Math.max(1, frames.length), paintMs: () => paintMs,
    placeBoat, placeStart, applyDemo, findWater, writeUrl, weatherAt, compassToDir,
    teleport(x, z, heading) { placeBoat(x, z, heading ?? self.heading, { speedNow: false }); },
  };
}

main().catch((err) => {
  console.error(err);
  const loading = document.getElementById('loading');
  if (loading) { loading.className = 'err'; loading.textContent = `the sail-feel lab failed to start:\n${(err && err.stack) || err}`; }
});
