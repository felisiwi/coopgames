// node games/windward/src/boats.test.js — the two Boat Lab boats keep boat.js's contract (bow +Z, boom to leeward,
// phone arc), stay cheap, and their options (rig, deck, night, wear, pennant) do what the brief says.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import {
  createBoatMesh, BOAT_TYPES, KOSTER_RIGS, DECK_ITEMS, BOAT_DEFAULTS, BOW_LOCAL_DIRECTION, loadBoatModel, hullPoint, specOf,
  LAB_DEFAULTS, parseLabParams, labParamsToSearch,
} from './boats.js';
import { createBoatMesh as legacyBoat } from './boat.js';
import { leewardSign, angleOffWind } from './sail.js';
import { boomAngle } from './phone.js';

const DEG = Math.PI / 180;
let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }
const combos = [];
for (const rig of KOSTER_RIGS) combos.push(['koster', rig]);
combos.push(['eka', undefined]);
const FULL = { deck: ['crate', 'barrel', 'chest'], night: true, wear: 1 };
const srgb = (c) => c.getRGB({}, THREE.SRGBColorSpace);
const lum = (c) => { const { r, g, b } = srgb(c); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
function meshByName(group, name) { let hit; group.traverse((o) => { if (o.name === name) hit = o; }); return hit; }
function allMeshes(group) { const out = []; group.traverse((o) => { if (o.isMesh) out.push(o); }); return out; }
// mean colour of a vertex-coloured mesh (the hull is the first mesh in the group)
function meanColor(mesh) {
  const a = mesh.geometry.attributes.color;
  const c = new THREE.Color(0, 0, 0);
  for (let i = 0; i < a.count; i++) { c.r += a.getX(i); c.g += a.getY(i); c.b += a.getZ(i); }
  return c.multiplyScalar(1 / a.count);
}

check('same API as boat.js: createBoatMesh(color, opts) -> { group, setSailAngle }, plus loadBoatModel and the bow axis', () => {
  assert.equal(typeof loadBoatModel, 'function');
  assert.ok(BOW_LOCAL_DIRECTION.equals(new THREE.Vector3(0, 0, 1)));
  const old = legacyBoat(0xffcc66);
  for (const [type, rig] of combos) {
    const b = createBoatMesh(0xffcc66, { type, rig });
    assert.ok(b.group instanceof THREE.Group);
    assert.equal(typeof b.setSailAngle, 'function');
    for (const k of Object.keys(old)) assert.ok(k in b, `${type}: missing "${k}" from the current boat's API`);
  }
  const d = createBoatMesh(0x66ccff); // the game's call: one argument
  assert.equal(d.type, BOAT_DEFAULTS.type);
  assert.deepEqual(d.describe().deck, ['crate', 'barrel', null]);
  assert.ok(d.group.getObjectByName('boom-end'), 'boom-end marker for tests and the phone arc');
});

check('the bow faces +Z and the hull sits on the waterline at every heading (game moves along sin/cos of the heading)', () => {
  for (const [type, rig] of combos) {
    const b = createBoatMesh(0xffffff, { type, rig });
    for (const deg of [0, 45, 135, -100]) {
      b.group.rotation.y = deg * DEG;
      b.group.updateMatrixWorld(true);
      const bow = BOW_LOCAL_DIRECTION.clone().applyQuaternion(b.group.quaternion);
      assert.ok(bow.distanceTo(new THREE.Vector3(Math.sin(deg * DEG), 0, Math.cos(deg * DEG))) < 1e-9);
    }
    const spec = specOf(type);
    const bowTip = hullPoint(spec, 1, 0, 1);
    const sternTip = hullPoint(spec, 0, 0, 1);
    assert.ok(bowTip[2] > 0 && sternTip[2] < 0, 'bow forward (+z), stern aft (-z)');
    assert.ok(bowTip[1] > hullPoint(spec, 0.5, 0, 1)[1], 'the sheer rises to the bow');
    b.group.rotation.y = 0;
    b.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(b.group.children[0]); // the hull
    assert.ok(box.min.y < -0.2 && box.max.y > 0.25, `${type}: hull spans the waterline (${box.min.y.toFixed(2)}..${box.max.y.toFixed(2)})`);
    const len = box.max.z - box.min.z;
    if (type === 'koster') assert.ok(len > 6.5 && len < 8, `koster length ${len.toFixed(2)} m (brief: 7-9 m real, readable at game scale)`);
    else assert.ok(len > 4.2 && len < 5.2, `eka length ${len.toFixed(2)} m (brief: 4-5 m)`);
  }
});

check('the boom swings to leeward on every heading and matches the phone arc, for every rig', () => {
  const windFrom = 0.4;
  for (const [type, rig] of combos) {
    for (let deg = -170; deg <= 180; deg += 10) {
      const heading = deg * DEG;
      if (angleOffWind(heading, windFrom) < 25 * DEG) continue;
      const boat = createBoatMesh(0xffcc66, { type, rig });
      const trim = 40 * DEG;
      boat.setSailAngle(leewardSign(heading, windFrom) * trim);
      boat.group.rotation.y = heading;
      boat.group.updateMatrixWorld(true);
      const end = new THREE.Vector3();
      boat.group.getObjectByName('boom-end').getWorldPosition(end);
      const mast = new THREE.Vector3();
      boat.group.getObjectByName('sail-pivot').getWorldPosition(mast);
      const wind = new THREE.Vector3(Math.sin(windFrom), 0, Math.cos(windFrom));
      const fwd = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
      const across = (v) => fwd.x * v.z - fwd.z * v.x;
      assert.ok(Math.sign(across(end.clone().sub(mast))) === -Math.sign(across(wind)), `${type}/${rig} heading ${deg}: boom on the windward side`);
      const a = boomAngle(heading, windFrom, trim);
      const rel = Math.atan2(end.x - mast.x, end.z - mast.z);
      assert.ok(Math.abs(Math.atan2(Math.sin(rel - a), Math.cos(rel - a))) < 1e-6, `${type}/${rig} heading ${deg}: boom off the phone arc`);
    }
  }
});

check('the sail bellies to leeward (away from the swing) and stays finite at every angle', () => {
  for (const [type, rig] of combos) {
    const b = createBoatMesh(0xffcc66, { type, rig, ...FULL });
    const sailMesh = b.group.getObjectByName('sail-pivot').children.find((o) => o.isMesh && o.geometry.attributes.position.count === 96);
    assert.ok(sailMesh, `${type}/${rig}: main sail mesh (4x4 grid, 96 vertices)`);
    for (const deg of [-90, -45, -10, 0, 10, 45, 90]) {
      b.setSailAngle(deg * DEG);
      for (const o of allMeshes(b.group)) for (const attr of ['position', 'normal']) {
        const arr = o.geometry.attributes[attr].array;
        for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) assert.fail(`${type}/${rig} ${o.name || 'mesh'} ${attr}[${i}] not finite at ${deg} deg`);
      }
      const p = sailMesh.geometry.attributes.position;
      let sum = 0;
      for (let i = 0; i < p.count; i++) sum += p.getX(i);
      if (deg === 0) assert.ok(Math.abs(sum) < 1e-9, 'flat when the boom is on the centreline');
      else assert.ok(Math.sign(sum) === -Math.sign(deg), `${type}/${rig} at ${deg}: belly on the wrong side`);
    }
  }
});

