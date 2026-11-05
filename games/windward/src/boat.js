// Boat mesh (2026-11-05): a small west-coast sailing boat built in code — white
// hull, red bottom, wooden deck, a mast with a boom, a triangular mainsail and
// a jib. Replaces the vendored Kenney pirate ship, whose square sail spans the
// hull: swinging it like a fore-and-aft sail read as "the sail is on the wrong
// side" and made close-hauled look like heading straight into the wind.
//
// Here the boom points straight aft at zero trim and swings about the mast by
// the angle game.js passes to setSailAngle (src/sail.js's leewardSign * trim),
// so the sail sits to leeward by construction, and matches src/phone.js's
// boomAngle(): heading + PI + leewardSign * trim.
//
// Built synchronously (no model file to load). loadBoatModel() is kept so the
// existing call in game.js stays valid. Materials: flat Lambert only
// (shared/ART.md); the sail carries the player colour, nothing else does.
import * as THREE from '../vendor/three/three.module.js';

// The bow faces local +Z: game.js drives group.rotation.y = heading and moves
// along (sin(heading), 0, cos(heading)), which is local +Z rotated by heading.
export const BOW_LOCAL_DIRECTION = new THREE.Vector3(0, 0, 1);

const COLORS = {
  hull: 0xf4f1e8, // white topsides — reads against the dark sea
  bottom: 0xb2382a, // red bottom paint
  deck: 0xb58a5a, // varnished wood
  spar: 0x5e4129, // mast and boom
};

// Hull stations from stern (-Z) to bow (+Z): [z, half-beam]. ~6m long
// (DESIGN.md "boat ~6m long"), widest just aft of midships, bow to a point.
const STATIONS = [[-2.9, 0.86], [-2.0, 1.08], [-0.6, 1.18], [0.8, 1.04], [1.9, 0.68], [2.6, 0.28], [3.0, 0]];
const SHEER = (z) => 0.5 + 0.22 * Math.max(0, z / 3) ** 2; // deck edge, rising to the bow
const CHINE_Y = -0.05;
const KEEL_Y = -0.45;

const MAST_Z = 0.7;
const MAST_H = 6.2; // above the deck
const BOOM_Y = 1.15; // above the deck
const BOOM_LEN = 3.1;
const BELLY = 0.42; // metres the mainsail bellies out to leeward

function lambert(color, side = THREE.FrontSide) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true, side });
}

// A strip of quads between two polylines of equal length.
function strip(a, b, out) {
  for (let i = 0; i < a.length - 1; i++) {
    out.push(...a[i], ...b[i], ...a[i + 1], ...a[i + 1], ...b[i], ...b[i + 1]);
  }
}
function geometry(positions) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}

