// node games/windward/src/sail-feel-water.test.js — the shader patch that paints the real wind field on the sea
// (src/sail-feel-water.js). It cannot compile GLSL here, but it can prove the patch still fits the game's water shader
// and fails loudly if water.js changes shape.
import assert from 'node:assert/strict';
import { patchWaterSource, patchWaterVertexSource } from './sail-feel-water.js';
import { WATER_FRAGMENT_GLSL, WATER_VERTEX_GLSL } from './water.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }

check('the patch fits the game\'s real water shader: noise gusts out, field-driven patches in, uniforms declared once', () => {
  const out = patchWaterSource(WATER_FRAGMENT_GLSL);
  assert.ok(WATER_FRAGMENT_GLSL.includes('float patchy'), 'the original has the random-noise gust block');
  assert.ok(!out.includes('float patchy') && !out.includes('float ruffle'), 'the random gusts are gone (they would show gusts that are not there)');
  for (const u of ['uWindTex', 'uWindRectL', 'uRip', 'uCrest', 'uDepthL', 'uWindOn']) assert.equal(out.split(`uniform`).filter((s) => new RegExp(`\\b${u}\\b`).test(s.split(';')[0])).length, 1, `${u} declared once`);
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

check('the vertex patch adds the swell to the game\'s real sea height and slope, uniforms before main(), the old lines gone', () => {
  const out = patchWaterVertexSource(WATER_VERTEX_GLSL);
  assert.ok(out.includes('swA * sin(swTheta)') && out.includes('swA * uSwell.z * cos(swTheta)'), 'height and slope both get the swell');
  assert.ok(!out.includes('float h = seaHeight(wx, wz, uPhases, uWindDir, uWindStrength) * uWaveScale;'), 'the original height line is replaced');
  assert.equal(out.split(/\n/).filter((l) => /^\s*float h = \(seaHeight/.test(l)).length, 1, 'one new height line (the game\'s own seaHeight() keeps its inner `float h = 0.0`)');
  assert.equal(out.split(/\n/).filter((l) => /^\s*vGrad = /.test(l)).length, 1, 'one slope line');
  assert.ok(out.includes('vWorld = vec3(wx, h, wz);') && out.includes('uWaveScale'), 'the rest is untouched (the far ring still flattens it with uWaveScale)');
  assert.ok(out.indexOf('uniform float uSwellAmp') < out.indexOf('void main()'));
  assert.throws(() => patchWaterVertexSource('void main() {}'), /vertex shader/);
});

check('PRECISION: the fragment shader never reads an absolute world coordinate for the weather\'s noise or lookups (a 16-bit phone GPU turned those into blocks)', () => {
  const out = patchWaterSource(WATER_FRAGMENT_GLSL);
  const body = out.slice(out.indexOf('void main() {'));
  const mine = body.slice(body.indexOf('// sail-feel: the real wind field'), body.indexOf('// wind lines'));
  assert.ok(mine.length > 500, 'found the weather block');
  assert.ok(!/vWorld|uWindDrift|uWindRect\b|uDepthRect/.test(mine), 'the weather block uses vLocal and small offsets only');
  assert.ok(/vnp\(vLocal/.test(mine) && !/[^p]vn\(/.test(mine), 'its noise is the periodic vnp() of the local position');
  assert.ok(body.includes('vec2 uv = (vLocal - uDepthL.xy) / uDepthL.zw;') && !body.includes('(vWorld.xz - uDepthRect.xy)'), 'the shore/depth lookup is local too');
  assert.ok(out.includes('float vnp(vec2 p)') && out.indexOf('float vnp(vec2 p)') < out.indexOf('void main() {') && out.indexOf('float vnp(vec2 p)') > out.indexOf('float h21(vec2 p)'), 'vnp is defined after the original hash and before main()');
  const vert = patchWaterVertexSource(WATER_VERTEX_GLSL);
  assert.ok(vert.includes('vLocal = vec2(wx, wz) - uLocalOrigin;') && vert.includes('varying vec2 vLocal;') && vert.includes('uniform vec2 uLocalOrigin;'), 'the vertex shader (always full precision) computes it');
});

console.log(`${passed} sail-feel-water checks passed`);
