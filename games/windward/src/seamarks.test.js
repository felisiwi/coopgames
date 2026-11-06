// node games/windward/src/seamarks.test.js
// Validates assets/coast/shoals.json and seamarks.json (real OSM data, built by tools/fetch-seamarks.mjs).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { REGION, MARK_TYPES, SHOAL_KINDS, ROCK_LEVELS, build } from '../../../tools/fetch-seamarks.mjs';

const dir = fileURLToPath(new URL('../assets/coast/', import.meta.url));
const shoalsFile = JSON.parse(readFileSync(dir + 'shoals.json', 'utf8'));
const marksFile = JSON.parse(readFileSync(dir + 'seamarks.json', 'utf8'));
const { shoals } = shoalsFile, { marks, lines, harbours } = marksFile;

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }
const inside = (p) => p.lat >= REGION.s && p.lat <= REGION.n && p.lon >= REGION.w && p.lon <= REGION.e;
const OSM_ID = /^(node|way|relation)\/\d+$/;
const MARK_ID = /^((node|way|relation)\/\d+|invented\/[a-z0-9-]+)$/; // real OSM ids, or an invented gate mark

check('region matches names.json (58.085-58.30 N, 11.25-11.50 E)', () => {
  const names = JSON.parse(readFileSync(dir + 'names.json', 'utf8'));
  assert.deepEqual(shoalsFile.region, names.region);
  assert.deepEqual(marksFile.region, names.region);
});

check('shoals: every row is in the region with a valid kind and an OSM id', () => {
  assert.ok(shoals.length > 100, 'expected a few hundred shoals, got ' + shoals.length);
  const ids = new Set();
  for (const s of shoals) {
    assert.ok(inside(s), `${s.id} outside region`);
    assert.ok(SHOAL_KINDS.includes(s.kind), `${s.id} kind ${s.kind}`);
    assert.match(s.id, OSM_ID);
    assert.ok(!ids.has(s.id + s.kind), 'duplicate ' + s.id); ids.add(s.id + s.kind);
    if (s.kind === 'rock') assert.ok(ROCK_LEVELS.includes(s.level), `${s.id} level ${s.level}`);
    if (s.radiusM !== undefined) assert.ok(s.radiusM > 0 && s.radiusM < 5000, `${s.id} radius ${s.radiusM}`);
    if (s.depthM !== undefined) assert.ok(s.depthM >= 0 && s.depthM < 100);
  }
});

check('shoals: named shoals include the real -båd/-flu names, and counts in the file are honest', () => {
  const named = shoals.filter((s) => s.kind === 'named_shoal').map((s) => s.name);
  for (const n of ['Sverkerbådan', 'Jämningsbådan', 'Tors både', 'Hästebåden', 'Bytebåden']) assert.ok(named.includes(n), 'missing ' + n);
  for (const s of shoals.filter((x) => x.kind === 'named_shoal')) assert.ok(s.name && s.how, s.id);
  assert.equal(shoalsFile.counts.total, shoals.length);
  assert.equal(shoalsFile.counts.byKind.rock, shoals.filter((s) => s.kind === 'rock').length);
});

check('marks: every mark is in the region with a valid type, form and OSM id', () => {
  assert.ok(marks.length > 100);
  const ids = new Set();
  for (const m of marks) {
    assert.ok(inside(m), `${m.id} outside region`);
    assert.ok(MARK_TYPES.includes(m.type), `${m.id} type ${m.type}`);
    assert.ok(['buoy', 'beacon', 'light'].includes(m.form), `${m.id} form ${m.form}`);
    assert.match(m.id, m.invented ? /^invented\/[a-z0-9-]+-(port|starboard)$/ : OSM_ID);
    assert.ok(!ids.has(m.id), 'duplicate ' + m.id); ids.add(m.id);
  }
  assert.equal(marksFile.counts.total, marks.length);
  assert.equal(marksFile.counts.invented, marks.filter((m) => m.invented).length);
  assert.equal(marksFile.counts.real + marksFile.counts.invented, marks.length);
  for (const m of marks) assert.match(m.id, MARK_ID);
});

check('IALA A: red = port, green = starboard on every lateral mark; lit laterals use the same colour', () => {
  const lat = marks.filter((m) => m.type === 'lateral');
  assert.ok(lat.length > 50);
  for (const m of lat) {
    assert.ok(['port', 'starboard'].includes(m.side), `${m.id} side ${m.side}`);
    assert.deepEqual(m.colours, [m.side === 'port' ? 'red' : 'green'], `${m.id} ${m.side} is ${m.colours}`);
    for (const l of m.lights ?? []) assert.equal(l.colour, m.colours[0], `${m.id} light colour`);
  }
});

