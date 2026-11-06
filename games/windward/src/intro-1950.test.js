// node games/windward/src/intro-1950.test.js — stage 1e batch 2: the first minutes of the 1950 game. The words (src/story-1950.js), the opening scene's timeline and its
// shown-once flags (src/opening.js), where you wake (src/wake-plan.js, on the real 1950 coast) and the beach scene with Svalan, the two people and the haul
// (src/wake-scene.js). The pictures themselves (the SVG opening, the cards) are checked by looking at them, not here.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { OPENING_PLAN, OPENING_LINES, OPENING_FLASHES, OPENING_TOTAL_S, WAKE_CARDS, START_CARD_1950, STORY_1950 } from './story-1950.js';
import { REWIND } from './rewind.js';
import { phaseAt, flashLevel, shouldShowOpening, hasSeenOpening, markOpeningSeen, hasSeenIntro, markIntroSeen, resetIntro, OPENING_KEY, INTRO_KEY } from './opening.js';
import { eraStorage } from './era-storage.js';

globalThis.fetch = async (u) => { const b = readFileSync(fileURLToPath(u)); return { text: async () => b.toString('utf8'), json: async () => JSON.parse(b.toString('utf8')), arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
const { loadCoastForYear } = await import('./coast-for-year.js');
const { createWakeScene, WAKE_SCENE } = await import('./wake-scene.js');
const { WAKE, landConnectedTo } = await import('./wake-plan.js');

let passed = 0;
async function check(name, fn) { await fn(); passed += 1; console.log(`ok - ${name}`); }
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), keys: () => [...m.keys()] }; };

// ------------------------------------------------------------------------------------------------------------ the words
const allText = [...OPENING_LINES.map((l) => l.text), ...WAKE_CARDS.flatMap((c) => [c.title, ...c.lines, c.button]), START_CARD_1950.title, ...START_CARD_1950.lines, START_CARD_1950.go, START_CARD_1950.skip];

await check('the opening: dusk, fog, storm, the rewind, a hold at 1950, a last flash; the phases follow each other with no gap and the rewind lasts as long as src/rewind.js says', () => {
  assert.deepEqual(OPENING_PLAN.map((p) => p.id), ['dusk', 'fog', 'storm', 'rewind', 'hold', 'out']);
  let t = 0;
  for (const p of OPENING_PLAN) { assert.equal(p.at, t, `${p.id} starts where the last one ended`); t += p.dur; }
  assert.equal(t, OPENING_TOTAL_S);
  assert.ok(OPENING_TOTAL_S >= 35 && OPENING_TOTAL_S <= 50, `total ${OPENING_TOTAL_S} s`);
  assert.equal(OPENING_PLAN.find((p) => p.id === 'rewind').dur, REWIND.durationS, 'the plan and the rewind agree on its length');
  assert.equal(phaseAt(0).id, 'dusk'); assert.equal(phaseAt(9.99).id, 'dusk'); assert.equal(phaseAt(10).id, 'fog'); assert.equal(phaseAt(24).id, 'rewind');
  assert.equal(phaseAt(OPENING_TOTAL_S - 0.01).id, 'out'); assert.equal(phaseAt(OPENING_TOTAL_S), null); assert.equal(phaseAt(-1), null);
  assert.ok(Math.abs(phaseAt(27).u - 0.2) < 1e-9);
});

await check('two or three minimal lines, none during the rewind, no word about time travel; lightning only in the storm, with thunder after each flash', () => {
  assert.ok(OPENING_LINES.length >= 2 && OPENING_LINES.length <= 3, `${OPENING_LINES.length} lines`);
  const rewindAt = OPENING_PLAN.find((p) => p.id === 'rewind').at;
  for (const l of OPENING_LINES) { assert.ok(l.from < l.to && l.to <= rewindAt, `"${l.text}" is over before the rewind`); assert.ok(l.to - l.from >= 4, `"${l.text}" stays long enough to read`); }
  for (let i = 1; i < OPENING_LINES.length; i++) assert.ok(OPENING_LINES[i].from >= OPENING_LINES[i - 1].to, 'one line at a time');
  assert.ok(OPENING_LINES.some((l) => /Svalan/.test(l.text)), 'Svalan at the jetty');
  assert.ok(!/time|year|1950|travel|back/i.test(OPENING_LINES.map((l) => l.text).join(' ')), 'no explanation of time travel');
  const storm = OPENING_PLAN.find((p) => p.id === 'storm');
  for (const f of OPENING_FLASHES) { assert.ok(f.at >= storm.at && f.at < storm.at + storm.dur, `flash at ${f.at} is in the storm`); assert.ok(f.thunderAfter > 0 && f.thunderAfter < 3); }
  assert.ok(OPENING_FLASHES.length >= 3);
  assert.equal(flashLevel(10, OPENING_FLASHES), 0); assert.ok(flashLevel(OPENING_FLASHES[0].at + 0.06, OPENING_FLASHES) > 0.6, 'a flash is bright at its peak');
  assert.ok(flashLevel(OPENING_FLASHES[0].at + 0.5, OPENING_FLASHES) < flashLevel(OPENING_FLASHES[0].at + 0.1, OPENING_FLASHES), 'and fades');
  for (let x = 0; x < OPENING_TOTAL_S; x += 0.05) { const v = flashLevel(x, OPENING_FLASHES); assert.ok(v >= 0 && v <= 1); }
});

