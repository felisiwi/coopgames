// node games/windward/src/templates-1950.test.js: the 1950 content templates (data only, nothing reads them yet):
//   data/things-1950.json     thing templates (wildlife, people, drift finds, secrets, ambient life)
//   data/quests-1950.json     quest templates (a need + 1 to 3 steps + a resolution, with slots)
//   data/artifacts-1950.json  artifact templates (an invented object carrying a true story; no uniques)
//   data/rumours-1950.json    rumour records (target, teller or channel, text, days, true or twist)
// Checks: every file parses; ids are unique; every place/anchor id exists in the name list or island-lore.json; every
// invented item is flagged; every vocabulary value (anchor, time of day, effect, quest slot type, ...) is known; every lore
// link points at a real hook; every quest, artifact and rumour link resolves; nothing from island-lore's 1950 regulars,
// secrets, quest seeds, rumours or artifacts is silently left out; the species check holds; no unique is created.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LIGHTHOUSES } from './lighthouses.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }
const read = (rel) => JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), 'utf8'));

const THINGS = read('../data/things-1950.json');
const QUESTS = read('../data/quests-1950.json');
const ARTIFACTS = read('../data/artifacts-1950.json');
const RUMOURS = read('../data/rumours-1950.json');
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

// =====================================================================================================================
// The species check (gate 2): which wildlife really occurs on this coast, and when
// =====================================================================================================================
check('every wildlife template carries a species check; a species not present in 1950 does not spawn in 1950', () => {
  for (const t of T) {
    if (t.category !== 'wildlife') { assert.equal(t.speciesCheck, undefined, `${t.id}: speciesCheck is wildlife only`); continue; }
    const c = t.speciesCheck;
    assert.ok(c && V.speciesStatus.includes(c.status), `${t.id}: species status`);
    assert.ok(Array.isArray(c.refs) && c.note && c.note.length > 20, `${t.id}: species refs and note`);
    if (c.status !== 'not-checked') assert.ok(c.refs.length >= 1, `${t.id}: a checked species needs a source`);
    if (c.status === 'not-1950') assert.ok(t.years[0] > 1950 || t.years[1] < 1950, `${t.id}: not in 1950, so its years must exclude 1950`);
    if (c.status.startsWith('confirmed')) assert.notEqual(t.source.kind, 'invented', `${t.id}: a confirmed species is grounded, not invented`);
  }
  assert.equal(byId.get('wildlife.cormorants-drying').speciesCheck.status, 'not-1950');
  assert.deepEqual(V.speciesStatus, ['confirmed-1950', 'confirmed-today', 'not-1950', 'not-checked']);
});

check('every template is valid in 1950 except the species the check removed', () => {
  for (const t of T) {
    const removed = t.speciesCheck && t.speciesCheck.status === 'not-1950';
    assert.equal(t.years[0] <= 1950 && 1950 <= t.years[1], !removed, `${t.id}: years ${t.years}`);
  }
});

// =====================================================================================================================
// Quests
// =====================================================================================================================
const Q = QUESTS.templates, QV = QUESTS._vocab;
const qById = new Map(Q.map((q) => [q.id, q]));
const arts = ARTIFACTS.templates, aById = new Map(arts.map((a) => [a.id, a]));
const rums = RUMOURS.templates, rById = new Map(rums.map((r) => [r.id, r]));
const slotRefs = (s) => (typeof s === 'string' ? (s.match(/\{[a-zA-Z]+\}/g) || []).map((x) => x.slice(1, -1)) : []);
const isThing = (id) => byId.has(id);

check('quests-1950.json parses with its header, vocabulary and counts; ids unique and well formed', () => {
  for (const k of ['_about', '_spec', '_invented', '_fields', '_vocab', '_counts', 'notQuested', 'templates']) assert.ok(QUESTS[k], `missing ${k}`);
  assert.equal(QUESTS._counts.total, Q.length); assert.equal(qById.size, Q.length, 'duplicate quest ids');
  for (const q of Q) assert.match(q.id, /^quest\.[a-z0-9]+(\.[a-z0-9-]+|-[a-z0-9-]+)*$/, q.id);
  assert.ok(Q.length >= 13, 'the three first-slice templates plus 10 or more');
});

