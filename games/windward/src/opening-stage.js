// The opening, drawn in the game engine (stage 1e, batch 2b): dusk over today's Fiskebäckskil, fog, thunder and flashes, the lighthouse rewind in the dark, and a last flash
// before the game takes over in 1950. It runs BEFORE the game starts, on the game's canvas with its own renderer and scene, and cleans everything up when it ends.
// Reuses the game's own pieces: the real Today coast (terrain, trees, the lighthouses), the busy coast with its night windows and the ferry's lights, the sea shader,
// the sky, Svalan's boat mesh, the lighthouse models and their lantern glow. The looks come from src/dusk.js (reusable by the later day/night stage); the rewind's
// timeline and layout are src/rewind.js (pure, tested); where the house is: src/opening-site.js (pure, tested); the words and times: src/story-1950.js.
import * as THREE from '../vendor/three/three.module.js';
import { CONFIG } from './config.js';
import { createSky } from './sky.js';
import { createSunGlow } from './sunGlow.js';
import { createWater, seaHeightCPU, createWaveState, stepWaves } from './water.js';
import { initialWind } from './wind.js';
import { createBoatMesh, loadBoatModel } from './boats.js';
import { snapFixedCamera } from './camera.js';
import { createBusyCoast } from './busy-coast.js';
import { createLighthouse, LIGHTHOUSES } from './lighthouses.js';
import { createLanternFx } from './lantern.js';
import { isBlocked } from './shore.js';
import { fogMoodValues } from './old-tower.js';
import { wantsPhoneControls } from './phone.js';
import { BLUE_HOUR, STORM_NIGHT, snapshotLook, blendLook, applyLook } from './dusk.js';
import { layoutRow, rewindFrame, REWIND } from './rewind.js';
import { OPENING_PLAN, OPENING_LINES, OPENING_FLASHES, OPENING_TOTAL_S, OPENING_SKIP } from './story-1950.js';
import { phaseAt, flashLevel, darkLevel } from './opening.js';
import { pickSite, ferryClockFor, frameSite } from './opening-site.js';
import { createJetty } from './jetty.js';

const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const ROW_Z = -1500;      // the rewind row sits out in the open sea, far from the coast (the coast is hidden then)
const ROW_CAM_DIST = 80;  // how far in front of the row the camera stands (a phone shows one or two towers)
const WINK_S = 0.45;
// The rewind's sky and its faint distant lightning (seconds into the rewind; flashLevel() shapes each one).
// One misty colour for ALL the sky above the horizon and the haze the sea fades into (Felix: about #8898B5), so there is no band or edge between them.
const REWIND_SKY = { zenith: 0x8898b5, horizon: 0x8898b5, glow: 0xdbe6fa };
const REWIND_FLICKERS = [{ at: 0.9 }, { at: 1.1 }, { at: 3.4 }, { at: 5.6 }, { at: 5.8 }, { at: 8.2 }, { at: 10.7 }, { at: 10.9 }, { at: 12.6 }];
const lerpHex = (a, b, k) => { const m = (sh) => Math.round(((a >> sh) & 255) + (((b >> sh) & 255) - ((a >> sh) & 255)) * k); return (m(16) << 16) | (m(8) << 8) | m(0); };      // how long a tower takes to wink out

const CSS = `
.ow-root{position:fixed;inset:0;z-index:25;pointer-events:none;font-family:Georgia,"Times New Roman",serif;color:#eaf3f8;-webkit-user-select:none;user-select:none}
.ow-line{white-space:pre-line;position:absolute;left:0;right:0;bottom:17%;padding:0 28px;text-align:center;font-style:italic;font-size:21px;line-height:1.35;text-shadow:0 2px 12px rgba(0,0,0,.85);opacity:0;transition:opacity .9s}
.ow-label{position:absolute;transform:translate(-50%,0);white-space:nowrap;font:600 13px/1.2 Georgia,"Times New Roman",serif;letter-spacing:.04em;color:#f4ecd8;text-shadow:0 1px 3px rgba(0,0,0,.85),0 0 8px rgba(0,0,0,.6);pointer-events:none}
.ow-year{position:absolute;left:0;right:0;top:7%;text-align:center;font:700 64px/1 system-ui,sans-serif;letter-spacing:.02em;color:#f2c46d;text-shadow:0 2px 14px rgba(0,0,0,.8);font-variant-numeric:tabular-nums;opacity:0;transition:opacity .6s}
.ow-skip{position:absolute;right:14px;bottom:14px;pointer-events:auto;touch-action:manipulation;font:500 13px system-ui,sans-serif;color:#eaf3f8;background:rgba(10,20,30,.55);border:1px solid rgba(234,246,255,.28);border-radius:16px;padding:8px 16px;cursor:pointer}
.ow-flash{position:absolute;inset:0;background:#dfe8ff;opacity:0}
.ow-black{position:absolute;inset:0;background:#000;opacity:1}
`;

