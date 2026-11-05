// Boats (Boat Lab, docs/BOAT-BRIEF.md): two hand-built low-poly boats behind the same API as src/boat.js,
// so they can drop into game.js later with one import change.
//
//   createBoatMesh(color, { type: 'koster' | 'eka', rig, deck: [...], night: bool, wear: 0..1 })
//     -> { group, setSailAngle, ...extras }
//
//   "koster"  Svalan, granddad's koster: double-ended, varnished honey clinker planks, white sails, name on
//             the stern quarters. Three rigs to choose from by eye (`rig`): 'gaff-jib' (default), 'sprit-jib', 'gaff'.
//   "eka"     the ~1700 boat: small open clinker boat, tarred dark hull, tanned red-brown spritsail, oars inside.
//
// Both: a pennant at the masthead in `color` (the player colour: the sails no longer carry it), three deck slots
// (fish crate, barrel, chest), a lantern that lights at night, and worn / mended details (patches, one repaired
// plank) that appear as `wear` goes up.
//
// Contract kept from boat.js: the bow faces local +Z; the boom points straight aft at angle 0 and swings about the
// mast by the angle passed to setSailAngle (src/sail.js leewardSign * trim), so the sail is to leeward by
// construction; an Object3D named 'boom-end' marks the clew (boat.test.js, boats.test.js). The waterline is y = 0.
//
// Style (shared/ART.md): flat Lambert, Skagen pastels, no outlines. Per-triangle colours live in one vertex-coloured
// mesh per part, so a boat is ~10 meshes and ~1k triangles. Plank lines are finer than ART.md's 2-5 m facet
// guideline on purpose: the brief asks for visible clinker planks. The lantern is NOT a PointLight (a new light
// recompiles every material in the scene, a hitch on phones): a glowing bulb, an additive halo and a light pool.
import * as THREE from '../vendor/three/three.module.js';
export { BOW_LOCAL_DIRECTION, loadBoatModel } from './boat.js';

export const BOAT_TYPES = ['koster', 'eka'];
export const KOSTER_RIGS = ['gaff-jib', 'sprit-jib', 'gaff'];
export const DECK_ITEMS = ['crate', 'barrel', 'chest']; // slot 0, 1, 2
export const BOAT_DEFAULTS = { type: 'koster', rig: 'gaff-jib', deck: ['crate', 'barrel', null], night: false, wear: 0.5 };
export const NAME_ON_STERN = 'Svalan';

// ---- palette (Skagen: pastel, warm woods against a cool sea) ---------------------------------
const PAL = {
  koster: {
    strakes: [0xe9bd7c, 0xdcab63, 0xd39b53, 0xdcab63, 0xc48848], // top strake (the rail) lightest
    rail: 0xefca90, deck: [0xd6a867, 0xcc9d5c], repair: 0xf5e0ab, coaming: 0xe3b97a, hatch: 0xf2d9a6,
    spar: 0xc99c5e, sail: 0xf7f2e6, sailPatch: [0xe4d9c0, 0xd2c4a2], weather: 0x9b8a78, sailWeather: 0xd5c9ae,
    patch: [0xb4834d, 0xeccf96, 0xa87a47, 0xecc98c, 0xb38048], floor: 0xcfa264,
  },
  eka: {
    strakes: [0x54453b, 0x4b3d34, 0x54453b, 0x3f322a, 0x30261f],
    rail: 0x7a6250, deck: [0x5f4d3e, 0x564536], repair: 0x93754f, coaming: 0x6a5646, hatch: 0x7a6250,
    spar: 0x8a6a45, sail: 0xa65b3c, sailPatch: [0x8a4a30, 0xc07b50, 0x934f35], weather: 0x786656, sailWeather: 0x9a7a5a,
    patch: [0x6e5b4c, 0x8d7456, 0x66554a, 0x95795a, 0x6b594b], floor: 0x66533f,
  },
  crate: 0xdcc79f, crateDark: 0x9a8260, fish: 0xb9cdd6, barrel: 0x9a7248, hoop: 0x55555f, chest: 0x7d5b3f, brass: 0xe0bb62,
  iron: 0x3f3d44, bulbOn: 0xffd48a, bulbOff: 0x8a7c66, halo: 0xffc46b, board: 0x35566a, letters: 0xf5ecd8, oar: 0xc2a577,
};

const col = (hex) => new THREE.Color(hex);
const shade = (hex, f) => { const c = col(hex); c.multiplyScalar(f); return c; };
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, t) => a + (b - a) * t;
const REPAIR_AT = 0.1; // the repaired plank shows from this wear on
const VERTEX_MATERIAL = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });

