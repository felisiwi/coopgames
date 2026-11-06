// node games/windward/src/sea-truth.test.js: the shoals as the boat feels them (src/sea-truth.js) and the sea-mark layer (src/seamark-layer.js).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildShoalList, shoalHit } from './shoal-look.js';
import { createShoalIndex, makeSailHeight, GAME_PASS_TIERS, HARD_SHOAL_HEIGHT } from './sea-truth.js';
import { stepAlongShore, isBlocked, HULL_RADIUS_M, BLOCK_H } from './shore.js';
import { createSeamarkLayer, markKind, wantsReflectorGlint, MARK_RADIUS_M, OSM_CREDIT_TEXT } from './seamark-layer.js';
import { PASS_TIERS } from './passes.js';

const read = (f) => JSON.parse(readFileSync(fileURLToPath(new URL(`../assets/coast/${f}`, import.meta.url)), 'utf8'));
const shoals = read('shoals.json');
const seamarks = read('seamarks.json');
let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }

// a fake projection: lon/lat to game metres around the region's corner (1 deg lat = 11119.5 m at 1:10, lon scaled by cos)
const toGame = (lon, lat) => [(lon - 11.25) * 5869.4, -(lat - 58.085) * 11119.5];
const list = buildShoalList(shoals.shoals, toGame);
const index = createShoalIndex(list);

check('the real list: 210 hard shoals (awash / dry rocks and the 9 named), 82 soft ones', () => {
  assert.equal(index.hardCount + index.softCount, 292);
  assert.equal(index.hardCount, 200 + 1 + 9);
  assert.equal(index.softCount, 292 - 210);
});

check('the grid index agrees with a brute-force check over every shoal, at random points near them', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let n = 0; n < 4000; n++) {
    const s = list[Math.floor(rnd() * list.length)];
    const x = s.x + (rnd() - 0.5) * 24, z = s.z + (rnd() - 0.5) * 24;
    const hardRef = list.some((q) => q.look.blocks && Math.hypot(x - q.x, z - q.z) < q.look.collisionRadiusM);
    assert.equal(index.hardAt(x, z), hardRef, `hardAt at ${x.toFixed(1)},${z.toFixed(1)}`);
    let slowRef = 1;
    for (const q of list) if (!q.look.blocks && Math.hypot(x - q.x, z - q.z) < q.look.collisionRadiusM + HULL_RADIUS_M) slowRef = Math.min(slowRef, q.look.slow);
    assert.equal(index.slowAt(x, z), slowRef, 'slowAt');
    const hit = shoalHit(list, x, z, HULL_RADIUS_M); // the shoal module's own rule: soft overlap means slow
    if (hit && !hit.blocks) assert.ok(index.slowAt(x, z) <= hit.slow + 1e-12, 'a soft overlap slows the boat');
  }
});

check('a hard shoal is solid in the sailing height (a spike above BLOCK_H), open sea beside it is not, a soft one never blocks', () => {
  const sea = () => -10;
  const sail = makeSailHeight(sea, index);
  const hard = list.find((s) => s.look.blocks);
  assert.equal(sail(hard.x, hard.z), HARD_SHOAL_HEIGHT);
  assert.ok(HARD_SHOAL_HEIGHT > BLOCK_H + 2);
  assert.equal(sail(hard.x + 60, hard.z + 60) === HARD_SHOAL_HEIGHT && list.every((s) => Math.hypot(s.x - hard.x - 60, s.z - hard.z - 60) > 8), false);
  assert.ok(isBlocked(sail, hard.x, hard.z), 'the rock blocks the hull');
  const soft = list.find((s) => !s.look.blocks);
  assert.equal(isBlocked(sail, soft.x, soft.z) && !list.some((s) => s.look.blocks && Math.hypot(s.x - soft.x, s.z - soft.z) < 12), false, 'a submerged rock does not block');
  assert.ok(index.slowAt(soft.x, soft.z) < 1, 'it slows the boat');
  assert.equal(makeSailHeight(() => 5, index)(hard.x, hard.z), 5, 'land that is already higher stays as it is');
});

check('sailing straight at ANY hard rock: the boat slides off or stops, never ends up inside it', () => {
  const sail = makeSailHeight(() => -10, index);
  let touched = 0;
  for (const s of list.filter((q) => q.look.blocks)) {
    for (const h of [0, Math.PI / 2, Math.PI, 4.4]) { // from four sides
      const dirx = Math.sin(h), dirz = Math.cos(h);
      let x = s.x - dirx * 16, z = s.z - dirz * 16, contact = 0;
      for (let i = 0; i < 90; i++) {
        const mv = stepAlongShore(sail, x, z, dirx * 0.4, dirz * 0.4);
        x = mv.x; z = mv.z; contact = Math.max(contact, mv.contact);
      }
      // other rocks may stand close (a reef): the boat is outside THIS rock's own radius, and not in any hard shoal's
      assert.ok(Math.hypot(x - s.x, z - s.z) >= s.look.collisionRadiusM - 0.01, `${s.shoal.id} from ${h}: ended inside the rock`);
      assert.equal(index.hardAt(x, z), false, `${s.shoal.id}: the boat's centre is in solid shoal`);
      if (contact > 0) touched++;
    }
  }
  assert.ok(touched > 100, `the rocks were met (${touched} contacts)`);
});

