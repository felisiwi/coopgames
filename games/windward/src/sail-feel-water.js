// Paints the REAL wind field on the sea (docs/ALIVE-SEA.md decision 8: "dark ripple patches on the water first").
//
// The game's water shader (src/water.js) already draws "gust patches", but from random noise in a wind-aligned frame: they
// know nothing about our deterministic field, so they would show gusts that are not there. This file swaps that block of the
// shader for one that reads a small texture of windAt() around the boat, so the dark patches ARE the gusts (and the glassy
// patches are the lulls and the lees), seen well before they reach you. water.js itself is not edited: the fragment shader
// source is patched at runtime, and the patch throws loudly if water.js changes shape under it.
import * as THREE from '../vendor/three/three.module.js';
import { clamp } from './weather-noise.js';

// What we replace: from this comment line up to (not including) the "wind lines" comment.
const START = '  // gust patches: darker, finely ruffled areas sliding across the sea';
const END = '  // wind lines: long thin pale lines along the wind';
const DECL_AFTER = 'uniform float uFoamK;';

// The vertex shader: add the swell (one travelling sine, scaled by open-water exposure from the texture) to the sea's height and slope.
const V_DECL_AFTER = 'uniform vec2 uPlaneOffset;';
const V_OLD_H = '  float h = seaHeight(wx, wz, uPhases, uWindDir, uWindStrength) * uWaveScale;';
const V_OLD_G = '  vGrad = seaSlope(wx, wz, uPhases, uWindDir, uWindStrength);';
const V_UNIFORMS = `
varying vec2 vSwell;
uniform sampler2D uWindTex;
uniform vec4 uWindRect;
uniform vec4 uSwell;     // x, y: the unit vector (x, z) the swell travels along; z: k (rad/m); w: phase
uniform float uSwellAmp; // metres, before exposure (0 = no swell)
`;
const V_NEW = `  // sail-feel lab: the swell (src/sail-feel-swell.js), full outside the skerries and flat among them
  vec2 swuv = (vec2(wx, wz) - uWindRect.xy) / uWindRect.zw;
  vec2 sedge = abs(swuv - 0.5);
  float swin = 1.0 - smoothstep(0.35, 0.5, max(sedge.x, sedge.y));
  float swE = smoothstep(0.35, 0.9, texture2D(uWindTex, swuv).g) * swin;
  float swA = uSwellAmp * swE;
  float swTheta = uSwell.z * (wx * uSwell.x + wz * uSwell.y) + uSwell.w;
  vSwell = vec2(sin(swTheta), swA);
  float h = (seaHeight(wx, wz, uPhases, uWindDir, uWindStrength) + swA * sin(swTheta)) * uWaveScale;
  vGrad = seaSlope(wx, wz, uPhases, uWindDir, uWindStrength) + swA * uSwell.z * cos(swTheta) * vec2(uSwell.x, uSwell.y);`;

export function patchWaterVertexSource(vertexShader) {
  const d = vertexShader.indexOf(V_DECL_AFTER);
  if (d < 0 || !vertexShader.includes(V_OLD_H) || !vertexShader.includes(V_OLD_G)) throw new Error('sail-feel-water: the water vertex shader in src/water.js no longer has the height/slope lines the swell patch replaces; update src/sail-feel-water.js');
  const swapped = vertexShader.replace(V_OLD_H, V_NEW).replace(V_OLD_G, '');
  const at = swapped.indexOf(V_DECL_AFTER) + V_DECL_AFTER.length;
  return swapped.slice(0, at) + V_UNIFORMS + swapped.slice(at);
}