check('each boat stays cheap: under 3k triangles with everything switched on, at most 16 meshes', () => {
  for (const [type, rig] of combos) {
    const d = createBoatMesh(0xffcc66, { type, rig, ...FULL }).describe();
    assert.ok(d.triangles < 3000, `${type}/${rig}: ${d.triangles} triangles`);
    assert.ok(d.meshes <= 16, `${type}/${rig}: ${d.meshes} meshes`);
    console.log(`  ${type}${rig ? '/' + rig : ''}: ${d.triangles} triangles, ${d.meshes} meshes (all options on)`);
  }
});

check('the colours read as the brief says: honey hull + white sails; tarred hull + tanned red-brown sail', () => {
  const k = createBoatMesh(0xffcc66, { type: 'koster', wear: 0 });
  const e = createBoatMesh(0xffcc66, { type: 'eka', wear: 0 });
  const kh = srgb(meanColor(k.group.children[0]));
  assert.ok(kh.r > kh.g && kh.g > kh.b && kh.r - kh.b > 0.25, `koster hull is warm honey (${kh.r.toFixed(2)},${kh.g.toFixed(2)},${kh.b.toFixed(2)})`);
  assert.ok(lum(meanColor(e.group.children[0])) < 0.3 && lum(meanColor(k.group.children[0])) > 0.6, 'tarred hull is dark, varnished hull is light');
  const sail = (b) => b.group.getObjectByName('sail-pivot').children.find((o) => o.isMesh && o.geometry.attributes.position.count === 96);
  assert.ok(lum(meanColor(sail(k))) > 0.9, 'koster sail is white');
  const es = srgb(meanColor(sail(e)));
  assert.ok(es.r > es.g && es.g > es.b && es.r - es.b > 0.25 && es.r < 0.8, `eka sail is tanned red-brown (${es.r.toFixed(2)},${es.g.toFixed(2)},${es.b.toFixed(2)})`);
});

