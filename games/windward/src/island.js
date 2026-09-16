// Seeded procedural island (I1, games/windward/DESIGN.md). One fixed
// granite-and-pine island: a noisy-radial-falloff heightfield rendered as a
// coarse flat-shaded grid (chunky facets, vertex-coloured by height/slope,
// no textures — shared/ART.md's Materials rule), with instanced pines on
// suitable slopes and a shallow underwater shelf baked into the same height
// function for later keel/draught sampling (never rendered — opaque water
// hides it).
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
export function createIslandHeightField(seed) {
  const coastNoise = new SimplexNoise2D((seed ^ 0x7a3c1e05) >>> 0);
  const heightNoise = new SimplexNoise2D((seed ^ 0x3ef092b1) >>> 0);

  return function heightAt(x, z) {
    const dx = x - CONFIG.ISLAND_CENTER_X;
    const dz = z - CONFIG.ISLAND_CENTER_Z;
    const dr = Math.sqrt(dx * dx + dz * dz);

    const coastWobble =
      coastNoise.noise2D(x * CONFIG.ISLAND_COAST_NOISE_FREQ, z * CONFIG.ISLAND_COAST_NOISE_FREQ) *
      CONFIG.ISLAND_COAST_NOISE_AMPLITUDE;
    const edgeR = CONFIG.ISLAND_RADIUS + coastWobble;
    const half = CONFIG.ISLAND_FALLOFF_WIDTH / 2;
    const landFactor = 1 - smoothstep(edgeR - half, edgeR + half, dr);

    const domeShape = Math.pow(Math.max(0, 1 - dr / CONFIG.ISLAND_RADIUS), CONFIG.ISLAND_PEAK_SHAPE);
    const bump =
      heightNoise.noise2D(x * CONFIG.ISLAND_HEIGHT_NOISE_FREQ, z * CONFIG.ISLAND_HEIGHT_NOISE_FREQ) *
      CONFIG.ISLAND_HEIGHT_NOISE_AMPLITUDE;
    const landHeight = domeShape * CONFIG.ISLAND_PEAK_HEIGHT + bump * landFactor;

    const beyond = Math.max(0, dr - edgeR);
    const shelfT = smoothstep(0, CONFIG.ISLAND_SHELF_WIDTH, beyond);
    const abyssT = smoothstep(
      CONFIG.ISLAND_SHELF_WIDTH,
      CONFIG.ISLAND_SHELF_WIDTH + CONFIG.ISLAND_ABYSS_TRANSITION_WIDTH,
      beyond,
    );
    const underwaterDepth = -(
      lerp(0, CONFIG.ISLAND_SHELF_DEPTH, shelfT) +
      lerp(0, CONFIG.ISLAND_ABYSS_DEPTH - CONFIG.ISLAND_SHELF_DEPTH, abyssT)
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
function terrainColor(height, slopeDeg) {
  if (height <= CONFIG.ISLAND_SAND_MAX_HEIGHT && slopeDeg < CONFIG.ISLAND_ROCK_MIN_SLOPE_DEG) {
    return _color.setHex(CONFIG.ISLAND_COLOR_SAND);
  }
  if (slopeDeg >= CONFIG.ISLAND_ROCK_MIN_SLOPE_DEG || height > CONFIG.ISLAND_GRASS_MAX_HEIGHT) {
    const isPeak = height > CONFIG.ISLAND_GRASS_MAX_HEIGHT * 1.3;
    return _color.setHex(isPeak ? CONFIG.ISLAND_COLOR_GRANITE_PEAK : CONFIG.ISLAND_COLOR_GRANITE);
  }
  return _color.setHex(CONFIG.ISLAND_COLOR_GRASS);
}

function createTerrainMesh(heightAt) {
  const half =
    CONFIG.ISLAND_RADIUS + CONFIG.ISLAND_COAST_NOISE_AMPLITUDE + CONFIG.ISLAND_FALLOFF_WIDTH / 2 + CONFIG.ISLAND_MESH_MARGIN;
  const size = half * 2;
  const seg = Math.round(size / CONFIG.ISLAND_GRID_CELL_SIZE);

  const geometry = new THREE.PlaneGeometry(size, size, seg, seg);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(CONFIG.ISLAND_CENTER_X, 0, CONFIG.ISLAND_CENTER_Z);

  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const h = heightAt(x, z);
    position.setY(i, h);

    const c = terrainColor(h, slopeDegAt(heightAt, x, z));
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

function createTrees(seed, heightAt) {
  const rand = mulberry32((seed ^ 0x2c6f1a9d) >>> 0);
  const group = new THREE.Group();

  const trunkGeometry = new THREE.CylinderGeometry(0.15, 0.2, TRUNK_HEIGHT, 5);
  const canopyGeometry = new THREE.ConeGeometry(1.1, CANOPY_HEIGHT, 6);
  const trunkMaterial = new THREE.MeshLambertMaterial({ color: CONFIG.ISLAND_COLOR_TRUNK, flatShading: true });
  const canopyMaterial = new THREE.MeshLambertMaterial({ color: CONFIG.ISLAND_COLOR_PINE, flatShading: true });

  const attempts = CONFIG.ISLAND_TREE_ATTEMPTS;
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, attempts);
  const canopies = new THREE.InstancedMesh(canopyGeometry, canopyMaterial, attempts);
  trunks.castShadow = true;
  trunks.receiveShadow = true;
  canopies.castShadow = true;
  canopies.receiveShadow = true;

  const spawnHalf = CONFIG.ISLAND_RADIUS + CONFIG.ISLAND_COAST_NOISE_AMPLITUDE;
  const dummy = new THREE.Object3D();
  let planted = 0;

  for (let i = 0; i < attempts; i++) {
    const x = CONFIG.ISLAND_CENTER_X + (rand() * 2 - 1) * spawnHalf;
    const z = CONFIG.ISLAND_CENTER_Z + (rand() * 2 - 1) * spawnHalf;
    const h = heightAt(x, z);
    if (h < CONFIG.ISLAND_TREE_MIN_HEIGHT || h > CONFIG.ISLAND_TREE_MAX_HEIGHT) continue;
    if (slopeDegAt(heightAt, x, z) > CONFIG.ISLAND_TREE_MAX_SLOPE_DEG) continue;

    const scale = CONFIG.ISLAND_TREE_SCALE_MIN + rand() * (CONFIG.ISLAND_TREE_SCALE_MAX - CONFIG.ISLAND_TREE_SCALE_MIN);
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

export function createIsland(seed) {
  const heightAt = createIslandHeightField(seed);
  const group = new THREE.Group();
  group.add(createTerrainMesh(heightAt));
  group.add(createTrees(seed, heightAt));
  return { group, heightAt };
}
