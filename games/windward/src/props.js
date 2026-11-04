// Prop visuals for discoverables (Stage 2, 2026-11-04).
//
// STAND-INS: simple flat-shaded shapes in the shared/ART.md palette, so the
// found-together gameplay is playable now. Each kind is one builder in
// PROP_BUILDERS; when polyfork.dev is reachable, a builder gets replaced by
// a vendored Polyfork module (createAsset(knobs)) with its materials swapped
// to flat Lambert — nothing else in the game needs to change.
//
// Materials: MeshLambertMaterial + flatShading only (ART.md). Props are
// smaller than the 4m facet target and use the fewest segments that still
// read as their shape (ART.md's small-props exemption).
import * as THREE from '../vendor/three/three.module.js';
import { mergeGeometries } from '../vendor/three/utils/BufferGeometryUtils.js';

const COLORS = {
  faluRed: 0xd2432c, // falu red, pushed brighter so it stays red under the golden light (ART.md: bold storybook)
  doorRed: 0x9c2f22, // darker red for door panels inside the white frame
  white: 0xf4f1e8,
  roof: 0x6b6672, // weathered grey, not black (ART.md: never grim)
  wood: 0x8a7f72,
  pole: 0x333333, // ART.md buoy pole
  buoyRed: 0xff5533, // ART.md buoy floats
  buoyYellow: 0xffcc33,
  rock: 0x776f64, // ART.md rocks
  lantern: 0xffe08a,
  gold: 0xffcc33,
  ochre: 0xe2a53b, // west-coast ochre-yellow houses
  tileRed: 0xa8432f, // red clay roof tiles
  glass: 0x4f6f8a,
  chimney: 0x8f8679,
};

const materialCache = new Map();
function mat(color) {
  if (!materialCache.has(color)) {
    materialCache.set(color, new THREE.MeshLambertMaterial({ color, flatShading: true }));
  }
  return materialCache.get(color);
}

function mesh(geometry, color, y = 0) {
  const m = new THREE.Mesh(geometry, mat(color));
  m.position.y = y;
  return m;
}

function lighthouse() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(1.4, 2, 9, 6), COLORS.white, 4.5));
  g.add(mesh(new THREE.CylinderGeometry(1.5, 1.6, 1.6, 6), COLORS.faluRed, 6));
  g.add(mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.4, 6), COLORS.lantern, 9.7));
  g.add(mesh(new THREE.ConeGeometry(1.6, 1.6, 6), COLORS.faluRed, 11.2));
  return g;
}

// Shared gable-house shape for boathouses and cottages: box walls, a
// triangle-profile roof extruded along the house's length with a small
// overhang, matching gable triangles, white corner trim. Local +z is the
// gable end that faces the sea.
function gableHouse({ W, L, H, ridge, wall, roof }) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(W, H, L), wall, H / 2));

  const overhang = 0.35;
  const profile = new THREE.Shape();
  profile.moveTo(-W / 2 - overhang, 0);
  profile.lineTo(W / 2 + overhang, 0);
  profile.lineTo(0, ridge);
  profile.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(profile, { depth: L + overhang * 2, bevelEnabled: false });
  roofGeo.translate(0, 0, -(L + overhang * 2) / 2);
  g.add(mesh(roofGeo, roof, H));

  const gable = new THREE.Shape();
  gable.moveTo(-W / 2, 0);
  gable.lineTo(W / 2, 0);
  gable.lineTo(0, ridge - 0.15);
  gable.closePath();
  for (const z of [L / 2 + 0.01, -L / 2 - 0.01]) {
    const tri = new THREE.Mesh(new THREE.ShapeGeometry(gable), doubleSided(wall));
    tri.position.set(0, H, z);
    g.add(tri);
  }

  for (const x of [-W / 2, W / 2]) {
    for (const z of [-L / 2, L / 2]) {
      const post = mesh(new THREE.BoxGeometry(0.2, H, 0.2), COLORS.white, H / 2);
      post.position.set(x, H / 2, z);
      g.add(post);
    }
  }
  return g;
}

const doubleSidedCache = new Map();
function doubleSided(color) {
  if (!doubleSidedCache.has(color)) {
    doubleSidedCache.set(color, new THREE.MeshLambertMaterial({ color, flatShading: true, side: THREE.DoubleSide }));
  }
  return doubleSidedCache.get(color);
}

// Sjöbod — a west-coast boathouse: falu red, grey roof, white trim, double
// doors on the sea gable, front half on stilts over the water. (The first
// stand-in used a 3-sided cone for the roof, which read as a black pyramid.)
function boathouse() {
  const W = 4.4;
  const L = 6.4;
  const H = 2.8;
  const g = gableHouse({ W, L, H, ridge: 1.6, wall: COLORS.faluRed, roof: COLORS.roof });
  const frame = mesh(new THREE.BoxGeometry(2.3, 2.2, 0.12), COLORS.white, 1.1);
  frame.position.z = L / 2 + 0.06;
  g.add(frame);
  const doors = mesh(new THREE.BoxGeometry(1.9, 1.95, 0.14), COLORS.doorRed, 1.0);
  doors.position.z = L / 2 + 0.09;
  g.add(doors);
  for (const x of [-W / 2 + 0.3, W / 2 - 0.3]) {
    for (const z of [L / 2 - 0.3, 0.3]) {
      const stilt = mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.2, 4), COLORS.wood, -1.1);
      stilt.position.set(x, -1.1, z);
      g.add(stilt);
    }
  }
  return g;
}

// Stuga — a small cottage. Mostly falu red with a grey roof; ochre and
// white ones get a red-tile roof. White window frames, a door on the sea
// gable, a chimney.
const COTTAGE_VARIANTS = {
  red: { wall: COLORS.faluRed, roof: COLORS.roof },
  ochre: { wall: COLORS.ochre, roof: COLORS.tileRed },
  white: { wall: COLORS.white, roof: COLORS.tileRed },
};