check('clinker planking: strakes overlap (each lower edge sticks out) and the name is on the koster stern only', () => {
  const spec = specOf('koster');
  const top = hullPoint(spec, 0.5, 0.4, 1); // inside edge of the next strake
  const lipped = hullPoint(spec, 0.5, 0.4, 1, 1.045);
  assert.ok(lipped[0] > top[0], 'overlap goes outward');
  const k = createBoatMesh(0xffffff, { type: 'koster' });
  const plaques = meshByName(k.group, 'name-plaques');
  assert.ok(plaques && plaques.geometry.attributes.uv, 'name plaques with uv on the koster');
  for (let i = 0; i < plaques.geometry.attributes.position.count; i++) assert.ok(plaques.geometry.attributes.position.getZ(i) < -1, 'on the stern half');
  assert.equal(meshByName(createBoatMesh(0xffffff, { type: 'eka' }).group, 'name-plaques'), undefined);
});

check('pennant at the masthead in the player colour (and only there); recolourable', () => {
  for (const [type, rig] of combos) {
    const b = createBoatMesh(0x66ccff, { type, rig });
    const pen = meshByName(b.group, 'pennant');
    assert.equal(pen.material.color.getHex(), 0x66ccff);
    const top = new THREE.Vector3();
    pen.getWorldPosition(top);
    let mastTop = 0;
    b.group.updateMatrixWorld(true);
    for (const o of allMeshes(b.group)) if (o.name !== 'pennant') mastTop = Math.max(mastTop, new THREE.Box3().setFromObject(o).max.y);
    assert.ok(top.y >= mastTop - 0.15, `${type}/${rig}: pennant (${top.y.toFixed(2)}) sits at the top (${mastTop.toFixed(2)})`);
    b.setPennantColor(0xffcc66);
    assert.equal(pen.material.color.getHex(), 0xffcc66);
    const sailColors = b.group.getObjectByName('sail-pivot').children.filter((o) => o.isMesh).map((o) => o.material.color.getHex());
    assert.ok(sailColors.every((c) => c === 0xffffff), 'the sails are not tinted by the player colour');
  }
});

check('deck slots: crate / barrel / chest appear where asked, empty slots stay empty, bad names are refused', () => {
  for (const type of BOAT_TYPES) {
    const b = createBoatMesh(0xffffff, { type, deck: ['crate', null, 'chest'] });
    const items = b.group.getObjectByName('deck-items');
    assert.deepEqual(items.children.map((c) => c.name), ['item-crate', 'item-chest']);
    b.setDeck(['barrel', 'barrel', 'barrel']);
    assert.equal(items.children.length, 3);
    b.setDeck([]);
    assert.equal(items.children.length, 0);
    assert.deepEqual(b.describe().deck, [null, null, null]);
    for (const slot of DECK_ITEMS) b.setDeck([slot]);
    assert.throws(() => b.setDeck(['anchor']), /unknown deck item/);
    // items rest inside the hull: above the floor, below the mast top, within the beam
    b.setDeck(['crate', 'barrel', 'chest']);
    const hullBox = new THREE.Box3().setFromObject(b.group.children[0]);
    for (const it of items.children) { const bx = new THREE.Box3().setFromObject(it); assert.ok(bx.min.x > hullBox.min.x && bx.max.x < hullBox.max.x && bx.min.y > hullBox.min.y, `${type} ${it.name} inside the hull`); }
  }
  assert.throws(() => createBoatMesh(0xffffff, { deck: ['anchor'] }), /unknown deck item/);
});

