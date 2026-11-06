// A low, flat wooden jetty (stage 1e): one thin deck AT SEA HEIGHT (not at the height of the ground under it: that made a wall), short posts down both sides and a warm lamp on the
// last one. Used by the opening (Svalan alongside, today) and by Britta's house in 1950. site.jetty = { from, to, width, y } (src/opening-site.js), site.dir = its bearing.
import * as THREE from '../vendor/three/three.module.js';

export const WOOD = 0xa07c52;

export function createJetty(site, { lamp = true } = {}) {
  const group = new THREE.Group();
  group.name = 'jetty';
  const { from, to, width, y } = site.jetty;
  const len = Math.hypot(to.x - from.x, to.z - from.z), wood = new THREE.MeshLambertMaterial({ color: WOOD, emissive: 0x2e2012, flatShading: true });
  const mx = (from.x + to.x) / 2, mz = (from.z + to.z) / 2;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(width, 0.12, len), wood);
  deck.position.set(mx, y, mz); deck.rotation.y = site.dir; group.add(deck);
  const px = Math.cos(site.dir), pz = -Math.sin(site.dir);
  for (let k = 0; k <= 5; k++) { // short posts, barely above the deck, down both sides
    const t = k / 5, cx = from.x + (to.x - from.x) * t, cz = from.z + (to.z - from.z) * t;
    for (const sd of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.16), wood); post.position.set(cx + px * sd * (width / 2), y + 0.12, cz + pz * sd * (width / 2)); group.add(post); }
  }
  if (lamp) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffc878 })); // a lamp on the last post: the warmest thing on the water
    l.position.set(to.x + px * (width / 2), y + 0.85, to.z + pz * (width / 2)); group.add(l);
  }
  return group;
}
