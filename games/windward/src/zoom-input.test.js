// node games/windward/src/zoom-input.test.js — guards the pinch rule (src/zoom-input.js): two fingers landing together are a
// pinch (spread = zoom in); a second finger landing later is the sheet and never zooms.
import assert from 'node:assert/strict';
import { createPinchTracker, attachZoomInput, PINCH_WINDOW_MS } from './zoom-input.js';
import { wheelFactor } from './zoom.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }

check('two fingers down within 150 ms are a pinch; moving them apart zooms in, together zooms out', () => {
  const t = createPinchTracker();
  assert.equal(t.pointerDown(1, 100, 400, 1000), null);
  assert.equal(t.pointerDown(2, 200, 400, 1100), 'start');
  assert.equal(t.pinching, true);
  const f = t.pointerMove(2, 300, 400); // 100 px apart -> 200 px apart
  assert.ok(f < 1 && Math.abs(f - 0.5) < 1e-9, `factor ${f}: fingers spread, zoom in`);
  const g = t.pointerMove(2, 200, 400); // back together
  assert.ok(g > 1, 'fingers together: zoom out');
  assert.equal(t.pointerMove(2, 200, 400), null, 'no movement: nothing');
});

check('a second finger that lands later is the sheet, not a pinch (the phone controls keep working)', () => {
  const t = createPinchTracker();
  t.pointerDown(1, 100, 400, 1000);
  assert.equal(t.pointerDown(2, 250, 500, 1000 + PINCH_WINDOW_MS + 1), null);
  assert.equal(t.pinching, false);
  assert.equal(t.pointerMove(2, 300, 520), null, 'moving it never zooms');
  assert.equal(t.pointerMove(1, 90, 400), null);
});

check('a pinch ends when a finger lifts; a single finger never pinches; reset clears', () => {
  const t = createPinchTracker();
  t.pointerDown(1, 0, 0, 0); t.pointerDown(2, 100, 0, 50);
  assert.equal(t.pinching, true);
  t.pointerUp(1);
  assert.equal(t.pinching, false);
  assert.equal(t.pointerMove(2, 200, 0), null);
  t.pointerDown(3, 0, 0, 5000);
  assert.equal(t.pinching, false, 'a new finger long after: not a pinch');
  t.reset();
  assert.equal(t.pointerMove(3, 5, 5), null);
});

check('the DOM wiring: wheel and touch pinch call onZoom; a pinch tells the phone controls to let go; mouse pointers are ignored', () => {
  const listeners = {};
  const target = { addEventListener: (e, f) => { (listeners[e] ||= []).push(f); }, removeEventListener: (e, f) => { listeners[e] = (listeners[e] || []).filter((x) => x !== f); } };
  const zooms = [];
  let started = 0;
  const input = attachZoomInput({ target, onZoom: (f) => zooms.push(f), onPinchStart: () => started++, wheelFactor });
  let prevented = false;
  listeners.wheel[0]({ deltaY: 100, deltaMode: 0, preventDefault: () => { prevented = true; }, target: null });
  assert.ok(prevented && zooms[0] > 1, 'wheel down: zoom out, page does not scroll');
  listeners.wheel[0]({ deltaY: -100, deltaMode: 0, preventDefault() {}, target: null });
  assert.ok(zooms[1] < 1);
  const ev = (id, x, y, type = 'touch') => ({ pointerId: id, clientX: x, clientY: y, pointerType: type });
  listeners.pointerdown[0](ev(1, 100, 300, 'mouse'));
  listeners.pointerdown[0](ev(2, 200, 300, 'mouse'));
  assert.equal(started, 0, 'a mouse is never a pinch');
  listeners.pointerdown[0](ev(11, 100, 300)); listeners.pointerdown[0](ev(12, 200, 300));
  assert.equal(started, 1);
  listeners.pointermove[0](ev(12, 260, 300));
  assert.ok(zooms[2] < 1, 'spread: zoom in');
  listeners.pointerup[0](ev(11, 100, 300));
  input.destroy();
  assert.equal(listeners.wheel.length, 0);
});

console.log(`${passed} checks passed`);
