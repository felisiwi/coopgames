// Shoals (assets/coast/shoals.json) as the game shows and collides with them. ONE function, shoalLook(), answers both
// questions so the picture and the rule cannot drift apart:
//
//   awash / dry rock   FOAM: a white ring of surf on the sea, and a hard obstacle (the boat slides off it like land)
//   submerged / covers / unknown rock, wreck, obstruction
//                      DARK: faint darker water, no foam; a SOFT hazard (the caller slows the boat, never stops it:
//                      "no damage, no bounce", src/shore.js). The player reads the dark patch and steers round it.
//   named shoal (båd / flu: an OSM bare-rock islet) FOAM, bigger, hard
//
// Radii are GAME metres (the coast is 1:10, so a real 10 m rock would be 1 m: far too small to see or hit). They are
// exaggerated like the skerries are (coast-world.js SKERRY_SCALE 3, SKERRY_MIN_R_M 3). collisionRadiusM is the rock's
// OWN radius: the caller adds the hull (shore.js HULL_RADIUS_M, 2.5) exactly as it does for land.
// TODO(felix): the radii are a first guess; tune by eye on the phone.
//
// Credit: the positions are OpenStreetMap, (c) OpenStreetMap contributors, ODbL 1.0.
import * as THREE from '../vendor/three/three.module.js';
import { HULL_RADIUS_M } from './shore.js';

export const SHOAL_REAL_PER_GAME = 10; // the coast scale
export const SHOAL_SIZE_EXAGGERATION = 3; // like SKERRY_SCALE
export const SHOAL_MIN_R_M = 3; // smallest named-shoal radius in game m
export const FOAM_COLOR = 0xf4f6f2; // ART.md shore foam
export const DARK_COLOR = 0x1f4466;

// { look: 'foam' | 'dark', visualRadiusM, innerRadiusM (foam ring hole), collisionRadiusM, blocks, slow, opacity, why }
export function shoalLook(shoal) {
  if (shoal.kind === 'rock') {
    if (shoal.level === 'dry') return { look: 'foam', visualRadiusM: 4.6, innerRadiusM: 2.0, collisionRadiusM: 2.8, blocks: true, slow: 1, opacity: 0.92, why: 'rock above water' };
    if (shoal.level === 'awash') return { look: 'foam', visualRadiusM: 4.0, innerRadiusM: 1.7, collisionRadiusM: 2.4, blocks: true, slow: 1, opacity: 0.88, why: 'rock awash: surf breaks on it' };
    // submerged / covers / unknown: faint dark water; shallower (OSM depth) = a stronger, bigger hazard
    const shallow = shoal.depthM !== undefined && shoal.depthM <= 1.5;
    const unknown = shoal.level === 'unknown';
    return {
      look: 'dark', visualRadiusM: shallow ? 3.8 : 3.2, innerRadiusM: 0, collisionRadiusM: shallow ? 1.8 : shoal.level === 'covers' ? 1.5 : 1.0,
      blocks: false, slow: shallow ? 0.55 : 0.7, opacity: unknown ? 0.2 : shallow ? 0.36 : 0.28,
      why: unknown ? 'rock, depth unknown: weakest hazard' : shallow ? 'shallow rock' : 'submerged rock',
    };
  }
  if (shoal.kind === 'wreck') {
    const r = Math.max(2.5, (shoal.radiusM ?? 0) / SHOAL_REAL_PER_GAME * SHOAL_SIZE_EXAGGERATION);
    return { look: 'dark', visualRadiusM: r * 1.4, innerRadiusM: 0, collisionRadiusM: r * 0.8, blocks: false, slow: 0.5, opacity: 0.36, why: 'wreck' };
  }
  if (shoal.kind === 'obstruction') return { look: 'dark', visualRadiusM: 3.0, innerRadiusM: 0, collisionRadiusM: 1.5, blocks: false, slow: 0.6, opacity: 0.32, why: 'obstruction' };
  if (shoal.kind === 'named_shoal') {
    const r = Math.max(SHOAL_MIN_R_M, (shoal.radiusM ?? 0) / SHOAL_REAL_PER_GAME * SHOAL_SIZE_EXAGGERATION);
    return { look: 'foam', visualRadiusM: r * 1.6, innerRadiusM: r * 0.7, collisionRadiusM: r, blocks: true, slow: 1, opacity: 0.9, why: 'named shoal (båd / flu)' };
  }
  throw new Error(`unknown shoal kind "${shoal.kind}"`);
}

// shoals.json rows -> [{ shoal, x, z, look }] in game metres. toGame = world.toGame (lon, lat) -> [x, z].
export function buildShoalList(shoals, toGame) {
  return shoals.map((shoal) => { const [x, z] = toGame(shoal.lon, shoal.lat); return { shoal, x, z, look: shoalLook(shoal) }; });
}

