// WORLD BY YEAR, the builder (felix/windward-1700-preview): turns a description from world-year.js into a scene, using the game's own
// world code (src/coast-world.js, passes, shoals, terrain style, trees, sea marks) so that "Today" is the game's coast and "1700" is the
// same coast seen at another water level with another kit. Nothing in game.js or coast-world.js is changed; both are only called.
//
//   const files = await loadWorldFiles();                          // once: the raster, the JSON, the 1700 data
//   const era = buildWorldForSpec(files, worldAtYear(years, sources, 1700));
//   scene.add(era.group, era.water.mesh);  era.update(x, z, dt, seaHeightAt);  era.sailHeightAt / era.shoalSlowAt for the boat.
//
// A description with hidden rocks gets them as solid-but-unseen shoals: they enter the shoal index as hard (a keel hits them, the
// boat slides off like land) but the picture is a faint pale patch and an occasional breaker, not a white surf ring.
import * as THREE from '../vendor/three/three.module.js';
import { CONFIG } from './config.js';
import { loadCoast } from './coast-data.js';
import { buildCoastWorld, createCoastTerrain, createCoastTrees, placeCoastVillages, placeCoastLighthouses, findOpenWater, COAST_TILES, EDGE_FADE_M, EDGE_CLAMP_M } from './coast-world.js';
import { applyPasses } from './passes.js';
import { shoalLook, createShoalLayer } from './shoal-look.js';
import { createShoalIndex, makeSailHeight, GAME_PASS_TIERS } from './sea-truth.js';
import { attachTerrainStyle, STYLE_GAME } from './terrain-style.js';
import { createSeamarkLayer } from './seamark-layer.js';
import { createBuilding } from './props.js';
import { LIGHTHOUSES } from './lighthouses.js';
import { createAsset } from './era-assets.js';
import { createBoatMesh } from './boats.js';
import { createWater } from './water.js';
import { coastAtWaterLevel, shoalsInEra } from './world-year.js';

// ---- files -------------------------------------------------------------------------------------------------
// io: { json(url), bytes(url) }; the browser default fetches. Tests pass fs readers. Returns everything both eras need, loaded once.
export async function loadWorldFiles({ coastUrl, dataUrl, chartUrl, io } = {}) {
  coastUrl ??= new URL('../assets/coast/', import.meta.url).href;
  dataUrl ??= new URL('../data/', import.meta.url).href;
  chartUrl ??= new URL('../assets/chart/', import.meta.url).href;
  io ??= { json: async (u) => (await fetch(u)).json(), bytes: async (u) => new Uint8Array(await (await fetch(u)).arrayBuffer()) };
  const [coast, settlements, skerries, names, passes, shoals, seamarks, world1700, years] = await Promise.all([
    loadCoast(coastUrl, io, COAST_TILES), io.json(dataUrl + 'settlements-history.json'), io.json(coastUrl + 'skerries.json'), io.json(coastUrl + 'names.json'),
    io.json(coastUrl + 'passes.json'), io.json(coastUrl + 'shoals.json'), io.json(coastUrl + 'seamarks.json'), io.json(dataUrl + 'world-1700.json'), io.json(dataUrl + 'world-years.json'),
  ]);
  let chartCfg = null; // the game's chart config: gives the fog grid's extent, so the lab can read a saved Today chart. Optional.
  try { chartCfg = await io.json(chartUrl + 'chart.json'); } catch { chartCfg = null; }
  return { coast, settlements, skerries, names, passes, shoals, seamarks, years, sources: { 'world-1700.json': world1700 }, chartCfg };
}

const lerp = (a, b, t) => a + (b - a) * t;
const mulberry32 = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const slopeDeg = (world, x, z) => { const e = 2; const dx = (world.heightAt(x + e, z) - world.heightAt(x - e, z)) / (2 * e); const dz = (world.heightAt(x, z + e) - world.heightAt(x, z - e)) / (2 * e); return { deg: (Math.atan(Math.hypot(dx, dz)) * 180) / Math.PI, facing: Math.atan2(-dx, -dz) }; };

