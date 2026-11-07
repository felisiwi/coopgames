// node games/windward/src/boat-variety.test.js: the busy coast's boat variety (src/boat-looks.js, boat-shelf.js, busy-kits.js buildAsset): same seed = same boat, every look allowed in its era,
// real variety across seeds, triangle budgets, the profiles' hull palettes agree with the looks, and the shelf has exactly 20 boats per era.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { readFileSync } from 'node:fs';
import { lookFor, lookIssues, RULES, ERA_OF, TODAY_HULLS, Y1950_HULLS, TODAY_SAILS, Y1950_SAILS, hasLook } from './boat-looks.js';
import { getKit, buildAsset } from './busy-kits.js';
import { Mesher } from './era-assets.js';
import { validateProfile, vesselFor } from './busy-era.js';
import { shelfFor, stampShelf, SHELF_ERAS } from './boat-shelf.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }
const eras = JSON.parse(readFileSync(new URL('../data/busy-eras.json', import.meta.url), 'utf8'));
const KIT_OF = { today: 'today', '1950': '1950' };
const ids = Object.keys(RULES);
const seeds = (n) => Array.from({ length: n }, (_, i) => (0.0137 + i * 0.6180339887) % 1);
const build = (kit, assetId, opts) => { const S = new Mesher(), G = { on: new Mesher(), off: new Mesher() }; S.peers = [G.on, G.off]; const look = buildAsset(kit, assetId, opts, S, G); return { S, G, look, tris: S.triangles + G.on.triangles + G.off.triangles }; };
const kitFor = (id) => getKit(KIT_OF[ERA_OF[id]]);
const hasAsset = (id) => !!kitFor(id).assets[id];
const optsFor = (id, seed) => { const A = kitFor(id).assets[id]; return { L: A.halfLen({}) * 2, stripe: A.stripes?.[0], sailsUp: true, lit: true, seed }; };

check('same seed, same boat: the look and every vertex are identical on a second build (and a different seed differs)', () => {
  for (const id of ids.filter(hasAsset)) {
    for (const s of seeds(12)) {
      assert.deepEqual(lookFor(id, s), lookFor(id, s), `${id} look at ${s}`);
      const a = build(kitFor(id), id, optsFor(id, s)), b = build(kitFor(id), id, optsFor(id, s));
      assert.deepEqual(a.look, b.look); assert.deepEqual(a.S.pos, b.S.pos, `${id}: positions differ for the same seed`); assert.deepEqual(a.S.col, b.S.col, `${id}: colours differ for the same seed`);
    }
    const A = JSON.stringify(seeds(30).map((s) => lookFor(id, s))), B = JSON.stringify(seeds(30).map((s) => lookFor(id, s + 0.013)));
    assert.notEqual(A, B, `${id}: a different seed gives different looks`);
  }
});

check('every look is allowed in its era: 600 seeds per type pass lookIssues', () => {
  for (const id of ids) for (const s of seeds(600)) { const bad = lookIssues(id, lookFor(id, s)); assert.deepEqual(bad, [], `${id} seed ${s}: ${bad.join('; ')}`); }
});

check('the rules bite: lookIssues rejects what an era must never have', () => {
  const base = (id, over) => ({ ...lookFor(id, 0.3), ...over });
  assert.ok(lookIssues('fishboat1950', base('fishboat1950', { rig: 'bermuda' })).length, 'a 1950 fishing boat with a Bermuda rig');
  assert.ok(lookIssues('sailboat', base('sailboat', { sailName: 'tanbark', sail: Y1950_SAILS.tanbark })).length, 'a tanbark sail today');
  assert.ok(lookIssues('sailboat', base('sailboat', { rig: 'gaff' })).length, 'a gaff rig today');
  assert.ok(lookIssues('sailboat1950', base('sailboat1950', { hullName: 'navy', hull: TODAY_HULLS.navy })).length, 'a Today-only hull in 1950');
  assert.ok(lookIssues('snipa1950', base('snipa1950', { rig: 'bermuda' })).length, 'a 1950 snipa with a Bermuda rig');
  assert.ok(lookIssues('eka1950', base('eka1950', { rig: 'gaff' })).length, 'a 1950 eka with a gaff rig');
  assert.ok(lookIssues('sailboat1950', base('sailboat1950', { era: 'today' })).length, 'the wrong era');
  assert.ok(lookIssues('nonesuch', {}).length);
  // and the allowed palette really is era-specific: no Today sail colour is a 1950 sail
  for (const h of Object.values(Y1950_SAILS)) assert.ok(!Object.values(TODAY_SAILS).includes(h));
});

