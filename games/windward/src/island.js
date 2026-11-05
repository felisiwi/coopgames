// Seeded procedural island (I1, games/windward/DESIGN.md; scattered into a
// field of many by src/island-scatter.js). A noisy-radial-falloff
// heightfield rendered as a coarse flat-shaded grid (chunky facets,
// vertex-coloured by height/slope, no textures — shared/ART.md's Materials
// rule), with instanced pines on suitable slopes and a shallow underwater
// shelf baked into the same height function for later keel/draught sampling
// (never rendered — opaque water hides it).
//
// Every ISLAND_* shape constant is read from a `params` object, not CONFIG
// directly, so this module can build many differently-sized/positioned
// islands in one world (island-scatter.js passes its own per-island params).
// The exported functions default `params` to the live CONFIG.ISLAND_* block
// so existing single-island callers (island-lab.html, island.test.js) are
// unaffected.
//
// heightAt(x, z) is ONE continuous function across land and sea: land
// height and underwater depth are both computed unconditionally, then
// blended by `landFactor` (itself a smoothstep, so continuous) — this is
// what guarantees no seam at the coastline, rather than switching between
// two separate formulas at a threshold.
import * as THREE from '../vendor/three/three.module.js';
import { SimplexNoise2D } from '../../../shared/noise.js';
import { CONFIG } from './config.js';
import { groundColor, greenAmount, getIslandLook, slopeAt, GREEN_THRESHOLD, PINE_MIN_HEIGHT_M } from './island-look.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Two independent noise layers, seeded off the session `seed` with distinct
// XOR offsets (scatter.js/wind.js's convention) so their streams don't
// collide with each other or with anything else keyed on the same seed.
//
// `params` defaults to the live CONFIG.ISLAND_* block (island-lab.html and
// island.test.js both rely on that — they call this with just `seed`, for
// the one config-driven island). island-scatter.js instead passes its own
// per-island params object (Skerry shape scaled to that island's radius) so
// a scattered field can hold many differently-sized islands at once without
// each one clobbering CONFIG.
export function createIslandHeightField(seed, params = CONFIG) {
  const coastNoise = new SimplexNoise2D((seed ^ 0x7a3c1e05) >>> 0);
  const heightNoise = new SimplexNoise2D((seed ^ 0x3ef092b1) >>> 0);

  return function heightAt(x, z) {
    const dx = x - params.ISLAND_CENTER_X;
    const dz = z - params.ISLAND_CENTER_Z;
    const dr = Math.sqrt(dx * dx + dz * dz);

    const coastWobble =
      coastNoise.noise2D(x * params.ISLAND_COAST_NOISE_FREQ, z * params.ISLAND_COAST_NOISE_FREQ) *
      params.ISLAND_COAST_NOISE_AMPLITUDE;
    const edgeR = params.ISLAND_RADIUS + coastWobble;
    const half = params.ISLAND_FALLOFF_WIDTH / 2;
    const landFactor = 1 - smoothstep(edgeR - half, edgeR + half, dr);

    const domeShape = Math.pow(Math.max(0, 1 - dr / params.ISLAND_RADIUS), params.ISLAND_PEAK_SHAPE);
    const bump =
      heightNoise.noise2D(x * params.ISLAND_HEIGHT_NOISE_FREQ, z * params.ISLAND_HEIGHT_NOISE_FREQ) *
      params.ISLAND_HEIGHT_NOISE_AMPLITUDE;
    const landHeight = domeShape * params.ISLAND_PEAK_HEIGHT + bump * landFactor;

    const beyond = Math.max(0, dr - edgeR);
    const shelfT = smoothstep(0, params.ISLAND_SHELF_WIDTH, beyond);
    const abyssT = smoothstep(
      params.ISLAND_SHELF_WIDTH,
      params.ISLAND_SHELF_WIDTH + params.ISLAND_ABYSS_TRANSITION_WIDTH,
      beyond,
    );
    const underwaterDepth = -(
      lerp(0, params.ISLAND_SHELF_DEPTH, shelfT) +
      lerp(0, params.ISLAND_ABYSS_DEPTH - params.ISLAND_SHELF_DEPTH, abyssT)
    );

    return lerp(underwaterDepth, landHeight, landFactor);
  };
}

// ---- smooth painted terrain (Look Lab port, 2026-11-05) --------------------
// Ground is NOT faceted any more: smooth vertex normals and the Bohuslän
// palette (src/island-look.js). Objects on it (pines, houses) stay low-poly.

// Quads whose highest corner is below this are never visible (the sea
// surface only swings +-WAVE_AMP = 0.4 m, and it is opaque), so they are
// not built. This is what lets the mesh be fine (1.5 m cells) without the
// vertex count exploding: the old mesh also covered the whole underwater
// shelf, which nobody ever saw.
const CULL_BELOW_M = -0.7;
// A coarse block (BLOCK x BLOCK cells) whose four corners are all below this
// is plain deep sea: its interior is not even evaluated. Land cannot hide in
// such a block — the height field has no feature narrower than ~10 m.
const SKIP_BLOCK_BELOW_M = -2.2;
const BLOCK = 4;
const UNSET = -1e9;

