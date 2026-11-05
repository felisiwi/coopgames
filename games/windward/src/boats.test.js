// node games/windward/src/boats.test.js — the two Boat Lab boats keep boat.js's contract (bow +Z, boom to leeward,
// phone arc), stay cheap, and their options (rig, deck, night, wear, pennant) do what the brief says.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import {
  createBoatMesh, BOAT_TYPES, KOSTER_RIGS, DECK_ITEMS, BOAT_DEFAULTS, BOW_LOCAL_DIRECTION, loadBoatModel, hullPoint, specOf,
  LAB_DEFAULTS, parseLabParams, labParamsToSearch, waterlineHalfBeam, EKA_SAIL_TONES,
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
  assert.deepEqual(d.describe().deck, ['crate', 'barrel', 'chest'], 'all deck items by default (Felix)');
  assert.equal(d.describe().wear, 0.8, 'wear 0.8 by default (Felix)');
  assert.equal(d.rig, 'gaff-jib', 'gaff + jib is the koster rig');
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
    if (type === 'koster') assert.ok(len > 7.5 && len < 9, `koster length ${len.toFixed(2)} m (brief: 7-9 m real)`);
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

check('each boat stays cheap: under 3k triangles with everything switched on, at most 18 meshes', () => {
  for (const [type, rig] of combos) {
    const d = createBoatMesh(0xffcc66, { type, rig, ...FULL }).describe();
    assert.ok(d.triangles < 3000, `${type}/${rig}: ${d.triangles} triangles`);
    assert.ok(d.meshes <= 18, `${type}/${rig}: ${d.meshes} meshes`);
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

check('clinker planking: each strake overlaps the one below (the lower edge sticks out)', () => {
  const spec = specOf('koster');
  const top = hullPoint(spec, 0.5, 0.4, 1); // inside edge of the next strake
  const lipped = hullPoint(spec, 0.5, 0.4, 1, 1.045);
  assert.ok(lipped[0] > top[0], 'overlap goes outward');
});

check('no name board: the koster carries no plaque, no text texture, and no canvas text code', () => {
  for (const type of BOAT_TYPES) for (const rig of type === 'koster' ? KOSTER_RIGS : [undefined]) {
    const b = createBoatMesh(0xffffff, { type, rig });
    for (const m of allMeshes(b.group)) {
      assert.ok(!m.material.map, `${type}/${rig}: ${m.name || 'mesh'} has a texture map`);
      assert.notEqual(m.name, 'name-plaques');
    }
  }
  const src = readFileSync(new URL('./boats.js', import.meta.url), 'utf8');
  assert.ok(!/fillText|NAME_ON_STERN|name-plaques|namePlaques/.test(src), 'canvas text code is gone from boats.js');
});

check('koster is a slim double-ender: ~3:1, sharp stems at BOTH ends, raked, ends higher than the middle', () => {
  const spec = specOf('koster');
  const beam = 2 * spec.W;
  assert.ok(spec.len / beam > 3 && spec.len / beam < 3.6, `length:beam ${(spec.len / beam).toFixed(2)}`);
  // at the waterline the hull is a knife at each end, and full amidships
  const mid = waterlineHalfBeam(spec, 0.46);
  assert.ok(mid > 0.9, `amidships waterline half-beam ${mid.toFixed(2)}`);
  for (const s of [0.04, 0.96]) assert.ok(waterlineHalfBeam(spec, s) < 0.12, `waterline half-beam at station ${s}: ${waterlineHalfBeam(spec, s).toFixed(3)} (sharp)`);
  for (const s of [0.1, 0.9]) assert.ok(waterlineHalfBeam(spec, s) < 0.55 * mid, `still slim at station ${s}`);
  // the plan narrows steadily to a point at both ends (no boxy shoulder): beam at each station never grows toward the tip
  for (const [from, to] of [[0.46, 0], [0.46, 1]]) {
    let prev = Infinity;
    for (let i = 0; i <= 20; i++) { const s = from + ((to - from) * i) / 20; const w = hullPoint(spec, s, 0, 1)[0]; assert.ok(w <= prev + 1e-9, `plan widens toward the tip at s=${s.toFixed(2)}`); prev = w; }
    assert.ok(hullPoint(spec, to, 0, 1)[0] < 1e-9, 'a point at the tip');
  }
  // stems rake: the keel end of each stem sits well inboard of the sheer end (bow and stern both)
  assert.ok(hullPoint(spec, 1, 0, 1)[2] - hullPoint(spec, 1, 1, 1)[2] > 0.3, 'bow stem rakes');
  assert.ok(hullPoint(spec, 0, 1, 1)[2] - hullPoint(spec, 0, 0, 1)[2] > 0.3, 'stern stem rakes');
  // sheer: both ends higher than amidships, slightly
  const sheerAt = (s) => hullPoint(spec, s, 0, 1)[1];
  assert.ok(sheerAt(1) - sheerAt(0.5) > 0.4 && sheerAt(0) - sheerAt(0.5) > 0.3, 'ends rise');
  assert.ok(sheerAt(1) - sheerAt(0.5) < 0.9 && sheerAt(0) - sheerAt(0.5) < 0.9, '...but only slightly');
});

check('rudder hung on the pointed stern: aft of the stern post, hanging well below the waterline, head above the sheer line', () => {
  const k = createBoatMesh(0xffffff, { type: 'koster' });
  const rudder = meshByName(k.group, 'rudder');
  assert.ok(rudder, 'rudder mesh');
  k.group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(rudder);
  const spec = specOf('koster');
  assert.ok(box.min.z < spec.z0 - 0.3 && box.max.z > spec.z0, `trails aft of the stern post (z ${box.min.z.toFixed(2)}..${box.max.z.toFixed(2)})`);
  assert.ok(box.min.y < -0.6 && box.max.y > 0.8, `blade below the water, head above the stern (y ${box.min.y.toFixed(2)}..${box.max.y.toFixed(2)})`);
  assert.ok(Math.abs(box.min.x + box.max.x) < 1e-6 && box.max.x < 0.15, 'on the centreline, slim');
  assert.equal(meshByName(createBoatMesh(0xffffff, { type: 'eka' }).group, 'rudder'), undefined, 'the eka steers with an oar: no rudder');
});

check('the gaff reads at game scale: its own thick, dark spar along the top edge of the main', () => {
  for (const rig of ['gaff-jib', 'gaff']) {
    const k = createBoatMesh(0xffffff, { type: 'koster', rig, wear: 0 });
    const gaff = meshByName(k.group, 'gaff-spar');
    assert.ok(gaff, `${rig}: gaff spar mesh`);
    assert.ok(gaff.userData.radius >= 0.09, `${rig}: gaff radius ${gaff.userData.radius} m (>= 9 cm so it is >= 2 px at game scale)`);
    const sail = k.group.getObjectByName('sail-pivot').children.find((o) => o.isMesh && o.geometry.attributes.position.count === 96);
    assert.ok(lum(meanColor(gaff)) < 0.7 * lum(meanColor(sail)), `${rig}: the gaff is clearly darker than the sail`);
    // it lies along the sail's head edge: both ends within 0.25 m of the sail's top corners (H and P)
    k.group.updateMatrixWorld(true);
    const gb = new THREE.Box3().setFromObject(gaff), sb = new THREE.Box3().setFromObject(sail);
    assert.ok(Math.abs(gb.max.y - sb.max.y) < 0.35, `${rig}: gaff top ${gb.max.y.toFixed(2)} vs sail top ${sb.max.y.toFixed(2)}`);
  }
  const boom = createBoatMesh(0xffffff, { type: 'koster' });
  assert.equal(meshByName(boom.group, 'gaff-spar').parent.name, 'sail-pivot', 'the gaff swings with the boom');
});

check('eka sail: three tones (terracotta, rust-brown, dark bark-brown), each red-brown, getting darker, switchable at runtime', () => {
  assert.deepEqual(EKA_SAIL_TONES, ['terracotta', 'rust', 'bark']);
  const sailOf = (b) => b.group.getObjectByName('sail-pivot').children.find((o) => o.isMesh && o.geometry.attributes.position.count === 96);
  const lums = [];
  for (const tone of EKA_SAIL_TONES) {
    const e = createBoatMesh(0xffffff, { type: 'eka', sailTone: tone, wear: 0 });
    assert.equal(e.sailTone, tone);
    const c = srgb(meanColor(sailOf(e)));
    assert.ok(c.r > c.g && c.g >= c.b && c.r - c.b > 0.08, `${tone} is red-brown (${c.r.toFixed(2)},${c.g.toFixed(2)},${c.b.toFixed(2)})`);
    lums.push(lum(meanColor(sailOf(e))));
  }
  assert.ok(lums[0] > lums[1] && lums[1] > lums[2], `darker each step: ${lums.map((l) => l.toFixed(3)).join(' > ')}`);
  const e = createBoatMesh(0xffffff, { type: 'eka', wear: 0 });
  e.setSailAngle(0.6);
  const before = lum(meanColor(sailOf(e)));
  e.setSailTone('bark');
  assert.ok(lum(meanColor(sailOf(e))) < before, 'setSailTone repaints the sail');
  assert.ok(Math.abs(e.group.getObjectByName('sail-pivot').rotation.y - 0.6) < 1e-9, 'the sail angle survives the change');
  assert.throws(() => e.setSailTone('purple'), /unknown tone/);
  assert.throws(() => createBoatMesh(0xffffff, { type: 'eka', sailTone: 'purple' }), /unknown eka sail tone/);
  const k = createBoatMesh(0xffffff, { type: 'koster' });
  k.setSailTone('bark'); // no-op: the koster's sails stay white
  assert.ok(lum(meanColor(sailOf(k))) > 0.9);
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
  assert.equal(parseLabParams('').heading, 305); assert.equal(parseLabParams('').wear, 0.8); assert.deepEqual(parseLabParams('').items, ['crate', 'barrel', 'chest']);
  assert.equal(labParamsToSearch('', parseLabParams('?items=crate,barrel,chest&wear=0.8&sail=24&heading=305')), '', 'Felix\'s picks are the defaults');
  for (const esail of ['rust', 'bark']) assert.equal(parseLabParams(labParamsToSearch('', { ...LAB_DEFAULTS, boat: 'eka', esail })).esail, esail, 'eka sail tone survives the URL');
  assert.equal(parseLabParams('?esail=pink').esail, 'terracotta');
  assert.equal(parseLabParams('?rig=sprit-jib').rig, 'sprit-jib', 'the other rigs stay reachable by ?rig=');
  const g = parseLabParams('?boat=ship&rig=x&night=maybe&wear=7&sail=abc&pennant=zzz&items=crate,anchor,crate&zoom=0&cam=weird&heading=-20');
  assert.equal(g.boat, 'koster'); assert.equal(g.rig, 'gaff-jib'); assert.equal(g.night, 0); assert.equal(g.wear, 1); assert.equal(g.sail, 24);
  assert.equal(g.pennant, 0xffcc66); assert.deepEqual(g.items, ['crate']); assert.equal(g.zoom, 0.05); assert.equal(g.cam, 'game'); assert.equal(g.heading, 0);
  const game = labParamsToSearch('', { ...LAB_DEFAULTS, cam: 'game', zoom: 0.3, az: 200 });
  assert.equal(new URLSearchParams(game).get('zoom'), '0.3'); assert.equal(new URLSearchParams(game).get('az'), null, 'orbit numbers are dropped in game-camera mode');
});

console.log(`\n${passed}/${passed} checks passed`);
