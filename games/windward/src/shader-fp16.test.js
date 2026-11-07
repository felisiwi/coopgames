// node games/windward/src/shader-fp16.test.js — the mediump emulation used to reproduce the phone's blocky sea (src/shader-fp16.js).
import assert from 'node:assert/strict';
import { q16, emulateMediumpFragment, Q16_GLSL } from './shader-fp16.js';
import { patchWaterSource } from './sail-feel-water.js';
import { WATER_FRAGMENT_GLSL } from './water.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }

check('16-bit rounding: a world coordinate near 8100 only moves in steps of 4, near 2500 in steps of 2, small numbers stay fine', () => {
  assert.equal(q16(8101), 8100); assert.equal(q16(8103), 8104); assert.equal(q16(2516.6), 2516); assert.equal(q16(0.3), 0.300048828125);
  assert.equal(q16(0), 0); assert.equal(q16(-8101), -8100);
  assert.ok(Math.abs(q16(12.3456) - 12.3456) < 0.01, 'a small coordinate keeps its fraction (this is why a boat-relative coordinate is safe)');
  assert.equal(q16(8100.4) - q16(8100.0), 0, 'a 0.4 m move at z = 8100 does not register at all');
});

check('the transform quantises every use of vWorld inside main() and the world-sized uniforms, for the patched and the original shader alike', () => {
  for (const src of [WATER_FRAGMENT_GLSL, patchWaterSource(WATER_FRAGMENT_GLSL)]) {
    const out = emulateMediumpFragment(src);
    assert.ok(out.startsWith(Q16_GLSL), 'the q16 helpers come first');
    const body = out.slice(out.indexOf('void main() {'));
    assert.ok(body.includes('vec3 vWQ = q16(vWorld);'), 'the one place the varying is read');
    assert.equal(body.split('vWorld').length - 1, 1, 'every other use goes through the quantised copy');
    if (src.includes('varying vec2 vLocal;')) assert.ok(body.includes('vec2 vLQ = q16(vLocal);') && body.split('vLocal').length - 1 === 1, 'the camera-local position is read at 16 bits too');
    else assert.ok(!body.includes('vLocal'), 'the old shader has no vLocal to read');
    assert.ok(!/[^(]uDepthRect\.xy/.test(body), 'uDepthRect read through q16');
  }
  assert.throws(() => emulateMediumpFragment('nothing here'), /main/);
});

console.log(`${passed} shader-fp16 checks passed`);
