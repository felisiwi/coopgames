// node games/windward/src/hud.test.js — checks the pure conversion/hint
// logic (games/windward/DESIGN.md's W0.8 "HUD fix and units" item) without
// touching createHud()/updateHud(), which need a DOM for their canvas/div
// elements and so stay untested headlessly (Felix judges the actual layout).
import assert from 'node:assert/strict';
import { msToKnots, strengthToMs, trimHint } from './hud.js';
import { CONFIG } from './config.js';
import { TRIM_FULL_WINDOW_DEG } from './sail.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

check('unit conversion: 1 m/s = 1.944 kn', () => {
  assert.ok(Math.abs(msToKnots(1) - 1.944) < 0.001, `got ${msToKnots(1)}`);
});

check('strengthToMs maps 0..1 onto CONFIG.WIND_STRENGTH_MIN_MS..MAX_MS', () => {
  assert.equal(strengthToMs(0), CONFIG.WIND_STRENGTH_MIN_MS);
  assert.equal(strengthToMs(1), CONFIG.WIND_STRENGTH_MAX_MS);
  const mid = strengthToMs(0.5);
  assert.ok(mid > CONFIG.WIND_STRENGTH_MIN_MS && mid < CONFIG.WIND_STRENGTH_MAX_MS);
});

check('trimHint: within the full-speed window reads as trimmed', () => {
  assert.equal(trimHint(45, 45), 'trimmed ✓');
  assert.equal(trimHint(45 + TRIM_FULL_WINDOW_DEG, 45), 'trimmed ✓');
  assert.equal(trimHint(45 - TRIM_FULL_WINDOW_DEG, 45), 'trimmed ✓');
});

check('trimHint: over-eased past ideal says sheet in; over-sheeted says ease', () => {
  assert.equal(trimHint(45 + TRIM_FULL_WINDOW_DEG + 10, 45), `sheet in ${TRIM_FULL_WINDOW_DEG + 10}°`);
  assert.equal(trimHint(45 - TRIM_FULL_WINDOW_DEG - 7, 45), `ease ${TRIM_FULL_WINDOW_DEG + 7}°`);
});

console.log(`\n${passed}/${passed} assertions passed`);
