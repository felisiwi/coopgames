// Era assets (Era Asset Lab, docs/era-assets/README.md): two low-poly kits to make the coast busy.
//
//   TODAY  modern sailboat, small motorboat, the Lysekil-Fiskebackskil passenger ferry, a guest harbour with moored rows,
//          a painted summer house.
//   1700   poor fishermen's cottages, a boathouse, fish-drying racks, a stone cairn (kummel), a painted rock sea mark,
//          small working ekas with spritsails, one larger square-sail cargo / fishing boat.
//   plus   two small harbours (same shore, one per kit) for the Today vs 1700 comparison.
//
// Style (shared/ART.md): flat Lambert, Skagen pastels, no outlines, no textures, no new lights. Windows are the only
// "emissive" thing: unlit MeshBasicMaterial quads that turn warm at dusk (setNight) - the same trick as boats.js's lantern.
//
// Every asset is an add-function  addX(S, G, opts)  that writes triangles into two shared Meshers: S (opaque, vertex colours)
// and G ({ on, off }: lit and unlit window glass). createAsset() wraps one asset into a THREE.Group; the harbours stamp many
// assets into one pair of Meshers, so a whole harbour is 3 meshes. Local frame: y up, the waterline is y = 0, boats point +Z.
//
// Nothing here is used by the game yet (new files only); era-asset-lab.html is the viewer.
import * as THREE from '../vendor/three/three.module.js';

// ---- palette (Skagen pastels; ART.md) ----------------------------------------------------------------
const C = {
  white: 0xf4f2ea, sailWhite: 0xf7f4ec, genoa: 0xefece2, trim: 0xf6f3ec, teak: 0xd9c3a0, teakDark: 0xc3a982, antifoul: 0x6d5a64,
  navy: 0x6f8fb3, coral: 0xe39a8a, sage: 0x9fbf9c, sand: 0xe0c48e, grey: 0xdfe3e6, charcoal: 0x4a4d57, orange: 0xea9a68,
  silver: 0xd9dcd8, wood: 0xb8a183, woodDark: 0x8c7658, rail: 0xeadfc8,
  granite: 0xe3c9c1, graniteDk: 0xb7a3b3, granitePale: 0xf1e1db, wet: 0x8e8197, meadow: 0xb9cf8f, meadow2: 0x9fbf7a, stone: 0xa89ca6,
  slate: 0x7b7a8c, tile: 0x7f736b, // tile: old, mossed grey-brown clay tile (was a bright red 0xb4685a: poor 1700 cottages were bare grey timber, nothing painted red)
   turf: 0x879a68, turf2: 0x9aaa72, timber: 0x9b958a, tar: 0x54453b, tar2: 0x4b3d34, tar3: 0x3a2f27,
  door: 0x5f4d3e, chest: 0x7d5b3f, net: 0x7d8a7a, fishA: 0xcdd2cf, fishB: 0xb5a888, paint: 0xf6f1e6,
};
const GLASS = {
  today: { day: 0xa9c0d0, lit: 0xffd9a0, off: 0x38425c },
  y1950: { day: 0x8f9fa2, lit: 0xffcf88, off: 0x353b4f }, // old panes: warm paraffin / early electric light
  y1700: { day: 0x5a5148, lit: 0xf0b25c, off: 0x2e2a2c },
};

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const colorCache = new Map();
const toColor = (c) => {
  if (c == null) return toColor(0xffffff); // glass: coloured by its material, so a neutral stands in
  if (c.isColor) return c;
  if (!colorCache.has(c)) colorCache.set(c, new THREE.Color(c));
  return colorCache.get(c);
};
const shade = (hex, f) => toColor(hex).clone().multiplyScalar(f);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

function rngOf(seed) { // mulberry32: same seed, same stones
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---- Mesher: coloured triangles, with a transform stack so one asset can be stamped anywhere --------------------------
export class Mesher {
  constructor() { this.pos = []; this.col = []; this.mat = null; this.v = new THREE.Vector3(); this.peers = []; }
  get triangles() { return this.pos.length / 9; }
  // Run fn with everything inside moved / turned / scaled: p position, ry/rx/rz radians, s number or [sx, sy, sz].
  at({ p = [0, 0, 0], ry = 0, rx = 0, rz = 0, s = 1 }, fn) {
    const sc = Array.isArray(s) ? s : [s, s, s];
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(...sc));
    // peers (the window glass meshers) move with this one, so a window placed inside at() lands on its wall
    const all = [this, ...this.peers];
    const prevs = all.map((x) => x.mat);
    all.forEach((x, i) => { x.mat = prevs[i] ? prevs[i].clone().multiply(m) : m; });
    fn(this);
    all.forEach((x, i) => { x.mat = prevs[i]; });
  }
  tri(a, b, c, color) {
    const k = toColor(color);
    for (const q of [a, b, c]) {
      this.v.set(q[0], q[1], q[2]);
      if (this.mat) this.v.applyMatrix4(this.mat);
      this.pos.push(this.v.x, this.v.y, this.v.z);
      this.col.push(k.r, k.g, k.b);
    }
  }
  quad(a, b, c, d, color) { this.tri(a, b, c, color); this.tri(a, c, d, color); }
  // Axis-aligned box, 10 triangles (no floor: nothing here is seen from below). full = true adds the floor.
  box(cx, cy, cz, sx, sy, sz, color, full = false) {
    const [x0, x1, y0, y1, z0, z1] = [cx - sx / 2, cx + sx / 2, cy - sy / 2, cy + sy / 2, cz - sz / 2, cz + sz / 2];
    this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], color);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], color);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], color);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], color);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], color);
    if (full) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], color);
  }
  // A tapered tube between two points with `sides` flat faces.
  tube(p0, p1, r0, r1, sides, color) {
    const a = new THREE.Vector3(...p0), b = new THREE.Vector3(...p1);
    const axis = b.clone().sub(a).normalize();
    const ref = Math.abs(axis.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(axis, ref).normalize();
    const w = new THREE.Vector3().crossVectors(axis, u).normalize();
    const ring = (c, r, i) => { const t = (i / sides) * Math.PI * 2; return c.clone().addScaledVector(u, Math.cos(t) * r).addScaledVector(w, Math.sin(t) * r).toArray(); };
    for (let i = 0; i < sides; i++) this.quad(ring(a, r0, i), ring(a, r0, i + 1), ring(b, r1, i + 1), ring(b, r1, i), color);
  }
  // A flat-topped drum (barrel, canister), `sides` faces + a lid.
  drum(cx, y0, cz, r, h, sides, color, lid = color) {
    this.tube([cx, y0, cz], [cx, y0 + h, cz], r, r, sides, color);
    for (let i = 0; i < sides; i++) {
      const t0 = (i / sides) * Math.PI * 2, t1 = ((i + 1) / sides) * Math.PI * 2;
      this.tri([cx, y0 + h, cz], [cx + Math.cos(t0) * r, y0 + h, cz + Math.sin(t0) * r], [cx + Math.cos(t1) * r, y0 + h, cz + Math.sin(t1) * r], lid);
    }
  }
  pyramid(cx, y0, cz, r, h, sides, color) {
    for (let i = 0; i < sides; i++) {
      const t0 = ((i + 0.5) / sides) * Math.PI * 2, t1 = ((i + 1.5) / sides) * Math.PI * 2;
      this.tri([cx + Math.cos(t0) * r, y0, cz + Math.sin(t0) * r], [cx + Math.cos(t1) * r, y0, cz + Math.sin(t1) * r], [cx, y0 + h, cz], color);
    }
  }
  build(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals(); // non-indexed: one normal per triangle = flat shading
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
}
const SOLID_MATERIAL = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
const newGlass = () => ({ on: new Mesher(), off: new Mesher() });

// ---- shared pieces -------------------------------------------------------------------------------------
// A window on a wall plane z = 0 facing +z (call inside S.at(...)): a pale frame, the glass, one mullion.
function windowAt(S, G, cx, cy, w, h, { lit = true, frame = C.trim, fr = 0.07, mull = true } = {}) {
  const [x0, x1, y0, y1] = [cx - w / 2, cx + w / 2, cy - h / 2, cy + h / 2];
  if (fr > 0) S.quad([x0 - fr, y0 - fr, 0.015], [x1 + fr, y0 - fr, 0.015], [x1 + fr, y1 + fr, 0.015], [x0 - fr, y1 + fr, 0.015], frame);
  (lit ? G.on : G.off).quad([x0, y0, 0.03], [x1, y0, 0.03], [x1, y1, 0.03], [x0, y1, 0.03], null);
  if (mull) S.quad([cx - 0.03, y0, 0.045], [cx + 0.03, y0, 0.045], [cx + 0.03, y1, 0.045], [cx - 0.03, y1, 0.045], frame);
}
// A sail from three corners: 4 triangles, the middle of the leech and foot pushed out by `belly` along x (or z).
function sail3(S, tack, head, clew, belly, color, axis = 0) {
  const off = (p, k) => { const q = [...p]; q[axis] += belly * k; return q; };
  const m1 = mid(tack, head), m2 = off(mid(head, clew), 1), m3 = off(mid(clew, tack), 0.6);
  S.tri(tack, m1, m3, color); S.tri(m1, head, m2, color); S.tri(m3, m2, clew, color); S.tri(m1, m2, m3, shade(color, 0.97));
}
// A four-cornered sail on an nu x nv grid; cell(i, j) -> colour override (patches, reef bands). T/H = luff bottom/top, C/P = clew/peak.
function quadSail(S, T, H, P, Cw, belly, color, nu, nv, cell, axis = 0) {
  const pt = (u, v) => {
    const bot = [lerp(T[0], Cw[0], u), lerp(T[1], Cw[1], u), lerp(T[2], Cw[2], u)];
    const top = [lerp(H[0], P[0], u), lerp(H[1], P[1], u), lerp(H[2], P[2], u)];
    const q = [lerp(bot[0], top[0], v), lerp(bot[1], top[1], v), lerp(bot[2], top[2], v)];
    q[axis] += belly * Math.sin(Math.PI * u) ** 0.9 * Math.sin(Math.PI * v) ** 0.7;
    return q;
  };
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const k = cell?.(i, j) ?? color;
      S.quad(pt(i / nu, j / nv), pt((i + 1) / nu, j / nv), pt((i + 1) / nu, (j + 1) / nv), pt(i / nu, (j + 1) / nv), k);
    }
  }
}

