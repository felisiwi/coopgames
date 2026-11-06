// node games/windward/src/seamark-meshes.test.js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from '../vendor/three/three.module.js';
import {
  createSeamarkMesh, lightPattern, lightIsOn, variantOf, MARK_SAMPLES, MARK_COLOURS, CARDINAL_TOPMARKS, CARDINAL_BANDS, OSM_CREDIT,
} from './seamark-meshes.js';

const marksFile = JSON.parse(readFileSync(fileURLToPath(new URL('../assets/coast/seamarks.json', import.meta.url)), 'utf8'));
let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }

const triangles = (m) => {
  const pos = m.group.getObjectByName('mark-body').geometry.attributes.position, col = m.group.getObjectByName('mark-body').geometry.attributes.color;
  const out = [];
  for (let i = 0; i < pos.count; i += 3) {
    const v = [0, 1, 2].map((k) => [pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k)]);
    out.push({ v, hex: new THREE.Color(col.getX(i), col.getY(i), col.getZ(i)).getHex() });
  }
  return out;
};
const near = (a, b, tol = 0.09) => { // vertex colours are linear floats: compare loosely in sRGB-ish channels
  const A = new THREE.Color(a), B = new THREE.Color(b);
  return Math.abs(A.r - B.r) + Math.abs(A.g - B.g) + Math.abs(A.b - B.b) < tol;
};

check('every sample variant builds, stays under 150 triangles, and is one body mesh (+ a lamp and halo when lit)', () => {
  for (const s of MARK_SAMPLES) {
    const m = createSeamarkMesh(s, { night: true });
    assert.ok(m.triangles > 20 && m.triangles <= 150, `${s.id} ${m.triangles} triangles`);
    const bodies = m.group.children.filter((c) => c.name === 'mark-body');
    assert.equal(bodies.length, 1);
    assert.ok(m.group.children.length <= 3, s.id);
    assert.equal(m.lit, !!s.lights?.length, s.id);
  }
});

check('every mark in seamarks.json (real and invented, lit or not) builds under the budget', () => {
  let max = 0;
  for (const spec of marksFile.marks) {
    const m = createSeamarkMesh(spec, { night: true });
    assert.ok(m.triangles <= 150, `${spec.id} ${m.triangles}`);
    max = Math.max(max, m.triangles);
  }
  assert.ok(max > 60);
});

check('the art rules: flat Lambert vertex-coloured bodies, no PointLight anywhere (a new light recompiles every material)', () => {
  for (const s of MARK_SAMPLES) {
    const m = createSeamarkMesh(s, { night: true });
    m.group.traverse((o) => {
      assert.ok(!o.isLight, `${s.id} contains a light`);
      if (o.name === 'mark-body') { assert.ok(o.material.isMeshLambertMaterial && o.material.flatShading && o.material.vertexColors, s.id); }
    });
  }
});

check('IALA A lateral marks: port = red can, starboard = green cone, nothing of the other colour', () => {
  const port = createSeamarkMesh({ id: 'p', type: 'lateral', side: 'port', form: 'buoy' });
  const stbd = createSeamarkMesh({ id: 'q', type: 'lateral', side: 'starboard', form: 'buoy' });
  assert.equal(port.variant, 'port-can'); assert.equal(stbd.variant, 'starboard-cone');
  const has = (m, c) => triangles(m).some((t) => near(t.hex, c));
  assert.ok(has(port, MARK_COLOURS.red) && !has(port, MARK_COLOURS.green));
  assert.ok(has(stbd, MARK_COLOURS.green) && !has(stbd, MARK_COLOURS.red));
  // the topmark: a cylinder (flat top, red) on port, a cone (apex up, green) on starboard: a cone has a vertex on the axis
  const apexUp = (m, col) => triangles(m).filter((t) => near(t.hex, col)).some((t) => t.v.some((p) => Math.abs(p[0]) < 1e-6 && Math.abs(p[2]) < 1e-6 && p[1] > 3.4 && t.v.filter((q) => q[1] < p[1] - 0.3).length === 2));
  assert.ok(apexUp(stbd, MARK_COLOURS.green), 'starboard topmark is a cone pointing up');
  assert.ok(!apexUp(port, MARK_COLOURS.red), 'port topmark is a can, not a cone');
});