// nearest land at least minH high, searched in rings (a village's origin is approximate, often a few metres out in the water)
export function nearestLand(world, x, z, maxR = 140, minH = 0.9) {
  if (world.heightAt(x, z) >= minH) return { x, z, d: 0 };
  for (let r = 6; r <= maxR; r += 6) {
    const n = 16 + Math.round(r / 3);
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; const px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r; if (world.heightAt(px, pz) >= minH) return { x: px, z: pz, d: r }; }
  }
  return null;
}
// open water near a point: deeper than minDepth, clear of land by `clear` metres; for moored boats
function waterNear(world, x, z, rand, { minR = 18, maxR = 80, depth = 1.2, tries = 60 } = {}) {
  for (let i = 0; i < tries; i++) {
    const a = rand() * Math.PI * 2, r = minR + rand() * (maxR - minR);
    const px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
    if (world.heightAt(px, pz) > -depth) continue;
    let ok = true;
    for (let k = 0; k < 8 && ok; k++) if (world.heightAt(px + Math.sin(k) * 9, pz + Math.cos(k) * 9) > -0.6) ok = false;
    if (ok) return { x: px, z: pz };
  }
  return null;
}

// ---- 1700 settlements ----------------------------------------------------------------------------------------
// One cluster per settlement in the description: `cottages` of them (the data decides the size), a sea-shed and drying racks in the bigger
// ones. Same placement rules as the game's villages (land high enough, not too steep, spaced), facing downhill = towards the sea.
export function placeVillages1700(world, settlements, seed = 7) {
  const rand = mulberry32(seed);
  const buildings = [], villages = [];
  for (const s of settlements) {
    const [gx, gz] = world.toGame(s.lon, s.lat);
    if (!world.inside(gx, gz, EDGE_FADE_M)) { villages.push({ id: s.id, name: s.name, placed: 0, wanted: s.cottages, note: 'outside the window' }); continue; }
    const c = nearestLand(world, gx, gz);
    if (!c) { villages.push({ id: s.id, name: s.name, placed: 0, wanted: s.cottages, note: 'no land within 140 m' }); continue; }
    const radius = s.cottages >= 8 ? 62 : 40;
    const mine = [];
    let placed = 0, shed = false, racks = false;
    for (let attempt = 0; attempt < 700 && (placed < s.cottages || (s.cottages >= 6 && !shed) || (s.cottages >= 8 && !racks)); attempt++) {
      const ang = rand() * Math.PI * 2, r = Math.sqrt(rand()) * radius;
      const x = c.x + Math.sin(ang) * r, z = c.z + Math.cos(ang) * r;
      const y = world.heightAt(x, z);
      const { deg, facing } = slopeDeg(world, x, z);
      const shore = y >= 0.5 && y < 1.5;
      let kind = null;
      if (s.cottages >= 6 && !shed && shore && deg < 25) kind = 'boathouse';
      else if (s.cottages >= 8 && !racks && shore && deg < 25) kind = 'racks';
      else if (placed < s.cottages && y >= 0.9 && deg <= CONFIG.SETTLEMENT_MAX_SLOPE_DEG) kind = 'cottage';
      if (!kind) continue;
      const gap = kind === 'racks' ? 12 : CONFIG.SETTLEMENT_SPACING;
      if (buildings.some((b) => Math.hypot(b.x - x, b.z - z) < gap)) continue;
      const roll = rand();
      buildings.push({ kind, variant: kind === 'cottage' ? (roll < 0.5 ? 'a' : roll < 0.75 ? 'b' : 'c') : '', x, z, y: Math.max(0, y), facing: facing + (rand() - 0.5) * 0.5, village: s.id });
      mine.push(buildings[buildings.length - 1]);
      if (kind === 'boathouse') shed = true; else if (kind === 'racks') racks = true; else placed++;
    }
    villages.push({ id: s.id, name: s.name, placed, wanted: s.cottages, boathouse: shed, racks, uncertain: s.uncertain, at: { x: c.x, z: c.z } });
  }
  return { buildings, villages };
}