check('lantern: dark by day, lit at night (bulb colour + soft halo + light pool), switchable, and no real light', () => {
  for (const type of BOAT_TYPES) {
    const day = createBoatMesh(0xffffff, { type, night: false });
    const night = createBoatMesh(0xffffff, { type, night: true });
    const part = (b, n) => b.group.getObjectByName(n);
    assert.ok(!part(day, 'lantern-halo').visible && !part(day, 'lantern-pool').visible && lum(part(day, 'lantern-bulb').material.color) < 0.6);
    assert.ok(part(night, 'lantern-halo').visible && part(night, 'lantern-pool').visible && part(night, 'lantern-bulb').material.color.getHex() === 0xffd48a);
    assert.ok(part(night, 'lantern-halo').isSprite && part(night, 'lantern-halo').material.blending === THREE.AdditiveBlending);
    day.setNight(true);
    assert.ok(part(day, 'lantern-halo').visible && day.describe().lanternLit);
    day.setNight(false);
    assert.ok(!part(day, 'lantern-halo').visible && !day.describe().lanternLit);
    let lights = 0; night.group.traverse((o) => { if (o.isLight) lights++; });
    assert.equal(lights, 0, 'no PointLight: a new light would recompile every material in the game');
    // the lantern stands on the boat: inside the hull outline, above the deck / floor
    const lp = night.group.getObjectByName('lantern').position;
    assert.ok(Math.abs(lp.x) < 0.2 && lp.y > 0.5, `${type} lantern placed (${lp.x.toFixed(2)}, ${lp.y.toFixed(2)}, ${lp.z.toFixed(2)})`);
  }
});

check('wear 0..1: patches and one repaired plank appear as wear rises, never disappear, and cost no geometry', () => {
  for (const [type, rig] of combos) {
    const b = createBoatMesh(0xffffff, { type, rig, wear: 0 });
    const tris0 = b.describe().triangles;
    let last = b.describe();
    assert.equal(last.hullPatchTriangles, 0); assert.equal(last.repairedPlank, false); assert.equal(last.sailPatchTriangles, 0);
    for (const w of [0.15, 0.3, 0.5, 0.7, 0.9, 1]) {
      b.setWear(w);
      const d = b.describe();
      assert.equal(d.triangles, tris0, 'wear only recolours');
      assert.ok(d.hullPatchTriangles >= last.hullPatchTriangles && d.sailPatchTriangles >= last.sailPatchTriangles, `${type} patches only accumulate`);
      last = d;
    }
    assert.ok(last.repairedPlank && last.hullPatchTriangles >= 8 && last.sailPatchTriangles >= 2, `${type}: patches and a repaired plank at full wear`);
    // the repaired plank is visibly different wood: pale on the honey hull, paler-than-tar on the eka
    const hull = b.group.children[0];
    const lumAt = (i) => lum(new THREE.Color().fromBufferAttribute(hull.geometry.attributes.color, i * 3));
    const tone = []; for (let i = 0; i < hull.geometry.attributes.color.count / 3; i++) tone.push(lumAt(i));
    assert.ok(Math.max(...tone) - Math.min(...tone) > 0.08, `${type}: the mended bits stand out`);
    b.setWear(0);
    assert.equal(b.describe().hullPatchTriangles, 0);
  }
  assert.equal(createBoatMesh(0xffffff, { wear: 9 }).describe().wear, 1, 'wear is clamped');
  assert.equal(createBoatMesh(0xffffff, { wear: -2 }).describe().wear, 0);
});

