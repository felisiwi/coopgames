// REAL-COAST TRIAL (a spike, behind ?coast=real; nothing here runs without the flag).
//
// Question it answers: can the real Bohuslän coast run in the actual game on a phone?
// It turns a ~10 km window of the real coast rasters (assets/coast/, decoded by
// src/coast-data.js) into the same things the procedural islands provide:
//   - a height field and a smooth painted terrain mesh (island-look.js's palette),
//   - a depth map for the water shader (depthmap.js's format),
//   - trees near the boat (trees-near.js), villages, and two real lighthouses.
//
// Coordinates: game metres, x east, z south, origin = north-west corner of the coast plane
// (the convention src/trees-near.js's classSamplerFromCoast already uses). One raster pixel =
// coast.mpp / scale game metres = 2 m at 1:10. Keeping the plane origin (instead of a
// window-local one) means a later whole-coast version needs no coordinate change.
//
// Duplicated on purpose (spike): the terrain mesh builder (island.js's is bound to the
// procedural params). Merge them if the real coast is adopted.
import * as THREE from '../vendor/three/three.module.js';
import { CONFIG } from './config.js';
import { loadCoast } from './coast-data.js';
import { groundColor, PALETTE, LAB_REF, SLOPE_CALIBRATION } from './island-look.js';
import { DEEP_M, depthAndShoreFromSigned } from './depthmap.js';
import { makeTreesNear } from './trees-near.js';
import { createBuilding } from './props.js';
import { createLighthouse, LIGHTHOUSES } from './lighthouses.js';

export const COAST_SCALE = 10; // 1:10
// West Orust: Käringön, Gullholmen, Härmanö, Hälleviksstrand, Måseskär, Hättan all fall inside.
// ~10 km east-west, ~12 km north-south at real size (Måseskär and Gullholmen sit near the south/north edges).
export const COAST_WINDOW = { w: 11.30, e: 11.47, s: 58.08, n: 58.19 };
export const COAST_TILES = ['north']; // the one raster tile that holds the window
// Game metres of height per real metre of height. 1:10 uniform would be 0.1 (3 m hills: flat next
// to the procedural islands, whose peaks are 85 m on a 145 m radius). TODO(felix): confirm by eye.
export const COAST_VEX = 0.5;
export const COAST_SMOOTH = 2; // blur passes over the height field (?csmooth=)
export const LAND_LIFT_M = 0.4; // land is lifted this far so the shoreline sits clear of the +-0.4 m waves
export const EDGE_FADE_M = 80; // within this of the window edge, land sinks and sea deepens: no cliff at the edge
export const EDGE_CLAMP_M = 30; // the boat is held this far inside the window
export const CULL_BELOW_M = -0.7; // quads wholly below this are under the opaque sea (island.js's rule)
const TREE_RADIUS_M = 250;
const TREE_REBUILD_M = 30; // re-ask treesNear() when the boat moved this far
const TREE_CAP = 3500;

const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// ---- 1. the data layer: pure, no GPU ---------------------------------------------------------

