// node games/windward/src/stage1.test.js — Stage 1 quick fixes from the
// 2026-11-04 design audit: spawn pose, partner presence, flat boat
// material, calmer wind lulls.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { CONFIG } from './config.js';
import { spawnPose } from './spawn.js';
import { partnerState } from './partner.js';
import { toFlatLambert } from './boat.js';
import { nextWindTarget, initialWind } from './wind.js';
import { boatSpeed, angleOffWind } from './sail.js';

const DEG = Math.PI / 180;
let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

check('spawn: no seed starts a boat in the no-go zone (was ~1 in 8)', () => {
  for (let seed = 0; seed < 2000; seed++) {
    const wind = initialWind(seed);
    for (const role of ['host', 'guest']) {
      const p = spawnPose(seed, role);
      const off = angleOffWind(p.heading, wind.dir) / DEG;
      assert.ok(Math.abs(off - 90) < 1e-6, `seed ${seed} ${role}: ${off}° off the wind`);
      assert.ok(boatSpeed(p.heading, wind.dir, wind.strength, p.trim) > 0, `seed ${seed} ${role}: no speed`);
    }
  }
});

check('spawn: starts at ideal trim, so it is the fastest the boat can go on that heading', () => {
  const seed = 1;
  const wind = initialWind(seed);
  const p = spawnPose(seed, 'host');
  const atSpawn = boatSpeed(p.heading, wind.dir, wind.strength, p.trim);
  for (let t = 0; t <= 90; t += 5) {
    assert.ok(boatSpeed(p.heading, wind.dir, wind.strength, t * DEG) <= atSpawn + 1e-9);
  }
});

check('spawn: host and guest agree on heading, stay apart on X, same seed same pose', () => {
  for (const seed of [1, 2, 3, 777]) {
    const h = spawnPose(seed, 'host');
    const g = spawnPose(seed, 'guest');
    assert.equal(h.heading, g.heading);
    assert.equal(g.x - h.x, 2 * CONFIG.BOAT_SPAWN_OFFSET);
    assert.deepEqual(spawnPose(seed, 'host'), h);
  }
});

check('partner: none until first pos, present while fresh, left after the timeout', () => {
  const t = CONFIG.PARTNER_TIMEOUT_S;
  assert.equal(partnerState(null, 100), 'none');
  assert.equal(partnerState(100, 100 + t - 0.01), 'present');
  assert.equal(partnerState(100, 100 + t + 0.01), 'left');
  assert.equal(partnerState(200, 200.05), 'present'); // a new pos brings them back
});

check('boat: GLB materials become flat Lambert, keeping texture and tint', () => {
  const map = new THREE.Texture();
  const pbr = new THREE.MeshStandardMaterial({ map, color: 0x66ccff, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  const flat = toFlatLambert(pbr);
  assert.ok(flat.isMeshLambertMaterial);
  assert.equal(flat.flatShading, true);
  assert.equal(flat.map, map);
  assert.equal(flat.color.getHex(), 0x66ccff);
  assert.equal(flat.opacity, 0.5);
  assert.equal(flat.transparent, true);
  assert.equal(flat.side, THREE.DoubleSide);
  assert.notEqual(flat.color, pbr.color); // a copy, not shared with the source
});

check('wind: new targets reach real lulls but stay within the configured range', () => {
  let min = 1;
  let max = 0;
  for (let i = 0; i < 5000; i++) {
    const s = nextWindTarget().strength;
    min = Math.min(min, s);
    max = Math.max(max, s);
  }
  assert.ok(min >= CONFIG.WIND_TARGET_STRENGTH_MIN && max <= CONFIG.WIND_TARGET_STRENGTH_MAX);
  assert.ok(min < 0.3, `lowest target ${min.toFixed(2)} — lulls should get near the floor`);
});

console.log(`\n${passed} passed`);
