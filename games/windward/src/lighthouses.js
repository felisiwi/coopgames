// Low-poly lighthouses of Bohuslän, built from three.js primitives (no model
// files). Look direction (DESIGN.md "Look direction"): objects stay low-poly,
// flat-shaded MeshLambertMaterial, bold storybook colours.
//
//   createLighthouse(name) -> THREE.Group, base at y=0, ~12-18 game metres
//   tall (readable beside the ~6 m boat; NOT real height).
//
// Conventions: every part is a flat Lambert mesh. The lantern glass is a warm
// pale yellow mesh named 'lantern-glass' so a later pass can find it and make
// it glow. Round towers use 5-8 radial segments. "Front" (door, steps,
// ladder) is +z.
import * as THREE from '../vendor/three/three.module.js';

// 'dm' = degrees + decimal minutes, the way the brief gives coordinates.
const dm = (deg, min) => deg + min / 60;

export const LIGHTHOUSES = [
  { name: 'Måseskär', lat: dm(58, 5.646), lon: dm(11, 19.822),
    description: 'Red iron skeleton tower: four splayed legs, X bracing, red upper section with a white band, green-domed lantern.' },
  { name: 'Hållö', lat: dm(58, 20.155), lon: dm(11, 13.040),
    description: 'White masonry tower on Hållö with a pink-red iron upper section and a dark green domed lantern.' },
  { name: 'Pater Noster', lat: dm(57, 53.760), lon: dm(11, 27.951),
    description: 'Tall tapering red iron lattice tower, heavily cross-braced, red-and-white top section, green dome.' },
  { name: 'Vinga', lat: dm(57, 37.924), lon: dm(11, 36.078),
    description: 'Square beige stone tower with gallery and lantern; a red-orange pyramid daymark beside it.' },
  { name: 'Valö', lat: dm(57, 33.050), lon: dm(11, 48.150),
    description: 'Small white tower with a teal-green band, white lantern top and steps to the door.' },
  { name: 'Väderöbod', lat: dm(58, 32.502), lon: dm(11, 1.823),
    description: 'Tall slender red cylindrical tower, small gallery, red lantern.' },
  { name: 'Sandviksholmen', lat: dm(58, 33.652), lon: dm(11, 14.555),
    description: 'Short white cylinder with a gallery rail and a red conical roof.' },
  { name: 'Södra Syster', lat: dm(58, 35.554), lon: dm(11, 9.206),
    description: 'Black square box base with an outside ladder; white upper section with gallery and lantern.' },
  { name: 'Väcker', lat: dm(58, 42.819), lon: dm(11, 9.718),
    description: 'Grey masonry conical base, white tower, black band, gallery, red roof.' },
  { name: 'Ramskär', lat: dm(58, 45.486), lon: dm(10, 59.560),
    description: 'Slim round tower: white base, black middle band, white top, white lantern.' },
  { name: 'Ursholmen', lat: dm(58, 49.950), lon: dm(10, 59.413),
    description: 'White round tower with a black top band, black lantern room and dome, door at the base.' },
  { name: 'Nordkoster', lat: dm(58, 54.146), lon: dm(11, 0.304),
    description: 'Squat white round stone tower, arched wooden door, gallery, verdigris-green domed lantern.' },
];

// --- palette: bold storybook colours -------------------------------------
export const GLASS = 0xffe9a0; // warm pale yellow, ready to glow
const RED = 0xc8321f;
const IRON_RED = 0xb4301f;
const DARK_RED = 0x8a2415;
const PINK_RED = 0xd9594a;
const ORANGE_RED = 0xdb5a2b;
const WHITE = 0xf5f0e3;
const BLACK = 0x26262b;
const SOFT_BLACK = 0x3a3a42;
const GREY = 0x9a9893;
const BEIGE = 0xdcc490;
const TEAL = 0x2a9d8f;
const GREEN = 0x2f7a5a;
const DARK_GREEN = 0x1f5a45;
const VERDIGRIS = 0x4aa88c;
const DOOR = 0x5a3a28;
const DARK = 0x2f2420;
const LADDER = 0xc9c6bd;

