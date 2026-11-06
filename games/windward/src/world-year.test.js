// node games/windward/src/world-year.test.js — the world-by-year switch: era choice, the 1700 spec (water, hidden rocks, settlements,
// marks, names, boats) read from the data, the coast at another water level, and honesty (nothing invented without a flag).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { worldAtYear, eraRowFor, eraById, yearOfEra, cottagesFor, coastAtWaterLevel, shoalsInEra, HIDDEN_LOOK } from './world-year.js';
import { shoalLook } from './shoal-look.js';

const json = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const years = json('../data/world-years.json');
const w1700 = json('../data/world-1700.json');
const shoals = json('../assets/coast/shoals.json');
const sources = { 'world-1700.json': w1700 };
let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }

check('a year picks its era; years outside every era fall to the nearest', () => {
  assert.equal(eraRowFor(years, 1700).id, '1700');
  assert.equal(eraRowFor(years, 2025).id, 'today');
  assert.equal(eraRowFor(years, 1500).id, '1700');
  assert.equal(eraRowFor(years, 1800).id, '1700', '95 years from 1705, 190 from 1990');
  assert.equal(eraRowFor(years, 1900).id, '1950', '30 years from 1930');
  assert.equal(eraRowFor(years, 1950).id, '1950'); assert.equal(eraRowFor(years, 1969).id, '1950');
  assert.equal(eraRowFor(years, 1975).id, '1950', '6 years from 1969, 15 from 1990'); assert.equal(eraRowFor(years, 1985).id, 'today');
  assert.equal(eraRowFor(years, 1825).id, '1950', 'halfway-ish: 120 from 1705, 105 from 1930');
  assert.equal(yearOfEra(years, 'today'), years.defaultYear);
  assert.equal(yearOfEra(years, '1950'), 1950);
  assert.equal(yearOfEra(years, '1700'), 1700, 'the 1700 toggle shows 1700, not the middle of its range');
  assert.ok(eraRowFor(years, yearOfEra(years, '1700')).id === '1700');
  assert.equal(eraById(years, 'nope'), null);
});

check('1700: the water offset and the hidden rocks come from world-1700.json, not from numbers in the code', () => {
  const s = worldAtYear(years, sources, 1700);
  assert.equal(s.waterOffsetM, w1700.waterLevel.offsetM);
  assert.equal(s.waterOffsetM, 0.55);
  const justUnder = w1700.shoals.list.filter((r) => r.in1700 === 'just-under');
  assert.equal(s.hiddenRockIds.size, justUnder.length);
  assert.equal(s.hiddenRockIds.size, w1700.shoals.counts.awashToJustUnder + w1700.shoals.counts.coversToJustUnder, '200 + 2');
  for (const r of justUnder) assert.ok(s.hiddenRockIds.has(r.id));
  assert.equal(s.lights, false);
  assert.equal(s.modernMarks, false);
  assert.equal(s.kit, '1700');
});

check('today: no offset, no hidden rocks, lights and modern marks on, nothing to place (the game does it)', () => {
  const s = worldAtYear(years, sources, 2025);
  assert.equal(s.waterOffsetM, 0);
  assert.equal(s.hiddenRockIds.size, 0);
  assert.equal(s.lights, true);
  assert.equal(s.modernMarks, true);
  assert.deepEqual(s.settlements, []);
  assert.equal(s.kit, 'today');
  assert.equal(s.boats.sailing + s.boats.moored, 0);
});

