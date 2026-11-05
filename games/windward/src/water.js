// Smooth painted sea (Look Lab port, 2026-11-05 — replaces the W0.7 flat-
// shaded low-poly water; games/windward/DESIGN.md "Look direction").
//
// The surface is still real geometry displaced by the summed sines below, but
// it is shaded as a painting, not as facets: analytic normals from the sines'
// slopes, two soft light bands, colour by depth (turquoise shallows -> mid ->
// deep blue) from the baked island depth map (src/depthmap.js), foam rings
// breathing round every shore plus a white edge at the waterline, and wind
// marks ("gust patches" + faint wind lines, kept out of the shallows). Wave
// motion is unchanged: the same accumulated phases (createWaveState /
// stepWaves) the boat bobs on, so the sea and the boat still agree and wave
// speed never depends on wind strength.
//
// Anything that moves with time is accumulated in JS, never `strength * t` in
// the shader: that product is what made the old sea "wobble very fast" once
// the wind changed (see stepWaves). The wind marks and foam rings follow the
// same rule (stepMarks).
//
// One JS (seaHeightCPU / seaSlopeCPU) / GLSL (seaHeight / seaSlope) pair,
// generated from the same WAVE_COMPONENTS + glslFloat() so they can't drift
// apart — water.test.js checks both.
import * as THREE from '../vendor/three/three.module.js';
import { CONFIG } from './config.js';
import { createDepthTexture, createDeepTexture, depthRect, DEEP_M } from './depthmap.js';

// --- tuning knobs (Felix tunes these by hand) ---------------------------
export const WAVE_AMP = 0.4; // metres, max total displacement at full wind strength (boat ~6m long — stays well clear of swallowing the hull)
export const WAVE_LEN = 12; // metres, dominant wavelength (~2 boat lengths; DESIGN.md target is 1-3x)
export const WAVE_SPEED = 1.2; // rad/s, dominant component's phase speed
// SIZE/SEG raised together (I1, from 320/160) — headless camera-frustum check
// against src/camera.js's actual fixed-camera math (ray-cast every zoom
// 0.5-2.5 x aspect ratios up to 32:9) found the OLD 320m tile's real edge
// entering frame from zoom ~1.5 up, showing background colour through a hard
// seam ~160-183m from the boat — a pre-existing bug, unrelated to any
// island. At SIZE=800 (half-width 400m) no ray in that same sweep ever
// reaches the edge, so it's geometrically unreachable rather than merely
// hidden by timing fog to it.
//
// SEG (I3b, 2026-09-16, shared/ART.md's one-facet-scale rule — target 4m,
// 2-6m acceptable): 4m itself fails water.test.js's aliasing bound (spacing
// must stay < shortestWavelength/2 = 3.6m, WAVE_LEN * 0.6 / 2 — any coarser
// and the wave shader's own geometry can't resolve its shortest summed
// component, reading as jittery/aliased crests instead of a shape). 223 is
// the largest SEG (== smallest facet) that still clears that bound —
// SIZE/223 = 3.587m, the closest this tile can get to 4m while staying
// readable. (Was SEG=256 / 3.125m.)
// 2026-11-05: facet target lowered 4m -> 3m (Felix: triangles too big).
// SIZE/267 = 2.996m, under the 3.6m aliasing bound with room to spare.
// 2026-11-05 (Look Lab): shading is smooth now, so this spacing is only how
// finely the waves are sampled (it must still resolve the shortest wave, per
// water.test.js), not a visible facet size.
export const SEG = 267; // plane subdivisions per side
export const SIZE = 800; // metres per side — boat-centred moving tile (see createWater); sized so its edge never enters the fixed camera's frustum at any zoom/aspect, not to cover "the whole world"
export const WATER_COLOR = 0x2f7fd6; // legacy flat colour; the sea is coloured by depth in the shader now

// Four summed sines, each at its own small angle off the wind axis (so crests
// cross instead of running parallel — see file header) and its own
// wavelength/speed multiplier of the WAVE_LEN/WAVE_SPEED knobs above.
// Weights sum to 1 so WAVE_AMP is the true max combined amplitude.
const WAVE_COMPONENTS = [
  { weight: 0.4, angleOffsetDeg: 0, wavelengthMul: 1.0, speedMul: 1.0, phase: 0 },
  { weight: 0.25, angleOffsetDeg: 32, wavelengthMul: 0.6, speedMul: 1.35, phase: 1.7 },
  { weight: 0.2, angleOffsetDeg: -24, wavelengthMul: 1.4, speedMul: -0.75, phase: 4.2 },
  { weight: 0.15, angleOffsetDeg: 55, wavelengthMul: 0.8, speedMul: 1.9, phase: 2.9 },
];