// ---- Mesher: triangles with per-triangle colours, patches and weathering ---------------------------
class Mesher {
  constructor({ weatherTint = null, weatherK = 0 } = {}) {
    this.pos = [];
    this.meta = [];
    this.weatherTint = weatherTint ? col(weatherTint) : null;
    this.weatherK = weatherK;
    this.mesh = null;
  }
  get triangles() { return this.meta.length; }
  // opt: patch (hex shown when wear >= at), k (how much weathering touches this triangle, default 1)
  tri(a, b, c, base, opt = {}) {
    this.pos.push(...a, ...b, ...c);
    this.meta.push({ base: base instanceof THREE.Color ? base : col(base), patch: opt.patch != null ? col(opt.patch) : null, at: opt.at ?? 0, k: opt.k ?? 1 });
  }
  quad(a, b, c, d, base, opt) { this.tri(a, b, c, base, opt); this.tri(a, c, d, base, opt); }
  box(cx, cy, cz, sx, sy, sz, base, opt) {
    const [x0, x1, y0, y1, z0, z1] = [cx - sx / 2, cx + sx / 2, cy - sy / 2, cy + sy / 2, cz - sz / 2, cz + sz / 2];
    const p = (x, y, z) => [x, y, z];
    const v = [p(x0, y0, z0), p(x1, y0, z0), p(x1, y1, z0), p(x0, y1, z0), p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1)];
    for (const f of [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]]) this.quad(v[f[0]], v[f[1]], v[f[2]], v[f[3]], base, opt);
  }
  // A tapered tube between two points, `sides` flat faces.
  tube(p0, p1, r0, r1, sides, base, opt) {
    const a = new THREE.Vector3(...p0);
    const b = new THREE.Vector3(...p1);
    const axis = b.clone().sub(a).normalize();
    const ref = Math.abs(axis.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(axis, ref).normalize();
    const w = new THREE.Vector3().crossVectors(axis, u).normalize();
    const ring = (c, r, i) => { const ang = (i / sides) * Math.PI * 2; return c.clone().addScaledVector(u, Math.cos(ang) * r).addScaledVector(w, Math.sin(ang) * r).toArray(); };
    for (let i = 0; i < sides; i++) this.quad(ring(a, r0, i), ring(a, r0, i + 1), ring(b, r1, i + 1), ring(b, r1, i), base, opt);
  }
  // Colour of triangle i at this wear: its patch if the patch is "on", else base weathered toward the tint.
  colorAt(i, wear) {
    const m = this.meta[i];
    if (m.patch && wear >= m.at) return m.patch;
    if (!this.weatherTint || !m.k) return m.base;
    return m.base.clone().lerp(this.weatherTint, this.weatherK * wear * m.k);
  }
  build(material = VERTEX_MATERIAL, wear = 0) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(this.pos.length).fill(0), 3));
    g.computeVertexNormals(); // non-indexed: one normal per triangle = flat shading
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.paint(wear);
    return this.mesh;
  }
  paint(wear) {
    const attr = this.mesh.geometry.attributes.color;
    for (let i = 0; i < this.meta.length; i++) {
      const c = this.colorAt(i, wear);
      for (let v = 0; v < 3; v++) attr.setXYZ(i * 3 + v, c.r, c.g, c.b);
    }
    attr.needsUpdate = true;
  }
  // Move triangle i's corners (sails billow: the topology stays, the positions change).
  setTri(i, a, b, c) {
    const p = this.mesh.geometry.attributes.position;
    p.setXYZ(i * 3, ...a); p.setXYZ(i * 3 + 1, ...b); p.setXYZ(i * 3 + 2, ...c);
  }
  finishMoves() { this.mesh.geometry.attributes.position.needsUpdate = true; this.mesh.geometry.computeVertexNormals(); this.mesh.geometry.computeBoundingSphere(); }
}

// ---- hull ----------------------------------------------------------------------------------------
const COLS = 12; // stations, stern to bow
const LIP = 1.045; // each strake's lower edge sticks out this much: the clinker overlap

const SPECS = {
  koster: {
    z0: -3.4, len: 7.0, peak: 0.46, W: 1.18, pStern: 2.1, pBow: 2.3, strakes: 5, lantern: [0, 0.95, -3.0],
    sheer: (u) => 0.5 + 0.28 * u * u + 0.35 * Math.max(0, u) ** 3 + 0.12 * Math.max(0, -u) ** 2,
    keel: (u) => -0.5 + 0.55 * Math.abs(u) ** 3.2,
    mastZ: 0.7,
  },
  eka: {
    z0: -2.3, len: 4.8, peak: 0.5, W: 0.62, pStern: 1.7, pBow: 2.4, strakes: 4, lantern: [0, 1.0, 2.0], floorY: 0.1,
    sheer: (u) => 0.42 + 0.16 * u * u + 0.28 * Math.max(0, u) ** 3 + 0.06 * Math.max(0, -u) ** 2,
    keel: (u) => -0.26 + 0.3 * Math.abs(u) ** 3.2,
    mastZ: 1.05,
  },
};
// Patches: [side, strake, station, wear it appears at]. The repaired plank: one strake, a run of stations.
const HULL_PATCHES = {
  koster: [[1, 0, 7, 0.2], [-1, 1, 3, 0.35], [1, 2, 4, 0.5], [1, 0, 3, 0.65], [1, 1, 9, 0.8]],
  eka: [[1, 0, 6, 0.2], [-1, 1, 4, 0.35], [1, 1, 7, 0.5], [1, 2, 3, 0.65], [-1, 0, 7, 0.8]],
};
const REPAIR = { koster: { side: 1, strake: 1, from: 3, to: 7 }, eka: { side: 1, strake: 1, from: 2, to: 5 } };

function planOf(spec, s) {
  const v = s < spec.peak ? (s - spec.peak) / spec.peak : (s - spec.peak) / (1 - spec.peak); // -1 stern .. 0 widest .. +1 bow
  const u = 2 * s - 1;
  const w = spec.W * Math.max(0, 1 - Math.abs(v) ** (v < 0 ? spec.pStern : spec.pBow));
  return { w, sheer: spec.sheer(u), keel: spec.keel(u), z: spec.z0 + s * spec.len };
}
const crossX = (t) => Math.cos((t * Math.PI) / 2) ** 0.55; // half-beam factor from sheer (0) down to the keel (1)
// A point on the hull skin: station s (0 stern .. 1 bow), depth t (0 sheer .. 1 keel), side +1 / -1.
export function hullPoint(spec, s, t, side, lip = 1) {
  const p = planOf(spec, s);
  return [side * p.w * crossX(t) * lip, p.sheer - (p.sheer - p.keel) * t, p.z];
}
export const specOf = (type) => SPECS[type];
const deckY = (spec, z) => planOf(spec, (z - spec.z0) / spec.len).sheer - 0.07;