const UNIFORMS_GLSL = `
varying vec2 vSwell;          // x = sin(swell phase) here (+1 crest, -1 trough), y = swell height in metres here (0 inside the skerries)
uniform sampler2D uWindTex;   // r = wind relative to calm-air wind of this water, (local - 0.2) / 1.6
uniform vec4 uWindRect;       // world x, z of the texture's corner, and its size in metres
uniform vec2 uWindDrift;      // where the air has carried a patch from the origin: ripples ride with it
uniform float uWindOn;        // 0 = layer off
uniform vec4 uSwell;          // x, y: the unit vector (x, z) the swell travels along (the fragment shader needs it to stretch foam streaks along the crests)
// (texture: r = wind vs calm-air wind, g = open-water exposure, b = squall water darkness)
`;

const BLOCK_GLSL = `  // sail-feel: the real wind field, from a texture around the boat (src/sail-feel-water.js)
  vec2 wuv = (vWorld.xz - uWindRect.xy) / uWindRect.zw;
  float inWin = step(0.0, wuv.x) * step(wuv.x, 1.0) * step(0.0, wuv.y) * step(wuv.y, 1.0);
  vec4 wf = texture2D(uWindTex, wuv);
  float rel = wf.r * 1.6 + 0.2;
  vec2 dp = vWorld.xz - uWindDrift;
  float rip = vn(dp * 0.55) * 0.6 + vn(dp * 1.3 + 7.0) * 0.4; // fine ripples, carried with the air
  float openSea = smoothstep(1.2, 3.0, depth);
  float gustK = smoothstep(1.04, 1.30, rel) * inWin * openSea * uWindOn;
  float lullK = smoothstep(0.96, 0.62, rel) * inWin * openSea * uWindOn;
  // swell: long crests of foam-bright water with darker, bluer troughs, in lines across the swell (flat inside the skerries: vSwell.y = 0). Lulls calm it.
  float swV = smoothstep(0.08, 0.5, vSwell.y) * (1.0 - 0.8 * lullK) * openSea;
  float crest = smoothstep(0.72, 0.98, vSwell.x); // a narrow crest line ...
  float trough = smoothstep(-0.20, -0.95, vSwell.x);
  vec2 trav = uSwell.xy; vec2 along = vec2(-trav.y, trav.x); // along the crest line
  vec2 sc = vec2(dot(vWorld.xz, along) * 0.075, dot(vWorld.xz, trav) * 0.55);
  float crestBreak = smoothstep(0.28, 0.72, vn(sc + vec2(3.0, 9.0)) * 0.7 + vn(sc * 2.3 + vec2(11.0, 4.0)) * 0.3); // ... that breaks into foam streaks 10 to 15 m long, along the crest (not a solid stripe, not blocks)
  col = mix(col, col * vec3(0.72, 0.82, 0.92), trough * swV * 0.5);
  col *= 1.0 + 0.10 * vSwell.x * swV; // a gentle roll between the crests
  col = mix(col, vec3(0.95, 0.98, 1.0), crest * (0.22 + 0.78 * crestBreak) * swV * 0.7);
  col = mix(col, col * vec3(0.34, 0.50, 0.76), gustK * (0.72 + 0.28 * rip)); // a gust: clearly darker and bluer ...
  col += vec3(0.13, 0.18, 0.21) * smoothstep(0.58, 0.84, rip) * gustK; // ... and ruffled, with pale flecks (cat's-paws)
  col = mix(col, vec3(0.72, 0.84, 0.90), lullK * 0.62); // a lull or a lee: a pale, smooth, glassy sheen (the sky in the water)
  float stormK = wf.b * inWin * uWindOn; // a squall: a dark line racing across the sea, then dark water with whitecaps
  col = mix(col, col * vec3(0.30, 0.38, 0.50), stormK * 0.85);
  col += vec3(0.55, 0.62, 0.68) * smoothstep(0.6, 0.82, rip) * stormK * stormK * 0.45;
`;

