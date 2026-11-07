// node games/windward/src/sail-feel-water.test.js — the shader patch that paints the real wind field on the sea
// (src/sail-feel-water.js). It cannot compile GLSL here, but it can prove the patch still fits the game's water shader
// and fails loudly if water.js changes shape.
import assert from 'node:assert/strict';
import { patchWaterSource } from './sail-feel-water.js';
import { WATER_FRAGMENT_GLSL } from './water.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }

check('the patch fits the game\'s real water shader: noise gusts out, field-driven patches in, uniforms declared once', () => {
  const out = patchWaterSource(WATER_FRAGMENT_GLSL);
  assert.ok(WATER_FRAGMENT_GLSL.includes('float patchy'), 'the original has the random-noise gust block');
  assert.ok(!out.includes('float patchy') && !out.includes('float ruffle'), 'the random gusts are gone (they would show gusts that are not there)');
  for (const u of ['uWindTex', 'uWindRect', 'uWindDrift', 'uWindOn']) assert.equal(out.split(`uniform`).filter((s) => new RegExp(`\\b${u}\\b`).test(s.split(';')[0])).length, 1, `${u} declared once`);
  assert.ok(out.includes('texture2D(uWindTex, wuv)'));
  assert.ok(out.includes('// wind lines: long thin pale lines along the wind'), 'the rest of the shader is untouched');
  assert.ok(out.includes('float open = smoothstep(1.2, 3.0, depth);'), 'the shallow-water mask is still defined above the patch');
  assert.ok(out.indexOf('uniform sampler2D uWindTex') < out.indexOf('void main()'), 'uniforms come before main()');
  assert.ok(out.length > WATER_FRAGMENT_GLSL.length - 400);
});

check('if water.js changes under the patch it throws, naming the file to update, instead of silently doing nothing', () => {
  assert.throws(() => patchWaterSource('void main() { gl_FragColor = vec4(1.0); }'), /src\/sail-feel-water\.js/);
  assert.throws(() => patchWaterSource(WATER_FRAGMENT_GLSL.replace('// gust patches: darker', '// something else')), /gust-patch block/);
});

console.log(`${passed} sail-feel-water checks passed`);
