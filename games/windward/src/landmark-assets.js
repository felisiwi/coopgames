// Landmark assets (docs/ISLAND-ASSETS-BRIEF.md): the first recognisable-from-a-boat things of the Bohuslän coast, built in the style of
// era-assets.js (low-poly add-functions writing flat Lambert triangles into shared Meshers, Skagen pastels, no textures, windows are the only lit thing).
//
//   cairn      stone cairns (kummel): heaped, white square, black cylinder (with an arm), white cone (with an arm), white with a coloured belt,
//              tall white with a pole and red ball, small white
//   polemark   pole marks (stangmärke): Måseskär 1829, Gäven 1835 (heart-shaped spire with a lookout house)
//   fyrkur     small automatic lights: Stångholmen (iron octagon 1940, plastic round 1974), Fredagsholmen (1883 wooden light house, 1942 sheet metal)
//   sjobod     sea hut (sjöbod), a row of them, drying nets, fish racks
//   church     a red chapel (1799), the white cross church (Grundsund), the tower church (Käringön), a school chapel (Gåsö 1955)
//   windmill   the Fiskebäckskil Dutch windmill (1854-55)
//   darkhouse  Stångehuvud's small white wooden light house with a black A-frame roof (dark since 1940)
//
// REUSED from era-assets.js (imported, not copied): Mesher, GLASS, F50 (colours), addKummel (the heaped unpainted cairn), addBoathouse (the 1703 sea hut),
// addSjobod1950 (the 1950 sea huts), addDryingRacks (fish racks), addFyrkur1950 (Stångholmen's iron octagon). NEW: everything else. era-assets.js keeps its helpers
// (colour table, shell(), windowAt(), rngOf()) private and this mission may not edit it, so small look-alikes live in this file.
//
// SCALE (from how the game already does it, checked 2026-11-07):
//  - Everything here is built at 1:1 REAL metres (the boat's scale: a koster is 8 m), like seamark-meshes.js and the era kit. The coast is 1:10 in plan only.
//  - The game enlarges landmarks when it PLACES them so they read from its camera: src/world-year-build.js scales a cairn x1.8 and a painted rock mark x2.0.
//    That factor is data here (readScale per type), applied by the placer / the lab, not baked into the geometry. Small automatic lights are placed at built
//    size (createFyrkur1950().group, no scale); big towers use lighthouses.js gameHeight = 6 + 0.5 x realHeight (none of those are in this kit).
//  - Local frame: y up, ground at y = 0, the seaward / front side is +Z (so an arm "toward the fairway" points +Z; the placer turns it with a compass bearing).
// Nothing here is used by the game yet (new files only); landmark-lab.html is the viewer.
import * as THREE from '../vendor/three/three.module.js';
import { Mesher, GLASS, F50, addKummel, addBoathouse, addDryingRacks, addSjobod1950, addFyrkur1950 } from './era-assets.js';

export const ERAS = ['1703', '1950', 'today'];
export const EXTRA_ERAS = ['1800s']; // exists only between the game's eras (shown in the lab's "all" view, never placed)

