// node games/windward/src/templates-1950.test.js: the 1950 content templates (data only, nothing reads them yet):
//   data/things-1950.json     thing templates (wildlife, people, drift finds, secrets, ambient life)
// Checks: every file parses; ids are unique; every place/anchor id exists in the name list or island-lore.json; every
// invented item is flagged; every vocabulary value (anchor, time of day, effect, ...) is known; every lore link points at a
// real hook; nothing from island-lore's 1950 regulars/secrets is silently left out. Later gates add quests, artifacts and
// rumours to this file.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LIGHTHOUSES } from './lighthouses.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }
const read = (rel) => JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), 'utf8'));

const THINGS = read('../data/things-1950.json');
const LORE = read('../data/island-lore.json');
const NAMES = read('../assets/coast/names.json');
const PLACE_NAMES = read('../data/place-names.json');
const SETTLEMENTS = read('../data/settlements-history.json');

// ---- every id the name list or the lore knows ---------------------------------------------------------------
const knownIds = new Set();
for (const [id, p] of Object.entries(LORE.places)) { knownIds.add(id); for (const n of p.nameListIds || []) knownIds.add(n); }
for (const i of NAMES.islands) knownIds.add(i.osm);
for (const h of NAMES.harbours) knownIds.add(`harbour:${h.name}`);
for (const h of PLACE_NAMES.extraHarbours || []) knownIds.add(`harbour:${h.name}`);
for (const v of SETTLEMENTS.settlements) knownIds.add(`village:${v.name}`);
for (const l of LIGHTHOUSES) knownIds.add(`light:${l.name}`);

const V = THINGS._vocab;
const T = THINGS.templates;
const byId = new Map(T.map((t) => [t.id, t]));
const REACTIONS = ['tap', 'approach', 'anchored'];
const SOURCE_KINDS = Object.keys(V.sourceKinds);
const WARMTH = ['friendly', 'warm'];
const OFFERS = ['rumour', 'errand'];
const SLUG = /^[a-z0-9]+(\.[a-z0-9-]+)+$/;
const DRAWING = /^[a-z0-9-]+$/;

// island-lore 1950 hooks deliberately without a template, with the reason
const NOT_TEMPLATED = {
  'village:Fiskebäckskil#secrets[0]': 'canon: the shed with the gas tanks is told by the story script (Britta\'s stub carries the link to her regular)',
  'relation/10250201#secrets[0]': 'the Anna Maria chain link is unique candidate 14 in UNIQUE-ARTIFACT-CANDIDATES.md: Felix places it',
};

check('things-1950.json parses and has the documented header, vocabulary and counts', () => {
  for (const k of ['_about', '_spec', '_fields', '_vocab', '_counts', 'templates']) assert.ok(THINGS[k], `missing ${k}`);
  assert.equal(THINGS._counts.total, T.length);
  const by = {}; for (const t of T) by[t.category] = (by[t.category] || 0) + 1;
  assert.deepEqual(THINGS._counts.byCategory, by);
  assert.ok(T.length >= 60, 'a real set of templates');
});

check('ids are unique, well formed, and the category is in the vocabulary', () => {
  assert.equal(byId.size, T.length, 'duplicate ids');
  for (const t of T) { assert.match(t.id, SLUG, t.id); assert.ok(V.categories.includes(t.category), `${t.id}: category ${t.category}`); }
});

check('every place/anchor id in "where" exists in the name list or island-lore.json, and the anchor type is known', () => {
  for (const t of T) {
    assert.ok(V.anchors.includes(t.where.anchor), `${t.id}: anchor type ${t.where.anchor}`);
    assert.ok(t.where.rule || t.where.spot, `${t.id}: where needs a rule or a spot`);
    for (const p of t.where.places || []) assert.ok(knownIds.has(p), `${t.id}: unknown place id ${p}`);
  }
});