// coast: the object loadCoast() returns (tests pass a synthetic one).
export function buildCoastWorld(coast, { scale = COAST_SCALE, window: win = COAST_WINDOW, vex = COAST_VEX, smooth = COAST_SMOOTH } = {}) {
  const t0 = now();
  const pxM = coast.mpp / scale;
  const [pw, pn] = coast.toPx(win.w, win.n);
  const [pe, ps] = coast.toPx(win.e, win.s);
  const i0 = Math.floor(pw);
  const j0 = Math.floor(pn);
  const nx = Math.ceil(pe) - i0;
  const nz = Math.ceil(ps) - j0;
  const H = new Float32Array(nx * nz); // game metres: >0 land, <0 sea floor (depth)
  const CL = new Uint8Array(nx * nz); // land-cover class value, 0 = water
  for (let b = 0; b < nz; b++) {
    for (let a = 0; a < nx; a++) {
      const k = b * nx + a;
      let h;
      if (coast.isLand(i0 + a, j0 + b)) {
        h = LAND_LIFT_M + coast.heightM(i0 + a, j0 + b) * vex;
        CL[k] = coast.classAt(i0 + a, j0 + b);
      } else {
        const d = coast.depthM(i0 + a, j0 + b);
        h = -Math.min(DEEP_M, d == null ? DEEP_M : Math.max(0.05, d));
      }
      // Soft edge: land sinks and sea deepens toward the window border, so the window ends in plain deep sea.
      const edge = Math.min(a, nx - 1 - a, b, nz - 1 - b) * pxM;
      const f = smoothstep(0, EDGE_FADE_M, edge);
      H[k] = -DEEP_M + (h + DEEP_M) * f;
    }
  }
  // The 20 m source pixels make diagonal coasts stair-step (a sawtooth in the mesh). A light binomial
  // blur of the height/depth field smooths the contour; the shoreline moves by well under a pixel.
  for (let pass = 0; pass < smooth; pass++) {
    const src = H.slice();
    for (let b = 1; b < nz - 1; b++) {
      for (let a = 1; a < nx - 1; a++) {
        const k = b * nx + a;
        H[k] = (4 * src[k] + 2 * (src[k - 1] + src[k + 1] + src[k - nx] + src[k + nx]) + src[k - nx - 1] + src[k - nx + 1] + src[k + nx - 1] + src[k + nx + 1]) / 16;
      }
    }
  }
  const fieldMs = now() - t0;

  const names = coast.meta.classes.map((c) => c.name);
  const x0 = i0 * pxM;
  const z0 = j0 * pxM;
  const bounds = { minX: x0, maxX: x0 + nx * pxM, minZ: z0, maxZ: z0 + nz * pxM };

  // Bilinear height at game metres; outside the window = deep sea.
  const heightAt = (x, z) => {
    const fx = (x - x0) / pxM - 0.5;
    const fz = (z - z0) / pxM - 0.5;
    if (fx < 0 || fz < 0 || fx > nx - 1 || fz > nz - 1) return -DEEP_M;
    const a = Math.min(nx - 2, Math.floor(fx));
    const b = Math.min(nz - 2, Math.floor(fz));
    const u = fx - a;
    const v = fz - b;
    const k = b * nx + a;
    return (H[k] * (1 - u) + H[k + 1] * u) * (1 - v) + (H[k + nx] * (1 - u) + H[k + nx + 1] * u) * v;
  };
  // Vegetation class name at game metres (null on water or in the sunk edge zone) — what treesNear() asks.
  const classNameAt = (x, z) => {
    const a = Math.floor((x - x0) / pxM);
    const b = Math.floor((z - z0) / pxM);
    if (a < 0 || b < 0 || a >= nx || b >= nz) return null;
    const k = b * nx + a;
    return H[k] > 0.8 && CL[k] ? names[CL[k]] : null;
  };
  const toGame = (lon, lat) => {
    const [px, py] = coast.toPx(lon, lat);
    return [px * pxM, py * pxM];
  };

  // Depth map for the water shader: the signed field is -H capped +-DEEP_M (positive = sea).
  const t1 = now();
  const sgn = new Float32Array(nx * nz);
  for (let k = 0; k < sgn.length; k++) sgn[k] = Math.max(-DEEP_M, Math.min(DEEP_M, -H[k]));
  const { depth, shore } = depthAndShoreFromSigned(sgn, nx, nz, pxM);
  const depthMap = { x0, z0, texel: pxM, nx, nz, depth, shore, bakeMs: now() - t1, evals: 0 };

  // Same normalisation getIslandLook() does: map this land's heights/slopes onto the Look Lab's.
  const hs = [];
  const ss = [];
  for (let b = 1; b < nz - 1; b += 2) {
    for (let a = 1; a < nx - 1; a += 2) {
      const k = b * nx + a;
      if (H[k] < 0.5) continue;
      hs.push(H[k]);
      ss.push(Math.hypot((H[k + 1] - H[k - 1]) / (2 * pxM), (H[k + nx] - H[k - nx]) / (2 * pxM)));
    }
  }
  hs.sort((p, q) => p - q);
  ss.sort((p, q) => p - q);
  const pct = (arr, f) => arr[Math.min(arr.length - 1, Math.floor(arr.length * f))];
  const look = hs.length < 12
    ? { heightScale: 1, slopeScale: 1, measured: false }
    : {
        heightScale: LAB_REF.heightP90 / Math.max(0.5, pct(hs, 0.9)),
        slopeScale: (LAB_REF.slopeMedian / Math.max(0.05, pct(ss, 0.5))) * SLOPE_CALIBRATION,
        measured: true,
      };

  return {
    pxM, i0, j0, nx, nz, H, CL, names, x0, z0, bounds, heightAt, classNameAt, toGame, depthMap, look,
    landPct: (100 * hs.length) / ((Math.ceil(nx / 2) - 1) * (Math.ceil(nz / 2) - 1)),
    timings: { fieldMs, depthMs: depthMap.bakeMs },
    inside: (x, z, margin = 0) => x >= bounds.minX + margin && x <= bounds.maxX - margin && z >= bounds.minZ + margin && z <= bounds.maxZ - margin,
  };
}