// ---- palette: Skagen pastels (ART.md), limewash softened a touch warm; belts and balls a little pulled toward the pastels ---------------
const L = {
  lime: 0xf1ede2, black: 0x41424b, base: 0xb7a3b3, granite: 0xe3c9c1, redBelt: 0xc4584b, greenBelt: 0x6e9a7c, ball: 0xc9483a,
  falu: F50.falu, white: F50.white, ochre: F50.ochre, tarRoof: F50.tarRoof, tar: 0x3a2f27, tarPole: 0x4b3d34, timber: 0x9b958a, wood: 0xb8a183, woodDark: 0x8c7658,
  net: 0x7d8a7a, slate: 0x6f6e7c, copper: 0x9bbfa8, stone: 0xa89ca6, sailWhite: 0xe9e3d3, solar: 0x4d5a78, concrete: 0xb9b2a3, redRoof: 0xa8503f,
};
const lerp = (a, b, t) => a + (b - a) * t;
const colorCache = new Map();
const shade = (hex, f) => { const k = `${hex}`; if (!colorCache.has(k)) colorCache.set(k, new THREE.Color(hex)); return colorCache.get(k).clone().multiplyScalar(f); };
function rngOf(seed) { // mulberry32: same seed, same look
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const ringXZ = (r, i, n) => { const t = (i / n) * Math.PI * 2; return [-Math.sin(t) * r, -Math.cos(t) * r]; }; // the same corner order as Mesher.tube for a vertical axis

// ---- small shared pieces ------------------------------------------------------------------------------------------------------------
// A vertical frustum (tapered tube) with a flat lid: the body of a cairn, a mast foot, a mill.
function frustum(S, y0, y1, r0, r1, sides, color, lid = null) {
  S.tube([0, y0, 0], [0, y1, 0], r0, r1, sides, color);
  if (lid != null) for (let i = 0; i < sides; i++) { const [ax, az] = ringXZ(r1, i, sides), [bx, bz] = ringXZ(r1, i + 1, sides); S.tri([0, y1, 0], [bx, y1, bz], [ax, y1, az], lid); }
}
// An octahedron ball (8 triangles): the red ball on Bonden's pole.
function ball(S, cx, cy, cz, r, color) {
  const P = [[cx + r, cy, cz], [cx - r, cy, cz], [cx, cy, cz + r], [cx, cy, cz - r], [cx, cy + r, cz], [cx, cy - r, cz]];
  for (const [a, b] of [[0, 2], [2, 1], [1, 3], [3, 0]]) { S.tri(P[a], P[b], P[4], color); S.tri(P[b], P[a], P[5], shade(color, 0.85)); }
}
// A window on a wall plane z = 0 facing +z (call inside S.at): pale frame + glass quad (lit = warm at dusk).
function win(S, G, cx, cy, w, h, { lit = false, frame = L.white } = {}) {
  const [x0, x1, y0, y1] = [cx - w / 2, cx + w / 2, cy - h / 2, cy + h / 2], fr = Math.min(0.08, w * 0.15);
  S.quad([x0 - fr, y0 - fr, 0.015], [x1 + fr, y0 - fr, 0.015], [x1 + fr, y1 + fr, 0.015], [x0 - fr, y1 + fr, 0.015], frame);
  (lit ? G.on : G.off).quad([x0, y0, 0.03], [x1, y0, 0.03], [x1, y1, 0.03], [x0, y1, 0.03], null);
}
// A gabled box house (walls + gable ends + two roof planes): chapels, the dark light house, the lookout.
function gableHouse(S, { w, d, h, rh, eave = 0.25, gableOv = 0.2, wall, roof, roofB = null, bands = 0, foot = null }) {
  const strips = Math.max(1, bands), wc = (k) => (bands ? shade(wall, 1 - 0.06 * (k % 2)) : wall);
  const side = (a, b) => { for (let k = 0; k < strips; k++) S.quad([a[0], (h * k) / strips, a[1]], [b[0], (h * k) / strips, b[1]], [b[0], (h * (k + 1)) / strips, b[1]], [a[0], (h * (k + 1)) / strips, a[1]], wc(k)); };
  side([-w / 2, d / 2], [w / 2, d / 2]); side([w / 2, -d / 2], [-w / 2, -d / 2]); side([w / 2, d / 2], [w / 2, -d / 2]); side([-w / 2, -d / 2], [-w / 2, d / 2]);
  S.tri([-w / 2, h, d / 2], [w / 2, h, d / 2], [0, h + rh, d / 2], wall); S.tri([w / 2, h, -d / 2], [-w / 2, h, -d / 2], [0, h + rh, -d / 2], wall);
  const ex = w / 2 + eave, ez = d / 2 + gableOv, ey = h - eave * (rh / (w / 2));
  S.quad([-ex, ey, ez], [0, h + rh, ez], [0, h + rh, -ez], [-ex, ey, -ez], roof); S.quad([0, h + rh, ez], [ex, ey, ez], [ex, ey, -ez], [0, h + rh, -ez], roofB ?? shade(roof, 0.93));
  if (foot) S.box(0, -0.2, 0, w + 0.3, 0.9, d + 0.3, foot);
}

// ======================================================================================================
//  CAIRNS (kummel). One parametric build; the variants are presets from the brief's table 1.1.
//  `real` = what a source gave (RAÄ records quoting Söderlund 2007); `designer` = what I had to choose.
// ======================================================================================================
// shape: 'square' | 'cylinder' | 'cone'; h metres; belt {from,to,colour} as fractions of the body height; top: 'none' | 'arm' | 'board' | 'pole-ball' | 'stub'
function addCairnBody(S, { shape, h, base, topR, colour, belt = null, top = 'none', armLen = 0.8, armDir = 0, courses = 3, seed = 1, poleLen = 3.2 }) {
  const sides = shape === 'square' ? 4 : shape === 'cone' ? 8 : 7;
  const kk = shape === 'square' ? Math.SQRT2 : 1; // a square's corner radius
  const r = rngOf(seed);
  S.at({ ry: shape === 'square' ? Math.PI / 4 : 0 }, () => {
    frustum(S, -0.3, 0.35, base * 1.18 * kk, base * 1.06 * kk, sides, L.granite, L.granite); // the granite footing the limewashed stones stand on
    const hh = h - 0.35;
    for (let k = 0; k < courses; k++) {
      const t0 = k / courses, t1 = (k + 1) / courses;
      let col = shade(colour, 0.95 + 0.05 * ((k + Math.floor(r() * 2)) % 2)); // courses of stone: a hair lighter / darker
      if (belt && t0 >= belt.from - 1e-6 && t1 <= belt.to + 1e-6) col = belt.colour;
      frustum(S, 0.35 + hh * t0, 0.35 + hh * t1, lerp(base, topR, t0) * kk, lerp(base, topR, t1) * kk, sides, col, k === courses - 1 ? shade(colour, 1.04) : null);
    }
  });
  const y = h; // top of the stonework
  if (top === 'arm') { // a short arm pointing along armDir (0 = +Z, the fairway side)
    S.at({ ry: armDir }, () => { S.box(0, y + 0.22, 0, 0.16, 0.44, 0.16, colour); S.box(0, y + 0.44, armLen / 2, 0.14, 0.14, armLen, colour); });
  } else if (top === 'stub') { // Kråksundsgap's weathered top mark: the post and a part of a board
    S.tube([0, y, 0], [0, y + 1.0, 0], 0.07, 0.06, 4, L.tarPole); S.quad([-0.4, y + 0.55, 0.05], [0.0, y + 0.55, 0.05], [0.0, y + 1.0, 0.05], [-0.4, y + 1.0, 0.05], L.tarPole);
  } else if (top === 'board') { // Byxeskären's square top mark
    S.tube([0, y, 0], [0, y + 1.5, 0], 0.07, 0.06, 4, L.tarPole); S.quad([-0.45, y + 1.05, 0.06], [0.45, y + 1.05, 0.06], [0.45, y + 1.95, 0.06], [-0.45, y + 1.95, 0.06], L.lime);
  } else if (top === 'pole-ball') { // Bonden: a pole with a red ball ("ballong") on top
    S.tube([0, y, 0], [0, y + poleLen, 0], 0.1, 0.07, 5, L.tarPole); ball(S, 0, y + poleLen + 0.38, 0, 0.5, L.ball);
  }
}

export const CAIRN_VARIANTS = {
  'heap': { label: 'Heaped stone, unpainted', eras: ['1703'], eraNote: 'Måseskär: a stone cairn stood there before the 1829 pole mark; whether in 1703 is uncertain', place: 'light:Måseskär', source: 'sv.wikipedia Måseskär; RAÄ Måseskär stångmärke (Söderlund 2007)', confidence: 'low', real: { heightM: null }, designer: ['the whole shape: a heap (the era kit\'s addKummel, reused)'], build: (S) => addKummel(S, null, { seed: 5 }) },
  'square-white': { label: 'White square (Korsholmen 1853)', eras: ['1950', 'today'], place: 'relation/10238557', source: 'RAÄ ORUST VALLERÖ 1:4 (Söderlund 2007)', confidence: 'high', real: { heightM: null, note: 'white, square, stone; built 1853' }, designer: ['height 3 m and base width (not in the record)'], build: (S) => addCairnBody(S, { shape: 'square', h: 3.0, base: 1.25, topR: 0.9, colour: L.lime, seed: 11 }) },
  'cylinder-black': { label: 'Black cylinder (Tornö 1886)', eras: ['1950', 'today'], place: 'relation/10238557', source: 'RAÄ ORUST VALLERÖ 1:5 (Söderlund 2007)', confidence: 'high', real: { heightM: 3.5, note: 'black, cylindrical, on the highest point' }, designer: ['base width'], build: (S) => addCairnBody(S, { shape: 'cylinder', h: 3.5, base: 1.35, topR: 1.0, colour: L.black, seed: 12 }) },
  'cylinder-black-arm': { label: 'Black cylinder with a top mark (Kråksundsgap, Bråtö 1838/1868)', eras: ['1950', 'today'], place: 'light:Kråksundsgap Södra', source: 'RAÄ ORUST BARREVIK 1:16 husnr 9002 (Söderlund 2007)', confidence: 'high', real: { heightM: 3.5, note: 'black, originally whitewashed, top mark (a board) partly gone; built 1838, rebuilt 1868' }, designer: ['base width', 'the shape of the stub'], build: (S) => addCairnBody(S, { shape: 'cylinder', h: 3.5, base: 1.35, topR: 1.0, colour: L.black, top: 'stub', seed: 13 }) },
  'cone-white-arm': { label: 'White concrete cone with an arm (Hinneskär 1878, Pipeskär 1933)', eras: ['1950', 'today'], place: 'light:Måseskär', source: 'RAÄ ORUST MÅSESKÄR 1:1 husnr 9002; ORUST EDSHULT S:6 (Söderlund 2007)', confidence: 'high', real: { heightM: 4.8, note: 'Hinneskär 4.8 m, arm to the south-east, raised after 1978; Pipeskär 2.6 m with a 0.75 m arm to the east (1933)' }, designer: ['Hinneskär in 1950 about 0.8 m lower (it was raised after 1978; by how much is not stated)', 'Hinneskär arm length (about 0.9 m)', 'base width'], build: (S, G, o) => addCairnBody(S, { shape: 'cone', h: o.size === 'small' ? 2.6 : o.era === 'today' ? 4.8 : 4.0, base: o.size === 'small' ? 1.0 : 1.7, topR: o.size === 'small' ? 0.3 : 0.5, colour: L.lime, top: 'arm', armLen: o.size === 'small' ? 0.75 : 0.9, armDir: o.size === 'small' ? Math.PI / 2 : -Math.PI / 4 * 3, courses: 4, seed: 14 }) },
  'belt-white-red': { label: 'White with a red belt (Jämningarna 1874)', eras: ['1950', 'today'], place: 'relation/10237897', source: 'RAÄ LYSEKIL GÅSÖ S:27 (Söderlund 2007)', confidence: 'medium', real: { heightM: null, note: 'white stone cairn with a red belt; earlier all white' }, designer: ['height 4 m', 'base width', 'when the belt was painted (the record gives no year)'], build: (S) => addCairnBody(S, { shape: 'cylinder', h: 4.0, base: 1.55, topR: 1.05, colour: L.lime, belt: { from: 0.4, to: 0.7, colour: L.redBelt }, courses: 5, seed: 15 }) },
  'belt-white-green': { label: 'White with a green belt and a square top mark (Byxeskären 1874)', eras: ['1950', 'today'], place: 'relation/10237897', source: 'RAÄ LYSEKIL GÅSÖ S:5 (Söderlund 2007)', confidence: 'medium', real: { heightM: null, note: 'white stone cairn, green belt, square top mark; earlier a slanting red belt' }, designer: ['height 4 m', 'base width', '1950 belt colour (the record says "earlier red": shown red in 1950, green today: low confidence)'], build: (S, G, o) => addCairnBody(S, { shape: 'cylinder', h: 4.0, base: 1.55, topR: 1.05, colour: L.lime, belt: { from: 0.4, to: 0.7, colour: o.era === 'today' ? L.greenBelt : L.redBelt }, top: 'board', courses: 5, seed: 16 }) },
  'tall-white-pole-ball': { label: 'Tall white with a pole and red ball (Bonden 1875)', eras: ['1950', 'today'], eraNote: 'the pole and ball stand in 1950 and fell in 2005: today the bare cairn', place: 'relation/10250201', source: 'RAÄ LYSEKIL GÅSÖ S:14 (Söderlund 2007)', confidence: 'high', real: { heightM: 8, note: 'white stone cairn on the highest point; pole and red ball fell 2005' }, designer: ['pole length 3.2 m', 'base width'], build: (S, G, o) => addCairnBody(S, { shape: 'cone', h: 8.0, base: 2.5, topR: 0.85, colour: L.lime, top: o.era === 'today' ? 'none' : 'pole-ball', courses: 5, seed: 17 }) },
  'small-white': { label: 'Small white (Tenholmen 1.8 m, Lilla Bockholmen 2 m, Islandsberg 2.5 m)', eras: ['1950', 'today'], place: 'village:Hälleviksstrand', source: 'RAÄ ORUST HÄLLEVIK S:36; LYSEKIL ISLANDSBERG 1:27 (Söderlund 2007)', confidence: 'high', real: { heightM: 2.0, note: 'Tenholmen 1.8 m (before 1937), Lilla Bockholmen 2 m (1870), Islandsberg 2.5 m (1875)' }, designer: ['base width'], build: (S, G, o) => addCairnBody(S, { shape: 'cylinder', h: o.h ?? 2.0, base: (o.h ?? 2.0) * 0.4, topR: (o.h ?? 2.0) * 0.28, colour: L.lime, courses: 2, seed: 18 }) },
};

// ======================================================================================================
//  POLE MARKS (stångmärke): a mast braced by stays, a board on top. Both of these stood only between our eras (1800s).
// ======================================================================================================
function addPoleMarkBody(S, G, { h, colour, stays = 8, stayR = 2.5, stayTop = 0.42, thickStays = false, lookout = false, board }) {
  const hs = h * stayTop;
  S.tube([0, 0, 0], [0, h, 0], 0.3, 0.2, 6, colour); // the mast
  for (let k = 0; k < stays; k++) { // the stays (stöttor) lean in to the mast; clad with boards = fatter
    const [x, z] = ringXZ(stayR, k, stays);
    S.tube([x, 0, z], [x * 0.06, hs, z * 0.06], thickStays ? 0.32 : 0.17, thickStays ? 0.2 : 0.12, 5, thickStays ? shade(colour, 0.94) : colour);
  }
  if (lookout) { // the pilots' lookout house among the stays: about 20 m2, 3 m up, red walls, a tarred roof (the 2009 replica's numbers)
    S.box(0, 3.0, 0, 4.7, 0.22, 4.7, L.tarPole);
    S.box(0, 4.15, 0, 4.4, 2.1, 4.4, colour);
    S.pyramid(0, 5.2, 0, 3.0, 1.1, 4, shade(L.tarRoof, 1.1));
    S.at({ p: [0, 4.1, 2.21] }, () => win(S, G, 0, 0, 1.2, 0.8, { frame: shade(colour, 0.8) }));
  }
  // the board on a slanted post at the top
  S.tube([0, h - 0.2, 0], [0.5, h + 1.4, 0], 0.08, 0.06, 4, L.tarPole);
  S.at({ p: [0.5, h + 1.4, 0.06] }, () => board(S));
}
const diamond = (S, c, hw) => S.quad([0, -hw, 0], [hw, 0, 0], [0, hw, 0], [-hw, 0, 0], c);
export const POLEMARK_VARIANTS = {
  'maseskar-1829': { label: 'Måseskär 1829 (18 m, red, white board point down)', eras: [], eraLabel: '1800s (1829-1865)', place: 'light:Måseskär', source: 'sv.wikipedia Måseskär; RAÄ Måseskär stångmärke (Söderlund 2007)', confidence: 'medium', real: { heightM: 18, note: 'red, a heart-shaped spire with board-clad stays, a white board point down' }, designer: ['stay count and spread'], build: (S, G) => addPoleMarkBody(S, G, { h: 18, colour: L.redBelt, stays: 4, stayR: 3.0, thickStays: true, board: (T) => diamond(T, L.lime, 1.1) }) },
  'gaven-1835': { label: 'Gäven 1835 (15 m, 8 stays, lookout house)', eras: [], eraLabel: '1800s (1835 to about 1901 or 1917)', place: 'light:Gäven', source: 'RAÄ Gäven stångmärke (Söderlund 2007); fyrwiki Gäven (Underrättelse 1842)', confidence: 'high', real: { heightM: 15, note: 'red, heart-shaped spire with eight stays, a lookout house among them (about 20 m2, 3 m up on the 2009 replica), a square board half red, half white' }, designer: ['the division of the board (shown as two vertical halves)', 'stay ring radius'], build: (S, G) => addPoleMarkBody(S, G, { h: 15, colour: L.falu, stays: 8, stayR: 2.5, lookout: true, board: (T) => { T.quad([-0.9, -0.9, 0], [0, -0.9, 0], [0, 0.9, 0], [-0.9, 0.9, 0], L.falu); T.quad([0, -0.9, 0], [0.9, -0.9, 0], [0.9, 0.9, 0], [0, 0.9, 0], L.lime); } }) },
};

// ======================================================================================================
//  SMALL AUTOMATIC LIGHTS (fyrkur)
// ======================================================================================================
function fyrkurBody(S, { socketH = 1.1, socketW = 2.6, bodyR = 1.0, bodyR2 = 0.82, bodyTop = 4.2, sides = 8, body = L.white, cap = F50.black, roof = null, solar = false }) {
  S.box(0, socketH / 2, 0, socketW, socketH, socketW, L.concrete);
  S.tube([0, socketH, 0], [0, bodyTop, 0], bodyR, bodyR2, sides, body);
  S.drum(0, bodyTop, 0, bodyR2 + 0.4, 0.16, sides, F50.black);
  S.drum(0, bodyTop + 0.16, 0, 0.78, 0.9, sides, L.white);
  S.drum(0, bodyTop + 1.06, 0, 0.9, 0.12, sides, F50.black);
  S.pyramid(0, bodyTop + 1.18, 0, 0.95, 0.7, sides, roof ?? cap);
  if (solar) { S.at({ p: [bodyR2 + 0.55, bodyTop + 0.3, 0], ry: Math.PI / 2, rx: -0.5 }, () => S.quad([-0.5, -0.35, 0], [0.5, -0.35, 0], [0.5, 0.35, 0], [-0.5, 0.35, 0], L.solar)); }
}
export const FYRKUR_VARIANTS = {
  'stangholmen-iron': { label: 'Stångholmen: white octagonal iron (1940-1974)', eras: ['1950'], place: 'relation/10237903', source: 'fyrwiki Stångholmen; repo lights-1950.js', confidence: 'medium', real: { heightM: 6, note: 'focal height 6 m, white octagonal iron fyrkur' }, designer: ['proportions (the era kit\'s addFyrkur1950, reused)'], lantern: { y: 4.92, r: 0.62, h: 1.1 }, build: (S, G) => addFyrkur1950(S, G, {}) },
  'stangholmen-plastic': { label: 'Stångholmen: round plastic with solar panel (1974-)', eras: ['today'], place: 'relation/10237903', source: 'fyrwiki Stångholmen', confidence: 'medium', real: { heightM: 6, note: 'round plastic fyrkur since 1974, solar power' }, designer: ['proportions'], lantern: { y: 4.4, r: 0.55, h: 1.0 }, build: (S) => fyrkurBody(S, { socketH: 0.9, socketW: 2.3, bodyR: 0.85, bodyR2: 0.7, bodyTop: 3.6, sides: 10, body: L.white, cap: L.white, roof: F50.grey, solar: true }) },
  'fredagsholmen-1942': { label: 'Fredagsholmen: white sheet metal on a concrete base (1942-)', eras: ['1950'], place: 'relation/10237443', source: 'fyrwiki Fredagsholmen', confidence: 'medium', real: { heightM: 5.5, note: 'white sheet-metal fyrkur on a concrete socket; focal height 5.5 m' }, designer: ['proportions', 'the socket height'], lantern: { y: 4.7, r: 0.6, h: 1.0 }, build: (S) => fyrkurBody(S, { socketH: 1.6, socketW: 2.4, bodyR: 0.9, bodyR2: 0.78, bodyTop: 3.6, body: L.white, cap: F50.black }) },
  'fredagsholmen-today': { label: 'Fredagsholmen: red roof and solar panel (today)', eras: ['today'], place: 'relation/10237443', source: 'fyrwiki Fredagsholmen', confidence: 'medium', real: { heightM: 5.5, note: 'white fyrkur with a red roof, solar power' }, designer: ['proportions'], lantern: { y: 4.7, r: 0.6, h: 1.0 }, build: (S) => fyrkurBody(S, { socketH: 1.6, socketW: 2.4, bodyR: 0.9, bodyR2: 0.78, bodyTop: 3.6, body: L.white, cap: F50.black, roof: L.redRoof, solar: true }) },
  'fredagsholmen-1883': { label: 'Fredagsholmen: the 1883 prefab wooden light house (1883-1942)', eras: [], eraLabel: '1800s (1883-1942)', place: 'relation/10237443', source: 'fyrwiki Fredagsholmen (Bark & Warburg prefab; "white light house with a lantern on the gable")', confidence: 'medium', real: { heightM: 3.7, note: 'focal height 3.7 m; white wooden house with a lantern on the gable' }, designer: ['house size', 'the lantern box'], lantern: { y: 3.55, r: 0.4, h: 0.7, z: 1.7 }, build: (S, G) => { gableHouse(S, { w: 2.8, d: 3.4, h: 2.2, rh: 1.1, wall: L.white, roof: L.tarRoof, foot: L.stone }); S.box(0, 3.0, 1.75, 0.9, 1.0, 0.7, L.white); S.pyramid(0, 3.5, 1.75, 0.65, 0.5, 4, L.tarRoof); S.at({ p: [0, 1.1, 1.71] }, () => win(S, G, 0, 0.0, 0.8, 1.2, {})); } },
};

// ======================================================================================================
//  SEA HUTS (sjöbod), rows of them, drying nets and fish racks
// ======================================================================================================
export function addSjobodRow(S, G, { era = '1950', n = 5, seed = 4, gap = 6.2 } = {}) {
  const r = rngOf(seed);
  const cols = ['red', 'ochre', 'red', 'wood', 'red', 'ochre'];
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * gap + (r() - 0.5) * 0.5, z = (r() - 0.5) * 1.6, ry = (r() - 0.5) * 0.12;
    S.at({ p: [x, 0, z], ry, s: era === '1703' ? 0.82 : 1 }, () => (era === '1703' ? addBoathouse(S, G, {}) : addSjobod1950(S, G, { colour: cols[(i + Math.floor(seed)) % cols.length] })));
  }
}
export function addNetPoles(S, G, { n = 4, seed = 6 } = {}) { // poles with a net hung over a cross pole to dry
  const r = rngOf(seed);
  for (let k = 0; k < n; k++) {
    const x = (k - (n - 1) / 2) * 2.4;
    S.tube([x, 0, 0], [x, 3.2, 0], 0.07, 0.05, 4, L.woodDark);
    S.tube([x - 0.9, 3.0, 0], [x + 0.9, 3.0, 0], 0.05, 0.05, 4, L.wood);
    const drop = 1.6 + r() * 0.5;
    S.tri([x - 0.9, 3.0, 0.02], [x + 0.9, 3.0, 0.02], [x + 0.55, 3.0 - drop, 0.05], L.net);
    S.tri([x - 0.9, 3.0, 0.02], [x + 0.55, 3.0 - drop, 0.05], [x - 0.5, 3.0 - drop * 0.85, 0.05], shade(L.net, 0.92));
  }
}
export const SJOBOD_VARIANTS = {
  'row': { label: 'Row of sea huts (gable to the water)', frame: 30, eras: ['1703', '1950', 'today'], place: 'relation/10094463', source: 'sv.wikipedia Stora Kornö (sea huts from the 1600s); WORLD-1950 (falu red or ochre)', confidence: 'medium', real: { note: 'timber, gable to the water, tight rows; oldest from the 1600s' }, designer: ['the number and mix of colours', '1703 huts a little smaller, grey tarred timber (era kit)'], build: (S, G, o) => addSjobodRow(S, G, { era: o.era, n: o.n ?? 5 }) },
  'single': { label: 'One sea hut', eras: ['1703', '1950', 'today'], place: 'relation/10094463', source: 'era-assets.js (reused)', confidence: 'medium', real: {}, designer: ['colour'], build: (S, G, o) => (o.era === '1703' ? addBoathouse(S, G, {}) : addSjobod1950(S, G, { colour: 'red' })) },
  'nets': { label: 'Drying nets on poles', eras: ['1703', '1950'], place: 'village:Gullholmen', source: 'ISLAND-ASSETS-BRIEF 1.7', confidence: 'low', real: {}, designer: ['everything about the look'], build: (S, G) => addNetPoles(S, G, {}) },
  'racks': { label: 'Fish-drying racks', eras: ['1703', '1950'], place: 'village:Gullholmen', source: 'era-assets.js addDryingRacks (reused)', confidence: 'medium', real: {}, designer: ['the look'], build: (S, G) => addDryingRacks(S, G, {}) },
};

