// Sea-mark meshes (stage 1d groundwork): the buoys, beacons and lights from assets/coast/seamarks.json as low-poly
// flat-Lambert objects in the game's style (shared/ART.md: flat shading, no outlines, no specular, one vertex-coloured
// mesh per mark so 200 marks stay cheap). Nothing here is wired into game.js yet.
//
//   const m = createSeamarkMesh(spec, { night })   // spec = one row of seamarks.json (or { type:'leading', role:'front'|'rear' })
//   scene.add(m.group); m.group.position.set(x, 0, z);
//   every frame:  m.step(timeSeconds, { seaY })     // buoys bob; at night a lit mark blinks in its real rhythm
//   m.setNight(true)
//
// Sizes are in game metres at the BOAT's scale (a koster is 8 m), not the 1:10 coast scale: a real spar buoy is ~4 m
// above the water, which is what the boat sees. Colours follow IALA A (Sweden): red can = port, green cone =
// starboard, cardinals by band order (N black/yellow, E black/yellow/black, S yellow/black, W yellow/black/yellow) with
// the topmark cones of shared ref/cardinal-marks.png. Invented harbour-mouth marks (invented: true) are built exactly
// like real ones: only the chart / debug view tells them apart (Felix, 2026-11-06).
//
// Lights are EMISSIVE ONLY (a lamp mesh + a soft additive halo sprite): no PointLight, because a new light recompiles
// every material in the scene (a hitch on phones). By day the lamp is a dull lens. Sector lights (light_minor with
// several sectors) blink their first light; the sector colours are not modelled.
//
// Credit: the positions and light characters come from OpenStreetMap, (c) OpenStreetMap contributors, ODbL 1.0.
import * as THREE from '../vendor/three/three.module.js';

export const OSM_CREDIT = '© OpenStreetMap contributors (ODbL 1.0)';
export const OSM_CREDIT_URL = 'https://www.openstreetmap.org/copyright';

// ---- palette: ART.md buoy floats (0xff5533 / 0xffcc33) and pole 0x333333, pulled a little toward the Skagen pastels ----
export const MARK_COLOURS = {
  red: 0xe2523a, green: 0x4fae6a, yellow: 0xffcc33, black: 0x2b2d33, white: 0xf4f1e8, pole: 0x333333,
  stone: 0x776f64, // ART.md rocks
  falu: 0xd2432c, // falu red, as the houses
  roof: 0x6b6672,
};
const LAMP = { // lens colour [off, on]
  white: [0x6e6a5c, 0xfff1c0], red: [0x7a3a30, 0xff5a48], green: [0x2f6a45, 0x5af58a], yellow: [0x8a7a30, 0xffd84a],
};
const lampKey = (c) => (LAMP[c] ? c : 'white');

// ---- light rhythms (pure: testable without a GPU) ----------------------------------------------------------------
// light = { character: 'Fl'|'Q'|'VQ'|'LFl'|'Iso'|'Oc'|'F'|'Al'|'Q+LFl', group?, period? } as in seamarks.json lights[].
// Returns { period, flashes: [[on, off], ...] } in seconds. Timings are the usual chart ones, rounded:
//   Q (quick, 60/min): 0.3 s on every 1 s     VQ (very quick, 120/min): 0.15 s every 0.5 s
//   Fl: 0.5 s on, flashes 1.5 s apart          LFl: a 2 s flash      Iso: half on, half off    Oc: dark 1 s per period
//   "Q+LFl" (south cardinals): the quick group, then one long flash
export function lightPattern(light) {
  const ch = light.character ?? 'F';
  const group = Math.max(1, light.group ?? 1);
  const flashes = [];
  let end = 0;
  const addGroup = (on, spacing) => { for (let i = 0; i < group; i++) { flashes.push([i * spacing, i * spacing + on]); } end = (group - 1) * spacing + on; };
  let period = light.period;
  if (ch === 'F') return { period: 1, flashes: [[0, 1]], steady: true };
  if (ch === 'Q' || ch === 'Q+LFl') {
    addGroup(0.3, 1.0);
    if (ch === 'Q+LFl') { flashes.push([end + 1.0, end + 3.0]); end += 3.0; }
    period = period ?? (group > 1 ? end + 1 : 1);
  } else if (ch === 'VQ') { addGroup(0.15, 0.5); period = period ?? (group > 1 ? end + 0.5 : 0.5); }
  else if (ch === 'LFl') { addGroup(2.0, 4.0); period = period ?? end + 2; }
  else if (ch === 'Iso') { period = period ?? 4; flashes.push([0, period / 2]); }
  else if (ch === 'Oc') { period = period ?? 4; flashes.push([0, Math.max(0.5, period - 1 * group)]); }
  else { addGroup(0.5, 1.5); period = period ?? (group > 1 ? end + 1.5 : 3); } // Fl and anything unknown
  return { period, flashes };
}
export function lightIsOn(light, t) {
  const { period, flashes, steady } = lightPattern(light);
  if (steady) return true;
  const u = ((t % period) + period) % period;
  for (const [a, b] of flashes) if (u >= a && u < b) return true;
  return false;
}
const hash01 = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return ((h >>> 0) % 100000) / 100000; };