// ---- hull lofting (boats) ----------------------------------------------------------------------------------
// Stations run stern (z = -L/2) to bow (+L/2). Each: z, half beam w, sheer height, keel height.
function hullStations({ L, B, n, sheer0, riseBow = 0, riseStern = 0, keelD, tipKeel = 0.1, kp = 2.2, peak = 0.5, pBow = 1.5, pStern = 1.5, sternW0 = 0 }) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1), u = 2 * s - 1;
    const v = s < peak ? (s - peak) / peak : (s - peak) / (1 - peak);
    const base = 1 - Math.abs(v) ** (v < 0 ? pStern : pBow);
    const f = v < 0 ? sternW0 + (1 - sternW0) * base : base;
    out.push({
      z: -L / 2 + s * L, w: (B / 2) * f,
      sheer: sheer0 + riseBow * Math.max(0, u) ** 2 + riseStern * Math.max(0, -u) ** 2,
      keel: tipKeel + (-keelD - tipKeel) * (1 - Math.abs(u) ** kp),
    });
  }
  return out;
}
const prof = (t, pf) => Math.cos((t * Math.PI) / 2) ** pf; // half-beam factor from the sheer (t = 0) down to the keel (t = 1)
function atZ(st, z, key) { // linear interpolation of a station value
  if (z <= st[0].z) return st[0][key];
  for (let i = 0; i < st.length - 1; i++) if (z <= st[i + 1].z) return lerp(st[i][key], st[i + 1][key], (z - st[i].z) / (st[i + 1].z - st[i].z));
  return st[st.length - 1][key];
}
// bands: [[tEnd, colour], ...] cumulative from the sheer (0) to the keel (1). open boats get a floor instead of a deck.
function loft(S, st, { bands, deck = C.teak, pf = 0.55, open = false, floorY = 0.12, floor = C.woodDark }) {
  const ts = [0, ...bands.map((b) => b[0])];
  const ring = (s) => ts.map((t) => [s.w * prof(t, pf), lerp(s.sheer, s.keel, t)]);
  for (let i = 0; i < st.length - 1; i++) {
    const A = ring(st[i]), Bq = ring(st[i + 1]);
    const [zi, zj] = [st[i].z, st[i + 1].z];
    for (let k = 0; k < bands.length; k++) {
      for (const side of [1, -1]) S.quad([side * A[k][0], A[k][1], zi], [side * Bq[k][0], Bq[k][1], zj], [side * Bq[k + 1][0], Bq[k + 1][1], zj], [side * A[k + 1][0], A[k + 1][1], zi], bands[k][1]);
    }
    if (open) {
      const half = (s) => s.w * prof(clamp((s.sheer - floorY) / (s.sheer - s.keel), 0, 1), pf) * 0.92;
      S.quad([-half(st[i]), floorY, zi], [half(st[i]), floorY, zi], [half(st[i + 1]), floorY, zj], [-half(st[i + 1]), floorY, zj], floor);
    } else {
      S.quad([-st[i].w, st[i].sheer, zi], [st[i].w, st[i].sheer, zi], [st[i + 1].w, st[i + 1].sheer, zj], [-st[i + 1].w, st[i + 1].sheer, zj], deck);
    }
  }
  for (const s of [st[0], st[st.length - 1]]) { // close a blunt end with a transom
    if (s.w < 0.03) continue;
    const R = ring(s);
    for (let k = 0; k < bands.length; k++) S.quad([-R[k][0], R[k][1], s.z], [R[k][0], R[k][1], s.z], [R[k + 1][0], R[k + 1][1], s.z], [-R[k + 1][0], R[k + 1][1], s.z], shade(bands[k][1], 0.92));
  }
}

// ======================================================================================================
//  TODAY
// ======================================================================================================
export const STRIPES = { navy: C.navy, coral: C.coral, sage: C.sage, sand: C.sand };

// A modern cruising sailboat: white hull and sails, a coloured cove stripe, teak deck, cabin with windows. ~9 m.
export function addSailboat(S, G, { L = 9, stripe = 'navy', sailsUp = true, lod = false, lit = true } = {}) {
  const stripeC = STRIPES[stripe] ?? C.navy;
  const B = L * 0.34;
  const st = hullStations({ L, B, n: lod ? 5 : 9, sheer0: 0.8, riseBow: 0.34, riseStern: 0.1, keelD: 0.7, peak: 0.45, pBow: 1.3, pStern: 1.8, sternW0: 0.55 });
  const bands = lod ? [[0.5, C.white], [1, C.antifoul]] : [[0.13, C.white], [0.21, stripeC], [0.55, C.white], [1, C.antifoul]];
  loft(S, st, { bands, deck: C.teak, pf: 0.55 });
  const dy = (z) => atZ(st, z, 'sheer');
  const cz = L * 0.04, cl = L * 0.36, cw = B * 0.6;
  const base = dy(cz);
  S.box(0, base + 0.26, cz, cw, 0.52, cl, C.white); // cabin trunk
  S.box(0, base + 0.55, cz, cw * 0.86, 0.06, cl * 0.9, C.grey); // roof panel
  S.quad([-cw * 0.4, base + 0.01, cz - cl * 0.5 - cl * 0.55], [cw * 0.4, base + 0.01, cz - cl * 0.5 - cl * 0.55], [cw * 0.4, base + 0.01, cz - cl * 0.5 - 0.1], [-cw * 0.4, base + 0.01, cz - cl * 0.5 - 0.1], C.teakDark); // cockpit sole
  for (const side of [1, -1]) {
    S.at({ p: [side * cw / 2, base, cz], ry: (side * Math.PI) / 2 }, () => {
      const nW = lod ? 2 : 3;
      for (let i = 0; i < nW; i++) windowAt(S, G, (i - (nW - 1) / 2) * (cl / nW) * 0.95, 0.27, cl / nW * 0.6, 0.2, { lit: lit && (i + (side > 0 ? 0 : 1)) % 3 !== 2, fr: lod ? 0 : 0.03, mull: false });
    });
  }
  const mz = L * 0.12, top = base + L * 1.08;
  S.tube([0, base, mz], [0, top, mz], 0.07, 0.04, 4, C.silver); // mast
  const boomY = base + 1.15, boomLen = L * 0.32;
  S.at({ p: [0, 0, mz], ry: 0.3 }, () => { // boom, main and cover swing out about the mast (17 degrees)
    S.tube([0, boomY, -0.04], [0, boomY - 0.02, -boomLen], 0.05, 0.045, 4, sailsUp ? C.silver : stripeC);
    if (sailsUp) sail3(S, [0, boomY + 0.05, -0.06], [0, top - 0.4, -0.06], [0, boomY + 0.05, -boomLen], 0.38, C.sailWhite);
    else if (!lod) S.tube([0, boomY + 0.08, -0.1], [0, boomY + 0.08, -boomLen + 0.2], 0.11, 0.11, 5, stripeC); // sail cover on the boom
  });
  if (sailsUp && !lod) sail3(S, [0, base + 0.35, L / 2 - 0.25], [0, top - 1.1, mz + 0.05], [0.08, base + 0.9, mz - 1.5], 0.3, C.genoa);
  if (!lod) S.box(0, base + 0.3, cz - cl * 0.5 - cl * 0.62, cw * 0.7, 0.04, 0.5, stripeC); // spray hood stripe / bench
}

// A small open motorboat with a console and an outboard. ~6 m.
export function addMotorboat(S, G, { L = 6.2, stripe = 'coral', lod = false, lit = true } = {}) {
  const stripeC = STRIPES[stripe] ?? C.coral;
  const B = L * 0.38;
  const st = hullStations({ L, B, n: lod ? 5 : 8, sheer0: 0.62, riseBow: 0.4, riseStern: 0.04, keelD: 0.34, peak: 0.35, pBow: 1.2, pStern: 3, sternW0: 0.85 });
  loft(S, st, { bands: lod ? [[0.5, C.white], [1, C.antifoul]] : [[0.15, C.white], [0.23, stripeC], [0.52, C.white], [1, C.antifoul]], deck: C.teak, pf: 0.4 });
  const dy = (z) => atZ(st, z, 'sheer');
  const cz = 0.3, base = dy(cz);
  S.box(-0.45, base + 0.28, cz, 0.7, 0.56, 0.9, C.white); // console
  S.quad([-1.05, base + 0.55, cz + 0.28], [0.15, base + 0.55, cz + 0.28], [0.15, base + 1.05, cz + 0.08], [-1.05, base + 1.05, cz + 0.08], C.trim); // windscreen frame
  G[lit ? 'on' : 'off'].quad([-1.0, base + 0.6, cz + 0.285], [0.1, base + 0.6, cz + 0.285], [0.1, base + 1.0, cz + 0.095], [-1.0, base + 1.0, cz + 0.095], null);
  S.box(0, base + 0.2, -L * 0.22, B * 0.55, 0.3, 0.7, C.sand); // bench
  S.box(0, base + 0.55, -L / 2 + 0.2, 0.34, 0.9, 0.3, C.charcoal); // outboard
  S.box(0, base + 1.05, -L / 2 + 0.2, 0.4, 0.2, 0.36, C.grey);
  if (!lod) S.box(0, base + 0.06, L / 2 - 0.9, B * 0.3, 0.12, 0.5, stripeC); // anchor locker
}

// The Lysekil-Fiskebackskil passenger ferry (line 847), ~24 m: a low white boat with an enclosed salon (windows all along),
// an open upper deck aft, a small wheelhouse on top and an open foredeck with bike rails (Elise carries ~30 bikes in the bow).
// Sources: gunnarsbatturer.com (Elise: 150 passengers, salon with 70 seats, open upper deck in warm weather, bikes in the bow);
// sv.wikipedia Carl Wilhelmson (the older ferry, 27.37 m, 222 passengers). Shape from that description, NOT from a drawing.
// TODO(felix): confirm the real hull / stripe colours (no source found); white with a pastel-navy lower hull is assumed.
export function addFerry(S, G, { L = 24, lit = true } = {}) {
  const B = 6.6;
  const st = hullStations({ L, B, n: 10, sheer0: 1.7, riseBow: 0.55, riseStern: 0.1, keelD: 1.0, tipKeel: 0.2, kp: 6, peak: 0.45, pBow: 2.0, pStern: 2.5, sternW0: 0.85 });
  loft(S, st, { bands: [[0.4, C.white], [0.52, C.coral], [1, C.navy]], deck: C.teak, pf: 0.25 });
  const y0 = 1.7;
  const [sz0, sz1] = [-8, 4.8]; // salon
  const sw = 5.4;
  S.box(0, y0 + 1.2, (sz0 + sz1) / 2, sw, 2.4, sz1 - sz0, C.white);
  S.box(0, y0 + 2.46, (sz0 + sz1) / 2, sw + 0.5, 0.14, sz1 - sz0 + 0.6, C.grey); // roof slab
  for (const side of [1, -1]) {
    S.at({ p: [side * sw / 2, y0, 0], ry: (side * Math.PI) / 2 }, () => {
      const n = 8;
      for (let i = 0; i < n; i++) {
        const lz = lerp(sz0 + 0.9, sz1 - 0.9, i / (n - 1));
        const x = side > 0 ? -lz : lz; // local x maps to -z on the +x side, +z on the -x side
        const on = lit && i % 4 !== 3;
        (on ? G.on : G.off).quad([x - 0.55, 0.7, 0.03], [x + 0.55, 0.7, 0.03], [x + 0.55, 1.8, 0.03], [x - 0.55, 1.8, 0.03], null);
      }
    });
  }
  S.at({ p: [0, y0, sz1], ry: 0 }, () => { // the forward face of the salon: a wide door and two windows
    for (const x of [-1.7, 1.7]) (lit ? G.on : G.off).quad([x - 0.7, 0.7, 0.03], [x + 0.7, 0.7, 0.03], [x + 0.7, 1.8, 0.03], [x - 0.7, 1.8, 0.03], null);
    S.box(0, 1.0, 0.02, 1.1, 2.0, 0.04, C.navy);
  });
  // wheelhouse on the roof
  const wy = y0 + 2.55;
  S.box(0, wy + 1.0, 2.4, 3.6, 2.0, 3.2, C.white);
  S.box(0, wy + 2.06, 2.4, 4.0, 0.12, 3.6, C.grey);
  S.at({ p: [0, wy, 4.0] }, () => { for (const x of [-1.1, 0, 1.1]) (lit ? G.on : G.off).quad([x - 0.5, 0.9, 0.03], [x + 0.5, 0.9, 0.03], [x + 0.5, 1.7, 0.03], [x - 0.5, 1.7, 0.03], null); });
  for (const side of [1, -1]) S.at({ p: [side * 1.8, wy, 2.4], ry: (side * Math.PI) / 2 }, () => { for (const x of [-0.7, 0.7]) G.on.quad([x - 0.5, 0.9, 0.03], [x + 0.5, 0.9, 0.03], [x + 0.5, 1.7, 0.03], [x - 0.5, 1.7, 0.03], null); });
  S.tube([0, wy + 2.1, 2.0], [0, wy + 4.2, 2.0], 0.1, 0.06, 4, C.silver); // mast
  S.box(0, wy + 3.6, 2.0, 0.9, 0.12, 0.3, C.charcoal); // radar bar
  // upper deck aft: rails and two orange life-raft canisters
  const ry = y0 + 2.53;
  for (const side of [1, -1]) {
    S.box(side * (sw / 2 + 0.2), ry + 0.55, -3.9, 0.06, 0.06, 8.4, C.rail);
    S.box(side * (sw / 2 + 0.2), ry + 0.2, -3.9, 0.04, 0.4, 8.4, C.white);
    S.tube([side * 1.4, ry + 0.2, -6.2], [side * 1.4, ry + 0.2, -4.6], 0.32, 0.32, 6, C.orange);
  }
  S.box(0, ry + 0.55, -8.0, sw + 0.6, 0.06, 0.06, C.rail);
  // foredeck: bike rails and bollards
  for (let i = 0; i < 5; i++) S.box(-1.6 + i * 0.8, y0 + 0.4, 7.6, 0.05, 0.8, 1.6, C.charcoal);
  for (const z of [11, -11]) for (const x of [-1.6, 1.6]) S.drum(x, y0, z, 0.12, 0.3, 5, C.charcoal);
}

