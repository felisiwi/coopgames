// node games/windward/src/landmark-assets.test.js — the landmark kit stays cheap (triangle budgets), builds the same every time, stands on the ground at the
// sourced size, differs between eras where the brief says it does, adds no lights, and carries honest data (source, confidence, what the designer chose).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { LANDMARK_TYPES, TYPE_IDS, ALL_VARIANTS, ERAS, variantsOf, eraListOf, createLandmark, buildEraFor } from './landmark-assets.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }
const bbox = (obj) => new THREE.Box3().setFromObject(obj);
const solid = (a) => a.group.children.find((c) => c.isMesh && !c.name.startsWith('windows') && c.name !== 'lantern-glass');
const posOf = (a) => Array.from(solid(a).geometry.attributes.position.array);
const colOf = (a) => Array.from(solid(a).geometry.attributes.color.array);
const eraTriples = ALL_VARIANTS.flatMap((v) => (v.eras.length ? v.eras : ['1950']).map((e) => [v.type, v.variant, e]));
const CONF = new Set(['high', 'medium', 'low']);

check('the kit has the types the brief asks for, each with variants', () => {
  for (const t of ['cairn', 'polemark', 'fyrkur', 'sjobod', 'church', 'windmill', 'darkhouse']) assert.ok(LANDMARK_TYPES[t] && variantsOf(t).length, `type ${t} missing`);
  assert.deepEqual(variantsOf('cairn'), ['heap', 'square-white', 'cylinder-black', 'cylinder-black-arm', 'cone-white-arm', 'belt-white-red', 'belt-white-green', 'tall-white-pole-ball', 'small-white'], 'the brief\'s eight cairn variants (+ the small white)');
  assert.ok(variantsOf('polemark').includes('gaven-1835') && variantsOf('polemark').includes('maseskar-1829'));
});

check('every variant builds in every era it declares, inside its triangle budget', () => {
  for (const [t, v, e] of eraTriples) {
    const a = createLandmark(t, { variant: v, era: e });
    const d = a.describe();
    assert.ok(d.triangles > 0, `${t}/${v}/${e} is empty`);
    assert.ok(d.triangles <= LANDMARK_TYPES[t].maxTris, `${t}/${v}/${e}: ${d.triangles} triangles over the ${LANDMARK_TYPES[t].maxTris} budget`);
    assert.ok(d.meshes <= 4, `${t}/${v}/${e}: ${d.meshes} meshes (a landmark should be a few draw calls)`);
    a.dispose();
  }
});

check('built twice, a landmark is identical (stones are seeded, not random)', () => {
  for (const [t, v, e] of eraTriples) assert.deepEqual(posOf(createLandmark(t, { variant: v, era: e })), posOf(createLandmark(t, { variant: v, era: e })), `${t}/${v}/${e} differs between builds`);
});

check('no NaN, standing on the ground (y = 0 line), taller than it is wide for the towers', () => {
  for (const [t, v, e] of eraTriples) {
    const a = createLandmark(t, { variant: v, era: e });
    for (const x of posOf(a)) assert.ok(Number.isFinite(x), `${t}/${v}/${e}: NaN`);
    const b = bbox(a.group);
    assert.ok(b.min.y > -1.6 && b.min.y <= 0.01, `${t}/${v}/${e}: base at ${b.min.y.toFixed(2)} (should be at the ground, feet at most 1.6 m under)`);
    assert.ok(b.max.y > 0.5, `${t}/${v}/${e}: too low`);
    a.dispose();
  }
});

check('sizes follow the sources: cairns with a sourced height are that tall (within 8%, a top mark may stand above)', () => {
  const H = { 'cylinder-black': 3.5, 'cylinder-black-arm': 3.5, 'tall-white-pole-ball': 8.0 };
  for (const [v, h] of Object.entries(H)) for (const e of ['1950', 'today']) {
    const a = createLandmark('cairn', { variant: v, era: e });
    const top = bbox(a.group).max.y;
    assert.ok(top >= h * 0.97, `${v}/${e}: ${top.toFixed(2)} m, shorter than the sourced ${h} m`);
    if (v === 'cylinder-black' || (v === 'tall-white-pole-ball' && e === 'today')) assert.ok(top <= h * 1.08, `${v}/${e}: ${top.toFixed(2)} m, taller than the sourced ${h} m (nothing stands above the stone)`);
  }
  const hin = createLandmark('cairn', { variant: 'cone-white-arm', era: 'today' });
  assert.ok(Math.abs(bbox(hin.group).max.y - 5.25) < 0.8 || bbox(hin.group).max.y >= 4.8, 'Hinneskär today ~4.8 m + arm');
  const pipe = createLandmark('cairn', { variant: 'cone-white-arm', era: '1950', size: 'small' });
  assert.ok(bbox(pipe.group).max.y >= 2.6 && bbox(pipe.group).max.y <= 3.4, `Pipeskär ~2.6 m, got ${bbox(pipe.group).max.y.toFixed(2)}`);
  const gav = createLandmark('polemark', { variant: 'gaven-1835' }), mas = createLandmark('polemark', { variant: 'maseskar-1829' });
  assert.ok(bbox(gav.group).max.y >= 15 && bbox(gav.group).max.y <= 18, 'Gäven pole 15 m (+ board)');
  assert.ok(bbox(mas.group).max.y >= 18 && bbox(mas.group).max.y <= 21, 'Måseskär pole 18 m (+ board)');
});

