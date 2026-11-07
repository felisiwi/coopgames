// The boats shelf (boats-lab.html): 20 seeded boats of an era side by side, drawn through the same kit and look code as the game's traffic (src/boat-shelf.js).
//   ?era=1950|today   which era's shelf        ?n=20   how many boats        ?cols=5   boats per row (default 5 on a wide screen, 4 on a phone)
// window.__shelf = { era, items: [{ i, asset, hull, sail, rig, L, triangles }] } for checks.
import * as THREE from '../vendor/three/three.module.js';
import { shelfFor, stampShelf } from './boat-shelf.js';
import { getKit } from './busy-kits.js';

const q = new URLSearchParams(location.search);
const era = q.get('era') === 'today' ? 'today' : '1950';
const n = Math.max(1, Math.min(40, Number(q.get('n')) || 20));
const errEl = document.getElementById('err');
try {
  const eras = await (await fetch(new URL('../data/busy-eras.json', import.meta.url))).json();
  const canvas = document.getElementById('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const W = innerWidth, H = innerHeight;
  renderer.setSize(W, H, false);
  const aspect = W / H;
  const cols = Number(q.get('cols')) || (aspect < 1 ? 4 : 5);
  const shelf = shelfFor(eras, era, n);
  const st = stampShelf(shelf, { cols, dx: 12.5, dz: 11 });
  const kit = getKit(shelf.profile.kit);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa9c4dc);
  scene.add(new THREE.HemisphereLight(0xdfe6ee, 0xa79fbd, 2.4));
  const sun = new THREE.DirectionalLight(0xfff1e0, 2.4); sun.position.set(-20, 30, 30); scene.add(sun);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x8fb4c9 })); sea.rotation.x = -Math.PI / 2; sea.position.y = -0.05; scene.add(sea);
  const geo = (pos, col) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g; };
  scene.add(new THREE.Mesh(geo(st.S.pos, st.S.col), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide })));
  const gp = [...st.G.on.pos, ...st.G.off.pos], day = new THREE.Color(kit.glass.day), gc = [];
  for (let i = 0; i < gp.length / 3; i++) gc.push(day.r, day.g, day.b);
  scene.add(new THREE.Mesh(geo(gp, gc), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));

  const cam = new THREE.PerspectiveCamera(30, aspect, 0.5, 600);
  const el = (33 * Math.PI) / 180;
  const hf = 2 * Math.atan(Math.tan((30 * Math.PI) / 360) * aspect); // horizontal field of view
  const fitW = (st.width / 2) / Math.tan(hf / 2), fitH = (st.depth / 2 / Math.sin(el) + 4) / Math.tan((30 * Math.PI) / 360);
  const dist = Math.max(fitW, fitH) * 0.95;
  cam.position.set(0, Math.sin(el) * dist, Math.cos(el) * dist); cam.lookAt(0, 0.8, 0);
  renderer.render(scene, cam);

  document.getElementById('title').innerHTML = `<b>${era === '1950' ? '1950' : 'Today'}</b> · ${st.placed.length} seeded boats (same seed, same boat) · profile ${shelf.profile.id}`;
  window.__shelf = { era, items: st.placed.map((p) => ({ i: p.i, asset: p.boat.assetId, hull: p.look?.hullName, sail: p.look?.sailName, rig: p.look?.rig, L: p.boat.v.L, triangles: p.triangles })) };
  window.__done = true;
} catch (e) { errEl.style.display = 'grid'; errEl.textContent = String(e && e.stack || e); throw e; }