// A guest harbour: a floating pontoon with boats moored bow-in on both sides. `perSide` boats a side, all low-poly and merged.
export function addGuestHarbour(S, G, { perSide = 5, seed = 4 } = {}) {
  const r = rngOf(seed);
  const len = perSide * 3.9 + 4;
  S.box(0, 0.12, len / 2 - 1.5, 1.5, 0.4, len, C.wood); // pontoon (z from -1.5 to len - 1.5)
  S.box(0, 0.33, len / 2 - 1.5, 1.2, 0.04, len - 0.4, C.teakDark);
  for (let i = 0; i < perSide; i++) {
    for (const side of [1, -1]) {
      const z = 1.6 + i * 3.9;
      const sail = r() < 0.65;
      const stripe = ['navy', 'coral', 'sage', 'sand'][Math.floor(r() * 4)];
      const L = sail ? 7.4 + r() * 2.2 : 5.4 + r() * 1.2;
      S.at({ p: [side * (0.75 + L / 2 - 0.2 + 0.25), 0, z + (r() - 0.5) * 0.3], ry: side > 0 ? -Math.PI / 2 : Math.PI / 2 }, () => {
        if (sail) addSailboat(S, G, { L, stripe, sailsUp: false, lod: true, lit: r() < 0.7 });
        else addMotorboat(S, G, { L, stripe, lod: true, lit: r() < 0.7 });
      });
    }
  }
  for (const z of [-1, len - 2.5]) S.drum(0, 0.34, z, 0.14, 0.3, 5, C.charcoal); // end posts
}

