// node games/windward/src/names.test.js — guards name discovery (src/names.js): nothing is named
// until the boat is near, each name is found once, it is remembered on the device (and the game
// carries on if storage is blocked), and the real names.json accounts for all 15 of Felix's harbours.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildNameList, createNameBook, displayName, NAME_RADIUS_M, SIGHT_EXTRA_M, SAME_PLACE_M, STORAGE_KEY, findFalseNamesakes, NAMESAKE_REACH_M, FAMOUS_NAMES } from './names.js';
import { layoutLabels, createLabelQueue, keepDistance, labelScore, LABEL_MAX_SHOWN, LABEL_MAX_SHOWN_NARROW, isQuiet, wantsLabel, QUIET_OPACITY, QUIET_SCALE } from './name-labels.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}
const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m };
};
const entries = [
  { id: 'a', name: 'Alpha', kind: 'island', x: 0, z: 0, radius: NAME_RADIUS_M.island },
  { id: 'b', name: 'Beta', kind: 'skerry', x: 500, z: 0, radius: NAME_RADIUS_M.skerry },
  { id: 'c', name: 'Gamma', kind: 'harbour', x: 0, z: 800, radius: NAME_RADIUS_M.harbour },
];

check('nothing is named until the boat is near', () => {
  const book = createNameBook(entries, memoryStorage());
  assert.deepEqual(book.update(2000, 2000), []);
  assert.equal(book.count(), 0);
  assert.equal(book.isKnown('a'), false);
});

check('a name is found when the boat comes within its distance, once only', () => {
  const book = createNameBook(entries, memoryStorage());
  assert.deepEqual(book.update(210, 0).map((e) => e.name), ['Alpha'], 'island found at 210 m');
  assert.deepEqual(book.update(0, 0), [], 'not announced a second time');
  assert.equal(book.isKnown('a'), true);
});

check('reach depends on the kind: an island is seen from further than a skerry', () => {
  const book = createNameBook(entries, memoryStorage());
  assert.deepEqual(book.update(500, 150), [], 'skerry 150 m away is not seen yet (110 m)');
  assert.deepEqual(book.update(500, 100).map((e) => e.name), ['Beta']);
});

check('names are remembered on this device across sessions', () => {
  const store = memoryStorage();
  createNameBook(entries, store).update(0, 0);
  assert.ok(store._m.get(STORAGE_KEY).includes('"a"'));
  const next = createNameBook(entries, store); // a new session
  assert.equal(next.isKnown('a'), true);
  assert.deepEqual(next.update(0, 0), [], 'already known: not shown again');
  assert.equal(next.update(0, 800).length, 1, 'but new places are still discovered');
});

check('remembered ids that no longer exist are dropped; corrupt storage starts fresh', () => {
  const store = memoryStorage();
  store.setItem(STORAGE_KEY, JSON.stringify(['a', 'gone']));
  assert.equal(createNameBook(entries, store).count(), 1);
  store.setItem(STORAGE_KEY, '{not json');
  assert.equal(createNameBook(entries, store).count(), 0);
});

check('blocked storage (private mode) never breaks discovery', () => {
  const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const book = createNameBook(entries, blocked);
  assert.equal(book.update(0, 0).length, 1);
  assert.equal(createNameBook(entries, null).update(0, 0).length, 1, 'no storage at all');
});

check('buildNameList keeps only places inside the region and gives each kind its reach', () => {
  const list = buildNameList({
    names: {
      islands: [{ osm: 'relation/1', name: 'In', kind: 'island', lon: 1, lat: 1 }, { osm: 'relation/2', name: 'Out', kind: 'skerry', lon: 99, lat: 99 }],
      harbours: [{ name: 'Hav', lon: 2, lat: 2 }],
    },
    villages: [{ name: 'Vik', lon: 3, lat: 3 }, { name: 'NoCoords' }],
    toGame: (lon, lat) => [lon * 10, lat * 10],
    inside: (x) => x < 100,
  });
  assert.deepEqual(list.map((e) => `${e.kind}:${e.name}`), ['island:In', 'harbour:Hav', 'village:Vik']);
  assert.equal(list[1].radius, NAME_RADIUS_M.harbour);
  assert.equal(list[2].id, 'village:Vik');
});

