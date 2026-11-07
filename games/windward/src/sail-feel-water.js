// Paints the REAL wind field on the sea (docs/ALIVE-SEA.md decision 8: "dark ripple patches on the water first").
//
// The game's water shader (src/water.js) already draws "gust patches", but from random noise in a wind-aligned frame: they
// know nothing about our deterministic field, so they would show gusts that are not there. This file swaps that block of the
// shader for one that reads a small texture of windAt() around the boat, so the dark patches ARE the gusts (and the glassy
// patches are the lulls and the lees), seen well before they reach you. water.js itself is not edited: the fragment shader
// source is patched at runtime, and the patch throws loudly if water.js changes shape under it.
import * as THREE from '../vendor/three/three.module.js';
import { clamp } from './weather-noise.js';
import { rippleOffsets, crestOffsets, LATTICE } from './shader-local.js';

// What we replace: from this comment line up to (not including) the "wind lines" comment.
const START = '  // gust patches: darker, finely ruffled areas sliding across the sea';
const END = '  // wind lines: long thin pale lines along the wind';
const DECL_AFTER = 'uniform float uFoamK;';
const DEPTH_UV = 'vec2 uv = (vWorld.xz - uDepthRect.xy) / uDepthRect.zw;';
const DEPTH_UV_LOCAL = 'vec2 uv = (vLocal - uDepthL.xy) / uDepthL.zw;';

// The vertex shader: add the swell (one travelling sine, scaled by open-water exposure from the texture) to the sea's height and slope.
const V_DECL_AFTER = 'uniform vec2 uPlaneOffset;';
const V_OLD_H = '  float h = seaHeight(wx, wz, uPhases, uWindDir, uWindStrength) * uWaveScale;';
const V_OLD_G = '  vGrad = seaSlope(wx, wz, uPhases, uWindDir, uWindStrength);';
const V_UNIFORMS = `
varying vec2 vSwell;
varying vec2 vLocal;        // the position relative to the camera target: SMALL numbers, safe for a 16-bit fragment shader (src/shader-local.js)
uniform vec2 uLocalOrigin;  // the camera target in the world
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
  vLocal = vec2(wx, wz) - uLocalOrigin; // computed here, at full precision, so the fragment shader never sees a big world coordinate
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
varying vec2 vLocal;          // the position relative to the camera target (small numbers: this shader may run at 16-bit, see src/shader-local.js)
uniform sampler2D uWindTex;   // r = wind relative to calm-air wind of this water, (local - 0.2) / 1.6
uniform vec4 uWindRectL;      // the texture's corner RELATIVE TO THE TARGET, and its size in metres
uniform vec4 uRip;            // gust ripple noise offsets (lattice units, wrapped small): xy for the coarse octave, zw for the fine one
uniform vec4 uCrest;          // crest streak noise offsets, the same way
uniform vec4 uDepthL;         // the baked depth map's corner relative to the target, and its size (the shore foam lookup)
uniform float uWindOn;        // 0 = layer off
uniform vec4 uSwell;          // x, y: the unit vector (x, z) the swell travels along (the fragment shader needs it to stretch foam streaks along the crests)
// (texture: r = wind vs calm-air wind, g = open-water exposure, b = squall water darkness)
`;

// Periodic value noise: the hash of the cell index mod LATTICE, so a wrapped offset gives exactly the value the absolute coordinate would (src/shader-local.js).
const VNP_GLSL = `
float h21p(vec2 i) { return h21(mod(i, ${LATTICE}.0)); }
float vnp(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21p(i), h21p(i + vec2(1.0, 0.0)), u.x), mix(h21p(i + vec2(0.0, 1.0)), h21p(i + vec2(1.0, 1.0)), u.x), u.y);
}
`;