// ---- topmarks (ref/cardinal-marks.png): the two cones of each cardinal, lower then upper, apex direction ------------
export const CARDINAL_TOPMARKS = {
  north: ['up', 'up'], // two cones up
  east: ['down', 'up'], // base to base (a diamond)
  south: ['down', 'down'], // two cones down
  west: ['up', 'down'], // point to point (an hourglass)
};
export const CARDINAL_BANDS = { north: ['black', 'yellow'], east: ['black', 'yellow', 'black'], south: ['yellow', 'black'], west: ['yellow', 'black', 'yellow'] };

// ---- a tiny triangle builder: per-triangle colour, flat normals ----------------------------------------------------
class Builder {
  constructor() { this.pos = []; this.col = []; this.tris = 0; }
  tri(a, b, c, hex) {
    const k = new THREE.Color(hex);
    this.pos.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) this.col.push(k.r, k.g, k.b);
    this.tris += 1;
  }
  quad(a, b, c, d, hex) { this.tri(a, b, c, hex); this.tri(a, c, d, hex); }
  ring(y, r, sides, cx = 0, cz = 0, rot = 0) {
    const out = [];
    for (let i = 0; i < sides; i++) { const a = rot + (i / sides) * Math.PI * 2; out.push([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r]); }
    return out;
  }
  // A tapered prism with `sides` faces from y0 (radius r0) to y1 (radius r1); capTop closes it.
  prism(y0, y1, r0, r1, sides, hex, { capTop = false, capBottom = false, cx = 0, cz = 0, rot = 0 } = {}) {
    const lo = this.ring(y0, r0, sides, cx, cz, rot), hi = this.ring(y1, r1, sides, cx, cz, rot);
    for (let i = 0; i < sides; i++) { const j = (i + 1) % sides; this.quad(lo[i], lo[j], hi[j], hi[i], hex); }
    if (capTop && r1 > 0) { const c = [cx, y1, cz]; for (let i = 0; i < sides; i++) this.tri(hi[i], hi[(i + 1) % sides], c, hex); }
    if (capBottom && r0 > 0) { const c = [cx, y0, cz]; for (let i = 0; i < sides; i++) this.tri(lo[(i + 1) % sides], lo[i], c, hex); }
  }
  // A cone: base at yBase (radius r), apex at yApex (below the base = apex down). Base closed.
  cone(yBase, yApex, r, sides, hex, cx = 0, cz = 0) {
    const base = this.ring(yBase, r, sides, cx, cz), apex = [cx, yApex, cz];
    for (let i = 0; i < sides; i++) this.tri(base[i], base[(i + 1) % sides], apex, hex);
    const c = [cx, yBase, cz];
    for (let i = 0; i < sides; i++) this.tri(base[(i + 1) % sides], base[i], c, hex);
  }
  octa(cx, cy, cz, r, hex) {
    const t = [cx, cy + r, cz], b = [cx, cy - r, cz];
    const e = [[cx + r, cy, cz], [cx, cy, cz + r], [cx - r, cy, cz], [cx, cy, cz - r]];
    for (let i = 0; i < 4; i++) { this.tri(e[i], e[(i + 1) % 4], t, hex); this.tri(e[(i + 1) % 4], e[i], b, hex); }
  }
  box(cx, cy, cz, sx, sy, sz, hex, rotZ = 0) {
    const c = Math.cos(rotZ), s = Math.sin(rotZ);
    const p = (x, y, z) => [cx + x * c - y * s, cy + x * s + y * c, cz + z];
    const [x0, x1, y0, y1, z0, z1] = [-sx / 2, sx / 2, -sy / 2, sy / 2, -sz / 2, sz / 2];
    const v = [p(x0, y0, z0), p(x1, y0, z0), p(x1, y1, z0), p(x0, y1, z0), p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1)];
    for (const f of [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]]) this.quad(v[f[0]], v[f[1]], v[f[2]], v[f[3]], hex);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals(); // non-indexed: one normal per triangle = flat shading
    return g;
  }
}

