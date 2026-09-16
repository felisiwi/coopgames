// Flat-shaded low-poly sea (games/windward/DESIGN.md, W0.7 — replaces the
// W0.5/W0.6 custom-shader banded water). W0.6's colour-band approach drove
// visible shade purely from `d = dot(position, uWindDir)`, the SAME scalar
// for every summed sine — so the whole sea varied along one axis only and
// read as parallel diagonal stripes (Felix's W0.6 screenshot report), not a
// faceted surface. Fixed two ways:
//   1. Real geometric facets: MeshLambertMaterial(flatShading) + a real
//      DirectionalLight/HemisphereLight (game.js) shade each triangle by its
//      true normal, computed from screen-space derivatives of view-space
//      position (three.js's standard FLAT_SHADED path) — not a fake
//      height-driven colour ramp.
//   2. Real 2D variation: each summed sine now travels in its OWN direction,
//      a small angle offset from the wind axis (WAVE_COMPONENTS below), so
//      wave crests cross each other instead of running perfectly parallel.
// One JS (seaHeightCPU) / GLSL (seaHeight, injected via onBeforeCompile)
// pair, generated from the same WAVE_COMPONENTS + glslFloat() so they can't
// drift apart — same guarantee water.test.js checked for the old shader,
// still checked here (boat bob in game.js calls seaHeightCPU directly).
import * as THREE from '../vendor/three/three.module.js';

// --- tuning knobs (Felix tunes these by hand) ---------------------------
export const WAVE_AMP = 0.4; // metres, max total displacement at full wind strength (boat ~6m long — stays well clear of swallowing the hull)
export const WAVE_LEN = 12; // metres, dominant wavelength (~2 boat lengths; DESIGN.md target is 1-3x)
export const WAVE_SPEED = 1.2; // rad/s, dominant component's phase speed
// SIZE/SEG raised together (I1, from 320/160) — headless camera-frustum check
// against src/camera.js's actual fixed-camera math (ray-cast every zoom
// 0.5-2.5 x aspect ratios up to 32:9) found the OLD 320m tile's real edge
// entering frame from zoom ~1.5 up, showing background colour through a hard
// seam ~160-183m from the boat — a pre-existing bug, unrelated to any
// island. At SIZE=800 (half-width 400m) no ray in that same sweep ever
// reaches the edge, so it's geometrically unreachable rather than merely
// hidden by timing fog to it.
//
// SEG (I3b, 2026-09-16, shared/ART.md's one-facet-scale rule — target 4m,
// 2-6m acceptable): 4m itself fails water.test.js's aliasing bound (spacing
// must stay < shortestWavelength/2 = 3.6m, WAVE_LEN * 0.6 / 2 — any coarser
// and the wave shader's own geometry can't resolve its shortest summed
// component, reading as jittery/aliased crests instead of a shape). 223 is
// the largest SEG (== smallest facet) that still clears that bound —
// SIZE/223 = 3.587m, the closest this tile can get to 4m while staying
// readable. (Was SEG=256 / 3.125m.)
export const SEG = 223; // plane subdivisions per side
export const SIZE = 800; // metres per side — boat-centred moving tile (see createWater); sized so its edge never enters the fixed camera's frustum at any zoom/aspect, not to cover "the whole world"
export const WATER_COLOR = 0x2f7fd6;

// Four summed sines, each at its own small angle off the wind axis (so crests
// cross instead of running parallel — see file header) and its own
// wavelength/speed multiplier of the WAVE_LEN/WAVE_SPEED knobs above.
// Weights sum to 1 so WAVE_AMP is the true max combined amplitude.
const WAVE_COMPONENTS = [
  { weight: 0.4, angleOffsetDeg: 0, wavelengthMul: 1.0, speedMul: 1.0, phase: 0 },
  { weight: 0.25, angleOffsetDeg: 32, wavelengthMul: 0.6, speedMul: 1.35, phase: 1.7 },
  { weight: 0.2, angleOffsetDeg: -24, wavelengthMul: 1.4, speedMul: -0.75, phase: 4.2 },
  { weight: 0.15, angleOffsetDeg: 55, wavelengthMul: 0.8, speedMul: 1.9, phase: 2.9 },
];

const DEG = Math.PI / 180;

