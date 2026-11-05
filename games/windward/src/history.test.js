// node games/windward/src/history.test.js — phase / population logic and the settlements data file.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { phaseAt, stateAt, populationAt, houseWidth, KINDS, YEAR_MAX, GAP_MAX, NEAR_MAX } from './history.js';

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`ok - ${name}`); };

const S = {
  firstRecorded: 1700,
  phases: [
    { from: 1747, to: 1809, kind: 'herring-boom' },
    { from: 1808, to: 1830, kind: 'decline' },
    { from: 1900, to: null, kind: 'resort' },
  ],
  population: [
    { year: 1800, value: 100, counts: 'parish' },
    { year: 1850, value: 200, counts: 'parish', licence: 'ddb-restricted' },
    { year: 1950, value: 500, counts: 'locality' },
    { year: 2020, value: 300, counts: 'locality' },
  ],
};

check('hidden before firstRecorded, plain "hamlet" when no phase covers the year', () => {
  assert.equal(stateAt(S, 1699), null);
  assert.deepEqual(stateAt(S, 1700), { kind: 'hamlet', phase: null });
  assert.equal(stateAt({ firstRecorded: null, phases: [] }, 1700).kind, 'hamlet');          // null = drawn at every year
});
check('the latest-starting phase wins where two overlap', () => {
  assert.equal(phaseAt(S, 1807).kind, 'herring-boom');
  assert.equal(phaseAt(S, 1808).kind, 'decline');                                            // 1808-1809 overlap
  assert.equal(phaseAt(S, 1830).kind, 'decline');
  assert.equal(phaseAt(S, 1831), null);
});
check('"to": null stays open through the last year', () => {
  assert.equal(phaseAt(S, 1900).kind, 'resort');
  assert.equal(phaseAt(S, YEAR_MAX).kind, 'resort');
});
check('population: exact year gives the count', () => {
  assert.deepEqual(populationAt(S, 1950), { value: 500, mode: 'counted', year: 1950, counts: 'locality' });
});
check('population: interpolates between counts at most 60 years apart', () => {
  const p = populationAt(S, 1825);
  assert.equal(p.mode, 'interpolated'); assert.equal(p.value, 150);
  assert.ok(GAP_MAX === 60);
});
check('population: counts further apart than the gap limit are not bridged; the nearest is used only if close', () => {
  // 1850 -> 1950 is 100 years apart: no interpolation
  assert.equal(populationAt(S, 1900), null, 'a 100-year gap with the year in the middle is "estimated"');
  const near = populationAt(S, 1940);
  assert.equal(near.mode, 'nearest'); assert.equal(near.year, 1950); assert.ok(1950 - 1940 <= NEAR_MAX);
  assert.equal(populationAt(S, 1790).mode, 'nearest');                                       // 10 years before the first count
  assert.equal(populationAt(S, 1700), null, 'more than 15 years before the first count');
  assert.equal(populationAt(S, 2025).value, 300);                                            // 5 years after the last count
});
check('population: no observations means estimated (null)', () => {
  assert.equal(populationAt({ population: [] }, 1900), null);
  assert.equal(populationAt({}, 1900), null);
});
check('rows tagged ddb-restricted can be switched off', () => {
  assert.equal(populationAt(S, 1850, { useDdb: true }).value, 200);
  const off = populationAt(S, 1850, { useDdb: false });
  assert.notEqual(off && off.mode, 'counted');
  assert.equal(populationAt(S, 1850, { useDdb: false }), null);                              // 1800 and 1950 are 150 years apart
});
check('house width grows with population and stays within 11-54 px', () => {
  const sizes = [1, 20, 80, 300, 1000, 5000, 50000, 570000, 1e9].map(houseWidth);
  for (let i = 1; i < sizes.length; i++) assert.ok(sizes[i] >= sizes[i - 1]);
  assert.equal(houseWidth(1), 11); assert.equal(houseWidth(1e9), 54);
  assert.ok(houseWidth(80) > 14 && houseWidth(80) < 17);
});

// ---- the data file
const dataDir = fileURLToPath(new URL('../data/', import.meta.url));
const coastDir = fileURLToPath(new URL('../assets/coast/', import.meta.url));
const data = JSON.parse(fs.readFileSync(dataDir + 'settlements-history.json', 'utf8'));
const meta = JSON.parse(fs.readFileSync(coastDir + 'meta.json', 'utf8'));
const places = JSON.parse(fs.readFileSync(coastDir + 'places.json', 'utf8')).places;