await check('the cards: Britta replaces the old storm card; no grandma, no finale line, short lines for a phone; the boy is not named', () => {
  assert.equal(START_CARD_1950.title, 'Britta');
  assert.ok(START_CARD_1950.lines.some((l) => /Britta/.test(l)), 'she introduces herself');
  assert.ok(START_CARD_1950.lines.some((l) => /eka/i.test(l)), 'the borrowed boat is the eka');
  assert.equal(WAKE_CARDS.length, 2);
  assert.ok(WAKE_CARDS[0].lines.some((l) => /Svalan/.test(l)) && WAKE_CARDS[1].lines.some((l) => /eka/i.test(l)), 'Svalan on the beach; the loan of the eka');
  assert.ok(WAKE_CARDS[1].title.toLowerCase().includes('boatbuilder'), 'young granddad is the boatbuilder’s son (design)');
  assert.equal(STORY_1950.start, START_CARD_1950); assert.equal(STORY_1950.wake, WAKE_CARDS);
  const text = allText.join(' \n ');
  assert.ok(!/grandma/i.test(text), 'Britta is not grandma yet');
  assert.ok(!/After the storm/.test(text), 'the old storm card is gone from 1950');
  assert.ok(!/waiting for you since/i.test(text), 'the finale line is kept for the finale');
  for (const t of allText) assert.ok(t.length <= 92, `too long for a phone card: ${t}`);
});

// ------------------------------------------------------------------------------------------------------------ flags
await check('shown once: only in the 1950 game, ?opening=0 never, ?opening=1 always; the flags are per era and survive blocked storage', () => {
  assert.equal(shouldShowOpening({ era: '1950', seen: false, param: null }), true);
  assert.equal(shouldShowOpening({ era: '1950', seen: true, param: null }), false);
  assert.equal(shouldShowOpening({ era: 'today', seen: false, param: null }), false, 'the Today game has no opening');
  assert.equal(shouldShowOpening({ era: '1950', seen: false, param: '0' }), false);
  assert.equal(shouldShowOpening({ era: '1950', seen: true, param: '1' }), true);
  const base = memory(), n1950 = eraStorage('1950', base), today = eraStorage('today', base);
  assert.equal(hasSeenOpening(n1950), false); markOpeningSeen(n1950); assert.equal(hasSeenOpening(n1950), true);
  assert.equal(hasSeenIntro(n1950), false); markIntroSeen(n1950); assert.equal(hasSeenIntro(n1950), true);
  assert.equal(hasSeenOpening(today), false, 'the Today save does not know the 1950 opening');
  assert.deepEqual(base.keys().sort(), [`${INTRO_KEY}.1950`, `${OPENING_KEY}.1950`]);
  resetIntro(n1950); assert.deepEqual(base.keys(), [], '?lights=reset forgets the intro too');
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  assert.doesNotThrow(() => { hasSeenOpening(blocked); markOpeningSeen(blocked); markIntroSeen(blocked); resetIntro(blocked); hasSeenIntro(null); markIntroSeen(null); });
});

// ------------------------------------------------------------------------------------------------------------ the beach
const io = { json: async (u) => JSON.parse(readFileSync(fileURLToPath(u), 'utf8')), bytes: async (u) => new Uint8Array(readFileSync(fileURLToPath(u))) };
const coasts = {};
for (const seed of [1, 2, 3]) coasts[seed] = await loadCoastForYear(1950, { seed, io });
const first = coasts[1];