check('rigs: three koster rigs differ, switch at runtime without leaking meshes, the eka has one fixed spritsail', () => {
  const b = createBoatMesh(0xffffff, { type: 'koster', rig: 'gaff-jib' });
  const sizes = {};
  for (let round = 0; round < 3; round++) {
    for (const rig of KOSTER_RIGS) {
      b.setRig(rig);
      b.setSailAngle(0.5);
      sizes[rig] = b.describe().triangles;
      assert.equal(b.rig, rig);
      let ends = 0; b.group.traverse((o) => { if (o.name === 'boom-end') ends++; });
      assert.equal(ends, 1);
    }
  }
  for (const rig of KOSTER_RIGS) { // after 9 switches the boat is built exactly like a fresh one: nothing piled up
    b.setRig(rig);
    assert.equal(allMeshes(b.group).length, allMeshes(createBoatMesh(0xffffff, { type: 'koster', rig }).group).length, `${rig}: mesh count`);
  }
  assert.ok(sizes['gaff-jib'] > sizes.gaff && sizes['sprit-jib'] > sizes.gaff, 'a jib adds sail');
  const tops = KOSTER_RIGS.map((r) => { const x = createBoatMesh(0xffffff, { type: 'koster', rig: r }); return meshByName(x.group, 'pennant').getWorldPosition(new THREE.Vector3()).y; });
  assert.ok(new Set(tops.map((t) => t.toFixed(2))).size === 3, 'three different mast heights');
  assert.throws(() => createBoatMesh(0xffffff, { type: 'koster', rig: 'schooner' }), /unknown koster rig/);
  const eka = createBoatMesh(0xffffff, { type: 'eka', rig: 'gaff-jib' });
  assert.equal(eka.rig, 'eka', 'the eka ignores the koster rig');
  assert.throws(() => createBoatMesh(0xffffff, { type: 'raft' }), /unknown boat type/);
});

check('deterministic: the same options give identical geometry, so both players see the same boat', () => {
  for (const [type, rig] of combos) {
    const a = createBoatMesh(0x123456, { type, rig, ...FULL });
    const b = createBoatMesh(0x123456, { type, rig, ...FULL });
    a.setSailAngle(0.7); b.setSailAngle(0.7);
    const ma = allMeshes(a.group), mb = allMeshes(b.group);
    assert.equal(ma.length, mb.length);
    ma.forEach((m, i) => assert.deepEqual([...m.geometry.attributes.position.array], [...mb[i].geometry.attributes.position.array]));
  }
});

check('lab URL: every setting round-trips, defaults write nothing, junk is ignored', () => {
  assert.equal(labParamsToSearch('', parseLabParams('')), '');
  const v = { ...LAB_DEFAULTS, boat: 'eka', night: 1, items: ['chest', 'crate'], wear: 0.8, sail: -35.5, pennant: 0x66ccff, heading: 200, cam: 'orbit', az: 120, el: 40, dist: 9 };
  const s = labParamsToSearch('?keep=1', v);
  assert.equal(new URLSearchParams(s).get('keep'), '1');
  assert.deepEqual(parseLabParams(s), { ...v, items: ['chest', 'crate'] });
  const none = parseLabParams(labParamsToSearch('', { ...LAB_DEFAULTS, items: [] }));
  assert.deepEqual(none.items, []);
  const g = parseLabParams('?boat=ship&rig=x&night=maybe&wear=7&sail=abc&pennant=zzz&items=crate,anchor,crate&zoom=0&cam=weird&heading=-20');
  assert.equal(g.boat, 'koster'); assert.equal(g.rig, 'gaff-jib'); assert.equal(g.night, 0); assert.equal(g.wear, 1); assert.equal(g.sail, 25);
  assert.equal(g.pennant, 0xffcc66); assert.deepEqual(g.items, ['crate']); assert.equal(g.zoom, 0.05); assert.equal(g.cam, 'game'); assert.equal(g.heading, 0);
  const game = labParamsToSearch('', { ...LAB_DEFAULTS, cam: 'game', zoom: 0.3, az: 200 });
  assert.equal(new URLSearchParams(game).get('zoom'), '0.3'); assert.equal(new URLSearchParams(game).get('az'), null, 'orbit numbers are dropped in game-camera mode');
});

console.log(`\n${passed}/${passed} checks passed`);
