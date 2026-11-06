// node games/windward/src/lighthouse-task.test.js: the first task (src/lighthouse-task.js), its timeline (src/relight.js), the fog reveal,
// the camera yaw and the calm sound cue.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { CONFIG } from './config.js';
import { RELIGHT, relightFrame, igniteTime, relightDuration, REVEAL_RADIUS_M } from './relight.js';
import { createLighthouseTask, pickTaskLights, TASK_KEY, TASK_COUNT, MOOR_M, MOOR_MAX_SPEED, HINT_COOLDOWN_S, GRANDMA_ID, START_KEY, hasSeenStart, markStartSeen, resetStart, HARBOUR_ENTRY_MAX_SPEED, REWARD_DELAY_S } from './lighthouse-task.js';
import { START_CARD, END_CARD, REPORT_CARD } from './task-ui.js';
import { createExplored } from './explored.js';
import { fixedDirectionForYaw, updateFixedCamera } from './camera.js';
import { createAudio, RELIGHT_SOUND } from './audio.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m }; };
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

// eight lights east of a spawn at the origin, 300 m apart (so one is never within moor range of the next)
const lights = Array.from({ length: 8 }, (_, i) => ({ id: `light:L${i}`, name: `L${i}`, x: (i + 1) * 300, z: 0 })).reverse();
const L0 = lights.find((l) => l.name === 'L0').x;
const L7 = lights.find((l) => l.name === 'L7').x;
const spawn = { x: 0, z: 0 };

check('the five lighthouses nearest the start are the dark ones, nearest first, whatever order the list comes in', () => {
  const p = pickTaskLights(lights, spawn);
  assert.deepEqual(p.map((l) => l.name), ['L0', 'L1', 'L2', 'L3', 'L4']);
  assert.equal(p.length, TASK_COUNT);
  assert.equal(pickTaskLights(lights.slice(0, 3), spawn).length, 3, 'fewer lights than five: all of them');
});

check('the timeline: glide, one slow circle, the light comes on MID-circle, the fog lifts after, then a rest, then done', () => {
  const ti = igniteTime();
  near(ti, RELIGHT.glideS + RELIGHT.circleS / 2);
  assert.equal(relightFrame(0).phase, 'glide');
  assert.equal(relightFrame(RELIGHT.glideS + 1).phase, 'circle');
  assert.equal(relightFrame(RELIGHT.glideS + RELIGHT.circleS + 0.1).phase, 'hold');
  assert.equal(relightFrame(relightDuration() + 0.01).phase, 'done');
  assert.equal(relightFrame(relightDuration() + 0.01).done, true);
  // the light is off before, on after; the lamp warms up smoothly
  assert.equal(relightFrame(ti - 0.01).ignited, false);
  assert.equal(relightFrame(ti + 0.01).ignited, true);
  assert.equal(relightFrame(ti - 0.01).lamp, 0);
  assert.ok(relightFrame(ti + 0.5).lamp > 0 && relightFrame(ti + 0.5).lamp < 1);
  assert.equal(relightFrame(ti + RELIGHT.rampS + 0.1).lamp, 1);
  // the fog starts after the light is on, and ends at the full radius
  assert.equal(relightFrame(ti + 0.2).revealFrac, 0);
  assert.ok(relightFrame(ti + RELIGHT.revealDelayS + 1).revealFrac > 0);
  assert.equal(relightFrame(ti + RELIGHT.revealDelayS + RELIGHT.revealS + 0.1).revealFrac, 1);
  assert.ok(ti + RELIGHT.revealDelayS + RELIGHT.revealS < relightDuration(), 'the fog has finished lifting before the camera leaves');
  assert.ok(REVEAL_RADIUS_M >= 300, 'a wide circle');
});

