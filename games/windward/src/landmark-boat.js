// "From the boat" for the Landmark Lab: the game's own coast of an era (the same world build as world-1700-lab.js), the kit's landmarks placed on it from data/landmarks.json, a boat
// parked on the water at the view's start, and the game's fixed camera: as it is on main, or agent 2's weather camera (x1.4, then dipped and looking ahead at speed).
//
// Placement follows src/world-year-build.js: a landmark goes to the NEAREST LAND within 90 game m of its position (the report lists any that moved more than 30 m), sits at
// max(0.25, ground height) (cairns 0.1 lower), and is enlarged by its readScale (cairn x1.8, mark x2.0) so it reads from the game camera. Nothing here is used by the game.
import * as THREE from '../vendor/three/three.module.js';
import { CONFIG } from './config.js';
import { createBoatMesh } from './boats.js';
import { seaHeightCPU, createWaveState, stepWaves } from './water.js';
import { findOpenWater } from './coast-world.js';
import { loadWorldFiles, buildWorldForSpec, nearestLand } from './world-year-build.js';
import { worldAtYear, yearOfEra } from './world-year.js';
import { createLandmark } from './landmark-assets.js';
import { placementsFor, bearingToYaw, bearingVector, seawardBearing, boatWanted, rigPose, readScaleOf } from './landmark-place.js';

const WORLD_ERA = { 1703: '1700', 1950: '1950', today: 'today' }; // the world files know 1700 (the 1703 jump lands in the same coast), 1950 and today
const SNAP_M = 90; // game metres: how far the game moves a mark to reach land (world-year-build.js)
const tick = () => new Promise((r) => setTimeout(r, 30));

