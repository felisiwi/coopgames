// node games/windward/src/world-1700.test.js — integrity of data/world-1700.json (the coast as it was around 1700).
// Checks: everything with a position is inside the game region; every item carries sources that exist in the
// source registry; every item carries an `uncertain` flag; invented things are flagged and never "certain";
// the water-level arithmetic reproduces from the published SMHI rates; the shoal list reproduces from shoals.json.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`ok - ${name}`); };
const load = (rel) => JSON.parse(fs.readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));

const world = load('../data/world-1700.json');
const shoalsFile = load('../assets/coast/shoals.json');
const hist = load('../data/settlements-history.json');
const epochs = load('../data/epochs.json');
const REG = { s: 58.085, w: 11.25, n: 58.3, e: 11.5 };

// ---- helpers
const inRegion = (lat, lon) => lat >= REG.s && lat <= REG.n && lon >= REG.w && lon <= REG.e;
const positioned = [];                       // every object anywhere in the file with numeric lat+lon
(function walk(v, where) {
  if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${where}[${i}]`));
  if (v && typeof v === 'object') {
    if (typeof v.lat === 'number' && typeof v.lon === 'number') positioned.push({ where, lat: v.lat, lon: v.lon });
    for (const [k, x] of Object.entries(v)) walk(x, `${where}.${k}`);
  }
})(world, '$');
const registry = world.sourceRegistry;
const knownSource = (id) => Object.prototype.hasOwnProperty.call(registry, id);

check('the file is for 1700, the game region, and the era New border', () => {
  assert.equal(world.year, 1700);
  assert.deepEqual(world.region, REG);
  assert.deepEqual(world.region, shoalsFile.region, 'region must match the coast data');
  const era = epochs.eras.find((e) => e.from <= 1700 && e.to >= 1700);
  assert.equal(world.era.name, era.name);
  assert.equal(world.era.from, era.from);
  assert.equal(world.era.to, era.to);
});

check('every position in the file is inside the region (no stray coordinates)', () => {
  assert.ok(positioned.length > 200, `only ${positioned.length} positions found`);
  for (const p of positioned) assert.ok(inRegion(p.lat, p.lon), `${p.where} (${p.lat}, ${p.lon}) is outside the region`);
});

check('source registry: every source has a url (or project path), a description and a reliability', () => {
  const ids = Object.keys(registry);
  assert.ok(ids.length >= 20);
  for (const id of ids) {
    const s = registry[id];
    assert.ok(/^S\d\d$/.test(id), id);
    assert.ok(typeof s.url === 'string' && s.url.length > 5, `${id} url`);
    assert.ok(typeof s.what === 'string' && s.what.length > 10, `${id} what`);
    assert.ok(['primary', 'secondary', 'tourism', 'project-file', 'search-summary'].includes(s.reliability), `${id} reliability`);
    assert.ok(/^\d{4}-\d{2}-\d{2}/.test(s.readOn), `${id} readOn`);
    if (/^https?:/.test(s.url)) assert.ok(s.url.startsWith('https://'), `${id} should be https`);
  }
});

// items that must each carry sources + an uncertain flag
const items = [
  ...world.settlements.map((x) => ['settlement', x]),
  ...world.seaMarks.marks.map((x) => ['sea mark', x]),
  ...world.seaMarks.pilotage.items.map((x) => ['pilotage', x]),
  ...world.names.map((x) => ['name', x]),
  ...world.boats.fishingPeople.map((x) => ['fishing people', x]),
  ...world.boats.vessels.map((x) => ['vessel', x]),
  ...world.grundsundSound.facts.map((x) => ['grundsund fact', x]),
];
const sections = [
  ['water level', world.waterLevel], ['shoals', world.shoals], ['sea marks', world.seaMarks],
  ['pilotage', world.seaMarks.pilotage], ['traffic', world.boats.traffic], ['grundsund sound', world.grundsundSound], ['boats', world.boats],
];

check('every item has at least one source and every source id exists in the registry', () => {
  for (const [kind, it] of [...items, ...sections]) {
    assert.ok(Array.isArray(it.sources) && it.sources.length > 0, `${kind} ${it.id || it.name || ''} has no sources`);
    for (const s of it.sources) assert.ok(knownSource(s), `${kind} ${it.id || it.name || ''} cites unknown source ${s}`);
  }
  for (const c of world.waterLevel.derivation.publishedRates) assert.ok(knownSource(c.source), c.station);
  for (const s of world.settlements) for (const c of s.counts) assert.ok(knownSource(c.source), `${s.id} count source`);
});

check('every item and section has a boolean uncertain flag', () => {
  for (const [kind, it] of [...items.filter(([k]) => k !== 'grundsund fact' && k !== 'pilotage'), ...sections.filter(([k]) => k !== 'sea marks' && k !== 'boats' && k !== 'pilotage')]) {
    assert.equal(typeof it.uncertain, 'boolean', `${kind} ${it.id || it.name || ''} lacks an uncertain flag`);
  }
  assert.equal(typeof world.seaMarks.pilotage.uncertain, 'boolean');
});

check('invented sea marks are flagged invented AND uncertain; documented ones are not flagged invented', () => {
  let invented = 0;
  for (const m of world.seaMarks.marks) {
    assert.equal(typeof m.invented, 'boolean', m.id);
    if (m.invented) {
      invented += 1;
      assert.equal(m.uncertain, true, `${m.id} is invented, so it must be uncertain`);
      assert.equal(m.status, 'recommended-invented', m.id);
      assert.match(m.evidence, /^INVENTED/, `${m.id} evidence must say INVENTED`);
    } else {
      assert.notEqual(m.status, 'recommended-invented', m.id);
    }
    assert.ok(['cairn', 'spar-mark', 'painted-rock-mark', 'beacon-fire'].includes(m.kind), `${m.id} kind`);
  }
  assert.ok(invented >= 5, 'the recommendation should place several marks');
  assert.ok(world.seaMarks.marks.some((m) => !m.invented), 'the documented marks should be present');
});

check('no lighthouse stands in 1700, and the project data agrees', () => {
  assert.deepEqual(world.seaMarks.lighthousesStanding, []);
  assert.ok(Math.min(...epochs.lighthouseBuilt) > 1700, 'epochs.json lists a lighthouse built on or before 1700');
});

check('settlements exist in settlements-history.json at the same position, and are inside the region', () => {
  const ids = new Set();
  for (const s of world.settlements) {
    assert.ok(!ids.has(s.id), `duplicate ${s.id}`); ids.add(s.id);
    const h = hist.settlements.find((x) => x.name === s.name);
    assert.ok(h, `${s.name} is not in settlements-history.json`);
    assert.equal(s.lat, h.lat); assert.equal(s.lon, h.lon);
    assert.ok(['yes', 'probable', 'uncertain', 'no'].includes(s.existsAround1700), s.id);
    assert.ok(['hamlet', 'small-fishing-village', 'fishing-village', 'farm-and-fishing', 'unknown'].includes(s.sizeClass), s.id);
    assert.equal(typeof s.sizeEstimated, 'boolean', s.id);
    for (const c of s.counts) {
      assert.ok(c.year === null ? typeof c.approx === 'string' : Number.isInteger(c.year), `${s.id} count year`);
      assert.ok(Number.isInteger(c.value) && c.value > 0, `${s.id} count value`);
    }
    if (s.sizeEstimated) assert.equal(s.uncertain, true, `${s.id}: an estimated size must be uncertain`);
  }
  assert.ok(world.settlements.length >= 6);
  // the restricted Tabellverket 1750 figure for Fiskebäckskil (202) must not be copied here
  const fiske = world.settlements.find((s) => s.id === 'fiskebackskil');
  assert.ok(!fiske.counts.some((c) => c.value === 202 || c.year === 1750), 'ddb-restricted figure copied');
});

check('names: every entry has a quote, a documented year no later than 1700, and a modern name', () => {
  for (const n of world.names) {
    assert.ok(n.modern && n.form && n.quote, n.id);
    assert.ok(Number.isInteger(n.year) && n.year <= 1700, `${n.id} year ${n.year}`);
    assert.notEqual(n.form, n.modern, `${n.id} does not differ from the modern name`);
  }
});

check('water level: the offset reproduces from the published SMHI rates, inside its own range', () => {
  const w = world.waterLevel;
  assert.equal(w.uncertain, true);
  assert.equal(w.confidence, 'derived');
  const rates = w.derivation.publishedRates.map((r) => r.cmPerYear);
  assert.ok(rates.length >= 3);
  const years = w.derivation.years;
  assert.equal(years, 2025 - 1700);
  const lowM = Math.min(...rates) * years / 100;
  const highM = Math.max(...rates) * years / 100;
  assert.ok(Math.abs(w.derivation.arithmeticCm.low - lowM * 100) < 0.2);
  assert.ok(Math.abs(w.derivation.arithmeticCm.high - highM * 100) < 0.2);
  assert.ok(w.offsetM >= lowM - 1e-9 && w.offsetM <= w.rangeM[1], 'offset must sit between the arithmetic low and the stated top of the range');
  assert.ok(w.rangeM[0] <= w.offsetM && w.offsetM <= w.rangeM[1]);
  assert.ok(w.derivation.caveats.length >= 2);
  // the cited gauge rates match the SMHI table values read in this mission
  const expect = { Marstrand: 0.16, Smögen: 0.18, Kungsvik: 0.20 };
  for (const [st, v] of Object.entries(expect)) {
    const g = w.derivation.publishedRates.find((r) => r.station.startsWith(st));
    assert.ok(g && g.cmPerYear === v, st);
  }
});

check('shoals: the list is exactly the awash/covers/dry rocks of shoals.json, mapped by the stated rule', () => {
  const map = { awash: 'just-under', covers: 'just-under', dry: 'awash-or-dry' };
  const expected = shoalsFile.shoals.filter((s) => s.kind === 'rock' && map[s.level]);
  assert.equal(world.shoals.list.length, expected.length);
  const byId = new Map(world.shoals.list.map((s) => [s.id, s]));
  assert.equal(byId.size, expected.length, 'duplicate ids in the shoal list');
  for (const e of expected) {
    const got = byId.get(e.id);
    assert.ok(got, `${e.id} missing`);
    assert.equal(got.today, e.level);
    assert.equal(got.in1700, map[e.level]);
    assert.equal(got.lat, e.lat); assert.equal(got.lon, e.lon);
  }
  const named = shoalsFile.shoals.filter((s) => s.kind === 'named_shoal');
  assert.equal(world.shoals.namedShoals.length, named.length);
  const c = world.shoals.counts;
  assert.equal(c.awashToJustUnder + c.coversToJustUnder + c.dryToAwashOrDry, expected.length);
  assert.equal(c.submergedOrUnknownUnchanged, shoalsFile.shoals.filter((s) => s.kind === 'rock' && (s.level === 'submerged' || s.level === 'unknown')).length);
});

check('boats and Grundsund: unknowns are listed rather than guessed', () => {
  assert.ok(world.boats.unresolved.length >= 2);
  assert.ok(world.grundsundSound.notFound.length >= 3);
  assert.equal(world.boats.traffic.uncertain, true);
  assert.equal(world.grundsundSound.uncertain, true);
  assert.match(world.grundsundSound.recommendation, /^RECOMMENDATION \(invented/);
  assert.match(world.boats.traffic.recommendation, /^RECOMMENDATION \(invented/);
  for (const v of world.boats.vessels) assert.ok(['design-choice', 'weak-secondary', 'documented', 'documented-elsewhere', 'documented-general'].includes(v.status), v.id);
});

console.log(`\n${passed} checks passed`);