check('the three first-slice templates exist: lost item, delivery, after the squall', () => {
  const first = Q.filter((q) => q.firstSlice).map((q) => q.id).sort();
  assert.deepEqual(first, ['quest.first.after-the-squall', 'quest.first.delivery', 'quest.first.lost-item']);
  assert.equal(QUESTS._counts.firstSlice, 3);
  assert.ok(Q.filter((q) => !q.firstSlice).length >= 10 && Q.filter((q) => !q.firstSlice).length <= 15, '10 to 15 more');
});

check('every quest slot type, step verb and warmth is known; a quest has 1 to 3 steps', () => {
  for (const q of Q) {
    for (const [name, s] of Object.entries(q.slots)) assert.ok(QV.slotTypes.includes(s.type), `${q.id}: slot ${name} has unknown type ${s.type}`);
    assert.ok(q.steps.length >= 1 && q.steps.length <= 3, `${q.id}: ${q.steps.length} steps`);
    assert.equal(q.kind, q.steps.length === 1 ? 'errand' : 'chain', `${q.id}: kind`);
    for (const s of q.steps) assert.ok(QV.verbs.includes(s.verb), `${q.id}: verb ${s.verb}`);
    assert.ok(QV.warmth.includes(q.reward.warmth), `${q.id}: warmth`);
    assert.ok(Number.isInteger(q.cooldown.days) && q.cooldown.days >= 1, `${q.id}: cooldown`);
  }
});

check('every {slot} used in a quest (giver, steps, resolution, lines) is defined in its slots', () => {
  for (const q of Q) {
    const used = new Set([...slotRefs(q.giver)]);
    for (const s of q.steps) for (const k of ['what', 'where', 'to', 'returns']) for (const r of slotRefs(s[k])) used.add(r);
    for (const r of slotRefs(q.resolution.receiver)) used.add(r);
    for (const kind of ['offer', 'done']) for (const p of QV.personalities) for (const r of slotRefs(q.lines[kind][p])) used.add(r);
    for (const r of slotRefs(q.lines.fade)) used.add(r);
    for (const r of slotRefs(q.reward.rumour && q.reward.rumour.from)) used.add(r);
    for (const r of slotRefs(q.reward.gift && q.reward.gift.teller)) used.add(r);
    for (const r of used) assert.ok(q.slots[r], `${q.id}: {${r}} is used but not defined in slots`);
  }
});

check('quest lines: every offer and done line in all three personalities, and a gentle fade, each short', () => {
  for (const q of Q) {
    for (const kind of ['offer', 'done']) for (const p of QV.personalities) {
      const l = q.lines[kind][p]; assert.ok(typeof l === 'string' && l.length >= 8 && l.length <= 170, `${q.id}: ${kind}.${p} (${l && l.length})`);
    }
    assert.ok(q.lines.fade && q.lines.fade.length <= 120, `${q.id}: fade line`);
    assert.match(q.lines.fade, /^Never mind\./, `${q.id}: the fade is gentle`);
  }
});