check('real variety: across 60 seeds every type gets at least 3 hull colours, and the types with more than one rig or sail show them', () => {
  for (const id of ids) {
    const looks = seeds(60).map((s) => lookFor(id, s));
    const hulls = new Set(looks.map((l) => l.hullName));
    assert.ok(hulls.size >= 3, `${id}: only ${hulls.size} hull colours (${[...hulls]})`);
    if (RULES[id].rigs && RULES[id].rigs.length > 1) assert.ok(new Set(looks.map((l) => l.rig)).size > 1, `${id}: one rig only`);
    if (RULES[id].sails && RULES[id].sails.length > 1) assert.ok(new Set(looks.map((l) => l.sailName)).size > 1, `${id}: one sail colour only`);
    assert.ok(new Set(looks.map((l) => l.beamK)).size > 10, `${id}: the beam hardly varies`);
  }
  const white = seeds(200).filter((s) => lookFor('sailboat', s).hullName === 'white').length;
  assert.ok(white > 200 * 0.5 && white < 200 * 0.85, `white is the most common Today hull but not the only one (${white}/200)`);
});

check('triangle budgets: every boat of every type stays under 450 triangles for 300 seeds, and no boat is empty or non-finite', () => {
  for (const id of ids.filter(hasAsset)) {
    let max = 0;
    for (const s of seeds(300)) {
      const r = build(kitFor(id), id, optsFor(id, s));
      assert.ok(r.tris > 50, `${id}: ${r.tris} triangles`); max = Math.max(max, r.tris);
      assert.ok(r.S.pos.every(Number.isFinite), `${id}: a non-finite coordinate`);
    }
    assert.ok(max <= 450, `${id}: ${max} triangles over the 450 budget`);
  }
});

check('the profiles agree with the looks: every hull colour a look can draw is in the profile\'s palette for that boat (1950); the profiles still validate', () => {
  const y = eras.profiles.find((p) => p.id === 'summer-guests-1950'), kit = getKit(y.kit);
  for (const p of eras.profiles) assert.deepEqual(validateProfile(p, getKit(p.kit)), [], p.id);
  for (const grp of ['traffic', 'moorings']) for (const blk of Object.values(y[grp].classes)) for (const a of blk.assets) {
    if (!hasLook(a.id) || !kit.assets[a.id].look) continue;
    const drawn = RULES[a.id].hulls ? RULES[a.id].hulls.map(([n]) => n) : [...RULES[a.id].fishing.hulls, ...RULES[a.id].yacht.hulls].map(([n]) => n);
    for (const n of drawn) assert.ok(a.stripes.includes(n), `${y.id} ${grp} ${a.id}: the look can draw "${n}" but the profile palette is ${a.stripes}`);
    assert.ok(a.length[1] <= 10, `${a.id}: no boat longer than 10 m`);
  }
});