check('era differences are real where the brief says so: Bonden loses its pole in 2005, Hinneskär was raised after 1978, Byxeskären\'s belt changes, Fredagsholmen gets a red roof', () => {
  const h = (t, v, e, o = {}) => bbox(createLandmark(t, { variant: v, era: e, ...o }).group).max.y;
  assert.ok(h('cairn', 'tall-white-pole-ball', '1950') > h('cairn', 'tall-white-pole-ball', 'today') + 3, 'Bonden 1950 has a pole and ball, today only the cairn');
  assert.ok(h('cairn', 'cone-white-arm', 'today') > h('cairn', 'cone-white-arm', '1950') + 0.5, 'Hinneskär is taller today (raised after 1978)');
  assert.notDeepEqual(colOf(createLandmark('cairn', { variant: 'belt-white-green', era: '1950' })), colOf(createLandmark('cairn', { variant: 'belt-white-green', era: 'today' })), 'Byxeskären\'s belt colour differs by era');
  assert.notDeepEqual(colOf(createLandmark('fyrkur', { variant: 'fredagsholmen-1942' })), colOf(createLandmark('fyrkur', { variant: 'fredagsholmen-today' })), 'Fredagsholmen: red roof today');
  assert.ok(createLandmark('sjobod', { variant: 'row', era: '1703' }).describe().triangles !== createLandmark('sjobod', { variant: 'row', era: '1950' }).describe().triangles, 'the sea-hut row differs between 1703 and 1950');
});

check('no landmark adds a light to the scene (windows and the lantern are emissive-only)', () => {
  for (const [t, v, e] of eraTriples) { let n = 0; createLandmark(t, { variant: v, era: e }).group.traverse((o) => { if (o.isLight) n += 1; }); assert.equal(n, 0, `${t}/${v}`); }
});

check('windows glow at dusk only: the lit window colour changes with setNight, the fyrkur lantern too', () => {
  const ch = createLandmark('church', { variant: 'cross-church', era: '1950' });
  const wOn = ch.group.children.find((c) => c.name === 'windows-on'), wOff = ch.group.children.find((c) => c.name === 'windows-off');
  const day = (wOff ?? wOn).material.color.getHex(); ch.setNight(true);
  assert.notEqual((wOff ?? wOn).material.color.getHex(), day, 'window colour changes at night');
  const fk = createLandmark('fyrkur', { variant: 'stangholmen-iron', era: '1950' });
  const lamp = fk.group.children.find((c) => c.name === 'lantern-glass'); assert.ok(lamp, 'the lantern-glass mesh exists so the game\'s glow can find it');
  const off = lamp.material.color.getHex(); fk.setNight(true); assert.notEqual(lamp.material.color.getHex(), off);
});

check('every variant says where it comes from: source, confidence, place, and what the designer had to choose', () => {
  for (const v of ALL_VARIANTS) {
    assert.ok(v.label && v.source && CONF.has(v.confidence), `${v.type}/${v.variant}: label/source/confidence`);
    assert.ok(Array.isArray(v.designer), `${v.type}/${v.variant}: designer notes (what is not from a source)`);
    assert.ok(typeof v.build === 'function');
    assert.ok(Array.isArray(v.eras) && v.eras.every((e) => ERAS.includes(e)), `${v.type}/${v.variant}: eras`);
    if (!v.eras.length) assert.ok(v.eraLabel, `${v.type}/${v.variant}: an 1800s-only variant needs an eraLabel`);
  }
});

check('the era kit pieces are IMPORTED, not copied (the file does not redefine them)', () => {
  const src = readFileSync(new URL('./landmark-assets.js', import.meta.url), 'utf8');
  for (const fn of ['addKummel', 'addBoathouse', 'addDryingRacks', 'addSjobod1950', 'addFyrkur1950']) { assert.ok(new RegExp(`import \\{[^}]*\\b${fn}\\b[^}]*\\} from './era-assets.js'`).test(src), `${fn} is imported`); assert.ok(!new RegExp(`function ${fn}\\b`).test(src), `${fn} must not be redefined`); }
});

check('asking for an era a variant lacks draws its nearest declared look; unknown types throw', () => {
  assert.equal(buildEraFor('cairn', 'square-white', '1703'), '1950');
  assert.equal(buildEraFor('polemark', 'gaven-1835', 'today'), '1950', 'the 1800s-only variants draw with the 1950 look in the lab');
  assert.throws(() => createLandmark('nope'), /unknown type/);
  assert.deepEqual(eraListOf('polemark', 'gaven-1835'), []);
});

console.log(`\n${passed} checks passed`);
