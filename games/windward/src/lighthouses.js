// Low-poly lighthouses of Bohuslän, built from three.js primitives (no model
// files). Look direction (DESIGN.md "Look direction"): objects stay low-poly,
// flat-shaded MeshLambertMaterial, bold storybook colours.
//
//   LIGHTHOUSES            all towers, sorted by `built` (oldest first)
//   createLighthouse(name) -> THREE.Group, base at y=0
//   gameHeight(entry)      = 6 + 0.5 x realHeight  (NOT real height; the order
//                            of heights matches real life, the spread is squeezed)
//
// Source of truth for years, heights and looks: LIGHTHOUSES.md.
//
// Conventions: every part is a flat Lambert mesh. The lantern glass is a warm
// pale yellow mesh named 'lantern-glass' (exactly one per lighthouse) so a
// later pass can find it and make it glow. A twin's second light is named
// 'lantern-glass-twin'; Islandsberg's window row names its other panes
// 'lantern-glass-window' (src/lantern.js lights every mesh whose name starts
// with 'lantern-glass', and centres the halo on the first). Round towers use 5-8 radial segments. "Front" (door,
// steps) is +z.
import * as THREE from '../vendor/three/three.module.js';

// 'dm' = degrees + decimal minutes, the way the original brief gives coordinates.
const dm = (deg, min) => deg + min / 60;