// JS mirror of the injected GLSL seaHeight (below), for CPU-side boat bob
// (game.js). `windDirRad` is the world-space wind blows-to angle, `x`/`z`
// are world coordinates — no local/world remap needed now that the plane's
// rotation is baked into its geometry (see createWater) instead of the mesh
// transform, unlike the W0.5/W0.6 shader this replaces.
export function seaHeightCPU(x, z, t, windDirRad, windStrength) {
  const amp = WAVE_AMP * (0.3 + 0.7 * windStrength);
  const speedScale = WAVE_SPEED * (0.4 + 0.6 * windStrength);
  let h = 0;
  for (const c of WAVE_COMPONENTS) {
    const angle = windDirRad + c.angleOffsetDeg * DEG;
    const dx = Math.sin(angle);
    const dz = Math.cos(angle);
    const d = x * dx + z * dz;
    const freq = (2 * Math.PI) / (WAVE_LEN * c.wavelengthMul);
    const speed = speedScale * c.speedMul;
    h += amp * c.weight * Math.sin(d * freq + t * speed + c.phase);
  }
  return h;
}

// GLSL requires a decimal point on every float literal — a bare integer
// (e.g. `angleOffsetDeg: 0`, embedded as `+ 0`) fails to compile. Route
// every generated number through this so the shader source is always valid.
export function glslFloat(n) {
  return Number.isInteger(n) ? `${n}.0` : `${n}`;
}

const componentTerms = WAVE_COMPONENTS.map((c) => {
  const freq = (2 * Math.PI) / (WAVE_LEN * c.wavelengthMul);
  const angleRad = c.angleOffsetDeg * DEG;
  return `  {
    float angle = windDir + ${glslFloat(angleRad)};
    float d = x * sin(angle) + z * cos(angle);
    h += amp * ${glslFloat(c.weight)} * sin(d * ${glslFloat(freq)} + t * (speedScale * ${glslFloat(c.speedMul)}) + ${glslFloat(c.phase)});
  }`;
}).join('\n');

// Exported only for water.test.js, to assert the GLSL literally embeds the
// same WAVE_COMPONENTS-derived terms as seaHeightCPU() above.
export const SEA_HEIGHT_GLSL = `
float seaHeight(float x, float z, float t, float windDir, float windStrength) {
  float amp = ${glslFloat(WAVE_AMP)} * (0.3 + 0.7 * windStrength);
  float speedScale = ${glslFloat(WAVE_SPEED)} * (0.4 + 0.6 * windStrength);
  float h = 0.0;
${componentTerms}
  return h;
}
`;

export function createWater() {
  // Bake the flat-to-horizontal rotation into the geometry itself (not the
  // mesh transform), so `position.y` is already the height axis and
  // `position.x`/`position.z` are world-aligned horizontal axes at the point
  // `#include <begin_vertex>` runs below — the mesh itself only translates
  // (to follow the boat), it never rotates.
  const geometry = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshLambertMaterial({
    color: WATER_COLOR,
    flatShading: true,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uWindDir = { value: 0 };
    shader.uniforms.uWindStrength = { value: 0.5 };
    // World-space (x, z) of the plane mesh's current position. The plane
    // follows the boat and is repositioned in whole vertex-spacing steps
    // (see update() below) so the same lattice always samples the same
    // world points frame-to-frame; adding this offset to the local vertex
    // position recovers true world coordinates so the displayed surface
    // matches seaHeightCPU()'s bob/tilt for the boat exactly.
    shader.uniforms.uPlaneOffset = { value: new THREE.Vector2(0, 0) };
    material.userData.shader = shader;

    shader.vertexShader = `
      uniform float uTime;
      uniform float uWindDir;
      uniform float uWindStrength;
      uniform vec2 uPlaneOffset;
      ${SEA_HEIGHT_GLSL}
    ` + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      transformed.y = seaHeight(transformed.x + uPlaneOffset.x, transformed.z + uPlaneOffset.y, uTime, uWindDir, uWindStrength);`,
    );
  };

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;

  const spacing = SIZE / SEG;

  function update(elapsedSeconds, wind, boatPosition) {
    const snappedX = Math.round(boatPosition.x / spacing) * spacing;
    const snappedZ = Math.round(boatPosition.z / spacing) * spacing;
    mesh.position.set(snappedX, 0, snappedZ);

    const shader = material.userData.shader;
    if (!shader) return; // first compile happens on the first render call
    shader.uniforms.uTime.value = elapsedSeconds;
    shader.uniforms.uWindDir.value = wind.dir;
    shader.uniforms.uWindStrength.value = wind.strength;
    shader.uniforms.uPlaneOffset.value.set(snappedX, snappedZ);
  }

  return { mesh, update };
}
