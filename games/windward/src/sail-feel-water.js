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

const UNIFORMS_GLSL = `
uniform sampler2D uWindTex;   // r = wind relative to calm-air wind of this water, (local - 0.2) / 1.6
uniform vec4 uWindRect;       // world x, z of the texture's corner, and its size in metres
uniform vec2 uWindDrift;      // where the air has carried a patch from the origin: ripples ride with it
uniform float uWindOn;        // 0 = layer off
`;

const BLOCK_GLSL = `  // sail-feel lab: the real wind field, from a texture around the boat (src/sail-feel-water.js)
  vec2 wuv = (vWorld.xz - uWindRect.xy) / uWindRect.zw;
  float inWin = step(0.0, wuv.x) * step(wuv.x, 1.0) * step(0.0, wuv.y) * step(wuv.y, 1.0);
  float rel = texture2D(uWindTex, wuv).r * 1.6 + 0.2;
  vec2 dp = vWorld.xz - uWindDrift;
  float rip = vn(dp * 0.55) * 0.6 + vn(dp * 1.3 + 7.0) * 0.4; // fine ripples, carried with the air
  float openSea = smoothstep(1.2, 3.0, depth);
  float gustK = smoothstep(1.05, 1.35, rel) * inWin * openSea * uWindOn;
  float lullK = smoothstep(0.95, 0.60, rel) * inWin * openSea * uWindOn;
  col = mix(col, col * vec3(0.42, 0.58, 0.82), gustK * (0.6 + 0.4 * rip)); // a gust: darker ...
  col += vec3(0.10, 0.14, 0.17) * smoothstep(0.62, 0.85, rip) * gustK; // ... and ruffled, with pale flecks (cat's-paws)
  col = mix(col, mix(col, vec3(0.80, 0.88, 0.92), 0.35), lullK * 0.85); // a lull or a lee: a pale, glassy sheen
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
  };
  const materials = [water.mesh.material, ...water.mesh.children.map((c) => c.material).filter(Boolean)];
  for (const m of materials) {
    m.fragmentShader = patchWaterSource(m.fragmentShader);
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
          next[k + 1] = 0; next[k + 2] = 0; next[k + 3] = 255;
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