check('the game carves the ship tier and any harbour tier rows; the eye tier is never carved', () => {
  assert.deepEqual(GAME_PASS_TIERS, ['ship', 'harbour']);
  assert.ok(!GAME_PASS_TIERS.includes('eye') && !GAME_PASS_TIERS.includes('later'));
  assert.ok(PASS_TIERS.includes('ship'));
});

check('markKind: red cans to port, green cones to starboard, cardinals and dangers black, specials yellow, lights are lights', () => {
  assert.deepEqual(markKind({ type: 'lateral', side: 'port' }), { colour: 'red', shape: 'can' });
  assert.deepEqual(markKind({ type: 'lateral', side: 'starboard' }), { colour: 'green', shape: 'cone' });
  assert.equal(markKind({ type: 'cardinal', direction: 'east' }).direction, 'east');
  assert.equal(markKind({ type: 'isolated_danger' }).colour, 'black');
  assert.equal(markKind({ type: 'special' }).colour, 'yellow');
  assert.equal(markKind({ type: 'light' }).colour, 'light');
});

check('the layer builds marks only when the focus comes near, shows only the near ones, and an invented mark is built exactly like a real one', () => {
  const layer = createSeamarkLayer({ marks: seamarks.marks, toGame, heightAt: () => 0 });
  assert.equal(layer.built, 0, 'nothing is built at load');
  const real = seamarks.marks.find((m) => !m.invented && m.type === 'lateral' && m.side === 'port');
  const [rx, rz] = toGame(real.lon, real.lat);
  layer.update(0, { x: rx, z: rz });
  assert.ok(layer.built >= 1 && layer.built < 60, `built ${layer.built}`);
  assert.ok(layer.shown >= 1);
  const far = layer.shown;
  layer.update(0, { x: rx + 5000, z: rz + 5000 });
  assert.equal(layer.shown, 0, 'far away: nothing shown (but kept)');
  assert.ok(layer.built >= far);
  // invented == real: the same variant and the same triangles for the same kind of mark
  const inv = seamarks.marks.find((m) => m.invented && m.side === 'port');
  const [ix, iz] = toGame(inv.lon, inv.lat);
  layer.update(0, { x: ix, z: iz });
  const a = layer.items.find((i) => i.spec === inv).m, b = layer.items.find((i) => i.spec === real).m || (layer.update(0, { x: rx, z: rz }), layer.items.find((i) => i.spec === real).m);
  assert.equal(a.variant, b.variant);
  assert.equal(a.triangles, b.triangles);
  assert.equal(layer.items.find((i) => i.spec === inv).ring, null, 'no debug ring in a normal game');
  assert.ok(MARK_RADIUS_M >= 300);
});

check('?debug=1 rings the invented marks (and only those); minimap and gull lists carry real positions', () => {
  const layer = createSeamarkLayer({ marks: seamarks.marks, toGame, heightAt: () => 0, debug: true });
  const inv = seamarks.marks.find((m) => m.invented);
  const [x, z] = toGame(inv.lon, inv.lat);
  layer.update(0, { x, z });
  assert.ok(layer.items.find((i) => i.spec === inv).ring, 'a ring on the invented mark');
  assert.ok(layer.items.filter((i) => i.ring).every((i) => i.spec.invented), 'no ring on a real one');
  const mm = layer.minimapMarks();
  assert.ok(mm.length > 150 && mm.every((m) => ['red', 'green', 'yellow', 'black'].includes(m.kind)));
  assert.ok(layer.perchMarks().length > 150);
});

check('the night hook: unlit buoys want a reflector glint at night, lit marks and daytime do not', () => {
  assert.equal(wantsReflectorGlint({ form: 'buoy' }, true), true);
  assert.equal(wantsReflectorGlint({ form: 'buoy' }, false), false);
  assert.equal(wantsReflectorGlint({ form: 'buoy', lights: [{ character: 'Fl' }] }, true), false);
  assert.equal(wantsReflectorGlint({ form: 'beacon' }, true), false);
});

check('OSM credit: in both data files and in the game text', () => {
  assert.ok(/OpenStreetMap/.test(OSM_CREDIT_TEXT));
  for (const d of [shoals, seamarks]) { assert.ok(/OpenStreetMap/.test(d.credit)); assert.equal(d.licence, 'ODbL 1.0'); }
});

console.log(`${passed} checks passed`);