const W = 390;
const H = 844;
const rect = (p, it) => ({ x: p.x - it.w / 2, y: p.y - it.h / 2, w: it.w, h: it.h });
const hits = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

check('a label is clamped inside the screen by its OWN size (a wide name no longer starts at x = -10)', () => {
  const it = { id: 'a', x: -30, y: 300, w: 100, h: 36 };
  const p = layoutLabels([it], W, H).get('a');
  assert.ok(p.x - it.w / 2 >= 0 && !p.hidden, JSON.stringify(p));
  const q = layoutLabels([{ ...it, x: 999, y: 9999 }], W, H).get('a');
  assert.ok(q.x + 50 <= W && q.y + 18 <= H);
});

check('two names wanting the same spot: the first (nearest) keeps it, the other stacks beside, not on top', () => {
  const items = [{ id: 'near', x: 200, y: 60, w: 110, h: 36 }, { id: 'far', x: 204, y: 62, w: 120, h: 36 }];
  const out = layoutLabels(items, W, H);
  assert.deepEqual([out.get('near').x, out.get('near').y], [200, 60], 'the nearest is untouched');
  assert.equal(out.get('far').hidden, false);
  assert.ok(!hits(rect(out.get('near'), items[0]), rect(out.get('far'), items[1])), 'no overlap');
});

check('names keep clear of the compass and HUD (Gåsö under the compass at 390 x 844)', () => {
  const compass = { x: 286, y: 80, w: 96, h: 96 };
  const gaso = { id: 'gaso', x: 314, y: 100, w: 104, h: 36 };
  const p = layoutLabels([gaso], W, H, [compass]).get('gaso');
  assert.equal(p.hidden, false, 'still shown, moved clear');
  assert.ok(!hits(rect(p, gaso), compass), `clear of the compass: ${JSON.stringify(p)}`);
  const bottom = layoutLabels([{ id: 'b', x: 195, y: 830, w: 100, h: 36 }], W, H, [{ x: 0, y: 800, w: W, h: 44 }]).get('b');
  assert.ok(!bottom.hidden && bottom.y + 18 <= 800, 'and above the bottom strip');
});

check('a crowd collapses: at most 6 shown, the rest hidden, nothing overlaps (random 3-12 places, 300 trials)', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const compass = [{ x: 286, y: 80, w: 96, h: 96 }, { x: 243, y: 184, w: 139, h: 82 }];
  for (let t = 0; t < 300; t++) {
    const n = 3 + Math.floor(rnd() * 10);
    const items = Array.from({ length: n }, (_, i) => ({ id: `i${i}`, x: rnd() * 500 - 50, y: rnd() * 1000 - 80, w: 70 + rnd() * 90, h: 36 }));
    const out = layoutLabels(items, W, H, compass);
    const shown = items.filter((it) => !out.get(it.id).hidden);
    assert.ok(shown.length >= 1 && shown.length <= LABEL_MAX_SHOWN, `${shown.length} shown`);
    for (const it of shown) {
      const r = rect(out.get(it.id), it);
      assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= W && r.y + r.h <= H, 'inside the screen');
      for (const c of compass) assert.ok(!hits(r, c), 'clear of the HUD');
      for (const o of shown) if (o !== it) assert.ok(!hits(r, rect(out.get(o.id), o)), 'no two overlap');
    }
  }
});