// ======================================================================================================
//  CHURCHES AND CHAPELS: small, white, board-clad (the sea marks of the villages)
// ======================================================================================================
function addChurchBody(S, G, { nave, tower = null, transept = null, wall, roof, spire = null, windows = 3, lit = false }) {
  S.at({}, () => {
    gableHouse(S, { w: nave.w, d: nave.d, h: nave.h, rh: nave.rh, wall, roof, bands: 3, foot: L.stone, eave: 0.3, gableOv: 0.25 });
    if (transept) S.at({ ry: Math.PI / 2 }, () => gableHouse(S, { w: transept.w, d: transept.d, h: nave.h, rh: transept.rh, wall, roof, bands: 3, foot: L.stone, eave: 0.3, gableOv: 0.25 }));
    for (const side of [1, -1]) S.at({ p: [side * (nave.w / 2), 0, 0], ry: (side * Math.PI) / 2 }, () => { for (let k = 0; k < windows; k++) win(S, G, (k - (windows - 1) / 2) * (nave.d / (windows + 0.8)) * (side > 0 ? -1 : 1), nave.h * 0.55, 0.8, 1.7, { lit }); });
    if (tower) {
      S.at({ p: [0, 0, nave.d / 2 + tower.d / 2 - 0.1] }, () => {
        S.box(0, tower.h / 2, 0, tower.w, tower.h, tower.d, wall);
        S.pyramid(0, tower.h, 0, tower.w * 0.78, tower.spire, 4, spire ?? roof);
        S.at({ p: [0, 0, tower.d / 2] }, () => { S.quad([-0.6, 0, 0.03], [0.6, 0, 0.03], [0.6, 2.0, 0.03], [-0.6, 2.0, 0.03], L.tar); win(S, G, 0, tower.h * 0.7, 0.7, 1.0, { lit }); });
      });
    } else S.at({ p: [0, 0, nave.d / 2] }, () => S.quad([-0.7, 0, 0.03], [0.7, 0, 0.03], [0.7, 2.1, 0.03], [-0.7, 2.1, 0.03], L.tar));
  });
}
export const CHURCH_VARIANTS = {
  'red-chapel-1799': { label: 'Grundsund: the first red chapel (1799, no tower until 1818)', eras: [], eraLabel: '1800s (1799-1893)', place: 'village:Grundsund', source: 'sv.wikipedia Grundsund; Grundsunds kyrka (red-painted, a three-sided chancel)', confidence: 'medium', real: { note: 'small, red-painted; tower and bell only in 1818' }, designer: ['all dimensions'], build: (S, G) => addChurchBody(S, G, { nave: { w: 6.2, d: 10, h: 3.8, rh: 2.8 }, wall: L.falu, roof: L.tarRoof, windows: 2 }) },
  'cross-church': { label: 'Grundsund: the white cross church (1893)', eras: ['1950', 'today'], place: 'village:Grundsund', source: 'sv.wikipedia Grundsunds kyrka (cross church, panelled and whitewashed, tower from 1818)', confidence: 'medium', real: { note: 'cross church, 700 seats at first, white panelling, a tower from 1818 with a curved hood and a thin spire' }, designer: ['all dimensions'], build: (S, G) => addChurchBody(S, G, { nave: { w: 9, d: 18, h: 5.5, rh: 4.2 }, transept: { w: 8, d: 16, rh: 3.8 }, tower: { w: 3.6, d: 3.6, h: 11, spire: 5 }, wall: L.white, roof: L.tarRoof, spire: L.tarRoof, windows: 4 }) },
  'tower-church': { label: 'Käringön: white wooden church with a tall tower (1796)', eras: ['1950', 'today'], eraNote: 'the walls were red for about 100 years and are white today; the year of the repaint is not given', place: 'village:Käringön', source: 'sv.wikipedia Käringöns kyrka; Svenska kyrkan Käringöns kyrka (20 m tower, copper-clad spire)', confidence: 'medium', real: { heightM: 20, note: '20 m tower with a copper-clad spire' }, designer: ['nave size', '1950 wall colour shown white (uncertain)'], build: (S, G) => addChurchBody(S, G, { nave: { w: 8, d: 13, h: 5, rh: 3.4 }, tower: { w: 3.8, d: 3.8, h: 14, spire: 6 }, wall: L.white, roof: L.slate, spire: L.copper, windows: 3 }) },
  'school-chapel': { label: 'Gåsö: the school made a chapel (1955)', eras: ['today'], place: 'relation/10604591', source: 'sv.wikipedia Gåsö (the school became a chapel, consecrated 1955)', confidence: 'medium', real: { note: 'a small former school' }, designer: ['all dimensions and colour'], build: (S, G) => addChurchBody(S, G, { nave: { w: 5.4, d: 8, h: 3.2, rh: 2.4 }, wall: L.white, roof: L.tarRoof, windows: 2 }) },
};

