// Animated low-poly water (games/windward/DESIGN.md, W0.5 Batch 3): a
// subdivided plane displaced in the vertex shader by 2-3 summed sine waves
// aligned with wind direction/strength, so the sea itself shows the wind.
// Flat-shaded via screen-space derivatives in the fragment shader (a normal
// per triangle, computed from world position, not per vertex) — cheap, and
// avoids recomputing analytic wave normals or CPU-side geometry updates.
import * as THREE from '../vendor/three/three.module.js';
import { CONFIG } from './config.js';

const VERTEX_SHADER = `
  uniform float uTime;
  uniform vec2 uWindDir; // unit vector, plane-local XY, blowing-to direction
  uniform float uWindStrength; // 0..1
  varying vec3 vWorldPos;

  void main() {
    vec3 pos = position;
    // Amplitude is exaggerated well past realistic swell — at the W0.5 fixed
    // camera's distance/elevation (src/camera.js), a physically-scaled wave
    // reads as a flat plane; this is a stylized "the sea shows the wind"
    // effect, not a realism target (tuned against the actual screenshot).
    float amp = 1.4 + uWindStrength * 3.0;
    float d = dot(pos.xy, uWindDir);
    pos.z += amp * 0.55 * sin(d * 0.12 + uTime * 1.3);
    pos.z += amp * 0.30 * sin(d * 0.28 - uTime * 2.1 + 1.7);
    pos.z += amp * 0.15 * sin(d * 0.4 + uTime * 3.4 + 4.2);

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const FRAGMENT_SHADER = `
  uniform vec3 uBaseColor;
  uniform vec3 uLightDir;
  varying vec3 vWorldPos;

  void main() {
    vec3 fdx = dFdx(vWorldPos);
    vec3 fdy = dFdy(vWorldPos);
    vec3 normal = normalize(cross(fdx, fdy));
    float diffuse = max(dot(normal, normalize(uLightDir)), 0.0);
    // Wide contrast range + a sharp glint term so wave facets read clearly
    // from the fixed camera's steep, near-overhead vantage (a subtle
    // diffuse-only gradient washes out at that angle).
    float glint = pow(diffuse, 12.0);
    vec3 color = uBaseColor * (0.35 + 0.65 * diffuse) + vec3(0.9, 0.95, 1.0) * glint * 0.45;
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
      uBaseColor: { value: new THREE.Color(0x2d6ea6) },
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

  // Plane-local +Y maps to world -Z after the rotation above, so a
  // world-space blows-to vector (x, z) becomes local (x, -z).
  const _localDir = new THREE.Vector2();

  function update(elapsedSeconds, wind) {
    material.uniforms.uTime.value = elapsedSeconds;
    material.uniforms.uWindStrength.value = wind.strength;
    const toDir = wind.dir + Math.PI;
    _localDir.set(Math.sin(toDir), -Math.cos(toDir)).normalize();
    material.uniforms.uWindDir.value.copy(_localDir);
  }

  return { mesh, update };
}