check('every id in a quest exists: givers, slot choices, step targets, receivers, spawn places', () => {
  for (const q of Q) {
    if (q.giver === null) assert.ok(q.trigger && isThing(q.trigger.thing), `${q.id}: no giver needs a trigger thing`);
    else if (!q.giver.startsWith('{')) { assert.ok(isThing(q.giver), `${q.id}: giver ${q.giver}`); assert.ok((byId.get(q.giver).offers || []).includes('errand'), `${q.id}: ${q.giver} does not offer errands`); }
    for (const [name, s] of Object.entries(q.slots)) {
      for (const id of s.from || []) {
        if (s.type === 'regular') { assert.ok(isThing(id) && byId.get(id).category === 'people', `${q.id}.${name}: ${id} is not a person`); if (name === 'giver') assert.ok((byId.get(id).offers || []).includes('errand'), `${q.id}.${name}: ${id} does not offer errands`); }
        else if (s.type === 'item') assert.ok(isThing(id) && byId.get(id).category === 'drift', `${q.id}.${name}: ${id} is not a drift find`);
        else if (s.type === 'skerry' || s.type === 'place') assert.ok(knownIds.has(id), `${q.id}.${name}: unknown place ${id}`);
      }
      if (s.spawn) assert.ok(knownIds.has(s.spawn.place) && V.anchors.includes(s.spawn.anchor), `${q.id}.${name}: spawn`);
    }
    for (const st of q.steps) for (const k of ['what', 'where', 'to']) {
      const v = st[k]; if (!v || v.startsWith('{') ) continue;
      if (k === 'what') continue; // plain object labels
      assert.ok(isThing(v) || knownIds.has(v), `${q.id}: step ${st.verb} ${k} -> unknown id ${v}`);
    }
    const r = q.resolution.receiver; if (!r.startsWith('{')) assert.ok(isThing(r) || knownIds.has(r), `${q.id}: receiver ${r}`);
  }
});

check('quest rewards: gifts are real, never unique, in the stated tier; rumour givers have a rumour to tell', () => {
  const tellers = new Set(rums.flatMap((r) => r.tellers.filter((t) => t.thing).map((t) => t.thing)));
  for (const q of Q) {
    const g = q.reward.gift;
    if (g) {
      const ids = g.artifacts || g.pool; assert.ok(ids && ids.length, `${q.id}: gift`);
      for (const a of ids) { assert.ok(aById.has(a), `${q.id}: gift ${a}`); assert.notEqual(aById.get(a).tier, 'unique', `${q.id}: ${a} is unique`); if (g.tier) assert.equal(aById.get(a).tier, g.tier, `${q.id}: ${a} is not ${g.tier}`); }
      for (const k of ['teller', 'giver']) if (g[k] && !g[k].startsWith('{')) assert.ok(isThing(g[k]), `${q.id}: gift ${k} ${g[k]}`);
      if (g.giver) assert.ok(ids.every((a) => (aById.get(a).givenBy || []).includes(g.giver)), `${q.id}: the artifacts must say they are given by ${g.giver}`);
    }
    if (q.reward.rumour) {
      const from = q.reward.rumour.from;
      if (from.startsWith('{')) for (const c of q.slots[from.slice(1, -1)].from) assert.ok(tellers.has(c), `${q.id}: ${c} could be the rumour-giver but has no rumour`);
      else assert.ok(tellers.has(from), `${q.id}: rumour-giver ${from} has no rumour`);
    }
    assert.ok(q.reward.gift || q.reward.rumour || q.reward.knowledge || q.reward.nameGift, `${q.id}: a reward beyond warmth`);
  }
});

check('every quest is invented and says so; its lore seeds are real 1950 questSeeds', () => {
  for (const q of Q) {
    assert.equal(q.invented, true, `${q.id}: invented`);
    assert.ok(['grounded', 'invented'].includes(q.source.kind) && q.source.refs.length >= 1, `${q.id}: source`);
    assert.equal(q.source.kind, q.seeds.length ? 'grounded' : 'invented', `${q.id}: source kind follows the seeds`);
    for (const s of q.seeds) {
      const era = LORE.places[s.place].eras.find((e) => e.era === '1950');
      assert.ok(era && era.questSeeds[s.index], `${q.id}: no 1950 questSeed at ${s.place}[${s.index}]`);
    }
  }
});

check('every island-lore 1950 quest seed is used by a quest or listed with a reason', () => {
  const used = new Set(Q.flatMap((q) => q.seeds.map((s) => `${s.place}#questSeeds[${s.index}]`)));
  const missing = [];
  for (const [id, p] of Object.entries(LORE.places)) { const era = p.eras.find((e) => e.era === '1950'); if (!era) continue; (era.questSeeds || []).forEach((_, i) => { const k = `${id}#${i}`; if (!used.has(`${id}#questSeeds[${i}]`) && !QUESTS.notQuested[k]) missing.push(k); }); }
  assert.deepEqual(missing, [], 'add a quest, or an entry in notQuested with the reason');
  for (const k of Object.keys(QUESTS.notQuested)) { const [pl, i] = k.split('#'); assert.ok(!used.has(`${pl}#questSeeds[${i}]`), `${k} is listed as not quested but a quest uses it`); }
});

