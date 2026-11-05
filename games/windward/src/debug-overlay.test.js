// node games/windward/src/debug-overlay.test.js — guards the overlay's frame arithmetic. The bug it
// pins down: a hidden tab / locked phone made "worst ever" read 193686 ms (the gap was counted as a frame).
import assert from 'node:assert/strict';
import { createFrameStats } from './debug-overlay.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}
function run(stats, from, count, dt = 1000 / 60) {
  let t = from;
  for (let i = 0; i < count; i++) { stats.frame(t); t += dt; }
  return t;
}

check('steady 60 fps reads 60 fps and a ~17 ms worst frame', () => {
  const s = createFrameStats();
  run(s, 1000, 400);
  const snap = s.snapshot();
  assert.ok(Math.abs(snap.fpsAvg1s - 60) < 1, `fps ${snap.fpsAvg1s}`);
  assert.ok(snap.worstMs1s < 20 && snap.worstEverMs < 20);
});

check('the first frame\'s own cost is reported separately and is not "worst ever"', () => {
  const s = createFrameStats();
  s.frame(3300);
  s.frame(3300 + 2100); // the first frame took 2.1 s (shader compile)
  run(s, 5400 + 16, 600);
  const snap = s.snapshot();
  assert.equal(Math.round(snap.firstCostMs), 2100);
  assert.ok(snap.worstEverMs < 20, `worst ever ${snap.worstEverMs}`);
});

check('a long gap with no interrupt IS counted (this is the bug)', () => {
  const s = createFrameStats();
  const t = run(s, 1000, 300);
  run(s, t + 193686, 5);
  assert.ok(s.snapshot().worstEverMs > 190000);
});

check('hidden tab / locked phone: interrupt() keeps the gap out of every number', () => {
  const s = createFrameStats();
  let t = run(s, 1000, 300);
  s.interrupt(); // visibilitychange -> hidden
  t += 193686; // the phone was locked for ~3 minutes
  t = run(s, t, 300);
  const snap = s.snapshot();
  assert.ok(snap.worstEverMs < 20, `worst ever ${snap.worstEverMs}`);
  assert.ok(snap.worstMs1s < 20);
  assert.ok(Math.abs(snap.fpsAvg1s - 60) < 2, `fps ${snap.fpsAvg1s}`);
});

check('real hitches are still counted after an interrupt', () => {
  const s = createFrameStats();
  let t = run(s, 1000, 300);
  s.interrupt();
  t = run(s, t + 5000, 100);
  s.frame(t + 250); // a genuine 250 ms hitch
  assert.ok(Math.abs(s.snapshot().worstEverMs - (250 - 0)) < 20, `worst ${s.snapshot().worstEverMs}`);
});

console.log(`${passed} checks passed`);