check('a narrow screen shows fewer names; an island or described place beats a nearer bare skerry', () => {
  const items = Array.from({ length: 9 }, (_, i) => ({ id: `i${i}`, x: 200, y: 400 + i * 4, w: 100, h: 36 }));
  const out = layoutLabels(items, W, H, [], { maxShown: LABEL_MAX_SHOWN_NARROW });
  assert.equal(items.filter((it) => !out.get(it.id).hidden).length, LABEL_MAX_SHOWN_NARROW);
  assert.ok(LABEL_MAX_SHOWN_NARROW < LABEL_MAX_SHOWN);
  const gaso = { kind: 'island', desc: 'Goose Isle' };
  assert.ok(labelScore(gaso, 200) < labelScore({ kind: 'skerry', desc: null }, 120), 'Gåsö at 200 m ranks ahead of a bare skerry at 120 m');
  assert.ok(labelScore({ kind: 'skerry', desc: null }, 100) < labelScore({ kind: 'skerry', desc: null }, 150), 'otherwise nearest first');
});

check('a name stays while you are near its place: keep distance is its reach plus 140 m', () => {
  assert.equal(keepDistance({ radius: NAME_RADIUS_M.island }), 360);
  assert.equal(keepDistance({ radius: NAME_RADIUS_M.skerry }), 250);
  assert.equal(keepDistance({ radius: NAME_RADIUS_M.skerry }, false), 170, 'an off-screen edge tag is kept for a shorter distance');
  assert.ok(keepDistance({ radius: NAME_RADIUS_M.skerry }, false) > 100, 'but longer than the screen shows: a phone sees ~20 m to each side');
  assert.ok(keepDistance({ radius: NAME_RADIUS_M.village }) > NAME_RADIUS_M.village, 'longer than the reach it was named at, so it does not vanish the moment it appears');
});

check('the label queue can drop a place\'s pending announcement (a sighting replaced by the real name)', () => {
  const q = createLabelQueue();
  q.push({ entry: { id: 'x', name: 'x', kind: 'village' }, hint: true }, 0);
  q.push({ entry: { id: 'y', name: 'y', kind: 'village' } }, 0);
  q.remove((p) => p.item.entry.id === 'x');
  assert.equal(q.size, 1);
  assert.equal(q.pop(0, 0).entry.id, 'y');
});

check('label queue: at most 3 at once, staggered, villages and harbours before skerries, stale ones dropped', () => {
  const q = createLabelQueue();
  const item = (name, kind) => ({ entry: { name, kind } });
  for (const [n, k] of [['s1', 'skerry'], ['s2', 'skerry'], ['isl', 'island'], ['vil', 'village'], ['har', 'harbour'], ['s3', 'skerry']]) q.push(item(n, k), 0);
  assert.equal(q.pop(0, 0).entry.name, 'vil', 'village first');
  assert.equal(q.pop(0.3, 1), null, 'staggered: too soon after the last one');
  assert.equal(q.pop(1, 1).entry.name, 'har');
  assert.equal(q.pop(2, 2).entry.name, 'isl');
  assert.equal(q.pop(3, 3), null, 'three already showing');
  assert.equal(q.pop(3, 2).entry.name, 's1', 'then skerries, in the order found');
  assert.equal(q.pop(20, 0), null, 'everything left was stale (waited > 8 s) and is dropped');
  assert.equal(q.size, 0);
});

// ---- stage 1b: descriptive names before discovery -------------------------------------------------------------
const described = [
  { id: 'h', name: 'Hättan', kind: 'skerry', x: 0, z: 0, radius: NAME_RADIUS_M.skerry, desc: 'the Hood' },
  { id: 'p', name: 'Plain', kind: 'skerry', x: 1000, z: 0, radius: NAME_RADIUS_M.skerry, desc: null },
];

check('a place shows its description until discovered, then the real name with the description underneath', () => {
  assert.deepEqual(displayName(described[0], false), { title: 'the Hood', sub: null });
  assert.deepEqual(displayName(described[0], true), { title: 'Hättan', sub: 'the Hood' });
});

check('a skerry without a description stays unnamed until discovered', () => {
  assert.deepEqual(displayName(described[1], false), { title: null, sub: null });
  const book = createNameBook(described, memoryStorage());
  assert.deepEqual(book.sight(1000, 0), [], 'nothing to show for it from afar');
  assert.deepEqual(book.update(1000, 0).map((e) => e.name), ['Plain'], 'but it is still discovered');
});