// coast: the Today coast built with summerShare 1 (every cottage is a lit-window house of the busy coast); busy: { profile, world } or null; village: { x, z }.
// Returns { done: Promise<'finished' | 'skipped'>, skip(), dispose() }. audio: the game's audio (thunder), optional.
export function playOpening({ canvas, coast, busy = null, village, seed = 1, audio = null, parent = document.body }) {
  const savedLook = snapshotLook();
  const savedHaze = { HAZE_MESH_NEAR_MUL: CONFIG.HAZE_MESH_NEAR_MUL, HAZE_MESH_FAR_MUL: CONFIG.HAZE_MESH_FAR_MUL, HAZE_WATER_NEAR_MUL: CONFIG.HAZE_WATER_NEAR_MUL, HAZE_WATER_FAR_MUL: CONFIG.HAZE_WATER_FAR_MUL, HAZE_WATER_STRENGTH: CONFIG.HAZE_WATER_STRENGTH };

  // ---- renderer, scene, camera --------------------------------------------------------------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, wantsPhoneControls() ? CONFIG.PHONE_MAX_PIXEL_RATIO : Infinity));
  const scene = new THREE.Scene();
  const sky = createSky(); scene.add(sky.mesh);
  const camera = new THREE.PerspectiveCamera(CONFIG.FIXED_CAMERA_FOV_DEG, 1, CONFIG.CAMERA_NEAR, 2000);
  const hemi = new THREE.HemisphereLight(CONFIG.HEMI_SKY_COLOR, CONFIG.HEMI_GROUND_COLOR, CONFIG.HEMI_INTENSITY); scene.add(hemi);
  const sun = new THREE.DirectionalLight(CONFIG.SUN_COLOR, CONFIG.SUN_INTENSITY); scene.add(sun, sun.target); // no shadows in the opening: a phone has enough to do
  const sunGlow = createSunGlow(); scene.add(sunGlow.sprite);
  scene.fog = new THREE.Fog(CONFIG.HAZE_COLOR, 1e6, 2e6);
  const water = createWater(coast.depthMap); scene.add(water.mesh);
  let wind = initialWind(seed); wind = { dir: wind.dir, strength: 0.5 };
  const waves = createWaveState(wind.dir);
  const seaAt = (x, z) => seaHeightCPU(x, z, waves.phases, wind.dir, wind.strength);

  // ---- the world of today: the coast, the busy coast (night: lit windows, the ferry's lights) ---------------------------------------------------
  const world = new THREE.Group(); world.name = 'opening-today'; scene.add(world);
  world.add(coast.group);
  const site = pickSite({ houses: coast.summerHouses, village, heightAt: coast.heightAt });
  let clockBase = 0, busyCoast = null;
  if (busy) {
    const t0 = performance.now() / 1000;
    const profile = { ...busy.profile, houses: { ...busy.profile.houses, litShare: 1 } }; // at dusk every window is lit
    busyCoast = createBusyCoast({ world: busy.world, profile, toGame: coast.world.toGame, houses: coast.summerHouses, seaY: seaAt, blocked: (x, z) => isBlocked(coast.sailHeightAt, x, z), night: true, clock: () => clockBase + (performance.now() / 1000 - t0) });
    world.add(busyCoast.group);
    const ferry = busyCoast.vessels.find((v) => v.kind === 'ferry');
    const base = site && ferry ? (ferryClockFor(ferry, site.house, { atS: 2.5, withinM: 80 }) ?? ferryClockFor(ferry, site.house, { atS: 2.5, withinM: 170 })) : null; // coming in past the house during the wide first shot
    clockBase = base ?? 0;
  }
  // Svalan at the jetty of the house by the water
  loadBoatModel();
  const svalan = createBoatMesh(0xffcc66, { type: 'koster' });
  svalan.group.name = 'svalan-at-jetty';
  const jetty = new THREE.Group(); jetty.name = 'jetty';
  if (site) {
    jetty.add(createJetty(site));
    world.add(jetty);
    svalan.group.position.set(site.boat.x, 0, site.boat.z); svalan.group.rotation.y = site.boat.heading;
    world.add(svalan.group);
  }

  // ---- the rewind: the row of lighthouses, each on a small rock, lit, in the dark -------------------------------------------------------------------------
  const row = layoutRow(LIGHTHOUSES);
  const rewind = new THREE.Group(); rewind.name = 'opening-rewind'; rewind.visible = false; scene.add(rewind);
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x8a7f86, flatShading: true });
  const towers = row.map((r, i) => {
    const entry = LIGHTHOUSES.find((l) => l.name === r.name);
    const holder = new THREE.Group(); holder.position.set(r.x, 0, ROW_Z); rewind.add(holder);
    const lh = createLighthouse(r.name); holder.add(lh);
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(5.5, 0), rockMat); rock.scale.set(1, 0.45, 1); rock.rotation.y = i * 1.3; rock.position.y = -0.7; holder.add(rock);
    // no sweeping beam: in a dense row the beams overlap into flat shapes; the halo flashing on the real pattern is enough
    let fx = null; try { fx = createLanternFx(lh, { ...entry, light: entry.light || { pattern: 'steady', kind: 'fixed', period: 0 } }, { beam: false }); fx.setLit(true); } catch { fx = null; }
    return { ...r, entry, holder, fx, diedAt: null };
  });

  // ---- the DOM: a line of words, the year, the labels, Skip, a black veil and a flash ----------------------------------------------------------------------
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const root = document.createElement('div'); root.className = 'ow-root'; parent.appendChild(root);
  const lineEl = document.createElement('div'); lineEl.className = 'ow-line';
  const yearEl = document.createElement('div'); yearEl.className = 'ow-year';
  const flashEl = document.createElement('div'); flashEl.className = 'ow-flash';
  const blackEl = document.createElement('div'); blackEl.className = 'ow-black';
  const skipEl = document.createElement('button'); skipEl.className = 'ow-skip'; skipEl.type = 'button'; skipEl.textContent = OPENING_SKIP;
  root.append(flashEl, lineEl, yearEl, blackEl, skipEl);
  // each lighthouse's NAME below it (small, readable); never its year: the big year in the middle is the only year
  const labels = towers.map((t) => { const el = document.createElement('div'); el.className = 'ow-label'; el.textContent = t.name; el.style.display = 'none'; root.insertBefore(el, blackEl); return el; });

  // ---- sizing, camera, look ---------------------------------------------------------------------------------------------------------------------------
  let W = 1, H = 1;
  function resize() {
    W = canvas.clientWidth || window.innerWidth; H = canvas.clientHeight || window.innerHeight;
    renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
  }
  resize(); window.addEventListener('resize', resize);
  const view = new THREE.Vector3(), aim = new THREE.Vector3();
  const framing = () => (site ? frameSite(site, W / H) : { x: village.x, z: village.z, zoom: 0.7 }); // where the camera settles: house, jetty and Svalan in one portrait frame

  function setLights(flash) {
    hemi.color.set(CONFIG.HEMI_SKY_COLOR); hemi.groundColor.set(CONFIG.HEMI_GROUND_COLOR); hemi.intensity = CONFIG.HEMI_INTENSITY * (1 + 4 * flash) * (rewind.visible ? 1.9 : 1); // the towers must read in the dark
    sun.color.set(CONFIG.SUN_COLOR); sun.intensity = CONFIG.SUN_INTENSITY * (1 + 6 * flash);
    const az = (CONFIG.LIGHT_AZIMUTH_DEG * Math.PI) / 180, el = (CONFIG.LIGHT_ELEVATION_DEG * Math.PI) / 180;
    sun.position.set(view.x + Math.sin(az) * Math.cos(el) * 20, view.y + Math.sin(el) * 20, view.z + Math.cos(az) * Math.cos(el) * 20); sun.target.position.copy(view);
  }

  // ---- the run ----------------------------------------------------------------------------------------------------------------------------------------------
  let t = 0, frozen = false, last = performance.now(), raf = 0, finished = false, thunderDone = new Set();
  let resolveDone; const done = new Promise((r) => { resolveDone = r; });
  const rowCam = { x: 0 };

  function frame(now) {
    if (finished) return;
    raf = requestAnimationFrame(frame);
    const dt = frozen ? 0 : Math.min(0.1, (now - last) / 1000); last = now; t += dt;
    if (t >= OPENING_TOTAL_S) { finish('finished'); return; }
    const ph = phaseAt(t);
    const inRewind = t >= 24 && t < OPENING_TOTAL_S;
    const flash = flashLevel(t, OPENING_FLASHES);

    // look: blue hour -> storm night (9..23 s); the rewind is a little lighter than the storm so the towers read; fog thickens 10..16 s and thins in the dark
    const k = smooth((t - 9) / 14);
    let look = blendLook(BLUE_HOUR, STORM_NIGHT, k);
    if (inRewind) { // a stormy sky (not a dark band): cloud grey-blue, the sea haze the same colour as the horizon so they meet; faint lightning flickers in the clouds
      look = blendLook(look, BLUE_HOUR, 0.32);
      look = { ...look, SKY_ZENITH_COLOR: REWIND_SKY.zenith, SKY_HORIZON_COLOR: REWIND_SKY.horizon, HAZE_COLOR: REWIND_SKY.horizon };
      const fl = flashLevel(t - 24, REWIND_FLICKERS) * 0.35;
      if (fl > 0) look = { ...look, SKY_ZENITH_COLOR: lerpHex(look.SKY_ZENITH_COLOR, REWIND_SKY.glow, fl), SKY_HORIZON_COLOR: lerpHex(look.SKY_HORIZON_COLOR, REWIND_SKY.glow, fl), HAZE_COLOR: lerpHex(look.HAZE_COLOR, REWIND_SKY.glow, fl) };
    }
    applyLook(look);
    const fogK = inRewind ? 0.55 : smooth((t - 10) / 6) * 0.85;
    const fog = fogMoodValues(savedHaze, fogK); delete fog.HAZE_COLOR; Object.assign(CONFIG, fog);
    if (inRewind) CONFIG.HAZE_WATER_STRENGTH = 1; // the far sea takes ALL of the haze colour: it meets the sky without an edge

    // storm: the wind and the sea rise with the dark
    wind = { dir: wind.dir, strength: 0.5 + 0.5 * smooth((t - 10) / 10) };
    stepWaves(waves, dt, wind, view.x, view.z);

    // camera + what is shown
    world.visible = !inRewind; rewind.visible = inRewind;
    if (!inRewind) {
      const settle = smooth(t / 9);
      const startTarget = { x: village.x, z: village.z };
      const fr = framing();
      view.set(startTarget.x + (fr.x - startTarget.x) * settle, 0, startTarget.z + (fr.z - startTarget.z) * settle);
      const zoom = 3.0 + (fr.zoom - 3.0) * settle; // wide over the village, then in on the house
      snapFixedCamera(camera, view, zoom);
      if (coast.update(view.x, view.z, dt, t, seaAt)) { /* trees rebuilt */ }
      busyCoast?.update(dt, { x: view.x, z: view.z, heading: 0, speed: 0 }, [{ x: view.x, z: view.z, heading: 0, speed: 0 }]);
      svalan.group.position.y = seaAt(svalan.group.position.x, svalan.group.position.z);
      svalan.group.rotation.z = 0.04 * Math.sin(t * 1.3); svalan.group.rotation.x = 0.03 * Math.sin(t * 0.9 + 1);
      for (const l of coast.lights || []) l.fx?.update?.(t, 1);
      waterFollow(view);
    } else {
      const f = rewindFrame(t - 24, row);
      rowCam.x = f.x;
      view.set(f.x, 9, ROW_Z);
      camera.position.set(f.x, 17, ROW_Z + ROW_CAM_DIST); camera.lookAt(f.x, 8, ROW_Z);
      for (let i = 0; i < towers.length; i++) {
        const tw = towers[i];
        if (tw.diedAt === null && f.yearExact < tw.effBuilt) tw.diedAt = t; // built after the year now showing: it winks out
        const age = tw.diedAt === null ? -1 : (t - tw.diedAt) / WINK_S;
        const s = age < 0 ? 1 : age >= 1 ? 0 : 1 - smooth(age);
        tw.holder.visible = s > 0.002; tw.holder.scale.setScalar(Math.max(0.001, s * (age >= 0 ? 1 + 0.35 * Math.sin(Math.min(1, age) * Math.PI) : 1)));
        tw.fx?.update?.(t + i * 0.37, 1);
        const lab = labels[i];
        if (Math.abs(tw.x - f.x) < 30 && s > 0.05) { // below the tower: under its rock, where the sea starts
          const p = new THREE.Vector3(tw.x, -1.6, ROW_Z).project(camera);
          lab.style.display = 'block'; lab.style.left = `${(p.x * 0.5 + 0.5) * W}px`; lab.style.top = `${(-p.y * 0.5 + 0.5) * H + 6}px`; lab.style.opacity = String(s);
        } else lab.style.display = 'none';
      }
      yearEl.textContent = String(f.year);
      waterFollow(view);
    }
    sky.update(camera); sunGlow.update(camera);
    if (inRewind) { // the sky shader writes its colours to the screen WITHOUT the sRGB conversion the haze and the sea get, so the same hex looks darker on it: feed it the raw colour instead, and the whole sky is the colour of the mist below it
      const c = CONFIG.SKY_HORIZON_COLOR;
      for (const u of [sky.mesh.material.uniforms.uHorizonColor.value, sky.mesh.material.uniforms.uZenithColor.value]) u.setRGB(((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255);
    }
    const camTo = camera.position.distanceTo(view);
    scene.fog.color.set(CONFIG.HAZE_COLOR); scene.fog.near = camTo * CONFIG.HAZE_MESH_NEAR_MUL; scene.fog.far = camTo * CONFIG.HAZE_MESH_FAR_MUL;
    setLights(flash);
    // black: the fade in at the start, the dark after the strike, the veil at the very end
    const fadeIn = 1 - smooth(t / 1.4), outVeil = ph && ph.id === 'out' ? smooth(ph.u) : 0;
    blackEl.style.opacity = String(Math.max(fadeIn, darkLevel(t), outVeil));
    flashEl.style.opacity = String(flash * (flash > 0.9 ? 0.85 : 0.55));

    // words and the year
    const line = OPENING_LINES.find((l) => t >= l.from && t < l.to);
    if (line) { if (lineEl.textContent !== line.text) lineEl.textContent = line.text; lineEl.style.opacity = '1'; } else lineEl.style.opacity = '0';
    yearEl.style.opacity = inRewind ? '1' : '0';
    // thunder, a little after each flash
    for (const f of OPENING_FLASHES) if (t >= f.at + f.thunderAfter && !thunderDone.has(f.at)) { thunderDone.add(f.at); audio?.thunder?.(0, 0.5 + 0.5 * Math.min(1, 1.2 - f.thunderAfter)); }
    // the end: a last flash and the veil closes over the stop at 1950
    if (ph && ph.id === 'out') flashEl.style.opacity = String(0.8 * (1 - ph.u));
    renderer.render(scene, camera);
  }
  function waterFollow(v) { water.update(waves, wind, v, 0.016, camera.position); }

  function finish(how) {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose?.(); });
    water.mesh.material.dispose?.();
    busyCoast?.dispose?.();
    renderer.dispose();
    root.remove(); style.remove();
    Object.assign(CONFIG, savedHaze); applyLook(savedLook); // the game's own look, untouched
    resolveDone(how);
  }
  skipEl.addEventListener('click', () => finish('skipped'));
  raf = requestAnimationFrame(frame);
  return { done, skip: () => finish('skipped'), dispose: () => finish('skipped'), get elapsed() { return t; }, debug: { scene, camera, site, row, towers, busy: busyCoast, get t() { return t; }, set t(v) { t = v; }, set frozen(v) { frozen = !!v; } } };
}