check('every settlement has coordinates inside the map and an OSM place', () => {
  assert.ok(data.settlements.length >= 25);
  for (const s of data.settlements) {
    assert.ok(s.lat >= meta.bbox.s && s.lat <= meta.bbox.n && s.lon >= meta.bbox.w && s.lon <= meta.bbox.e, s.name + ' outside the box');
    assert.ok(places.some((p) => p.name === s.name && p.osm === s.osm), s.name + ' not in places.json');
  }
});
check('phases are well formed: allowed kind, from <= to, a source on each, no phase before 1700 without a reason', () => {
  for (const s of data.settlements) for (const p of s.phases) {
    assert.ok(KINDS.includes(p.kind), `${s.name}: kind ${p.kind}`);
    assert.ok(Number.isInteger(p.from), `${s.name}: from`);
    assert.ok(p.to === null || (Number.isInteger(p.to) && p.to >= p.from), `${s.name}: to`);
    assert.ok(['low', 'medium', 'high'].includes(p.confidence), `${s.name}: confidence`);
    assert.ok(p.src.length > 0 && p.src.every((i) => Number.isInteger(i) && i >= 0 && i < s.sources.length), `${s.name}: phase source index`);
  }
});
check('every entry has a confidence, only http(s) sources, and a first record that cites one', () => {
  for (const s of data.settlements) {
    assert.ok(['low', 'medium', 'high'].includes(s.confidence), s.name);
    assert.ok(s.sources.length > 0 && s.sources.every((u) => /^https:\/\//.test(u)), `${s.name}: sources`);
    if (s.firstRecorded != null) {
      assert.ok(Number.isInteger(s.firstRecorded) && s.firstRecorded < 2025, `${s.name}: firstRecorded`);
      assert.ok(Number.isInteger(s.firstRecordedSrc) && s.firstRecordedSrc < s.sources.length, `${s.name}: firstRecorded source`);
    }
  }
});
check('every population row is a counted number with a source; restricted rows are tagged', () => {
  let rows = 0, ddb = 0;
  for (const s of data.settlements) {
    for (const o of s.population) {
      rows++;
      assert.ok(Number.isInteger(o.year) && o.year >= 1700 && o.year <= 2025, `${s.name}: year ${o.year}`);
      assert.ok(Number.isFinite(o.value) && o.value > 0, `${s.name}: value ${o.value}`);
      assert.ok(typeof o.counts === 'string' && o.counts.length > 3, `${s.name}: counts label`);
      assert.ok(Number.isInteger(o.src) && o.src >= 0 && o.src < s.sources.length, `${s.name}: row source index`);
      if (o.licence) { assert.equal(o.licence, 'ddb-restricted'); ddb++; assert.ok(o.year < 1960, `${s.name}: restricted row after 1960`); }
    }
  }
  assert.ok(rows > 300 && ddb > 20 && ddb < 80, `${rows} rows, ${ddb} restricted`);
});
check('SCB rows in the data match the stored SCB file (read, not retyped)', () => {
  const scb = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../../tools/data/scb-tatort-population.json', import.meta.url)), 'utf8'));
  const lysekil = data.settlements.find((s) => s.name === 'Lysekil');
  const row = lysekil.population.find((o) => o.year === 2020);
  assert.equal(row.value, scb.data['1484TC105']['2020']);
  assert.equal(row.value, 7728);                                                              // the sv.wikipedia infobox says 7,628: the table and SCB say 7,728
});
check('the population rules differ for a village with and without counts at the end year', () => {
  const by = Object.fromEntries(data.settlements.map((s) => [s.name, s]));
  assert.equal(populationAt(by['Lysekil'], 1770).value, 536);                                 // book figure
  assert.equal(populationAt(by['Havstenssund'], 1800), null);                                 // one 2023 count only: estimated in 1800
  assert.equal(populationAt(by['Mollösund'], 1800, { useDdb: false }), null);                 // the 1750-1890 series is all restricted
  assert.ok(populationAt(by['Mollösund'], 1800, { useDdb: true }).value > 300);
  assert.equal(stateAt(by['Marstrand'], 1292), null);                                         // first recorded 1293
  assert.equal(stateAt(by['Marstrand'], 1800).kind, 'herring-boom');
  assert.equal(stateAt(by['Marstrand'], 1850).kind, 'resort');
});

check('Härmanö is in the data, with its own counts that are not added to Gullholmen\'s parish rows', () => {
  const by = Object.fromEntries(data.settlements.map((s) => [s.name, s]));
  const h = by['Härmanö'], g = by['Gullholmen'];
  assert.ok(h, 'Härmanö missing');
  assert.equal(h.firstRecorded, 1673);
  assert.ok(h.population.length >= 2 && h.population.every((o) => /Härmanö/.test(o.counts)));
  assert.match(h.parish.mapping, /not additive/);
  assert.match(g.parish.mapping, /do not add/);
  assert.equal(g.firstRecorded, 1588);                                                        // Bohusläns museum rapport 2012:39
  assert.deepEqual(h.population.map((o) => [o.year, o.value]), [[2000, 138], [2012, 92]]);   // as relayed from sv.wikipedia; the notes say Gullholmen island had 20 and 10
});

console.log(`\n${passed} passed`);