// ======================================================================================================
//  THE FISKEBÄCKSKIL WINDMILL (Dutch type, built 1854-55): an octagonal tapering tower, a turning cap, four lattice sails
// ======================================================================================================
export function addWindmill(S, G, { body = L.timber, sails = 0.35 } = {}) {
  S.at({}, () => {
    S.box(0, -0.2, 0, 7.4, 0.9, 7.4, L.stone);
    frustum(S, 0, 8.5, 3.3, 2.0, 8, body, null);
    S.tube([0, 8.5, 0], [0, 9.2, 0], 2.1, 2.1, 8, shade(body, 0.8));
    S.pyramid(0, 9.2, 0, 2.2, 2.0, 8, L.tar); // the cap
    S.at({ p: [0, 0, 3.15] }, () => { S.quad([-0.55, 0, 0.03], [0.55, 0, 0.03], [0.55, 1.8, 0.03], [-0.55, 1.8, 0.03], L.tar); win(S, G, 0, 4.6, 0.6, 0.9, {}); });
    S.at({ p: [0, 8.2, 2.3], rz: sails * Math.PI }, () => { // the sail cross on a hub at the front of the cap, 7 m arms
      S.drum(0, -0.15, 0.1, 0.3, 0.4, 6, shade(body, 0.7));
      for (let k = 0; k < 4; k++) S.at({ rz: (k * Math.PI) / 2 }, () => { S.box(0, 3.6, 0.35, 0.18, 7.2, 0.14, L.woodDark); S.quad([0.05, 1.2, 0.4], [1.35, 1.2, 0.4], [1.35, 6.6, 0.4], [0.05, 6.6, 0.4], L.sailWhite); S.quad([0.05, 1.2, 0.4], [0.05, 6.6, 0.4], [0.7, 4.0, 0.4], [0.05, 4.0, 0.4], shade(L.sailWhite, 0.9)); });
    });
  });
}
export const WINDMILL_VARIANTS = {
  'dutch': { label: 'Fiskebäckskil windmill (holländare, 1854-55)', eras: ['1950', 'today'], place: 'village:Fiskebäckskil', source: 'RAÄ LYSEKIL SKAFTÖ-FISKEBÄCK 1:107 (built 1854-55; owned by Sjöstjärnan since 1913)', confidence: 'medium', real: { note: 'a Dutch-type windmill built 1854-55 by the miller' }, designer: ['colour (timber grey, tarred cap)', 'all dimensions: TODO(felix): confirm the colour'], build: (S, G) => addWindmill(S, G, {}) },
};