// =====================================================================================================================
// Artifacts
// =====================================================================================================================
const AV = ARTIFACTS._vocab;
const UNIQUE_NAMES = /lantern plate|second (log|book)|pinion|sea-chest key|tordenskj|treenail|chain link|copper ingot|ball bearing|iron ring|net-cast|purse|gear wheel|nameboard/i;

check('artifacts-1950.json parses with its header and counts; ids unique and well formed', () => {
  for (const k of ['_about', '_spec', '_invented', '_fields', '_vocab', '_counts', 'heldBack', 'templates']) assert.ok(ARTIFACTS[k], `missing ${k}`);
  assert.equal(ARTIFACTS._counts.total, arts.length); assert.equal(aById.size, arts.length, 'duplicate artifact ids');
  for (const a of arts) assert.match(a.id, /^artifact\.[a-z0-9-]+$/, a.id);
  assert.ok(arts.length >= 25);
});

check('NO uniques: no artifact has tier unique, none is flagged unique, and none is one of Felix\'s candidates', () => {
  for (const a of arts) {
    assert.ok(AV.tiers.includes(a.tier) && a.tier !== 'unique', `${a.id}: tier ${a.tier}`);
    assert.equal(a.unique, false, `${a.id}: unique flag`);
    assert.doesNotMatch(a.name, UNIQUE_NAMES, `${a.id}: "${a.name}" looks like a unique candidate`);
  }
  assert.ok(arts.some((a) => a.tier === 'common') && arts.some((a) => a.tier === 'uncommon') && arts.some((a) => a.tier === 'rare'), 'commons to rares');
});

check('every artifact is invented as an object and says so; its story is sourced or marked invented', () => {
  for (const a of arts) {
    assert.equal(a.invented, true, `${a.id}: invented`);
    assert.ok(['grounded', 'invented'].includes(a.source.kind) && a.source.refs.length >= 1, `${a.id}: source`);
    assert.ok(AV.storyKinds.includes(a.story.kind), `${a.id}: story kind`);
    assert.ok(a.story.text && a.story.text.length >= 20 && a.story.text.length <= 340, `${a.id}: story text length ${a.story.text && a.story.text.length}`);
    if (a.story.kind === 'sourced') { assert.ok(a.story.refs.length >= 1, `${a.id}: a sourced story needs refs`); assert.ok(['high', 'medium', 'low'].includes(a.story.confidence), `${a.id}: confidence`); }
    else { assert.deepEqual(a.story.refs, [], `${a.id}: an invented story has no refs`); assert.equal(a.story.confidence, 'none', `${a.id}: confidence`); }
    assert.match(a.drawing, /^[a-z0-9-]+$/, `${a.id}: drawing slug`);
    assert.ok(a.sellable && typeof a.sellable.later === 'boolean', `${a.id}: sellable`);
    assert.equal(a.sellable.later, a.tier === 'common', `${a.id}: only commons are sellable later`);
  }
});