let BODY_MATERIAL;
const bodyMaterial = () => (BODY_MATERIAL ??= new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }));

let glowTexture;
function getGlowTexture() { // a soft radial falloff, drawn once (browser only; node has no canvas)
  if (glowTexture !== undefined) return glowTexture;
  glowTexture = null;
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    if (g) {
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.3, 'rgba(255,255,255,0.5)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      glowTexture = new THREE.CanvasTexture(c);
    }
  }
  return glowTexture;
}

// ---- which mesh a seamarks.json row becomes -------------------------------------------------------------------------
export function variantOf(spec) {
  const form = spec.form === 'beacon' ? 'beacon' : 'buoy';
  switch (spec.type) {
    case 'lateral': return { name: spec.side === 'starboard' ? 'starboard-cone' : 'port-can', form };
    case 'cardinal': return { name: `cardinal-${(spec.direction ?? 'north')[0].toUpperCase()}`, form, direction: spec.direction ?? 'north' };
    case 'isolated_danger': return { name: 'isolated-danger', form };
    case 'special': return { name: 'special', form };
    case 'safe_water': return { name: 'safe-water', form };
    case 'light': return { name: 'lit-beacon', form: 'beacon' };
    case 'leading': return { name: spec.role === 'rear' ? 'leading-rear' : 'leading-front', form: 'beacon' };
    default: throw new Error(`unknown sea-mark type "${spec.type}"`);
  }
}

// bands from top to bottom, as colour names
function bandsFor(v, spec) {
  if (v.name.startsWith('cardinal')) return CARDINAL_BANDS[v.direction];
  if (v.name === 'isolated-danger') return ['black', 'red', 'black'];
  if (v.name === 'special') return ['yellow'];
  if (v.name === 'safe-water') return ['red', 'white', 'red', 'white'];
  if (v.name === 'port-can') return ['red'];
  if (v.name === 'starboard-cone') return ['green'];
  if (v.name === 'lit-beacon') return ['white'];
  return ['white'];
}

