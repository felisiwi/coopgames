// TERRAIN STYLE (stylised land cover; a lab-first module, not yet used by game.js).
//
// Problem it solves: the real-coast terrain paints land cover per VERTEX (coast-world.js
// buildTerrainMesh), from a 20 m class raster. The GPU blends vertex colours across each
// triangle, so granite / meadow / forest meet in blurry, pixel-stepped edges.
//
// How this module fixes it: the colour decision moves from vertices to PIXELS.
//   1. bakeZoneMasks(): for each land class, a smoothed 0..1 "how much of this class is here"
//      field (the class raster, blurred, normalised so the classes sum to 1 on land).
//   2. The shader reads that field with bilinear filtering (smooth between texels) and picks the
//      zone with the biggest share. The boundary is where two shares are equal: a smooth, rounded
//      contour with no pixel stairs, at any zoom. A narrow smoothstep around it gives the edge
//      softness (1 pixel wide anti-aliased at "crisp", wider at "soft").
//   3. Optional rules ride on the same machinery: steep ground is granite, terrace bands,
//      a thin darker line on zone borders, fine grain.
//
// To adopt in the game (one place): in coast-world.js createCoastTerrain(), after the meshes are
// built, call attachTerrainStyle(terrain, world, values). See games/windward/terrain-lab.html.
//
// Everything below the "pure maths" banner is DOM-free and GPU-free, so node can test it. The GLSL
// functions mirror the JS ones (same names where possible); keep them in step.
import * as THREE from '../vendor/three/three.module.js';
import { CONFIG } from './config.js';
import { PALETTE } from './island-look.js';

// ---- zones ------------------------------------------------------------------------------------
// Rank order = GLSL index. Granite is the base layer (lowest); an edge line takes the colour of the
// lower-ranked of the two zones it separates.
export const ZONES = ['bare_rock', 'heath', 'meadow', 'scrub', 'forest'];
export const ZONE_OF_CLASS = { bare_rock: 0, heath: 1, meadow: 2, village: 2, scrub: 3, forest: 4 };
// How much of the paint colour replaces granite in each zone: the same weights coast-world.js
// CLASS_PAINT uses, so the stylised zones keep the current palette's feel.
export const ZONE_PAINT_WEIGHT = [0, 0.6, 0.9, 0.8, 0.9];

export const ZONE_SMOOTH_PASSES = 8; // blur passes on the class raster: sigma = sqrt(passes / 2) cells = 2 cells = 4 game metres
export const SLOPE_BLUR_PASSES = 6; // extra blur on the height field before the slope is taken (sigma ~2 cells on top of the field's own 2 passes)
export const SLOPE_CAP = 8; // rise/run; anything steeper is a cliff already
export const MAX_EDGE_HW = 0.22; // zone-edge half-width, in mask units, at softness 1
export const MAX_SLOPE_HW = 0.25; // steep-rule half-width, in slope (rise/run) units, at softness 1
export const GRAIN_AMOUNT = 0.12; // peak brightness wobble of the grain
export const TERRACE_ANCHOR_M = 0.4; // terrace bands start at the lifted shoreline (coast-world.js LAND_LIFT_M)
export const RISER_PX_BASE = 0.8; // terrace riser width on slopes facing away from the camera, in pixels
export const RISER_PX_FACING = 2.4; // extra width on slopes facing the camera