const DEG = Math.PI / 180;

const TWO_PI = Math.PI * 2;
const freqOf = (c) => (2 * Math.PI) / (WAVE_LEN * c.wavelengthMul);
export const waveSpeedScale = (windStrength) => WAVE_SPEED * (0.4 + 0.6 * windStrength);

// Wave phases (2026-11-05 fix for "the boat and waves wobble very fast once
// the wind increases"). Each component used to be sin(d*freq + t*speed(wind))
// with t = seconds since start: when wind strength changed, the phase jumped
// by t * d(speed) — at 10 minutes in, a normal 10 s gust made the sea at the
// boat cycle ~5 times a second. Turning the wind rotated the whole pattern
// about the world origin, so 400 m out it swept past at ~3 cycles/s.
//
// Now each component keeps an accumulated phase: it advances by speed*dt
// every frame (a speed change only changes how fast it advances), and when
// the wind turns, the phase is corrected so the sea AT THE BOAT doesn't jump
// (the pattern pivots about the boat, not the origin). Phases are wrapped to
// [0, 2pi) so they never lose float32 precision in the shader.
export function createWaveState(windDirRad) {
  return { phases: WAVE_COMPONENTS.map((c) => c.phase), dir: windDirRad };
}
export function stepWaves(state, dt, wind, refX, refZ) {
  const speedScale = waveSpeedScale(wind.strength);
  WAVE_COMPONENTS.forEach((c, i) => {
    const freq = freqOf(c);
    const off = c.angleOffsetDeg * DEG;
    const before = refX * Math.sin(state.dir + off) + refZ * Math.cos(state.dir + off);
    const after = refX * Math.sin(wind.dir + off) + refZ * Math.cos(wind.dir + off);
    let p = state.phases[i] + speedScale * c.speedMul * dt - (after - before) * freq;
    p %= TWO_PI;
    if (p < 0) p += TWO_PI;
    state.phases[i] = p;
  });
  state.dir = wind.dir;
}

// JS mirror of the injected GLSL seaHeight (below), for CPU-side boat bob
// (game.js). `phases` is a wave state's phases (see stepWaves); `windDirRad`
// the wind angle; `x`/`z` world coordinates.
export function seaHeightCPU(x, z, phases, windDirRad, windStrength) {
  const amp = WAVE_AMP * (0.3 + 0.7 * windStrength);
  let h = 0;
  WAVE_COMPONENTS.forEach((c, i) => {
    const angle = windDirRad + c.angleOffsetDeg * DEG;
    const d = x * Math.sin(angle) + z * Math.cos(angle);
    h += amp * c.weight * Math.sin(d * freqOf(c) + phases[i]);
  });
  return h;
}

// GLSL requires a decimal point on every float literal — a bare integer
// (e.g. `angleOffsetDeg: 0`, embedded as `+ 0`) fails to compile. Route
// every generated number through this so the shader source is always valid.
export function glslFloat(n) {
  return Number.isInteger(n) ? `${n}.0` : `${n}`;
}

const PHASE_LANES = ['x', 'y', 'z', 'w'];
const componentTerms = WAVE_COMPONENTS.map((c, i) => {
  const freq = (2 * Math.PI) / (WAVE_LEN * c.wavelengthMul);
  const angleRad = c.angleOffsetDeg * DEG;
  return `  {
    float angle = windDir + ${glslFloat(angleRad)};
    float d = x * sin(angle) + z * cos(angle);
    h += amp * ${glslFloat(c.weight)} * sin(d * ${glslFloat(freq)} + phases.${PHASE_LANES[i]});
  }`;
}).join('\n');

// Exported only for water.test.js, to assert the GLSL literally embeds the
// same WAVE_COMPONENTS-derived terms as seaHeightCPU() above.
export const SEA_HEIGHT_GLSL = `
float seaHeight(float x, float z, vec4 phases, float windDir, float windStrength) {
  float amp = ${glslFloat(WAVE_AMP)} * (0.3 + 0.7 * windStrength);
  float h = 0.0;
${componentTerms}
  return h;
}
`;