// build the body; returns { builder, lampY } (lampY = where an emissive lamp sits, or null)
function buildBody(spec, v, lit) {
  const b = new Builder();
  const beacon = v.form === 'beacon';
  const col = (n) => MARK_COLOURS[n] ?? MARK_COLOURS.white;
  const bands = bandsFor(v, spec);
  let top;
  const SIDES = 6;

  // --- foot: a float (buoys) or a little cairn (beacons) ---
  const footColour = col(bands[bands.length - 1]);
  if (beacon) {
    b.octa(0, 0.15, 0, 0.8, MARK_COLOURS.stone); b.octa(0.7, 0.05, 0.35, 0.5, MARK_COLOURS.stone); b.octa(-0.55, 0.05, -0.45, 0.55, MARK_COLOURS.stone);
  } else if (v.name === 'starboard-cone') {
    b.prism(-0.4, 0.75, 1.0, 0.36, SIDES, footColour, { capTop: true }); // conical float
  } else if (v.name === 'port-can') {
    b.prism(-0.4, 0.6, 0.8, 0.8, SIDES, footColour, { capTop: true }); // cylindrical can float
  } else {
    b.prism(-0.4, 0.5, 0.95, 0.6, SIDES, footColour, { capTop: true }); // pillar-buoy skirt
  }

  // --- the mast, in colour bands (top to bottom) ---
  const mastY0 = beacon ? 0.5 : 0.5, mastTop = v.name === 'lit-beacon' ? 3.4 : v.name.startsWith('leading') ? (v.name === 'leading-rear' ? 4.6 : 2.8) : v.name.startsWith('cardinal') || v.name === 'isolated-danger' || v.name === 'safe-water' ? 3.4 : 3.1;
  const r0 = beacon ? 0.26 : 0.3, r1 = beacon ? 0.18 : 0.22;
  const n = bands.length;
  const radAt = (y) => r0 + (r1 - r0) * ((y - mastY0) / (mastTop - mastY0));
  for (let i = 0; i < n; i++) {
    const yHi = mastTop - (i * (mastTop - mastY0)) / n, yLo = mastTop - ((i + 1) * (mastTop - mastY0)) / n;
    b.prism(yLo, yHi, radAt(yLo), radAt(yHi), beacon ? 5 : SIDES, col(bands[i]), { capTop: i === 0 });
  }
  top = mastTop;

  // --- topmarks ---
  if (v.name === 'port-can') { b.prism(top + 0.05, top + 0.6, 0.32, 0.32, SIDES, MARK_COLOURS.red, { capTop: true, capBottom: true }); top += 0.6; }
  else if (v.name === 'starboard-cone') { b.cone(top + 0.05, top + 0.8, 0.4, SIDES, MARK_COLOURS.green); top += 0.8; }
  else if (v.name.startsWith('cardinal')) {
    const [lower, upper] = CARDINAL_TOPMARKS[v.direction];
    const h = 0.9, gap = 0.1, r = 0.62; // big on purpose: from the game's high camera a small cone is just a dark lump
    const put = (y0, dir) => (dir === 'up' ? b.cone(y0, y0 + h, r, SIDES, MARK_COLOURS.black) : b.cone(y0 + h, y0, r, SIDES, MARK_COLOURS.black));
    put(top + 0.12, lower); put(top + 0.12 + h + gap, upper);
    top += 0.12 + 2 * h + gap;
  } else if (v.name === 'isolated-danger') { b.octa(0, top + 0.42, 0, 0.36, MARK_COLOURS.black); b.octa(0, top + 1.12, 0, 0.36, MARK_COLOURS.black); top += 1.5; }
  else if (v.name === 'special') { b.box(0, top + 0.4, 0, 0.12, 0.95, 0.12, MARK_COLOURS.yellow, Math.PI / 4); b.box(0, top + 0.4, 0, 0.12, 0.95, 0.12, MARK_COLOURS.yellow, -Math.PI / 4); top += 0.9; }
  else if (v.name === 'safe-water') { b.octa(0, top + 0.45, 0, 0.42, MARK_COLOURS.red); top += 0.9; }
  else if (v.name === 'lit-beacon') {
    b.box(0, top + 0.06, 0, 1.1, 0.12, 1.1, MARK_COLOURS.pole); // platform
    b.box(0, top + 0.3, 0, 0.7, 0.36, 0.7, MARK_COLOURS.falu); // lamp house
    // pyramid roof
    const a = [0.45, top + 0.48, 0.45], bb = [-0.45, top + 0.48, 0.45], c = [-0.45, top + 0.48, -0.45], d = [0.45, top + 0.48, -0.45], ap = [0, top + 0.95, 0];
    b.tri(a, bb, ap, MARK_COLOURS.roof); b.tri(bb, c, ap, MARK_COLOURS.roof); b.tri(c, d, ap, MARK_COLOURS.roof); b.tri(d, a, ap, MARK_COLOURS.roof);
    top += 0.95;
  } else if (v.name.startsWith('leading')) {
    // a flat triangular daymark: white border, falu-red field; the rear one is bigger and higher
    const s = v.name === 'leading-rear' ? 1.5 : 1.1, y0 = top - 0.1;
    const tri = (k, hex, z) => b.tri([-s * k, y0, z], [s * k, y0, z], [0, y0 + s * 1.6 * k, z], hex);
    tri(1, MARK_COLOURS.white, 0.02); tri(0.68, MARK_COLOURS.falu, 0.04);
    tri(1, MARK_COLOURS.white, -0.02); tri(0.68, MARK_COLOURS.falu, -0.04);
    top = y0 + s * 1.6;
  }

  // --- a lamp (emissive) for a lit mark ---
  let lampY = null;
  if (lit) {
    lampY = v.name === 'lit-beacon' ? top - 0.65 : top + 0.22;
  }
  return { b, lampY, height: top };
}

