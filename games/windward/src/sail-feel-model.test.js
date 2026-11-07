// node games/windward/src/sail-feel-model.test.js — the sail-feel lab's feel rules (src/sail-feel-model.js).
import assert from 'node:assert/strict';
import { FEEL, labTargetSpeed, heelTarget, heelPower, stepHeel, createLuffState, stepLuff, luffFlutter, cameraFeel, smoothShare, speedShare, sprayRate, wakeSize, wakeLife } from './sail-feel-model.js';
import { boatSpeed, idealTrimRad } from './sail.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }
const DEG = Math.PI / 180;
const WIND_FROM = 0; // wind from the north; heading = angle off the wind (symmetrical)

check('light-air floor: a reach in almost no wind still makes way, never faster than the same boat with wind; into the wind is still 0', () => {
  const trim = idealTrimRad(90 * DEG);
  const calm = labTargetSpeed(90 * DEG, WIND_FROM, 0.03, trim);
  assert.ok(calm >= FEEL.LIGHT_AIR_FLOOR_MS * 0.9 && calm <= FEEL.LIGHT_AIR_FLOOR_MS + 1e-9, `${calm.toFixed(2)} m/s in a near-calm`);
  assert.ok(boatSpeed(90 * DEG, WIND_FROM, 0.03, trim) < 0.5, 'the unfloored boat nearly stops (what the floor fixes)');
  assert.equal(labTargetSpeed(10 * DEG, WIND_FROM, 0.5, trim), 0, 'pointing into the wind: still nothing');
  for (const s of [0.3, 0.6, 1, 1.2]) assert.equal(labTargetSpeed(90 * DEG, WIND_FROM, s, trim), boatSpeed(90 * DEG, WIND_FROM, s, trim), 'with real wind the floor is not involved');
});

check('the floor still rewards a good point of sail and decent trim', () => {
  const t = (deg, trim) => labTargetSpeed(deg * DEG, WIND_FROM, 0.03, trim);
  assert.ok(t(100, idealTrimRad(100 * DEG)) > t(35, idealTrimRad(35 * DEG)), 'a reach beats close-hauled in a drift');
  assert.ok(t(90, idealTrimRad(90 * DEG)) > t(90, 0), 'good trim beats bad trim');
  assert.ok(t(90, 0) >= FEEL.LIGHT_AIR_FLOOR_MS * FEEL.FLOOR_TRIM_MIN * 0.9 * 0.9, 'bad trim is slower, not stuck');
});

check('heel: none in a drift, more in a gust, capped; close-hauled leans more than running', () => {
  assert.equal(heelTarget(0.1, 90 * DEG), 0);
  const a = heelTarget(0.6, 70 * DEG);
  const b = heelTarget(0.9, 70 * DEG);
  const c = heelTarget(1.25, 70 * DEG);
  assert.ok(a < b && b <= c + 1e-9 && c <= FEEL.HEEL_MAX_RAD + 1e-9, `${a.toFixed(2)} < ${b.toFixed(2)} <= ${c.toFixed(2)} <= max`);
  assert.ok(heelTarget(0.9, 40 * DEG) > heelTarget(0.9, 170 * DEG), 'running is steadier than close-hauled');
  assert.ok(heelPower(1, 180 * DEG) < heelPower(1, 40 * DEG));
});

check('heel follows the wind with a short lag: a gust leans the boat within about a second, then it comes back upright', () => {
  let h = 0;
  const target = heelTarget(1.1, 70 * DEG);
  for (let t = 0; t < 1.5; t += 1 / 60) h = stepHeel(h, target, 1 / 60);
  assert.ok(h > target * 0.85, `leans in (${h.toFixed(2)} of ${target.toFixed(2)} after 1.5 s)`);
  for (let t = 0; t < 4; t += 1 / 60) h = stepHeel(h, 0, 1 / 60);
  assert.ok(h < target * 0.05, 'upright again');
});

check('luff: a steady beam reach never flutters; a header does, and it fades once you have settled', () => {
  const s = createLuffState();
  for (let t = 0; t < 30; t += 1 / 60) stepLuff(s, 90 * DEG, 1 / 60);
  assert.equal(s.luff, 0, 'steady course: silent');
  // the wind shifts 14 degrees toward the bow: headed
  let peak = 0;
  for (let t = 0; t < 2; t += 1 / 60) { stepLuff(s, 76 * DEG, 1 / 60); peak = Math.max(peak, s.luff); }
  assert.ok(peak > 0.9, `a 14 degree header is a full flap (${peak.toFixed(2)})`);
  assert.ok(s.headedDeg > 10);
  for (let t = 0; t < 40; t += 1 / 60) stepLuff(s, 76 * DEG, 1 / 60);
  assert.ok(s.luff < 0.1, `once used to the new angle it stops (${s.luff.toFixed(2)})`);
});