check('every id in an artifact exists: foundVia, foundAt, givenBy, teller, leadsTo; each can actually be obtained', () => {
  for (const a of arts) {
    assert.ok((a.foundVia || []).length + (a.foundAt || []).length + (a.givenBy || []).length >= 1, `${a.id}: no way to get it`);
    for (const t of a.foundVia || []) assert.ok(isThing(t) && ['secret', 'drift'].includes(byId.get(t).category), `${a.id}: foundVia ${t}`);
    for (const p of a.foundAt || []) assert.ok(knownIds.has(p), `${a.id}: foundAt ${p}`);
    for (const t of a.givenBy || []) assert.ok(isThing(t) && byId.get(t).category === 'people', `${a.id}: givenBy ${t}`);
    if (a.teller) assert.ok(isThing(a.teller), `${a.id}: teller ${a.teller}`);
    if (a.leadsTo.quest) assert.ok(qById.has(a.leadsTo.quest), `${a.id}: leadsTo quest ${a.leadsTo.quest}`);
    assert.ok('quest' in a.leadsTo && 'hook' in a.leadsTo, `${a.id}: leadsTo shape`);
    if (a.tier === 'rare') assert.ok(a.leadsTo.quest || a.leadsTo.hook || a.teller, `${a.id}: a rare artifact leads somewhere or has a teller`);
  }
});

check('artifact lore links are real 1950 artifacts; every lore artifact is made or held back with a reason; the held-back list is pinned', () => {
  const have = new Set();
  for (const a of arts) if (a.lore) {
    const era = LORE.places[a.lore.place].eras.find((e) => e.era === '1950');
    assert.ok(era && era.artifacts[a.lore.index], `${a.id}: no 1950 artifact at ${a.lore.place}[${a.lore.index}]`);
    assert.equal(era.artifacts[a.lore.index].rarity, a.tier, `${a.id}: tier differs from the lore`);
    have.add(`${a.lore.place}#${a.lore.index}`);
  }
  const missing = [];
  for (const [id, p] of Object.entries(LORE.places)) { const era = p.eras.find((e) => e.era === '1950'); if (!era) continue; (era.artifacts || []).forEach((_, i) => { const k = `${id}#${i}`; if (!have.has(k) && !ARTIFACTS.heldBack[k]) missing.push(k); }); }
  assert.deepEqual(missing, [], 'make the artifact, or hold it back with a reason');
  assert.deepEqual(Object.keys(ARTIFACTS.heldBack).sort(), ['light:Gäven#0', 'light:Kråksundsgap Södra#0', 'light:Måseskär#1', 'relation/10239114#0', 'relation/10250201#0', 'village:Gullholmen#0'], 'the held-back set is pinned: change it on purpose');
  for (const k of Object.keys(ARTIFACTS.heldBack)) assert.ok(!have.has(k), `${k} is held back but an artifact uses it`);
});

// =====================================================================================================================
// Rumours
// =====================================================================================================================
const RV = RUMOURS._vocab;

check('rumours-1950.json parses with its header and counts; ids unique and well formed', () => {
  for (const k of ['_about', '_spec', '_invented', '_fields', '_vocab', '_counts', 'templates']) assert.ok(RUMOURS[k], `missing ${k}`);
  assert.equal(RUMOURS._counts.total, rums.length); assert.equal(rById.size, rums.length, 'duplicate rumour ids');
  for (const r of rums) assert.match(r.id, /^rumour\.[a-z0-9.-]+$/, r.id);
  assert.ok(rums.length >= 30);
});

check('every rumour target exists (a thing or a place) and the rumour is never empty', () => {
  for (const r of rums) {
    assert.ok(r.target.thing || r.target.place, `${r.id}: a rumour needs a target`);
    if (r.target.thing) assert.ok(isThing(r.target.thing), `${r.id}: target thing ${r.target.thing}`);
    if (r.target.place) assert.ok(knownIds.has(r.target.place), `${r.id}: target place ${r.target.place}`);
    assert.ok(typeof r.text === 'string' && r.text.trim().length >= 25 && r.text.length <= 260, `${r.id}: text length ${r.text && r.text.length}`);
    assert.ok(Number.isInteger(r.days) && r.days >= 1 && r.days <= 14, `${r.id}: days`);
  }
});