// --- tiny toolkit -----------------------------------------------------------
const matCache = new Map();
function mat(color, double = false) {
  const key = `${color}:${double}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({
      color,
      flatShading: true,
      side: double ? THREE.DoubleSide : THREE.FrontSide,
    });
    matCache.set(key, m);
  }
  return m;
}

function put(g, geo, color, x = 0, y = 0, z = 0, { name, double = false } = {}) {
  const m = new THREE.Mesh(geo, mat(color, double));
  m.position.set(x, y, z);
  if (name) m.name = name;
  g.add(m);
  return m;
}

// Cone frustum standing on y (bottom). flat=true turns it so a FLAT FACE (not
// a corner) points to +z, so doors and ladders sit on a face.
function frustum(g, rBot, rTop, h, y, color, seg = 7, { flat = true, x = 0, z = 0 } = {}) {
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, seg);
  if (flat) geo.rotateY(Math.PI / seg);
  return put(g, geo, color, x, y + h / 2, z);
}

// Stack of frustums that share one continuous linear taper, split by colour.
function taperStack(g, rBot, rTop, y0, bands, seg = 7) {
  const total = bands.reduce((s, b) => s + b.h, 0);
  let y = 0;
  for (const b of bands) {
    const r0 = rBot + ((rTop - rBot) * y) / total;
    const r1 = rBot + ((rTop - rBot) * (y + b.h)) / total;
    frustum(g, r0, r1, b.h, y0 + y, b.color, seg);
    y += b.h;
  }
  return { top: y0 + total, radiusAt: (yy) => rBot + ((rTop - rBot) * (yy - y0)) / total };
}

function box(g, w, h, d, y, color, x = 0, z = 0) {
  return put(g, new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z);
}

function cone(g, r, h, y, color, seg = 6, x = 0, z = 0) {
  return put(g, new THREE.ConeGeometry(r, h, seg), color, x, y + h / 2, z);
}

function dome(g, r, y, color, seg = 6) {
  const geo = new THREE.SphereGeometry(r, seg, 2, 0, Math.PI * 2, 0, Math.PI / 2);
  return put(g, geo, color, 0, y, 0);
}

const apothem = (r, seg) => r * Math.cos(Math.PI / seg); // centre -> flat face

// Gallery = floor disc + a few posts + a thin top rail ring. Returns top of floor.
function gallery(g, r, y, color, { posts = 6, rail = 0.7, phase = 0 } = {}) {
  const floor = new THREE.CylinderGeometry(r, r, 0.25, posts);
  floor.rotateY(phase);
  put(g, floor, color, 0, y + 0.125, 0);
  const rr = r * 0.95;
  for (let i = 0; i < posts; i++) {
    const a = (i * Math.PI * 2) / posts + phase;
    box(g, 0.14, rail, 0.14, y + 0.25, color, Math.sin(a) * rr, Math.cos(a) * rr);
  }
  const ring = new THREE.CylinderGeometry(rr, rr, 0.12, posts, 1, true);
  ring.rotateY(phase);
  put(g, ring, color, 0, y + 0.25 + rail, 0, { double: true });
  return y + 0.25;
}

// Lantern room: frame ring, glass, frame ring, roof, finial. Returns top y.
function lantern(g, y, r, h, { frame, roof, roofColor, seg = 6 }) {
  const f = r * 1.12;
  frustum(g, f, f, 0.2, y, frame, seg, { flat: false });
  put(g, new THREE.CylinderGeometry(r, r, h, seg), GLASS, 0, y + 0.2 + h / 2, 0, { name: 'lantern-glass' });
  frustum(g, f, f, 0.2, y + 0.2 + h, frame, seg, { flat: false });
  const yTop = y + 0.4 + h;
  let roofH;
  if (roof === 'cone') {
    roofH = r * 1.6;
    cone(g, r * 1.35, roofH, yTop, roofColor, seg);
  } else {
    roofH = f;
    dome(g, f, yTop, roofColor, seg);
  }
  cone(g, 0.12, 0.5, yTop + roofH, roofColor, 4);
  return yTop + roofH + 0.5;
}

// A thin triangular rod between two points (6 triangles) for iron lattice work.
const _up = new THREE.Vector3(0, 1, 0);
function strut(g, a, b, t, color) {
  const pa = new THREE.Vector3(...a);
  const pb = new THREE.Vector3(...b);
  const dir = pb.clone().sub(pa);
  const len = dir.length();
  const m = put(g, new THREE.CylinderGeometry(t, t, len, 3, 1, true), color,
    (pa.x + pb.x) / 2, (pa.y + pb.y) / 2, (pa.z + pb.z) / 2, { double: true });
  m.quaternion.setFromUnitVectors(_up, dir.normalize());
}

// Four splayed legs + X cross-bracing on each face, per panel (+ optional
// horizontal ties at panel boundaries).
function skeleton(g, { y1, wBot, wTop, panels, color, leg, brace, ties = [] }) {
  const sx = [1, -1, -1, 1];
  const sz = [1, 1, -1, -1];
  const half = (y) => wBot + ((wTop - wBot) * y) / y1;
  const corner = (k, y) => [sx[k] * half(y), y, sz[k] * half(y)];
  for (let k = 0; k < 4; k++) strut(g, corner(k, 0), corner(k, y1), leg, color);
  for (let p = 0; p < panels; p++) {
    const ya = (y1 * p) / panels;
    const yb = (y1 * (p + 1)) / panels;
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      strut(g, corner(k, ya), corner(k2, yb), brace, color);
      strut(g, corner(k2, ya), corner(k, yb), brace, color);
    }
  }
  for (const p of ties) {
    const y = (y1 * p) / panels;
    for (let k = 0; k < 4; k++) strut(g, corner(k, y), corner((k + 1) % 4, y), brace, color);
  }
}

// --- the towers -------------------------------------------------------------
const BUILDERS = {
  // Red iron skeleton: splayed legs, X bracing, red upper section with a white band.
  'Måseskär'(g) {
    skeleton(g, { y1: 9, wBot: 2.9, wTop: 1.3, panels: 3, color: IRON_RED, leg: 0.2, brace: 0.1, ties: [1, 2] });
    frustum(g, 0.55, 0.55, 9, 0, IRON_RED, 6);
    frustum(g, 1.8, 1.8, 1, 9, IRON_RED, 6);
    frustum(g, 1.8, 1.8, 1, 10, WHITE, 6);
    frustum(g, 1.8, 1.8, 1, 11, IRON_RED, 6);
    gallery(g, 2.4, 12, IRON_RED);
    lantern(g, 12.25, 0.9, 1.3, { frame: IRON_RED, roof: 'dome', roofColor: GREEN });
  },

  // White masonry tower, pink-red iron section on top, dark green dome.
  'Hållö'(g) {
    frustum(g, 2.9, 2.7, 0.6, 0, GREY, 7);
    const t = taperStack(g, 2.4, 1.8, 0.6, [{ h: 8.4, color: WHITE }], 7);
    frustum(g, 1.9, 1.8, 2.2, t.top, PINK_RED, 7);
    box(g, 0.9, 1.5, 0.5, 0.6, DOOR, 0, apothem(2.4, 7));
    box(g, 0.35, 0.7, 0.3, 4, DARK, 0, apothem(t.radiusAt(4.3), 7));
    box(g, 0.35, 0.7, 0.3, 7, DARK, 0, apothem(t.radiusAt(7.3), 7));
    gallery(g, 2.5, 11.2, PINK_RED);
    lantern(g, 11.45, 0.9, 1.3, { frame: PINK_RED, roof: 'dome', roofColor: DARK_GREEN });
  },

  // Tall tapering red iron lattice, heavily braced; red top with white band.
  'Pater Noster'(g) {
    skeleton(g, { y1: 12, wBot: 3.0, wTop: 1.25, panels: 4, color: RED, leg: 0.2, brace: 0.1, ties: [2] });
    frustum(g, 0.5, 0.5, 12, 0, RED, 6);
    frustum(g, 1.75, 1.75, 0.7, 12, RED, 6);
    frustum(g, 1.75, 1.75, 0.6, 12.7, WHITE, 6);
    frustum(g, 1.75, 1.75, 0.7, 13.3, RED, 6);
    gallery(g, 2.4, 14, RED, { posts: 4 });
    lantern(g, 14.25, 0.9, 1.3, { frame: RED, roof: 'dome', roofColor: GREEN });
  },

  // Square beige stone tower + tall red-orange pyramid daymark beside it.
  'Vinga'(g) {
    // Tower built in its own sub-group, then moved once to make room for the daymark.
    const tower = new THREE.Group();
    frustum(tower, 2.5, 2.1, 10, 0, BEIGE, 4);
    box(tower, 0.8, 1.5, 0.4, 0, DOOR, 0, apothem(2.5, 4) + 0.1);
    gallery(tower, 2.83, 10, BEIGE, { posts: 4, phase: Math.PI / 4 });
    lantern(tower, 10.25, 0.95, 1.4, { frame: GREY, roof: 'dome', roofColor: SOFT_BLACK });
    tower.position.x = -2.6;
    g.add(tower);
    // daymark: truncated four-sided pyramid
    frustum(g, 2.6, 0.25, 9, 0, ORANGE_RED, 4, { x: 4.2 }); // Felix: lower than the tower
  },

  // Small white tower, teal band, white lantern top, steps.
  'Valö'(g) {
    const t = taperStack(g, 1.9, 1.6, 0, [
      { h: 3.8, color: WHITE }, { h: 2.0, color: TEAL }, { h: 3.5, color: WHITE },
    ], 7);
    const z = apothem(1.9, 7);
    for (let i = 0; i < 3; i++) box(g, 1.6, 0.3 * (i + 1), 0.5, 0, GREY, 0, z + 0.2 + (2 - i) * 0.5);
    box(g, 0.9, 1.5, 0.3, 0.9, DOOR, 0, z);
    gallery(g, 2.3, t.top, WHITE);
    lantern(g, t.top + 0.25, 0.85, 1.3, { frame: WHITE, roof: 'dome', roofColor: WHITE });
  },

  // Tall slender red cylinder with iron-plate ribs, small gallery, red lantern.
  'Väderöbod'(g) {
    frustum(g, 2.0, 1.8, 0.8, 0, GREY, 7);
    const t = taperStack(g, 1.5, 1.0, 0.8, [{ h: 12, color: RED }], 7);
    for (const y of [3.8, 6.8, 9.8]) {
      const r = t.radiusAt(y) + 0.1;
      frustum(g, r, r, 0.2, y, DARK_RED, 7);
    }
    box(g, 0.8, 1.4, 0.4, 0.8, DOOR, 0, apothem(1.5, 7));
    box(g, 0.3, 0.6, 0.25, 5.5, DARK, 0, apothem(t.radiusAt(5.8), 7));
    gallery(g, 1.7, t.top, RED);
    lantern(g, t.top + 0.25, 0.75, 1.2, { frame: RED, roof: 'dome', roofColor: RED });
  },

  // Short white cylinder, gallery rail, red conical roof.
  'Sandviksholmen'(g) {
    const t = taperStack(g, 2.3, 2.0, 0, [{ h: 8.6, color: WHITE }], 7);
    box(g, 0.9, 1.6, 0.4, 0, DOOR, 0, apothem(2.3, 7));
    box(g, 0.4, 0.7, 0.3, 4.5, DARK, 0, apothem(t.radiusAt(4.8), 7));
    gallery(g, 2.8, t.top, WHITE);
    lantern(g, t.top + 0.25, 1.0, 1.3, { frame: WHITE, roof: 'cone', roofColor: RED });
  },

  // Black square base with outside ladder, white upper section.
  'Södra Syster'(g) {
    box(g, 4.4, 4.5, 4.4, 0, BLACK);
    frustum(g, 2.3, 2.0, 5.5, 4.5, WHITE, 4);
    const lz = 2.2 + 0.2;
    for (const x of [-0.45, 0.45]) box(g, 0.12, 4.5, 0.12, 0, LADDER, x, lz);
    for (const y of [1.0, 2.2, 3.4]) box(g, 1.0, 0.1, 0.1, y, LADDER, 0, lz);
    gallery(g, 3.0, 10, WHITE, { posts: 4, phase: Math.PI / 4 });
    lantern(g, 10.25, 0.9, 1.3, { frame: WHITE, roof: 'dome', roofColor: SOFT_BLACK });
  },

  // Grey masonry cone, white tower, black band, gallery, red roof.
  'Väcker'(g) {
    frustum(g, 3.3, 2.2, 4, 0, GREY, 7);
    box(g, 0.9, 1.6, 0.5, 0, DOOR, 0, apothem(3.3, 7) - 0.2);
    frustum(g, 2.2, 1.7, 5.5, 4, WHITE, 7);
    frustum(g, 1.7, 1.6, 1.3, 9.5, BLACK, 7);
    gallery(g, 2.4, 10.8, WHITE);
    lantern(g, 11.05, 0.85, 1.3, { frame: WHITE, roof: 'cone', roofColor: RED });
  },

  // Slim round tower: white / black / white, white lantern.
  'Ramskär'(g) {
    const t = taperStack(g, 1.5, 1.0, 0, [
      { h: 4.5, color: WHITE }, { h: 3.5, color: BLACK }, { h: 3.0, color: WHITE },
    ], 7);
    box(g, 0.7, 1.4, 0.35, 0, DOOR, 0, apothem(1.5, 7));
    gallery(g, 1.9, t.top, WHITE);
    lantern(g, t.top + 0.25, 0.8, 1.3, { frame: WHITE, roof: 'dome', roofColor: WHITE });
  },

  // White round tower, black top band, black lantern room and dome, door.
  'Ursholmen'(g) {
    const t = taperStack(g, 2.5, 2.0, 0, [{ h: 8, color: WHITE }, { h: 1.2, color: BLACK }], 7);
    box(g, 1.0, 1.8, 0.5, 0, DOOR, 0, apothem(2.5, 7));
    box(g, 0.35, 0.7, 0.3, 4.5, DARK, 0, apothem(t.radiusAt(4.8), 7));
    gallery(g, 2.8, t.top, BLACK);
    lantern(g, t.top + 0.25, 1.0, 1.6, { frame: BLACK, roof: 'dome', roofColor: BLACK });
  },

  // Squat white stone tower, arched wooden door, verdigris dome.
  'Nordkoster'(g) {
    const t = taperStack(g, 3.3, 2.6, 0, [{ h: 9.3, color: WHITE }], 7);
    const z = apothem(3.3, 7);
    box(g, 1.1, 1.7, 0.5, 0, DOOR, 0, z);
    put(g, new THREE.CylinderGeometry(0.55, 0.55, 0.5, 6).rotateX(Math.PI / 2), DOOR, 0, 1.7, z);
    box(g, 0.4, 0.8, 0.3, 5.0, DARK, 0, apothem(t.radiusAt(5.4), 7));
    gallery(g, 3.3, t.top, WHITE, { posts: 7 });
    lantern(g, t.top + 0.25, 1.2, 1.3, { frame: WHITE, roof: 'dome', roofColor: VERDIGRIS });
  },
};

export function createLighthouse(name) {
  const build = BUILDERS[name];
  if (!build) throw new Error(`Unknown lighthouse: ${name}`);
  const g = new THREE.Group();
  g.name = name;
  build(g);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function triangleCount(object) {
  let n = 0;
  object.traverse((o) => {
    if (!o.isMesh) return;
    const geo = o.geometry;
    n += geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3;
  });
  return n;
}