check('the camera turns once, slowly and smoothly (never backwards), and ends exactly where it started (north-up)', () => {
  let prev = 0;
  for (let t = 0; t <= relightDuration(); t += 0.05) {
    const y = relightFrame(t).yaw;
    assert.ok(y >= prev - 1e-12, `yaw only increases (${t})`);
    assert.ok(y - prev < 0.12, `slow: ${(y - prev).toFixed(3)} rad per 50 ms`);
    prev = y;
  }
  assert.equal(relightFrame(0).yaw, 0);
  near(relightFrame(relightDuration()).yaw, 2 * Math.PI, 1e-9);
  near(Math.sin(relightFrame(relightDuration()).yaw), 0, 1e-9);
});

check('moor: close enough AND slow, only at a dark task light; a restored one or a far one does not count', () => {
  const t = createLighthouseTask({ lights, spawn, storage: memory() });
  assert.equal(t.arrival(L0 + MOOR_M - 1, 0, 1).id, 'light:L0');
  assert.equal(t.arrival(L0 + MOOR_M + 5, 0, 1), null, 'too far');
  assert.equal(t.arrival(L0, 0, MOOR_MAX_SPEED + 0.5), null, 'too fast');
  assert.equal(t.arrival(L7, 0, 0), null, 'not one of the five');
  t.restore('light:L0');
  assert.equal(t.arrival(L0, 0, 0), null, 'already lit');
});

check('a hint (at most every 25 s) when close to a dark light but going too fast to moor', () => {
  const t = createLighthouseTask({ lights, spawn, storage: memory() });
  assert.equal(t.hint(L0 + 100, 0, 5, 10).id, 'light:L0');
  assert.equal(t.hint(L0 + 100, 0, 5, 20), null, 'not again so soon');
  assert.equal(t.hint(L0 + 100, 0, 5, 10 + HINT_COOLDOWN_S + 1).id, 'light:L0');
  assert.equal(t.hint(L0 + 100, 0, 1, 99), null, 'slow enough: the moor takes it, not a hint');
  assert.equal(t.hint(L0 + MOOR_M - 5, 0, 6, 999).id, 'light:L0', 'too fast INSIDE the moor distance is when the hint is needed');
  assert.equal(t.hint(50000, 0, 5, 200), null, 'far away');
});

check('progress: lights 2/5, saved on the device, restored on reload; after the fifth the goal is grandma, then it is done', () => {
  const store = memory();
  let t = createLighthouseTask({ lights, spawn, storage: store });
  assert.equal(t.phase, 'lights');
  assert.equal(t.progressText(), 'lights 0/5');
  assert.deepEqual(t.restore('light:L0'), { count: 1, all: false, already: false });
  assert.equal(t.restore('light:L1').count, 2);
  assert.equal(t.progressText(), 'lights 2/5');
  assert.equal(t.restore('light:L1').already, true, 'twice is harmless');
  assert.equal(t.restore('light:L7'), null, 'not a task light');
  t = createLighthouseTask({ lights, spawn, storage: store }); // a reload
  assert.equal(t.restoredCount, 2);
  assert.equal(t.isDark('light:L0'), false); assert.equal(t.isDark('light:L2'), true); assert.equal(t.isDark('light:L7'), false);
  for (const id of ['light:L2', 'light:L3']) t.restore(id);
  assert.equal(t.phase, 'lights');
  const last = t.restore('light:L4');
  assert.equal(last.all, true);
  assert.equal(t.phase, 'report');
  assert.equal(t.progressText(), 'report to grandma');
  assert.equal(GRANDMA_ID, 'village:Fiskebäckskil');
  t.finish();
  assert.equal(t.phase, 'done'); assert.equal(t.progressText(), '');
  t = createLighthouseTask({ lights, spawn, storage: store });
  assert.equal(t.phase, 'done', 'done is remembered');
  t.reset();
  assert.equal(t.phase, 'lights'); assert.equal(t.restoredCount, 0);
});

