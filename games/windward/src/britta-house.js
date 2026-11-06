// Britta's house in the 1950 world (stage 1e, batch 3): a white village house, her family's gas shed beside the jetty, and the jetty itself, where the opening's house stood
// (the numbers are BRITTA_HOUSE in src/story-1950.js). The player ties up at the quay in front of the jetty. Pure scene building; no game state.
import * as THREE from '../vendor/three/three.module.js';
import { createAsset } from './era-assets.js';
import { createJetty } from './jetty.js';
import { BRITTA_HOUSE } from './story-1950.js';

const SHED_WALL = 0x8a5a3a, SHED_ROOF = 0x3b2f2a;

export function createBrittaHouse({ heightAt }) {
  const B = BRITTA_HOUSE;
  const group = new THREE.Group();
  group.name = 'brittas-house';
  const house = createAsset('house1950', { variant: 'white' }).group;
  house.name = 'britta-house';
  house.position.set(B.house.x, heightAt(B.house.x, B.house.z), B.house.z);
  house.rotation.y = B.dir; // its front towards the water
  group.add(house);
  // the shed: a low plank hut with a pitched roof, door to the water; the gas tanks stand in it
  const shed = new THREE.Group(); shed.name = 'gas-shed';
  const wall = new THREE.MeshLambertMaterial({ color: SHED_WALL, flatShading: true }), roof = new THREE.MeshLambertMaterial({ color: SHED_ROOF, flatShading: true });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.0, 2.6), wall); body.position.y = 1.0; shed.add(body);
  for (const sd of [-1, 1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.14, 1.7), roof); r.position.set(0, 2.25, sd * 0.78); r.rotation.x = sd * 0.5; shed.add(r); }
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, 0.06), new THREE.MeshLambertMaterial({ color: 0x3a2a1a, flatShading: true })); door.position.set(0, 0.75, 1.32); shed.add(door);
  shed.position.set(B.shed.x, Math.max(0.3, heightAt(B.shed.x, B.shed.z)), B.shed.z);
  shed.rotation.y = B.dir;
  group.add(shed);
  group.add(createJetty({ dir: B.dir, jetty: B.jetty }));
  return { group, house, shed };
}