// ---- hidden rocks ------------------------------------------------------------------------------------------------
// A rock just under the surface: a faint pale patch, and now and then a breaker (a thin white ring that flares on a swell and is gone).
// Four phase groups so they do not all break at once. The look is drawn at the same height as the surf rings (above the highest crest).
const HIDDEN_Y = 0.48;
function fadeDisc(inner, segments, alphaAt) {
  const geo = inner > 0 ? new THREE.RingGeometry(inner, 1, segments, 2) : new THREE.CircleGeometry(1, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) col.set([1, 1, 1, alphaAt(Math.hypot(pos.getX(i), pos.getZ(i)))], i * 4);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  return geo;
}
export function createHiddenRockLayer(items) {
  const group = new THREE.Group();
  group.name = 'hidden-rocks';
  const patchGeo = fadeDisc(0, 14, (r) => (r < 0.45 ? 1 : Math.max(0, (1 - r) / 0.55)));
  const ringGeo = fadeDisc(0.55, 14, (r) => (r < 0.7 ? (r - 0.55) / 0.15 : Math.max(0, (1 - r) / 0.3)));
  const patchMat = new THREE.MeshBasicMaterial({ color: 0xcfe9e4, transparent: true, vertexColors: true, opacity: 0.2, depthWrite: false, fog: false });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const patches = new THREE.InstancedMesh(patchGeo, patchMat, Math.max(1, items.length));
  patches.count = items.length; patches.frustumCulled = false; patches.renderOrder = 1; patches.name = 'hidden-patch';
  const phases = [[], [], [], []];
  items.forEach((it, i) => {
    q.setFromAxisAngle(up, ((i * 2654435761) >>> 0) / 4294967296 * Math.PI * 2);
    p.set(it.x, HIDDEN_Y, it.z);
    sc.set(it.look.visualRadiusM, 1, it.look.visualRadiusM);
    patches.setMatrixAt(i, m4.compose(p, q, sc));
    phases[i % 4].push(it);
  });
  patches.instanceMatrix.needsUpdate = true;
  group.add(patches);
  const rings = phases.map((list, k) => {
    const mat = new THREE.MeshBasicMaterial({ color: 0xf4f6f2, transparent: true, vertexColors: true, opacity: 0, depthWrite: false, fog: false });
    const mesh = new THREE.InstancedMesh(ringGeo, mat, Math.max(1, list.length));
    mesh.count = list.length; mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.name = `hidden-breaker-${k}`;
    list.forEach((it, i) => { p.set(it.x, HIDDEN_Y + 0.01, it.z); sc.set(it.look.visualRadiusM * 0.9, 1, it.look.visualRadiusM * 0.9); mesh.setMatrixAt(i, m4.compose(p, q.identity(), sc)); });
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
    return { mat, mesh };
  });
  return {
    group, count: items.length, patches, rings,
    // a breaker every ~7 s per group, a quarter of a cycle apart, over a pulse about 1.2 s long
    update(t) { rings.forEach((r, k) => { const s = Math.sin((t / 7) * Math.PI * 2 + k * Math.PI / 2); r.mat.opacity = Math.max(0, s) ** 10 * 0.6; }); },
    dispose() { patchGeo.dispose(); ringGeo.dispose(); patchMat.dispose(); patches.dispose(); rings.forEach((r) => { r.mat.dispose(); r.mesh.dispose(); }); },
  };
}