check('finish() before the lights are all lit does nothing; junk or blocked storage starts fresh and never throws', () => {
  const store = memory();
  const t = createLighthouseTask({ lights, spawn, storage: store });
  t.finish();
  assert.equal(t.done, false);
  store.setItem(TASK_KEY, '{"restored":["light:L0","light:nope"],"done":true}');
  const u = createLighthouseTask({ lights, spawn, storage: store });
  assert.equal(u.restoredCount, 1, 'only real task lights are kept');
  assert.equal(u.done, false, 'done needs all five');
  store.setItem(TASK_KEY, 'nope');
  assert.equal(createLighthouseTask({ lights, spawn, storage: store }).restoredCount, 0);
  assert.doesNotThrow(() => createLighthouseTask({ lights, spawn, storage: { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } } }).restore('light:L0'));
});

check('fog reveal: a disc of any radius, counts only new cells, stays inside the grid, and saves', () => {
  const rect = { x0: 0, z0: 0, x1: 2400, z1: 2400 };
  const ex = createExplored(rect, { storage: memory() });
  const v0 = ex.version;
  const n = ex.reveal(1200, 1200, 600);
  assert.ok(n > 1500 && n < 2200, `${n} cells in a 600 m disc of 24 m cells`);
  assert.ok(ex.version > v0);
  assert.equal(ex.isExplored(1200 + 500, 1200), true);
  assert.equal(ex.isExplored(1200 + 700, 1200), false);
  assert.equal(ex.reveal(1200, 1200, 600), 0, 'again: nothing new');
  assert.ok(ex.reveal(1200, 1200, 800) > 0, 'a bigger disc adds a ring');
  assert.doesNotThrow(() => ex.reveal(-5000, -5000, 600), 'far outside the grid');
  assert.equal(ex.save(true), true);
});

check('camera yaw: turning round the target keeps the distance and elevation; yaw 0 is the old north-up view; a half turn is the far side', () => {
  const d0 = fixedDirectionForYaw(0).clone();
  assert.ok(Math.abs(d0.x) < 1e-9 || CONFIG.FIXED_CAMERA_AZIMUTH_DEG !== 0);
  const target = new THREE.Vector3(100, 0, 200);
  const cam = new THREE.PerspectiveCamera(30, 1, 1, 5000);
  const dist = CONFIG.FIXED_CAMERA_DISTANCE * 0.8;
  const pos = (yaw) => { cam.position.set(0, 0, 0); updateFixedCamera(cam, target, 1000, 0.8, 1e9, yaw); return cam.position.clone(); };
  const a = pos(0), b = pos(Math.PI / 2), c = pos(Math.PI);
  for (const p of [a, b, c]) near(p.distanceTo(target), dist, 1e-6);
  near(a.y, b.y, 1e-9); near(a.y, c.y, 1e-9);
  near(a.x - target.x, -(c.x - target.x), 1e-6); near(a.z - target.z, -(c.z - target.z), 1e-6);
  assert.ok(Math.abs(b.x - a.x) + Math.abs(b.z - a.z) > 10, 'a quarter turn moves the camera');
  const full = pos(2 * Math.PI);
  near(full.x, a.x, 1e-6); near(full.z, a.z, 1e-6);
});

check('the relight sound is calm and silent until audio is unlocked; it never throws', () => {
  class P { constructor() { this.value = 0; } setValueAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime() {} }
  const node = () => ({ connect: (x) => x, disconnect() {}, start() {}, stop() {}, gain: new P(), frequency: new P(), type: '' });
  let osc = 0;
  class Ctx { constructor() { this.currentTime = 0; this.state = 'running'; this.destination = node(); } createGain() { return node(); } createOscillator() { osc++; return node(); } createBiquadFilter() { return node(); } resume() {} }
  const a = createAudio(Ctx);
  a.relight();
  assert.equal(osc, 0, 'silent before the first tap');
  a.unlock();
  a.relight();
  assert.equal(osc, RELIGHT_SOUND.chord.length + RELIGHT_SOUND.chimes.length);
  assert.ok(RELIGHT_SOUND.gain <= 0.1 && RELIGHT_SOUND.chimeGain <= 0.08, 'quiet');
  assert.ok(RELIGHT_SOUND.attack >= 0.8, 'a swell, not a strike');
  assert.doesNotThrow(() => createAudio(null).relight());
});