check('a described place is sighted before it is named, once, and not again after discovery', () => {
  const book = createNameBook(described, memoryStorage());
  const reach = NAME_RADIUS_M.skerry + SIGHT_EXTRA_M;
  assert.deepEqual(book.sight(reach + 5, 0), [], 'too far');
  assert.deepEqual(book.sight(reach - 5, 0).map((e) => e.name), ['Hättan'], 'sighted before the name is in reach');
  assert.equal(book.isKnown('h'), false, 'sighted is not discovered');
  assert.deepEqual(book.update(reach - 5, 0), [], 'still too far to be named');
  assert.deepEqual(book.sight(reach - 20, 0), [], 'sighted only once');
  assert.deepEqual(book.update(50, 0).map((e) => e.name), ['Hättan'], 'named when close');
  const other = createNameBook(described, memoryStorage());
  other.update(0, 0);
  assert.deepEqual(other.sight(0, 0), [], 'a place already discovered is never sighted');
});

check('buildNameList attaches descriptions by name and merges extra harbours', () => {
  const list = buildNameList({
    names: { islands: [{ osm: 'relation/1', name: 'Hättan', kind: 'skerry', lon: 1, lat: 1 }], harbours: [] },
    villages: [],
    toGame: (lon, lat) => [lon * 10, lat * 10],
    inside: () => true,
    placeNames: { descriptions: { Hättan: 'the Hood' }, extraHarbours: [{ name: 'Dammholmen', lon: 5, lat: 5 }] },
  });
  assert.equal(list.find((e) => e.name === 'Hättan').desc, 'the Hood');
  const dam = list.find((e) => e.name === 'Dammholmen');
  assert.deepEqual([dam.kind, dam.id, dam.desc], ['harbour', 'harbour:Dammholmen', null]);
});

check('the same name close together is one place, the more important kind wins; far apart stays two', () => {
  const base = { names: { islands: [], harbours: [] }, toGame: (lon, lat) => [lon, lat], inside: () => true };
  const list = buildNameList({
    ...base,
    names: { islands: [{ osm: 'r/1', name: 'Käringön', kind: 'skerry', lon: 10, lat: 0 }, { osm: 'r/2', name: 'Käringön', kind: 'skerry', lon: 900, lat: 0 }], harbours: [] },
    villages: [{ name: 'Käringön', lon: 10 + SAME_PLACE_M / 2, lat: 0 }],
  });
  // Käringön is a MAJOR place: the skerry that is the village merges into it, and a far skerry that only shares the name shows no name (1d rule)
  assert.deepEqual(list.map((e) => `${e.kind}@${e.x}`), [`village@${10 + SAME_PLACE_M / 2}`], 'the near skerry is the village; the far namesake is hidden');
  // an ordinary name: far apart stays two places, as before
  const ordinary = buildNameList({
    ...base,
    names: { islands: [{ osm: 'r/1', name: 'Svartskär', kind: 'skerry', lon: 10, lat: 0 }, { osm: 'r/2', name: 'Svartskär', kind: 'skerry', lon: 900, lat: 0 }], harbours: [] },
    villages: [],
  });
  assert.deepEqual(ordinary.map((e) => `${e.kind}@${e.x}`).sort(), ['skerry@10', 'skerry@900'], 'the same ordinary name far apart stays two places');
});

check('label queue: a sighting ranks half a step ahead of its own kind, so a described skerry is not buried behind bare ones', () => {
  const q = createLabelQueue();
  q.push({ entry: { name: 'skerry-hint', kind: 'skerry' }, hint: true }, 0);
  q.push({ entry: { name: 'skerry', kind: 'skerry' } }, 0);
  q.push({ entry: { name: 'village-hint', kind: 'village' }, hint: true }, 0);
  q.push({ entry: { name: 'island', kind: 'island' } }, 0);
  assert.deepEqual([0, 1, 2, 3].map((i) => q.pop(i, 0).entry.name), ['village-hint', 'island', 'skerry-hint', 'skerry']);
});