check('the shelf: exactly 20 boats per era from the era\'s own profile, deterministic, every boat within its era\'s rules', () => {
  for (const era of Object.keys(SHELF_ERAS)) {
    const a = shelfFor(eras, era, 20), b = shelfFor(eras, era, 20);
    assert.equal(a.boats.length, 20); assert.deepEqual(a.boats.map((x) => [x.assetId, x.opts.L, x.opts.seed]), b.boats.map((x) => [x.assetId, x.opts.L, x.opts.seed]));
    const st = stampShelf(a);
    assert.equal(st.placed.length, 20);
    for (const p of st.placed) { if (p.look) assert.deepEqual(lookIssues(p.boat.assetId, p.look), [], `${era} boat ${p.i}`); assert.ok(p.triangles <= 450, `${era} boat ${p.i}: ${p.triangles}`); }
    assert.ok(new Set(st.placed.map((p) => p.look?.hullName)).size >= 5, `${era}: the shelf shows at least 5 hull colours`);
    const eraHulls = era === 'today' ? TODAY_HULLS : Y1950_HULLS;
    for (const p of st.placed) if (p.look) assert.ok(Object.values(eraHulls).includes(p.look.hull), `${era} boat ${p.i}: a hull colour from the other era`);
  }
});

check('the new types sit where the research says: koster + eka in the 1950 kit and profile, daysailer + RIB in the Today kit and profiles, never the other way round', () => {
  const y = eras.profiles.find((p) => p.id === 'summer-guests-1950'), used = (p) => new Set(['traffic', 'moorings'].flatMap((g) => Object.values(p[g].classes).flatMap((b) => b.assets.map((a) => a.id))));
  for (const id of ['koster1950', 'eka1950']) { assert.ok(getKit('1950').assets[id], `${id} in the 1950 kit`); assert.ok(used(y).has(id), `${id} in the 1950 profile`); }
  for (const id of ['daysailer', 'rib']) { assert.ok(getKit('today').assets[id], `${id} in the Today kit`); assert.ok(!used(y).has(id), `${id} must not be in 1950`); for (const p of eras.profiles.filter((q) => q.kit === 'today')) assert.ok(used(p).has(id), `${id} in ${p.id}`); }
  for (const p of eras.profiles.filter((q) => q.kit === 'today')) for (const id of ['koster1950', 'eka1950']) assert.ok(!used(p).has(id), `${id} must not be in ${p.id}`);
});

check('koster: both roles occur; a working koster is gaff-rigged with tanbark or cotton sails, a yacht koster is Bermuda; the two are drawn differently', () => {
  const looks = seeds(200).map((s) => lookFor('koster1950', s)), fish = looks.filter((l) => l.role === 'fishing'), yacht = looks.filter((l) => l.role === 'yacht');
  assert.ok(fish.length > 60 && yacht.length > 60, `${fish.length} fishing / ${yacht.length} yacht`);
  assert.ok(fish.every((l) => l.rig === 'gaff' && ['tanbark', 'cotton'].includes(l.sailName)) && yacht.every((l) => l.rig === 'bermuda'));
  const a = build(getKit('1950'), 'koster1950', { L: 9, look: { ...lookFor('koster1950', 0.3), role: 'fishing', rig: 'gaff', hullName: 'tar', hull: Y1950_HULLS.tar, sailName: 'tanbark', sail: Y1950_SAILS.tanbark } });
  const b = build(getKit('1950'), 'koster1950', { L: 9, look: { ...lookFor('koster1950', 0.3), role: 'yacht', rig: 'bermuda', hullName: 'white', hull: Y1950_HULLS.white, sailName: 'cotton', sail: Y1950_SAILS.cotton } });
  assert.notDeepEqual(a.S.pos, b.S.pos); assert.ok(b.G.on.triangles + b.G.off.triangles > 0, 'the yacht has deckhouse windows');
});

check('eka: rowed ekas have oars out wide, sprit ekas have a tall mast and sail; most are rowed', () => {
  const bounds = (S, ax) => { const v = []; for (let i = ax; i < S.pos.length; i += 3) v.push(S.pos[i]); return [Math.min(...v), Math.max(...v)]; };
  const base = lookFor('eka1950', 0.3), mk = (rig) => build(getKit('1950'), 'eka1950', { L: 4.6, look: { ...base, rig, sailName: 'tanbark', sail: Y1950_SAILS.tanbark } });
  const rowed = mk('rowed'), sprit = mk('sprit');
  assert.ok(bounds(rowed.S, 0)[1] > 1.5, 'oars out to the side'); assert.ok(bounds(rowed.S, 1)[1] < 1.5, 'no mast');
  assert.ok(bounds(sprit.S, 1)[1] > 2.5, 'a mast and a sail'); assert.ok(bounds(sprit.S, 0)[1] < 1.5, 'oars shipped inside');
  const rowedShare = seeds(200).filter((s) => lookFor('eka1950', s).rig === 'rowed').length / 200;
  assert.ok(rowedShare > 0.55 && rowedShare < 0.85, `mostly rowed (${rowedShare})`);
});

