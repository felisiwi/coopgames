// node games/windward/src/task-1950.test.js: the 1950 job (src/task-1950.js): gas first, four lights, the keeper's post, then Britta; saved progress; and the 1950 copy.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTask1950, TASK1950_KEY } from './task-1950.js';
import { LIGHTS_1950, KEEPER_LIGHT, DEPOT_CARD, RELIGHT_STEPS, KEEPER_CARDS, REPORT_CARDS, KEEPER_NUDGE, FUTURE_CARD, NO_GAS_HINT, STORY_1950 } from './story-1950.js';
import { eraStorage } from './era-storage.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), keys: () => [...m.keys()] }; };
const L = (name, x, z) => ({ id: `light:${name}`, name, x, z });
const lights = [L('Hättan', 100, 0), L('Gäven', 200, 0), L('Stångholmen', 300, 0), L('Fredagsholmen', 400, 0), L('Måseskär', 0, 500), L('Islandsberg', 50, 50), L('Stångehuvud', 60, 60)];
const depot = { x: 0, z: -300 };
const make = (storage) => createTask1950({ lights, lightNames: LIGHTS_1950, keeperName: KEEPER_LIGHT, depot, storage });

check('the four lights are named, in the order the story tells them; Islandsberg and Stångehuvud are not part of the job', () => {
  assert.deepEqual(LIGHTS_1950, ['Hättan', 'Gäven', 'Stångholmen', 'Fredagsholmen']);
  const t = make(null);
  assert.deepEqual(t.ids.sort(), LIGHTS_1950.map((n) => `light:${n}`).sort());
  assert.equal(t.total, 4);
  assert.equal(t.isTaskLight('light:Islandsberg'), false);
  assert.equal(t.isTaskLight('light:Måseskär'), false, 'Måseskär is lit and manned: a delivery, not a relight');
});

check('without gas you cannot moor at a dark light; the hint says fetch the gas (and does not nag)', () => {
  const t = make(null);
  assert.equal(t.phase, 'gas');
  assert.equal(t.arrival(100, 10, 1), null, 'at Hättan, slow, but no gas');
  assert.equal(t.gasHint(100, 40, 10), true); assert.equal(t.gasHint(100, 40, 12), false, 'once per cooldown');
  assert.equal(t.gasHint(0, -300, 100), false, 'not near a dark light');
  assert.ok(/gas/i.test(NO_GAS_HINT) && /Lysekil/.test(NO_GAS_HINT));
});

check('the depot: close and slow loads the gas; too fast gives one hint; far away does nothing', () => {
  const t = make(null);
  assert.equal(t.depotArrival(0, 0, 1, 0), null, 'far from the quay');
  assert.equal(t.depotArrival(0, -290, 5, 100), 'hint');
  assert.equal(t.depotArrival(0, -290, 5, 101), null, 'the hint is rate-limited');
  assert.equal(t.depotArrival(0, -290, 1, 102), 'load');
  t.loadGas();
  assert.equal(t.hasGas, true); assert.equal(t.phase, 'lights'); assert.equal(t.tubes, 4);
  assert.equal(t.depotArrival(0, -290, 1, 200), null, 'no second load');
});

check('lights: each relit one uses a tube; the fourth moves the job on to the keeper, not to Britta', () => {
  const t = make(null); t.loadGas();
  assert.equal(t.arrival(100, 10, 1).id, 'light:Hättan');
  assert.equal(t.arrival(100, 10, 5), null, 'too fast');
  assert.equal(t.hint(100, 10, 5, 50) !== null, true);
  t.restore('light:Hättan'); assert.equal(t.tubes, 3); assert.equal(t.phase, 'lights');
  for (const n of ['Gäven', 'Stångholmen']) t.restore(`light:${n}`);
  assert.equal(t.phase, 'lights'); assert.equal(t.tubes, 1);
  t.restore('light:Fredagsholmen');
  assert.equal(t.phase, 'keeper'); assert.equal(t.tubes, 0); assert.equal(t.all, true);
  assert.equal(t.harbourEntry(true, 1, 0), null, 'Britta has to wait until the post is delivered');
});

