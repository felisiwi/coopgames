// node games/windward/src/beats-1950.test.js: the first story beats of 1950 (src/beats-1950.js): find -> errand -> return -> free, with arrivals, saves per era and the tag's goal.
import assert from 'node:assert/strict';
import { createBeats, BEATS_KEY, PHASES, ARRIVE_M } from './beats-1950.js';
import { eraStorage } from './era-storage.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), keys: () => [...m.keys()] }; };
const G = { id: 'harbour:Grundsunds hamn', x: 100, z: 500 }, Y = { id: 'yard:boatbuilder', x: -50, z: 20 };
const make = (st = null) => createBeats({ storage: st, grundsund: G, yard: Y });

check('the order: find, errand, return, free; advance moves one step and stops at free', () => {
  assert.deepEqual(PHASES, ['find', 'errand', 'return', 'free']);
  const b = make(); assert.equal(b.phase, 'find'); assert.equal(b.done, false);
  assert.equal(b.advance(), 'errand'); assert.equal(b.advance(), 'return'); assert.equal(b.advance(), 'free');
  assert.equal(b.advance(), 'free', 'stays free'); assert.equal(b.done, true);
});

check('the errand: only at Grundsund, only in the errand; close and slow arrives, too fast hints once; the yard only after the parts', () => {
  const b = make();
  assert.equal(b.errandArrival(G.x, G.z, 0, 0), null, 'not before the boy has spoken (phase find)');
  b.advance();
  assert.equal(b.errandArrival(G.x + ARRIVE_M + 5, G.z, 0, 0), null, 'too far');
  assert.equal(b.errandArrival(G.x + 10, G.z, 6, 100), 'hint'); assert.equal(b.errandArrival(G.x + 10, G.z, 6, 101), null, 'the hint is rate-limited');
  assert.equal(b.returnArrival(Y.x, Y.z, 0, 200), null, 'the yard does not count in the errand');
  assert.equal(b.errandArrival(G.x + 10, G.z, 1, 200), 'arrive');
  b.advance();
  assert.equal(b.errandArrival(G.x, G.z, 0, 300), null, 'the parts are only taken once');
  assert.equal(b.returnArrival(Y.x + 5, Y.z, 1, 300), 'arrive');
  b.advance(); assert.equal(b.returnArrival(Y.x, Y.z, 0, 400), null);
});

check('the Navigate tag points at Grundsund in the errand and at the yard on the way back, and nowhere else', () => {
  const b = make(); assert.equal(b.goal(), null); b.advance(); assert.equal(b.goal(), G); b.advance(); assert.equal(b.goal(), Y); b.advance(); assert.equal(b.goal(), null);
});

check('saved per era and read back; reset goes back to the start; blocked or broken storage is safe', () => {
  const base = memory(), s = eraStorage('1950', base);
  const b = make(s); b.advance(); b.advance();
  assert.equal(make(s).phase, 'return');
  assert.deepEqual(base.keys(), [`${BEATS_KEY}.1950`], 'only the 1950 key');
  assert.equal(make(eraStorage('today', memory())).phase, 'find', 'another save does not see it');
  b.reset(); assert.equal(make(s).phase, 'find');
  const blocked = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.doesNotThrow(() => { const c = make(blocked); c.advance(); });
  const junk = memory(); junk.setItem(BEATS_KEY, '{nope'); assert.equal(make(junk).phase, 'find');
  const odd = memory(); odd.setItem(BEATS_KEY, JSON.stringify({ v: 1, phase: 'nonsense' })); assert.equal(make(odd).phase, 'find');
});

console.log(`\n${passed} checks passed`);