// Does a boat at (x, z) touch a shoal? Returns the deepest overlap: { item, depth } (depth in game m, > 0 when touching)
// or null. `hull` defaults to the boat's probe radius. `blocks` says hard (slide off) vs soft (slow down).
export function shoalHit(list, x, z, hull = HULL_RADIUS_M) {
  let best = null;
  for (const item of list) {
    const reach = item.look.collisionRadiusM + hull;
    const dx = x - item.x, dz = z - item.z;
    if (Math.abs(dx) > reach || Math.abs(dz) > reach) continue;
    const depth = reach - Math.hypot(dx, dz);
    if (depth > 0 && (!best || depth > best.depth)) best = { item, depth, blocks: item.look.blocks, slow: item.look.slow };
  }
  return best;
}

// ---- the picture: instanced meshes for the whole list: surf rings, granite stubs, dark patches ------------------------
const FOAM_Y = 0.48; // just above the highest wave crest (WAVE_AMP 0.4), so the sea never swallows a ring
const ROCK_COLOR = 0x776f64; // ART.md rocks

// a flat geometry whose vertex alpha follows `alphaAt(radius01)`: soft edges without a texture
function softDisc(inner, segments, rows, alphaAt) {
  const geo = inner > 0 ? new THREE.RingGeometry(inner, 1, segments, rows) : new THREE.CircleGeometry(1, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getZ(i));
    col.set([1, 1, 1, alphaAt(r)], i * 4);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  return geo;
}

export function createShoalLayer(list, { hash = (i) => ((i * 2654435761) >>> 0) / 4294967296 } = {}) {
  const group = new THREE.Group();
  group.name = 'shoals';
  const foamItems = list.filter((s) => s.look.look === 'foam'), darkItems = list.filter((s) => s.look.look === 'dark');
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const place = (mesh, items, y, scaleOf, seed) => {
    items.forEach((s, i) => {
      q.setFromAxisAngle(up, hash(i + seed) * Math.PI * 2);
      p.set(s.x, y, s.z);
      const k = scaleOf(s);
      sc.set(k[0], k[1], k[2]);
      mesh.setMatrixAt(i, m4.compose(p, q, sc));
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  const make = (geo, mat, n, name, order) => {
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
    m.count = n; m.name = name; m.renderOrder = order; m.frustumCulled = false;
    return m;
  };
  // surf: a band from 45% to 100% of the radius that is clear at both edges and white in the middle
  const surfGeo = softDisc(0.45, 16, 2, (r) => (r < 0.6 ? (r - 0.45) / 0.15 : r < 0.78 ? 1 : Math.max(0, (1 - r) / 0.22)));
  const foamMat = new THREE.MeshBasicMaterial({ color: FOAM_COLOR, transparent: true, vertexColors: true, opacity: 0.85, depthWrite: false, fog: false });
  const foam = make(surfGeo, foamMat, foamItems.length, 'shoal-foam', 2);
  place(foam, foamItems, FOAM_Y, (s) => [s.look.visualRadiusM, 1, s.look.visualRadiusM], 7);
  // a low granite stub in the middle of every surf ring: the rock the surf is breaking on
  const stubGeo = new THREE.IcosahedronGeometry(1, 0);
  const stubMat = new THREE.MeshLambertMaterial({ color: ROCK_COLOR, flatShading: true });
  const stubs = make(stubGeo, stubMat, foamItems.length, 'shoal-rocks', 1);
  place(stubs, foamItems, 0.05, (s) => { const r = s.look.collisionRadiusM * 0.42; return [r, r * 0.55, r]; }, 31);
  // dark patch: a soft-edged disc of darker water
  const darkGeo = softDisc(0, 16, 1, (r) => (r < 0.5 ? 1 : Math.max(0, (1 - r) / 0.5)));
  const darkMat = new THREE.MeshBasicMaterial({ color: DARK_COLOR, transparent: true, vertexColors: true, opacity: 0.5, depthWrite: false, fog: false });
  const dark = make(darkGeo, darkMat, darkItems.length, 'shoal-dark', 1);
  place(dark, darkItems, FOAM_Y, (s) => [s.look.visualRadiusM, 1, s.look.visualRadiusM], 91);
  group.add(dark, foam, stubs);
  return {
    group, foamCount: foamItems.length, darkCount: darkItems.length,
    // surf breathes: a slow opacity swell; the dark patches stay still
    update(t) { foamMat.opacity = 0.8 + 0.12 * Math.sin(t * 1.1); },
    dispose() { surfGeo.dispose(); stubGeo.dispose(); darkGeo.dispose(); foamMat.dispose(); stubMat.dispose(); darkMat.dispose(); foam.dispose(); stubs.dispose(); dark.dispose(); },
  };
}