check('cardinal marks: band colours by direction, and the topmark cones point the right way (read from the triangles)', () => {
  for (const dir of ['north', 'east', 'south', 'west']) {
    const m = createSeamarkMesh({ id: 'c' + dir, type: 'cardinal', direction: dir, form: 'buoy' });
    // band order: the mast's colour from the top down, sampled by triangle height
    const cy = (t) => (t.v[0][1] + t.v[1][1] + t.v[2][1]) / 3; // centroid height
    const mast = triangles(m).filter((t) => cy(t) > 0.6 && cy(t) < 3.35 && (near(t.hex, MARK_COLOURS.black) || near(t.hex, MARK_COLOURS.yellow)));
    const seq = [];
    for (const t of mast.sort((a, b) => cy(b) - cy(a))) { const c = near(t.hex, MARK_COLOURS.black) ? 'black' : 'yellow'; if (seq[seq.length - 1] !== c) seq.push(c); }
    assert.deepEqual(seq, CARDINAL_BANDS[dir], `${dir} bands`);
    // topmark cones: apex = the vertex on the axis that no other vertex of its triangle shares a height with; up = the others are lower
    const cones = [];
    for (const t of triangles(m)) {
      if (!near(t.hex, MARK_COLOURS.black)) continue;
      const apex = t.v.find((p) => Math.abs(p[0]) < 1e-6 && Math.abs(p[2]) < 1e-6 && p[1] > 3.4);
      const rest = t.v.filter((p) => p !== apex);
      if (!apex || Math.abs(rest[0][1] - rest[1][1]) > 1e-6 || Math.abs(rest[0][1] - apex[1]) < 0.3) continue;
      cones.push({ y: apex[1], up: rest[0][1] < apex[1] });
    }
    const byApexY = [...new Map(cones.map((c) => [c.y.toFixed(3), c])).values()].sort((a, b) => a.y - b.y).map((c) => (c.up ? 'up' : 'down'));
    assert.deepEqual(byApexY, CARDINAL_TOPMARKS[dir], `${dir} topmark`);
  }
  assert.deepEqual(CARDINAL_TOPMARKS, { north: ['up', 'up'], east: ['down', 'up'], south: ['down', 'down'], west: ['up', 'down'] });
});

check('isolated danger: black with a red band and two black spheres; special: yellow with an X', () => {
  const d = createSeamarkMesh({ id: 'd', type: 'isolated_danger', form: 'beacon' });
  const cols = (m) => new Set(triangles(m).map((t) => t.hex));
  assert.ok(triangles(d).some((t) => near(t.hex, MARK_COLOURS.red)) && triangles(d).some((t) => near(t.hex, MARK_COLOURS.black)));
  const sp = createSeamarkMesh({ id: 'x', type: 'special', form: 'buoy' });
  assert.ok(triangles(sp).filter((t) => near(t.hex, MARK_COLOURS.yellow)).length > triangles(sp).length * 0.6);
  assert.ok(cols(sp).size <= 3);
});

check('light rhythms: Q(3) 10s = three quick flashes then dark; Q(9) 15s; Fl(2) 6s; F steady; periods repeat', () => {
  const sample = (light, T, dt = 0.05) => { const out = []; for (let t = 0; t < T; t += dt) out.push(lightIsOn(light, t)); return out; };
  const edges = (s) => s.filter((v, i) => v && !s[i - 1]).length; // rising edges = flashes
  const q3 = { character: 'Q', group: 3, period: 10 };
  const s = sample(q3, 10);
  assert.equal(edges(s), 3, 'Q(3) has 3 flashes per period');
  assert.ok(!s.slice(Math.round(3 / 0.05), Math.round(10 / 0.05)).some(Boolean), 'dark from 3 s to 10 s');
  assert.deepEqual(sample(q3, 10), sample(q3, 20).slice(200), 'periodic');
  assert.equal(edges(sample({ character: 'Q', group: 9, period: 15 }, 15)), 9);
  assert.equal(edges(sample({ character: 'VQ', group: 3, period: 5 }, 5)), 3);
  assert.equal(edges(sample({ character: 'Fl', group: 2, period: 6 }, 6)), 2);
  assert.ok(sample({ character: 'F' }, 5).every(Boolean));
  const longs = lightPattern({ character: 'Q+LFl', group: 6, period: 15 }).flashes;
  assert.equal(longs.length, 7); assert.ok(longs[6][1] - longs[6][0] >= 2, 'Q(6)+LFl ends with a long flash');
  assert.ok(lightPattern(q3).flashes.every(([a, b]) => Math.abs(b - a - 0.3) < 1e-9));
});