check('1700 settlements: only the places that existed (or probably did), sizes from the data, uncertainty carried', () => {
  const s = worldAtYear(years, sources, 1700);
  assert.equal(s.settlements.length, w1700.settlements.length, 'all seven are shown (yes / probable / uncertain)');
  const by = Object.fromEntries(s.settlements.map((x) => [x.id, x]));
  assert.equal(by.gullholmen.cottages, 10, '20 fishing families / 2 households a cottage');
  assert.equal(by.lysekil.cottages, years.eras[0].settlements.cottagesBySizeClass['fishing-village']);
  assert.equal(by.grundsund.cottages, 4, 'a hamlet');
  assert.ok(by.grundsund.cottages < by.lysekil.cottages && by.harmano.cottages < by.gullholmen.cottages);
  assert.equal(by.grundsund.uncertain, true, 'Grundsund as a village in 1700 is doubtful (WORLD-1700.md)');
  assert.equal(by.gullholmen.uncertain, false);
  assert.ok(s.settlements.every((x) => x.cottages >= 1 && Number.isFinite(x.lon) && Number.isFinite(x.lat)));
  const gone = worldAtYear({ ...years, eras: [{ ...years.eras[0], settlements: { ...years.eras[0].settlements, showIf: ['yes'] } }, years.eras[1]] }, sources, 1700);
  assert.ok(gone.settlements.length < s.settlements.length, 'showIf filters by existsAround1700');
});

check('1700 marks: cairns and painted rocks only; no spar, no light, no modern mark; invented ones are flagged', () => {
  const s = worldAtYear(years, sources, 1700);
  assert.ok(s.marks.length >= 6);
  assert.ok(s.marks.every((m) => ['cairn', 'painted-rock-mark'].includes(m.kind)));
  assert.ok(!s.marks.some((m) => m.id === 'hattan-spar'));
  assert.ok(s.marks.some((m) => m.kind === 'cairn') && s.marks.some((m) => m.kind === 'painted-rock-mark'));
  for (const m of s.marks) { const src = w1700.seaMarks.marks.find((x) => x.id === m.id); assert.equal(m.invented, src.invented); }
  assert.ok(s.marks.filter((m) => !m.invented).length === 2, 'only Maseskar and Karingon have any source');
  assert.ok(s.notes.some((n) => /invented/.test(n)), 'the lab says so');
});

check('names: documented old forms only; a place with none gets no name', () => {
  const s = worldAtYear(years, sources, 1700);
  const t = Object.fromEntries(s.labels.map((l) => [l.id, l]));
  assert.equal(t.karingon.text, 'Kierlingøon'); assert.equal(t.karingon.year, 1659);
  assert.equal(t.gullholmen.text, 'Guldholmen');
  assert.equal(t.harmano.text, 'Hermanö'); assert.equal(t.harmano.uncertain, true);
  assert.equal(t.lysekil.text, 'Lusekijll'); assert.equal(t.lysekil.year, 1578, 'a 1578 spelling, flagged uncertain');
  assert.equal(t.lysekil.uncertain, true);
  for (const id of ['fiskebackskil', 'grundsund', 'hallevikstrand']) { assert.equal(t[id].text, null, `${id}: no documented 1700 form`); assert.equal(t[id].documented, false); }
  assert.ok(s.labels.some((l) => l.id === 'karingon-cairn'));
  assert.equal(s.labels.find((l) => l.id === 'karingon-cairn').chartName, false, 'the cairn label is for the 3D view only: the island\'s name is already on the chart');
  assert.ok(s.labels.filter((l) => l.text && l.chartName !== false).every((l) => l.documented), 'every name on the chart is a documented one');
});

check('boats: a quiet coast of ekas (WORLD-1700.md), counts from the table', () => {
  const b = worldAtYear(years, sources, 1700).boats;
  assert.deepEqual(b, { kit: 'eka', moored: 5, sailing: 2, ferry: false });
});

check('cottagesFor: families win, people and adults do not, the table covers the rest', () => {
  const rule = years.eras[0].settlements;
  assert.equal(cottagesFor({ counts: [{ year: 1750, value: 226, unit: 'people' }], sizeClass: 'fishing-village' }, rule), 12);
  assert.equal(cottagesFor({ counts: [{ year: 1700, value: 21, unit: 'fishing families' }], sizeClass: 'hamlet' }, rule), 11);
  assert.equal(cottagesFor({ counts: [], sizeClass: 'nonsense' }, rule), rule.cottagesBySizeClass.unknown);
});