await check('you wake on a real beach with open water off it, placed so Svalan is on the phone screen at the start (below the boat), for several seeds', () => {
  for (const [seed, c] of Object.entries(coasts)) {
    const w = c.wake;
    assert.ok(w, `seed ${seed}: a beach was found`);
    const h = c.heightAt;
    assert.ok(w.beach.y >= WAKE.beachHeightM[0] && w.beach.y <= WAKE.beachHeightM[1], `seed ${seed}: beach height ${w.beach.y}`);
    assert.ok(h(w.spawn.x, w.spawn.z) < -3, `seed ${seed}: the start is in open water`);
    const sx = w.beach.x - w.spawn.x, sz = w.beach.z - w.spawn.z; // the beach as seen from the boat: dz > 0 is south = lower on the screen
    assert.ok(Math.abs(sx) <= WAKE.screenDxM + WAKE.maxViolationM && sz >= WAKE.screenDzM[0] - WAKE.maxViolationM && sz <= WAKE.screenDzM[1] + WAKE.maxViolationM, `seed ${seed}: the beach is at (${sx.toFixed(0)}, ${sz.toFixed(0)}) m from the boat: off the phone screen`);
    assert.ok(Math.abs(sx) <= 24 && sz >= 6 && sz <= 48, `seed ${seed}: on the screen at all (about +-25 m sideways)`);
    assert.deepEqual([c.spawn.x, c.spawn.z], [w.spawn.x, w.spawn.z], 'the game starts where the plan says');
    // the water runs from the shore out to the start: no land between the first few metres off the beach and the start
    const dx = w.spawn.x - w.beach.x, dz = w.spawn.z - w.beach.z, L = Math.hypot(dx, dz);
    let blocked = 0; for (let d = 12; d < L; d += 4) if (h(w.beach.x + (dx / L) * d, w.beach.z + (dz / L) * d) > 0.3) blocked++;
    assert.ok(blocked <= 2, `seed ${seed}: land in the way (${blocked} samples)`);
    // on Skaftö's own shore (joined to Grundsund's ground), within reach of Grundsund or Fiskebäckskil: never a skerry
    const vill = ['village:Grundsund', 'village:Fiskebäckskil'].map((id) => c.names.find((n) => n.id === id));
    const main = landConnectedTo({ heightAt: h, from: vill[0] });
    assert.ok(main(w.beach.x, w.beach.z), `seed ${seed}: the wreck is on Skaftö's mainland shore`);
    assert.ok(vill.some((v) => Math.hypot(v.x - w.beach.x, v.z - w.beach.z) < 400), `seed ${seed}: near a village where a boatbuilder could work`);
    for (const who of ['boatbuilder', 'britta']) assert.ok(Math.hypot(w.figures[who].x - w.beach.x, w.figures[who].z - w.beach.z) < 9, `${who} stands by Svalan`);
  }
});

await check('the mainland test is meaningful: Fiskebäckskil is on it, Måseskär\'s rock and a far island are not', () => {
  const c = first, g = c.names.find((n) => n.id === 'village:Grundsund'), f = c.names.find((n) => n.id === 'village:Fiskebäckskil');
  const main = landConnectedTo({ heightAt: c.heightAt, from: g });
  assert.equal(main(f.x, f.z), true, 'Fiskebäckskil is on Skaftö');
  assert.equal(main(2819, 9517), false, 'Måseskär is not');
  assert.equal(landConnectedTo({ heightAt: () => -5, from: g })(g.x, g.z), false, 'all water: nothing is mainland');
});

await check('the beach is the same for both players (same seed, same place) and Today has none', async () => {
  const again = await loadCoastForYear(1950, { seed: 1, io });
  assert.deepEqual(again.wake.beach, first.wake.beach); assert.deepEqual(again.spawn, first.spawn);
  const today = await loadCoastForYear(2015, { seed: 1, io });
  assert.equal(today.wake ?? null, null);
});

await check('the wake scene: Svalan wrecked (mast gone), a cradle, the boatbuilder’s son and Britta; the haul rolls her upright onto the cradle, once', () => {
  const sc = createWakeScene({ plan: first.wake, heightAt: first.heightAt });
  const names = []; sc.group.traverse((o) => o.name && names.push(o.name));
  for (const n of ['svalan-wrecked', 'cradle', 'boatbuilders-son', 'britta']) assert.ok(names.includes(n), n);
  assert.equal(sc.svalan.group.getObjectByName('rig').visible, false, 'her mast and sails are gone');
  assert.ok(Math.abs(sc.svalan.group.rotation.z - WAKE_SCENE.rollRad) < 1e-6, 'lying on her side');
  assert.ok(sc.cradle.scale.x < 0.01, 'no cradle yet');
  sc.update(1, 1); assert.ok(Math.abs(sc.svalan.group.rotation.z - WAKE_SCENE.rollRad) < 1e-6, 'she does not move until she is hauled');
  assert.equal(sc.hauled, false);
  sc.haul(); sc.haul(); assert.equal(sc.hauling, true);
  sc.update(WAKE_SCENE.haulS / 2, 2);
  const mid = sc.svalan.group.rotation.z; assert.ok(mid > 0.05 && mid < WAKE_SCENE.rollRad - 0.05, `mid-haul roll ${mid}`);
  sc.update(WAKE_SCENE.haulS, 3);
  assert.equal(sc.hauled, true); assert.ok(Math.abs(sc.svalan.group.rotation.z) < 1e-6, 'upright'); assert.ok(Math.abs(sc.cradle.scale.x - 1) < 1e-6, 'on her cradle');
  const settled = createWakeScene({ plan: first.wake, heightAt: first.heightAt }); settled.settle();
  assert.equal(settled.hauled, true); assert.ok(Math.abs(settled.svalan.group.rotation.z) < 1e-6, 'a reload after the intro shows her already hauled');
  assert.equal(sc.relaunched, false); sc.relaunch();
  assert.equal(sc.relaunched, true); assert.equal(sc.svalan.group.visible, false, 'relaunched: Svalan has left the cradle (she is the boat you sail)');
  assert.ok(sc.cradle.visible !== false && sc.boatbuilder.visible && sc.britta.visible, 'the empty cradle and the two people stay');
  let tris = 0; sc.group.traverse((o) => { if (o.isMesh) tris += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; });
  assert.ok(tris < 12000, `the beach scene is light: ${Math.round(tris)} triangles`);
});

console.log(`\n${passed} checks passed`);