function cottage(variant = 'red') {
  const v = COTTAGE_VARIANTS[variant] ?? COTTAGE_VARIANTS.red;
  const W = 3.8;
  const L = 5.2;
  const H = 2.4;
  const g = gableHouse({ W, L, H, ridge: 1.7, wall: v.wall, roof: v.roof });
  const trim = variant === 'white' ? COLORS.faluRed : COLORS.white; // white houses get red trim

  const door = mesh(new THREE.BoxGeometry(1, 1.8, 0.12), trim, 0.9);
  door.position.z = L / 2 + 0.06;
  g.add(door);
  for (const side of [-1, 1]) {
    for (const z of [-1.2, 1.2]) {
      const frame = mesh(new THREE.BoxGeometry(0.12, 0.95, 0.95), trim, 1.4);
      frame.position.set(side * (W / 2 + 0.06), 1.4, z);
      g.add(frame);
      const glass = mesh(new THREE.BoxGeometry(0.14, 0.65, 0.65), COLORS.glass, 1.4);
      glass.position.set(side * (W / 2 + 0.07), 1.4, z);
      g.add(glass);
    }
  }
  const chimney = mesh(new THREE.BoxGeometry(0.6, 1.4, 0.6), COLORS.chimney, H + 1.3);
  chimney.position.set(0.7, H + 1.3, -1.2);
  g.add(chimney);
  return g;
}

// Collapse a built group into one mesh per material (a cottage: 18 meshes
// -> ~6), so ~50 houses cost a few hundred draw calls, not ~1000.
function mergeByMaterial(group) {
  group.updateMatrixWorld(true);
  const byMaterial = new Map();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld);
    for (const name of Object.keys(geo.attributes)) if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name);
    if (!byMaterial.has(o.material)) byMaterial.set(o.material, []);
    byMaterial.get(o.material).push(geo);
  });
  const merged = new THREE.Group();
  for (const [material, geos] of byMaterial) {
    const m = new THREE.Mesh(mergeGeometries(geos), material);
    m.castShadow = true;
    m.receiveShadow = true;
    merged.add(m);
  }
  return merged;
}

// Settlement buildings are scenery repeated ~50 times per world: build
// each kind+variant once and clone (clones share geometry and materials).
const templates = new Map();
export function createBuilding(b) {
  const key = `${b.kind}:${b.variant}`;
  if (!templates.has(key)) templates.set(key, mergeByMaterial(b.kind === 'boathouse' ? boathouse() : cottage(b.variant)));
  const g = templates.get(key).clone();
  g.position.set(b.x, b.y, b.z);
  g.rotation.y = b.facing;
  return g;
}

function jetty() {
  const g = new THREE.Group();
  const deck = mesh(new THREE.BoxGeometry(2.4, 0.3, 12), COLORS.wood, 0.9);
  deck.position.z = 6; // runs out to sea from the shore
  g.add(deck);
  for (const z of [3, 7, 11]) {
    for (const x of [-1.1, 1.1]) {
      const post = mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.4, 4), COLORS.wood, 0);
      post.position.set(x, 0, z);
      g.add(post);
    }
  }
  return g;
}

function marker() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 5, 4), COLORS.pole, 2));
  g.add(mesh(new THREE.ConeGeometry(0.7, 1.2, 4), COLORS.buoyRed, 5));
  g.add(mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.5, 6), COLORS.buoyYellow, 0));
  return g;
}

function cairn() {
  const g = new THREE.Group();
  const stones = [[1.4, 0.6], [1.0, 1.5], [0.7, 2.2], [0.4, 2.8]];
  for (const [r, y] of stones) g.add(mesh(new THREE.DodecahedronGeometry(r, 0), COLORS.rock, y));
  return g;
}

export const PROP_BUILDERS = { lighthouse, boathouse, jetty, marker, cairn };

// d: a discoverable from src/discover.js. Returns { group, ring, setFound }.
// The gold ring floats at the visit point (where boats must arrive) until
// the find is made; a small gold pennant then marks the prop as found.
export function createPropForDiscoverable(d) {
  const build = PROP_BUILDERS[d.kind];
  const prop = build ? build() : marker();
  prop.position.set(d.x, d.y, d.z);
  prop.rotation.y = d.facing; // doors and jetties face the sea

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3.2, 4, 12),
    new THREE.MeshBasicMaterial({ color: COLORS.gold, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(d.visitX, 0.35, d.visitZ);

  const pennant = new THREE.Group();
  pennant.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.5, 4), COLORS.pole, 1.25));
  const flag = mesh(new THREE.ConeGeometry(0.5, 1.2, 3), COLORS.gold, 2.1);
  flag.rotation.z = -Math.PI / 2;
  flag.position.x = 0.6;
  pennant.add(flag);
  pennant.visible = false;
  prop.add(pennant);
  pennant.position.y = d.kind === 'lighthouse' ? 12 : 4;

  return {
    group: prop,
    ring,
    setFound(found) {
      ring.visible = !found;
      pennant.visible = found;
    },
  };
}

// A ping flare: a gold column that rises and fades over its lifetime.
export function createFlare(x, z) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.6, 30, 6, 1, true),
    new THREE.MeshBasicMaterial({ color: COLORS.gold, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  );
  m.position.set(x, 15, z);
  return {
    object: m,
    // t: 0..1 through the flare's life.
    update(t) {
      m.material.opacity = 0.9 * (1 - t);
      m.scale.y = 0.4 + 0.6 * Math.min(1, t * 4);
    },
    dispose() {
      m.geometry.dispose();
      m.material.dispose();
    },
  };
}