check('a data file the era names but is missing throws, not a silent empty world', () => {
  assert.throws(() => worldAtYear(years, {}, 1700), /world-1700\.json/);
});

check('coastAtWaterLevel: land lower than the offset goes under, the sea deepens, the rest is the same coast', () => {
  // a 4-pixel strip: [deep sea, shallow sea, low land 0.3 m, high land 3 m]
  const coast = {
    meta: {}, toPx: () => [0, 0],
    isLand: (i) => i >= 2, heightM: (i) => ({ 2: 0.3, 3: 3 }[i] ?? 0), classAt: (i) => (i >= 2 ? 4 : 0),
    depthM: (i) => ({ 0: 12, 1: 1 }[i] ?? 0),
  };
  const c = coastAtWaterLevel(coast, 0.55);
  assert.equal(c.isLand(2), false, '0.3 m of land goes under a 0.55 m higher sea');
  assert.equal(c.isLand(3), true);
  assert.ok(Math.abs(c.heightM(3) - 2.45) < 1e-9);
  assert.equal(c.classAt(2), 0); assert.equal(c.classAt(3), 4);
  assert.ok(Math.abs(c.depthM(0) - 12.55) < 1e-9 && Math.abs(c.depthM(1) - 1.55) < 1e-9, 'the sea is deeper by the offset');
  assert.ok(Math.abs(c.depthM(2) - 0.25) < 1e-9, 'drowned low land is a shallow 0.25 m');
  assert.equal(coastAtWaterLevel(coast, 0), coast, 'no offset, same object (today costs nothing)');
});

check('shoalsInEra: awash and covers rocks become hidden-but-solid in 1700; the rest keep their look; today changes nothing', () => {
  const toGame = (lon, lat) => [lon * 1000, lat * 1000];
  const s1700 = worldAtYear(years, sources, 1700);
  const list = shoalsInEra(shoals.shoals, s1700, toGame, shoalLook);
  assert.equal(list.length, shoals.shoals.length);
  const hidden = list.filter((x) => x.hidden);
  assert.equal(hidden.length, s1700.hiddenRockIds.size);
  for (const h of hidden) { assert.ok(['awash', 'covers'].includes(h.shoal.level)); assert.deepEqual(h.look, HIDDEN_LOOK); assert.equal(h.look.blocks, true, 'a keel still hits it'); assert.equal(h.look.look, 'hidden'); }
  const today = shoalsInEra(shoals.shoals, worldAtYear(years, sources, 2025), toGame, shoalLook);
  assert.equal(today.filter((x) => x.hidden).length, 0);
  const awashToday = today.filter((x) => x.shoal.level === 'awash');
  assert.ok(awashToday.every((x) => x.look.look === 'foam' && x.look.blocks), 'today they are white surf rings');
  const named = list.filter((x) => x.shoal.kind === 'named_shoal');
  assert.ok(named.every((x) => !x.hidden && x.look.look === 'foam'), 'the nine named shoals cannot be decided: unchanged');
});

