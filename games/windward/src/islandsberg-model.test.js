// node games/windward/src/islandsberg-model.test.js: Islandsberg's old light shows through a row of windows on the upper floor of the seaward (+z) gable, not a lantern on the ridge
// (fyr.org via docs/CORRECTIONS-TODO.md); dark and lit states work through the same glow code (src/lantern.js) as every other light.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { LIGHTHOUSES, createLighthouse, gameHeight } from './lighthouses.js';
import { createLanternFx } from './lantern.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }
const entry = LIGHTHOUSES.find((l) => l.name === 'Islandsberg');
const H = gameHeight(entry);
const build = () => { const g = createLighthouse('Islandsberg'); g.updateWorldMatrix(true, true); return g; };
const panes = (g) => { const a = []; g.traverse((o) => { if (o.isMesh && /^lantern-glass/.test(o.name)) a.push(o); }); return a; };
const box = (o) => new THREE.Box3().setFromObject(o);

check('a row of panes: at least three, exactly one named lantern-glass (the middle one, found first), the rest lantern-glass-window', () => {
  const p = panes(build());
  assert.ok(p.length >= 3, `${p.length} panes`);
  assert.equal(p.filter((o) => o.name === 'lantern-glass').length, 1);
  assert.equal(p.filter((o) => o.name === 'lantern-glass-window').length, p.length - 1);
  assert.equal(p[0].name, 'lantern-glass', 'the first glass the glow finds is the centre pane (the halo centres on it)');
  assert.ok(Math.abs(box(p[0]).getCenter(new THREE.Vector3()).x) < 0.01, 'the first pane is the middle of the row');
});

check('the panes are ONE row on the seaward (+z) gable, on the upper floor, in front of the wall', () => {
  const g = build(); const p = panes(g); const whole = box(g);
  const cs = p.map((o) => box(o).getCenter(new THREE.Vector3()));
  const ys = cs.map((c) => c.y), zs = cs.map((c) => c.z);
  assert.ok(Math.max(...ys) - Math.min(...ys) < 0.01, 'one row: the same height');
  assert.ok(Math.max(...zs) - Math.min(...zs) < 0.01, 'all on the same wall');
  assert.ok(zs[0] > 0 && zs[0] > whole.max.z - 0.8, `on the seaward end (z ${zs[0].toFixed(2)} of ${whole.max.z.toFixed(2)})`);
  assert.ok(ys[0] > H * 0.62 * 0.5 && ys[0] < H * 0.62, `upper floor: y ${ys[0].toFixed(2)} is in the top half of the walls (${(H * 0.31).toFixed(1)}..${(H * 0.62).toFixed(1)})`);
  const xs = cs.map((c) => c.x).sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] > 0.5 && xs[i] - xs[i - 1] < 1.0, 'evenly spread, not overlapping');
});

check('NO lantern on the ridge: nothing above the roof, the roof ridge is the top, and the house still reaches the game height', () => {
  const g = build(); const whole = box(g);
  assert.ok(Math.abs(whole.max.y - H) < 0.2, `top ${whole.max.y.toFixed(2)} vs game height ${H}`);
  assert.ok(Math.abs(whole.min.y) < 0.1, 'sits on y=0');
  for (const o of panes(g)) assert.ok(box(o).max.y < H * 0.62 + 0.01, 'every pane is below the eaves');
  let cylinders = 0; g.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.type === 'CylinderGeometry') cylinders += 1; });
  assert.equal(cylinders, 0, 'no round lantern glass or frame at all');
});

check('seaward half white, the rest red (WORLD-1950): the seaward end is lighter than the back', () => {
  const g = build(); let front = null, back = null;
  g.traverse((o) => { if (!o.isMesh || !o.geometry || o.geometry.type !== 'BoxGeometry') return; const b = box(o), size = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    if (size.y > 4 && size.x > 4) { if (c.z > 0) front = o.material.color.getHex(); else back = o.material.color.getHex(); } });
  assert.ok(front !== null && back !== null && front !== back, 'two wall halves of different colours');
  const lum = (h) => ((h >> 16) & 255) + ((h >> 8) & 255) + (h & 255);
  assert.ok(lum(front) > lum(back), 'the seaward half is the white one');
});

check('dark and lit through the real glow code: every pane swaps together, halo and beam appear, then dark again (the relight and the rewind use exactly this)', () => {
  const g = build();
  const fx = createLanternFx(g, entry);
  const p = panes(g);
  assert.equal(fx.glass.length, p.length, 'the glow found every pane');
  assert.equal(fx.lit, false); assert.equal(fx.halo.visible, false);
  const dark = p.map((o) => o.material.color.getHex());
  assert.ok(dark.every((c) => c === dark[0]), 'all panes share the dull dark glass');
  fx.setLit(true); fx.update(1, 1);
  const lit = p.map((o) => o.material.color.getHex());
  assert.ok(lit.every((c) => c === lit[0]) && lit[0] !== dark[0], 'all panes change together to the warm glass');
  assert.equal(fx.halo.visible, true);
  const centre = box(p[0]).getCenter(new THREE.Vector3());
  assert.ok(fx.halo.position.distanceTo(g.worldToLocal(centre.clone())) < 0.01, 'the halo sits on the middle pane');
  fx.setLit(false);
  assert.equal(fx.halo.visible, false); assert.deepEqual(p.map((o) => o.material.color.getHex()), dark, 'dark again exactly as before');
});

console.log(`\n${passed} checks passed`);