// built = year of the CURRENT tower; station = year the light station opened
// (only when older and stated in LIGHTHOUSES.md); realHeight in metres.
// check = what still needs a photo check (shown in the lab).
const ENTRIES = [
  { name: 'Carlsten', built: 1782, station: null, realHeight: 20, heightEstimated: true, area: 'Marstrand',
    lat: 57.8861067, lon: 11.5787068,
    description: 'Light on top of the round stone tower of Carlsten fortress; the first flashing light in the world. Dark since 1868.',
    check: 'height unknown (20 m guessed); tower shape and lantern colour' },
  { name: 'Böttö', built: 1841, station: null, realHeight: 8, heightEstimated: true, area: 'Göteborg',
    lat: 57.6490957, lon: 11.7198443,
    description: 'Red lantern on the roof of a red-and-white wooden keeper\'s house. Dark since 1964.',
    check: 'height unknown (8 m guessed); which parts are red vs white' },
  { name: 'Hållö', built: 1842, station: null, realHeight: 20, area: 'Smögen',
    lat: dm(58, 20.155), lon: dm(11, 13.040),
    description: 'White rubblestone tower (raised 1868) with a conical red cast-iron watch room and a black lantern.' },
  { name: 'Nordkoster', built: 1849, station: null, realHeight: 7, area: 'Koster',
    lat: dm(58, 54.146), lon: dm(11, 0.304),
    description: 'Two small round white masonry towers with grey lanterns.' },
  { name: 'Måseskär', built: 1865, station: null, realHeight: 27, area: 'Käringön',
    lat: dm(58, 5.646), lon: dm(11, 19.822),
    description: 'Tall red-and-white checkerboard cast-iron skeleton tower with a central cylinder, gallery and green-domed lantern.',
    check: 'lantern dome colour (green, from the first brief)' },
  { name: 'Pater Noster', built: 1868, station: null, realHeight: 32, area: 'Marstrand',
    lat: dm(57, 53.760), lon: dm(11, 27.951),
    description: 'The tallest on the coast: all-red cast-iron lattice tower, heavily cross-braced, green dome.' },
  { name: 'Islandsberg', built: 1883, station: null, realHeight: 6, area: 'Lysekil',
    lat: 58.1976349, lon: 11.4050317,
    description: 'Wooden keeper\'s house, white seaward gable, red behind. The old light showed through a row of windows on the upper floor of the seaward gable (not a lantern on the ridge; fyr.org), and the model (gableWindowLight) draws exactly that. Dark since 1938.',
    check: 'lantern colours and roof colour' },
  { name: 'Vinga', built: 1890, station: 1841, realHeight: 29, area: 'Göteborg',
    lat: dm(57, 37.924), lon: dm(11, 36.078),
    description: 'Square unpainted grey granite tower with a grey dome; a lower red-orange pyramid daymark beside it.' },
  { name: 'Stångehuvud', built: 1890, station: null, realHeight: 4, area: 'Lysekil',
    lat: 58.2711831, lon: 11.4134545,
    description: 'Small white wooden house with a black A-frame roof and a lantern on the ridge.',
    check: 'lantern colours' },
  { name: 'Ursholmen', built: 1891, station: null, realHeight: 13, area: 'Koster',
    lat: dm(58, 49.950), lon: dm(10, 59.413),
    description: 'White round tower with a black top band and black lantern; a lower twin tower without a lantern.' },
  { name: 'Eggskär', built: 1904, station: null, realHeight: 8, area: 'Klädesholmen',
    lat: 57.9463469, lon: 11.5168439,
    description: 'White round stone tower.',
    check: 'lantern and roof colours' },
  { name: 'Tistlarna', built: 1905, station: null, realHeight: 14, area: 'Göteborg south',
    lat: 57.5098545, lon: 11.7263241,
    description: 'Square white masonry tower with black trim, two galleries and a grey metallic dome.' },
  { name: 'Mollösund', built: 1930, station: null, realHeight: 7, area: 'Orust',
    lat: 58.0740381, lon: 11.4655996,
    description: 'White tower with a black base band and a red roof.',
    check: 'round vs square, lantern colours' },
  { name: 'Stora Pölsan', built: 1934, station: null, realHeight: 10, area: 'Rörö',
    lat: 57.7748924, lon: 11.5236489,
    description: 'Square masonry tower with a black band.',
    check: 'masonry colour (white assumed), lantern and roof colours' },
  { name: 'Valö', built: 1935, station: 1885, realHeight: 10, area: 'Göteborg south',
    lat: dm(57, 33.050), lon: dm(11, 48.150),
    description: 'Small white tower with a teal-green band, white lantern top and steps to the door.' },
  { name: 'Mjölskär', built: 1936, station: null, realHeight: 14, area: 'Smögen',
    lat: 58.412849, lon: 11.1973639,
    description: 'White round tower with a black base band.',
    check: 'lantern and roof colours' },
  { name: 'Hättan', built: 1938, station: null, realHeight: 9, area: 'Härmanö',
    lat: 58.174137, lon: 11.37307,
    description: 'White round tower with one black band.',
    check: 'band position, lantern and roof colours' },
  { name: 'Sandviksholmen', built: 1939, station: null, realHeight: 7, area: 'Hamburgö',
    lat: dm(58, 33.652), lon: dm(11, 14.555),
    description: 'Short white cylinder with a gallery rail and a red conical roof.' },
  { name: 'Väcker', built: 1939, station: null, realHeight: 14, area: 'Havstenssund',
    lat: dm(58, 42.819), lon: dm(11, 9.718),
    description: 'White round tower with a black band at the top, white lantern and a red roof, on an unpainted conical stone base.' },
  { name: 'Ramskär', built: 1939, station: 1917, realHeight: 19, area: 'Havstenssund',
    lat: dm(58, 45.486), lon: dm(10, 59.560),
    description: 'Slim round tower: white base, one broad black band, white top, white lantern.' },
  { name: 'Gäven', built: 1941, station: 1917, realHeight: 9.5, area: 'Lysekil',
    lat: 58.2709628, lon: 11.3504693,
    description: 'White round tower with one black band.',
    check: 'band position, lantern and roof colours' },
  { name: 'Kråksundsgap Södra', built: 1954, station: 1941, realHeight: 13, area: 'Orust',
    lat: 58.1005563, lon: 11.4404817,
    description: 'All-white round tower.',
    check: 'lantern and roof colours' },
  { name: 'Väderöbod', built: 1964, station: 1867, realHeight: 19, area: 'Fjällbacka',
    lat: dm(58, 32.502), lon: dm(11, 1.823),
    description: 'Tall slender round red concrete tower, small gallery, red lantern.' },
  { name: 'Trubaduren', built: 1965, station: 1929, realHeight: 26, area: 'Off Vinga',
    lat: 57.594402, lon: 11.633062,
    description: 'Concrete sea tower: upper half red, lower half black, two galleries and a helipad on top.' },
  { name: 'Lindholmen', built: 1974, station: null, realHeight: 15, area: 'Skalhamn',
    lat: 58.32445, lon: 11.376981,
    description: 'Two red round towers (Västra 15 m, Mellersta 13 m), each carrying a red slatted daymark.' },
  { name: 'Brandskärsflak', built: 1974, station: null, realHeight: 26, area: 'Off Lysekil',
    lat: 58.2936243, lon: 11.3290881,
    description: 'Concrete sea tower: white with a green band, two galleries and a helipad.' },
  { name: 'Dynabrott', built: 1974, station: null, realHeight: 26, area: 'Off Lysekil',
    lat: 58.2936243, lon: 11.3290881,
    description: 'Concrete sea tower: white with a red band, two galleries and a helipad. A few hundred metres from Brandskärsflak.' },
  { name: 'Hätteberget', built: 1977, station: null, realHeight: 26, area: 'Marstrand',
    lat: 57.863658, lon: 11.458654,
    description: 'Concrete sea tower: upper half red, lower half black, two galleries and a helipad on top.' },
  { name: 'Södra Syster', built: 2020, station: 1951, realHeight: 9, area: 'Fjällbacka',
    lat: dm(58, 35.554), lon: dm(11, 9.206),
    description: 'Plain white tower on a black base.',
    check: 'round vs square, lantern and roof colours' },
];


