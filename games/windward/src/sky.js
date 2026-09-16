// Golden-hour sky dome (2026-09-16 pass, shared/ART.md) — shared by game.js
// and island-lab.html so the lab's look is exactly what you get sailing.
//
// A BackSide sphere re-centred on the camera every frame, not on the world
// or the boat. depthTest/depthWrite are both off and it draws first
// (renderOrder), so it's a pure backdrop that never interacts with the
// depth buffer — real geometry always draws over it regardless of distance.
// That means its only real constraint is fitting inside camera.far, which
// holds equally whether the camera moves by translation (game.js's fixed
// rig, constant bearing) or free-orbits a target (island-lab.html, bearing
// changes as you drag) — "big enough to enclose the camera" doesn't care
// how the camera got there.
import * as THREE from '../vendor/three/three.module.js';
import { CONFIG } from './config.js';

const VERTEX_SHADER = `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  uniform vec3 uHorizonColor;
  uniform vec3 uZenithColor;
  uniform float uRadius;
  varying vec3 vPos;
  void main() {
    float t = clamp(vPos.y / uRadius, 0.0, 1.0);
    gl_FragColor = vec4(mix(uHorizonColor, uZenithColor, t), 1.0);
  }
`;

export function createSky() {
  const geometry = new THREE.SphereGeometry(CONFIG.SKY_RADIUS, 24, 16);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uHorizonColor: { value: new THREE.Color(CONFIG.SKY_HORIZON_COLOR) },
      uZenithColor: { value: new THREE.Color(CONFIG.SKY_ZENITH_COLOR) },
      uRadius: { value: CONFIG.SKY_RADIUS },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = -1000; // draw first, behind everything else in the scene
  mesh.matrixAutoUpdate = true;

  // Colours are read from CONFIG live (not baked in at construction) so
  // island-lab.html's sliders take effect without rebuilding the mesh.
  function update(camera) {
    mesh.position.copy(camera.position);
    material.uniforms.uHorizonColor.value.set(CONFIG.SKY_HORIZON_COLOR);
    material.uniforms.uZenithColor.value.set(CONFIG.SKY_ZENITH_COLOR);
  }

  return { mesh, update };
}