// Nearest open water to a point: >= 3 m deep and clear of land by `clear` metres. Walks outward in rings.
// Used for "just outside Käringön harbour": the village origin is approximate (sv.wikipedia), so this
// is "open water nearest the village", not a surveyed harbour mouth. TODO(felix): confirm the spot.
export function findOpenWater(world, x, z, { clear = 30, maxR = 600 } = {}) {
  const ok = (px, pz) => {
    if (world.heightAt(px, pz) > -3) return false;
    for (let k = 0; k < 8; k++) {
      const ang = (k * Math.PI) / 4;
      if (world.heightAt(px + Math.sin(ang) * clear, pz + Math.cos(ang) * clear) > -1) return false;
    }
    return true;
  };
  for (let r = 0; r <= maxR; r += 3) {
    const steps = Math.max(1, Math.round((2 * Math.PI * r) / 4));
    for (let k = 0; k < steps; k++) {
      const ang = (k / steps) * 2 * Math.PI;
      const px = x + Math.sin(ang) * r;
      const pz = z + Math.cos(ang) * r;
      if (world.inside(px, pz, 150) && ok(px, pz)) return { x: px, z: pz, fromStartM: r };
    }
  }
  return null;
}

// Nearest dry-enough land to a point (villages' origins are approximate and can fall in the water).
function nearestLand(world, x, z, maxR = 120, minH = 1.0) {
  for (let r = 0; r <= maxR; r += 2) {
    const steps = Math.max(1, Math.round((2 * Math.PI * r) / 3));
    for (let k = 0; k < steps; k++) {
      const ang = (k / steps) * 2 * Math.PI;
      const px = x + Math.sin(ang) * r;
      const pz = z + Math.cos(ang) * r;
      if (world.heightAt(px, pz) >= minH) return { x: px, z: pz, fromStartM: r };
    }
  }
  return null;
}

// ---- 2. terrain mesh -------------------------------------------------------------------------

const CLASS_PAINT = { // class name -> [colour source, weight]; bare_rock keeps the granite base
  heath: ['heather', 0.6],
  meadow: ['grass', 0.9],
  scrub: ['grass2', 0.8],
  forest: ['forest', 0.9],
  village: ['grass', 0.55],
};
const _c = new THREE.Color();
const _paint = {};
function refreshClassPaint() {
  _paint.heather = PALETTE.heather;
  _paint.grass = PALETTE.grass;
  _paint.grass2 = PALETTE.grass2;
  _paint.forest = (_paint.forest || new THREE.Color()).copy(PALETTE.grass2).lerp(_c.set(CONFIG.LOOK_PINE), 0.55); // dark conifer floor
}