// ---- pure maths -------------------------------------------------------------------------------

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export function smoothstep(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

// Separable [1 2 1]/4 blur, `passes` times, in place; edges clamp. Variance grows by 1/2 cell^2 per pass.
export function blur121(f, nx, nz, passes) {
  const tmp = new Float32Array(f.length);
  for (let p = 0; p < passes; p++) {
    for (let b = 0; b < nz; b++) {
      const row = b * nx;
      for (let a = 0; a < nx; a++) {
        const l = f[row + (a > 0 ? a - 1 : 0)];
        const r = f[row + (a < nx - 1 ? a + 1 : a)];
        tmp[row + a] = 0.25 * l + 0.5 * f[row + a] + 0.25 * r;
      }
    }
    for (let b = 0; b < nz; b++) {
      const up = (b > 0 ? b - 1 : 0) * nx;
      const dn = (b < nz - 1 ? b + 1 : b) * nx;
      for (let a = 0; a < nx; a++) f[b * nx + a] = 0.25 * tmp[up + a] + 0.5 * tmp[b * nx + a] + 0.25 * tmp[dn + a];
    }
  }
  return f;
}

// Per-zone shares as RGBA8: R heath, G meadow(+village), B scrub, A forest. Bare rock is the remainder
// (1 - R - G - B - A). Normalised convolution: each share is blur(class) / blur(land), so water never
// dilutes the shares and a coastal meadow stays "all meadow" right to the shore.
// CL: class value per cell (0 = water); names: class value -> class name (meta.classes order).
export function bakeZoneMasks(CL, names, nx, nz, passes = ZONE_SMOOTH_PASSES) {
  const n = nx * nz;
  const den = new Float32Array(n);
  for (let k = 0; k < n; k++) den[k] = CL[k] ? 1 : 0;
  blur121(den, nx, nz, passes);
  const out = new Uint8Array(n * 4);
  const f = new Float32Array(n);
  for (let z = 1; z < ZONES.length; z++) {
    for (let k = 0; k < n; k++) f[k] = CL[k] && ZONE_OF_CLASS[names[CL[k]]] === z ? 1 : 0;
    blur121(f, nx, nz, passes);
    for (let k = 0; k < n; k++) out[k * 4 + (z - 1)] = den[k] > 1e-4 ? Math.round(255 * clamp01(f[k] / den[k])) : 0;
  }
  return out;
}

// Smoothed slope (rise/run) of the height field, one half-float per cell (Uint16 bit patterns, THREE.DataUtils).
// The mesh's vertex normals are too noisy for a clean steep/flat border (the source heights come in 1 m steps), so the
// steep rule reads this instead: height blurred a further `passes`, then central differences. Half floats keep ~0.001
// of slope, so the contour does not show quantisation; the same map also makes the border independent of mesh LOD.
export function bakeSlopeMap(H, nx, nz, pxM, passes = SLOPE_BLUR_PASSES) {
  const f = Float32Array.from(H);
  blur121(f, nx, nz, passes);
  const out = new Uint16Array(nx * nz);
  for (let b = 0; b < nz; b++) {
    const b0 = b > 0 ? b - 1 : b;
    const b1 = b < nz - 1 ? b + 1 : b;
    for (let a = 0; a < nx; a++) {
      const a0 = a > 0 ? a - 1 : a;
      const a1 = a < nx - 1 ? a + 1 : a;
      const dx = (f[b * nx + a1] - f[b * nx + a0]) / ((a1 - a0) * pxM || 1);
      const dz = (f[b1 * nx + a] - f[b0 * nx + a]) / ((b1 - b0) * pxM || 1);
      out[b * nx + a] = THREE.DataUtils.toHalfFloat(Math.min(SLOPE_CAP, Math.hypot(dx, dz)));
    }
  }
  return out;
}

// Shares of all five zones (rock first) from one RGBA8 texel, as the shader unpacks them.
export function sharesFromTexel(r, g, b, a) {
  const [h, m, s, f] = [r / 255, g / 255, b / 255, a / 255];
  return [Math.max(0, 1 - (h + m + s + f)), h, m, s, f];
}

// Softness 0 (crisp) .. 1 (soft) -> half-widths. Quadratic, so the crisp end has fine control and sits
// below one pixel of anti-aliasing (the shader never goes narrower than ~1 pixel).
export const edgeHalfWidth = (soft) => MAX_EDGE_HW * clamp01(soft) ** 2;
export const slopeHalfWidth = (soft) => MAX_SLOPE_HW * clamp01(soft) ** 2;

// Biggest and second-biggest share (value + index).
export function topTwo(n) {
  let t1 = -1, t2 = -1, i1 = 0, i2 = 0;
  for (let i = 0; i < n.length; i++) {
    const v = n[i];
    if (v > t1) { t2 = t1; i2 = i1; t1 = v; i1 = i; }
    else if (v > t2) { t2 = v; i2 = i; }
  }
  return { t1, t2, i1, i2, gap: t1 - t2 };
}
// The same gap with its sign kept: share of the lower-ranked of the top two zones minus the higher-ranked one's.
// |signedGap| = gap, but unlike gap (a V with its tip on the border) it is a smooth ramp THROUGH the border, so the
// GPU's per-pixel derivative (fwidth) of it is a reliable "gap change per pixel" for anti-aliasing the line.
export function signedGap(n) {
  const { i1, i2 } = topTwo(n);
  return n[Math.min(i1, i2)] - n[Math.max(i1, i2)];
}

// Weight of each zone (sums to 1). A zone's margin = its share minus the best OTHER share: positive only
// for the winner. smoothstep(-hw, hw, margin) turns that into a hard or softened pick; hw is the edge
// half-width in share units.
export function zoneWeights(n, hw) {
  const { t1, t2, i1 } = topTwo(n);
  const w = n.map((v, i) => {
    const margin = v - (i === i1 ? t2 : t1);
    return hw > 0 ? smoothstep(-hw, hw, margin) : margin > 0 ? 1 : margin === 0 ? 0.5 : 0;
  });
  const sum = w.reduce((p, q) => p + q, 0) || 1;
  return w.map((v) => v / sum);
}

// Slope (rise/run) from a unit surface normal.
export const slopeTan = (nx, ny, nz) => Math.hypot(nx, nz) / Math.max(ny, 0.001);
export const slopeTanFromDeg = (deg) => Math.tan((deg * Math.PI) / 180);

// Steep rule: s = 0 below the threshold, 1 above (smooth over +-hwTan). Moves the zone shares toward pure
// granite by s, so the steep boundary is just another zone boundary (same softness, line and anti-aliasing).
export const steepAmount = (slope, thrTan, hwTan) => (hwTan > 0 ? smoothstep(thrTan - hwTan, thrTan + hwTan, slope) : slope >= thrTan ? 1 : 0);
export function applySteep(n, s) {
  return n.map((v, i) => v * (1 - s) + (i === 0 ? s : 0));
}

// Terrace bands: heights are cut every `step` metres from the shoreline. frac 0..1 runs along one tread;
// the riser is the thin strip just under the next band edge, `riserPx` pixels wide (hPerPx = height per pixel).
export function terraceParts(h, step) {
  const t = (h - TERRACE_ANCHOR_M) / step;
  const band = Math.floor(t);
  return { band, frac: t - band };
}
export function riserAmount(frac, step, hPerPx, riserPx = RISER_PX_BASE) {
  const edge = (1 - frac) * step; // height left to the next band edge
  return 1 - smoothstep(riserPx * hPerPx, (riserPx + 1) * hPerPx, edge);
}
// A real step shows a cliff face only where its downhill side turns toward the camera. Fake that: the riser is
// RISER_PX_BASE wide everywhere, up to RISER_PX_BASE + RISER_PX_FACING where the slope faces the camera squarely
// (and the ground is not flat). downhill / toCam: horizontal unit vectors [x, z]; slope: rise/run.
export function riserFacing(downhill, toCam, slope) {
  return Math.max(0, downhill[0] * toCam[0] + downhill[1] * toCam[1]) * smoothstep(0.02, 0.2, slope);
}
export const riserWidthPx = (facing) => RISER_PX_BASE + RISER_PX_FACING * facing;
// Dense bands (< ~3 px per step) would shimmer: fade them out as they pack tighter than 3..8 px.
export const terraceFade = (step, hPerPx) => smoothstep(3, 8, step / Math.max(hPerPx, 1e-4));

// Thin line where zones meet: 1 on the border, fading to 0 within ~1.7 px (aa = gap change per pixel).
export const LINE_PX = 0.9; // half-width of the border line in pixels (so ~1.8 px + 1 px of anti-aliasing)
export const lineAmount = (gap, aa, widthPx = LINE_PX) => 1 - smoothstep(widthPx * aa, (widthPx + 1) * aa, gap);

// ---- style values, presets, URL ---------------------------------------------------------------
// crisp: shader zones on (0 = the current per-vertex paint). soft: edge softness. rock/slope: steep ground
// is granite above `slope` degrees. terrace/step: terrace bands every `step` metres. line, grain: on/off.
export const STYLE_DEFAULT = { crisp: 0, soft: 0.08, rock: 0, slope: 32, terrace: 0, step: 2, line: 0, grain: 0 };
export const STYLE_SPECS = {
  crisp: { type: 'bool' },
  soft: { type: 'num', min: 0, max: 1 },
  rock: { type: 'bool' },
  slope: { type: 'num', min: 15, max: 55 },
  terrace: { type: 'bool' },
  step: { type: 'num', min: 0.75, max: 5 },
  line: { type: 'bool' },
  grain: { type: 'bool' },
};
export const STYLE_KEYS = Object.keys(STYLE_SPECS);
// What the GAME uses (Felix, 2026-11-05, from terrain-lab): crisp zones with soft edges, granite only on the steepest
// ground (slope = the slider max), grain on, no terraces, no edge lines. ?preset=current gives the old per-vertex paint.
export const STYLE_GAME = { ...STYLE_DEFAULT, crisp: 1, soft: 0.82, rock: 1, slope: 55, grain: 1 };
const CRISP = { ...STYLE_DEFAULT, crisp: 1 };
const ROCKS = { ...CRISP, rock: 1 };
const TERRACED = { ...ROCKS, terrace: 1 };
export const STYLE_PRESETS = {
  current: { ...STYLE_DEFAULT },
  crisp: CRISP,
  rocks: ROCKS,
  terraced: TERRACED,
  painted: { ...TERRACED, line: 1, grain: 1 },
};
export const PRESET_LABELS = [['current', 'Current'], ['crisp', 'Crisp'], ['rocks', 'Crisp + rock slopes'], ['terraced', 'Terraced'], ['painted', 'Painted (all on)']];

export function cleanStyleValue(key, v) {
  const spec = STYLE_SPECS[key];
  if (!spec || v === undefined || v === null) return undefined;
  if (spec.type === 'bool') return v === true || v === 1 || v === '1' ? 1 : v === false || v === 0 || v === '0' ? 0 : undefined;
  if (typeof v === 'string' && v.trim() === '') return undefined;
  const x = Number(v);
  return Number.isFinite(x) ? Math.min(spec.max, Math.max(spec.min, x)) : undefined;
}

// ?preset=<id> sets a baseline; any individual key then overrides it. Unknown or bad values are ignored.
export function parseStyleParams(search, base = STYLE_DEFAULT) {
  const params = new URLSearchParams(search);
  const out = { ...base, ...(STYLE_PRESETS[params.get('preset')] || {}) };
  for (const key of STYLE_KEYS) {
    if (!params.has(key)) continue;
    const v = cleanStyleValue(key, params.get(key));
    if (v !== undefined) out[key] = v;
  }
  return out;
}

// The game's version: Felix's values unless the link says otherwise (?preset=, or single keys like ?soft=0.3).
export const parseGameStyle = (search) => parseStyleParams(search, STYLE_GAME);

export function presetMatching(values) {
  for (const [id, p] of Object.entries(STYLE_PRESETS)) if (STYLE_KEYS.every((k) => Math.abs(p[k] - values[k]) < 1e-6)) return id;
  return null;
}

const round3 = (n) => Math.round(n * 1000) / 1000;
// Search string for these values, keeping unrelated params (e.g. the look panel's). A preset match writes just
// ?preset=<id>; otherwise every key that differs from STYLE_DEFAULT is written.
export function styleToSearch(search, values) {
  const params = new URLSearchParams(search);
  params.delete('preset');
  for (const k of STYLE_KEYS) params.delete(k);
  const id = presetMatching(values);
  if (id && id !== 'current') params.set('preset', id);
  else if (!id) {
    for (const k of STYLE_KEYS) if (Math.abs(values[k] - STYLE_DEFAULT[k]) > 1e-6) params.set(k, String(round3(values[k])));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

// ---- palette ----------------------------------------------------------------------------------
const _a = new THREE.Color();
// Five zone colours (THREE.Color, linear), in ZONES order, from the live PALETTE + CONFIG (Skagen).
export function zonePalette() {
  const paints = [
    null,
    PALETTE.heather,
    PALETTE.grass,
    PALETTE.grass2,
    new THREE.Color().copy(PALETTE.grass2).lerp(_a.set(CONFIG.LOOK_PINE), 0.55), // dark conifer floor, as coast-world.js
  ];
  return paints.map((p, i) => (p ? new THREE.Color().copy(PALETTE.granite).lerp(p, ZONE_PAINT_WEIGHT[i]) : new THREE.Color().copy(PALETTE.granite)));
}

// ---- GPU side ---------------------------------------------------------------------------------

const VERT_DECL = `
varying vec3 vTsPos;
varying vec3 vTsNrm;
`;
const VERT_SET = `
vTsPos = position;
vTsNrm = normal;
`;

// GLSL mirror of the maths above.
const FRAG_DECL = `
uniform sampler2D uZones;
uniform sampler2D uSlopeMap; // smoothed slope (rise/run) in .r
uniform vec4 uZoneRect;      // x0, z0, 1/width, 1/depth: world metres -> texture uv
uniform vec3 uCol[5];        // rock, heath, meadow, scrub, forest
uniform vec3 uWet;
uniform vec3 uPale;
uniform float uHeightScale;
uniform float uEdgeHW;       // zone-edge half-width, share units
uniform float uSlopeHW;      // steep-rule half-width, slope units
uniform float uRockOn;
uniform float uSlopeTan;
uniform float uTerraceStep;  // 0 = off
uniform float uLineOn;
uniform float uGrainOn;
varying vec3 vTsPos;
varying vec3 vTsNrm;
float tsTread = 0.0;         // 1 on a terrace tread, 0 on a riser: read later to flatten the lighting normal

float tsHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float tsNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(tsHash(i), tsHash(i + vec2(1.0, 0.0)), f.x), mix(tsHash(i + vec2(0.0, 1.0)), tsHash(i + vec2(1.0, 1.0)), f.x), f.y);
}

vec3 tsColor(vec3 p, vec3 nrm) {
  vec2 uv = (p.xz - uZoneRect.xy) * uZoneRect.zw;
  vec4 m = texture2D(uZones, uv);
  float n[5];
  n[1] = m.r; n[2] = m.g; n[3] = m.b; n[4] = m.a;
  n[0] = max(0.0, 1.0 - (m.r + m.g + m.b + m.a));

  // steep ground is granite: move the shares toward pure rock by s
  float slope = texture2D(uSlopeMap, uv).r;       // smooth bilinear field: a clean steep/flat border at any zoom
  float hwSlope = max(uSlopeHW, fwidth(slope));
  if (uRockOn > 0.5) {
    float s = smoothstep(uSlopeTan - hwSlope, uSlopeTan + hwSlope, slope);
    for (int i = 0; i < 5; i++) n[i] *= (1.0 - s);
    n[0] += s;
  }

  // biggest and second-biggest share; their gap is 0 exactly on a zone border
  float t1 = -1.0; float t2 = -1.0; int i1 = 0; int i2 = 0;
  for (int i = 0; i < 5; i++) {
    float v = n[i];
    if (v > t1) { t2 = t1; i2 = i1; t1 = v; i1 = i; }
    else if (v > t2) { t2 = v; i2 = i; }
  }
  float gap = t1 - t2;
  // How much the gap changes per pixel. fwidth(gap) is unreliable (|.| has a tip on the border, and which two zones
  // are "top two" can flip between neighbouring pixels), so differentiate each zone's share on its own (each is smooth)
  // and add up the two that matter. On a border one share rises while the other falls, so this equals fwidth(signedGap)
  // there (see signedGap in JS), without ever seeing a pair flip.
  float aa = 0.0;
  for (int i = 0; i < 5; i++) {
    float sgn = (i == min(i1, i2)) ? 1.0 : ((i == max(i1, i2)) ? -1.0 : 0.0);
    aa += abs(sgn * dFdx(n[i])) + abs(sgn * dFdy(n[i]));
  }
  aa = max(aa, 1e-4);
  float hw = max(uEdgeHW, aa);           // never sharper than one anti-aliased pixel
  vec3 col = vec3(0.0);
  float wsum = 0.0;
  float wRock = 0.0;
  for (int i = 0; i < 5; i++) {
    float margin = n[i] - (i == i1 ? t2 : t1);
    float w = smoothstep(-hw, hw, margin);
    col += uCol[i] * w;
    wsum += w;
    if (i == 0) wRock = w;
  }
  col /= max(wsum, 1e-4);
  wRock /= max(wsum, 1e-4);

  col = mix(col, uPale, smoothstep(7.0, 11.0, p.y * uHeightScale) * wRock); // pale granite on the high domes
  col = mix(col, uWet, 1.0 - smoothstep(0.35, 0.62, p.y));                    // dark wet band at the waterline

  if (uGrainOn > 0.5) {
    float foot = fwidth(p.x) + fwidth(p.z);                                   // metres per pixel
    float fade = 1.0 - smoothstep(0.25, 0.9, foot);                           // grain finer than a pixel just averages out
    float g = tsNoise(p.xz * 2.3) * 0.6 + tsNoise(p.xz * 6.1 + 7.0) * 0.4 - 0.5;
    col *= 1.0 + g * ${GRAIN_AMOUNT.toFixed(3)} * fade * vec3(1.0, 0.95, 1.05);
  }

  if (uTerraceStep > 0.0) {
    float t = (p.y - ${TERRACE_ANCHOR_M.toFixed(2)}) / uTerraceStep;
    float band = floor(t);
    float hpp = max(fwidth(p.y), 1e-4);                                       // height per pixel
    float fade = smoothstep(3.0, 8.0, uTerraceStep / hpp);
    float edge = (1.0 - (t - band)) * uTerraceStep;
    // riser width: thin everywhere, thick where the downhill side faces the camera (a cliff face you could see)
    vec2 downhill = nrm.xz / max(length(nrm.xz), 1e-4);
    vec2 toCam = normalize(cameraPosition.xz - p.xz);
    float facing = max(0.0, dot(downhill, toCam)) * smoothstep(0.02, 0.2, slope);
    float rw = ${RISER_PX_BASE.toFixed(2)} + ${RISER_PX_FACING.toFixed(2)} * facing;
    float riser = (1.0 - smoothstep(rw * hpp, (rw + 1.0) * hpp, edge)) * fade;
    tsTread = (1.0 - riser) * fade;
    col *= mix(1.0, 0.66, riser);
    col *= 1.0 + (tsHash(vec2(band, 3.0)) - 0.5) * 0.07 * fade;               // each tread a hair different
  }

  if (uLineOn > 0.5) {
    float line = 1.0 - smoothstep(${LINE_PX.toFixed(2)} * aa, ${(LINE_PX + 1).toFixed(2)} * aa, gap);
    col = mix(col, uCol[min(i1, i2)] * 0.6, line * 0.9);                       // darker tint of the lower-ranked zone
  }
  return col;
}
`;

const FRAG_COLOR = `diffuseColor.rgb *= tsColor(vTsPos, normalize(vTsNrm));`;
const FRAG_NORMAL = `
if (uTerraceStep > 0.0) {
  vec3 tsUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  normal = normalize(mix(normal, tsUp, 0.6 * tsTread));                       // treads catch the light like flat ground
}
`;

// world: buildCoastWorld()'s result. Builds the mask texture and a lit material that paints from it.
// The terrain meshes must sit at the origin (createCoastTerrain's do): the shader reads positions as world metres.
export function createTerrainStyle(world, { passes = ZONE_SMOOTH_PASSES } = {}) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const data = bakeZoneMasks(world.CL, world.names, world.nx, world.nz, passes);
  const texture = new THREE.DataTexture(data, world.nx, world.nz, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  // Slope map: one half-float per cell. A row is nx * 2 bytes, not a multiple of 4 for odd nx, so tell WebGL (default 4).
  const slopeData = bakeSlopeMap(world.H, world.nx, world.nz, world.pxM);
  const slopeTexture = new THREE.DataTexture(slopeData, world.nx, world.nz, THREE.RedFormat, THREE.HalfFloatType);
  slopeTexture.magFilter = THREE.LinearFilter;
  slopeTexture.minFilter = THREE.LinearFilter;
  slopeTexture.generateMipmaps = false;
  slopeTexture.wrapS = slopeTexture.wrapT = THREE.ClampToEdgeWrapping;
  slopeTexture.colorSpace = THREE.NoColorSpace;
  slopeTexture.unpackAlignment = 2;
  slopeTexture.needsUpdate = true;
  const bakeMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;

  const uniforms = {
    uZones: { value: texture },
    uSlopeMap: { value: slopeTexture },
    uZoneRect: { value: new THREE.Vector4(world.x0, world.z0, 1 / (world.nx * world.pxM), 1 / (world.nz * world.pxM)) },
    uCol: { value: zonePalette() },
    uWet: { value: new THREE.Color().copy(PALETTE.wet) },
    uPale: { value: new THREE.Color().copy(PALETTE.granite2) },
    uHeightScale: { value: world.look.heightScale },
    uEdgeHW: { value: 0 },
    uSlopeHW: { value: 0 },
    uRockOn: { value: 0 },
    uSlopeTan: { value: slopeTanFromDeg(STYLE_DEFAULT.slope) },
    uTerraceStep: { value: 0 },
    uLineOn: { value: 0 },
    uGrainOn: { value: 0 },
  };
  const material = new THREE.MeshLambertMaterial();
  material.color.setScalar(CONFIG.LOOK_ISLAND_BRIGHTNESS);
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_DECL}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_SET}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_DECL}`)
      .replace('#include <color_fragment>', FRAG_COLOR)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${FRAG_NORMAL}`);
  };
  material.customProgramCacheKey = () => 'windward-terrain-style-v1';

  function setStyle(v) {
    uniforms.uEdgeHW.value = edgeHalfWidth(v.soft);
    uniforms.uSlopeHW.value = slopeHalfWidth(v.soft);
    uniforms.uRockOn.value = v.rock ? 1 : 0;
    uniforms.uSlopeTan.value = slopeTanFromDeg(v.slope);
    uniforms.uTerraceStep.value = v.terrace ? v.step : 0;
    uniforms.uLineOn.value = v.line ? 1 : 0;
    uniforms.uGrainOn.value = v.grain ? 1 : 0;
  }
  // Call after island-look.js refreshPalette() (the look panel changed a colour).
  function refreshPalette() {
    uniforms.uCol.value = zonePalette();
    uniforms.uWet.value.copy(PALETTE.wet);
    uniforms.uPale.value.copy(PALETTE.granite2);
    material.color.setScalar(CONFIG.LOOK_ISLAND_BRIGHTNESS);
  }
  setStyle(STYLE_DEFAULT);
  const slopeAt = makeSlopeAt(slopeData, world);
  return { material, texture, slopeTexture, slopeAt, setStyle, refreshPalette, bakeMs, dispose: () => { texture.dispose(); slopeTexture.dispose(); material.dispose(); } };
}