check('the keeper: only after the lights; close and slow delivers; then Britta, harbour, done', () => {
  const t = make(null); t.loadGas();
  assert.equal(t.keeperArrival(0, 490, 1, 0), null, 'not before the lights');
  for (const n of LIGHTS_1950) t.restore(`light:${n}`);
  assert.equal(t.keeperArrival(0, 300, 1, 0), null, 'too far from Måseskär');
  assert.equal(t.keeperArrival(0, 490, 6, 10), 'hint');
  assert.equal(t.keeperArrival(0, 490, 1, 11), 'deliver');
  t.meetKeeper();
  assert.equal(t.keeperMet, true); assert.equal(t.phase, 'report');
  assert.equal(t.harbourEntry(false, 1, 0), null); assert.equal(t.harbourEntry(true, 1, 0), 'enter');
  t.finish(); assert.equal(t.done, true); assert.equal(t.phase, 'done'); assert.equal(t.progressText(), '');
});

check('progress is saved per era and read back; a 1950 save never touches the Today keys; reset clears it', () => {
  const base = memory(), s = eraStorage('1950', base);
  const t = make(s); t.loadGas(); for (const n of LIGHTS_1950) t.restore(`light:${n}`); t.meetKeeper();
  const again = make(s);
  assert.equal(again.hasGas, true); assert.equal(again.keeperMet, true); assert.equal(again.phase, 'report');
  assert.ok(base.keys().every((k) => k.endsWith('.1950')), `keys ${base.keys()}`);
  assert.ok(base.keys().includes(`${TASK1950_KEY}.1950`));
  again.reset(); assert.equal(make(s).phase, 'gas');
  const blocked = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
  assert.doesNotThrow(() => { const b = make(blocked); b.loadGas(); b.meetKeeper(); });
  // a keeper flag with the lights unfinished (a stale or hand-edited save) is ignored
  const odd = memory(); odd.setItem(TASK1950_KEY, JSON.stringify({ v: 1, gas: true, keeper: true }));
  assert.equal(make(odd).phase, 'lights');
});

check('the copy: short lines, no grandma, no real names for the keeper, the depot says what Felix said, invented lines are marked in the source', () => {
  const all = [DEPOT_CARD.lines, RELIGHT_STEPS.map((s) => s.text), ...KEEPER_CARDS.map((c) => c.lines), ...REPORT_CARDS.map((c) => c.lines), KEEPER_NUDGE.lines, FUTURE_CARD.lines].flat();
  for (const t of all) assert.ok(t.length <= 92, `too long for a phone card: ${t}`);
  const text = [...all, ...KEEPER_CARDS.map((c) => c.title), ...REPORT_CARDS.map((c) => c.title)].join('\n');
  assert.ok(!/grandma/i.test(text), 'no grandma in 1950');
  assert.ok(DEPOT_CARD.lines.some((l) => /gas from Erholmen, delivered to Lysekil/i.test(l)));
  assert.ok(/Måseskär/.test(KEEPER_CARDS[0].title) && KEEPER_CARDS.slice(1).every((c) => c.title === 'The keeper'), 'the keeper is "the keeper": unnamed');
  assert.ok(KEEPER_CARDS.some((c) => c.lines.some((l) => /glow out east/.test(l))), 'the line about the strange light');
  assert.ok(REPORT_CARDS.some((c) => c.lines.some((l) => /lights talk/.test(l))), '"the lights talk", said in person');
  assert.ok(REPORT_CARDS.some((c) => /Svalan/.test(c.title) && c.lines.some((l) => /freshly painted/.test(l))), 'Svalan relaunched, repaired, freshly painted');
  assert.ok(!/caulk/i.test(text), 'a clinker hull is not caulked');
  assert.ok(!/waiting for you since/i.test(text), 'no finale line');
  assert.ok(RELIGHT_STEPS.every((s, i) => i === 0 || s.at > RELIGHT_STEPS[i - 1].at) && RELIGHT_STEPS.at(-1).at < 6.6, 'steps in order, before the lamp catches (6.6 s)');
  assert.ok(RELIGHT_STEPS.some((s) => /valve/.test(s.text)) && RELIGHT_STEPS.some((s) => /pilot/.test(s.text)));
  const src = readFileSync(new URL('./story-1950.js', import.meta.url), 'utf8');
  assert.ok((src.match(/INVENTED-DIALOGUE/g) || []).length >= 6, 'the invented lines are marked in the source');
  assert.ok(!/Nilén|Danielsson|Lundberg|Wässing|Hermansson|Anker Andersson/.test(src), 'no real keeper or memoir name is used for the invented keeper');
  assert.deepEqual(Object.keys(STORY_1950).sort(), ['depot', 'find', 'keeper', 'keeperNudge', 'parts', 'report', 'yard']);
});

console.log(`\n${passed} checks passed`);
