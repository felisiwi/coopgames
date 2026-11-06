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
  assert.equal(eraRowFor(years, 1900).id, 'today', '90 years from 1990, 195 from 1705');
  assert.equal(yearOfEra(years, 'today'), years.defaultYear);
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
});

check('boats: a quiet coast of ekas (WORLD-1700.md), counts from the table', () => {
  const b = worldAtYear(years, sources, 1700).boats;
  assert.deepEqual(b, { kit: 'eka', moored: 5, sailing: 2 });
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

console.log(`\n${passed} checks passed`);