// Bilinear slope (rise/run) at game metres from the baked slope map, the same numbers the shader reads. Outside the window: 0.
export function makeSlopeAt(slope, world) {
  const { nx, nz, pxM, x0, z0 } = world;
  return (x, z) => {
    const fx = (x - x0) / pxM - 0.5;
    const fz = (z - z0) / pxM - 0.5;
    if (fx < 0 || fz < 0 || fx > nx - 1 || fz > nz - 1) return 0;
    const a = Math.min(nx - 2, Math.floor(fx));
    const b = Math.min(nz - 2, Math.floor(fz));
    const u = fx - a;
    const v = fz - b;
    const k = b * nx + a;
    return (slope[k] * (1 - u) + slope[k + 1] * u) * (1 - v) + (slope[k + nx] * (1 - u) + slope[k + nx + 1] * u) * v;
  };
}

// "Is (x, z) painted granite by the steep-ground rule?": the CPU twin of the shader's rule (rock on, slope above the
// threshold, with the soft edge). Trees use it so nothing grows on bare painted rock. values: { rock, slope, soft }.
export function makeGraniteTest(slopeAt, values) {
  if (!values.rock) return () => false;
  const thr = slopeTanFromDeg(values.slope);
  const hw = slopeHalfWidth(values.soft);
  return (x, z) => steepAmount(slopeAt(x, z), thr, hw) > 0.5;
}

// The one call the game needs: swaps the material on every terrain mesh between the current per-vertex paint
// (createCoastTerrain's own material) and the stylised one. terrain = createCoastTerrain()'s result.
// Returns { apply(values), style }. Meshes keep their colour attribute (unused by the stylised material).
export function attachTerrainStyle(terrain, world, values = STYLE_DEFAULT, opts = {}) {
  const style = createTerrainStyle(world, opts);
  const original = terrain.material;
  const meshes = [];
  terrain.group.traverse((o) => { if (o.isMesh) meshes.push(o); });
  function apply(v) {
    style.setStyle(v);
    const m = v.crisp ? style.material : original;
    for (const mesh of meshes) mesh.material = m;
  }
  apply(values);
  // Where the current style paints granite (for trees); rebuilt when apply() changes the style.
  let granite = makeGraniteTest(style.slopeAt, values);
  const hook = { apply: (v) => { granite = makeGraniteTest(style.slopeAt, v); apply(v); }, style, meshes, isGranite: (x, z) => granite(x, z) };
  return hook;
}