check('names.json accounts for all 15 of Felix\'s harbours, and the spawn is Grundsunds hamn', () => {
  const data = JSON.parse(fs.readFileSync(new URL('../assets/coast/names.json', import.meta.url), 'utf8'));
  const felix = ['Rammen', 'Bredholmen', 'Skarvesäter', 'Usholmen', 'Testholmarna-Usholmen', 'DammholmeSkären', 'Porsholmen', 'Västra Danholmen', 'Kråkesundsgap', 'Altarholmen', 'Skaboholmen', 'Smörasken', 'Assholmen', 'Jonsborg', 'Vasholmarna'];
  const placed = data.harbours.map((h) => h.name);
  const unplaced = data.unplaced.map((u) => u.name);
  assert.deepEqual([...placed, ...unplaced].sort(), [...felix].sort(), 'every harbour is placed or listed as unplaced, none twice');
  for (const h of data.harbours) assert.ok(h.lat >= data.region.s && h.lat <= data.region.n && h.lon >= data.region.w && h.lon <= data.region.e, `${h.name} inside the region`);
  for (const u of data.unplaced) assert.ok(u.reason, `${u.name} has a reason`);
  assert.equal(data.spawn.name, 'Grundsunds hamn');
  assert.ok(data.islands.length > 200);
});

check('fog gate: a place is not named, or sighted, until its land has been seen; then it is, at once', () => {
  const described = [{ id: 'h', name: 'Hättan', kind: 'island', x: 0, z: 0, radius: NAME_RADIUS_M.island, desc: 'the Hood' }];
  const book = createNameBook(described, memoryStorage());
  let seen = false;
  const canSee = () => seen;
  assert.deepEqual(book.sight(0, 300, canSee), [], 'in sighting range, but the fog still covers it: no descriptive name');
  assert.deepEqual(book.update(0, 100, canSee), [], 'inside the reach, still covered: no name');
  assert.equal(book.isKnown('h'), false);
  seen = true;
  assert.deepEqual(book.sight(0, 300, canSee).map((e) => e.name), ['Hättan'], 'the fog lifts: the descriptive name shows (it was not used up)');
  assert.deepEqual(book.update(0, 100, canSee).map((e) => e.name), ['Hättan']);
  assert.equal(book.isKnown('h'), true);
});

check('without a gate the book behaves as before', () => {
  const book = createNameBook(entries, memoryStorage());
  assert.deepEqual(book.update(210, 0).map((e) => e.name), ['Alpha']);
});

check('quiet names: islands and skerries go quiet once announced, villages, harbours and lights keep their sticky tags', () => {
  for (const kind of ['island', 'skerry']) assert.equal(isQuiet({ kind }, false), true, kind);
  for (const kind of ['village', 'harbour', 'light']) assert.equal(isQuiet({ kind }, false), false, kind);
  assert.equal(isQuiet({ kind: 'island' }, true), false, 'a descriptive sighting is not quiet');
  assert.ok(QUIET_OPACITY < 0.7 && QUIET_OPACITY > 0.3, 'low opacity, still readable');
  assert.ok(QUIET_SCALE < 1 && QUIET_SCALE > 0.6, 'smaller, still readable');
});

check('quiet names only show with their island on screen; a village tag stays as an edge tag', () => {
  const base = { announced: false, near: true };
  assert.equal(wantsLabel({ ...base, quiet: true, onScreen: true }), true, 'passing an island: the quiet name shows');
  assert.equal(wantsLabel({ ...base, quiet: true, onScreen: false }), false, 'island off-screen: no edge tag for a quiet name');
  assert.equal(wantsLabel({ ...base, quiet: false, onScreen: false }), true, 'village off-screen: sticky edge tag stays');
  assert.equal(wantsLabel({ announced: true, near: false, quiet: true, onScreen: false }), true, 'a fresh announcement shows wherever it is');
  assert.equal(wantsLabel({ announced: false, near: false, quiet: false, onScreen: true }), false, 'far away: gone');
});