export function patchWaterSource(fragmentShader) {
  const a = fragmentShader.indexOf(START);
  const b = fragmentShader.indexOf(END);
  const d = fragmentShader.indexOf(DECL_AFTER);
  if (a < 0 || b < 0 || b < a || d < 0) throw new Error('sail-feel-water: the water shader in src/water.js no longer has the gust-patch block this patch replaces; update src/sail-feel-water.js');
  const withBlock = fragmentShader.slice(0, a) + BLOCK_GLSL + fragmentShader.slice(b);
  const at = withBlock.indexOf(DECL_AFTER) + DECL_AFTER.length;
  return withBlock.slice(0, at) + UNIFORMS_GLSL + withBlock.slice(at);
}

// water = createWater() result ({ mesh, ... } with the far ring as mesh.children[0]). Returns { update, setOn, dispose, rect }.
// size: metres the texture covers (centred on the boat); n: texels per side. Bigger n = finer patches but a costlier refresh.
export function createWindPaint(water, { size = 512, n = 48 } = {}) {
  const data = new Uint8Array(n * n * 4);
  const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  const u = {
    uWindTex: { value: tex },
    uWindRect: { value: new THREE.Vector4(0, 0, size, size) },
    uWindDrift: { value: new THREE.Vector2() },
    uWindOn: { value: 1 },
    uSwell: { value: new THREE.Vector4(1, 0, 0.24, 0) },
    uSwellAmp: { value: 0 },
  };
  const materials = [water.mesh.material, ...water.mesh.children.map((c) => c.material).filter(Boolean)];
  for (const m of materials) {
    m.fragmentShader = patchWaterSource(m.fragmentShader);
    m.vertexShader = patchWaterVertexSource(m.vertexShader);
    Object.assign(m.uniforms, u); // the same {value} holders on every material: one update feeds them all
    m.needsUpdate = true;
  }
  const cell = size / n;
  const tmp = {};
  const next = new Uint8Array(n * n * 4); // the texture being built, a few rows per frame; swapped in when complete
  let pass = null;
  function finish() {
    data.set(next);
    tex.needsUpdate = true;
    u.uWindRect.value.set(pass.ox, pass.oz, size, size);
    const d = pass.field.drift(pass.t);
    u.uWindDrift.value.set(d.x, d.z);
    pass = null;
  }
  return {
    rect: u.uWindRect.value,
    setOn(on) { u.uWindOn.value = on ? 1 : 0; },
    // sw: swellFor() result or null (no swell); phase: swellPhaseUniform(sw, t); amp: metres before exposure
    setSwell(sw, phase, amp = sw ? sw.amp : 0) { if (sw) u.uSwell.value.set(sw.tx, sw.tz, sw.k, phase); u.uSwellAmp.value = sw ? amp : 0; },
    // Re-sample the wind field around (cx, cz) at game time t, `rows` rows per call, so the ~n*n windAt calls are spread over
    // n / rows frames instead of landing in one frame (a phone would hitch). A pass is latched at its first call.
    step(field, t, cx, cz, rows = 6) {
      if (!pass) pass = { row: 0, ox: Math.round(cx / cell) * cell - size / 2, oz: Math.round(cz / cell) * cell - size / 2, t, field };
      const end = Math.min(n, pass.row + rows);
      for (let j = pass.row; j < end; j++) {
        for (let i = 0; i < n; i++) {
          const w = field.windAt(pass.ox + (i + 0.5) * cell, pass.oz + (j + 0.5) * cell, pass.t, tmp);
          const k = (j * n + i) * 4;
          next[k] = Math.round(clamp((w.local - 0.2) / 1.6, 0, 1) * 255);
          next[k + 1] = Math.round(clamp(w.exposure, 0, 1) * 255);
          next[k + 2] = Math.round(clamp(w.stormBand, 0, 1) * 255);
          next[k + 3] = 255;
        }
      }
      pass.row = end;
      if (pass.row >= n) finish();
    },
    // everything at once (first frame, or after a jump in time/place so the sea is not stale)
    refreshNow(field, t, cx, cz) { pass = null; do { this.step(field, t, cx, cz, n); } while (pass); },
    dispose() { tex.dispose(); },
  };
}
