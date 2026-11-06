// The beach where you wake in 1950 (stage 1e, batch 2): Svalan thrown up on her side with her mast gone, the boatbuilder's son beside her, Britta a little way off.
// haul() is "he takes her for repair": she rolls upright onto a wooden cradle and stays there, under repair, until chapter 1 is done (batch 3 relaunches her).
// Pure scene building: the plan (src/wake-plan.js) says where, this file makes the meshes. No game state.
import * as THREE from '../vendor/three/three.module.js';
import { createBoatMesh } from './boats.js';
import { createAsset } from './era-assets.js';

export const WAKE_SCENE = Object.freeze({
  wear: 1,            // as battered as the boat lab allows (src/boats.js `wear`)
  rollRad: 0.5,       // lying on her side
  haulS: 3.2,         // the haul-up animation
  sinkM: 0.1,         // a little into the sand so she does not float above it
});

const WOOD = 0x7a5a3a;
const ease = (t) => t * t * (3 - 2 * t);

// plan: from planWake(); heightAt: world.heightAt. Needs loadBoatModel() to have run (game.js does it before any boat).
export function createWakeScene({ plan, heightAt }) {
  const group = new THREE.Group();
  group.name = 'wake-scene';
  const { beach, figures } = plan;
  const along = beach.facing + Math.PI / 2; // heading along the shore, bow one way

  // Svalan: the same koster the player knows, as worn as can be, mast and sails gone (the card says so).
  const svalan = createBoatMesh(0xffcc66, { type: 'koster', wear: WAKE_SCENE.wear, deck: ['crate', 'barrel', null] });
  const rig = svalan.group.getObjectByName('rig');
  if (rig) rig.visible = false;
  svalan.group.name = 'svalan-wrecked';
  svalan.group.rotation.order = 'YXZ';
  svalan.group.position.set(beach.x, beach.y, beach.z);
  group.add(svalan.group);

  // the cradle she is hauled onto: two long beams and three cross-chocks
  const cradle = new THREE.Group();
  cradle.name = 'cradle';
  const wood = new THREE.MeshLambertMaterial({ color: WOOD, flatShading: true });
  for (const sx of [-0.9, 0.9]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 8.4), wood); b.position.set(sx, 0.15, 0); cradle.add(b); }
  for (const z of [-3, 0, 3]) { const c = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.26, 0.3), wood); c.position.set(0, 0.42, z); cradle.add(c); }
  cradle.position.set(beach.x, beach.y, beach.z);
  cradle.rotation.y = along;
  cradle.scale.setScalar(0.001);
  group.add(cradle);

  // the people
  const figure = (variant, at, name) => {
    const a = createAsset('figure1950', { variant });
    const g = a.group;
    g.name = name;
    g.position.set(at.x, Math.max(0.05, heightAt(at.x, at.z)), at.z);
    g.rotation.y = at.look;
    group.add(g);
    return g;
  };
  const boatbuilder = figure('boy', figures.boatbuilder, 'boatbuilders-son');
  const britta = figure('girl', figures.britta, 'britta');

  let haulT = null;              // null: lying on the beach; 0..1: hauling; stays 1 after
  let hauled = false;
  let relaunched = false;
  const pose = (u) => { // u 0 = thrown up on her side, 1 = upright on the cradle
    const k = ease(u);
    svalan.group.rotation.set(0.07 * (1 - k), along, WAKE_SCENE.rollRad * (1 - k));
    svalan.group.position.y = beach.y + 0.45 * k - WAKE_SCENE.sinkM * (1 - k) + 0.3;
    cradle.scale.setScalar(0.001 + 0.999 * k);
  };
  pose(0);

  return {
    group, svalan, boatbuilder, britta, cradle,
    get hauled() { return hauled; },
    get hauling() { return haulT !== null && !hauled; },
    haul() { if (haulT === null) haulT = 0; }, // "he takes her for repair": start the animation (once)
    settle() { haulT = 1; hauled = true; pose(1); }, // already hauled (a reload after the intro): no animation
    // Svalan is relaunched (the reward): she is gone from the cradle (she is the boat you sail now); the empty cradle and the two people stay.
    relaunch() { svalan.group.visible = false; relaunched = true; },
    get relaunched() { return relaunched; },
    // per frame: the haul-up, and a little life in the two people (they shift their weight)
    update(dt, t) {
      if (haulT !== null && !hauled) {
        haulT = Math.min(1, haulT + dt / WAKE_SCENE.haulS);
        pose(haulT);
        if (haulT >= 1) hauled = true;
      }
      boatbuilder.rotation.z = Math.sin(t * 1.3) * 0.03;
      britta.rotation.z = Math.sin(t * 1.1 + 1.7) * 0.025;
      if (hauled) boatbuilder.rotation.y = figures.boatbuilder.look + Math.sin(t * 0.7) * 0.25; // he turns to look her over
    },
  };
}
