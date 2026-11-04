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
  faluRed: 0xc0392b, // Swedish red-ochre boathouses
  white: 0xf4f1e8,
  roof: 0x3a3a44,
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

function boathouse() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(5, 3.4, 7), COLORS.faluRed, 1.7));
  const roof = mesh(new THREE.CylinderGeometry(0.01, 3.6, 2.2, 3), COLORS.roof, 4.5);
  roof.scale.set(1, 1, 2.1); // a triangular prism along the house's length
  roof.rotation.y = Math.PI / 2;
  g.add(roof);
  const doors = mesh(new THREE.BoxGeometry(2.2, 2.4, 0.2), COLORS.white, 1.2);
  doors.position.z = 3.55; // sea side
  g.add(doors);
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