// Light characteristics exactly as the Lighthouse Directory (ibiblio) gives them
// for THIS tower. null = it gives none (dark towers); nothing here is invented.
// count x flashes per `period` seconds; flashSeconds when it states a length;
// kind: 'flash' | 'occulting' (light on, short eclipses) | 'on-off'.
const WRG = 'white, red or green by direction';
const flash = (pattern, count, period, extra = {}) => ({ pattern, colour: WRG, kind: 'flash', count, period, ...extra });
const LIGHTS = {
  'Carlsten': { active: false, light: { pattern: 'flashes 25 s long, the optic turning once every 5 min', colour: null, kind: 'flash', count: 1, period: 300, flashSeconds: 25 },
    note: 'Dark since 1868. The world\'s first flashing light.' },
  'Böttö': { active: false, light: null, note: 'Dark since 1964. The directory gives no characteristic for this tower.' },
  'Hållö': { active: true, light: { pattern: 'white flash every 12 s', colour: 'white', kind: 'flash', count: 1, period: 12 } },
  'Nordkoster': { active: true, light: { pattern: 'four long (2 s) white flashes every 30 s', colour: 'white', kind: 'flash', count: 4, period: 30, flashSeconds: 2 },
    note: 'Syd tower; reactivated 2001 (dark 1891–2001).' },
  'Måseskär': { active: false, light: null,
    note: 'Dark since 1978, lit for 12 minutes at midnight each New Year\'s Eve. The station\'s current light (the 1978 fibreglass tower) shows three long (1.5 s) flashes every 30 s.' },
  'Pater Noster': { active: true, light: { pattern: 'one long white flash every 15 s', colour: 'white', kind: 'flash', count: 1, period: 15 },
    note: 'Reactivated 2007 (dark 1977–2007).' },
  'Islandsberg': { active: false, light: null, note: 'Dark since 1938; the light showed through an upper-storey window.' },
  'Vinga': { active: true, light: { pattern: 'two white flashes, 7.5 s apart, every 30 s', colour: 'white', kind: 'flash', count: 2, period: 30, gap: 7.5 } },
  'Stångehuvud': { active: false, light: null, note: 'Dark since 1940: the light was put out when Stångholmen\'s automatic light replaced it (fyr.org, stangehuvud.se; ibiblio\'s "inactive since the 1990s" is the odd one out, probably the building).' },
  'Ursholmen': { active: true, light: flash('two long flashes every 15 s', 2, 15), note: 'Syd tower. The north twin has been dark since 1931.' },
  'Eggskär': { active: true, light: flash('two flashes every 6 s', 2, 6) },
  'Tistlarna': { active: true, light: { pattern: 'two long (2 s) flashes every 15 s', colour: 'white or red by direction', kind: 'flash', count: 2, period: 15, flashSeconds: 2 } },
  'Mollösund': { active: true, light: flash('two flashes every 6 s', 2, 6) },
  'Stora Pölsan': { active: true, light: { pattern: '2 s on, 6 s off', colour: WRG, kind: 'on-off', count: 1, period: 8, flashSeconds: 2 } },
  'Valö': { active: true, light: flash('one long flash every 8 s', 1, 8) },
  'Mjölskär': { active: true, light: flash('flash every 3 s', 1, 3) },
  'Hättan': { active: true, light: flash('two flashes every 6 s', 2, 6) },
  'Sandviksholmen': { active: true, light: flash('two flashes every 6 s', 2, 6) },
  'Väcker': { active: true, light: flash('four flashes every 12 s', 4, 12) },
  'Ramskär': { active: true, light: flash('three flashes every 9 s', 3, 9) },
  'Gäven': { active: true, light: flash('three flashes every 9 s', 3, 9) },
  'Kråksundsgap Södra': { active: true, light: flash('two flashes every 6 s', 2, 6) },
  'Väderöbod': { active: true, light: flash('one long flash every 8 s', 1, 8) },
  'Trubaduren': { active: true, light: flash('three very long (3 s) flashes every 30 s', 3, 30, { flashSeconds: 3 }) },
  'Lindholmen': { active: true, light: { pattern: 'Västra: red, 4 s on, 4 s off; Mellersta: white, 4 s on, 4 s off', colour: 'red (Västra), white (Mellersta)', kind: 'on-off', count: 1, period: 8, flashSeconds: 4 } },
  'Brandskärsflak': { active: true, light: { pattern: 'occulting twice every 8 s', colour: WRG, kind: 'occulting', count: 2, period: 8 } },
  'Dynabrott': { active: true, light: { pattern: 'occulting once every 8 s', colour: WRG, kind: 'occulting', count: 1, period: 8 } },
  'Hätteberget': { active: true, light: flash('two long (1.5 s) flashes every 12 s', 2, 12, { flashSeconds: 1.5 }) },
  'Södra Syster': { active: true, light: flash('two flashes every 6 s', 2, 6), note: 'The directory says the lantern has been removed (prefabricated light).' },
};

// Oldest on the left. Array.sort is stable, so same-year towers keep list order.
export const LIGHTHOUSES = ENTRIES
  .map((e) => ({ ...e, lit: LIGHTS[e.name].active, light: LIGHTS[e.name].light, lightNote: LIGHTS[e.name].note ?? null }))
  .sort((a, b) => a.built - b.built);

export const gameHeight = (entry) => 6 + 0.5 * entry.realHeight;

// --- palette: bold storybook colours -------------------------------------
export const GLASS = 0xffe9a0; // warm pale yellow, ready to glow
const RED = 0xc8321f;
const IRON_RED = 0xb4301f;
const DARK_RED = 0x8a2415;
const ORANGE_RED = 0xdb5a2b;
const WHITE = 0xf5f0e3;
const BLACK = 0x26262b;
const SOFT_BLACK = 0x3a3a42;
const GREY = 0x9a9893;
const GREY_METAL = 0x8c929a;
const GRANITE = 0xa6a29a;
const STONE = 0xa59f94;
const TEAL = 0x2a9d8f;
const GREEN = 0x2f7a5a;
const SEA_GREEN = 0x2f9a6a;
const DARK_GREEN = 0x1f5a45;
const DOOR = 0x5a3a28;
const DARK = 0x2f2420;
const DARK_ROOF = 0x4b3b36;
const HELIPAD = 0xbab7ae;

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

