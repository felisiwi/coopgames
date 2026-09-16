// Cheap stand-in for bloom (2026-09-16 pass, shared/ART.md) — a single
// additive-blended billboard placed along the sun's true direction from the
// camera every frame, shared by game.js and island-lab.html.
//
// A THREE.Sprite always faces the camera, so re-deriving its world position
// from the camera's *current* position each frame (rather than parenting it
// at a fixed local offset) reads correctly whether the camera moves by
// translation only (game.js, constant sun bearing) or free-orbits a target
// (island-lab.html, bearing changes as you drag) — no assumption about how
// the camera got where it is, just "where is the sun from here right now."
import * as THREE from '../vendor/three/three.module.js';
import { CONFIG } from './config.js';

const TEXTURE_SIZE = 128;

function createGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext('2d');
  const r = TEXTURE_SIZE / 2;
  const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function createSunGlow() {
  const material = new THREE.SpriteMaterial({
    map: createGlowTexture(),
    color: CONFIG.GLOW_COLOR,
    opacity: CONFIG.GLOW_OPACITY,
    transparent: true,
    depthWrite: false, // never blocks anything drawn after it
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(CONFIG.GLOW_SIZE, CONFIG.GLOW_SIZE, 1);

  const sunDir = new THREE.Vector3();

  // depthTest stays on (default) so real geometry between the camera and
  // the glow's position — e.g. the island, if it sits along the sun's ray —
  // occludes it like an actual light source would.
  function update(camera) {
    const az = (CONFIG.LIGHT_AZIMUTH_DEG * Math.PI) / 180;
    const el = (CONFIG.LIGHT_ELEVATION_DEG * Math.PI) / 180;
    sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    sprite.position.copy(camera.position).addScaledVector(sunDir, CONFIG.GLOW_DISTANCE);
    sprite.scale.set(CONFIG.GLOW_SIZE, CONFIG.GLOW_SIZE, 1);
    material.color.set(CONFIG.GLOW_COLOR);
    material.opacity = CONFIG.GLOW_OPACITY;
  }

  return { sprite, update };
}
