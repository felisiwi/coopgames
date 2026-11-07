// node games/windward/src/pause.test.js: pause when hidden, resume on tap (src/pause.js); solo freezes the shared clock, co-op does not.
import assert from 'node:assert/strict';
import { createGameClock } from './game-clock.js';
import { createPause, pauseFreezesClock } from './pause.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }

function rig({ peer = false } = {}) {
  let t = 5000;
  const wall = () => t;
  const clock = createGameClock(wall);
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const win = new EventTarget();
  const log = [];
  const state = { peer };
  const p = createPause({ clock, hasPeer: () => state.peer, doc, win, showCard: () => log.push('show'), hideCard: () => log.push('hide'), onPause: () => log.push('pause'), onResume: () => log.push('resume') });
  const hide = () => { doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange')); };
  const show = () => { doc.visibilityState = 'visible'; doc.dispatchEvent(new Event('visibilitychange')); };
  return { clock, p, log, hide, show, win, advance: (s) => { t += s; }, state, wall };
}

check('the policy: solo freezes the shared clock, a connected friend does not', () => {
  assert.equal(pauseFreezesClock(false), true);
  assert.equal(pauseFreezesClock(true), false);
});

check('SOLO: hidden -> card + frozen clock; coming back does NOT resume; the tap does, and the clock advanced by 0', () => {
  const r = rig();
  const before = r.clock.now();
  r.hide(); assert.equal(r.p.paused, true); assert.deepEqual(r.log, ['show', 'pause']);
  r.advance(120);
  r.show(); assert.equal(r.p.paused, true, 'visible again is not enough: it waits for the tap');
  r.advance(30);
  assert.equal(r.clock.now(), before, 'traffic / ferry / wind clock still frozen under the card');
  r.p.resume(); assert.equal(r.p.paused, false); assert.deepEqual(r.log, ['show', 'pause', 'hide', 'resume']);
  assert.equal(r.clock.now(), before, 'the whole absence is not counted');
  r.advance(4); assert.equal(r.clock.now(), before + 4);
});

check('CO-OP: with a friend connected the card shows and the boat is held (onPause) but the clock keeps running on wall time', () => {
  const r = rig({ peer: true });
  const before = r.clock.now();
  r.hide(); assert.deepEqual(r.log, ['show', 'pause']); assert.equal(r.clock.frozen, false);
  r.advance(90); assert.equal(r.clock.now(), before + 90, 'the shared clock did not freeze');
  r.p.resume(); assert.equal(r.clock.now(), before + 90); assert.equal(r.clock.offset, 0, 'still in step with the friend');
});

check('the freeze decision is taken when the pause STARTS (a friend leaving later does not strand the clock)', () => {
  const r = rig({ peer: true });
  r.hide(); r.state.peer = false; r.advance(10); r.p.resume();
  assert.equal(r.clock.frozen, false); assert.equal(r.clock.offset, 0);
  const s = rig(); const b = s.clock.now(); s.hide(); s.state.peer = true; s.advance(10); s.p.resume();
  assert.equal(s.clock.now(), b, 'a solo freeze is always given back correctly, even if a friend joined meanwhile');
});

check('pagehide pauses too; repeated hidden events do not stack; resume while running does nothing', () => {
  const r = rig();
  r.p.resume(); assert.deepEqual(r.log, []);
  r.win.dispatchEvent(new Event('pagehide')); r.hide(); r.hide();
  assert.deepEqual(r.log, ['show', 'pause'], 'one pause');
  r.p.resume(); r.p.resume(); assert.deepEqual(r.log, ['show', 'pause', 'hide', 'resume']);
});

check('a friend joining after a solo pause: the clock rejoins the wall clock (no lasting offset between the two phones)', () => {
  const r = rig();
  r.hide(); r.advance(300); r.p.resume();
  assert.equal(r.clock.offset, 300, 'solo: behind by the time away');
  r.p.peerJoined(); assert.equal(r.clock.offset, 0); assert.equal(r.clock.now(), r.wall());
  // joining WHILE the card is up (clock frozen): it unfreezes to wall time and the later tap leaves it alone
  const s = rig(); s.hide(); s.advance(50); s.p.peerJoined(); assert.equal(s.clock.frozen, false); s.advance(5); s.p.resume();
  assert.equal(s.clock.offset, 0);
});

check('destroy removes the listeners', () => {
  const r = rig(); r.p.destroy(); r.hide(); r.win.dispatchEvent(new Event('pagehide'));
  assert.equal(r.p.paused, false); assert.deepEqual(r.log, []);
});

console.log(`\n${passed} checks passed`);