// A painted Swedish summer house: board walls in a pastel, white corner boards and window frames, a slate roof, big windows
// towards the sea (+x of the shell, turned to face +z), a veranda, a chimney. ~8 x 5.6 m.
export const HOUSE_COLOURS = { cream: 0xefe6d2, sky: 0xb9cfdc, rose: 0xe3a69a, sage: 0xc3d4b6 };
export function addSummerHouse(S, G, { colour = 'cream', lit = true, seed = 2 } = {}) {
  const wall = HOUSE_COLOURS[colour] ?? HOUSE_COLOURS.cream;
  S.at({ ry: -Math.PI / 2 }, () => {
    const w = 5.6, d = 8.4, h = 2.9, rh = 1.9, eave = 0.5;
    shell(S, { w, d, h, rh, eave, wall, roof: C.slate, bands: 0, found: C.stone, foundD: 1.4 });
    for (const [x, z] of [[w / 2, d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [-w / 2, -d / 2]]) S.box(x, h / 2, z, 0.16, h, 0.16, C.trim); // corner boards
    S.box(0, h + rh * 0.5 + 0.55, d * 0.18, 0.55, rh + 1.1, 0.55, C.paint); // chimney
    S.box(0, h + rh + 0.5, d * 0.18, 0.7, 0.08, 0.7, C.graniteDk);
    // the sea side (+x): two big windows and the door
    S.at({ p: [w / 2, 0, 0], ry: Math.PI / 2 }, () => {
      windowAt(S, G, -2.5, 1.5, 2.1, 1.5, { lit, fr: 0.1 });
      windowAt(S, G, 0.6, 1.5, 2.1, 1.5, { lit: lit, fr: 0.1 });
      S.quad([2.5, 0, 0.02], [3.4, 0, 0.02], [3.4, 2.1, 0.02], [2.5, 2.1, 0.02], C.door);
      S.quad([2.55, 0.05, 0.03], [3.35, 0.05, 0.03], [3.35, 2.05, 0.03], [2.55, 2.05, 0.03], shade(C.door, 1.15));
    });
    // veranda: a deck, posts, a lean-to roof and a rail
    S.box(w / 2 + 1.0, 0.18, 0, 2.0, 0.36, d * 0.8, C.teak);
    for (const z of [-d * 0.4, d * 0.4]) S.box(w / 2 + 1.9, 1.25, z, 0.12, 2.5, 0.12, C.trim);
    S.box(w / 2 + 1.9, 2.55, 0, 0.14, 0.12, d * 0.8 + 0.3, C.trim); // an open pergola beam (a full roof would hide the big windows from the game camera)
    for (const x of [w / 2 + 0.6, w / 2 + 1.2]) S.box(x, 2.55, 0, 0.08, 0.08, d * 0.8 + 0.3, C.teakDark);
    S.box(w / 2 + 1.95, 0.8, 0, 0.05, 0.08, d * 0.8, C.trim);
    // a window on each end (gable) and on the back
    for (const sgn of [1, -1]) S.at({ p: [0, 0, sgn * d / 2], ry: sgn > 0 ? 0 : Math.PI }, () => {
      windowAt(S, G, -1.2, 1.5, 0.9, 1.2, { lit: lit && sgn > 0, fr: 0.07 });
      windowAt(S, G, 1.2, 1.5, 0.9, 1.2, { lit: lit && sgn < 0, fr: 0.07 });
      G[lit ? 'on' : 'off'].tri([-0.35, h + 0.35, 0.03], [0.35, h + 0.35, 0.03], [0, h + 1.15, 0.03], null);
    });
    S.at({ p: [-w / 2, 0, 0], ry: -Math.PI / 2 }, () => { windowAt(S, G, -2, 1.5, 1.2, 1.1, { lit: false }); windowAt(S, G, 2, 1.5, 1.2, 1.1, { lit }); });
  });
  void seed;
}

// ---- house shell: walls + gable roof, ridge along z. Centred in x and z, standing on y = 0 over a stone foundation. ----
function shell(S, { w, d, h, rh, eave, wall, roof, bands = 0, found, foundD = 0.6, gableOv = 0.3, roofB }) {
  const wc = (k) => (bands ? shade(wall, 1 - 0.07 * (k % 2)) : wall);
  const strips = Math.max(1, bands);
  const wallQuad = (a, b, x0, x1) => { // a vertical wall from point a to b on the ground plane, split into plank bands
    for (let k = 0; k < strips; k++) S.quad([a[0], h * k / strips, a[1]], [b[0], h * k / strips, b[1]], [b[0], h * (k + 1) / strips, b[1]], [a[0], h * (k + 1) / strips, a[1]], wc(k));
    void x0; void x1;
  };
  wallQuad([-w / 2, d / 2], [w / 2, d / 2]); // front gable wall
  wallQuad([w / 2, -d / 2], [-w / 2, -d / 2]);
  wallQuad([w / 2, d / 2], [w / 2, -d / 2]);
  wallQuad([-w / 2, -d / 2], [-w / 2, d / 2]);
  S.tri([-w / 2, h, d / 2], [w / 2, h, d / 2], [0, h + rh, d / 2], wall);
  S.tri([w / 2, h, -d / 2], [-w / 2, h, -d / 2], [0, h + rh, -d / 2], wall);
  const ex = w / 2 + eave, ez = d / 2 + gableOv, ey = h - eave * (rh / (w / 2));
  S.quad([-ex, ey, ez], [0, h + rh, ez], [0, h + rh, -ez], [-ex, ey, -ez], roof);
  S.quad([0, h + rh, ez], [ex, ey, ez], [ex, ey, -ez], [0, h + rh, -ez], roofB ?? shade(roof, 0.93));
  if (found) S.box(0, -foundD / 2 + 0.25, 0, w + 0.3, foundD, d + 0.3, found); // stone foundation, reaching down into the ground
}

// ======================================================================================================
//  1700
// ======================================================================================================
// A poor fisherman's cottage: unpainted grey timber, one tiny window, a low door, a turf (or clay-tile) roof, a stone chimney.
// Variants: a = turf roof, b = tile roof with a lean-to, c = turf roof, longer, with a stone chimney.
export const COTTAGE_VARIANTS = ['a', 'b', 'c'];
export function addCottage(S, G, { variant = 'a', lit = true, seed = 7 } = {}) {
  const r = rngOf(seed + variant.charCodeAt(0));
  const v = { a: { w: 3.3, d: 4.4, h: 1.75, rh: 1.35 }, b: { w: 3.6, d: 4.8, h: 1.8, rh: 1.1 }, c: { w: 3.0, d: 5.6, h: 1.7, rh: 1.5 } }[variant] ?? { w: 3.3, d: 4.4, h: 1.75, rh: 1.35 };
  const tile = variant === 'b';
  const roofC = tile ? C.tile : C.turf;
  shell(S, { ...v, eave: 0.35, gableOv: 0.2, wall: C.timber, roof: roofC, roofB: tile ? shade(C.tile, 0.9) : C.turf2, bands: 3, found: C.stone, foundD: 1.2 });
  const { w, d, h, rh } = v;
  if (!tile) { // turf: a few tussocks along the ridge and the eaves
    for (let i = 0; i < 6; i++) {
      const z = lerp(-d / 2, d / 2, (i + 0.5) / 6), side = i % 2 ? 1 : -1;
      const py = h + rh * (0.78 + r() * 0.1);
      S.pyramid(side * (w * 0.1), py, z, 0.3 + r() * 0.15, 0.22, 4, i % 3 ? C.turf2 : C.meadow2);
    }
  } else { // a ridge line of tiles
    S.box(0, h + rh + 0.04, 0, 0.14, 0.1, d + 0.5, shade(C.tile, 0.8));
  }
  S.at({ p: [0, 0, d / 2] }, () => { // door and one tiny window on the gable wall
    S.quad([-w * 0.28, 0, 0.03], [-w * 0.28 + 0.62, 0, 0.03], [-w * 0.28 + 0.62, 1.35, 0.03], [-w * 0.28, 1.35, 0.03], C.door);
    windowAt(S, G, w * 0.2, 1.1, 0.42, 0.42, { lit, frame: C.stone, fr: 0.05, mull: false });
  });
  S.at({ p: [w / 2, 0, 0], ry: Math.PI / 2 }, () => windowAt(S, G, 0.4, 1.05, 0.36, 0.36, { lit: false, frame: C.stone, fr: 0.04, mull: false }));
  // chimney: a small stone stack on the ridge (variant c: a bigger one in stone at the gable)
  if (variant === 'c') {
    S.box(0, (h + rh) / 2, -d / 2 - 0.35, 1.0, h + rh, 0.7, C.stone);
    S.box(0, h + rh + 0.3, -d / 2 - 0.35, 0.7, 0.7, 0.5, C.graniteDk);
  } else S.box(0, h + rh + 0.15, -d * 0.2, 0.55, 0.8, 0.55, C.stone);
  if (variant === 'b') { // a lean-to for tools and nets
    S.box(w / 2 + 0.95, 0.8, -0.4, 1.9, 1.6, 2.2, shade(C.timber, 0.92));
    S.quad([w / 2 - 0.1, 1.9, 0.9], [w / 2 + 2.1, 1.35, 0.9], [w / 2 + 2.1, 1.35, -1.7], [w / 2 - 0.1, 1.9, -1.7], C.turf);
  }
  if (variant === 'a') { S.drum(-w / 2 - 0.7, 0, 0.8, 0.28, 0.7, 6, C.woodDark, C.wood); S.box(w / 2 + 0.7, 0.35, -0.8, 1.1, 0.7, 0.5, C.woodDark); } // a barrel, a woodpile
}

// The sea-shed (sjobod): long and low, tarred grey timber, big double doors in the gable end facing the water, a plank roof,
// and a granite slip running into the sea with two rollers.
export function addBoathouse(S, G, { lit = false } = {}) {
  S.at({ p: [0, 0, 0] }, () => {
    shell(S, { w: 4.2, d: 7.4, h: 2.3, rh: 1.3, eave: 0.3, gableOv: 0.35, wall: shade(C.timber, 0.72), roof: shade(C.timber, 0.85), bands: 3, found: C.stone, foundD: 1.2 });
    S.at({ p: [0, 0, 3.7] }, () => {
      S.quad([-1.15, 0, 0.03], [0, 0, 0.03], [0, 2.0, 0.03], [-1.15, 2.0, 0.03], C.tar2);
      S.quad([0, 0, 0.03], [1.15, 0, 0.03], [1.15, 2.0, 0.03], [0, 2.0, 0.03], shade(C.tar2, 1.12));
      S.quad([-0.02, 0, 0.045], [0.02, 0, 0.045], [0.02, 2.0, 0.045], [-0.02, 2.0, 0.045], C.woodDark);
      windowAt(S, G, 0, 2.55, 0.5, 0.35, { lit, frame: C.stone, fr: 0.04, mull: false });
    });
    S.quad([-1.8, 0.35, 3.6], [1.8, 0.35, 3.6], [2.0, -0.25, 9.0], [-2.0, -0.25, 9.0], C.graniteDk); // the slip
    for (const x of [-0.7, 0.7]) S.tube([x, 0.42, 4.2], [x, 0.0, 8.2], 0.09, 0.09, 4, C.woodDark); // rollers
    S.box(-2.45, 0.2, 5.4, 0.5, 0.4, 1.0, C.stone);
  });
}

// Fish-drying racks (hjallar): leaning A-frames carrying a long pole, split fish hanging in rows.
export function addDryingRacks(S, G, { racks = 3, seed = 3 } = {}) {
  const r = rngOf(seed);
  for (let k = 0; k < racks; k++) {
    const z = (k - (racks - 1) / 2) * 2.6;
    const len = 5.2;
    for (const x of [-len / 2, 0, len / 2]) {
      S.tube([x - 0.02, 0, z - 0.7], [x, 1.9, z], 0.05, 0.04, 4, C.woodDark);
      S.tube([x - 0.02, 0, z + 0.7], [x, 1.9, z], 0.05, 0.04, 4, C.woodDark);
    }
    S.tube([-len / 2 - 0.2, 1.9, z], [len / 2 + 0.2, 1.9, z], 0.05, 0.05, 4, C.wood);
    const n = 13;
    for (let i = 0; i < n; i++) { // a fish: a long thin diamond hanging head-up on the pole
      const x = lerp(-len / 2 + 0.3, len / 2 - 0.3, (i + r() * 0.4) / n), hh = 0.55 + r() * 0.15;
      const col = i % 3 === 0 ? C.fishB : C.fishA;
      S.tri([x, 1.86, z - 0.16], [x, 1.86, z + 0.16], [x + 0.05, 1.86 - hh, z], col);
      S.tri([x, 1.86, z + 0.16], [x, 1.86, z - 0.16], [x - 0.05, 1.86 - hh, z], shade(col, 0.95));
    }
  }
}

// A stone cairn (kummel): a heap of granite on a faceted cone, stones bedded into its slopes, a capstone on top: a landmark on a headland.
export function addKummel(S, G, { seed = 5 } = {}) {
  const r = rngOf(seed);
  const pick = () => [C.granite, C.granitePale, C.graniteDk, C.stone][Math.floor(r() * 4)];
  const R = 1.7, H = 1.9, N = 9;
  const rim = [];
  for (let i = 0; i < N; i++) { const t = (i / N) * Math.PI * 2; const rr = R * (0.85 + r() * 0.3); rim.push([Math.cos(t) * rr, -0.3, Math.sin(t) * rr]); }
  const apex = [0.05, H, -0.05];
  for (let i = 0; i < N; i++) S.tri(rim[i], rim[(i + 1) % N], apex, shade(pick(), 0.9));
  const stone = (x, y, z, rad) => { // a lumpy stone: a squashed octahedron, jittered
    const col = pick();
    const jit = () => 1 + (r() - 0.5) * 0.4;
    const P = [[rad * jit(), 0, 0], [-rad * jit(), 0, 0], [0, 0, rad * jit()], [0, 0, -rad * jit()], [0, rad * 0.8 * jit(), 0], [0, -rad * 0.4, 0]].map((q) => [q[0] + x, q[1] + y, q[2] + z]);
    for (const [a2, b2] of [[0, 2], [2, 1], [1, 3], [3, 0]]) { S.tri(P[a2], P[b2], P[4], col); S.tri(P[b2], P[a2], P[5], shade(col, 0.8)); }
  };
  for (const [count, rr, size] of [[8, 1.25, 0.62], [5, 0.75, 0.55], [3, 0.3, 0.48]]) {
    const y = H * (1 - rr / R) - 0.2;
    for (let i = 0; i < count; i++) { const t = (i / count) * Math.PI * 2 + r() * 0.6; stone(Math.cos(t) * rr, y, Math.sin(t) * rr, size * (0.85 + r() * 0.3)); }
  }
  stone(0, H - 0.1, 0, 0.55);
}

// A painted rock sea mark: a big granite boulder with a white limewashed patch on the side facing the sea (+z), as a daymark.
export function addRockMark(S, G, { seed = 9 } = {}) {
  const r = rngOf(seed);
  const geo = new THREE.IcosahedronGeometry(1, 1); // 80 triangles (already non-indexed in this three.js)
  const p = geo.attributes.position;
  const jit = new Map();
  const key = (i) => `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
  const vtx = [];
  for (let i = 0; i < p.count; i++) {
    const k = key(i);
    if (!jit.has(k)) jit.set(k, 0.82 + r() * 0.36);
    const j = jit.get(k);
    vtx.push([p.getX(i) * j * 1.5, Math.max(-0.1, p.getY(i) * j * 1.05 + 0.45), p.getZ(i) * j * 1.2]);
  }
  for (let i = 0; i < vtx.length; i += 3) {
    const [a, b, c] = [vtx[i], vtx[i + 1], vtx[i + 2]];
    const cen = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    const painted = cen[2] > 0.35 && cen[1] > 0.55 && cen[1] < 1.35;
    const col = painted ? C.paint : cen[1] > 1.1 ? C.granitePale : cen[1] < 0.3 ? C.wet : (i / 3) % 3 === 0 ? C.graniteDk : C.granite;
    S.tri(a, b, c, col);
  }
}

// ---- 1700 boats -------------------------------------------------------------------------------------------
// The small working eka (see also boats.js's eka): open clinker, tarred, one spritsail. Variants:
//  a tarred hull + rust sail (the game's eka), b weathered grey hull + pale linen sail, c tarred hull + ochre patched sail and nets,
//  d the sail brailed up and tied along the sprit (rowing / moored).
export const EKA_VARIANTS = ['a', 'b', 'c', 'd'];
export function addEka(S, G, { variant = 'a', L = 4.6, lod = false } = {}) {
  const grey = variant === 'b';
  const tones = grey ? [C.timber, 0x8a8277, 0x7d7468] : [C.tar, C.tar2, C.tar3];
  const sailC = { a: 0x8c4a2b, b: 0xd8cdb2, c: 0xb27a45, d: 0x8c4a2b }[variant] ?? 0x8c4a2b;
  const st = hullStations({ L, B: L * 0.32, n: lod ? 5 : 8, sheer0: 0.4, riseBow: 0.24, riseStern: 0.14, keelD: 0.28, peak: 0.5, pBow: 1.4, pStern: 1.5, sternW0: 0 });
  loft(S, st, { bands: [[0.17, shade(tones[0], 1.5)], [0.34, tones[0]], [0.52, tones[1]], [0.7, tones[0]], [1, tones[2]]], open: true, floorY: 0.12, floor: C.woodDark, pf: 0.5 });
  const sh = (z) => atZ(st, z, 'sheer');
  for (const z of [-1.0, 0.0, 1.0]) S.box(0, 0.27, z * (L / 4.6), st[3].w * 1.5, 0.04, 0.28, C.wood); // thwarts
  for (const [x, dir] of [[0.22, 1], [-0.22, -1]]) { // oars lying inside
    S.tube([x, 0.3, -1.3 * dir], [x, 0.3, 1.2 * dir], 0.025, 0.025, 4, C.wood);
    S.box(x, 0.3, 1.5 * dir, 0.16, 0.016, 0.4, C.wood);
  }
  const mz = L * 0.2, top = 3.5;
  S.tube([0, 0.1, mz], [0, top, mz], 0.06, 0.035, 4, C.woodDark); // mast
  const T = [0, 0.55, mz - 0.05], H = [0, 3.0, mz - 0.05], P = [0, 3.35, mz - 2.2], Cw = [0, 0.55, mz - 2.4];
  S.tube([0, 0.45, mz - 0.05], P, 0.04, 0.025, 4, C.wood); // the sprit: foot of the mast to the peak
  if (variant === 'd') {
    S.tube([0, 0.5, mz - 0.1], [0, 3.25, mz - 2.05], 0.14, 0.12, 5, sailC);
  } else {
    const patch = variant === 'c' ? (i, j) => ((i === 1 && j === 1) ? 0x934f35 : (i === 2 && j === 0) ? 0xc89a62 : sailC) : variant === 'a' ? (i, j) => ((i === 0 && j === 2) ? 0x7b3c23 : sailC) : undefined;
    quadSail(S, T, H, P, Cw, 0.32, sailC, 3, 3, patch);
  }
  if (variant === 'c') { S.box(0.1, 0.2, -1.6, 0.8, 0.22, 0.7, C.net); S.box(-0.12, 0.17, 1.5, 0.5, 0.18, 0.4, C.wood); } // a heap of net and a fish box
  void sh;
}

// A larger Bohuslan cargo / fishing boat of the period (~11.5 m): broad double-ended clinker, tarred, a decked bow and stern with
// herring barrels in the open middle, a steering oar, an awning aft and one SQUARE sail on a yard. Stylised: no source describes
// the exact rig (the type names kag / julle / snipa come from allmogebatar.se, Bohushallen; the 1778 herring fishery ran ~661 boats).
// TODO(felix): confirm the rig against a museum model if one turns up (Digitalt Museum / Bohusläns museum).
export function addCargoBoat(S, G, { L = 11.5, sailUp = true } = {}) {
  const B = 3.7;
  const st = hullStations({ L, B, n: 11, sheer0: 1.0, riseBow: 0.9, riseStern: 0.6, keelD: 0.8, peak: 0.5, pBow: 1.15, pStern: 1.3, sternW0: 0 });
  loft(S, st, { bands: [[0.11, 0x7a6250], [0.26, C.tar], [0.41, C.tar2], [0.56, C.tar], [0.7, C.tar2], [1, C.tar3]], open: true, floorY: 0.3, floor: C.woodDark, pf: 0.5 });
  const deckPatch = (z0, z1) => { // planked decking over the ends
    const steps = 3;
    for (let i = 0; i < steps; i++) {
      const za = lerp(z0, z1, i / steps), zb = lerp(z0, z1, (i + 1) / steps);
      const wa = atZ(st, za, 'w') * 0.97, wb = atZ(st, zb, 'w') * 0.97;
      S.quad([-wa, atZ(st, za, 'sheer') - 0.12, za], [wa, atZ(st, za, 'sheer') - 0.12, za], [wb, atZ(st, zb, 'sheer') - 0.12, zb], [-wb, atZ(st, zb, 'sheer') - 0.12, zb], C.woodDark);
    }
  };
  deckPatch(2.2, 4.6); deckPatch(-4.6, -3.4);
  for (const z of [-1.2, 0.6, 2.0]) S.box(0, 0.7, z, B * 0.62, 0.05, 0.3, C.wood); // thwarts / beams
  for (const [x, z] of [[-0.7, -0.4], [0.2, -0.4], [-0.3, 0.6], [0.6, 0.6], [-0.7, 1.4], [0.2, 1.4]]) S.drum(x, 0.32, z, 0.3, 0.75, 8, C.chest, shade(C.chest, 1.12)); // herring barrels
  S.box(0, 0.58, -2.6, B * 0.36, 0.14, 0.9, C.wood); // hatch boards
  const hz = 0.6;
  S.tube([0, 0.3, hz], [0, 9.0, hz], 0.13, 0.07, 6, C.woodDark); // mast
  const yardY = 7.5;
  S.tube([-3.2, yardY, hz + 0.1], [3.2, yardY, hz + 0.1], 0.07, 0.07, 5, C.wood); // the yard
  if (sailUp) {
    const bands = (i, j) => (j === 1 ? 0x9a6a3e : 0xb07a4a);
    quadSail(S, [-3.2, yardY - 4.3, hz + 0.1], [-3.2, yardY, hz + 0.1], [3.2, yardY, hz + 0.1], [3.4, yardY - 4.3, hz + 0.1], 0.7, 0xb07a4a, 4, 3, bands, 2);
  } else S.tube([-3.0, yardY - 0.2, hz + 0.1], [3.0, yardY - 0.2, hz + 0.1], 0.2, 0.2, 5, 0xb07a4a);
  for (const [z, hgt, lean] of [[L / 2 - 0.1, 0.9, 0.35], [-L / 2 + 0.2, 0.55, -0.25]]) S.tube([0, st[0].sheer, z], [0, st[0].sheer + hgt, z + lean], 0.07, 0.05, 4, C.woodDark); // stem and stern posts
  S.tube([B / 2 - 0.1, 1.9, -3.4], [B / 2 + 0.5, 0.6, -5.2], 0.04, 0.04, 4, C.wood); // steering oar over the quarter
  S.box(B / 2 + 0.55, 0.25, -5.35, 0.2, 0.6, 0.5, C.wood);
  const ay = 1.55; // awning aft
  S.quad([-0.95, ay - 0.75, -3.4], [0, ay + 0.45, -3.4], [0, ay + 0.45, -4.8], [-0.95, ay - 0.75, -4.8], 0xd8cdb0);
  S.quad([0, ay + 0.45, -3.4], [0.95, ay - 0.75, -3.4], [0.95, ay - 0.75, -4.8], [0, ay + 0.45, -4.8], shade(0xd8cdb0, 0.93));
}

// ======================================================================================================
//  SHARED SHORE + TWO HARBOURS (Today vs 1700)
// ======================================================================================================
// The same small granite shore for both kits: the land lies towards -z (north, the top of the game screen), the sea towards +z.
export const coastZ = (x) => -9 + 2.6 * Math.sin(x * 0.13 + 0.5) + 1.4 * Math.sin(x * 0.31 + 2.0);
const vnoise = (x, z) => 0.5 + 0.5 * Math.sin(x * 1.7 + Math.sin(z * 1.3) * 2.0) * Math.cos(z * 1.1 + x * 0.4);
const smooth = (t) => { const k = clamp(t, 0, 1); return k * k * (3 - 2 * k); };
// The shore is an islet: full height in the middle, sinking into the sea over the last ~12 m at the ends and the back.
export const groundY = (x, z) => {
  const base = Math.min(1.3, (coastZ(x) - z) * 0.1 - 0.08) + (z < coastZ(x) ? 0.25 * vnoise(x * 0.3, z * 0.3) : 0);
  const e = smooth((46 - Math.abs(x)) / 12) * smooth((z + 36) / 10);
  return Math.max(-0.5, base * e - (1 - e) * 0.6);
};
export function addShore(S, { x0 = -48, x1 = 48, z0 = -38, z1 = 3, cell = 3.2 } = {}) {
  const nx = Math.ceil((x1 - x0) / cell), nz = Math.ceil((z1 - z0) / cell);
  const px = (i) => lerp(x0, x1, i / nx), pz = (j) => lerp(z0, z1, j / nz);
  const hgt = (i, j) => groundY(px(i), pz(j));
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const hs = [hgt(i, j), hgt(i + 1, j), hgt(i + 1, j + 1), hgt(i, j + 1)];
      const avg = (hs[0] + hs[1] + hs[2] + hs[3]) / 4;
      if (Math.max(...hs) < -0.15) continue; // under water
      const cx = (px(i) + px(i + 1)) / 2, cz = (pz(j) + pz(j + 1)) / 2;
      const zone = 0.5 + 0.5 * Math.sin(cx * 0.11 + Math.sin(cz * 0.09) * 2.2) * Math.cos(cz * 0.13 - cx * 0.05); // slow patches, not per-cell noise
      const green = avg > 0.3 && avg < 1.1 && zone > 0.55 && cz < coastZ(cx) - 3;
      const grain = 1 + (vnoise(cx * 2.1, cz * 2.3) - 0.5) * 0.07;
      const col = avg < 0.2 ? C.wet : green ? (zone > 0.8 ? C.meadow2 : C.meadow) : zone > 0.7 ? C.granitePale : zone > 0.3 ? C.granite : C.graniteDk;
      const k = shade(col, grain);
      const P = (ii, jj) => [px(ii), Math.max(-0.4, hgt(ii, jj)), pz(jj)];
      S.tri(P(i, j), P(i + 1, j + 1), P(i + 1, j), k);
      S.tri(P(i, j), P(i, j + 1), P(i + 1, j + 1), shade(k, 0.985));
    }
  }
}
const onShore = (x, dz = 0) => [x, Math.max(0.05, groundY(x, coastZ(x) + dz)), coastZ(x) + dz];

// TODAY: summer houses on the shore, the ferry at a stone quay, a guest harbour pontoon with moored rows, a few boats about.
export function addHarbourToday(S, G) {
  addShore(S);
  for (const [x, colour, face] of [[-22, 'cream', 0.1], [-9, 'rose', -0.15], [4, 'sky', 0.05], [27, 'sage', -0.1]]) {
    const [px, py, pz] = onShore(x, -6.5);
    S.at({ p: [px, Math.max(py, 0.5), pz], ry: face }, () => addSummerHouse(S, G, { colour, lit: x !== 4 }));
  }
  const qz = coastZ(16);
  S.box(16, -0.2, qz + 0.4, 17, 1.9, 4.6, C.stone, true); // the stone quay
  S.box(16, 0.78, qz + 2.65, 17, 0.1, 0.18, C.granitePale);
  for (const x of [9, 16, 23]) S.drum(x, 0.75, qz + 2.2, 0.16, 0.3, 5, C.charcoal);
  S.at({ p: [16, 0, qz + 2.7 + 3.4], ry: Math.PI / 2 }, () => addFerry(S, G, {}));
  S.at({ p: [-13, 0, coastZ(-13) + 1.5] }, () => addGuestHarbour(S, G, { perSide: 5, seed: 4 }));
  S.at({ p: [3, 0, 17], ry: 2.6 }, () => addSailboat(S, G, { L: 9.8, stripe: 'sage', sailsUp: true }));
  S.at({ p: [-27, 0, 12], ry: 0.5 }, () => addSailboat(S, G, { L: 8.4, stripe: 'coral', sailsUp: false }));
  S.at({ p: [28, 0, 10], ry: -2.2 }, () => addMotorboat(S, G, { L: 6.2, stripe: 'navy' }));
  S.at({ p: [12, 0, 22], ry: 1.2 }, () => addMotorboat(S, G, { L: 5.6, stripe: 'sand' }));
}

// 1700: the same shore with a few cottages, a sea-shed on its slip, drying racks, a kummel and a painted rock, ekas and one cargo boat.
export function addHarbour1700(S, G) {
  addShore(S);
  for (const [x, v, face, dz] of [[-24, 'a', 0.5, -5.5], [-14, 'c', -0.3, -6.5], [-1, 'b', 0.25, -6.0], [21, 'a', -0.5, -5.5]]) {
    const [px, py, pz] = onShore(x, dz);
    S.at({ p: [px, Math.max(py, 0.4), pz], ry: face }, () => addCottage(S, G, { variant: v, seed: x + 40, lit: v !== 'c' }));
  }
  const [bx, by, bz] = onShore(9, -1.0);
  S.at({ p: [bx, Math.max(by, 0.5), bz], ry: 0.12 }, () => addBoathouse(S, G, {}));
  S.at({ p: [...onShore(-7, -3.5)], ry: 0.15 }, () => addDryingRacks(S, G, { racks: 3, seed: 3 }));
  S.at({ p: onShore(26, -3.5) }, () => addKummel(S, G, {}));
  S.at({ p: [-27.5, 0, coastZ(-27.5) + 0.6], ry: 0.2 }, () => addRockMark(S, G, {}));
  S.at({ p: [-4, 0, coastZ(-4) + 3.2], ry: 1.4 }, () => addEka(S, G, { variant: 'd' }));
  S.at({ p: [8, 0, 14], ry: 2.4 }, () => addEka(S, G, { variant: 'a' }));
  S.at({ p: [-12, 0, 9], ry: 0.7 }, () => addEka(S, G, { variant: 'c', L: 4.9 }));
  S.at({ p: [-25, 0, 17], ry: 1.1 }, () => addEka(S, G, { variant: 'b' }));
  S.at({ p: [12, 0, 21], ry: 0.4 }, () => addCargoBoat(S, G, {}));
  // a small timber landing stage on posts
  const [lx, , lz] = onShore(-8, 0);
  S.box(lx, 0.45, lz + 2.2, 1.4, 0.12, 5.2, C.wood);
  for (const z of [lz + 0.4, lz + 2.2, lz + 4.0]) for (const x of [lx - 0.6, lx + 0.6]) S.tube([x, -0.6, z], [x, 0.4, z], 0.08, 0.08, 4, C.woodDark);
}

// ======================================================================================================
//  1950  (the game's home base: Epoch VI, "Summer guests"; data/world-1950.json, docs/WORLD-1950.md)
// ======================================================================================================
// Wooden boats with small inboard engines, painted timber houses, keepers at the lights, a fish-canning factory, the 1950s ferry.
// Colours and shapes follow docs/WORLD-1950.md "Looks for the kit"; anything that section marks "not documented" is a designer's
// choice and says so below. No plastic: fibreglass boats come in the late 1960s.
export const F50 = {
  falu: 0xa4513f, faluDark: 0x8a4234, english: 0x8f4a3a, frameGreen: 0x6f8f7a, slate: 0x6f6e7c, white: 0xf0ebdf, ochre: 0xd8b565, grey: 0xb9b2a3, green: 0x6f8f7a, blue: 0x6a86a4, black: 0x34353a,
  hullWhite: 0xeae6da, hullCream: 0xe3d8bc, bottom: 0x8a4b44, tarRoof: 0x5b4b46, tile: 0x9a5a48, brick: 0x9a5a48, brickPale: 0xd9c9a0,
  deck: 0xc7b48f, engine: 0x4f5a52, exhaust: 0x3b3c40, wood: 0xc99a5e, cotton: 0xeee3c8, cottonShade: 0xdfd2b3,
};
const wallWindowsX = (S, G, halfW, y0, zs, w, h, lit = true, offLit = 3) => { // windows on both side walls of a box that runs along z
  for (const side of [1, -1]) {
    S.at({ p: [side * halfW, y0, 0], ry: (side * Math.PI) / 2 }, () => {
      zs.forEach((lz, i) => { const x = side > 0 ? -lz : lz; ((lit && i % offLit !== offLit - 1) ? G.on : G.off).quad([x - w / 2, 0, 0.03], [x + w / 2, 0, 0.03], [x + w / 2, h, 0.03], [x - w / 2, h, 0.03], null); });
    });
  }
};

// A wooden snipa (open working boat) with a small inboard engine: a low engine box, a little wheel shelter, a thin exhaust. ~6.6 m.
export const SNIPA_COLOURS = { white: F50.hullWhite, green: 0x7fa08a, blue: 0x7f9bb8 };
export function addSnipa1950(S, G, { variant = 'white', L = 6.6, lit = true } = {}) {
  const hull = SNIPA_COLOURS[variant] ?? F50.hullWhite;
  const st = hullStations({ L, B: L * 0.32, n: 8, sheer0: 0.55, riseBow: 0.3, riseStern: 0.14, keelD: 0.42, peak: 0.45, pBow: 1.5, pStern: 1.6, sternW0: 0.08 }); // pointed bow, pointed and slightly rounded stern (S50)
  loft(S, st, { bands: [[0.14, F50.hullWhite], [0.3, hull], [0.46, shade(hull, 0.94)], [0.62, hull], [1, F50.bottom]], open: true, floorY: 0.14, floor: F50.deck, pf: 0.5 });
  S.box(0, 0.3, L * 0.1, st[3].w * 1.5, 0.04, 0.28, F50.wood); S.box(0, 0.3, -L * 0.28, st[3].w * 1.4, 0.04, 0.28, F50.wood); // thwarts
  S.box(0, 0.4, L * 0.02, 0.8, 0.46, 0.7, F50.engine); // the engine box
  S.tube([0.2, 0.6, L * 0.02 - 0.2], [0.34, 1.5, L * 0.02 - 0.55], 0.04, 0.035, 4, F50.exhaust); // exhaust
  S.box(0, 0.62, -L * 0.1, 1.0, 0.7, 0.9, hull); // wheel shelter
  S.box(0, 1.0, -L * 0.1, 1.1, 0.05, 1.0, F50.white);
  (lit ? G.on : G.off).quad([-0.4, 0.7, -L * 0.1 + 0.46], [0.4, 0.7, -L * 0.1 + 0.46], [0.4, 0.97, -L * 0.1 + 0.46], [-0.4, 0.97, -L * 0.1 + 0.46], null);
  S.tube([0, 0.2, L / 2 - 0.5], [0, 1.4, L / 2 - 0.4], 0.04, 0.03, 4, F50.wood); // a short stem staff with the flag
  S.tri([0, 1.4, L / 2 - 0.4], [0, 1.15, L / 2 - 0.4], [-0.5, 1.28, L / 2 - 0.55], 0xe8c04f);
}

// A wooden fishing boat (kosterbåt type) with a wheelhouse aft and a mast forward, ~11.5 m. Looks: designer's choice within the era's
// wooden-boat picture (docs/WORLD-1950.md); the hull colours are the part that varies.
export const FISHBOAT_COLOURS = { white: 0xeae6da, dark: 0x2f3b3a, green: 0x5f7f6c }; // white = the documented one (linseed-oil paint above the waterline, a red stripe, a red bottom: S48/S49); the others are designer's choice
export function addFishingBoat1950(S, G, { variant = 'white', L = 11.5, lit = true } = {}) {
  const hull = FISHBOAT_COLOURS[variant] ?? FISHBOAT_COLOURS.white;
  const st = hullStations({ L, B: L * 0.31, n: 10, sheer0: 0.95, riseBow: 0.85, riseStern: 0.25, keelD: 0.85, peak: 0.55, pBow: 1.2, pStern: 1.6, sternW0: 0.28 });
  loft(S, st, { bands: [[0.12, F50.hullWhite], [0.5, hull], [0.58, F50.falu], [1, F50.bottom]], deck: F50.deck, pf: 0.5 }); // the red stripe at the waterline, the red bottom
  const dy = (z) => atZ(st, z, 'sheer');
  const wz = -L * 0.2, base = dy(wz);
  S.box(0, base + 0.95, wz, 2.1, 1.9, 2.3, F50.white); // wheelhouse
  S.box(0, base + 1.98, wz, 2.4, 0.1, 2.6, F50.black);
  S.at({ p: [0, base, wz + 1.16] }, () => { for (const x of [-0.6, 0.6]) (lit ? G.on : G.off).quad([x - 0.4, 1.0, 0.03], [x + 0.4, 1.0, 0.03], [x + 0.4, 1.7, 0.03], [x - 0.4, 1.7, 0.03], null); });
  wallWindowsX(S, G, 1.06, base, [wz - 0.4, wz + 0.4], 0.55, 0.7, lit, 5);
  S.tube([0.5, base + 1.9, wz - 1.5], [0.5, base + 3.6, wz - 1.6], 0.14, 0.12, 6, F50.exhaust); // the funnel
  S.tube([0.5, base + 3.3, wz - 1.58], [0.5, base + 3.45, wz - 1.59], 0.16, 0.16, 6, F50.falu); // its red band
  const mz = L * 0.22;
  S.tube([0, base, mz], [0, base + 7.2, mz], 0.12, 0.07, 6, F50.wood); // mast
  S.tube([0, base + 2.6, mz - 0.05], [0, base + 2.6, mz - 3.2], 0.06, 0.05, 5, F50.wood); // boom
  sail3(S, [0, base + 2.7, mz - 0.08], [0, base + 6.4, mz - 0.08], [0, base + 2.7, mz - 3.0], 0.3, 0xa7714b); // a small tanned steadying sail
  S.box(0, base + 0.25, L * 0.02, 1.5, 0.5, 1.8, F50.grey); // hatch coaming
  for (const [x, z] of [[-1.0, wz - 2.6], [1.0, wz - 2.7], [-0.3, wz - 3.0]]) S.drum(x, base, z, 0.28, 0.5, 6, 0xe48f55); // orange floats
}

// A wooden sailing boat of the time (a folkbåt-like keelboat), cotton sails, varnished mast and boom. ~8 m.
export function addSailboat1950(S, G, { L = 8, sailsUp = true, hull = F50.hullWhite, lit = true } = {}) {
  const st = hullStations({ L, B: L * 0.28, n: 9, sheer0: 0.65, riseBow: 0.32, riseStern: 0.1, keelD: 0.95, peak: 0.45, pBow: 1.4, pStern: 1.7, sternW0: 0.3 });
  loft(S, st, { bands: [[0.16, F50.hullWhite], [0.55, hull], [1, F50.bottom]], deck: F50.deck, pf: 0.55 });
  const dy = (z) => atZ(st, z, 'sheer');
  const cz = L * 0.06, base = dy(cz);
  S.box(0, base + 0.2, cz, L * 0.2, 0.4, L * 0.28, F50.hullWhite); // low doghouse
  wallWindowsX(S, G, L * 0.1, base + 0.1, [cz - 0.3, cz + 0.3], 0.4, 0.2, lit, 4);
  S.box(0, base + 0.02, -L * 0.28, L * 0.18, 0.03, 1.2, F50.deck); // cockpit
  const mz = L * 0.14, top = base + L * 1.1;
  S.tube([0, base, mz], [0, top, mz], 0.06, 0.035, 5, F50.wood);
  const boomY = base + 1.0, boomLen = L * 0.34;
  S.at({ p: [0, 0, mz], ry: 0.28 }, () => {
    S.tube([0, boomY, -0.04], [0, boomY - 0.02, -boomLen], 0.045, 0.04, 4, F50.wood);
    if (sailsUp) quadSail(S, [0, boomY + 0.05, -0.06], [0, top - 0.5, -0.06], [0, top - 0.5, -0.06], [0, boomY + 0.05, -boomLen], 0.34, F50.cotton, 2, 3, (i, j) => ((i + j) % 2 ? F50.cottonShade : F50.cotton)); // panelled cotton
  });
  if (sailsUp) sail3(S, [0, base + 0.35, L / 2 - 0.25], [0, top - 1.0, mz + 0.05], [0.08, base + 0.8, mz - 1.3], 0.26, F50.cottonShade);
}

// The Lysekil-Fiskebackskil ferry of the 1950s. See docs/WORLD-1950.md for what is and is not documented about its name and look; the
// shape here is a small wooden / steel passenger boat of the type (deckhouse forward, open aft deck, a funnel), a designer's choice.
export function addFerry1950(S, G, { L = 17, lit = true } = {}) {
  const B = 4.6;
  const st = hullStations({ L, B, n: 9, sheer0: 1.25, riseBow: 0.5, riseStern: 0.12, keelD: 0.8, tipKeel: 0.15, kp: 5, peak: 0.45, pBow: 1.5, pStern: 2.2, sternW0: 0.7 });
  loft(S, st, { bands: [[0.38, F50.hullWhite], [0.5, F50.black], [1, F50.bottom]], deck: F50.deck, pf: 0.3 });
  const y0 = 1.25;
  const [z0, z1] = [-2.4, 4.4];
  S.box(0, y0 + 1.05, (z0 + z1) / 2, 3.5, 2.1, z1 - z0, F50.white); // saloon
  S.box(0, y0 + 2.15, (z0 + z1) / 2, 3.8, 0.1, z1 - z0 + 0.5, F50.grey);
  wallWindowsX(S, G, 1.76, y0 + 0.7, [-1.4, -0.4, 0.6, 1.6, 2.6, 3.6], 0.7, 0.9, lit, 5);
  S.at({ p: [0, y0, z1 + 0.01] }, () => { for (const x of [-0.9, 0.9]) (lit ? G.on : G.off).quad([x - 0.5, 0.7, 0.03], [x + 0.5, 0.7, 0.03], [x + 0.5, 1.6, 0.03], [x - 0.5, 1.6, 0.03], null); });
  S.box(0, y0 + 2.9, 2.6, 2.2, 1.3, 1.9, F50.white); // wheelhouse
  S.box(0, y0 + 3.6, 2.6, 2.5, 0.08, 2.2, F50.black);
  S.at({ p: [0, y0 + 2.2, 3.56] }, () => { for (const x of [-0.6, 0, 0.6]) (lit ? G.on : G.off).quad([x - 0.25, 0.3, 0.03], [x + 0.25, 0.3, 0.03], [x + 0.25, 1.0, 0.03], [x - 0.25, 1.0, 0.03], null); });
  S.tube([0, y0 + 2.2, 0.0], [0, y0 + 4.6, -0.1], 0.36, 0.3, 8, F50.black); // the funnel
  S.tube([0, y0 + 4.05, -0.07], [0, y0 + 4.3, -0.08], 0.38, 0.38, 8, F50.falu); // a coloured band
  S.tube([0, y0 + 3.6, 3.0], [0, y0 + 5.4, 3.0], 0.05, 0.03, 4, F50.wood); // mast with a flag
  S.tri([0, y0 + 5.4, 3.0], [0, y0 + 5.0, 3.0], [-0.7, y0 + 5.2, 2.8], 0xe8c04f);
  // the open aft deck: benches along both sides and an awning on poles
  for (const side of [1, -1]) { S.box(side * 1.5, y0 + 0.25, -4.8, 0.4, 0.5, 4.2, F50.wood); for (const z of [-6.4, -3.2]) S.tube([side * 1.55, y0, z], [side * 1.55, y0 + 2.1, z], 0.05, 0.05, 4, F50.wood); }
  S.box(0, y0 + 2.12, -4.8, 3.6, 0.06, 4.6, 0xd8d0b8);
}

// ---- houses and the village, 1950 --------------------------------------------------------------------------------
export const HOUSE_1950_COLOURS = { red: F50.english, white: F50.white, ochre: F50.ochre }; // 'English red', white, ochre (docs/WORLD-1950.md E: the municipal advice, not a 1950 survey: uncertain)
// A fishing-village house: one and a half storeys, painted timber, white corner boards and window frames, a dark roof (tar paper or tile),
// a brick chimney. Wall colours falu red / white / ochre per docs/WORLD-1950.md; ~5 x 7 m.
export function addHouse1950(S, G, { colour = 'red', lit = true, seed = 3 } = {}) {
  const wall = HOUSE_1950_COLOURS[colour] ?? F50.english;
  const w = 5, d = 7, h = 3, rh = 1.7;
  shell(S, { w, d, h, rh, eave: 0.4, gableOv: 0.3, wall, roof: F50.tile, roofB: shade(F50.tile, 0.92), bands: 0, found: C.stone, foundD: 1.2 }); // red clay tile
  const trim = F50.white, frame = F50.frameGreen; // white corner boards, green window frames
  for (const [x, z] of [[w / 2, d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [-w / 2, -d / 2]]) S.box(x, h / 2, z, 0.14, h, 0.14, trim);
  S.box(0.6, h + rh * 0.6, -d * 0.25, 0.5, rh + 0.8, 0.5, F50.brick);
  S.at({ p: [0, 0, d / 2] }, () => {
    S.quad([-0.5, 0, 0.03], [0.5, 0, 0.03], [0.5, 2.1, 0.03], [-0.5, 2.1, 0.03], F50.white);
    S.quad([-0.42, 0.05, 0.04], [0.42, 0.05, 0.04], [0.42, 2.05, 0.04], [-0.42, 2.05, 0.04], shade(F50.faluDark, 0.9));
    windowAt(S, G, -1.6, 1.4, 0.8, 1.1, { lit, frame }); windowAt(S, G, 1.6, 1.4, 0.8, 1.1, { lit: lit && seed % 2 === 0, frame });
    windowAt(S, G, 0, h + 0.6, 0.7, 0.7, { lit, frame, mull: false });
  });
  for (const side of [1, -1]) S.at({ p: [side * w / 2, 0, 0], ry: (side * Math.PI) / 2 }, () => { windowAt(S, G, -1.8, 1.4, 0.8, 1.1, { lit: false, frame }); windowAt(S, G, 1.8, 1.4, 0.8, 1.1, { lit: lit && side > 0, frame }); });
}
// The sea-shed (sjöbod) of the 1950 village: falu red, white-trimmed double doors in the sea-facing gable, a short timber landing.
export const SJOBOD_COLOURS = { red: F50.falu, ochre: F50.ochre, wood: 0x9b958a }; // red (or ochre or bare wood), gable to the water, in rows (S40/S41)
export function addSjobod1950(S, G, { colour = 'red', lit = false } = {}) {
  shell(S, { w: 4.4, d: 7, h: 2.6, rh: 1.4, eave: 0.3, gableOv: 0.35, wall: SJOBOD_COLOURS[colour] ?? F50.falu, roof: F50.tarRoof, roofB: shade(F50.tarRoof, 0.92), bands: 0, found: C.stone, foundD: 1.2 });
  S.at({ p: [0, 0, 3.5] }, () => {
    S.quad([-1.2, 0, 0.03], [1.2, 0, 0.03], [1.2, 2.1, 0.03], [-1.2, 2.1, 0.03], F50.white);
    S.quad([-1.1, 0.05, 0.04], [-0.02, 0.05, 0.04], [-0.02, 2.05, 0.04], [-1.1, 2.05, 0.04], shade(F50.faluDark, 0.85));
    S.quad([0.02, 0.05, 0.04], [1.1, 0.05, 0.04], [1.1, 2.05, 0.04], [0.02, 2.05, 0.04], shade(F50.faluDark, 0.85));
    windowAt(S, G, 0, 2.5, 0.5, 0.35, { lit, frame: F50.white, mull: false });
  });
  S.box(0, 0.35, 5.6, 2.2, 0.14, 3.6, C.wood); for (const x of [-0.9, 0.9]) for (const z of [4.1, 5.6, 7.1]) S.tube([x, -0.7, z], [x, 0.3, z], 0.08, 0.08, 4, C.woodDark);
}
// The keeper's house at a manned lighthouse: a one-and-a-half-storey painted timber house with a store beside it, a flagstaff, a landing.
// Colours per light (docs/WORLD-1950.md: Islandsberg white seaward end / red behind; Pater Noster red; most others white); window light at dusk.
export function addKeeperHouse(S, G, { wall = 'red', lit = true } = {}) {
  const col = { white: F50.white, red: F50.falu }[wall] ?? F50.falu;
  S.at({ ry: 0 }, () => {
    shell(S, { w: 5.6, d: 8.4, h: 2.9, rh: 1.8, eave: 0.4, gableOv: 0.3, wall: col, roof: F50.slate, roofB: shade(F50.slate, 0.92), bands: 0, found: C.stone, foundD: 1.4 }); // slate roofs from about 1900 (S02)
    S.box(0.6, 3.9, -2.2, 0.5, 2.0, 0.5, F50.brick);
    S.box(-6.4, 1.6, -3.0, 2.4, 3.2, 2.4, F50.brick); S.box(-6.4, 3.3, -3.0, 2.7, 0.2, 2.7, F50.tarRoof); // the brick siren (fog signal) house, Måseskär 1885
    S.at({ p: [0, 0, 4.2] }, () => { windowAt(S, G, -1.3, 1.4, 0.9, 1.2, { lit, frame: F50.white }); windowAt(S, G, 1.3, 1.4, 0.9, 1.2, { lit, frame: F50.white }); windowAt(S, G, 0, 3.3, 0.7, 0.7, { lit, frame: F50.white, mull: false }); });
    for (const side of [1, -1]) S.at({ p: [side * 2.8, 0, 0], ry: (side * Math.PI) / 2 }, () => { windowAt(S, G, -2, 1.4, 0.9, 1.2, { lit, frame: F50.white }); windowAt(S, G, 2, 1.4, 0.9, 1.2, { lit: lit && side > 0, frame: F50.white }); });
    S.at({ p: [4.6, 0, -1.5] }, () => shell(S, { w: 3, d: 4, h: 2.2, rh: 1.1, eave: 0.3, gableOv: 0.2, wall: F50.falu, roof: F50.slate, roofB: shade(F50.slate, 0.92), bands: 0, found: C.stone, foundD: 1.0 })); // the store
    S.tube([-4.2, 0, 3.5], [-4.2, 7.2, 3.5], 0.07, 0.05, 5, F50.white); // flagstaff
    S.tri([-4.2, 7.2, 3.5], [-4.2, 6.5, 3.5], [-5.3, 6.85, 3.5], 0x3b78b8); S.tri([-4.2, 6.85, 3.5], [-4.2, 6.5, 3.5], [-5.3, 6.7, 3.5], 0xe8c04f);
  });
}
// A fish-canning factory (konservfabrik) at the waterfront: a long two-storey hall, a boiler house with a tall brick chimney, a loading pier
// with a crane, barrels. Looks: see docs/WORLD-1950.md; designer's choice where not documented.
export function addCanningFactory(S, G, { wall = F50.brickPale, lit = true } = {}) {
  shell(S, { w: 9, d: 16, h: 5.2, rh: 2.4, eave: 0.5, gableOv: 0.4, wall, roof: F50.tarRoof, roofB: shade(F50.tarRoof, 0.92), bands: 0, found: C.stone, foundD: 1.6 });
  S.at({ p: [0, 0, 8] }, () => { for (const x of [-2.6, 0, 2.6]) { windowAt(S, G, x, 1.8, 1.1, 1.4, { lit, frame: F50.white }); windowAt(S, G, x, 4.0, 1.1, 1.1, { lit, frame: F50.white, mull: false }); } S.quad([-1.1, 0, 0.05], [1.1, 0, 0.05], [1.1, 2.6, 0.05], [-1.1, 2.6, 0.05], shade(F50.faluDark, 0.9)); });
  for (const side of [1, -1]) S.at({ p: [side * 4.5, 0, 0], ry: (side * Math.PI) / 2 }, () => { for (let i = 0; i < 5; i++) { const x = -5.6 + i * 2.8; windowAt(S, G, x, 1.8, 1.0, 1.3, { lit: lit && i !== 3, frame: F50.white, mull: false }); windowAt(S, G, x, 4.0, 1.0, 1.0, { lit: lit && i !== 1, frame: F50.white, mull: false }); } });
  S.at({ p: [-7.2, 0, -3.5] }, () => shell(S, { w: 4.6, d: 5.6, h: 4.4, rh: 1.2, eave: 0.3, gableOv: 0.2, wall: F50.brick, roof: F50.tarRoof, roofB: shade(F50.tarRoof, 0.92), bands: 0, found: C.stone, foundD: 1.4 }));
  S.tube([-7.2, 0, -3.5], [-7.2, 17, -3.5], 0.7, 0.45, 8, F50.brick); S.tube([-7.2, 16.2, -3.5], [-7.2, 16.5, -3.5], 0.5, 0.5, 8, F50.black); // the chimney
  S.box(0, 0.32, 13.5, 4, 0.14, 11, C.wood); for (const x of [-1.8, 1.8]) for (const z of [9.5, 12, 14.5, 17]) S.tube([x, -0.8, z], [x, 0.3, z], 0.1, 0.1, 4, C.woodDark); // the pier
  S.tube([1.4, 0.4, 16.5], [1.4, 4.0, 16.5], 0.1, 0.08, 5, F50.black); S.tube([1.4, 4.0, 16.5], [1.4, 3.2, 14.6], 0.07, 0.06, 4, F50.black); // a crane
  for (const [x, z] of [[-1.2, 11], [-0.4, 11.9], [-1.2, 12.8]]) S.drum(x, 0.4, z, 0.3, 0.7, 8, C.chest, shade(C.chest, 1.12));
}

// Period sea marks (docs/WORLD-1950.md, "Sea marks"): a buoy or a beacon in the style the 1950s Swedish charts used. A variant is
// "<colour>-<shape>": colour red | green | black | white | yellow, shape cone | can | spar. Which colour and shape marks a port or a
// starboard side comes from data/world-1950.json (the world builder reads it), not from this file; this only draws what it is asked for.
export const BUOY_COLOURS = { red: 0xb54a3c, green: 0x4f8a63, black: 0x2f3034, white: 0xeee8d6, yellow: 0xe0b845, redblack: 0x2f3034 }; // redblack: the red-and-black banded 'kryssprick' (a danger passable on both sides)
export const BUOY_SHAPES = ['cone', 'can', 'spar'];
export const BUOYS_1950 = Object.fromEntries([...Object.keys(BUOY_COLOURS).flatMap((c) => BUOY_SHAPES.map((sh) => [`${c}-${sh}`, { colour: c, shape: sh }]))]);
export function addBuoy1950(S, G, { variant = 'red-cone', topmark = null } = {}) {
  const [colour, shape] = String(variant).split('-');
  const body = BUOY_COLOURS[colour] ?? BUOY_COLOURS.red;
  if (colour === 'redblack') { // horizontal bands, an X (two crossed bars) on top
    for (let i = 0; i < 4; i++) S.tube([0, -0.2 + i * 1.15, 0], [0, -0.2 + (i + 1) * 1.15, 0], 0.1, 0.09, 5, i % 2 ? BUOY_COLOURS.red : BUOY_COLOURS.black);
    S.box(0, 4.55, 0, 1.0, 0.1, 0.1, BUOY_COLOURS.black); S.box(0, 4.55, 0, 0.1, 0.1, 1.0, BUOY_COLOURS.black); S.box(0, 4.7, 0, 0.09, 0.4, 0.09, BUOY_COLOURS.black);
    return;
  }
  if (shape === 'spar') { // a pole (an unlit beacon on a rock, or a pole mark): a stout pole and a broom / cone on top, as the 1923 plate shows
    S.tube([0, -0.2, 0], [0, 4.4, 0], 0.1, 0.06, 5, body);
    if (topmark === 'cone' || topmark == null) S.pyramid(0, 4.2, 0, 0.5, 0.9, 4, body); else S.drum(0, 4.2, 0, 0.35, 0.5, 6, body);
    return;
  }
  S.drum(0, 0, 0, 0.8, 0.5, 10, body); // the float, a drum at the waterline
  S.tube([0, 0.5, 0], [0, 2.1, 0], 0.4, 0.14, 8, body); // its body narrowing to the mast
  S.tube([0, 2.0, 0], [0, 2.9, 0], 0.05, 0.05, 4, F50.black);
  if (shape === 'cone') S.pyramid(0, 2.6, 0, 0.45, 0.6, 8, body); else S.drum(0, 2.6, 0, 0.3, 0.35, 8, body); // the topmark: a cone or a can
}

// ======================================================================================================
//  REGISTRY, createAsset, lab URL
// ======================================================================================================
// frame = a radius (m) that fits the asset on screen; maxTris = its budget (tests); variants / toggles feed the lab panel.
export const ASSETS = {
  sailboat: { era: 'today', label: 'Sailboat', variants: Object.keys(STRIPES), toggles: ['sails'], frame: 6.5, maxTris: 800, fill: (S, G, o) => addSailboat(S, G, { stripe: o.variant, sailsUp: o.sails }) },
  motorboat: { era: 'today', label: 'Motorboat', variants: Object.keys(STRIPES), frame: 4.5, maxTris: 800, fill: (S, G, o) => addMotorboat(S, G, { stripe: o.variant }) },
  ferry: { era: 'today', label: 'Ferry 847', variants: [], frame: 14, maxTris: 3000, fill: (S, G) => addFerry(S, G, {}) },
  guestharbour: { era: 'today', label: 'Guest harbour', variants: [], offset: [0, 0, -9.5], frame: 17, maxTris: 3000, fill: (S, G) => addGuestHarbour(S, G, { perSide: 5 }) },
  summerhouse: { era: 'today', label: 'Summer house', variants: Object.keys(HOUSE_COLOURS), frame: 6.5, maxTris: 800, fill: (S, G, o) => addSummerHouse(S, G, { colour: o.variant }) },
  cottage: { era: '1700', label: 'Cottage', variants: COTTAGE_VARIANTS, frame: 3.8, maxTris: 800, fill: (S, G, o) => addCottage(S, G, { variant: o.variant }) },
  boathouse: { era: '1700', label: 'Sea-shed', variants: [], frame: 6, maxTris: 800, fill: (S, G) => addBoathouse(S, G, {}) },
  racks: { era: '1700', label: 'Drying racks', variants: [], frame: 4.5, maxTris: 800, fill: (S, G) => addDryingRacks(S, G, {}) },
  kummel: { era: '1700', label: 'Kummel', variants: [], frame: 2.4, maxTris: 800, fill: (S, G) => addKummel(S, G, {}) },
  rockmark: { era: '1700', label: 'Painted rock', variants: [], frame: 2.4, maxTris: 800, fill: (S, G) => addRockMark(S, G, {}) },
  eka: { era: '1700', label: 'Eka', variants: EKA_VARIANTS, frame: 3.3, maxTris: 800, fill: (S, G, o) => addEka(S, G, { variant: o.variant }) },
  cargoboat: { era: '1700', label: 'Cargo boat', variants: [], toggles: ['sails'], frame: 8, maxTris: 3000, fill: (S, G, o) => addCargoBoat(S, G, { sailUp: o.sails }) },
  snipa1950: { era: '1950', label: 'Snipa + engine', variants: Object.keys(SNIPA_COLOURS), frame: 4.8, maxTris: 800, fill: (S, G, o) => addSnipa1950(S, G, { variant: o.variant }) },
  fishboat1950: { era: '1950', label: 'Fishing boat', variants: Object.keys(FISHBOAT_COLOURS), frame: 8, maxTris: 3000, fill: (S, G, o) => addFishingBoat1950(S, G, { variant: o.variant }) },
  sailboat1950: { era: '1950', label: 'Wooden sailboat', variants: [], toggles: ['sails'], frame: 6, maxTris: 800, fill: (S, G, o) => addSailboat1950(S, G, { sailsUp: o.sails }) },
  ferry1950: { era: '1950', label: 'Ferry (1950s)', variants: [], frame: 12, maxTris: 3000, fill: (S, G) => addFerry1950(S, G, {}) },
  house1950: { era: '1950', label: 'Village house', variants: Object.keys(HOUSE_1950_COLOURS), frame: 6, maxTris: 800, fill: (S, G, o) => addHouse1950(S, G, { colour: o.variant }) },
  sjobod1950: { era: '1950', label: 'Sea-shed', variants: Object.keys(SJOBOD_COLOURS), frame: 6, maxTris: 800, fill: (S, G, o) => addSjobod1950(S, G, { colour: o.variant }) },
  keeper: { era: '1950', label: 'Keeper\'s house', variants: ['red', 'white'], frame: 7, maxTris: 800, fill: (S, G, o) => addKeeperHouse(S, G, { wall: o.variant }) },
  canning: { era: '1950', label: 'Canning factory', variants: [], frame: 12, maxTris: 3000, fill: (S, G) => addCanningFactory(S, G, {}) },
  buoy1950: { era: '1950', label: 'Sea marks', variants: Object.keys(BUOYS_1950), frame: 3, maxTris: 800, fill: (S, G, o) => addBuoy1950(S, G, { variant: o.variant }) },
  harbourToday: { era: 'scene', label: 'Today harbour', variants: [], frame: 40, maxTris: 12000, fill: (S, G) => addHarbourToday(S, G) },
  harbour1700: { era: 'scene', label: '1700 harbour', variants: [], frame: 40, maxTris: 12000, fill: (S, G) => addHarbour1700(S, G) },
};
export const ASSET_IDS = Object.keys(ASSETS);
export const LAB_ORDER = [...ASSET_IDS.filter((id) => ASSETS[id].era === 'today'), ...ASSET_IDS.filter((id) => ASSETS[id].era === '1950'), ...ASSET_IDS.filter((id) => ASSETS[id].era === '1700'), 'compare'];
export const defaultVariant = (id) => ASSETS[id]?.variants?.[0] ?? '';

// One asset as a THREE.Group: { group, setNight, describe, id, variant }. `night` lights the windows (emissive only).
export function createAsset(id, { variant, sails = true, night = false } = {}) {
  const def = ASSETS[id];
  if (!def) throw new TypeError(`createAsset: unknown asset "${id}" (use ${ASSET_IDS.join(' | ')})`);
  const v = def.variants.includes(variant) ? variant : defaultVariant(id);
  const S = new Mesher();
  const G = newGlass();
  S.peers = [G.on, G.off];
  S.at({ p: def.offset ?? [0, 0, 0] }, () => def.fill(S, G, { variant: v, sails })); // offset: centre the asset on the lab's turntable
  const g = id === 'harbour1700' || def.era === '1700' ? GLASS.y1700 : id === 'harbour1950' || def.era === '1950' ? GLASS.y1950 : GLASS.today;
  const group = new THREE.Group();
  group.name = `era-${id}`;
  group.add(S.build(SOLID_MATERIAL));
  const mats = { on: new THREE.MeshBasicMaterial({ color: g.day, side: THREE.DoubleSide }), off: new THREE.MeshBasicMaterial({ color: g.day, side: THREE.DoubleSide }) };
  for (const k of ['on', 'off']) if (G[k].triangles) { const m = G[k].build(mats[k]); m.castShadow = false; m.receiveShadow = false; m.name = `windows-${k}`; group.add(m); }
  const setNight = (on) => { mats.on.color.setHex(on ? g.lit : g.day); mats.off.color.setHex(on ? g.off : g.day); };
  setNight(night);
  return {
    id, variant: v, group, setNight,
    describe: () => ({ id, variant: v, triangles: S.triangles + G.on.triangles + G.off.triangles, solid: S.triangles, windows: G.on.triangles + G.off.triangles, meshes: group.children.length }),
    dispose: () => { group.traverse((o) => o.geometry?.dispose()); mats.on.dispose(); mats.off.dispose(); },
  };
}

// The Today vs 1700 comparison: both harbours in one group, Today on the far (-z, top of the screen) side, 1700 on the near side.
export const COMPARE_GAP = 38; // metres from the middle to each harbour
export function createCompare({ night = false } = {}) {
  const today = createAsset('harbourToday', { night });
  const old = createAsset('harbour1700', { night });
  today.group.position.z = -COMPARE_GAP;
  old.group.position.z = COMPARE_GAP;
  const group = new THREE.Group();
  group.name = 'era-compare';
  group.add(today.group, old.group);
  return {
    id: 'compare', variant: '', group, today, old,
    setNight: (on) => { today.setNight(on); old.setNight(on); },
    describe: () => { const a = today.describe(), b = old.describe(); return { id: 'compare', variant: '', triangles: a.triangles + b.triangles, today: a.triangles, y1700: b.triangles, meshes: a.meshes + b.meshes }; },
    dispose: () => { today.dispose(); old.dispose(); },
  };
}

// ---- lab URL: ?asset=ferry&v=navy&night=1&cam=game&zoom=1&rot=40&focus=both ... ------------------------------------
export const LAB_DEFAULTS = { asset: 'compare', v: '', sails: 1, night: 0, rot: 40, cam: 'game', zoom: 1, az: 35, el: 30, dist: 20, focus: 'both' };
export const FOCUS = ['both', 'today', '1700'];
const num = (text, lo, hi) => { if (text == null || text.trim() === '') return undefined; const n = Number(text); return Number.isFinite(n) ? clamp(n, lo, hi) : undefined; };
export function parseLabParams(search) {
  const q = new URLSearchParams(search);
  const out = { ...LAB_DEFAULTS };
  const a = q.get('asset');
  if (a === 'compare' || ASSET_IDS.includes(a)) out.asset = a;
  const v = q.get('v');
  out.v = a !== 'compare' && ASSETS[out.asset]?.variants?.includes(v) ? v : defaultVariant(out.asset);
  if (q.get('sails') === '0') out.sails = 0;
  if (q.get('night') === '1') out.night = 1;
  for (const [k, lo, hi] of [['rot', 0, 360], ['zoom', 0.05, 3], ['az', 0, 360], ['el', 4, 88], ['dist', 3, 300]]) { const n = num(q.get(k), lo, hi); if (n !== undefined) out[k] = n; }
  if (q.get('cam') === 'game' || q.get('cam') === 'orbit') out.cam = q.get('cam');
  if (FOCUS.includes(q.get('focus'))) out.focus = q.get('focus');
  return out;
}
const r3 = (n) => Math.round(n * 1000) / 1000;
export function labParamsToSearch(search, s) {
  const params = new URLSearchParams(search);
  for (const k of Object.keys(LAB_DEFAULTS)) params.delete(k);
  for (const [k, def] of Object.entries(LAB_DEFAULTS)) {
    const val = s[k];
    if (val === undefined || val === def) continue;
    if (k === 'v' && val === defaultVariant(s.asset)) continue;
    params.set(k, typeof val === 'number' ? String(r3(val)) : String(val));
  }
  if (s.cam !== 'orbit') for (const k of ['az', 'el', 'dist']) params.delete(k);
  if (s.cam === 'orbit') params.delete('zoom');
  if (s.asset !== 'compare') params.delete('focus');
  const text = params.toString();
  return text ? `?${text}` : '';
}