// A sub-group, moved once, so a twin tower can be built with the same code.
function sub(g, x = 0, z = 0) {
  const s = new THREE.Group();
  s.position.set(x, 0, z);
  g.add(s);
  return s;
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

// Height of a lantern room (frame ring + glass + frame ring + roof + finial).
const roofHeight = (r, roof) => (roof === 'cone' ? r * 1.6 : roof === 'none' ? 0 : r * 1.12);
const lanternHeight = (r, h, roof) => 0.4 + h + roofHeight(r, roof) + (roof === 'none' ? 0 : 0.5);
// Gallery floor + lantern: what sits on top of a tower body.
const stackHeight = (r, h, roof = 'dome') => 0.25 + lanternHeight(r, h, roof);

// Lantern room: frame ring, glass, frame ring, roof, finial. Returns top y.
function lantern(g, y, r, h, { frame, roof = 'dome', roofColor, seg = 6, glassName = 'lantern-glass' }) {
  const f = r * 1.12;
  frustum(g, f, f, 0.2, y, frame, seg, { flat: false });
  put(g, new THREE.CylinderGeometry(r, r, h, seg), GLASS, 0, y + 0.2 + h / 2, 0, { name: glassName });
  frustum(g, f, f, 0.2, y + 0.2 + h, frame, seg, { flat: false });
  const yTop = y + 0.4 + h;
  if (roof === 'none') return yTop;
  const roofH = roofHeight(r, roof);
  if (roof === 'cone') cone(g, r * 1.35, roofH, yTop, roofColor, seg);
  else dome(g, f, yTop, roofColor, seg);
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
function skeleton(g, { y1, wBot, wTop, panels, color, leg, brace, ties = [], colorOf = null }) {
  const sx = [1, -1, -1, 1];
  const sz = [1, 1, -1, -1];
  const half = (y) => wBot + ((wTop - wBot) * y) / y1;
  const corner = (k, y) => [sx[k] * half(y), y, sz[k] * half(y)];
  // the lattice starts 0.12 m up so slanted rod ends don't dip below y=0
  const y0 = 0.12;
  // colorOf(k, p) (optional) colours leg k / face k in panel p: used for a checkerboard.
  for (let k = 0; k < 4; k++) {
    if (!colorOf) { strut(g, corner(k, y0), corner(k, y1), leg, color); continue; }
    for (let p = 0; p < panels; p++) {
      strut(g, corner(k, Math.max(y0, (y1 * p) / panels)), corner(k, (y1 * (p + 1)) / panels), leg, colorOf(k, p));
    }
  }
  for (let p = 0; p < panels; p++) {
    const ya = Math.max(y0, (y1 * p) / panels);
    const yb = (y1 * (p + 1)) / panels;
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      const c = colorOf ? colorOf(k, p) : color;
      strut(g, corner(k, ya), corner(k2, yb), brace, c);
      strut(g, corner(k2, ya), corner(k, yb), brace, c);
    }
  }
  for (const p of ties) {
    const y = (y1 * p) / panels;
    for (let k = 0; k < 4; k++) strut(g, corner(k, y), corner((k + 1) % 4, y), brace, color);
  }
}

// A gable roof: triangular prism, ridge along z, sitting on y=0 of its mesh.
// 6 triangles (two slopes + two gable ends; the underside is never seen).
function gableRoof(g, w, d, rh, y, color) {
  const hw = w / 2;
  const hd = d / 2;
  const P = (x, yy, z) => [x, yy, z];
  const tris = [
    [P(-hw, 0, hd), P(hw, 0, hd), P(0, rh, hd)], // front gable
    [P(hw, 0, -hd), P(-hw, 0, -hd), P(0, rh, -hd)], // back gable
    [P(-hw, 0, -hd), P(-hw, 0, hd), P(0, rh, hd)], // left slope
    [P(-hw, 0, -hd), P(0, rh, hd), P(0, rh, -hd)],
    [P(hw, 0, hd), P(hw, 0, -hd), P(0, rh, -hd)], // right slope
    [P(hw, 0, hd), P(0, rh, -hd), P(0, rh, hd)],
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(2), 3));
  geo.computeVertexNormals();
  return put(g, geo, color, 0, y, 0);
}

// --- shared recipes ---------------------------------------------------------

// A round (or, with square:true, four-sided) tower: colour bands stacked in
// proportion, door, optional window slits, gallery, lantern. H is the TOTAL
// height of this tower including lantern, so heights follow the data.
function roundTower(t, o) {
  const {
    H, rBot, rTop, bands, seg = 7, square = false, galleryColor = WHITE,
    lr = 0.85, lh = 1.3, frame = WHITE, roof = 'dome', roofColor = GREY_METAL,
    door = true, windows = [], glassName, noLantern = false, mid = null, posts = 6,
  } = o;
  const segs = square ? 4 : seg;
  const top = H - (noLantern ? 1.25 : stackHeight(lr, lh, roof));
  const sum = bands.reduce((s, b) => s + b.f, 0);
  const st = taperStack(t, rBot, rTop, 0, bands.map((b) => ({ h: (top * b.f) / sum, color: b.color })), segs);
  if (door) box(t, Math.min(1.1, rBot * 0.45), Math.min(2.2, top * 0.2), 0.4, 0, DOOR, 0, apothem(rBot, segs));
  for (const f of windows) {
    box(t, 0.35, 0.7, 0.3, top * f, DARK, 0, apothem(st.radiusAt(top * f + 0.3), segs));
  }
  const gal = { posts: square ? 4 : posts, phase: square ? Math.PI / 4 : 0 };
  const gr = square ? rTop + 0.85 : rTop * 1.4;
  if (mid) gallery(t, (square ? st.radiusAt(top * mid.f) + 0.85 : st.radiusAt(top * mid.f) * 1.4), top * mid.f, mid.color, gal);
  gallery(t, gr, top, galleryColor, gal);
  if (noLantern) {
    frustum(t, rTop * 0.7, rTop * 0.7, 1.0, top + 0.25, bands[bands.length - 1].color, 6, { flat: false });
  } else {
    lantern(t, top + 0.25, lr, lh, { frame, roof, roofColor, glassName });
  }
  return { top, radiusAt: st.radiusAt };
}