const BLOCK_GLSL = `  // sail-feel: the real wind field, from a texture around the boat (src/sail-feel-water.js)
  vec2 wuv = (vLocal - uWindRectL.xy) / uWindRectL.zw;
  float inWin = step(0.0, wuv.x) * step(wuv.x, 1.0) * step(0.0, wuv.y) * step(wuv.y, 1.0);
  vec4 wf = texture2D(uWindTex, wuv);
  float rel = wf.r * 1.6 + 0.2;
  float rip = vnp(vLocal * 0.55 + uRip.xy) * 0.6 + vnp(vLocal * 1.3 + uRip.zw) * 0.4; // fine ripples, carried with the air (offsets fold in the target's position and the drift)
  float openSea = smoothstep(1.2, 3.0, depth);
  float gustK = smoothstep(1.04, 1.30, rel) * inWin * openSea * uWindOn;
  float lullK = smoothstep(0.96, 0.62, rel) * inWin * openSea * uWindOn;
  // swell: long crests of foam-bright water with darker, bluer troughs, in lines across the swell (flat inside the skerries: vSwell.y = 0). Lulls calm it.
  float swV = smoothstep(0.08, 0.5, vSwell.y) * (1.0 - 0.8 * lullK) * openSea;
  float crest = smoothstep(0.72, 0.98, vSwell.x); // a narrow crest line ...
  float trough = smoothstep(-0.20, -0.95, vSwell.x);
  vec2 trav = uSwell.xy; vec2 along = vec2(-trav.y, trav.x); // along the crest line
  vec2 sc = vec2(dot(vLocal, along) * 0.075, dot(vLocal, trav) * 0.55);
  float crestBreak = smoothstep(0.28, 0.72, vnp(sc + uCrest.xy) * 0.7 + vnp(sc * 2.3 + uCrest.zw) * 0.3); // ... that breaks into foam streaks 10 to 15 m long, along the crest (not a solid stripe, not blocks)
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
  let out = withBlock.slice(0, at) + UNIFORMS_GLSL + withBlock.slice(at);
  const m = out.indexOf('void main() {');
  if (m < 0 || !out.includes(DEPTH_UV)) throw new Error('sail-feel-water: the water shader in src/water.js no longer has main() or the depth-map lookup this patch rewrites; update src/sail-feel-water.js');
  out = out.slice(0, m) + VNP_GLSL + out.slice(m);
  return out.replace(DEPTH_UV, DEPTH_UV_LOCAL); // the baked depth/shore lookup too: a world coordinate subtracted from a world corner is exactly what a 16-bit GPU gets wrong
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
    uWindRect: { value: new THREE.Vector4(0, 0, size, size) }, // absolute: the VERTEX shader (always full precision) uses this one for the swell
    uWindRectL: { value: new THREE.Vector4(0, 0, size, size) }, // relative to the target: what the fragment shader uses
    uLocalOrigin: { value: new THREE.Vector2() },
    uRip: { value: new THREE.Vector4() },
    uCrest: { value: new THREE.Vector4() },
    uDepthL: { value: new THREE.Vector4() },
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
  // The big numbers live here, in 64-bit JS: the texture's corner, the air's drift, the swell's direction and the camera target. setOrigin() folds them into the small
  // numbers the fragment shader gets (src/shader-local.js: why).
  const st = { rx: 0, rz: 0, dx: 0, dz: 0, tx: 1, tz: 0, ox: 0, oz: 0 };
  const depthRect = water.mesh.material.uniforms.uDepthRect?.value; // [x, z, w, h] of the baked depth map (water.js)
  function recompute() {
    u.uLocalOrigin.value.set(st.ox, st.oz);
    u.uWindRectL.value.set(st.rx - st.ox, st.rz - st.oz, size, size);
    const r = rippleOffsets(st.ox, st.oz, st.dx, st.dz); u.uRip.value.set(r[0], r[1], r[2], r[3]);
    const c = crestOffsets(st.ox, st.oz, st.tx, st.tz); u.uCrest.value.set(c[0], c[1], c[2], c[3]);
    if (depthRect) u.uDepthL.value.set(depthRect.x - st.ox, depthRect.y - st.oz, depthRect.z, depthRect.w);
  }
  function finish() {
    data.set(next);
    tex.needsUpdate = true;
    u.uWindRect.value.set(pass.ox, pass.oz, size, size);
    st.rx = pass.ox; st.rz = pass.oz;
    const d = pass.field.drift(pass.t);
    st.dx = d.x; st.dz = d.z;
    pass = null;
    recompute();
  }
  recompute();
  return {
    rect: u.uWindRect.value,
    setOn(on) { u.uWindOn.value = on ? 1 : 0; },
    // sw: swellFor() result or null (no swell); phase: swellPhaseUniform(sw, t); amp: metres before exposure
    setSwell(sw, phase, amp = sw ? sw.amp : 0) { if (sw) { u.uSwell.value.set(sw.tx, sw.tz, sw.k, phase); st.tx = sw.tx; st.tz = sw.tz; } u.uSwellAmp.value = sw ? amp : 0; },
    // Call every frame with the camera target (the same point the water tile follows), before drawing: it keeps every number the fragment shader sees small.
    setOrigin(x, z) { st.ox = x; st.oz = z; recompute(); },
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
