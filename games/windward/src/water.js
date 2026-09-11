// Animated low-poly water (games/windward/DESIGN.md, W0.5 Batch 3; rescaled
// W0.6): a subdivided plane displaced in the vertex shader by 3 summed sine
// waves aligned with wind direction/strength, so the sea itself shows the
// wind. Flat-shaded via screen-space derivatives in the fragment shader (a
// normal per triangle, computed from world position, not per vertex) —
// cheap, and avoids recomputing analytic wave normals or CPU-side geometry
// updates.
//
// W0.6: 045b71a's amplitude (1.4-4.4m) was tuned only against a screenshot
// and submerged the ~6m boat (games/windward/DESIGN.md's "boat ~6m long").
// WAVE_CONFIG below caps total displacement at 0.5m (boat-scale) and both
// the GLSL vertex shader and the JS `waveHeight` used to bob the boat
// (game.js) are generated from these same numbers, so they can't drift
// apart. Visibility at that smaller scale comes from two places: `vHeight`
// (the raw sine sum, independent of amplitude) drives a crest/trough colour
// band in the fragment shader, and the wave frequencies are higher than
// W0.5's (shorter wavelengths => more facets catch the light) while staying
// well above the 128-segment/600m plane's ~4.7m vertex spacing to avoid
// aliasing.
import * as THREE from '../vendor/three/three.module.js';
import { CONFIG } from './config.js';

export const WAVE_CONFIG = {
  AMP_BASE: 0.1,
  AMP_STRENGTH: 0.4, // amp maxes at 0.5m (AMP_BASE + AMP_STRENGTH) at strength=1
  COMPONENTS: [
    { weight: 0.55, freq: 0.2, speed: 1.3, phase: 0 },
    { weight: 0.3, freq: 0.45, speed: -2.1, phase: 1.7 },
    { weight: 0.15, freq: 0.6, speed: 3.4, phase: 4.2 },
  ],
};

// Plane-local +Y maps to world -Z after the mesh's -90deg X rotation (see
// createWater below), so a world-space wind-blows-to angle becomes this
// local-space unit vector; both the GLSL uWindDir uniform and JS waveHeight
// need the same vector for the two to agree on any given (x, z, t).
export function windLocalDir(windDirRad) {
  const toDir = windDirRad + Math.PI;
  return { x: Math.sin(toDir), y: -Math.cos(toDir) };
}

// JS mirror of the vertex shader's displacement, for CPU-side boat bob
// (game.js). `localDir` is windLocalDir(wind.dir); world (x, z) maps to the
// plane-local (x, -z) the shader dots against uWindDir.
export function waveHeight(x, z, t, strength, localDir) {
  const amp = WAVE_CONFIG.AMP_BASE + strength * WAVE_CONFIG.AMP_STRENGTH;
  const d = x * localDir.x + -z * localDir.y;
  let h = 0;
  for (const c of WAVE_CONFIG.COMPONENTS) {
    h += amp * c.weight * Math.sin(d * c.freq + t * c.speed + c.phase);
  }
  return h;
}

// GLSL requires a decimal point on every float literal — a bare integer
// (e.g. the `phase: 0` component below, embedded as `+ 0`) fails to compile
// ("wrong operand types... left-hand operand of type highp float and a
// right operand of type const int"). Route every WAVE_CONFIG number through
// this so the generated shader source is always valid.
export function glslFloat(n) {
  return Number.isInteger(n) ? `${n}.0` : `${n}`;
}

const waveTerms = WAVE_CONFIG.COMPONENTS.map(
  (c) =>
    `h += amp * ${glslFloat(c.weight)} * sin(d * ${glslFloat(c.freq)} + uTime * ${glslFloat(c.speed)} + ${glslFloat(c.phase)});`,
).join('\n    ');

// Exported only for water.test.js, to assert the GLSL literally embeds the
// same WAVE_CONFIG-derived terms as waveHeight() above.
export const VERTEX_SHADER = `
  uniform float uTime;
  uniform vec2 uWindDir; // unit vector, plane-local XY, blowing-to direction
  uniform float uWindStrength; // 0..1
  varying vec3 vWorldPos;
  varying float vHeight; // -1..1, raw wave phase independent of amplitude

  void main() {
    vec3 pos = position;
    float amp = ${glslFloat(WAVE_CONFIG.AMP_BASE)} + uWindStrength * ${glslFloat(WAVE_CONFIG.AMP_STRENGTH)};
    float d = dot(pos.xy, uWindDir);
    float h = 0.0;
    ${waveTerms}
    pos.z += h;
    vHeight = h / max(amp, 0.0001);

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const FRAGMENT_SHADER = `
  uniform vec3 uCrestColor;
  uniform vec3 uTroughColor;
  uniform vec3 uLightDir;
  varying vec3 vWorldPos;
  varying float vHeight;

  void main() {
    vec3 fdx = dFdx(vWorldPos);
    vec3 fdy = dFdy(vWorldPos);
    vec3 normal = normalize(cross(fdx, fdy));
    float diffuse = max(dot(normal, normalize(uLightDir)), 0.0);
    // Wide contrast range + a sharp glint term so wave facets read clearly
    // from the fixed camera's steep, near-overhead vantage (a subtle
    // diffuse-only gradient washes out at that angle).
    float glint = pow(diffuse, 12.0);
    // Crest/trough colour band from the wave's phase (vHeight), not its
    // amplitude — this is what keeps waves visible now that amplitude is
    // capped at boat scale (W0.6): even a tiny wave still swings vHeight
    // through its full -1..1 range.
    vec3 baseColor = mix(uTroughColor, uCrestColor, smoothstep(-0.6, 0.6, vHeight));
    vec3 color = baseColor * (0.35 + 0.65 * diffuse) + vec3(0.9, 0.95, 1.0) * glint * 0.45;
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function createWater() {
  const geometry = new THREE.PlaneGeometry(
    CONFIG.WATER_SIZE,
    CONFIG.WATER_SIZE,
    CONFIG.WATER_SEGMENTS,
    CONFIG.WATER_SEGMENTS,
  );
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uWindDir: { value: new THREE.Vector2(1, 0) },
      uWindStrength: { value: 0.5 },
      uCrestColor: { value: new THREE.Color(0x3f8ac2) },
      uTroughColor: { value: new THREE.Color(0x1c4a70) },
      // Deliberately more grazing than the scene's own DirectionalLight —
      // a near-overhead light barely shades small facet tilts when both the
      // fixed camera and the light are steep, this is a stylized choice for
      // wave visibility, not a match to the real light.
      uLightDir: { value: new THREE.Vector3(0.7, 0.4, 0.5) },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;

  const _localDir = new THREE.Vector2();

  function update(elapsedSeconds, wind) {
    material.uniforms.uTime.value = elapsedSeconds;
    material.uniforms.uWindStrength.value = wind.strength;
    const dir = windLocalDir(wind.dir);
    _localDir.set(dir.x, dir.y).normalize();
    material.uniforms.uWindDir.value.copy(_localDir);
  }

  return { mesh, update };
}