// ---- the world for one description --------------------------------------------------------------------------------
// opts: { seed, patrol: how many tries to find a clear sailing line for each sailing eka }
export function buildWorldForSpec(files, spec, { seed = 1 } = {}) {
  const T0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const coast = coastAtWaterLevel(files.coast, spec.waterOffsetM);
  const world = buildCoastWorld(coast, { skerries: files.skerries.skerries });
  applyPasses(world, files.passes, { tiers: GAME_PASS_TIERS });
  const shoalList = shoalsInEra(files.shoals.shoals, spec, world.toGame, shoalLook);
  const shoalIndex = createShoalIndex(shoalList);
  const sailHeightAt = makeSailHeight(world.heightAt, shoalIndex);
  const terrain = createCoastTerrain(world, 1);
  const style = attachTerrainStyle(terrain, world, STYLE_GAME);
  const trees = createCoastTrees(world, seed, { skip: style.isGranite });

  const group = new THREE.Group();
  group.name = `world-${spec.era}`;
  group.add(terrain.group, trees.group);
  const props = new THREE.Group();
  props.name = 'props';
  const report = { era: spec.era, cottages: 0, boathouses: 0, racks: 0, marks: 0, lights: 0, mooredEkas: 0, sailingEkas: 0, hiddenRocks: 0, villages: [], notes: [...spec.notes] };
  const labels = [];
  const animated = []; // { update(dt, t, seaAt) }
  let hiddenLayer = null, shoalLayer = null, seamarkLayer = null;
  const rand = mulberry32(0xe9a1700 ^ seed);
  const inWindow = (x, z) => world.inside(x, z, EDGE_FADE_M);
  const spawnLL = files.names.spawn;
  const [sx, sz] = world.toGame(spawnLL.lon, spawnLL.lat);
  const spawn = findOpenWater(world, sx, sz);

  const templates = new Map();
  const stamp = (id, variant, x, y, z, facing, name) => {
    const key = `${id}:${variant}`;
    if (!templates.has(key)) templates.set(key, createAsset(id, { variant, night: false }));
    const g = templates.get(key).group.clone();
    g.position.set(x, y, z);
    g.rotation.y = facing;
    if (name) g.name = name;
    props.add(g);
    return g;
  };

  if (spec.era === 'today') {
    // the game's own villages and lighthouses, unchanged
    const { buildings, villages } = placeCoastVillages(world, files.settlements.settlements);
    for (const b of buildings) props.add(createBuilding(b));
    const names = LIGHTHOUSES.filter((l) => { const [x, z] = world.toGame(l.lon, l.lat); return inWindow(x, z); }).map((l) => l.name);
    for (const l of placeCoastLighthouses(world, names)) if (l.group) { props.add(l.group); report.lights++; }
    report.cottages = buildings.filter((b) => b.kind === 'cottage').length;
    report.boathouses = buildings.filter((b) => b.kind === 'boathouse').length;
    report.villages = villages;
    for (const s of files.settlements.settlements) {
      if (typeof s.lat !== 'number') continue;
      const [x, z] = world.toGame(s.lon, s.lat);
      if (inWindow(x, z)) labels.push({ id: s.id || s.name, x, z, text: s.name, year: null, uncertain: false, documented: true });
    }
    shoalLayer = createShoalLayer(shoalList);
    seamarkLayer = createSeamarkLayer({ marks: files.seamarks.marks, toGame: world.toGame, heightAt: world.heightAt });
    group.add(shoalLayer.group, seamarkLayer.group);
    report.hiddenRocks = 0;
  } else {
    const { buildings, villages } = placeVillages1700(world, spec.settlements, seed + 6);
    for (const b of buildings) {
      if (b.kind === 'cottage') { stamp('cottage', b.variant, b.x, b.y, b.z, b.facing, 'cottage'); report.cottages++; }
      else if (b.kind === 'boathouse') { stamp('boathouse', '', b.x, b.y, b.z, b.facing, 'boathouse'); report.boathouses++; }
      else { stamp('racks', '', b.x, b.y, b.z, b.facing + Math.PI / 2, 'racks'); report.racks++; }
    }
    report.villages = villages;
    // cairns and painted rocks, on the nearest rock or land
    for (const m of spec.marks) {
      const [mx, mz] = world.toGame(m.lon, m.lat);
      if (!inWindow(mx, mz)) continue;
      const land = nearestLand(world, mx, mz, 90, 0.5);
      const x = land ? land.x : mx, z = land ? land.z : mz;
      const y = Math.max(0.25, world.heightAt(x, z));
      const g = stamp(m.kind === 'cairn' ? 'kummel' : 'rockmark', '', x, m.kind === 'cairn' ? y - 0.1 : y - 0.2, z, rand() * Math.PI * 2, m.kind === 'cairn' ? 'kummel' : 'painted-rock');
      g.scale.setScalar(m.kind === 'cairn' ? 1.8 : 2.0); // a landmark: bigger than the 1:1 prop so it reads from the game camera
      g.userData = { markId: m.id, invented: m.invented, uncertain: m.uncertain };
      report.marks++;
    }
    for (const l of spec.labels) {
      const [lx, lz] = world.toGame(l.lon, l.lat);
      if (inWindow(lx, lz)) labels.push({ ...l, x: lx, z: lz });
    }
    // moored ekas near the villages (the biggest first), a few kinds of eka
    const sorted = [...villages].filter((v) => v.at).sort((a, b) => b.placed - a.placed);
    let moored = 0;
    for (let round = 0; moored < spec.boats.moored && round < 3 && sorted.length; round++) {
      for (const v of sorted) {
        if (moored >= spec.boats.moored) break;
        const w = waterNear(world, v.at.x, v.at.z, rand);
        if (!w) continue;
        const variant = ['a', 'b', 'c', 'd'][moored % 4];
        const g = stamp('eka', variant, w.x, 0, w.z, rand() * Math.PI * 2, 'eka-moored');
        animated.push({ update: (dt, t, seaAt) => { g.position.y = seaAt(w.x, w.z) - 0.05; } });
        moored++;
      }
    }
    report.mooredEkas = moored;
    // working ekas: sail back and forth along a clear line of open water near the start
    const clearLine = (a, b) => { const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 6); for (let i = 0; i <= n; i++) { const x = lerp(a.x, b.x, i / n), z = lerp(a.z, b.z, i / n); if (sailHeightAt(x, z) > -2.5) return false; } return true; };
    for (let k = 0; k < spec.boats.sailing && spawn; k++) {
      for (let tries = 0; tries < 300; tries++) {
        const a0 = rand() * Math.PI * 2, r0 = 90 + rand() * 260;
        const a = { x: spawn.x + Math.sin(a0) * r0, z: spawn.z + Math.cos(a0) * r0 };
        const a1 = rand() * Math.PI * 2, len = 200 + rand() * 160;
        const b = { x: a.x + Math.sin(a1) * len, z: a.z + Math.cos(a1) * len };
        if (!inWindow(a.x, a.z) || !inWindow(b.x, b.z) || !clearLine(a, b)) continue;
        const boat = createBoatMesh(0x66ccff, { type: 'eka', sailTone: k ? 'terracotta' : 'rust', deck: [null, null, null] });
        boat.group.name = 'eka-sailing';
        props.add(boat.group);
        const st = { t: rand() * 100, speed: 1.4 + rand() * 0.5, len };
        animated.push({ update: (dt, t, seaAt) => {
          st.t += dt * st.speed;
          const u = st.t % (2 * st.len), fwd = u < st.len, f = (fwd ? u : 2 * st.len - u) / st.len;
          const x = lerp(a.x, b.x, f), z = lerp(a.z, b.z, f);
          const heading = Math.atan2((b.x - a.x) * (fwd ? 1 : -1), (b.z - a.z) * (fwd ? 1 : -1));
          boat.group.position.set(x, seaAt(x, z), z);
          boat.group.rotation.y = heading;
          boat.setSailAngle(0.55 * (fwd ? 1 : -1));
        } });
        report.sailingEkas++;
        break;
      }
    }
    // the shoals: awash rocks that stayed awash keep their surf; the hidden ones get the faint patch and the breaker
    shoalLayer = createShoalLayer(shoalList.filter((s) => !s.hidden));
    const hidden = shoalList.filter((s) => s.hidden && inWindow(s.x, s.z));
    hiddenLayer = createHiddenRockLayer(hidden);
    group.add(shoalLayer.group, hiddenLayer.group);
    report.hiddenRocks = hidden.length;
    report.hiddenRockList = hidden.map((s) => ({ id: s.shoal.id, x: s.x, z: s.z }));
  }
  group.add(props);
  const water = createWater(world.depthMap);

  const clamp = (self) => {
    const m = EDGE_CLAMP_M;
    self.x = Math.min(world.bounds.maxX - m, Math.max(world.bounds.minX + m, self.x));
    self.z = Math.min(world.bounds.maxZ - m, Math.max(world.bounds.minZ + m, self.z));
  };
  const seaAtDefault = (x, z) => 0;
  return {
    era: spec.era, spec, world, group, water, props, terrain, trees, style, spawn, labels, report,
    heightAt: world.heightAt, sailHeightAt, shoalSlowAt: shoalIndex.slowAt, shoalList, shoalLayer, hiddenLayer, seamarkLayer, clamp,
    // per frame: terrain chunks and trees round the view, moving boats, breakers. Returns true when the trees were rebuilt.
    update(x, z, dt = 0, t = 0, seaAt = seaAtDefault) {
      terrain.update(x, z);
      const rebuilt = trees.update(x, z);
      for (const a of animated) a.update(dt, t, seaAt);
      shoalLayer?.update(t);
      hiddenLayer?.update(t);
      return rebuilt;
    },
    buildMs: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - T0,
    dispose() { group.traverse((o) => o.geometry?.dispose?.()); water.mesh.geometry?.dispose?.(); },
  };
}
