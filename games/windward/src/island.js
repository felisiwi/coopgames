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

// Central-difference slope, same technique as game.js's boat-tilt gradient
// (BOAT_TILT_GRADIENT_EPS) — a fixed small step for numerical differencing,
// not a "feel" knob, so it's a local constant rather than a CONFIG entry.
const SLOPE_EPS = 2; // metres
function slopeDegAt(heightAt, x, z) {
  const dhdx = (heightAt(x + SLOPE_EPS, z) - heightAt(x - SLOPE_EPS, z)) / (2 * SLOPE_EPS);
  const dhdz = (heightAt(x, z + SLOPE_EPS) - heightAt(x, z - SLOPE_EPS)) / (2 * SLOPE_EPS);
  return (Math.atan(Math.sqrt(dhdx * dhdx + dhdz * dhdz)) * 180) / Math.PI;
}

const _color = new THREE.Color();
function terrainColor(height, slopeDeg, params) {
  if (height <= params.ISLAND_SAND_MAX_HEIGHT && slopeDeg < params.ISLAND_ROCK_MIN_SLOPE_DEG) {
    return _color.setHex(params.ISLAND_COLOR_SAND);
  }
  if (slopeDeg >= params.ISLAND_ROCK_MIN_SLOPE_DEG || height > params.ISLAND_GRASS_MAX_HEIGHT) {
    const isPeak = height > params.ISLAND_GRASS_MAX_HEIGHT * 1.3;
    return _color.setHex(isPeak ? params.ISLAND_COLOR_GRANITE_PEAK : params.ISLAND_COLOR_GRANITE);
  }
  return _color.setHex(params.ISLAND_COLOR_GRASS);
}

function createTerrainMesh(heightAt, params) {
  const half =
    params.ISLAND_RADIUS + params.ISLAND_COAST_NOISE_AMPLITUDE + params.ISLAND_FALLOFF_WIDTH / 2 + params.ISLAND_MESH_MARGIN;
  const size = half * 2;
  // ceil, not round: ISLAND_GRID_CELL_SIZE is an absolute world-space target
  // (I3, 2026-09-16) — rounding down could make a cell locally bigger than
  // that target, which is the thing this value is supposed to guarantee.
  const seg = Math.ceil(size / params.ISLAND_GRID_CELL_SIZE);

  const geometry = new THREE.PlaneGeometry(size, size, seg, seg);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(params.ISLAND_CENTER_X, 0, params.ISLAND_CENTER_Z);

  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const h = heightAt(x, z);
    position.setY(i, h);

    const c = terrainColor(h, slopeDegAt(heightAt, x, z), params);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  position.needsUpdate = true;
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // vertexColors + flatShading (not MeshStandardMaterial — shared/ART.md's
  // Materials rule): flat facets come from three.js's screen-space-derivative
  // normal path (same as src/water.js), not precomputed vertex normals.
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
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

function createTrees(seed, heightAt, params) {
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
    if (h < params.ISLAND_TREE_MIN_HEIGHT || h > params.ISLAND_TREE_MAX_HEIGHT) continue;
    if (slopeDegAt(heightAt, x, z) > params.ISLAND_TREE_MAX_SLOPE_DEG) continue;

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
  const group = new THREE.Group();
  group.add(createTerrainMesh(heightAt, params));
  group.add(createTrees(seed, heightAt, params));
  return { group, heightAt };
}