check('false namesakes: a skerry named like a major place that it is not shows no name; the place\'s own island does; harbours are not major places', () => {
  const anchors = [{ name: 'Käringön', x: 0, z: 0 }, { name: 'Marstrand', x: 5000, z: 5000 }];
  const rows = [
    { id: 'a', name: 'Käringön', kind: 'island', x: 20, z: 10 }, // the island the village stands on
    { id: 'b', name: 'Käringön', kind: 'skerry', x: NAMESAKE_REACH_M + 60, z: 0 }, // a skerry of the same name, elsewhere
    { id: 'c', name: 'Marstrand', kind: 'skerry', x: 100, z: 100 }, // the real Marstrand is 7 km away
    { id: 'd', name: 'Marstrand', kind: 'skerry', x: 5000 + 30, z: 5000 }, // beside the real Marstrand: that IS the place
    { id: 'e', name: 'Smögen', kind: 'skerry', x: 400, z: 400 }, // famous, no anchor given: hidden
    { id: 'f', name: 'Svartskär', kind: 'skerry', x: 3, z: 3 }, // an ordinary name
    { id: 'g', name: 'Käringön', kind: 'village', x: 9999, z: 9999 }, // not an island or a skerry: never touched by the rule
    { id: 'h', name: 'Dammholmen', kind: 'skerry', x: 50, z: 50 }, // a small harbour name: not a major place
  ];
  const hidden = findFalseNamesakes(rows, anchors).map((r) => r.id).sort();
  assert.deepEqual(hidden, ['b', 'c', 'e']);
  assert.ok(FAMOUS_NAMES.includes('Marstrand') && FAMOUS_NAMES.includes('Fiskebäckskil'));
  assert.deepEqual(findFalseNamesakes(rows, anchors, []).map((r) => r.id).sort(), ['b', 'c'], 'without the famous list only the anchored names count');
});

check('false namesakes, the real data: exactly the two OSM skerries named "Marstrand" are hidden, nothing else is lost, and no skerry or island named "Marstrand" is left', () => {
  const read = (f) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url), 'utf8'));
  const names = read('../assets/coast/names.json');
  const places = read('../assets/coast/places.json').places;
  const settlements = read('../data/settlements-history.json').settlements;
  const placeNames = read('../data/place-names.json');
  const toGame = (lon, lat) => [(lon - 11.25) * 5869.378, -(lat - 58.085) * 11119.5];
  const majorPlaces = places.filter((p) => p.kind === 'village' || p.kind === 'town');
  let hidden = null;
  const withRule = buildNameList({ names, villages: settlements, toGame, inside: () => true, placeNames, majorPlaces, onHidden: (h) => { hidden = h; } });
  assert.deepEqual(hidden.map((e) => e.id).sort(), ['relation/10250151', 'relation/10250555']);
  assert.ok(hidden.every((e) => e.name === 'Marstrand' && e.kind === 'skerry'));
  assert.equal(withRule.some((e) => e.name === 'Marstrand' && e.kind !== 'village'), false, 'no skerry or island named Marstrand in the list (the village is the real place, outside the playable window)');
  // the rule off (no anchors, no famous names): the same list plus exactly those two
  const anchors = [...settlements, ...majorPlaces].map((p) => { const [x, z] = toGame(p.lon, p.lat); return { name: p.name, x, z }; });
  const all = [...names.islands].map((i) => { const [x, z] = toGame(i.lon, i.lat); return { id: i.osm, name: i.name, kind: i.kind, x, z }; });
  const hiddenRaw = findFalseNamesakes(all, anchors);
  assert.deepEqual(hiddenRaw.map((e) => e.id).sort(), ['relation/10250151', 'relation/10250555'], 'of 2000+ OSM islands and skerries, only those two');
  for (const keep of ['Gullholmen', 'Käringön', 'Härmanö']) assert.ok(withRule.some((e) => e.name === keep), `${keep} (the place itself) is kept`);
  for (const harbour of ['Dammholmen', 'Danholmen', 'Kråkholmen']) assert.ok(withRule.some((e) => e.name === harbour), `${harbour} (a harbour of Felix's) is kept`);
});

console.log(`${passed} checks passed`);