// Concrete sea tower with two galleries and a helipad disc on the lantern.
function seaTower(g, { H, bands }) {
  const lr = 1.0;
  const lh = 1.5;
  const top = H - (0.25 + 0.4 + lh + 0.2);
  const st = taperStack(g, 2.7, 2.0, 0, bands.map((b) => ({ h: top * b.f, color: b.color })), 8);
  box(g, 1.1, 2.0, 0.4, 0, DOOR, 0, apothem(2.7, 8));
  const lowY = top * 0.5;
  gallery(g, st.radiusAt(lowY) * 1.35, lowY, GREY, { posts: 4 });
  gallery(g, 2.8, top, GREY, { posts: 6 });
  const yTop = lantern(g, top + 0.25, lr, lh, { frame: GREY, roof: 'none' });
  frustum(g, 3.2, 3.2, 0.2, yTop, HELIPAD, 8, { flat: false });
}

// Keeper's house with the lantern on the ridge.
function houseLight(g, o) {
  const { H, w, d, wallFrac, wall, wall2 = null, roofColor, lr, lh, frame, domeColor, lanternZ = 0, doorW = 1.0 } = o;
  const ridge = H - lanternHeight(lr, lh, 'dome');
  const wallH = ridge * wallFrac;
  const roofH = ridge - wallH;
  if (wall2) {
    box(g, w, wallH, d / 2, 0, wall, 0, d / 4);
    box(g, w, wallH, d / 2, 0, wall2, 0, -d / 4);
  } else {
    box(g, w, wallH, d, 0, wall);
  }
  gableRoof(g, w + 0.6, d + 0.6, roofH, wallH, roofColor);
  box(g, doorW, Math.min(1.8, wallH * 0.7), 0.3, 0, DOOR, 0, d / 2);
  const lg = sub(g, 0, lanternZ);
  lantern(lg, ridge, lr, lh, { frame, roof: 'dome', roofColor: domeColor });
}

// Islandsberg's old keeper's house (1883, dark since 1938). The light was NOT in a lantern on the ridge: it showed through a row of windows on the upper floor of the seaward
// (+z) gable (fyr.org, via docs/CORRECTIONS-TODO.md). Seaward half white, the rest red. No lantern: the house reaches the game height at the ridge. The MIDDLE pane is the one
// 'lantern-glass' (the halo centres on it); the other panes share the prefix so the glow lights the whole row, and dark or lit they swap together.
function gableWindowLight(g, o) {
  const { H, w, d, wallFrac, wall, wall2, roofColor, doorW = 1.0, panes = 5 } = o;
  const wallH = H * wallFrac;
  const roofH = H - wallH;
  box(g, w, wallH, d / 2, 0, wall, 0, d / 4);
  box(g, w, wallH, d / 2, 0, wall2, 0, -d / 4);
  gableRoof(g, w + 0.6, d + 0.6, roofH, wallH, roofColor);
  box(g, doorW, Math.min(1.8, wallH * 0.4), 0.3, 0, DOOR, 0, d / 2); // the door, ground floor, on the seaward gable
  const paneW = 0.58, gap = 0.14, paneH = 1.1;
  const step = paneW + gap;
  const rowW = panes * paneW + (panes - 1) * gap;
  const y0 = wallH * 0.75 - paneH / 2; // centred on the upper floor (the upper floor is the top half of the wall)
  box(g, rowW + 0.3, paneH + 0.3, 0.1, y0 - 0.15, DARK, 0, d / 2 + 0.01); // a dark frame round the row, so it reads as one row of windows
  const order = [...Array(panes).keys()].sort((a, b) => Math.abs(a - (panes - 1) / 2) - Math.abs(b - (panes - 1) / 2)); // the middle pane first (the glow's centre)
  order.forEach((i, n) => {
    put(g, new THREE.BoxGeometry(paneW, paneH, 0.1), GLASS, (i - (panes - 1) / 2) * step, y0 + paneH / 2, d / 2 + 0.07, { name: n === 0 ? 'lantern-glass' : 'lantern-glass-window' });
  });
}

// Rectangular red slatted daymark on the front (+z) of a round tower.
function slatDaymark(t, { r, y, h, width, color }) {
  const slats = 4;
  const slatH = h / (slats * 2 - 1);
  for (let i = 0; i < slats; i++) box(t, width, slatH, 0.2, y + i * 2 * slatH, color, 0, r + 0.1);
  for (const x of [-width / 2 + 0.1, width / 2 - 0.1]) box(t, 0.2, h, 0.2, y, color, x, r + 0.1);
}