check('every real light in seamarks.json has a valid rhythm: flashes inside the period, on at least once, never always on unless F', () => {
  let n = 0;
  for (const mk of marksFile.marks) for (const l of mk.lights ?? []) {
    const { period, flashes, steady } = lightPattern(l);
    assert.ok(Number.isFinite(period) && period > 0, `${mk.id} ${l.text}`);
    for (const [a, b] of flashes) assert.ok(a >= 0 && b <= period + 1e-9 && b > a, `${mk.id} ${l.text} flash ${a}-${b} in ${period}`);
    if (!steady) {
      let on = 0, N = 400;
      for (let i = 0; i < N; i++) if (lightIsOn(l, (i / N) * period)) on++;
      assert.ok(on > 0 && on < N, `${mk.id} ${l.text} duty ${on}/${N}`);
    }
    n++;
  }
  assert.ok(n > 40);
});

check('at night a lit mark blinks (emissive lamp + halo, no light); by day it never glows; unlit marks have no lamp', () => {
  const spec = MARK_SAMPLES.find((s) => s.id === 's:E');
  const night = createSeamarkMesh(spec, { night: true }), day = createSeamarkMesh(spec, { night: false });
  let onN = 0, onD = 0;
  for (let t = 0; t < 10; t += 0.1) { night.step(t); day.step(t); if (night.lampLit) onN++; if (day.lampLit) onD++; }
  assert.ok(onN >= 3 && onN <= 12, `lit ${onN} of 100 steps`); // Q(3) 10s: 3 flashes of 0.3 s
  assert.equal(onD, 0);
  const lamp = night.group.getObjectByName('mark-lamp'), halo = night.group.getObjectByName('mark-halo');
  assert.ok(lamp.material.isMeshBasicMaterial && halo.isSprite);
  night.setNight(false); night.step(0.05); assert.equal(night.lampLit, false);
  assert.equal(createSeamarkMesh(MARK_SAMPLES[0], { night: true }).group.getObjectByName('mark-lamp'), undefined);
});

check('two marks with the same rhythm do not flash in lock-step (each has its own phase)', () => {
  const l = { character: 'Fl', group: 2, period: 6, colour: 'green' };
  const a = createSeamarkMesh({ id: 'node/1', type: 'light', lights: [l] }, { night: true }), b = createSeamarkMesh({ id: 'node/2', type: 'light', lights: [l] }, { night: true });
  let differ = 0;
  for (let t = 0; t < 6; t += 0.1) { a.step(t); b.step(t); if (a.lampLit !== b.lampLit) differ++; }
  assert.ok(differ > 0);
});

check('buoys bob (position and tilt change), beacons stand still; with seaY a buoy rides the wave height', () => {
  const buoy = createSeamarkMesh({ id: 'b', type: 'lateral', side: 'port', form: 'buoy' }), beacon = createSeamarkMesh({ id: 'k', type: 'isolated_danger', form: 'beacon' });
  assert.ok(buoy.bobs && !beacon.bobs);
  const ys = new Set(), rx = new Set();
  for (let t = 0; t < 8; t += 0.5) { buoy.step(t); beacon.step(t); ys.add(buoy.group.position.y.toFixed(4)); rx.add(buoy.group.rotation.x.toFixed(4)); }
  assert.ok(ys.size > 5 && rx.size > 5);
  assert.equal(beacon.group.position.y, 0); assert.equal(beacon.group.rotation.x, 0);
  buoy.step(1, { seaY: 0.33 }); assert.equal(buoy.group.position.y, 0.33);
  assert.ok(Math.max(...[...ys].map(Number)) - Math.min(...[...ys].map(Number)) < 0.2, 'gentle');
});

check('variantOf maps every type in the data, unknown types fail loudly; the OSM credit is exported', () => {
  const types = new Set(marksFile.marks.map((m) => m.type));
  for (const t of types) assert.ok(variantOf({ type: t, side: 'port', direction: 'north' }).name);
  assert.throws(() => variantOf({ type: 'ufo' }), /unknown sea-mark type/);
  assert.match(OSM_CREDIT, /OpenStreetMap contributors/); assert.match(OSM_CREDIT, /ODbL/);
});

console.log(`\n${passed} checks passed`);
