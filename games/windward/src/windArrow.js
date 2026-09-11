// World-space wind indicator (games/windward/DESIGN.md, W0.5 Batch 3): an
// arrow near the boat pointing where the wind blows *to*, length scaled by
// strength. Pairs with hud.js's compass rose — this one reads at a glance
// while looking at the boat, the rose reads at a glance looking at the HUD.
import * as THREE from '../vendor/three/three.module.js';
import { CONFIG } from './config.js';

const _dir = new THREE.Vector3();

export function createWindArrow() {
  const arrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, CONFIG.WIND_ARROW_HEIGHT, 0),
    CONFIG.WIND_ARROW_MIN_LENGTH,
    0xeaf6ff,
  );

  function update(boatPosition, wind) {
    arrow.position.set(boatPosition.x, CONFIG.WIND_ARROW_HEIGHT, boatPosition.z);

    const toDir = wind.dir + Math.PI;
    _dir.set(Math.sin(toDir), 0, Math.cos(toDir));
    arrow.setDirection(_dir);

    const length = CONFIG.WIND_ARROW_MIN_LENGTH + wind.strength * CONFIG.WIND_ARROW_LENGTH_SCALE;
    arrow.setLength(length, length * 0.3, length * 0.18);
  }

  return { object: arrow, update };
}
