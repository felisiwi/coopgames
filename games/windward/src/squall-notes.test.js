// node games/windward/src/squall-notes.test.js — what the player is told about a squall, and when (src/squall-notes.js).
import assert from 'node:assert/strict';
import { createSquallNotes, NOTES } from './squall-notes.js';
import { createGameWeather } from './game-weather.js';
import { createGameClock } from './game-clock.js';
import { squallAt } from './squall.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }
const sq = (o = {}) => ({ intensity: 0, cloud: 0, aheadM: null, index: 0, ...o });

check('nothing to say with no weather, or with no squall about', () => {
  const n = createSquallNotes();
  assert.deepEqual(n.step(null), []); assert.deepEqual(n.step(sq()), []); assert.deepEqual(n.step(sq({ cloud: 0.03, aheadM: 900 })), []);
});

check('the first warning is explained ONCE: what a squall is and what to do; later warnings of the same or another squall are quiet', () => {
  const n = createSquallNotes();
  const first = n.step(sq({ cloud: 0.2, aheadM: 540 }));
  assert.equal(first.length, 1); assert.equal(first[0].kind, 'explain'); assert.ok(/short, hard blow/.test(first[0].text) && /ease the sheet/.test(first[0].text));
  assert.deepEqual(n.step(sq({ cloud: 0.4, aheadM: 300 })), [], 'not again as it nears');
  assert.ok(first[0].seconds >= 5, 'long enough to read');
});

check('it hits: "Squall! Ease the sheet, or head up into the wind." once, at the moment its strength passes the mark', () => {
  const n = createSquallNotes(); n.step(sq({ cloud: 0.3, aheadM: 400 }));
  assert.deepEqual(n.step(sq({ cloud: 1, intensity: 0.2 })), [], 'building: not yet');
  const hit = n.step(sq({ cloud: 1, intensity: NOTES.HIT_AT + 0.01 }));
  assert.equal(hit.length, 1); assert.equal(hit[0].kind, 'hit'); assert.equal(hit[0].text, 'Squall! Ease the sheet, or head up into the wind.');
  assert.deepEqual(n.step(sq({ cloud: 1, intensity: 0.9 })), [], 'once');
});

check('it passes: "The squall has passed." once, only after a hit, when the wind and the cloud are gone', () => {
  const n = createSquallNotes();
  assert.deepEqual(n.step(sq({ intensity: 0, cloud: 0 })), [], 'nothing passes that never came');
  n.step(sq({ cloud: 1, intensity: 0.8 }));
  assert.deepEqual(n.step(sq({ cloud: 0.5, intensity: 0.1 })), [], 'still easing');
  const done = n.step(sq({ cloud: 0.05, intensity: 0.02 }));
  assert.equal(done.length, 1); assert.equal(done[0].kind, 'passed');
  assert.deepEqual(n.step(sq({ cloud: 0, intensity: 0 })), [], 'once');
});

check('a second squall gets its own "hit" and "passed" but no second explanation', () => {
  const n = createSquallNotes(); const kinds = [];
  const run = (s) => n.step(s).forEach((e) => kinds.push(e.kind));
  run(sq({ cloud: 0.3, aheadM: 400, index: 0 })); run(sq({ cloud: 1, intensity: 0.8, index: 0 })); run(sq({ cloud: 0, intensity: 0, index: -1 }));
  run(sq({ cloud: 0.3, aheadM: 400, index: 1 })); run(sq({ cloud: 1, intensity: 0.8, index: 1 })); run(sq({ cloud: 0, intensity: 0, index: -1 }));
  assert.deepEqual(kinds, ['explain', 'hit', 'passed', 'hit', 'passed']);
});

check('if a squall is already on us when the page starts (a loaded game), the player is told what to do, not "a squall is coming"', () => {
  const n = createSquallNotes(); const out = n.step(sq({ cloud: 1, intensity: 0.6 }));
  assert.deepEqual(out.map((e) => e.kind), ['hit']);
});

check('with the real ?squall=soon weather: one explanation at load, one hit about 60 s later, one "passed" after, in that order', () => {
  let t = 1_000_000; const clock = createGameClock(() => t);
  const w = createGameWeather({ seed: 4242, dayType: 'sea-breeze', squallSoon: true, heightAt: null, bounds: { minX: -1500, minZ: -1500, maxX: 1500, maxZ: 1500 }, center: { x: 0, z: 0 }, clock });
  const n = createSquallNotes(); const log = [];
  for (let s = 0; s < 200; s += 0.5) { t = 1_000_000 + s; w.update(); for (const e of n.step(squallAt(w.field.squallPlan, 0, 0, w.gt))) log.push([e.kind, s]); }
  assert.deepEqual(log.map((e) => e[0]), ['explain', 'hit', 'passed']);
  assert.ok(log[0][1] <= 1, 'the explanation is up at once');
  assert.ok(log[1][1] > 55 && log[1][1] < 75, `the hit comes ~60 s in (${log[1][1]} s)`);
  assert.ok(log[2][1] > log[1][1] + 15, `and it passes later (${log[2][1]} s)`);
});

console.log(`${passed} squall-notes checks passed`);