function buildHull() {
  const group = new THREE.Group();
  const deckL = STATIONS.map(([z, w]) => [-w, SHEER(z), z]);
  const deckR = STATIONS.map(([z, w]) => [w, SHEER(z), z]);
  const chineL = STATIONS.map(([z, w]) => [-w * 0.86, CHINE_Y, z]);
  const chineR = STATIONS.map(([z, w]) => [w * 0.86, CHINE_Y, z]);
  const keel = STATIONS.map(([z]) => [0, KEEL_Y + Math.max(0, z / 3) * 0.3, z]);

  const sides = [];
  strip(deckL, chineL, sides);
  strip(chineR, deckR, sides);
  const sideMesh = new THREE.Mesh(geometry(sides), lambert(COLORS.hull, THREE.DoubleSide));

  const bottom = [];
  strip(chineL, keel, bottom);
  strip(keel, chineR, bottom);
  const bottomMesh = new THREE.Mesh(geometry(bottom), lambert(COLORS.bottom, THREE.DoubleSide));

  // Flat transom across the stern.
  const s = 0;
  const transom = [
    ...deckL[s], ...chineL[s], ...deckR[s], ...deckR[s], ...chineL[s], ...chineR[s],
    ...chineL[s], ...keel[s], ...chineR[s],
  ];
  const transomMesh = new THREE.Mesh(geometry(transom), lambert(COLORS.hull, THREE.DoubleSide));

  // Deck: a fan between the two deck edges, a touch below the sheer so the
  // white topsides show a rim.
  const deck = [];
  const dl = deckL.map(([x, y, z]) => [x * 0.94, y - 0.04, z]);
  const dr = deckR.map(([x, y, z]) => [x * 0.94, y - 0.04, z]);
  strip(dr, dl, deck);
  const deckMesh = new THREE.Mesh(geometry(deck), lambert(COLORS.deck, THREE.DoubleSide));

  for (const m of [sideMesh, bottomMesh, transomMesh, deckMesh]) {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  return group;
}

export function loadBoatModel() {
  return Promise.resolve(); // nothing to load any more (see header)
}

// Kept for src/stage1.test.js and any future vendored asset: turns a PBR
// material into the flat Lambert shared/ART.md asks for.
export function toFlatLambert(m) {
  return new THREE.MeshLambertMaterial({
    map: m.map ?? null,
    color: m.color ? m.color.clone() : 0xffffff,
    transparent: m.transparent ?? false,
    opacity: m.opacity ?? 1,
    side: m.side ?? THREE.FrontSide,
    flatShading: true,
  });
}

export function createBoatMesh(color) {
  const group = new THREE.Group();
  group.add(buildHull());

  const deckY = SHEER(MAST_Z) - 0.04;
  const sailMat = lambert(color, THREE.DoubleSide);
  const sparMat = lambert(COLORS.spar);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, MAST_H, 5), sparMat);
  mast.position.set(0, deckY + MAST_H / 2, MAST_Z);
  mast.castShadow = true;
  group.add(mast);

  // Boom + mainsail swing together about the mast.
  const pivot = new THREE.Group();
  pivot.position.set(0, deckY, MAST_Z);
  group.add(pivot);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, BOOM_LEN, 4), sparMat);
  boom.rotation.x = Math.PI / 2;
  boom.position.set(0, BOOM_Y, -BOOM_LEN / 2);
  boom.castShadow = true;
  pivot.add(boom);
  const boomEnd = new THREE.Object3D(); // for boat.test.js: where the sail's clew is
  boomEnd.name = 'boom-end';
  boomEnd.position.set(0, BOOM_Y, -BOOM_LEN);
  pivot.add(boomEnd);

  // Mainsail: head at the masthead, tack at the gooseneck, clew at the boom
  // end, plus one belly vertex pushed to leeward so it reads as full.
  const head = [0, MAST_H - 0.1, 0];
  const tack = [0, BOOM_Y + 0.05, 0];
  const clew = [0, BOOM_Y + 0.05, -BOOM_LEN];
  const mainGeo = geometry([...head, ...tack, ...clew]);
  mainGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    ...head, ...tack, 0, 0, 0,
    ...head, 0, 0, 0, ...clew,
    ...tack, ...clew, 0, 0, 0,
  ], 3));
  const main = new THREE.Mesh(mainGeo, sailMat);
  main.castShadow = true;
  pivot.add(main);

  // Jib: tack at the bow, head on the forestay, clew swinging with the sheet.
  const jibTack = [0, SHEER(2.8) + 0.05, 2.8];
  const jibHead = [0, deckY + MAST_H * 0.78, MAST_Z + 0.05];
  const jibGeo = new THREE.BufferGeometry();
  jibGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Array(9).fill(0), 3));
  const jib = new THREE.Mesh(jibGeo, sailMat);
  jib.castShadow = true;
  group.add(jib);

  function setSailAngle(angleRad) {
    pivot.rotation.y = angleRad;
    // Belly: in the pivot's frame the sail lies in the YZ plane; leeward is
    // -X for a positive swing (see header), so push the belly that way.
    const side = angleRad === 0 ? 0 : -Math.sign(angleRad);
    const ease = Math.min(1, Math.abs(angleRad) / (Math.PI / 4)); // flatter when hard in
    const b = [side * BELLY * (0.35 + 0.65 * ease), BOOM_Y + (MAST_H - BOOM_Y) * 0.38, -BOOM_LEN * 0.42];
    const p = mainGeo.attributes.position;
    for (const i of [2, 4, 8]) p.setXYZ(i, b[0], b[1], b[2]);
    p.needsUpdate = true;
    mainGeo.computeVertexNormals();

    // Jib clew: ~2m aft of the tack, swung by most of the main's angle.
    const a = angleRad * 0.85;
    const jibClew = [jibTack[0] - Math.sin(a) * 2.1, deckY + 0.55, jibTack[2] - Math.cos(a) * 2.1];
    const j = jibGeo.attributes.position;
    j.setXYZ(0, ...jibHead);
    j.setXYZ(1, ...jibTack);
    j.setXYZ(2, ...jibClew);
    j.needsUpdate = true;
    jibGeo.computeVertexNormals();
  }
  setSailAngle(0);

  return { group, setSailAngle };
}