function hullParts(type) {
  const spec = SPECS[type];
  const pal = PAL[type];
  const R = spec.strakes;
  const hull = new Mesher({ weatherTint: pal.weather, weatherK: 0.2 });
  const rep = REPAIR[type];
  const patches = HULL_PATCHES[type];
  for (const side of [-1, 1]) {
    for (let k = 0; k < R; k++) {
      for (let c = 0; c < COLS - 1; c++) {
        const s0 = c / (COLS - 1);
        const s1 = (c + 1) / (COLS - 1);
        const lipK = k < R - 1 ? LIP : 1;
        const A = hullPoint(spec, s0, k / R, side);
        const B = hullPoint(spec, s1, k / R, side);
        const Cc = hullPoint(spec, s1, (k + 1) / R, side, lipK);
        const D = hullPoint(spec, s0, (k + 1) / R, side, lipK);
        // plank butt joints: neighbouring planks differ a little in tone
        const tone = 1 + (((c + 2 * k + (side > 0 ? 1 : 0)) % 4) - 1.5) * 0.018;
        const base = shade(pal.strakes[k], tone);
        let opt;
        const pi = patches.findIndex((p) => p[0] === side && p[1] === k && p[2] === c);
        if (pi >= 0) opt = { patch: pal.patch[pi], at: patches[pi][3] };
        else if (side === rep.side && k === rep.strake && c >= rep.from && c <= rep.to) opt = { patch: pal.repair, at: REPAIR_AT };
        hull.quad(A, B, Cc, D, base, opt);
        if (k < R - 1) { // the ledge under the overlap: closes the slit between strakes and draws a shadow line under each plank
          const Ai = hullPoint(spec, s0, (k + 1) / R, side);
          const Bi = hullPoint(spec, s1, (k + 1) / R, side);
          hull.quad(D, Cc, Bi, Ai, shade(pal.strakes[k], 0.7), { k: 0.6 });
        }
      }
    }
  }
  return { spec, hull };
}

// Deck (koster) planks; the eka gets a floor of boards instead.
function deckParts(type) {
  const spec = SPECS[type];
  const pal = PAL[type];
  const m = new Mesher({ weatherTint: pal.weather, weatherK: 0.2 });
  if (type === 'koster') {
    const N = 7; // planks across
    for (let c = 0; c < COLS - 1; c++) {
      const row = (s, i) => {
        const p = planOf(spec, s);
        const x = (i / N * 2 - 1) * p.w * 0.93;
        return [x, p.sheer - 0.07 + 0.07 * (1 - (x / Math.max(p.w * 0.93, 1e-3)) ** 2), p.z];
      };
      // long planks: tone alternates across the deck (by i); only an occasional butt joint breaks along a plank
      for (let i = 0; i < N; i++) m.quad(row(c / (COLS - 1), i), row((c + 1) / (COLS - 1), i), row((c + 1) / (COLS - 1), i + 1), row(c / (COLS - 1), i + 1), shade(pal.deck[i % 2], (c + 3 * i) % 5 === 0 ? 0.96 : 1));
    }
    // toe rail: a flat top along each edge, over the sheer line
    for (const side of [-1, 1]) {
      for (let c = 0; c < COLS - 1; c++) {
        const a = planOf(spec, c / (COLS - 1));
        const b = planOf(spec, (c + 1) / (COLS - 1));
        m.quad([side * a.w * 1.02, a.sheer + 0.01, a.z], [side * b.w * 1.02, b.sheer + 0.01, b.z], [side * b.w * 0.9, b.sheer + 0.01, b.z], [side * a.w * 0.9, a.sheer + 0.01, a.z], pal.rail);
      }
    }
  } else {
    // gunwale: a narrow lighter rail along the sheer
    for (const side of [-1, 1]) {
      for (let c = 0; c < COLS - 1; c++) {
        const a = planOf(spec, c / (COLS - 1));
        const b = planOf(spec, (c + 1) / (COLS - 1));
        m.quad([side * a.w * 1.03, a.sheer + 0.012, a.z], [side * b.w * 1.03, b.sheer + 0.012, b.z], [side * b.w * 0.86, b.sheer + 0.012, b.z], [side * a.w * 0.86, a.sheer + 0.012, a.z], pal.rail);
      }
    }
    // The sole: boards ABOVE the waterline across the whole inside. The sea plane is opaque at y = 0, so a floor below it
    // would show water inside the boat.
    const fy = spec.floorY;
    const NB = 4;
    for (let c = 0; c < COLS - 1; c++) {
      const row = (s, i) => { const p = planOf(spec, s); const t = clamp01((p.sheer - fy) / (p.sheer - p.keel)); return [((i / NB) * 2 - 1) * p.w * crossX(t) * 0.97, fy, p.z]; };
      for (let i = 0; i < NB; i++) m.quad(row(c / (COLS - 1), i), row((c + 1) / (COLS - 1), i), row((c + 1) / (COLS - 1), i + 1), row(c / (COLS - 1), i + 1), shade(pal.deck[i % 2], (c + 2 * i) % 5 === 0 ? 0.93 : 1));
    }
  }
  return m;
}