// ======================================================================================================
//  STÅNGEHUVUD'S DARK LIGHT HOUSE: a small white wooden house with a black A-frame roof; dark since 1940
// ======================================================================================================
export function addDarkLightHouse(S, G, { led = false } = {}) {
  gableHouse(S, { w: 3.0, d: 4.2, h: 2.4, rh: 1.9, wall: L.white, roof: F50.black, roofB: shade(F50.black, 1.1), foot: L.stone, eave: 0.15, gableOv: 0.25, bands: 3 });
  S.at({ p: [0, 0, 2.1] }, () => { S.quad([-0.5, 0, 0.03], [0.5, 0, 0.03], [0.5, 1.8, 0.03], [-0.5, 1.8, 0.03], L.tar); win(S, G, 0, 3.1, 0.55, 0.7, { lit: led, frame: F50.black }); });
  if (led) S.box(0, 4.5, 0, 0.3, 0.3, 0.3, L.solar); // the solar-powered decorative LED (2014)
}
export const DARKHOUSE_VARIANTS = {
  'dark': { label: 'Stångehuvud light house, dark (since 1940)', eras: ['1950'], place: 'light:Stångehuvud', source: 'stangehuvud.se (Fyrhuset); fyrwiki; WORLD-1950 (small white wooden house, black A-frame roof)', confidence: 'medium', real: { note: 'small white wooden house, black A-frame roof, lit 1890, out 1940' }, designer: ['all dimensions'], build: (S, G) => addDarkLightHouse(S, G, {}) },
  'led': { label: 'Stångehuvud light house with a solar LED (2014)', eras: ['today'], place: 'light:Stångehuvud', source: 'stangehuvud.se (Fyrhuset): solar panel, battery and dusk switch for an LED decorative light in 2014', confidence: 'medium', real: { note: 'decorative LED, powered by a solar panel' }, designer: ['all dimensions'], build: (S, G) => addDarkLightHouse(S, G, { led: true }) },
};