check('the start card says what Felix wrote (storm, five lighthouses, Svalan, bring the light back, report to grandma in Fiskebäckskil), in short lines, with Set sail and Skip', () => {
  const text = START_CARD.lines.join(' ');
  for (const must of ['storm has put out the five lighthouses nearest Grundsund', 'granddad\'s old koster, Svalan', 'sail to each one and bring its light back', 'report to grandma in Fiskebäckskil']) assert.ok(text.includes(must), `says "${must}"`);
  assert.equal(START_CARD.lines.length, 3);
  assert.ok(START_CARD.lines.every((l) => l.length <= 80), 'short lines for a phone');
  assert.equal(START_CARD.go, 'Set sail'); assert.equal(START_CARD.skip, 'Skip');
  assert.ok(START_CARD.title.length <= 20);
  assert.ok(END_CARD.title && END_CARD.lines.length >= 1);
});

check('the start card is shown once: seen is saved on the device, a reset shows it again, blocked storage never throws', () => {
  const store = memory();
  assert.equal(hasSeenStart(store), false, 'a fresh device has not seen it');
  markStartSeen(store);
  assert.equal(hasSeenStart(store), true, 'Set sail or Skip: seen');
  assert.equal(hasSeenStart(store), true, 'and it stays seen');
  resetStart(store);
  assert.equal(hasSeenStart(store), false, '?lights=reset shows it again');
  store.setItem(START_KEY, 'nope');
  assert.equal(hasSeenStart(store), false, 'junk reads as not seen');
  const blocked = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
  assert.doesNotThrow(() => { markStartSeen(blocked); resetStart(blocked); });
  assert.equal(hasSeenStart(blocked), false, 'blocked storage: shown each time, never a crash');
  assert.equal(hasSeenStart(null), false);
});

check('the card after the fifth light is a short nudge (Felix\'s words), not the ending; its button navigates to Fiskebäckskil', () => {
  assert.equal(REPORT_CARD.title, 'All five lights are burning.');
  assert.deepEqual(REPORT_CARD.lines, ['Sail home to Fiskebäckskil and tell grandma.']);
  assert.ok(/Fiskebäckskil/.test(REPORT_CARD.button) && /Navigate/i.test(REPORT_CARD.button));
  assert.ok(REPORT_CARD.lines.join(' ').length < 60, 'short');
  assert.notEqual(REPORT_CARD.title, END_CARD.title, 'it is not the end card');
});

check('harbour entry: only when reporting, only INSIDE the harbour, and slow enough to tie up; too fast gets a hint at most every 25 s', () => {
  const t = createLighthouseTask({ lights, spawn, storage: memory() });
  assert.equal(t.harbourEntry(true, 1, 0), null, 'not reporting yet (lights left): nothing');
  for (const l of t.lights) t.restore(l.id);
  assert.equal(t.phase, 'report');
  assert.equal(t.harbourEntry(false, 1, 0), null, 'slow but outside the harbour: nothing (not a circle round a village point)');
  assert.equal(t.harbourEntry(true, HARBOUR_ENTRY_MAX_SPEED + 2, 10), 'hint', 'in the harbour but too fast: a hint');
  assert.equal(t.harbourEntry(true, HARBOUR_ENTRY_MAX_SPEED + 2, 20), null, 'not again so soon');
  assert.equal(t.harbourEntry(true, HARBOUR_ENTRY_MAX_SPEED + 2, 10 + HINT_COOLDOWN_S + 1), 'hint');
  assert.equal(t.harbourEntry(true, HARBOUR_ENTRY_MAX_SPEED, 99), 'enter', 'in the harbour and slow: the reward moment');
  t.finish();
  assert.equal(t.harbourEntry(true, 1, 200), null, 'done: it does not fire again');
  assert.ok(REWARD_DELAY_S >= 3 && REWARD_DELAY_S <= 8, 'the moment has time to play before the end card');
});

console.log(`${passed} checks passed`);
