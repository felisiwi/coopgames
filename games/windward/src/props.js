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

// Sjöbod — a west-coast boathouse: falu-red walls, white corner trim, a
// pitched roof running the length of the house, double doors on the gable
// end facing the water. (First stand-in used a 3-sided cone for the roof,
// which reads as a black pyramid, not a pitched roof.)
function boathouse() {
  const g = new THREE.Group();
  const W = 4.4; // across
  const L = 6.4; // along the facing direction (local +z = towards the sea)
  const H = 2.8; // wall height

  g.add(mesh(new THREE.BoxGeometry(W, H, L), COLORS.faluRed, H / 2));

  // Gable roof: a triangle profile extruded along the house's length, with
  // a little overhang on every side.
  const overhang = 0.35;
  const ridge = 1.6;
  const profile = new THREE.Shape();
  profile.moveTo(-W / 2 - overhang, 0);
  profile.lineTo(W / 2 + overhang, 0);
  profile.lineTo(0, ridge);
  profile.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(profile, { depth: L + overhang * 2, bevelEnabled: false });
  roofGeo.translate(0, 0, -(L + overhang * 2) / 2);
  g.add(mesh(roofGeo, COLORS.roof, H));

  // Gable triangles under the roof, same red, so the ends aren't open.
  const gable = new THREE.Shape();
  gable.moveTo(-W / 2, 0);
  gable.lineTo(W / 2, 0);
  gable.lineTo(0, ridge - 0.15);
  gable.closePath();
  for (const z of [L / 2, -L / 2]) {
    const tri = mesh(new THREE.ShapeGeometry(gable), COLORS.faluRed, H);
    tri.position.z = z + (z > 0 ? 0.01 : -0.01);
    tri.material = tri.material.clone();
    tri.material.side = THREE.DoubleSide;
    g.add(tri);
  }

  // White corner posts and a white frame round the sea-side doors.
  for (const x of [-W / 2, W / 2]) {
    for (const z of [-L / 2, L / 2]) {
      const post = mesh(new THREE.BoxGeometry(0.22, H, 0.22), COLORS.white, H / 2);
      post.position.set(x, H / 2, z);
      g.add(post);
    }
  }
  const frame = mesh(new THREE.BoxGeometry(2.3, 2.2, 0.12), COLORS.white, 1.1);
  frame.position.z = L / 2 + 0.06;
  g.add(frame);
  const doors = mesh(new THREE.BoxGeometry(1.9, 1.95, 0.14), COLORS.doorRed, 1.0);
  doors.position.z = L / 2 + 0.09;
  g.add(doors);
  // Stilts under the seaward half — it stands half over the water.
  for (const x of [-W / 2 + 0.3, W / 2 - 0.3]) {
    for (const z of [L / 2 - 0.3, 0.3]) {
      const stilt = mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.2, 4), COLORS.wood, -1.1);
      stilt.position.set(x, -1.1, z);
      g.add(stilt);
    }
  }
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