check('every vocabulary value (when, effect, reach, personality, rarity, movement, sighting kind) is known', () => {
  for (const t of T) {
    const w = `${t.id}`;
    for (const [k, list] of Object.entries(t.when || {})) {
      assert.ok(V[k], `${w}: unknown when-field ${k}`);
      assert.ok(Array.isArray(list) && list.length, `${w}: when.${k} must be a non-empty array`);
      for (const x of list) assert.ok(V[k].includes(x), `${w}: when.${k} has unknown value ${x}`);
    }
    assert.ok(V.rarity.includes(t.rarity), `${w}: rarity`);
    assert.ok(V.movement.includes(t.movement), `${w}: movement ${t.movement}`);
    assert.ok(V.sightingKinds.includes(t.sighting.kind), `${w}: sighting kind`);
    for (const r of REACTIONS) {
      const x = t.reactions[r];
      assert.ok(x && V.effects.includes(x.effect), `${w}: ${r} effect ${x && x.effect}`);
      if (x.reach !== undefined) { assert.equal(r, 'tap', `${w}: only tap has a reach`); assert.ok(V.reach.includes(x.reach), `${w}: reach`); }
      if (r === 'tap' && x.effect !== 'none') assert.ok(x.reach, `${w}: a tap that does something needs a reach (ALIVE-SEA 20)`);
    }
    if (t.personality !== undefined) assert.ok(V.personality.includes(t.personality), `${w}: personality`);
    for (const o of t.offers || []) assert.ok(OFFERS.includes(o), `${w}: offers ${o}`);
  }
});

check('shapes: years, density, sighting line and slot, drawing slug, people have lines and a personality', () => {
  for (const t of T) {
    assert.ok(Array.isArray(t.years) && t.years.length === 2 && t.years[0] <= t.years[1], `${t.id}: years`);
    assert.ok(t.density.chance > 0 && t.density.chance <= 1, `${t.id}: chance`);
    assert.ok(Number.isInteger(t.density.cap) && t.density.cap >= 1, `${t.id}: cap`);
    assert.ok(typeof t.routine === 'string' && t.routine.length > 10, `${t.id}: routine`);
    const line = t.sighting.line;
    assert.ok(line && line.length <= 140, `${t.id}: sighting line must be short (<= 140): ${line && line.length}`);
    const slots = line.match(/\{[a-z]+\}/g) || [];
    for (const s of slots) assert.equal(s, '{place}', `${t.id}: unknown slot ${s}`);
    assert.match(t.sighting.drawing, DRAWING, `${t.id}: drawing slug`);
    if (t.category === 'people') {
      assert.ok(t.personality, `${t.id}: a person needs a personality`);
      assert.ok(t.lines && t.lines.hail && t.lines.hail.length <= 160, `${t.id}: a person needs a short hail line`);
    }
    for (const r of REACTIONS) { const l = t.reactions[r].line; if (l) assert.ok(l.length <= 200, `${t.id}: ${r} line too long`); }
  }
});

check('every invented item is flagged: source.kind decides it, and every template says where it comes from', () => {
  for (const t of T) {
    assert.ok(SOURCE_KINDS.includes(t.source.kind), `${t.id}: source kind ${t.source.kind}`);
    assert.ok(Array.isArray(t.source.refs) && t.source.refs.length >= 1 && t.source.refs.every((r) => typeof r === 'string' && r.length > 3), `${t.id}: source refs`);
    const invented = t.source.kind === 'grounded' || t.source.kind === 'invented';
    assert.equal(t.invented, invented, `${t.id}: invented flag must be ${invented} for source kind ${t.source.kind}`);
    if (t.source.kind === 'ported') assert.ok(t.source.refs.some((r) => r.startsWith('src/')), `${t.id}: ported must cite code`);
  }
});

