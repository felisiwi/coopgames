// node games/windward/src/game-clock.test.js: the game clock (src/game-clock.js): wall time minus paused time.
import assert from 'node:assert/strict';
import { createGameClock } from './game-clock.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }
const fake = (start = 1000) => { let t = start; return { wall: () => t, advance: (s) => { t += s; } }; };

check('running, it follows the wall clock', () => {
  const w = fake(); const c = createGameClock(w.wall);
  const a = c.now(); w.advance(7); assert.equal(c.now() - a, 7);
});

check('pausing for N seconds then resuming advances the clock by 0', () => {
  const w = fake(); const c = createGameClock(w.wall);
  const before = c.now();
  c.pause(); w.advance(300); assert.equal(c.now(), before, 'frozen while paused'); assert.equal(c.frozen, true);
  c.resume(); assert.equal(c.now(), before, 'resuming gives nothing back'); assert.equal(c.frozen, false);
  w.advance(2); assert.equal(c.now(), before + 2, 'and it runs normally afterwards');
});

check('several pauses add up; a second pause() while paused changes nothing; resume() while running changes nothing', () => {
  const w = fake(); const c = createGameClock(w.wall); const t0 = c.now();
  c.resume(); w.advance(1);
  c.pause(); w.advance(10); c.pause(); w.advance(10); c.resume();
  w.advance(3); c.pause(); w.advance(50); c.resume(); w.advance(1);
  assert.equal(c.now() - t0, 1 + 3 + 1, 'only the running seconds count');
  assert.equal(c.offset, 70);
});

check('resync rejoins the wall clock (frozen or not)', () => {
  const w = fake(); const c = createGameClock(w.wall);
  c.pause(); w.advance(40); c.resume(); w.advance(5);
  assert.equal(c.offset, 40); c.resync(); assert.equal(c.offset, 0); assert.equal(c.now(), w.wall());
  c.pause(); w.advance(9); c.resync(); assert.equal(c.frozen, false); assert.equal(c.now(), w.wall());
});

check('the default wall clock is Date.now() in seconds', () => {
  const c = createGameClock(); assert.ok(Math.abs(c.now() - Date.now() / 1000) < 0.05);
});

console.log(`\n${passed} checks passed`);