// Fixtures that stay put: koster cuddy + tiller + bowsprit stub; eka thwarts + stem/stern posts + oars.
function fixturesParts(type) {
  const spec = SPECS[type];
  const pal = PAL[type];
  const m = new Mesher({ weatherTint: pal.weather, weatherK: 0.15 });
  if (type === 'koster') {
    const dy = deckY(spec, -1.35) + 0.07;
    m.box(0, dy + 0.17, -1.35, 1.06, 0.34, 1.12, pal.coaming); // cuddy coaming
    m.box(0, dy + 0.37, -1.35, 0.9, 0.05, 0.96, pal.hatch); // hatch lid
    // stem and stern posts: a stout post at each pointed end
    for (const z of [spec.z0 + 0.12, spec.z0 + spec.len - 0.1]) {
      const p = planOf(spec, (z - spec.z0) / spec.len);
      m.box(0, p.sheer - 0.08, z, 0.09, 0.34, 0.12, pal.rail);
    }
  } else {
    const thw = [-1.2, -0.1, 1.15];
    for (const z of thw) {
      const p = planOf(spec, (z - spec.z0) / spec.len);
      m.box(0, 0.27, z, p.w * crossX(0.3) * 1.9, 0.045, 0.3, pal.coaming); // thwart
    }
    for (const z of [spec.z0 + 0.1, spec.z0 + spec.len - 0.1]) {
      const p = planOf(spec, (z - spec.z0) / spec.len);
      m.box(0, p.sheer - 0.04, z, 0.07, 0.26, 0.1, pal.rail);
    }
    // two oars lying inside along the thwarts, blades staggered fore and aft
    for (const [x, dir] of [[0.27, 1], [-0.27, -1]]) {
      m.tube([x, 0.325, -1.5 * dir], [x, 0.325, 1.5 * dir], 0.028, 0.028, 4, PAL.oar);
      m.box(x, 0.325, 1.55 * dir + 0.14 * dir, 0.2, 0.018, 0.5, PAL.oar); // blade
    }
  }
  return m;
}

// ---- deck items, lantern, name plaque -------------------------------------------------------------
function itemMesher(kind, scale) {
  const m = new Mesher();
  if (kind === 'crate') {
    m.box(0, 0.17, 0, 0.62, 0.34, 0.42, PAL.crate);
    for (const z of [-0.12, 0, 0.12]) m.box(0, 0.345, z, 0.64, 0.02, 0.05, PAL.crateDark);
    m.box(-0.12, 0.37, 0.03, 0.22, 0.04, 0.1, PAL.fish); // a catch showing
    m.box(0.14, 0.37, -0.05, 0.18, 0.04, 0.09, PAL.fish);
  } else if (kind === 'barrel') {
    const radii = [0.24, 0.295, 0.315, 0.295, 0.24];
    const ys = [0, 0.16, 0.31, 0.46, 0.62];
    const N = 8;
    const ring = (i, a) => [Math.cos((a / N) * Math.PI * 2) * radii[i], ys[i], Math.sin((a / N) * Math.PI * 2) * radii[i]];
    for (let i = 0; i < radii.length - 1; i++) {
      for (let a = 0; a < N; a++) m.quad(ring(i, a), ring(i, a + 1), ring(i + 1, a + 1), ring(i + 1, a), i === 0 || i === radii.length - 2 ? PAL.hoop : PAL.barrel);
    }
    for (let a = 0; a < N; a++) m.tri([0, ys[4], 0], ring(4, a), ring(4, a + 1), shade(PAL.barrel, 1.12));
  } else {
    m.box(0, 0.15, 0, 0.7, 0.3, 0.4, PAL.chest);
    // arched lid: a roof-shaped prism along x
    const [x0, x1] = [-0.35, 0.35];
    m.quad([x0, 0.3, -0.2], [x1, 0.3, -0.2], [x1, 0.4, 0], [x0, 0.4, 0], shade(PAL.chest, 1.1));
    m.quad([x0, 0.4, 0], [x1, 0.4, 0], [x1, 0.3, 0.2], [x0, 0.3, 0.2], shade(PAL.chest, 0.95));
    m.tri([x0, 0.3, -0.2], [x0, 0.4, 0], [x0, 0.3, 0.2], PAL.chest);
    m.tri([x1, 0.3, -0.2], [x1, 0.3, 0.2], [x1, 0.4, 0], PAL.chest);
    for (const x of [-0.22, 0.22]) m.box(x, 0.2, 0, 0.05, 0.42, 0.42, PAL.brass); // brass bands
    m.box(0, 0.27, 0.205, 0.1, 0.1, 0.02, PAL.brass); // clasp
  }
  const mesh = m.build();
  mesh.scale.setScalar(scale);
  return { mesher: m, mesh };
}
const ITEM_SLOTS = {
  koster: [[0, 1.8], [0.42, -0.05], [0, -2.5]], // [x, z] on deck
  eka: [[0, 1.85], [0, 0.55], [0, -1.75]], // on the floorboards
};
const ITEM_SCALE = { koster: 1, eka: 0.55 };
const slotY = (type, z) => (type === 'koster' ? deckY(SPECS.koster, z) + 0.06 : SPECS.eka.floorY);

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
      grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      glowTexture = new THREE.CanvasTexture(c);
    }
  }
  return glowTexture;
}