check('every rumour channel, teller and truth is valid; radio, notice-board and post rumours use their channel; people exist and tell rumours', () => {
  for (const r of rums) {
    assert.ok(RV.channels.includes(r.channel), `${r.id}: channel`); assert.ok(r.tellers.length >= 1, `${r.id}: tellers`);
    assert.ok(RV.truth.includes(r.truth), `${r.id}: truth`);
    if (r.truth === 'twist') assert.ok(r.twist && r.twist.length >= 15, `${r.id}: a twist says what is actually so`); else assert.equal(r.twist, undefined, `${r.id}: only a twist has a twist`);
    if (r.dynamic !== undefined) assert.equal(r.dynamic, 'weather', `${r.id}: dynamic`);
    for (const t of r.tellers) {
      if (r.channel === 'person') { assert.ok(t.thing && isThing(t.thing), `${r.id}: teller ${JSON.stringify(t)}`); assert.ok((byId.get(t.thing).offers || []).includes('rumour'), `${r.id}: ${t.thing} does not offer rumours`); }
      else { assert.equal(t.channel, r.channel, `${r.id}: teller channel`); if (r.channel !== 'radio') assert.ok(knownIds.has(t.at), `${r.id}: ${r.channel} at ${t.at}`); }
    }
    for (const [k, list] of Object.entries(r.when || {})) { assert.ok(V[k], `${r.id}: when.${k}`); for (const x of list) assert.ok(V[k].includes(x), `${r.id}: when.${k} ${x}`); }
  }
  for (const ch of ['radio', 'notice-board', 'post']) assert.ok(rums.some((r) => r.channel === ch), `no ${ch} rumour`);
  assert.ok(rums.some((r) => r.truth === 'true') && rums.some((r) => r.truth === 'twist'), 'mostly true, sometimes a twist');
  assert.ok(rums.filter((r) => r.truth === 'true').length > rums.filter((r) => r.truth === 'twist').length, 'mostly true');
});

check('every regular who offers a rumour has at least one to tell', () => {
  const told = new Set(rums.flatMap((r) => r.tellers.filter((t) => t.thing).map((t) => t.thing)));
  const none = T.filter((t) => t.category === 'people' && (t.offers || []).includes('rumour') && !t.storyOwned && !told.has(t.id)).map((t) => t.id);
  assert.deepEqual(none, [], 'these offer rumours but have none');
});

check('every rumour is invented and says so; its lore link is a real 1950 rumour; every lore rumour is covered', () => {
  for (const r of rums) {
    assert.equal(r.invented, true, `${r.id}: invented`);
    assert.ok(['grounded', 'invented'].includes(r.source.kind), `${r.id}: source kind`);
    assert.equal(r.source.kind, r.lore ? 'grounded' : 'invented', `${r.id}: source kind follows the lore link`);
    if (r.lore) { const era = LORE.places[r.lore.place].eras.find((e) => e.era === '1950'); assert.ok(era && era.rumours[r.lore.index], `${r.id}: no 1950 rumour at ${r.lore.place}[${r.lore.index}]`); }
  }
  const have = new Set(rums.filter((r) => r.lore).map((r) => `${r.lore.place}#${r.lore.index}`)), missing = [];
  for (const [id, p] of Object.entries(LORE.places)) { const era = p.eras.find((e) => e.era === '1950'); if (!era) continue; (era.rumours || []).forEach((_, i) => { if (!have.has(`${id}#${i}`)) missing.push(`${id}#${i}`); }); }
  assert.deepEqual(missing, [], 'every 1950 lore rumour becomes a record');
});

check('the files link as a set: every thing a quest, artifact or rumour names exists, and the secrets their rumours point at are real', () => {
  const secretsWithRumour = rums.filter((r) => r.target.thing && byId.get(r.target.thing).category === 'secret').length;
  assert.ok(secretsWithRumour >= 8, `rumours should lead players to secrets (${secretsWithRumour})`);
  const questGivers = new Set(Q.map((q) => q.giver).filter((g) => g && !g.startsWith('{')));
  for (const g of questGivers) assert.equal(byId.get(g).category, 'people');
  // nothing in any file mentions a unique as something you can obtain
  const all = JSON.stringify([Q, arts, rums]);
  assert.doesNotMatch(all, /"tier":\s*"unique"/);
});

console.log(`\n${passed} checks passed`);
