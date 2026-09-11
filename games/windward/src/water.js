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
    float amp = 0.15 + uWindStrength * 0.55;
    float d = dot(pos.xy, uWindDir);
    pos.z += amp * 0.55 * sin(d * 0.12 + uTime * 1.3);
    pos.z += amp * 0.30 * sin(d * 0.28 - uTime * 2.1 + 1.7);
    pos.z += amp * 0.15 * sin(d * 0.55 + uTime * 3.4 + 4.2);

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
    vec3 color = uBaseColor * (0.55 + 0.45 * diffuse);
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
      uLightDir: { value: new THREE.Vector3(0.4, 1, 0.3) },
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