function lanternParts(type) {
  const spec = SPECS[type];
  const [lx, ly, lz] = spec.lantern;
  const group = new THREE.Group();
  group.name = 'lantern';
  group.position.set(lx, ly, lz);
  const frame = new Mesher();
  const baseY = (type === 'koster' ? deckY(spec, lz) : slotY('eka', lz)) - ly; // the post stands on the deck / floor
  frame.tube([0, baseY + 0.02, 0], [0, 0.0, 0], 0.025, 0.025, 4, PAL.iron); // post
  frame.box(0, 0.0, 0, 0.17, 0.03, 0.17, PAL.iron); // base plate
  frame.tri([-0.1, 0.17, -0.1], [0.1, 0.17, -0.1], [0, 0.28, 0], PAL.iron); // roof
  frame.tri([0.1, 0.17, -0.1], [0.1, 0.17, 0.1], [0, 0.28, 0], PAL.iron);
  frame.tri([0.1, 0.17, 0.1], [-0.1, 0.17, 0.1], [0, 0.28, 0], PAL.iron);
  frame.tri([-0.1, 0.17, 0.1], [-0.1, 0.17, -0.1], [0, 0.28, 0], PAL.iron);
  const frameMesh = frame.build();
  frameMesh.name = 'lantern-frame';
  const bulbMat = new THREE.MeshBasicMaterial({ color: PAL.bulbOff });
  const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.11), bulbMat);
  bulb.name = 'lantern-bulb';
  bulb.position.y = 0.09;
  const glowMap = getGlowTexture();
  // soft halo around the flame (a camera-facing sprite) and a pool of light on the deck / floor: no real light, see header
  const haloMat = new THREE.SpriteMaterial({ map: glowMap, color: PAL.halo, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const halo = new THREE.Sprite(haloMat);
  halo.name = 'lantern-halo';
  halo.scale.setScalar(type === 'koster' ? 3.0 : 2.4);
  halo.position.y = 0.1;
  const poolMat = new THREE.MeshBasicMaterial({ map: glowMap, color: PAL.halo, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(type === 'koster' ? 3.4 : 2.6, type === 'koster' ? 3.4 : 2.6), poolMat);
  pool.name = 'lantern-pool';
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = baseY + 0.05;
  group.add(frameMesh, bulb, halo, pool);
  const set = (lit) => { bulbMat.color.setHex(lit ? PAL.bulbOn : PAL.bulbOff); halo.visible = lit; pool.visible = lit; };
  return { group, set };
}

let nameTexture;
function getNameTexture() {
  if (nameTexture !== undefined) return nameTexture;
  nameTexture = null;
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 116;
    const g = c.getContext('2d');
    if (g) {
      g.fillStyle = `#${PAL.board.toString(16).padStart(6, '0')}`;
      g.fillRect(0, 0, c.width, c.height);
      g.strokeStyle = `#${PAL.brass.toString(16).padStart(6, '0')}`;
      g.lineWidth = 5;
      g.strokeRect(8, 8, c.width - 16, c.height - 16);
      g.fillStyle = `#${PAL.letters.toString(16).padStart(6, '0')}`;
      g.font = 'italic 700 78px Georgia, "Times New Roman", serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(NAME_ON_STERN, c.width / 2, c.height / 2 + 4);
      nameTexture = new THREE.CanvasTexture(c);
      nameTexture.colorSpace = THREE.SRGBColorSpace;
    }
  }
  return nameTexture;
}
// Two plaques (one per side) following the hull's skin near the stern, text reading bow-to-stern from outside.
function namePlaques() {
  const spec = SPECS.koster;
  const tex = getNameTexture();
  const mat = new THREE.MeshLambertMaterial({ map: tex, color: tex ? 0xffffff : PAL.board, side: THREE.DoubleSide, flatShading: true });
  const pos = [];
  const uv = [];
  const NSEG = 4;
  for (const side of [-1, 1]) {
    for (let i = 0; i < NSEG; i++) {
      const s0 = 0.08 + (i / NSEG) * 0.26;
      const s1 = 0.08 + ((i + 1) / NSEG) * 0.26;
      const pt = (s, t) => { const p = hullPoint(spec, s, t, side); p[0] += side * 0.03; return p; };
      const a = pt(s0, 0.07), b = pt(s1, 0.07), c = pt(s1, 0.4), d = pt(s0, 0.4);
      const u = (k) => (side > 0 ? 1 - k / NSEG : k / NSEG); // +x side: text runs toward -z
      pos.push(...a, ...b, ...c, ...a, ...c, ...d);
      uv.push(u(i), 0, u(i + 1), 0, u(i + 1), 1, u(i), 0, u(i + 1), 1, u(i), 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'name-plaques';
  mesh.receiveShadow = true;
  return mesh;
}

// ---- rigs ----------------------------------------------------------------------------------------
// Points are [y, z] in the sail pivot's frame (origin = mast step on deck; z negative = aft).
// T tack, C clew, H head (throat), P peak. spars: [from, to, radius].
const RIGS = {
  'gaff-jib': {
    mastZ: 0.7, mastH: 5.0, boomY: 1.05, boomLen: 3.0, jib: true, bowsprit: true,
    T: [1.12, 0], C: [1.1, -3.0], H: [3.1, 0], P: [4.0, -1.68],
    spars: [[[3.1, 0.02], [4.0, -1.7], 0.045]], bellyMax: 0.42,
  },
  'sprit-jib': {
    mastZ: 0.7, mastH: 4.8, boomY: 1.05, boomLen: 3.0, jib: true, bowsprit: true,
    T: [1.12, 0], C: [1.1, -3.0], H: [3.9, 0], P: [4.5, -1.95],
    spars: [[[1.45, 0.05], [4.55, -1.97], 0.062]], follow: true, sparTone: 0.72, bellyMax: 0.42, // the sprit is the rig's signature: a bold, darker diagonal across the sail
  },
  gaff: {
    mastZ: 1.1, mastH: 5.4, boomY: 1.05, boomLen: 3.7, jib: false, bowsprit: false,
    T: [1.12, 0], C: [1.1, -3.7], H: [3.4, 0], P: [4.45, -2.15],
    spars: [[[3.4, 0.02], [4.5, -2.17], 0.045]], bellyMax: 0.5,
  },
  eka: {
    mastZ: 1.05, mastH: 3.9, boomY: 0.68, boomLen: 2.2, jib: false, bowsprit: false,
    T: [0.74, 0], C: [0.72, -2.2], H: [2.8, 0], P: [3.3, -1.45],
    spars: [[[0.95, 0.03], [3.32, -1.47], 0.035]], bellyMax: 0.34,
  },
};
// Sail patches: [u cell, v cell, wear it appears at] on the 4x4 main grid; jib patches by triangle index.
const SAIL_PATCHES = [[1, 1, 0.3], [3, 0, 0.55], [2, 3, 0.8]];
const JIB_PATCHES = [[4, 0.45]];
const NU = 4;
const NV = 4;
const JN = 3;
const bump = (u, v) => Math.sin(Math.PI * u) ** 0.9 * Math.sin(Math.PI * v) ** 0.7;

function makeMainSail(rig, pal) {
  const m = new Mesher({ weatherTint: pal.sailWeather, weatherK: 0.22 });
  for (let j = 0; j < NV; j++) {
    for (let i = 0; i < NU; i++) {
      const pi = SAIL_PATCHES.findIndex((p) => p[0] === i && p[1] === j);
      const opt = pi >= 0 ? { patch: pal.sailPatch[pi % pal.sailPatch.length], at: SAIL_PATCHES[pi][2] } : undefined;
      const z = [0, 0, 0];
      m.tri(z, z, z, pal.sail, opt);
      m.tri(z, z, z, pal.sail, opt);
    }
  }
  const at = (u, v, x) => {
    const foot = [lerp(rig.T[0], rig.C[0], u), lerp(rig.T[1], rig.C[1], u)];
    const head = [lerp(rig.H[0], rig.P[0], u), lerp(rig.H[1], rig.P[1], u)];
    return [x * bump(u, v), lerp(foot[0], head[0], v), lerp(foot[1], head[1], v)];
  };
  const update = (side, amount) => {
    const x = side * amount;
    for (let j = 0; j < NV; j++) {
      for (let i = 0; i < NU; i++) {
        const a = at(i / NU, j / NV, x), b = at((i + 1) / NU, j / NV, x), c = at((i + 1) / NU, (j + 1) / NV, x), d = at(i / NU, (j + 1) / NV, x);
        const k = (j * NU + i) * 2;
        m.setTri(k, a, b, c);
        m.setTri(k + 1, a, c, d);
      }
    }
    m.finishMoves();
  };
  return { mesher: m, update };
}

function makeJib(pal) {
  const m = new Mesher({ weatherTint: pal.sailWeather, weatherK: 0.22 });
  const tris = JN * JN;
  for (let t = 0; t < tris; t++) {
    const pi = JIB_PATCHES.findIndex((p) => p[0] === t);
    m.tri([0, 0, 0], [0, 0, 0], [0, 0, 0], pal.sail, pi >= 0 ? { patch: pal.sailPatch[1], at: JIB_PATCHES[pi][1] } : undefined);
  }
  // T tack, H head, C clew in boat space; belly pushes the middle to leeward.
  const update = (T, H, C, side, amount) => {
    const P = (i, k) => {
      const wH = k / JN, wC = i / JN, wT = 1 - wH - wC;
      const x = side * amount * 27 * wT * wC * wH;
      return [T[0] * wT + H[0] * wH + C[0] * wC + x, T[1] * wT + H[1] * wH + C[1] * wC, T[2] * wT + H[2] * wH + C[2] * wC];
    };
    let t = 0;
    for (let k = 0; k < JN; k++) {
      for (let i = 0; i < JN - k; i++) {
        m.setTri(t++, P(i, k), P(i + 1, k), P(i, k + 1));
        if (i < JN - k - 1) m.setTri(t++, P(i + 1, k), P(i + 1, k + 1), P(i, k + 1));
      }
    }
    m.finishMoves();
  };
  return { mesher: m, update };
}

// A spar that lies ON the sail (the sprit): its vertices follow the sail's belly, so it shows from both sides instead of
// hiding behind the billowing cloth. lambda = how far along the spar a vertex is; the belly there is bump(lambda, lambda).
function makeFollowSpar(a, b, r, color, pal) {
  const m = new Mesher({ weatherTint: pal.weather, weatherK: 0.1 });
  const N = 6;
  const at = (k) => [0, lerp(a[0], b[0], k / N), lerp(a[1], b[1], k / N)];
  for (let k = 0; k < N; k++) m.tube(at(k), at(k + 1), lerp(r * 1.2, r * 0.8, k / N), lerp(r * 1.2, r * 0.8, (k + 1) / N), 5, color);
  const mesh = m.build();
  const pos = mesh.geometry.attributes.position;
  const base = Float32Array.from(pos.array);
  const L2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
  const lam = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) lam[i] = clamp01(((base[i * 3 + 1] - a[0]) * (b[0] - a[0]) + (base[i * 3 + 2] - a[1]) * (b[1] - a[1])) / L2);
  const update = (side, amount) => {
    for (let i = 0; i < pos.count; i++) pos.setX(i, base[i * 3] + side * amount * bump(lam[i], lam[i]));
    pos.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.geometry.computeBoundingSphere();
  };
  return { mesher: m, mesh, update };
}

function pennantMesh(color) {
  const g = new THREE.BufferGeometry();
  const L = 1.1, H = 0.2, n = 0.74;
  const TF = [0, H, 0], BF = [0, -H, 0], TT = [0, H, -L], BT = [0, -H, -L], N = [0, 0, -L * n];
  g.setAttribute('position', new THREE.Float32BufferAttribute([...TF, ...BF, ...N, ...TF, ...N, ...TT, ...BF, ...BT, ...N], 3));
  g.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ color, flatShading: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, mat);
  mesh.castShadow = true;
  mesh.name = 'pennant';
  return mesh;
}

// ---- the boat ------------------------------------------------------------------------------------
function disposeObject(o) {
  o.traverse((n) => { if (n.geometry) n.geometry.dispose(); });
}

export function createBoatMesh(color = 0xffcc66, options = {}) {
  const opts = { ...BOAT_DEFAULTS, ...options };
  const type = opts.type;
  if (!BOAT_TYPES.includes(type)) throw new TypeError(`createBoatMesh: unknown boat type "${type}" (use ${BOAT_TYPES.join(' | ')})`);
  const spec = SPECS[type];
  const pal = PAL[type];
  let rigName = type === 'eka' ? 'eka' : opts.rig;
  if (type === 'koster' && !KOSTER_RIGS.includes(rigName)) throw new TypeError(`createBoatMesh: unknown koster rig "${rigName}" (use ${KOSTER_RIGS.join(' | ')})`);
  let wear = clamp01(Number.isFinite(opts.wear) ? opts.wear : BOAT_DEFAULTS.wear);
  let night = !!opts.night;
  let lastAngle = 0;

  const group = new THREE.Group();
  group.name = `boat-${type}`;
  const paintables = []; // meshers whose colours follow `wear`

  const { hull } = hullParts(type);
  group.add(hull.build(VERTEX_MATERIAL, wear));
  paintables.push(hull);
  const deck = deckParts(type);
  group.add(deck.build(VERTEX_MATERIAL, wear));
  paintables.push(deck);
  const fixtures = fixturesParts(type);
  group.add(fixtures.build(VERTEX_MATERIAL, wear));
  paintables.push(fixtures);
  if (type === 'koster') group.add(namePlaques());

  // deck slots with items
  const itemsGroup = new THREE.Group();
  itemsGroup.name = 'deck-items';
  group.add(itemsGroup);
  let deckList = [];
  function setDeck(list) {
    for (const child of [...itemsGroup.children]) { itemsGroup.remove(child); disposeObject(child); }
    deckList = [];
    for (let slot = 0; slot < DECK_ITEMS.length; slot++) {
      const item = list?.[slot] ?? null;
      deckList.push(item);
      if (item == null) continue;
      if (!DECK_ITEMS.includes(item)) throw new TypeError(`createBoatMesh: unknown deck item "${item}" (use ${DECK_ITEMS.join(' | ')})`);
      const { mesh } = itemMesher(item, ITEM_SCALE[type]);
      const [x, z] = ITEM_SLOTS[type][slot];
      mesh.position.set(x, slotY(type, z), z);
      mesh.rotation.y = [0.3, -0.4, 0.1][slot];
      mesh.name = `item-${item}`;
      itemsGroup.add(mesh);
    }
  }
  setDeck(opts.deck);

  // lantern
  const lantern = lanternParts(type);
  group.add(lantern.group);
  lantern.set(night);

  // sail pivot at the mast step; rig parts rebuilt by setRig()
  const pivot = new THREE.Group();
  pivot.name = 'sail-pivot';
  group.add(pivot);
  const boomEnd = new THREE.Object3D();
  boomEnd.name = 'boom-end';
  const pennantPivot = new THREE.Group();
  pennantPivot.name = 'pennant-pivot';
  group.add(pennantPivot);
  const pennant = pennantMesh(color);
  pennantPivot.add(pennant);
  const rigRoot = new THREE.Group();
  rigRoot.name = 'rig';
  group.add(rigRoot);
  let main = null;
  let jib = null;
  let rig = null;
  let jibGeom = null;
  let followSpar = null;
  let rigMeshers = [];

  function setRig(name) {
    if (type === 'eka') name = 'eka';
    else if (!KOSTER_RIGS.includes(name)) throw new TypeError(`setRig: unknown koster rig "${name}"`);
    for (const m of rigMeshers) paintables.splice(paintables.indexOf(m), 1);
    rigMeshers = [];
    for (const child of [...rigRoot.children]) { rigRoot.remove(child); disposeObject(child); }
    for (const child of [...pivot.children]) { pivot.remove(child); disposeObject(child); }
    rigName = name;
    rig = RIGS[name];
    const dY = type === 'koster' ? deckY(spec, rig.mastZ) + 0.07 : spec.floorY;
    pivot.position.set(0, dY, rig.mastZ);
    // mast + fixed spars
    const wood = new Mesher({ weatherTint: pal.weather, weatherK: 0.1 });
    wood.tube([0, dY - (type === 'eka' ? 0.05 : 0), rig.mastZ], [0, dY + rig.mastH, rig.mastZ], 0.085, 0.05, 6, pal.spar);
    if (rig.bowsprit) {
      const bs = planOf(spec, 1);
      wood.tube([0, bs.sheer - 0.12, spec.z0 + spec.len - 0.7], [0, bs.sheer + 0.12, spec.z0 + spec.len + 0.95], 0.06, 0.035, 5, pal.spar);
    }
    rigRoot.add(wood.build(VERTEX_MATERIAL, wear));
    rigMeshers.push(wood);
    // boom + gaff / sprit swing with the sail, in the pivot
    const swing = new Mesher({ weatherTint: pal.weather, weatherK: 0.1 });
    swing.tube([0, rig.boomY, 0.05], [0, rig.boomY - 0.01, -rig.boomLen], 0.05, 0.04, 5, pal.spar);
    followSpar = null;
    for (const [a, b, r] of rig.spars) {
      const tone = rig.sparTone ? shade(pal.spar, rig.sparTone) : pal.spar;
      if (rig.follow) { followSpar = makeFollowSpar(a, b, r, tone, pal); pivot.add(followSpar.mesh); rigMeshers.push(followSpar.mesher); followSpar.mesher.paint(wear); }
      else swing.tube([0, a[0], a[1]], [0, b[0], b[1]], r * 1.2, r * 0.8, 5, tone);
    }
    pivot.add(swing.build(VERTEX_MATERIAL, wear));
    rigMeshers.push(swing);
    boomEnd.position.set(0, rig.boomY, -rig.boomLen);
    pivot.add(boomEnd);
    main = makeMainSail(rig, pal);
    pivot.add(main.mesher.build(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }), wear));
    rigMeshers.push(main.mesher);
    jib = null;
    if (rig.jib) {
      jib = makeJib(pal);
      const jibMesh = jib.mesher.build(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }), wear);
      rigRoot.add(jibMesh);
      rigMeshers.push(jib.mesher);
      const bowZ = spec.z0 + spec.len + 0.95;
      jibGeom = { tack: [0, planOf(spec, 1).sheer + 0.13, bowZ - 0.05], head: [0, dY + rig.mastH * 0.84, rig.mastZ + 0.05], length: 2.6, clewY: dY + 0.7 };
    }
    paintables.push(...rigMeshers);
    pennantPivot.position.set(0, dY + rig.mastH + 0.08, rig.mastZ);
    pennant.position.y = 0;
    setSailAngle(lastAngle);
  }

  function setSailAngle(angleRad) {
    lastAngle = angleRad;
    pivot.rotation.y = angleRad;
    // Belly: in the pivot's frame the sail lies in the YZ plane; leeward is -X for a positive swing (boat.js header).
    const side = angleRad === 0 ? 0 : -Math.sign(angleRad);
    const ease = Math.min(1, Math.abs(angleRad) / (Math.PI / 4));
    const amount = rig.bellyMax * (0.35 + 0.65 * ease);
    main.update(side, amount);
    followSpar?.update(side, amount);
    if (jib) {
      const a = angleRad * 0.85;
      const clew = [jibGeom.tack[0] - Math.sin(a) * jibGeom.length, jibGeom.clewY, jibGeom.tack[2] - Math.cos(a) * jibGeom.length];
      jib.update(jibGeom.tack, jibGeom.head, clew, side, amount * 0.8);
    }
    pennantPivot.rotation.y = angleRad * 0.6; // the pennant streams downwind with the sail
  }

  function setWear(w) {
    wear = clamp01(w);
    for (const m of paintables) m.paint(wear);
  }
  function setNight(on) {
    night = !!on;
    lantern.set(night);
  }
  function setPennantColor(c) {
    pennant.material.color.set(c);
  }
  function describe() {
    const vis = [];
    group.traverse((o) => { if (o.isMesh) { let v = true; for (let p = o; p; p = p.parent) if (!p.visible) v = false; vis.push([o, v]); } });
    const trisOf = (mesh) => { const g = mesh.geometry; return (g.index ? g.index.count : g.attributes.position.count) / 3; };
    const visible = vis.filter(([, v]) => v);
    const patchOn = (m) => m.meta.filter((t) => t.patch && wear >= t.at).length;
    return {
      type, rig: rigName, wear, night,
      triangles: visible.reduce((n, [o]) => n + trisOf(o), 0),
      trianglesAll: vis.reduce((n, [o]) => n + trisOf(o), 0),
      meshes: visible.length,
      deck: [...deckList],
      lanternLit: night,
      hullPatchTriangles: patchOn(hull),
      repairedPlank: wear >= REPAIR_AT,
      sailPatchTriangles: main ? patchOn(main.mesher) + (jib ? patchOn(jib.mesher) : 0) : 0,
    };
  }

  setRig(rigName);
  setWear(wear);
  return { group, setSailAngle, setNight, setWear, setDeck, setRig, setPennantColor, describe, type, get rig() { return rigName; } };
}