// ======================================================================================================
//  THE REGISTRY (mirrors era-assets.js ASSETS) and createLandmark()
// ======================================================================================================
export const LANDMARK_TYPES = {
  cairn: { label: 'Stone cairn (kummel)', readScale: 1.8, frame: 7, maxTris: 520, variants: CAIRN_VARIANTS },
  polemark: { label: 'Pole mark (stångmärke)', readScale: 2.0, frame: 20, maxTris: 900, variants: POLEMARK_VARIANTS },
  fyrkur: { label: 'Small automatic light (fyrkur)', readScale: 1.0, frame: 7, maxTris: 520, variants: FYRKUR_VARIANTS },
  sjobod: { label: 'Sea huts, nets, racks', readScale: 1.0, frame: 18, maxTris: 1800, variants: SJOBOD_VARIANTS },
  church: { label: 'Church / chapel', readScale: 1.0, frame: 14, maxTris: 1200, variants: CHURCH_VARIANTS },
  windmill: { label: 'Windmill', readScale: 1.0, frame: 12, maxTris: 900, variants: WINDMILL_VARIANTS },
  darkhouse: { label: 'Dark light house (Stångehuvud)', readScale: 1.0, frame: 6, maxTris: 400, variants: DARKHOUSE_VARIANTS },
};
export const TYPE_IDS = Object.keys(LANDMARK_TYPES);
export const variantsOf = (type) => Object.keys(LANDMARK_TYPES[type]?.variants ?? {});
export const defaultVariant = (type) => variantsOf(type)[0] ?? '';
export const eraListOf = (type, variant) => LANDMARK_TYPES[type]?.variants?.[variant]?.eras ?? null; // [] = only between our eras (1800s)
// every (type, variant, era) the shelf can show: eras = the declared ones; for the 1800s-only variants era 'all' shows them with era 1950 looks
export const ALL_VARIANTS = TYPE_IDS.flatMap((t) => variantsOf(t).map((v) => ({ type: t, variant: v, ...LANDMARK_TYPES[t].variants[v] })));
export const buildEraFor = (type, variant, era) => { const e = eraListOf(type, variant) ?? []; return e.includes(era) ? era : e[0] ?? '1950'; }; // the look to draw when asked for an era the variant lacks

