// node games/windward/src/audio.test.js — guards the sound (src/audio.js) without a browser: silent until the
// first tap, never throws if WebAudio is missing or broken, and each harbour kind has the sounds the brief names
// (village: bell + horn + gulls; natural harbour: bell + gulls).
import assert from 'node:assert/strict';
import { createAudio, MOMENT, BELL, HORN } from './audio.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

// A fake AudioContext that records what is played.
function fakeContext() {
  const log = { created: 0, oscillators: 0, resumed: 0 };
  class P { constructor() { this.value = 0; } setValueAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime() {} }
  const node = () => { const n = { connect: (x) => x, disconnect() {}, start() {}, stop() {}, gain: new P(), frequency: new P(), type: '' }; return n; };
  class Ctx {
    constructor() { log.created++; this.currentTime = 0; this.state = 'suspended'; this.destination = node(); }
    createGain() { return node(); }
    createOscillator() { log.oscillators++; return node(); }
    createBiquadFilter() { return node(); }
    resume() { log.resumed++; }
  }
  return { Ctx, log };
}

check('silent before the first tap: nothing is created or played', () => {
  const { Ctx, log } = fakeContext();
  const a = createAudio(Ctx);
  a.bell(); a.horn(); a.gull(); a.plop(); a.arrival('village');
  assert.equal(log.created, 0);
  assert.equal(log.oscillators, 0);
  assert.equal(a.unlocked, false);
});

check('the first gesture unlocks audio; later calls play', () => {
  const { Ctx, log } = fakeContext();
  const a = createAudio(Ctx);
  const handlers = {};
  const target = { addEventListener: (e, h) => (handlers[e] = h), removeEventListener: (e) => delete handlers[e] };
  a.armOnFirstGesture(target);
  assert.ok(handlers.pointerdown && handlers.touchstart && handlers.keydown, 'tap, touch and key are all listened for');
  handlers.touchstart();
  assert.equal(a.unlocked, true);
  assert.equal(log.created, 1);
  assert.equal(log.resumed, 1, 'a suspended context is resumed');
  assert.equal(Object.keys(handlers).length, 0, 'listeners removed after the first gesture');
  a.bell();
  assert.equal(log.oscillators, BELL.partials.length * BELL.strikes.length, 'two strikes of every partial');
});

check('a village arrival plays bell + horn + gulls; a natural harbour has no horn', () => {
  assert.deepEqual(MOMENT.village, { bell: true, horn: true, gulls: 3 });
  assert.equal(MOMENT.harbour.horn, false);
  assert.ok(MOMENT.harbour.bell && MOMENT.harbour.gulls >= 1);
  const { Ctx, log } = fakeContext();
  const a = createAudio(Ctx);
  a.unlock();
  a.arrival('village');
  const strikes = BELL.partials.length * BELL.strikes.length;
  assert.equal(log.oscillators, strikes + HORN.freqs.length + 3 * 2, 'bell partials + horn voices + 3 gulls (oscillator + vibrato each)');
});

check('missing or broken WebAudio never throws', () => {
  const none = createAudio(null);
  none.unlock(); none.bell(); none.arrival('village');
  assert.equal(none.unlocked, false);
  const Broken = class { constructor() { throw new Error('no audio device'); } };
  const b = createAudio(Broken);
  b.unlock(); b.bell(); b.gull();
  assert.equal(b.unlocked, false);
  class Throws { constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; } createGain() { return { gain: {}, connect: () => ({}) }; } createOscillator() { throw new Error('boom'); } }
  const c = createAudio(Throws);
  c.unlock();
  c.bell(); c.horn(); c.gull(); c.plop();
  assert.ok(true, 'a failing node is swallowed');
});

check('the pause hook: setMuted(true) drops new sounds and suspends the context; setMuted(false) brings sound back; safe before unlock', () => {
  const log = { suspended: 0, resumed: 0, oscillators: 0 };
  class P { constructor() { this.value = 0; } setValueAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime() {} }
  const node = () => ({ connect: (x) => x, disconnect() {}, start() {}, stop() {}, gain: new P(), frequency: new P(), type: '' });
  class Ctx {
    constructor() { this.currentTime = 0; this.state = 'running'; this.destination = node(); }
    createGain() { return node(); } createOscillator() { log.oscillators++; return node(); } createBiquadFilter() { return node(); }
    suspend() { log.suspended++; } resume() { log.resumed++; }
  }
  const early = createAudio(Ctx); early.setMuted(true); early.unlock(); early.bell();
  assert.equal(log.oscillators, 0, 'muted before the first tap: unlocking does not make noise');
  early.setMuted(false); early.bell(); assert.ok(log.oscillators > 0, 'unmuted: it plays');
  const a = createAudio(Ctx); a.unlock();
  const before = log.oscillators; a.setMuted(true);
  assert.equal(a.muted, true); assert.equal(log.suspended, 1);
  a.bell(); a.horn(); a.gull(); assert.equal(log.oscillators, before, 'nothing new plays while muted');
  a.setMuted(false); assert.equal(a.muted, false); assert.ok(log.resumed >= 1);
  a.bell(); assert.ok(log.oscillators > before);
});

console.log(`${passed} checks passed`);