// --- the towers -------------------------------------------------------------
// Each builder gets (group, H): H = the game height this tower must reach.
const BUILDERS = {
  // Light on the round stone fortress tower: fat drum, battlements, small lantern.
  'Carlsten'(g, H) {
    const lr = 0.9;
    const lh = 1.2;
    const top = H - 0.5 - lanternHeight(lr, lh, 'cone');
    taperStackSimple(g, 5.0, 4.6, top, STONE, 8);
    box(g, 1.3, 2.2, 0.5, 0, DOOR, 0, apothem(5.0, 8));
    frustum(g, 5.3, 5.3, 0.5, top, STONE, 8);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI * 2) / 8 + Math.PI / 8;
      box(g, 1.3, 1.0, 0.8, top + 0.5, STONE, Math.sin(a) * 4.7, Math.cos(a) * 4.7).rotation.y = a;
    }
    lantern(g, top + 0.5, lr, lh, { frame: DARK, roof: 'cone', roofColor: GREY_METAL });
  },

  // Red lantern on a red-and-white wooden keeper's house.
  'Böttö'(g, H) {
    houseLight(g, { H, w: 5.2, d: 8, wallFrac: 0.5, wall: WHITE, roofColor: RED, lr: 0.85, lh: 1.2, frame: RED, domeColor: RED });
  },

  // White rubblestone tower, conical red cast-iron watch room, black lantern.
  'Hållö'(g, H) {
    const top = H - stackHeight(0.9, 1.3, 'dome');
    const plinth = 0.6;
    const rest = top - plinth;
    const white = rest * 0.78;
    frustum(g, 2.9, 2.7, plinth, 0, GREY, 7);
    const t = taperStack(g, 2.4, 1.8, plinth, [{ h: white, color: WHITE }], 7);
    frustum(g, 1.8, 1.35, rest - white, t.top, RED, 7); // the conical watch room
    box(g, 0.9, 1.5, 0.5, plinth, DOOR, 0, apothem(2.4, 7));
    box(g, 0.35, 0.7, 0.3, white * 0.4, DARK, 0, apothem(t.radiusAt(white * 0.4 + 0.9), 7));
    box(g, 0.35, 0.7, 0.3, white * 0.8, DARK, 0, apothem(t.radiusAt(white * 0.8 + 0.9), 7));
    gallery(g, 2.2, top, RED);
    lantern(g, top + 0.25, 0.9, 1.3, { frame: BLACK, roof: 'dome', roofColor: BLACK });
  },

  // Two small round white masonry towers, grey lanterns.
  'Nordkoster'(g, H) {
    const base = { rBot: 2.3, rTop: 1.8, bands: [{ f: 1, color: WHITE }], lr: 0.8, lh: 1.0, frame: GREY_METAL, roof: 'dome', roofColor: GREY_METAL, galleryColor: WHITE };
    roundTower(sub(g, -3.8), { ...base, H, windows: [0.5] });
    roundTower(sub(g, 3.8), { ...base, H: 6 + 0.5 * 5, rBot: 2.1, rTop: 1.7, windows: [0.5], glassName: 'lantern-glass-twin' });
  },

  // Red-and-white checkerboard cast-iron skeleton: alternate red/white per panel and face.
  'Måseskär'(g, H) {
    const top = H - stackHeight(0.9, 1.3, 'dome');
    const y1 = top - 3;
    skeleton(g, {
      y1, wBot: 3.6, wTop: 1.5, panels: 4, color: IRON_RED, leg: 0.22, brace: 0.14,
      colorOf: (k, p) => ((k + p) % 2 ? WHITE : IRON_RED),
    });
    frustum(g, 0.6, 0.6, y1, 0, IRON_RED, 6);
    frustum(g, 2.0, 2.0, 1, y1, IRON_RED, 6);
    frustum(g, 2.0, 2.0, 1, y1 + 1, WHITE, 6);
    frustum(g, 2.0, 2.0, 1, y1 + 2, IRON_RED, 6);
    gallery(g, 2.7, top, IRON_RED, { posts: 4 });
    lantern(g, top + 0.25, 0.9, 1.3, { frame: IRON_RED, roof: 'dome', roofColor: GREEN });
  },

  // Tallest on the coast: all-red tapering lattice, heavily braced.
  'Pater Noster'(g, H) {
    const top = H - stackHeight(0.9, 1.3, 'dome');
    const y1 = top - 2;
    skeleton(g, { y1, wBot: 3.6, wTop: 1.4, panels: 5, color: RED, leg: 0.22, brace: 0.11, ties: [2] });
    frustum(g, 0.55, 0.55, y1, 0, RED, 6);
    frustum(g, 1.9, 1.9, 2, y1, RED, 6);
    gallery(g, 2.6, top, RED, { posts: 4 });
    lantern(g, top + 0.25, 0.9, 1.3, { frame: RED, roof: 'dome', roofColor: GREEN });
  },

  // Wooden keeper's house, white seaward end, red behind; lantern at the seaward end.
  'Islandsberg'(g, H) {
    gableWindowLight(g, { H, w: 4.6, d: 8, wallFrac: 0.62, wall: WHITE, wall2: RED, roofColor: DARK_ROOF });
  },

  // Square unpainted grey granite tower, grey dome, lower red-orange pyramid daymark.
  'Vinga'(g, H) {
    roundTower(sub(g, -3.4), {
      H, rBot: 3.8, rTop: 3.0, bands: [{ f: 1, color: GRANITE }], square: true, galleryColor: GRANITE,
      lr: 1.1, lh: 1.5, frame: GREY, roof: 'dome', roofColor: GREY_METAL, windows: [0.3, 0.6],
    });
    frustum(g, 3.0, 0.3, H * 0.72, 0, ORANGE_RED, 4, { x: 5.8 }); // lower than the tower
  },

  // Small white wooden house with a black A-frame roof.
  'Stångehuvud'(g, H) {
    houseLight(g, { H, w: 3.6, d: 4.6, wallFrac: 0.28, wall: WHITE, roofColor: BLACK, lr: 0.7, lh: 1.0, frame: WHITE, domeColor: BLACK, doorW: 0.8 });
  },

  // White round tower, black top band, black lantern room and dome; twin with no lantern.
  'Ursholmen'(g, H) {
    roundTower(sub(g, -4.4), {
      H, rBot: 2.4, rTop: 1.9, bands: [{ f: 0.87, color: WHITE }, { f: 0.13, color: BLACK }],
      galleryColor: BLACK, lr: 1.0, lh: 1.5, frame: BLACK, roof: 'dome', roofColor: BLACK, windows: [0.45],
    });
    roundTower(sub(g, 4.6), {
      H: 6 + 0.5 * 10, rBot: 2.2, rTop: 1.8, bands: [{ f: 0.87, color: WHITE }, { f: 0.13, color: BLACK }],
      galleryColor: BLACK, noLantern: true, windows: [0.45],
    });
  },

  // White round stone tower.
  'Eggskär'(g, H) {
    roundTower(g, { H, rBot: 2.3, rTop: 1.8, bands: [{ f: 1, color: WHITE }], windows: [0.5] });
  },

  // Square white masonry, black trim, two galleries, grey metallic dome.
  'Tistlarna'(g, H) {
    roundTower(g, {
      H, rBot: 3.2, rTop: 2.7, square: true,
      bands: [{ f: 0.06, color: BLACK }, { f: 0.88, color: WHITE }, { f: 0.06, color: BLACK }],
      galleryColor: BLACK, mid: { f: 0.5, color: BLACK }, lr: 0.95, lh: 1.4, frame: BLACK,
      roof: 'dome', roofColor: GREY_METAL, windows: [0.3, 0.7],
    });
  },

  // White tower, black base band, red roof.
  'Mollösund'(g, H) {
    roundTower(g, {
      H, rBot: 2.2, rTop: 1.8, bands: [{ f: 0.22, color: BLACK }, { f: 0.78, color: WHITE }],
      roof: 'cone', roofColor: RED, windows: [0.55],
    });
  },

  // Square masonry tower with a black band.
  'Stora Pölsan'(g, H) {
    roundTower(g, {
      H, rBot: 3.0, rTop: 2.5, square: true,
      bands: [{ f: 0.4, color: WHITE }, { f: 0.2, color: BLACK }, { f: 0.4, color: WHITE }],
      windows: [0.2],
    });
  },

  // Small white tower, teal band, white lantern top, steps.
  'Valö'(g, H) {
    const top = H - stackHeight(0.85, 1.3, 'dome');
    const t = taperStack(g, 1.9, 1.6, 0, [
      { h: top * 0.41, color: WHITE }, { h: top * 0.22, color: TEAL }, { h: top * 0.37, color: WHITE },
    ], 7);
    const z = apothem(1.9, 7);
    for (let i = 0; i < 3; i++) box(g, 1.6, 0.3 * (i + 1), 0.5, 0, GREY, 0, z + 0.2 + (2 - i) * 0.5);
    box(g, 0.9, 1.5, 0.3, 0.9, DOOR, 0, z);
    gallery(g, 2.3, t.top, WHITE);
    lantern(g, t.top + 0.25, 0.85, 1.3, { frame: WHITE, roof: 'dome', roofColor: WHITE });
  },

  // White round tower, black base band.
  'Mjölskär'(g, H) {
    roundTower(g, {
      H, rBot: 2.4, rTop: 1.9, bands: [{ f: 0.2, color: BLACK }, { f: 0.8, color: WHITE }], windows: [0.5],
    });
  },

  // White round tower, one black band.
  'Hättan'(g, H) {
    roundTower(g, {
      H, rBot: 2.1, rTop: 1.7,
      bands: [{ f: 0.35, color: WHITE }, { f: 0.25, color: BLACK }, { f: 0.4, color: WHITE }],
    });
  },

  // Short white cylinder, gallery rail, red conical roof.
  'Sandviksholmen'(g, H) {
    roundTower(g, {
      H, rBot: 2.3, rTop: 2.0, bands: [{ f: 1, color: WHITE }], lr: 1.0, lh: 1.3,
      roof: 'cone', roofColor: RED, windows: [0.5],
    });
  },

  // White round tower with a black band at the top, white lantern, red roof, on an
  // unpainted round conical stone base (ibiblio).
  'Väcker'(g, H) {
    const top = H - stackHeight(0.85, 1.3, 'cone');
    const base = top * 0.32;
    const black = top * 0.12;
    taperStack(g, 3.3, 2.3, 0, [{ h: base, color: GREY }], 7);
    box(g, 0.9, 1.6, 0.5, 0, DOOR, 0, apothem(3.3, 7) - 0.2);
    taperStack(g, 2.3, 1.6, base, [{ h: top - base - black, color: WHITE }, { h: black, color: BLACK }], 7);
    gallery(g, 2.4, top, WHITE);
    lantern(g, top + 0.25, 0.85, 1.3, { frame: WHITE, roof: 'cone', roofColor: RED });
  },

  // Slim round tower: white base, one broad black band, white top, white lantern.
  'Ramskär'(g, H) {
    roundTower(g, {
      H, rBot: 1.8, rTop: 1.2,
      bands: [{ f: 0.4, color: WHITE }, { f: 0.33, color: BLACK }, { f: 0.27, color: WHITE }],
      lr: 0.8, roof: 'dome', roofColor: WHITE,
    });
  },

  // White round tower with one black band.
  'Gäven'(g, H) {
    roundTower(g, {
      H, rBot: 2.1, rTop: 1.7,
      bands: [{ f: 0.5, color: WHITE }, { f: 0.25, color: BLACK }, { f: 0.25, color: WHITE }],
    });
  },

  // All-white round tower.
  'Kråksundsgap Södra'(g, H) {
    roundTower(g, { H, rBot: 2.2, rTop: 1.6, bands: [{ f: 1, color: WHITE }], windows: [0.5] });
  },

  // Tall slender red cylinder with iron-plate ribs, small gallery, red lantern.
  'Väderöbod'(g, H) {
    const top = H - stackHeight(0.75, 1.2, 'dome');
    const plinth = 0.8;
    const tower = top - plinth;
    frustum(g, 2.0, 1.8, plinth, 0, GREY, 7);
    const t = taperStack(g, 1.5, 1.0, plinth, [{ h: tower, color: RED }], 7);
    for (const f of [0.25, 0.5, 0.75]) {
      const y = plinth + tower * f;
      const r = t.radiusAt(y) + 0.1;
      frustum(g, r, r, 0.2, y, DARK_RED, 7);
    }
    box(g, 0.8, 1.4, 0.4, plinth, DOOR, 0, apothem(1.5, 7));
    gallery(g, 1.7, top, RED);
    lantern(g, top + 0.25, 0.75, 1.2, { frame: RED, roof: 'dome', roofColor: RED });
  },

  // Concrete sea tower: red over black, helipad.
  'Trubaduren'(g, H) {
    seaTower(g, { H, bands: [{ f: 0.5, color: BLACK }, { f: 0.5, color: RED }] });
  },

  // Two red round towers, each with a red slatted daymark.
  'Lindholmen'(g, H) {
    const red = { rBot: 2.2, rTop: 1.7, bands: [{ f: 1, color: RED }], galleryColor: RED, frame: RED, roof: 'dome', roofColor: RED, posts: 4 };
    const a = roundTower(sub(g, -4.8), { ...red, H });
    slatDaymark(g.children[g.children.length - 1], { r: 2.0, y: a.top * 0.35, h: 5, width: 3.2, color: RED });
    const hb = 6 + 0.5 * 13;
    const b = roundTower(sub(g, 4.8), { ...red, H: hb, rBot: 2.1, rTop: 1.65, glassName: 'lantern-glass-twin' });
    slatDaymark(g.children[g.children.length - 1], { r: 1.95, y: b.top * 0.35, h: 4.6, width: 3.0, color: RED });
  },

  // Concrete sea tower: white with a green band, helipad.
  'Brandskärsflak'(g, H) {
    seaTower(g, { H, bands: [{ f: 0.4, color: WHITE }, { f: 0.2, color: SEA_GREEN }, { f: 0.4, color: WHITE }] });
  },

  // Concrete sea tower: white with a red band, helipad.
  'Dynabrott'(g, H) {
    seaTower(g, { H, bands: [{ f: 0.4, color: WHITE }, { f: 0.2, color: RED }, { f: 0.4, color: WHITE }] });
  },

  // Concrete sea tower: red over black, helipad.
  'Hätteberget'(g, H) {
    seaTower(g, { H, bands: [{ f: 0.5, color: BLACK }, { f: 0.5, color: RED }] });
  },

  // Plain white tower on a black base.
  'Södra Syster'(g, H) {
    roundTower(g, {
      H, rBot: 2.3, rTop: 1.9, bands: [{ f: 0.22, color: BLACK }, { f: 0.78, color: WHITE }], windows: [0.5],
    });
  },
};

// One uncoloured-band drum (used by Carlsten).
function taperStackSimple(g, rBot, rTop, h, color, seg) {
  return taperStack(g, rBot, rTop, 0, [{ h, color }], seg);
}

// Lights that have NO sweeping beam. Islandsberg's old light showed through a row of windows in a gable (gableWindowLight above), not from a rotating lantern: when it is lit it should glow behind
// those windows (the glass and the halo), and not throw the shared beam round. Everything else keeps its beam. Pass the result as the third argument of createLanternFx (src/lantern.js).
export const NO_BEAM_LIGHTS = Object.freeze(['Islandsberg']);
export const lanternOptions = (name) => (NO_BEAM_LIGHTS.includes(name) ? { beam: false } : {});

export function createLighthouse(name) {
  const entry = LIGHTHOUSES.find((l) => l.name === name);
  const build = BUILDERS[name];
  if (!entry || !build) throw new Error(`Unknown lighthouse: ${name}`);
  const g = new THREE.Group();
  g.name = name;
  build(g, gameHeight(entry));
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