// Heights on the grid, evaluating only blocks that are not plainly deep sea.
function sampleHeightGrid(heightAt, x0, z0, step, n) {
  const H = new Float32Array(n * n).fill(UNSET);
  const at = (i, j) => {
    const k = j * n + i;
    if (H[k] === UNSET) H[k] = heightAt(x0 + i * step, z0 + j * step);
    return H[k];
  };
  for (let bj = 0; bj < n - 1; bj += BLOCK) {
    for (let bi = 0; bi < n - 1; bi += BLOCK) {
      const ei = Math.min(bi + BLOCK, n - 1);
      const ej = Math.min(bj + BLOCK, n - 1);
      const top = Math.max(at(bi, bj), at(ei, bj), at(bi, ej), at(ei, ej));
      if (top < SKIP_BLOCK_BELOW_M) continue;
      for (let j = bj; j <= ej; j++) for (let i = bi; i <= ei; i++) at(i, j);
    }
  }
  return H;
}

const _color = new THREE.Color();
function createTerrainMesh(heightAt, params, look) {
  const half =
    params.ISLAND_RADIUS + params.ISLAND_COAST_NOISE_AMPLITUDE + params.ISLAND_FALLOFF_WIDTH / 2 + params.ISLAND_MESH_MARGIN;
  const size = half * 2;
  // ceil, not round: ISLAND_GRID_CELL_SIZE is an absolute world-space target
  // (I3, 2026-09-16) — rounding down could make a cell locally bigger than
  // that target, which is the thing this value is supposed to guarantee.
  const seg = Math.ceil(size / params.ISLAND_GRID_CELL_SIZE);
  const n = seg + 1;
  const step = size / seg;
  const x0 = params.ISLAND_CENTER_X - half;
  const z0 = params.ISLAND_CENTER_Z - half;
  const H = sampleHeightGrid(heightAt, x0, z0, step, n);

  // Which quads survive the cull, and which grid nodes they use.
  const keepNode = new Int32Array(n * n).fill(-1);
  const quads = [];
  let kept = 0;
  for (let j = 0; j < seg; j++) {
    for (let i = 0; i < seg; i++) {
      const a = H[j * n + i];
      const b = H[j * n + i + 1];
      const c = H[(j + 1) * n + i];
      const d = H[(j + 1) * n + i + 1];
      if (a === UNSET || b === UNSET || c === UNSET || d === UNSET) continue; // inside a skipped deep block
      if (Math.max(a, b, c, d) <= CULL_BELOW_M) continue; // always hidden under the sea
      quads.push(i, j);
      for (const k of [j * n + i, j * n + i + 1, (j + 1) * n + i, (j + 1) * n + i + 1]) {
        if (keepNode[k] < 0) keepNode[k] = kept++;
      }
    }
  }

  const positions = new Float32Array(kept * 3);
  const normals = new Float32Array(kept * 3);
  const colors = new Float32Array(kept * 3);
  const heightOr = (k, fallback) => (H[k] === UNSET ? fallback : H[k]);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const slot = keepNode[j * n + i];
      if (slot < 0) continue;
      const h = H[j * n + i];
      const x = x0 + i * step;
      const z = z0 + j * step;
      // Central differences on the grid (one-sided at the mesh/skip edge).
      const hl = heightOr(j * n + Math.max(0, i - 1), h);
      const hr = heightOr(j * n + Math.min(n - 1, i + 1), h);
      const hd = heightOr(Math.max(0, j - 1) * n + i, h);
      const hu = heightOr(Math.min(n - 1, j + 1) * n + i, h);
      const dhdx = (hr - hl) / (step * (i > 0 && i < n - 1 ? 2 : 1));
      const dhdz = (hu - hd) / (step * (j > 0 && j < n - 1 ? 2 : 1));
      const inv = 1 / Math.sqrt(dhdx * dhdx + 1 + dhdz * dhdz);
      positions[slot * 3] = x;
      positions[slot * 3 + 1] = h;
      positions[slot * 3 + 2] = z;
      normals[slot * 3] = -dhdx * inv;
      normals[slot * 3 + 1] = inv;
      normals[slot * 3 + 2] = -dhdz * inv;
      groundColor(h, Math.hypot(dhdx, dhdz), x, z, look, _color);
      colors[slot * 3] = _color.r;
      colors[slot * 3 + 1] = _color.g;
      colors[slot * 3 + 2] = _color.b;
    }
  }

  const indices = kept > 65535 ? new Uint32Array((quads.length / 2) * 6) : new Uint16Array((quads.length / 2) * 6);
  for (let q = 0, w = 0; q < quads.length; q += 2) {
    const i = quads[q];
    const j = quads[q + 1];
    const a = keepNode[j * n + i];
    const b = keepNode[j * n + i + 1];
    const c = keepNode[(j + 1) * n + i];
    const d = keepNode[(j + 1) * n + i + 1];
    // Counter-clockwise seen from above (+y), matching PlaneGeometry.rotateX(-PI/2).
    indices[w++] = a; indices[w++] = c; indices[w++] = b;
    indices[w++] = b; indices[w++] = c; indices[w++] = d;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();

  // Smooth shading from the vertex normals above (no flatShading). Lambert,
  // not Standard: still no specular highlights (shared/ART.md).
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

const TRUNK_HEIGHT = 1.6;
const CANOPY_HEIGHT = 3.2;

// Radial segment counts (I3b, 2026-09-16, shared/ART.md's one-facet-scale
// rule — target 4m, 2-6m acceptable). Both were well under the 2m floor at
// their original segment counts (trunk chord ~0.18-0.24m at 5 sides;
// canopy chord ~1.1m at 6), and both stay under 2m even at 3 — the
// smallest radius a THREE.CylinderGeometry/ConeGeometry can form a volume
// with — since a tree this size physically can't carry a 2m+ facet. 4
// sides is as close as either gets to the floor without degenerating into
// a bare triangular prism/pyramid: trunk chord ~0.21-0.28m, canopy chord
// ~1.56m (max possible at 3 sides would be ~1.9m — see island-scatter
// notes in the I3b commit for the math). Reduced anyway, per the
// directive's "nothing subdivided finer because it's small."
const TRUNK_RADIAL_SEGMENTS = 4;
const CANOPY_RADIAL_SEGMENTS = 4;

// Pines stand ONLY in the green pockets (Look Lab: "pines only in those green
// pockets"): the same greenAmount() that paints the meadow decides, so a tree
// can never stand on bare granite. Everything else about them is unchanged —
// still low-poly, flat-shaded, instanced.
function createTrees(seed, heightAt, params, look) {
  const rand = mulberry32((seed ^ 0x2c6f1a9d) >>> 0);
  const group = new THREE.Group();

  const trunkGeometry = new THREE.CylinderGeometry(0.15, 0.2, TRUNK_HEIGHT, TRUNK_RADIAL_SEGMENTS);
  const canopyGeometry = new THREE.ConeGeometry(1.1, CANOPY_HEIGHT, CANOPY_RADIAL_SEGMENTS);
  const trunkMaterial = new THREE.MeshLambertMaterial({ color: params.ISLAND_COLOR_TRUNK, flatShading: true });
  const canopyMaterial = new THREE.MeshLambertMaterial({ color: params.ISLAND_COLOR_PINE, flatShading: true });

  const attempts = params.ISLAND_TREE_ATTEMPTS;
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, attempts);
  const canopies = new THREE.InstancedMesh(canopyGeometry, canopyMaterial, attempts);
  trunks.castShadow = true;
  trunks.receiveShadow = true;
  canopies.castShadow = true;
  canopies.receiveShadow = true;

  const spawnHalf = params.ISLAND_RADIUS + params.ISLAND_COAST_NOISE_AMPLITUDE;
  const dummy = new THREE.Object3D();
  let planted = 0;

  for (let i = 0; i < attempts; i++) {
    const x = params.ISLAND_CENTER_X + (rand() * 2 - 1) * spawnHalf;
    const z = params.ISLAND_CENTER_Z + (rand() * 2 - 1) * spawnHalf;
    const h = heightAt(x, z);
    if (h < PINE_MIN_HEIGHT_M || h > params.ISLAND_TREE_MAX_HEIGHT) continue;
    const slope = slopeAt(heightAt, x, z, params.ISLAND_GRID_CELL_SIZE);
    if (greenAmount(h, slope, x, z, look) < GREEN_THRESHOLD) continue;

    const scale = params.ISLAND_TREE_SCALE_MIN + rand() * (params.ISLAND_TREE_SCALE_MAX - params.ISLAND_TREE_SCALE_MIN);
    const rotationY = rand() * Math.PI * 2;
    dummy.rotation.set(0, rotationY, 0);
    dummy.scale.setScalar(scale);

    dummy.position.set(x, h + (TRUNK_HEIGHT / 2) * scale, z);
    dummy.updateMatrix();
    trunks.setMatrixAt(planted, dummy.matrix);

    dummy.position.set(x, h + (TRUNK_HEIGHT + CANOPY_HEIGHT / 2) * scale, z);
    dummy.updateMatrix();
    canopies.setMatrixAt(planted, dummy.matrix);

    planted++;
  }
  trunks.count = planted;
  canopies.count = planted;
  trunks.instanceMatrix.needsUpdate = true;
  canopies.instanceMatrix.needsUpdate = true;

  group.add(trunks, canopies);
  return group;
}

export function createIsland(seed, params = CONFIG) {
  const heightAt = createIslandHeightField(seed, params);
  const look = getIslandLook(seed, params, heightAt);
  const group = new THREE.Group();
  group.add(createTerrainMesh(heightAt, params, look));
  group.add(createTrees(seed, heightAt, params, look));
  return { group, heightAt, look };
}
