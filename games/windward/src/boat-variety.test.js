// node games/windward/src/boat-variety.test.js: the busy coast's boat variety (src/boat-looks.js, boat-shelf.js, busy-kits.js buildAsset): same seed = same boat, every look allowed in its era,
// real variety across seeds, triangle budgets, the profiles' hull palettes agree with the looks, and the shelf has exactly 20 boats per era.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lookFor, lookIssues, RULES, ERA_OF, TODAY_HULLS, Y1950_HULLS, TODAY_SAILS, Y1950_SAILS, hasLook } from './boat-looks.js';
import { getKit, buildAsset } from './busy-kits.js';
import { Mesher } from './era-assets.js';
import { validateProfile } from './busy-era.js';
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

console.log(`\n${passed} checks passed`);