// Slope of the sea surface (d height / dx, d height / dz) — the analytic
// derivative of seaHeightCPU, used for smooth normals. `phases` as above.
export function seaSlopeCPU(x, z, phases, windDirRad, windStrength) {
  const amp = WAVE_AMP * (0.3 + 0.7 * windStrength);
  let gx = 0;
  let gz = 0;
  WAVE_COMPONENTS.forEach((c, i) => {
    const angle = windDirRad + c.angleOffsetDeg * DEG;
    const freq = freqOf(c);
    const d = x * Math.sin(angle) + z * Math.cos(angle);
    const k = amp * c.weight * freq * Math.cos(d * freq + phases[i]);
    gx += k * Math.sin(angle);
    gz += k * Math.cos(angle);
  });
  return { x: gx, z: gz };
}

const slopeTerms = WAVE_COMPONENTS.map((c, i) => {
  const freq = (2 * Math.PI) / (WAVE_LEN * c.wavelengthMul);
  const angleRad = c.angleOffsetDeg * DEG;
  return `  {
    float angle = windDir + ${glslFloat(angleRad)};
    float d = x * sin(angle) + z * cos(angle);
    g += amp * ${glslFloat(c.weight)} * ${glslFloat(freq)} * cos(d * ${glslFloat(freq)} + phases.${PHASE_LANES[i]}) * vec2(sin(angle), cos(angle));
  }`;
}).join('\n');

// Exported for water.test.js (same amplitude formula as SEA_HEIGHT_GLSL).
export const SEA_SLOPE_GLSL = `
vec2 seaSlope(float x, float z, vec4 phases, float windDir, float windStrength) {
  float amp = ${glslFloat(WAVE_AMP)} * (0.3 + 0.7 * windStrength);
  vec2 g = vec2(0.0);
${slopeTerms}
  return g;
}
`;

// --- wind marks + foam: accumulated in JS, like the wave phases -------------
// The Look Lab drifted its gust patches with `uTime * (3 + 9 * wind)` — the
// same strength-times-absolute-time shape as the old wobble bug: ten minutes
// in, a gust changing the wind would slide the patches past at hundreds of
// metres a second. Instead the marks live in a "wind frame" (x = along the
// wind, y = across it) plus an offset that is advanced by speed*dt each frame
// and corrected when the wind turns so the pattern AT THE BOAT doesn't jump
// (it pivots about the boat, exactly as stepWaves does for the waves).
export const MARK_DRIFT_BASE = 3; // m/s, gust drift at zero wind (the lab's 3 + 9 * wind)
export const MARK_DRIFT_PER_WIND = 9; // extra m/s at full wind
export const FOAM_RING_RATE = 0.55; // ring cycles per second (the lab's)
export const markDriftSpeed = (windStrength) => MARK_DRIFT_BASE + MARK_DRIFT_PER_WIND * windStrength;

// `wind.dir` is where the wind comes FROM (windArrow.js draws toward dir+PI),
// so downwind is (-sin dir, -cos dir) in (x, z). `across` is that turned 90deg.
export function windFrame(windDirRad, x, z) {
  const wx = -Math.sin(windDirRad);
  const wz = -Math.cos(windDirRad);
  return { along: x * wx + z * wz, across: z * wx - x * wz }; // across = dot((x, z), (-wz, wx))
}

export function createMarkState(windDirRad) {
  return { dir: windDirRad, ox: 0, oy: 0, ring: 0 };
}

// The field coordinate the shader uses at world (x, z): the wind frame plus
// the accumulated offset. Exported so the test can check continuity.
export function markCoord(state, windDirRad, x, z) {
  const f = windFrame(windDirRad, x, z);
  return { x: f.along + state.ox, y: f.across + state.oy };
}

export function stepMarks(state, dt, wind, refX, refZ) {
  // Wind turned: re-pin the offset so the coordinate at the boat is unchanged.
  const before = windFrame(state.dir, refX, refZ);
  const after = windFrame(wind.dir, refX, refZ);
  state.ox += before.along - after.along;
  state.oy += before.across - after.across;
  // Patches slide downwind (+x in the wind frame): content at fixed x moves
  // by lowering the offset, matching `q = p - wdir * drift` in the lab.
  state.ox -= markDriftSpeed(wind.strength) * dt;
  state.ring = (state.ring + FOAM_RING_RATE * dt) % 1;
  state.dir = wind.dir;
}