// ---- the mark object -----------------------------------------------------------------------------------------------
export function createSeamarkMesh(spec, { night = false } = {}) {
  const v = variantOf(spec);
  const lights = spec.lights ?? [];
  const light = lights.find((l) => l.character) ?? null;
  const lit = !!light || spec.type === 'light';
  const group = new THREE.Group();
  group.name = `seamark-${v.name}`;
  const { b, lampY, height } = buildBody(spec, v, lit);
  const body = new THREE.Mesh(b.geometry(), bodyMaterial());
  body.name = 'mark-body';
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  let lamp = null, halo = null, lampMat = null, haloMat = null, key = 'white';
  const phase = hash01(spec.id ?? `${spec.lat},${spec.lon}`);
  if (lit && lampY !== null) {
    key = lampKey(light?.colour?.split(';')[0] ?? 'white');
    lampMat = new THREE.MeshBasicMaterial({ color: LAMP[key][0], toneMapped: false });
    lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), lampMat);
    lamp.name = 'mark-lamp';
    lamp.position.y = lampY;
    haloMat = new THREE.SpriteMaterial({ map: getGlowTexture(), color: LAMP[key][1], transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    halo = new THREE.Sprite(haloMat);
    halo.name = 'mark-halo';
    halo.scale.setScalar(5);
    halo.position.y = lampY;
    halo.visible = false;
    group.add(lamp, halo);
  }

  const bobs = v.form === 'buoy';
  const period = 3 + 1.6 * hash01((spec.id ?? '') + 'b'); // seconds: each buoy rocks at its own pace
  const bobPhase = hash01((spec.id ?? '') + 'p') * Math.PI * 2;
  let isNight = !!night;
  const api = {
    group, type: spec.type, variant: v.name, form: v.form, bobs, lit, light, height,
    triangles: b.tris, lampLit: false,
    setNight(on) { isNight = !!on; if (!isNight) api.step(0); },
    // t in seconds. opts.seaY: the sea height under the mark (seaHeightCPU), so it rides the real waves.
    step(t, { seaY = null } = {}) {
      if (bobs) {
        const sea = seaY ?? 0.07 * Math.sin((t / period) * Math.PI * 2 + bobPhase);
        group.position.y = sea;
        group.rotation.x = 0.045 * Math.sin((t / period) * Math.PI * 2 + bobPhase + 1.3);
        group.rotation.z = 0.045 * Math.sin((t / (period * 1.3)) * Math.PI * 2 + bobPhase);
      }
      if (lamp) {
        const on = isNight && !!light && lightIsOn(light, t + phase * lightPattern(light).period);
        api.lampLit = on;
        lampMat.color.setHex(on ? LAMP[key][1] : (isNight ? LAMP[key][0] : LAMP[key][0]));
        halo.visible = on;
      }
    },
    dispose() { group.traverse((o) => { o.geometry?.dispose(); if (o !== body) o.material?.dispose?.(); }); },
  };
  api.step(0);
  return api;
}

// Everything 1d needs to list: every variant name, so a lab or test can build one of each.
export const MARK_SAMPLES = [
  { id: 's:port', type: 'lateral', side: 'port', form: 'buoy', colours: ['red'] },
  { id: 's:starboard', type: 'lateral', side: 'starboard', form: 'buoy', colours: ['green'] },
  { id: 's:N', type: 'cardinal', direction: 'north', form: 'buoy', colours: ['black', 'yellow'] },
  { id: 's:E', type: 'cardinal', direction: 'east', form: 'buoy', colours: ['black', 'yellow', 'black'], lights: [{ character: 'Q', group: 3, period: 10, colour: 'white', text: 'Q(3) W 10s' }] },
  { id: 's:S', type: 'cardinal', direction: 'south', form: 'buoy', colours: ['yellow', 'black'] },
  { id: 's:W', type: 'cardinal', direction: 'west', form: 'buoy', colours: ['yellow', 'black', 'yellow'], lights: [{ character: 'Q', group: 9, period: 15, colour: 'white', text: 'Q(9) W 15s' }] },
  { id: 's:danger', type: 'isolated_danger', form: 'beacon', colours: ['black'] },
  { id: 's:special', type: 'special', form: 'buoy', colours: ['yellow'] },
  { id: 's:lit', type: 'light', form: 'light', lights: [{ character: 'Fl', group: 2, period: 6, colour: 'green', text: 'Fl(2) G 6s' }] },
  { id: 's:lead-front', type: 'leading', role: 'front', form: 'beacon' },
  { id: 's:lead-rear', type: 'leading', role: 'rear', form: 'beacon' },
];