// step: raster pixels per mesh cell (1 = 2 m cells at 1:10). ?cstep= in the URL.
export function createCoastTerrain(world, step = 1) {
  refreshClassPaint();
  const { nx, nz, H, CL, names, pxM, x0, z0, look } = world;
  const ni = Math.floor((nx - 1) / step) + 1;
  const nj = Math.floor((nz - 1) / step) + 1;
  const hAt = (p, q) => H[Math.min(nz - 1, q * step) * nx + Math.min(nx - 1, p * step)];

  const keep = new Int32Array(ni * nj).fill(-1);
  const quads = [];
  let kept = 0;
  for (let q = 0; q < nj - 1; q++) {
    for (let p = 0; p < ni - 1; p++) {
      const a = hAt(p, q), b = hAt(p + 1, q), c = hAt(p, q + 1), d = hAt(p + 1, q + 1);
      if (Math.max(a, b, c, d) <= CULL_BELOW_M) continue;
      quads.push(p, q);
      for (const k of [q * ni + p, q * ni + p + 1, (q + 1) * ni + p, (q + 1) * ni + p + 1]) if (keep[k] < 0) keep[k] = kept++;
    }
  }
  const positions = new Float32Array(kept * 3);
  const normals = new Float32Array(kept * 3);
  const colors = new Float32Array(kept * 3);
  const slopes = new Float32Array(kept);
  const cell = pxM * step;
  for (let q = 0; q < nj; q++) {
    for (let p = 0; p < ni; p++) {
      const slot = keep[q * ni + p];
      if (slot < 0) continue;
      const h = hAt(p, q);
      const x = x0 + (p * step + 0.5) * pxM;
      const z = z0 + (q * step + 0.5) * pxM;
      const dhdx = (hAt(Math.min(ni - 1, p + 1), q) - hAt(Math.max(0, p - 1), q)) / (cell * (p > 0 && p < ni - 1 ? 2 : 1));
      const dhdz = (hAt(p, Math.min(nj - 1, q + 1)) - hAt(p, Math.max(0, q - 1))) / (cell * (q > 0 && q < nj - 1 ? 2 : 1));
      const inv = 1 / Math.sqrt(dhdx * dhdx + 1 + dhdz * dhdz);
      positions.set([x, h, z], slot * 3);
      normals.set([-dhdx * inv, inv, -dhdz * inv], slot * 3);
      slopes[slot] = Math.hypot(dhdx, dhdz);
      groundColor(h, slopes[slot], x, z, look, _c); // granite / pale domes / veins / wet band, as on the islands
      const paint = CLASS_PAINT[names[CL[Math.min(nz - 1, q * step) * nx + Math.min(nx - 1, p * step)]]];
      if (paint) _c.lerp(_paint[paint[0]], paint[1] * smoothstep(0.5, 1.0, h)); // land cover, fading out at the waterline
      colors.set([_c.r, _c.g, _c.b], slot * 3);
    }
  }
  const indices = new Uint32Array((quads.length / 2) * 6);
  for (let n = 0, w = 0; n < quads.length; n += 2) {
    const p = quads[n], q = quads[n + 1];
    const a = keep[q * ni + p], b = keep[q * ni + p + 1], c = keep[(q + 1) * ni + p], d = keep[(q + 1) * ni + p + 1];
    indices[w++] = a; indices[w++] = c; indices[w++] = b;
    indices[w++] = b; indices[w++] = c; indices[w++] = d;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  material.color.setScalar(CONFIG.LOOK_ISLAND_BRIGHTNESS);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { vertices: kept, triangles: indices.length / 3 };
  return mesh;
}

// ---- 3. trees near the boat ------------------------------------------------------------------

const TRUNK_H = 1.6;
const CANOPY_H = 3.2;
export function createCoastTrees(world, seed = 1) {
  const treesNear = makeTreesNear({ classAt: world.classNameAt, seed });
  const trunkMat = new THREE.MeshLambertMaterial({ flatShading: true });
  const coneMat = new THREE.MeshLambertMaterial({ flatShading: true });
  const blobMat = new THREE.MeshLambertMaterial({ flatShading: true });
  const b = CONFIG.LOOK_ISLAND_BRIGHTNESS;
  trunkMat.color.set(CONFIG.LOOK_TRUNK).multiplyScalar(b);
  coneMat.color.set(CONFIG.LOOK_PINE).multiplyScalar(b);
  blobMat.color.set(CONFIG.LOOK_PINE).lerp(_c.set(CONFIG.LOOK_MEADOW_2), 0.5).multiplyScalar(b);
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.2, TRUNK_H, 4), trunkMat, TREE_CAP);
  const cones = new THREE.InstancedMesh(new THREE.ConeGeometry(1.1, CANOPY_H, 4), coneMat, TREE_CAP);
  const blobs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), blobMat, TREE_CAP);
  const root = new THREE.Group();
  for (const m of [trunks, cones, blobs]) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false; // the instances move with the boat; one draw call each either way
    m.count = 0;
    root.add(m);
  }
  const dummy = new THREE.Object3D();
  let lastX = NaN;
  let lastZ = NaN;
  const stats = { trees: 0, queryMs: 0, rebuilds: 0 };
  function update(x, z) {
    if (Math.hypot(x - lastX, z - lastZ) < TREE_REBUILD_M) return false;
    lastX = x;
    lastZ = z;
    const t0 = now();
    let nT = 0, nC = 0, nB = 0;
    for (const t of treesNear(x, z, TREE_RADIUS_M)) {
      if (nT >= TREE_CAP) break;
      const h = world.heightAt(t.x, t.z);
      if (h < 0.9) continue;
      const s = t.size;
      dummy.rotation.set(0, (t.x * 12.9898 + t.z * 78.233) % 6.283, 0);
      const broad = t.kind === 'birch' || t.kind === 'bush';
      const sc = t.kind === 'juniper' ? 0.45 * s : t.kind === 'bush' ? 0.7 * s : t.kind === 'spruce' ? 1.15 * s : s;
      if (t.kind !== 'bush') {
        dummy.scale.setScalar(sc);
        dummy.position.set(t.x, h + (TRUNK_H / 2) * sc, t.z);
        dummy.updateMatrix();
        trunks.setMatrixAt(nT++, dummy.matrix);
      }
      if (broad) {
        dummy.scale.set(1.3 * sc, 1.0 * sc, 1.3 * sc);
        dummy.position.set(t.x, h + (t.kind === 'bush' ? 0.5 : TRUNK_H + 0.4) * sc, t.z);
        dummy.updateMatrix();
        blobs.setMatrixAt(nB++, dummy.matrix);
      } else {
        dummy.scale.set(t.kind === 'spruce' ? 0.85 * sc : sc, t.kind === 'spruce' ? 1.3 * sc : sc, t.kind === 'spruce' ? 0.85 * sc : sc);
        dummy.position.set(t.x, h + (TRUNK_H + CANOPY_H / 2) * sc, t.z);
        dummy.updateMatrix();
        cones.setMatrixAt(nC++, dummy.matrix);
      }
    }
    trunks.count = nT; cones.count = nC; blobs.count = nB;
    for (const m of [trunks, cones, blobs]) m.instanceMatrix.needsUpdate = true;
    stats.trees = nC + nB;
    stats.queryMs = now() - t0;
    stats.rebuilds++;
    return true;
  }
  return { group: root, update, stats };
}