check('every lore link points at a real 1950 hook in island-lore.json', () => {
  let n = 0;
  for (const t of T) {
    if (!t.lore) continue; n += 1;
    const place = LORE.places[t.lore.place];
    assert.ok(place, `${t.id}: lore place ${t.lore.place}`);
    const era = place.eras.find((e) => e.era === '1950');
    assert.ok(era, `${t.id}: no 1950 era at ${t.lore.place}`);
    assert.ok(['regulars', 'secrets', 'questSeeds', 'rumours', 'artifacts'].includes(t.lore.hook), `${t.id}: hook ${t.lore.hook}`);
    assert.ok(era[t.lore.hook] && era[t.lore.hook][t.lore.index], `${t.id}: ${t.lore.place} has no 1950 ${t.lore.hook}[${t.lore.index}]`);
    assert.equal(t.invented, true, `${t.id}: a template built on an invented lore hook is invented`);
  }
  assert.ok(n >= 55, `expected most per-place templates to link (${n})`);
});

check('nothing from island-lore\'s 1950 regulars and secrets is silently left out', () => {
  const have = new Set(T.filter((t) => t.lore).map((t) => `${t.lore.place}#${t.lore.hook}[${t.lore.index}]`));
  const missing = [];
  for (const [id, p] of Object.entries(LORE.places)) {
    const era = p.eras.find((e) => e.era === '1950'); if (!era) continue;
    for (const hook of ['regulars', 'secrets']) (era[hook] || []).forEach((_, i) => { const k = `${id}#${hook}[${i}]`; if (!have.has(k) && !NOT_TEMPLATED[k]) missing.push(k); });
  }
  assert.deepEqual(missing, [], 'add a template, or an entry in NOT_TEMPLATED with the reason');
  for (const k of Object.keys(NOT_TEMPLATED)) assert.ok(!have.has(k), `${k} is in NOT_TEMPLATED but has a template`);
});

check('secrets that need a warm regular name a real regular; story-owned templates are people or secrets', () => {
  for (const t of T) {
    if (t.requires) {
      assert.ok(byId.has(t.requires.regular), `${t.id}: requires unknown regular ${t.requires.regular}`);
      assert.equal(byId.get(t.requires.regular).category, 'people', `${t.id}: the regular must be a person`);
      assert.ok(WARMTH.includes(t.requires.warmth), `${t.id}: warmth`);
    }
    if (t.storyOwned) assert.ok(['people', 'secret'].includes(t.category), `${t.id}: storyOwned category`);
  }
  for (const id of ['place.maseskar.keeper', 'people.britta', 'people.the-boy', 'place.lysekil.depot-clerk', 'place.grundsund.boatbuilder']) {
    assert.equal(byId.get(id) && byId.get(id).storyOwned, true, `${id} must be story-owned (hand-placed)`);
  }
});

check('the ported wildlife keeps the numbers from src/life.js', () => {
  const eider = byId.get('wildlife.eider-raft').where.params, seal = byId.get('wildlife.harbour-seals').where.params;
  assert.deepEqual([eider.cellM, eider.chance, eider.perRaft, eider.fleeDistM, eider.fleeMaxM], [150, 0.4, 4, 28, 16]);
  assert.deepEqual([seal.cellM, seal.chance, seal.alertM], [100, 0.3, 30]);
  assert.deepEqual(seal.rockHeightM, [0.25, 1.6]);
  assert.deepEqual(eider.depthM, [1.5, 10]);
});

check('the ported numbers still match the code they were copied from', () => {
  const life = fs.readFileSync(new URL('./life.js', import.meta.url), 'utf8');
  for (const re of [/RAFT_CELL_M = 150/, /RAFT_CHANCE = 0\.4/, /RAFT_SIZE = 4/, /SEAL_CELL_M = 100/, /SEAL_CHANCE = 0\.3/, /FLEE_DIST_M = 28/, /FLEE_MAX_M = 16/, /SEAL_ALERT_M = 30/]) assert.match(life, re);
});

check('no unique artifact is created or referenced as a drop; the unique candidates stay Felix\'s', () => {
  for (const t of T) assert.ok(!/unique/i.test(JSON.stringify(t.reactions)), `${t.id}: reactions mention a unique`);
});

console.log(`\n${passed} checks passed`);