// --- foam strength follows the wind, smoothly --------------------------------
// Look pass 2: the shore foam is a little weaker when the wind is light. The
// wind strength itself already eases between targets (wind.js), but a guest
// applies it in steps, so the foam reads a further low-passed copy, advanced
// by dt like every other moving thing here (never a function of absolute time).
export const FOAM_MIN = 0.45; // foam strength in a dead calm at FOAM_WIND_AMOUNT = 1
export const FOAM_WIND_SMOOTH_S = 3; // seconds for the filtered wind to close ~63% of a change
export function createFoamWind(strength = 0.5) {
  return { value: strength };
}
export function stepFoamWind(state, dt, strength) {
  state.value += (strength - state.value) * (1 - Math.exp(-dt / FOAM_WIND_SMOOTH_S));
}
function smooth01(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
// 1 = full foam. `amount` 0 = foam ignores the wind, 1 = foam fades to FOAM_MIN in a calm.
export function foamStrength(filteredWind, amount) {
  const windy = FOAM_MIN + (1 - FOAM_MIN) * smooth01(0.1, 0.8, filteredWind);
  return 1 + (windy - 1) * amount;
}

// Shallow colour with the saturation slider applied (0 = grey, 1 = as painted).
export function shallowSrgb(hex, saturation, out = [0, 0, 0]) {
  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  out[0] = Math.min(1, Math.max(0, luma + (r - luma) * saturation));
  out[1] = Math.min(1, Math.max(0, luma + (g - luma) * saturation));
  out[2] = Math.min(1, Math.max(0, luma + (b - luma) * saturation));
  return out;
}
const _sh = [0, 0, 0];
function setSrgb(vec3, hex) {
  vec3.set(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
}

// --- shaders -----------------------------------------------------------------
// The sun used for the painted light bands: the game's sun AZIMUTH but the Look
// Lab's ELEVATION. The lab's two bands (thresholds 0.30 / 0.52 on dot(n, sun))
// were set with a 25 degree sun; the game's own sun is at 10 degrees, where a
// flat sea scores 0.17 and never reaches either band. Island lighting is not
// touched — this only places the painted bands on the waves.
export const WATER_LIGHT_ELEVATION_DEG = 25;

export function waterSunDirection() {
  const az = (CONFIG.LIGHT_AZIMUTH_DEG * Math.PI) / 180;
  const el = (WATER_LIGHT_ELEVATION_DEG * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
}

export const WATER_VERTEX_GLSL = `
uniform vec4 uPhases;
uniform float uWindDir;
uniform float uWindStrength;
uniform vec2 uPlaneOffset;
varying vec3 vWorld;
varying vec2 vGrad;
${SEA_HEIGHT_GLSL}
${SEA_SLOPE_GLSL}
void main() {
  // The mesh only translates (to follow the boat); recover world x/z.
  float wx = position.x + uPlaneOffset.x;
  float wz = position.z + uPlaneOffset.y;
  float h = seaHeight(wx, wz, uPhases, uWindDir, uWindStrength);
  vGrad = seaSlope(wx, wz, uPhases, uWindDir, uWindStrength);
  vWorld = vec3(wx, h, wz);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, h, position.z, 1.0);
}
`;

// Fragment shader: the Look Lab's "Toon + foam" water with "Gusts + lines"
// wind marks (ref/look-lab.html), same colours and thresholds. Differences
// from the lab, all deliberate: the wave normals come from the game's waves;
// foam reads the baked SHORE distance (see depthmap.js) rather than raw depth;
// wind marks and foam rings advance from JS-accumulated state; hash noise has
// no sin() (stable at large coordinates and across GPUs); the haze colour is
// given in display values so it matches the fog on meshes.
export const WATER_FRAGMENT_GLSL = `
uniform sampler2D uDepth;
uniform vec4 uDepthRect;
uniform vec3 uSun;
uniform float uWind;
uniform float uWindDir;
uniform vec2 uMarkOffset;
uniform float uRingPhase;
uniform vec3 uCam;
uniform vec3 uHazeColor;
uniform vec2 uHazeRange;
uniform float uHazeStrength;
uniform vec3 uDeep;
uniform vec3 uMid;
uniform vec3 uShallow;
uniform vec3 uFoam;
uniform float uSeaBright;
uniform float uFoamK;
varying vec3 vWorld;
varying vec2 vGrad;

float h21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vn(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
  // Baked depth (R, metres) and shore distance (G, lab-scaled). Outside the
  // baked rectangle there are no islands: deep.
  vec2 uv = (vWorld.xz - uDepthRect.xy) / uDepthRect.zw;
  vec2 ds = texture2D(uDepth, uv).rg;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) ds = vec2(${glslFloat(DEEP_M)});
  float depth = ds.r;
  float shore = ds.g;

  vec3 deep = uDeep;
  vec3 mid = uMid;
  vec3 shallow = uShallow;
  vec3 n = normalize(vec3(-vGrad.x, 1.0, -vGrad.y));
  vec3 col = mix(shallow, mid, smoothstep(0.3, 3.5, depth));
  col = mix(col, deep, smoothstep(3.5, 9.0, depth));
  // painted light: two soft bands instead of a smooth gradient
  float lit = dot(n, uSun);
  float band = smoothstep(0.30, 0.36, lit) * 0.10 + smoothstep(0.52, 0.58, lit) * 0.10;
  col *= (0.86 + band) * uSeaBright;

  // shore foam: rings drifting off the land, plus a white edge at the waterline
  float ring = smoothstep(0.80, 0.86, fract(shore * 2.4 - uRingPhase)) * (1.0 - smoothstep(0.0, 1.6, shore));
  float edge = 1.0 - smoothstep(0.05, 0.35, shore);
  col = mix(col, uFoam, clamp(max(ring * 0.85, edge), 0.0, 1.0) * uFoamK);

  // wind marks, in the wind frame (x along the wind, y across it); kept out of the shallows
  vec2 wdir = vec2(-sin(uWindDir), -cos(uWindDir));
  vec2 perp = vec2(-wdir.y, wdir.x);
  vec2 c = vec2(dot(vWorld.xz, wdir), dot(vWorld.xz, perp)) + uMarkOffset;
  float open = smoothstep(1.2, 3.0, depth);
  // gust patches: darker, finely ruffled areas sliding across the sea
  float g = vn(c * 0.018) * 0.65 + vn(c * 0.041) * 0.35;
  float patchy = smoothstep(0.52, 0.68, g) * smoothstep(0.1, 0.6, uWind) * open;
  float ruffle = 0.5 + 0.5 * sin(c.y * 2.3 + vn(c * 0.3) * 4.0);
  col = mix(col, col * vec3(0.62, 0.74, 0.90), patchy * (0.7 + 0.3 * ruffle));
  // wind lines: long thin pale lines along the wind
  float across = c.y * 0.11 + vn(c * 0.01) * 3.0;
  float line = smoothstep(0.965, 0.995, sin(across * 6.2831));
  float seg = smoothstep(0.45, 0.7, vn(vec2(c.x * 0.02, across * 0.6)));
  col = mix(col, vec3(0.92, 0.97, 1.0), line * seg * smoothstep(0.1, 0.6, uWind) * 0.15 * open);

  // golden distance haze (the meshes get scene.fog in the same colour)
  float dist = length(vWorld - uCam);
  col = mix(col, uHazeColor, uHazeStrength * smoothstep(uHazeRange.x, uHazeRange.y, dist));
  gl_FragColor = vec4(col, 1.0);
}
`;

const _hazeSrgb = { r: 0, g: 0, b: 0 };

// `depthMap`: a bakeDepthMap() result, or null (island-lab: no islands baked,
// the whole sea reads as deep).
export function createWater(depthMap = null) {
  // Bake the flat-to-horizontal rotation into the geometry itself (not the
  // mesh transform), so `position.y` is already the height axis and
  // `position.x`/`position.z` are world-aligned horizontal axes — the mesh
  // itself only translates (to follow the boat), it never rotates.
  const geometry = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geometry.rotateX(-Math.PI / 2);

  const depthTexture = depthMap ? createDepthTexture(depthMap) : createDeepTexture();
  const rect = depthMap ? depthRect(depthMap) : [0, 0, 1, 1];
  new THREE.Color(CONFIG.HAZE_COLOR).getRGB(_hazeSrgb, THREE.SRGBColorSpace);

  const uniforms = {
    uPhases: { value: new THREE.Vector4() },
    uWindDir: { value: 0 },
    uWindStrength: { value: 0.5 },
    // World-space (x, z) of the plane mesh's current position. The plane
    // follows the boat and is repositioned in whole vertex-spacing steps
    // (see update() below) so the same lattice always samples the same
    // world points frame-to-frame; adding this offset to the local vertex
    // position recovers true world coordinates so the displayed surface
    // matches seaHeightCPU()'s bob/tilt for the boat exactly.
    uPlaneOffset: { value: new THREE.Vector2(0, 0) },
    uDepth: { value: depthTexture },
    uDepthRect: { value: new THREE.Vector4(rect[0], rect[1], rect[2], rect[3]) },
    uSun: { value: waterSunDirection() },
    uWind: { value: 0.5 },
    uMarkOffset: { value: new THREE.Vector2() },
    uRingPhase: { value: 0 },
    uCam: { value: new THREE.Vector3() },
    uHazeColor: { value: new THREE.Vector3(_hazeSrgb.r, _hazeSrgb.g, _hazeSrgb.b) },
    uHazeRange: { value: new THREE.Vector2(1e6, 2e6) },
    uHazeStrength: { value: 0 },
    uDeep: { value: new THREE.Vector3() },
    uMid: { value: new THREE.Vector3() },
    uShallow: { value: new THREE.Vector3() },
    uFoam: { value: new THREE.Vector3() },
    uSeaBright: { value: 1 },
    uFoamK: { value: 1 },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: WATER_VERTEX_GLSL, fragmentShader: WATER_FRAGMENT_GLSL });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = false; // the painted sea takes no cast shadows (as in the lab)

  const spacing = SIZE / SEG;
  let marks = null;
  let foamWind = null;

  // waveState: from createWaveState/stepWaves, shared with the boat bob.
  // `dt` advances the wind marks and foam; `cameraPosition` (optional) sets
  // the haze distances, which scale with the camera-to-boat distance so the
  // haze looks the same at every zoom.
  function update(waveState, wind, boatPosition, dt = 0, cameraPosition = null) {
    const snappedX = Math.round(boatPosition.x / spacing) * spacing;
    const snappedZ = Math.round(boatPosition.z / spacing) * spacing;
    mesh.position.set(snappedX, 0, snappedZ);

    if (!marks) marks = createMarkState(wind.dir);
    stepMarks(marks, dt, wind, boatPosition.x, boatPosition.z);

    // Paint, read live from CONFIG so the ?tune=1 panel can change it.
    setSrgb(uniforms.uDeep.value, CONFIG.LOOK_SEA_DEEP);
    setSrgb(uniforms.uMid.value, CONFIG.LOOK_SEA_MID);
    shallowSrgb(CONFIG.LOOK_SEA_SHALLOW, CONFIG.LOOK_SHALLOW_SAT, _sh);
    uniforms.uShallow.value.set(_sh[0], _sh[1], _sh[2]);
    setSrgb(uniforms.uFoam.value, CONFIG.LOOK_FOAM);
    uniforms.uSeaBright.value = CONFIG.LOOK_SEA_BRIGHTNESS;
    if (!foamWind) foamWind = createFoamWind(wind.strength);
    stepFoamWind(foamWind, dt, wind.strength);
    uniforms.uFoamK.value = foamStrength(foamWind.value, CONFIG.LOOK_FOAM_WIND_AMOUNT);
    new THREE.Color(CONFIG.HAZE_COLOR).getRGB(_hazeSrgb, THREE.SRGBColorSpace);
    uniforms.uHazeColor.value.set(_hazeSrgb.r, _hazeSrgb.g, _hazeSrgb.b);

    uniforms.uPhases.value.fromArray(waveState.phases);
    uniforms.uWindDir.value = wind.dir;
    uniforms.uWindStrength.value = wind.strength;
    uniforms.uWind.value = wind.strength;
    uniforms.uPlaneOffset.value.set(snappedX, snappedZ);
    uniforms.uMarkOffset.value.set(marks.ox, marks.oy);
    uniforms.uRingPhase.value = marks.ring;

    if (cameraPosition) {
      const camDist = Math.hypot(cameraPosition.x - boatPosition.x, (cameraPosition.y ?? 0) - (boatPosition.y ?? 0), cameraPosition.z - boatPosition.z);
      uniforms.uCam.value.set(cameraPosition.x, cameraPosition.y ?? 0, cameraPosition.z);
      uniforms.uHazeRange.value.set(camDist * CONFIG.HAZE_WATER_NEAR_MUL, camDist * CONFIG.HAZE_WATER_FAR_MUL);
      uniforms.uHazeStrength.value = CONFIG.HAZE_WATER_STRENGTH;
    }
  }

  return { mesh, update, depthTexture };
}