// ---- 4. villages and lighthouses -------------------------------------------------------------

const WALL_VARIANTS = ['red', 'red', 'red', 'ochre', 'white'];
const COTTAGES_PER_VILLAGE = 14;
const VILLAGE_RADIUS_M = 70;

// settlements: the `settlements` array of data/settlements-history.json (name, lat, lon, ...).
// Places a cluster of cottages (+ one boathouse) round each village that lies inside the window.
export function placeCoastVillages(world, settlements) {
  const rand = mulberry32(0x5e771e);
  const buildings = [];
  const villages = [];
  for (const s of settlements) {
    if (typeof s.lat !== 'number' || typeof s.lon !== 'number') continue;
    const [gx, gz] = world.toGame(s.lon, s.lat);
    if (!world.inside(gx, gz, EDGE_FADE_M)) continue;
    const c = nearestLand(world, gx, gz);
    if (!c) { villages.push({ name: s.name, placed: 0, note: 'no land within 120 m of the origin' }); continue; }
    let placed = 0;
    let boathouse = false;
    for (let attempt = 0; attempt < 500 && placed < COTTAGES_PER_VILLAGE + 1; attempt++) {
      const ang = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * VILLAGE_RADIUS_M;
      const x = c.x + Math.sin(ang) * r;
      const z = c.z + Math.cos(ang) * r;
      const y = world.heightAt(x, z);
      const e = 2;
      const dhdx = (world.heightAt(x + e, z) - world.heightAt(x - e, z)) / (2 * e);
      const dhdz = (world.heightAt(x, z + e) - world.heightAt(x, z - e)) / (2 * e);
      const slopeDeg = (Math.atan(Math.hypot(dhdx, dhdz)) * 180) / Math.PI;
      const asBoat = !boathouse && y >= 0.5 && y < 1.4;
      if (!asBoat && (y < 1.0 || slopeDeg > CONFIG.SETTLEMENT_MAX_SLOPE_DEG)) continue;
      if (buildings.some((b) => Math.hypot(b.x - x, b.z - z) < CONFIG.SETTLEMENT_SPACING)) continue;
      if (asBoat) boathouse = true;
      buildings.push({
        kind: asBoat ? 'boathouse' : 'cottage',
        variant: asBoat ? 'red' : WALL_VARIANTS[Math.floor(rand() * WALL_VARIANTS.length)],
        x, z, y: Math.max(0, y),
        facing: Math.atan2(-dhdx, -dhdz) + (rand() - 0.5) * 0.5, // face downhill = toward the sea
      });
      placed++;
    }
    villages.push({ name: s.name, placed, movedFromOriginM: Math.round(c.fromStartM) });
  }
  return { buildings, villages };
}