check('luff: a lift (the wind moves aft) is silent; a small header is a small flutter; flutter shows before the sail is lost', () => {
  const s = createLuffState();
  for (let t = 0; t < 20; t += 1 / 60) stepLuff(s, 90 * DEG, 1 / 60);
  for (let t = 0; t < 2; t += 1 / 60) stepLuff(s, 104 * DEG, 1 / 60);
  assert.equal(s.luff, 0, 'lifted: nothing');
  const m = createLuffState();
  for (let t = 0; t < 20; t += 1 / 60) stepLuff(m, 90 * DEG, 1 / 60);
  let small = 0;
  for (let t = 0; t < 2; t += 1 / 60) { stepLuff(m, 85 * DEG, 1 / 60); small = Math.max(small, m.luff); }
  assert.ok(small > 0.05 && small < 0.7, `5 degrees: a hint (${small.toFixed(2)})`);
});

check('luff: pointing too close to the wind shivers the sail even when nothing shifted (close-hauled edge)', () => {
  const s = createLuffState();
  for (let t = 0; t < 20; t += 1 / 60) stepLuff(s, 50 * DEG, 1 / 60);
  assert.equal(s.luff, 0, '50 degrees off: fine');
  const e = createLuffState();
  for (let t = 0; t < 20; t += 1 / 60) stepLuff(e, 28 * DEG, 1 / 60);
  assert.ok(e.luff > 0.4 && e.luff <= FEEL.LUFF_EDGE_SHARE + 1e-9, `28 degrees off: shivering (${e.luff.toFixed(2)})`);
});

check('the flutter moves the sail by at most the full flap, and is zero with no luff', () => {
  let max = 0;
  for (let t = 0; t < 3; t += 0.003) { max = Math.max(max, Math.abs(luffFlutter(1, t))); assert.equal(luffFlutter(0, t), 0); }
  assert.ok(max > FEEL.LUFF_FLUTTER_RAD * 0.7 && max <= FEEL.LUFF_FLUTTER_RAD + 1e-9, `${max.toFixed(3)} rad`);
});

check('camera: dips, tightens and looks ahead with speed; pulls back when slow; each part can be switched off; no lurch', () => {
  const slow = cameraFeel(0); const fast = cameraFeel(1);
  assert.deepEqual(slow, { elevDropDeg: 0, distMul: 1, lookAheadM: 0 });
  assert.ok(fast.elevDropDeg === FEEL.CAM_DIP_DEG && fast.distMul === 1 - FEEL.CAM_TIGHT && fast.lookAheadM === FEEL.CAM_LOOK_AHEAD_M);
  assert.deepEqual(cameraFeel(1, { dip: false }), { elevDropDeg: 0, distMul: 1, lookAheadM: FEEL.CAM_LOOK_AHEAD_M });
  assert.deepEqual(cameraFeel(1, { look: false }), { elevDropDeg: FEEL.CAM_DIP_DEG, distMul: 1 - FEEL.CAM_TIGHT, lookAheadM: 0 });
  let share = 0; let worst = 0; let prev = 0;
  for (let t = 0; t < 10; t += 1 / 60) { share = smoothShare(share, 10, 1 / 60); worst = Math.max(worst, share - prev); prev = share; }
  assert.ok(worst < 0.02 && share > 0.99, `eases in over seconds (max step ${worst.toFixed(4)})`);
  assert.equal(speedShare(10), 1);
});

check('spray: none when slow, more when fast and windy, scaled by the slider; the wake grows and lingers with speed', () => {
  assert.equal(sprayRate(0.2, 0.8), 0);
  assert.ok(sprayRate(1, 1) > sprayRate(0.7, 1) && sprayRate(0.7, 1) > 0);
  assert.ok(sprayRate(1, 1.2) > sprayRate(1, 0.3));
  assert.equal(sprayRate(1, 1, 0), 0);
  assert.ok(Math.abs(sprayRate(1, 1, 2) - 2 * sprayRate(1, 1)) < 1e-9);
  assert.ok(wakeSize(10) > wakeSize(3) && wakeSize(3) > wakeSize(0.5));
  assert.ok(wakeLife(10) > wakeLife(3));
});

console.log(`${passed} sail-feel-model checks passed`);
