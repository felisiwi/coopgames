// node games/windward/src/touch.test.js — touch-control maths (the DOM part
// needs a real phone; these are the bits that can be wrong silently).
import assert from 'node:assert/strict';
import { CONFIG } from './config.js';
import { sliderToTrim, trimToSlider, pinchZoom } from './touch.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

check('slider top = sheeted in, bottom = eased out, clamped beyond the track', () => {
  assert.equal(sliderToTrim(0), CONFIG.TRIM_MIN);
  assert.equal(sliderToTrim(1), CONFIG.TRIM_MAX);
  assert.equal(sliderToTrim(-0.5), CONFIG.TRIM_MIN);
  assert.equal(sliderToTrim(1.7), CONFIG.TRIM_MAX);
});

check('slider and trim round-trip, so the thumb shows the real sheet', () => {
  for (const f of [0, 0.25, 0.5, 0.9]) assert.ok(Math.abs(trimToSlider(sliderToTrim(f)) - f) < 1e-12);
});

check('pinch: fingers apart zooms in (like scrolling up), together zooms out, clamped', () => {
  assert.ok(pinchZoom(1, 100, 200) < 1);
  assert.ok(pinchZoom(1, 200, 100) > 1);
  assert.equal(pinchZoom(1, 100, 10000), CONFIG.ZOOM_MIN);
  assert.equal(pinchZoom(1, 10000, 100), CONFIG.ZOOM_MAX);
  assert.equal(pinchZoom(1.3, 0, 50), 1.3); // degenerate spread leaves zoom alone
});

console.log(`\n${passed} passed`);