const SOLID_MATERIAL = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });

// One landmark as a THREE.Group, base at y = 0, +Z = the seaward side: { group, setNight, describe, dispose }. The group is built 1:1; apply readScale when placing.
export function createLandmark(type, { variant, era = '1950', night = false, size, h, n } = {}) {
  const def = LANDMARK_TYPES[type];
  if (!def) throw new TypeError(`createLandmark: unknown type "${type}" (use ${TYPE_IDS.join(' | ')})`);
  const v = def.variants[variant] ? variant : defaultVariant(type);
  const spec = def.variants[v];
  const lookEra = buildEraFor(type, v, era);
  const S = new Mesher(), G = { on: new Mesher(), off: new Mesher() };
  S.peers = [G.on, G.off];
  spec.build(S, G, { era: lookEra, size, h, n });
  const g = lookEra === '1703' ? GLASS.y1700 : lookEra === '1950' ? GLASS.y1950 : GLASS.today;
  const group = new THREE.Group();
  group.name = `landmark-${type}-${v}`;
  group.add(S.build(SOLID_MATERIAL));
  const mats = { on: new THREE.MeshBasicMaterial({ color: g.day, side: THREE.DoubleSide }), off: new THREE.MeshBasicMaterial({ color: g.day, side: THREE.DoubleSide }) };
  for (const k of ['on', 'off']) if (G[k].triangles) { const m = G[k].build(mats[k]); m.castShadow = false; m.receiveShadow = false; m.name = `windows-${k}`; group.add(m); }
  let lantern = null;
  if (spec.lantern) { // the lamp: found by name, like createFyrkur1950's 'lantern-glass', so the game's lantern glow can find it
    lantern = new THREE.Mesh(new THREE.CylinderGeometry(spec.lantern.r, spec.lantern.r, spec.lantern.h, 8), new THREE.MeshBasicMaterial({ color: GLASS.y1950.off }));
    lantern.name = 'lantern-glass'; lantern.position.set(0, spec.lantern.y, spec.lantern.z ?? 0); group.add(lantern);
  }
  const setNight = (on) => { mats.on.color.setHex(on ? g.lit : g.day); mats.off.color.setHex(on ? g.off : g.day); if (lantern) lantern.material.color.setHex(on && type === 'fyrkur' ? g.lit : GLASS.y1950.off); };
  setNight(night);
  return {
    type, variant: v, era: lookEra, readScale: def.readScale, group, setNight,
    describe: () => ({ type, variant: v, era: lookEra, triangles: S.triangles + G.on.triangles + G.off.triangles, solid: S.triangles, windows: G.on.triangles + G.off.triangles, meshes: group.children.length }),
    dispose: () => { group.traverse((o) => o.geometry?.dispose()); mats.on.dispose(); mats.off.dispose(); lantern?.material.dispose(); },
  };
}