check('daysailer and RIB: a cat rig has no jib (fewer triangles than the sloop); a twin RIB has two outboards (more triangles than a single); the RIB\'s tubes show in its colours', () => {
  const dl = lookFor('daysailer', 0.4), ds = (rig) => build(getKit('today'), 'daysailer', { L: 5.4, stripe: 'navy', sailsUp: true, look: { ...dl, rig, flag: false } });
  assert.ok(ds('sloop').tris > ds('cat').tris, 'sloop > cat');
  const rl = lookFor('rib', 0.4), rb = (rig, tube) => build(getKit('today'), 'rib', { L: 6, look: { ...rl, rig, tubeName: 'orange', tube, flag: false } });
  assert.ok(rb('twin', 0xea9a68).tris > rb('single', 0xea9a68).tris, 'twin > single');
  const cols = rb('single', 0xea9a68).S.col, tc = new THREE.Color(0xea9a68), tubeRgb = [tc.r, tc.g, tc.b]; // the Mesher stores colours the way three.js converts them (linear)
  let hit = 0; for (let i = 0; i < cols.length; i += 3) if (Math.abs(cols[i] - tubeRgb[0]) < 0.03 && Math.abs(cols[i + 1] - tubeRgb[1]) < 0.03) hit++;
  assert.ok(hit > 30, `${hit} orange tube vertices`);
});

check('the shelf shows the new types: every era shelf has at least one of each of its new boats, and the busy-coast profile weights are not zero', () => {
  const kinds = { '1950': ['koster1950', 'eka1950'], today: ['daysailer', 'rib'] };
  for (const era of Object.keys(kinds)) { const have = new Set(shelfFor(eras, era, 20).boats.map((b) => b.assetId)); for (const id of kinds[era]) assert.ok(have.has(id), `${era} shelf has a ${id}`); }
});

check('a profile can fix a koster\'s role: the fishing fleet gets working gaff kosters, the sailing class gets Bermuda yacht kosters (hint -> vesselFor -> look)', () => {
  const y = eras.profiles.find((p) => p.id === 'summer-guests-1950'), entry = (cls) => y.traffic.classes[cls].assets.find((a) => a.id === 'koster1950');
  assert.equal(entry('fish').role, 'fishing'); assert.equal(entry('sail').role, 'yacht');
  for (const s of seeds(100)) {
    assert.equal(lookFor('koster1950', s, { role: 'fishing' }).role, 'fishing'); assert.equal(lookFor('koster1950', s, { role: 'yacht' }).role, 'yacht');
    assert.deepEqual(lookIssues('koster1950', lookFor('koster1950', s, { role: 'fishing' })), []); assert.deepEqual(lookIssues('koster1950', lookFor('koster1950', s, { role: 'yacht' })), []);
  }
  const only = (cls) => ({ ...y.traffic.classes[cls], assets: [entry(cls)] }); // a class with just the koster, to see what vesselFor hands on
  assert.equal(vesselFor(only('fish'), 0.4).role, 'fishing'); assert.equal(vesselFor(only('sail'), 0.4).role, 'yacht');
  const fishKosters = shelfFor(eras, '1950', 20).boats.filter((b) => b.assetId === 'koster1950' && b.cls === 'fish');
  for (const b of fishKosters) assert.equal(lookFor('koster1950', b.opts.seed, { role: b.opts.role }).rig, 'gaff', 'a fishing-class koster on the shelf is gaff-rigged');
});

console.log(`\n${passed} checks passed`);