// ---- the 1950 row, against a small synthetic source in the shape docs/WORLD-1950.md / data/world-1950.json promise ----
const fake1950 = {
  waterLevel: { offsetM: 0.13 },
  settlements: { list: [
    { id: 'grundsund', name: 'Grundsund', lat: 58.2133, lon: 11.4192, existsAround1950: 'yes', sizeClass: 'fishing-village', counts: [{ year: 1940, value: 600, unit: 'people' }, { year: 1950, value: 790, unit: 'people' }, { year: 1900, value: 4000, unit: 'people' }], hasCanningFactory: true, livelihood: ['fishing', 'canning'] },
    { id: 'lysekil', name: 'Lysekil', lat: 58.277, lon: 11.443, existsAround1950: 'yes', sizeClass: 'small-town', counts: [{ year: 1950, value: 6200, unit: 'people' }] },
    { id: 'harmano', name: 'Härmanö', lat: 58.16, lon: 11.375, existsAround1950: 'probable', sizeClass: 'farm-and-fishing', counts: [] },
    { id: 'ghost', name: 'Ghost', lat: 58.1, lon: 11.3, existsAround1950: 'no', sizeClass: 'hamlet', counts: [] },
  ] },
  lighthouses: { list: [
    { id: 'gaven', name: 'Gäven', lat: 58.27, lon: 11.35, inWindow: true, standingIn1950: true, lit1950: true, manned1950: 'keepers', keeperBuildings: { present: true, colours: ['white'] } },
    { id: 'islandsberg', name: 'Islandsberg', lat: 58.19, lon: 11.4, inWindow: true, standingIn1950: true, lit1950: false, manned1950: 'dark', keeperBuildings: { present: true, colours: ['white', 'red'] } },
    { id: 'hatten', name: 'Hättan', lat: 58.17, lon: 11.37, inWindow: true, standingIn1950: true, lit1950: true, manned1950: 'automatic', keeperBuildings: { present: false } },
    { id: 'hallo', name: 'Hållö', lat: 58.33, lon: 11.2, inWindow: false, standingIn1950: true, lit1950: true, manned1950: 'keepers' },
    { id: 'vaderobod2', name: 'Not yet built', lat: 58.2, lon: 11.3, inWindow: true, standingIn1950: false },
  ] },
  seaMarks: { system: { name: 'Swedish buoyage before IALA A', lateral: { port: { colour: 'black', shape: 'can' }, starboard: { colour: 'red', shape: 'cone' } } },
    todayKindsVs1950: [{ kind: 'lateral (100: 53 red, 47 green; mostly unlit spar buoys)', existedIn1950: true }, { kind: 'cardinal (10: black/yellow buoys)', existedIn1950: false }, { kind: 'isolated_danger (38 black beacon piles)', existedIn1950: 'partly' }] },
  village: { canningFactories: [{ id: 'hallevikstrand-bovik', name: null, place: 'Hälleviksstrand', lat: null, lon: null, from: 1934, to: 1976, status: 'operating in 1950' }, { id: 'gullholmen-hallgren', name: null, place: 'Gullholmen', from: 1960, to: 1990, status: 'conflict: closed per one text' }, { id: 'lysekil-sjobol', name: null, place: 'Lysekil', status: 'uncertain: undated photo only' }] },
  boats: { ferry: { name: null, route: 'Lysekil-Fiskebäckskil', status: 'partly' } },
};
check('1950: water, settlements by population, lighthouses with keepers, period marks, industry, ferry, modern labels (synthetic source)', () => {
  const src = { ...sources, 'world-1950.json': fake1950 };
  const s = worldAtYear(years, src, 1950);
  assert.equal(s.era, '1950'); assert.equal(s.kit, '1950'); assert.equal(s.waterOffsetM, 0.13); assert.equal(s.hiddenRockIds.size, 0, 'a few cm: no rock changes');
  const by = Object.fromEntries(s.settlements.map((x) => [x.id, x]));
  assert.equal(s.settlements.length, 3, 'the one that did not exist is left out');
  assert.equal(by.grundsund.cottages, 28, '790 people / 25 = 32, capped at 28; the 1900 count is outside the years window and ignored');
  assert.equal(cottagesFor({ counts: [{ year: 1950, value: 466, unit: 'parish incl. Härmanö (sv.wikipedia)' }, { year: 1920, value: 150, unit: 'houses (approx.)' }], sizeClass: 'fishing-village' }, { ...years.eras.find((e) => e.id === '1950').settlements, nearYear: 1950 }), 19, 'a descriptive unit is a count of people; a count of houses is not');
  assert.equal(by.lysekil.cottages, 28, 'a town is capped');
  assert.equal(by.harmano.cottages, 4, 'no count: the size-class table');
  assert.equal(by.harmano.uncertain, true); assert.equal(by.grundsund.hasCanningFactory, true);
  assert.deepEqual(s.lighthouses.map((l) => l.id), ['gaven', 'islandsberg', 'hatten'], 'only in-window lights standing in 1950');
  const lh = Object.fromEntries(s.lighthouses.map((l) => [l.id, l]));
  assert.equal(lh.gaven.manned, 'keepers'); assert.equal(lh.gaven.lit, true); assert.equal(lh.gaven.keeperHouse, true);
  assert.equal(lh.islandsberg.lit, false); assert.equal(lh.islandsberg.manned, 'dark');
  assert.equal(lh.islandsberg.keeperHouse, false, 'the override: the game\'s Islandsberg model IS the old keeper\'s house, so no second house'); assert.equal(lh.islandsberg.overridden, true);
  assert.equal(lh.gaven.keeperWall, 'white'); assert.equal(lh.gaven.overridden, false);
  assert.equal(lh.hatten.keeperHouse, false);
  assert.equal(s.lights, true); assert.equal(s.modernMarks, false);
  assert.deepEqual(s.periodMarks.existed, { lateral: true, cardinal: false, isolated_danger: 'partly' });
  assert.deepEqual(s.periodMarks.lateral.port, { colour: 'black', shape: 'can' });
  assert.deepEqual(s.periodMarks.map.lateral.port, ['red-cone', 'red-spar'], 'the colour/shape mapping comes from the era row, not from parsing the research text'); assert.deepEqual(s.periodMarks.map.isolated_danger, ['redblack-spar']);
  assert.deepEqual(s.industry.map((f) => f.id), ['hallevikstrand-bovik'], 'only the ones in the include list AND standing in 1950: the 1960-1990 one and the undated one are out'); assert.equal(s.industry[0].uncertain, false);
  assert.equal(s.ferry.name, null, 'an unnamed ferry stays unnamed'); assert.equal(s.ferry.route, 'Lysekil-Fiskebäckskil');
  assert.deepEqual(s.boats, { kit: '1950', moored: 10, sailing: 3, ferry: true });
  assert.ok(s.labels.every((l) => l.text && l.documented) && s.labels.length === 3 && s.labels[0].text === 'Grundsund', 'modern names');
  assert.ok(s.notes.some((n) => /had keepers/.test(n)) && /Islandsberg: shown dark \(old light\)/.test(s.notes.join(' ')));
  assert.ok(s.notes.some((n) => /not identified/.test(n)), 'the unnamed ferry is said to be unnamed');
  assert.throws(() => worldAtYear(years, sources, 1950), /world-1950\.json/);
});

check('cottagesFor with a population rule: nearest count to the era year inside the window, clamped', () => {
  const rule = { ...years.eras.find((e) => e.id === '1950').settlements, nearYear: 1950 };
  const mk = (counts, sizeClass = 'hamlet') => ({ counts, sizeClass });
  assert.equal(cottagesFor(mk([{ year: 1940, value: 100, unit: 'people' }, { year: 1951, value: 300, unit: 'inhabitants' }]), rule), 12, 'nearest to 1950 wins: 300/25');
  assert.equal(cottagesFor(mk([{ year: 1950, value: 20, unit: 'people' }]), rule), 3, 'minimum');
  assert.equal(cottagesFor(mk([{ year: 1850, value: 900, unit: 'people' }]), rule), 5, 'outside the years window: the table (hamlet)');
  assert.equal(cottagesFor(mk([{ year: 1950, value: 50, unit: 'fishing families' }]), rule), 5, 'families are not people: the 1950 rule ignores them and uses the table (hamlet)');
});

console.log(`\n${passed} checks passed`);