// ---- lab URL (boat-lab.html): the settings Felix can send back as a link --------------------------
export const LAB_DEFAULTS = { boat: 'koster', rig: 'gaff-jib', night: 0, items: ['crate', 'barrel'], wear: 0.5, sail: 25, pennant: 0xffcc66, heading: 120, cam: 'game', zoom: 1, az: 35, el: 28, dist: 14 };
const num = (text, lo, hi) => { if (text == null || text.trim() === '') return undefined; const n = Number(text); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : undefined; };
export function parseLabParams(search) {
  const q = new URLSearchParams(search);
  const out = { ...LAB_DEFAULTS, items: [...LAB_DEFAULTS.items] };
  if (BOAT_TYPES.includes(q.get('boat'))) out.boat = q.get('boat');
  if (KOSTER_RIGS.includes(q.get('rig'))) out.rig = q.get('rig');
  if (q.get('night') === '1') out.night = 1; else if (q.get('night') === '0') out.night = 0;
  if (q.has('items')) out.items = q.get('items').split(',').filter((i, n, a) => DECK_ITEMS.includes(i) && a.indexOf(i) === n);
  for (const [k, lo, hi] of [['wear', 0, 1], ['sail', -90, 90], ['heading', 0, 360], ['zoom', 0.05, 2.5], ['az', 0, 360], ['el', 4, 88], ['dist', 4, 200]]) { const v = num(q.get(k), lo, hi); if (v !== undefined) out[k] = v; }
  if (/^[0-9a-fA-F]{6}$/.test(q.get('pennant') || '')) out.pennant = parseInt(q.get('pennant'), 16);
  if (q.get('cam') === 'game' || q.get('cam') === 'orbit') out.cam = q.get('cam');
  return out;
}
const r3 = (n) => Math.round(n * 1000) / 1000;
export function labParamsToSearch(search, v) {
  const params = new URLSearchParams(search);
  for (const k of Object.keys(LAB_DEFAULTS)) params.delete(k);
  for (const [k, def] of Object.entries(LAB_DEFAULTS)) {
    const val = v[k];
    if (val === undefined) continue;
    if (k === 'items') { if (val.join() !== def.join()) params.set('items', val.length ? val.join(',') : 'none'); continue; }
    if (k === 'pennant') { if (val !== def) params.set('pennant', val.toString(16).padStart(6, '0')); continue; }
    if (typeof def === 'number' && Math.abs(val - def) < 1e-9) continue;
    if (def === val) continue;
    params.set(k, typeof val === 'number' ? String(r3(val)) : String(val));
  }
  // orbit numbers only matter in orbit mode; zoom only in game mode
  if (v.cam !== 'orbit') for (const k of ['az', 'el', 'dist']) params.delete(k);
  if (v.cam === 'orbit') params.delete('zoom');
  const text = params.toString();
  return text ? `?${text}` : '';
}