export async function createBoatMode({ scene, camera, onStatus = () => {} }) {
  onStatus('loading the coast and the landmark data…');
  const files = await loadWorldFiles();
  const data = await (await fetch(new URL('../data/landmarks.json', import.meta.url), { cache: 'no-store' })).json();
  const eras = {};
  const wind = { dir: 0.6, strength: 0.3 }; // a light breeze, like the shelf
  const waves = createWaveState(wind.dir);
  const seaAt = (x, z) => seaHeightCPU(x, z, waves.phases, wind.dir, wind.strength);
  const root = new THREE.Group(); // everything this mode adds to the scene
  root.visible = false;
  scene.add(root);
  let cur = null; // { eraId, era, group, boat, pose, placed }

  async function ensureEra(eraId) {
    if (eras[eraId]) return eras[eraId];
    onStatus(`building the coast of ${eraId === 'today' ? 'today' : eraId}…`);
    await tick();
    const wid = WORLD_ERA[eraId];
    const spec = worldAtYear(files.years, files.sources, yearOfEra(files.years, wid));
    eras[eraId] = buildWorldForSpec(files, spec);
    return eras[eraId];
  }
  const boatFor = (spec) => createBoatMesh(0xffcc66, spec.boats.kit === 'eka' ? { type: 'eka', sailTone: 'rust', deck: [null, null, null] } : { type: 'koster', deck: ['crate', 'barrel', null] });

  // Put one placement on the era's coast; report what the snap did.
  function place(p, era, S, lmGroup) {
    const w = era.world;
    const [gx, gz] = w.toGame(p.lon, p.lat);
    const land = nearestLand(w, gx, gz, SNAP_M, 0.5);
    const x = land ? land.x : gx, z = land ? land.z : gz;
    const ground = Math.max(0.25, w.heightAt(x, z));
    const heading = p.heading ?? seawardBearing(w.heightAt, x, z, { r: 14 });
    const lm = createLandmark(p.type, { variant: p.variant, era: S.era, night: !!S.night, ...(p.opts ?? {}) });
    lm.group.position.set(x, ground - (p.type === 'cairn' ? 0.1 : 0), z);
    lm.group.rotation.y = bearingToYaw(heading);
    lm.group.scale.setScalar(S.rs ? readScaleOf(p.type) : 1);
    lm.group.userData = { landmarkId: p.id };
    lmGroup.add(lm.group);
    return { id: p.id, kit: lm, x, z, ground, snapped: land ? Math.hypot(land.x - gx, land.z - gz) : null, onLand: !!land, heading };
  }

  // Show a view: era, view id, options { rs, night, lm (draw the kit's landmarks at all) }. Returns a report.
  async function show(S) {
    const era = await ensureEra(S.era);
    if (cur) { root.remove(cur.group); cur.placed.forEach((q) => q.kit.dispose()); if (cur.era !== era) { root.remove(cur.era.group, cur.era.water.mesh); } }
    if (!cur || cur.era !== era) root.add(era.water.mesh, era.group);
    const group = new THREE.Group();
    const placed = [];
    if (S.lm) for (const p of placementsFor(data, S.era)) placed.push(place(p, era, S, group));
    root.add(group);
    const view = data.views.find((v) => v.id === S.view) ?? data.views[0];
    const want = boatWanted(view, era.world.toGame);
    // open water ALONG the view's bearing (stepping outward from the wanted distance), so the landmark stays dead ahead; the nearest water anywhere is only the fallback
    const dirv = bearingVector(view.from);
    let water = null;
    for (let r = view.distM; r <= view.distM * 3 && !water; r += 1) {
      const x = want.focus.x + dirv.x * r, z = want.focus.z + dirv.z * r;
      if (era.sailHeightAt(x, z) < -3 && era.sailHeightAt(x + 6, z) < -2.5 && era.sailHeightAt(x - 6, z) < -2.5) water = { x, z, r };
    }
    water ??= findOpenWater(era.world, want.x, want.z, { clear: 10, maxR: 160 }) ?? { x: want.x, z: want.z };
    const heading = Math.atan2(want.focus.x - water.x, want.focus.z - water.z); // the game's heading: 0 = +z = south
    let boat = cur && cur.eraId === S.era ? cur.boat : null;
    if (!boat) { if (cur?.boat) root.remove(cur.boat.group); boat = boatFor(era.spec); root.add(boat.group); }
    boat.group.position.set(water.x, seaAt(water.x, water.z), water.z);
    boat.group.rotation.y = heading;
    boat.setSailAngle?.(0.5);
    cur = { eraId: S.era, era, group, boat, placed, view, focusGame: want.focus, pose: { x: water.x, z: water.z, heading }, S };
    root.visible = true;
    return describe();
  }
  function describe() {
    if (!cur) return null;
    const far = cur.placed.filter((q) => q.snapped != null && q.snapped > 30).map((q) => `${q.id} (${q.snapped.toFixed(0)} m)`);
    const off = cur.placed.filter((q) => !q.onLand).map((q) => q.id);
    return { era: cur.eraId, view: cur.view.id, label: cur.view.label, placed: cur.placed.length, snappedFar: far, noLandWithin90m: off, boat: { x: +cur.pose.x.toFixed(1), z: +cur.pose.z.toFixed(1), distToFocus: +Math.hypot(cur.pose.x - cur.focusGame.x, cur.pose.z - cur.focusGame.z).toFixed(1) }, triangles: cur.placed.reduce((s, q) => s + q.kit.describe().triangles, 0) };
  }
  function setNight(on) { cur?.placed.forEach((q) => q.kit.setNight(on)); }
  function setScale(on) { cur?.placed.forEach((q) => q.kit.group.scale.setScalar(on ? q.kit.readScale : 1)); }

  // One frame: sea, the era's own updates, the boat on the sea, and the camera. rig: 'game' | 'weather' | 'speed'; orbit: { az, el, dist } or null.
  const viewTarget = new THREE.Vector3();
  function frame(dt, nowS, { rig = 'game', orbit = null, sun = null, sunOffset = null } = {}) {
    if (!cur) return null;
    const { era, boat, pose } = cur;
    stepWaves(waves, dt, wind, pose.x, pose.z);
    era.update(pose.x, pose.z, dt, nowS, seaAt);
    boat.group.position.y = seaAt(pose.x, pose.z);
    let dist;
    if (orbit) {
      const a = (orbit.az * Math.PI) / 180, e = (orbit.el * Math.PI) / 180;
      viewTarget.set(pose.x, 0, pose.z);
      camera.position.set(pose.x + Math.sin(a) * Math.cos(e) * orbit.dist, Math.sin(e) * orbit.dist, pose.z + Math.cos(a) * Math.cos(e) * orbit.dist);
      dist = orbit.dist;
    } else {
      const r = rigPose(rig, pose, pose.heading, { distance: CONFIG.FIXED_CAMERA_DISTANCE, elevationDeg: CONFIG.FIXED_CAMERA_ELEVATION_DEG, azimuthDeg: CONFIG.FIXED_CAMERA_AZIMUTH_DEG });
      viewTarget.set(r.target.x, 0, r.target.z);
      camera.position.set(r.position.x, r.position.y, r.position.z);
      dist = r.distance;
    }
    camera.lookAt(viewTarget);
    era.water.update(waves, wind, viewTarget, dt, camera.position);
    if (sun && sunOffset) { sun.position.copy(viewTarget).add(sunOffset); sun.target.position.copy(viewTarget); }
    return { dist, target: viewTarget };
  }
  function hide() { root.visible = false; }
  return { show, frame, hide, describe, setNight, setScale, views: data.views, data, get shown() { return cur; }, get visible() { return root.visible; } };
}
