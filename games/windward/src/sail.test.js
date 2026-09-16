// node games/windward/src/sail.test.js — plain node, no framework, no
// Three.js import chain (sail.js is pure math, runs headless by design).
import assert from 'node:assert/strict';
import { boatSpeed, speedFactor, idealTrimRad, trimMultiplier, leewardSign } from './sail.js';

const DEG = Math.PI / 180;
let passed = 0;

function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

check('no-go zone: speed is 0 dead upwind', () => {
  assert.equal(boatSpeed(0, 0, 1), 0);
});

check('no-go zone: speed is 0 anywhere inside the ±22.5° half-width', () => {
  for (const deg of [0, 5, 10, 15, 22.5]) {
    assert.equal(boatSpeed(deg * DEG, 0, 1), 0, `expected 0 at ${deg}deg`);
  }
});

check('speed factor peaks at 100deg off the wind', () => {
  let bestDeg = 0;
  let bestFactor = -Infinity;
  for (let deg = 0; deg <= 180; deg += 0.5) {
    const f = speedFactor(deg * DEG);
    if (f > bestFactor) {
      bestFactor = f;
      bestDeg = deg;
    }
  }
  assert.ok(Math.abs(bestDeg - 100) <= 1, `expected peak near 100deg, got ${bestDeg}`);
  assert.ok(Math.abs(bestFactor - 1) < 1e-6, `expected peak factor 1, got ${bestFactor}`);
});

check('speed factor at named DESIGN.md waypoints', () => {
  assert.ok(Math.abs(speedFactor(90 * DEG) - 0.95) < 1e-6);
  assert.ok(Math.abs(speedFactor(180 * DEG) - 0.8) < 1e-6);
});

check('left/right symmetry around the wind axis', () => {
  const windFrom = 1.234;
  for (const deg of [10, 30, 60, 90, 100, 140, 179]) {
    const a = boatSpeed(windFrom + deg * DEG, windFrom, 0.8);
    const b = boatSpeed(windFrom - deg * DEG, windFrom, 0.8);
    assert.ok(Math.abs(a - b) < 1e-9, `mismatch at +-${deg}deg: ${a} vs ${b}`);
  }
});

check('monotone in strength at a sailable angle', () => {
  const heading = 100 * DEG;
  let last = -Infinity;
  for (const strength of [0, 0.25, 0.5, 0.75, 1]) {
    const speed = boatSpeed(heading, 0, strength);
    assert.ok(speed >= last, `expected non-decreasing speed, got ${speed} after ${last}`);
    last = speed;
  }
  assert.ok(last > 0, 'expected nonzero speed at full strength');
});

check('trim: ideal sheet angle gives full multiplier at several points of sail', () => {
  for (const deg of [30, 60, 90, 120, 160]) {
    const angle = deg * DEG;
    const ideal = idealTrimRad(angle);
    assert.equal(trimMultiplier(ideal, ideal), 1);
  }
});

check('trim: badly wrong sheet angle floors at 0.25, never 0', () => {
  const angle = 90 * DEG;
  const ideal = idealTrimRad(angle);
  const worst = trimMultiplier(ideal + 180 * DEG, ideal);
  assert.equal(worst, 0.25);
  assert.ok(worst > 0, 'must never floor at exactly 0 (DESIGN.md: never stuck)');
});

check('trim: monotonic in trim quality (multiplier never increases as |actual-ideal| grows)', () => {
  const ideal = idealTrimRad(90 * DEG); // beam reach, ideal = 45deg
  for (const dir of [1, -1]) {
    let last = Infinity;
    for (let diffDeg = 0; diffDeg <= 90; diffDeg += 1) {
      const mult = trimMultiplier(ideal + dir * diffDeg * DEG, ideal);
      assert.ok(mult <= last + 1e-12, `multiplier increased moving ${diffDeg}deg from ideal: ${mult} after ${last}`);
      last = mult;
    }
  }
});

check('trim: beam-reach speed spread across the full sheet range is roughly 2-3x (W0.8 item 1)', () => {
  const heading = 90 * DEG; // wind dead abeam
  const windFrom = 0;
  const strength = 1;
  const best = boatSpeed(heading, windFrom, strength, idealTrimRad(90 * DEG));
  const worstSheetIn = boatSpeed(heading, windFrom, strength, 0 * DEG);
  const worstSheetOut = boatSpeed(heading, windFrom, strength, 90 * DEG);
  const worst = Math.min(worstSheetIn, worstSheetOut);
  const ratio = best / worst;
  assert.ok(ratio >= 2 && ratio <= 3.2, `expected ~2-3x spread on a beam reach, got ${ratio.toFixed(2)}x`);
});

check('leewardSign: flips exactly twice per revolution (head-to-wind, dead downwind/gybe)', () => {
  const windFrom = 0.7; // arbitrary, non-zero to catch axis-alignment bugs
  let signChanges = 0;
  let last = null;
  for (let deg = 1; deg < 360; deg += 1) {
    const sign = leewardSign(deg * DEG, windFrom);
    if (last !== null && sign !== last) signChanges += 1;
    last = sign;
  }
  assert.equal(signChanges, 2, `expected exactly 2 sign changes per revolution, got ${signChanges}`);
});

check('leewardSign: consistent side across all four wind quarters', () => {
  // For a fixed heading, moving the wind from one side to the other must
  // flip the sign — this is what "sail must swing to both sides" (W0.8
  // item 2) actually depends on, independent of the mesh/rendering side.
  const heading = 0;
  for (const windFromDeg of [10, 45, 80]) {
    const port = leewardSign(heading, -windFromDeg * DEG);
    const starboard = leewardSign(heading, windFromDeg * DEG);
    assert.notEqual(port, starboard, `expected opposite sides at +-${windFromDeg}deg`);
  }
});

check('trim: ideal sheet is tighter close-hauled than downwind', () => {
  const closeHauled = idealTrimRad(30 * DEG);
  const running = idealTrimRad(160 * DEG);
  assert.ok(closeHauled < running, `expected close-hauled (${closeHauled}) < running (${running})`);
});

check('boatSpeed without a trim argument assumes ideal trim (full speed)', () => {
  const heading = 100 * DEG;
  const withoutTrim = boatSpeed(heading, 0, 1);
  const withIdealTrim = boatSpeed(heading, 0, 1, idealTrimRad(heading));
  assert.equal(withoutTrim, withIdealTrim);
});

console.log(`\n${passed}/${passed} assertions passed`);