check('cardinal marks: direction and colour band order agree (N black/yellow, E b/y/b, S y/b, W y/b/y)', () => {
  const want = { north: 'black;yellow', east: 'black;yellow;black', south: 'yellow;black', west: 'yellow;black;yellow' };
  const card = marks.filter((m) => m.type === 'cardinal');
  assert.ok(card.length >= 4);
  for (const m of card) {
    assert.ok(want[m.direction], `${m.id} direction ${m.direction}`);
    assert.equal(m.colours.join(';'), want[m.direction], `${m.id}`);
  }
  assert.deepEqual([...new Set(card.map((m) => m.direction))].sort(), ['east', 'north', 'south', 'west']);
});

check('lit cardinal marks flash the IALA rhythm for their side (E 3, S 6, W 9 quick flashes; N continuous)', () => {
  const group = { north: undefined, east: 3, south: 6, west: 9 };
  const lit = marks.filter((m) => m.type === 'cardinal' && m.lights?.length);
  assert.ok(lit.length >= 2);
  for (const m of lit) for (const l of m.lights) {
    assert.ok(['Q', 'VQ'].includes(l.character), `${m.id} ${l.text}`);
    assert.equal(l.group, group[m.direction], `${m.id} ${m.direction} flashes ${l.text}`);
  }
});

check('lights: every light has a character, a period and a text like "Q(3) W 10s"', () => {
  const lit = marks.filter((m) => m.lights?.length);
  assert.ok(lit.length > 20);
  for (const m of lit) for (const l of m.lights) {
    assert.ok(l.character && l.text.startsWith(l.character), `${m.id} ${l.text}`);
    if (l.period !== undefined) assert.ok(l.period > 0 && l.period < 120, `${m.id} period`);
  }
  const q3 = marks.flatMap((m) => m.lights ?? []).find((l) => l.text === 'Q(3) W 10s');
  assert.ok(q3, 'the Q(3) 10s cardinal light from the brief should exist');
});

check('lines + harbours: leading lines have 2+ points; harbours carry coverage numbers', () => {
  assert.ok(lines.length >= 5);
  for (const l of lines) assert.ok(l.points.length >= 2 && ['leading', 'clearing', 'unknown'].includes(l.category), l.id);
  assert.ok(harbours.length >= 15);
  for (const h of harbours) { assert.ok(inside(h)); assert.ok(h.within1500m >= 0 && h.nearestMarkM >= 0); }
  for (const n of ['Grundsunds hamn', 'Fiskebäckskils småbåtshamn']) assert.ok(harbours.some((h) => h.name === n), n);
  assert.ok(harbours.some((h) => /Käringön/.test(h.name)));
});

check('build(): light text and sides come only from the OSM tags (synthetic input)', () => {
  const osm = { elements: [
    { type: 'node', id: 1, lat: 58.2, lon: 11.4, tags: { 'seamark:type': 'buoy_cardinal', 'seamark:buoy_cardinal:category': 'south',
      'seamark:buoy_cardinal:colour': 'yellow;black', 'seamark:light:character': 'Q', 'seamark:light:group': '6', 'seamark:light:colour': 'white', 'seamark:light:period': '15' } },
    { type: 'node', id: 2, lat: 58.2, lon: 11.41, tags: { 'seamark:type': 'rock', 'seamark:rock:water_level': 'submerged' } },
    { type: 'node', id: 3, lat: 59.9, lon: 11.41, tags: { 'seamark:type': 'rock' } }, // far outside: must be dropped
    { type: 'node', id: 1, lat: 58.2, lon: 11.4, tags: { 'seamark:type': 'buoy_cardinal' } }, // duplicate id: ignored
  ] };
  const r = build(osm);
  assert.equal(r.marks.length, 1);
  assert.equal(r.marks[0].lights[0].text, 'Q(6) W 15s');
  assert.equal(r.shoals.length, 1);
  assert.equal(r.shoals[0].level, 'submerged');
});

check('credit: both files carry the OSM credit and the ODbL licence, and the lab page shows it', () => {
  for (const f of [shoalsFile, marksFile]) {
    assert.match(f.credit, /OpenStreetMap contributors/);
    assert.equal(f.licence, 'ODbL 1.0');
    assert.match(f.licenceUrl, /openstreetmap\.org\/copyright/);
  }
  const lab = readFileSync(fileURLToPath(new URL('../seamarks-lab.html', import.meta.url)), 'utf8');
  assert.match(lab, /id="credit"[^>]*>[^<]*©[^<]*<a[^>]*openstreetmap\.org\/copyright/i);
});

console.log(`\n${passed} checks passed`);