// Real lighthouses (src/lighthouses.js) at their real lat/lon. A lighthouse islet can be smaller than a
// 20 m raster pixel; if the spot is not land the tower is moved to the nearest land and the move is reported.
export function placeCoastLighthouses(world, names) {
  const out = [];
  for (const name of names) {
    const entry = LIGHTHOUSES.find((l) => l.name === name);
    if (!entry) { out.push({ name, error: 'not in LIGHTHOUSES' }); continue; }
    const [gx, gz] = world.toGame(entry.lon, entry.lat);
    if (!world.inside(gx, gz, EDGE_FADE_M)) { out.push({ name, error: 'outside the window' }); continue; }
    const land = world.heightAt(gx, gz) >= 0.8 ? { x: gx, z: gz, fromStartM: 0 } : nearestLand(world, gx, gz, 160, 0.8);
    if (!land) { out.push({ name, error: 'no land within 160 m' }); continue; }
    const g = createLighthouse(name);
    g.position.set(land.x, Math.max(0, world.heightAt(land.x, land.z)), land.z);
    out.push({ name, group: g, movedM: Math.round(land.fromStartM) });
  }
  return out;
}

// ---- 5. everything together ------------------------------------------------------------------

// Loads the coast raster tile(s), builds the world and the scene objects, times each phase.
// opts: { vex, step, seed }.
export async function loadRealCoast(opts = {}) {
  const T = { start: now() };
  const coastUrl = new URL('../assets/coast/', import.meta.url).href;
  const dataUrl = new URL('../data/settlements-history.json', import.meta.url).href;
  let bytes = 0;
  const io = {
    json: async (u) => { const t = await (await fetch(u)).text(); bytes += t.length; return JSON.parse(t); },
    bytes: async (u) => { const b = new Uint8Array(await (await fetch(u)).arrayBuffer()); bytes += b.length; return b; },
  };
  const [coast, settlementsJson] = await Promise.all([loadCoast(coastUrl, io, COAST_TILES), io.json(dataUrl)]);
  T.loadDecodeMs = now() - T.start;

  const world = buildCoastWorld(coast, { vex: opts.vex ?? COAST_VEX, smooth: opts.smooth ?? COAST_SMOOTH });
  const t1 = now();
  const terrain = createCoastTerrain(world, opts.step ?? 1);
  T.terrainMs = now() - t1;

  const t2 = now();
  const trees = createCoastTrees(world, opts.seed ?? 1);
  const { buildings, villages } = placeCoastVillages(world, settlementsJson.settlements);
  const lights = placeCoastLighthouses(world, ['Måseskär', 'Hättan']);
  const props = new THREE.Group();
  for (const b of buildings) props.add(createBuilding(b));
  for (const l of lights) if (l.group) props.add(l.group);
  T.propsMs = now() - t2;

  // Käringön village origin (places.json); ?cat=lon,lat starts the boat at the open water nearest another point.
  const [kx, kz] = world.toGame(...(opts.at || [11.36359, 58.10985]));
  const spawn = findOpenWater(world, kx, kz);
  const group = new THREE.Group();
  group.add(terrain, trees.group, props);

  const clamp = (self) => {
    const m = EDGE_CLAMP_M;
    self.x = Math.min(world.bounds.maxX - m, Math.max(world.bounds.minX + m, self.x));
    self.z = Math.min(world.bounds.maxZ - m, Math.max(world.bounds.minZ + m, self.z));
  };
  T.buildMs = now() - T.start;
  return {
    world, group, depthMap: world.depthMap, spawn, trees, clamp, terrain,
    report: {
      bytesDownloadedByLoader: bytes, timings: { ...T, ...world.timings },
      window: { cells: [world.nx, world.nz], metres: [Math.round(world.nx * world.pxM), Math.round(world.nz * world.pxM)], landPct: +world.landPct.toFixed(1) },
      terrain: terrain.userData, buildings: buildings.length, villages,
      lighthouses: lights.map((l) => ({ name: l.name, movedM: l.movedM, error: l.error })),
      spawn, look: world.look,
    },
  };
}
