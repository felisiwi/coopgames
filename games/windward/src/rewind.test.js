// node games/windward/src/rewind.test.js: the lighthouse rewind (src/rewind.js) and the dusk looks (src/dusk.js).
import assert from 'node:assert/strict';
import { layoutRow, yearAtX, xAtYear, rewindProgress, rewindFrame, landingX, standing, REWIND } from './rewind.js';
import { LIGHTHOUSES } from './lighthouses.js';
import { LOOK_KEYS, BLUE_HOUR, STORM_NIGHT, GREY_DAWN, snapshotLook, blendLook, applyLook } from './dusk.js';
import { CONFIG } from './config.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }
const row = layoutRow(LIGHTHOUSES);

check('the row: every game lighthouse once, oldest on the left, evenly spaced, with its build year', () => {
  assert.equal(row.length, LIGHTHOUSES.length);
  for (let i = 1; i < row.length; i++) { assert.ok(row[i].built >= row[i - 1].built, 'oldest first'); assert.equal(row[i].x - row[i - 1].x, REWIND.spacingM); }
  assert.equal(row[0].x, 0);
  assert.equal(row.find((r) => r.name === 'Kråksundsgap Södra').built, 1954);
  assert.deepEqual(layoutRow([{ name: 'B', built: 1900 }, { name: 'A', built: 1900 }, { name: 'C', built: 1800 }]).map((r) => r.name), ['C', 'A', 'B'], 'ties are stable by name');
});

check('the year: today at the start, counting down as the camera moves left, 1950 where the run stops; yearAtX and xAtYear agree', () => {
  const f0 = rewindFrame(0, row), f1 = rewindFrame(REWIND.durationS, row);
  assert.equal(f0.year, REWIND.fromYear); assert.equal(f1.year, REWIND.toYear); assert.equal(f1.done, true); assert.equal(f0.done, false);
  let lastYear = Infinity, lastX = Infinity;
  for (let t = 0; t <= REWIND.durationS; t += 0.25) { const f = rewindFrame(t, row); assert.ok(f.year <= lastYear, `year only goes down at t=${t}`); assert.ok(f.x <= lastX + 1e-9, 'the camera only moves left'); lastYear = f.year; lastX = f.x; }
  for (const y of [2020, 2000, 1977, 1960, 1950]) assert.ok(Math.abs(yearAtX(row, xAtYear(row, y)) - y) < 1e-6, `round trip ${y}`);
});

check('it lands with Gäven (the newest tower standing in 1950) centred in the frame, the counter reads 1950 at the stop, and no tower is built after 1950 at the landing', () => {
  const g = row.find((r) => r.name === 'Gäven');
  assert.equal(landingX(row), g.x);
  const end = rewindFrame(REWIND.durationS, row);
  assert.equal(end.x, g.x, 'the camera x is exactly Gäven\'s x: centred');
  assert.equal(end.year, 1950); assert.equal(end.yearExact, 1950);
  let prev = Infinity; for (let t = 0; t <= REWIND.durationS; t += 0.1) { const f = rewindFrame(t, row); assert.ok(f.yearExact <= prev + 1e-9, 'never counts back up'); prev = f.yearExact; assert.ok(f.x >= g.x - 1e-9); }
  assert.ok(rewindFrame(REWIND.durationS - 0.5, row).year >= 1950 && rewindFrame(REWIND.durationS - 0.5, row).year <= 1952, 'the last half second still reads about 1950');
  const k = row.find((r) => r.name === 'Kråksundsgap Södra');
  assert.ok(end.yearExact < k.built && end.yearExact > g.built, '1950 is between Gäven and Kråksundsgap Södra: one stands, one is gone');
});

check('faster and faster, then slowing to a stop: speed peaks late, is zero at both ends, and the position never jumps', () => {
  const dt = 0.05, speeds = [];
  for (let t = 0; t < REWIND.durationS; t += dt) speeds.push((rewindProgress(t + dt) - rewindProgress(t)) / dt);
  const peak = speeds.indexOf(Math.max(...speeds)) * dt;
  assert.ok(Math.abs(peak - REWIND.accelShare * REWIND.durationS) < 0.5, `peak at ${peak}s`);
  assert.ok(speeds[0] < speeds[Math.floor(speeds.length * 0.3)] && speeds[Math.floor(speeds.length * 0.3)] < speeds[Math.floor(speeds.length * 0.6)], 'faster and faster');
  assert.ok(speeds.at(-1) < speeds[Math.floor(speeds.length * 0.5)] / 10, 'almost stopped at the end');
  assert.ok(Math.abs(rewindProgress(0)) < 1e-12 && Math.abs(rewindProgress(REWIND.durationS) - 1) < 1e-9);
  for (let i = 1; i < speeds.length; i++) assert.ok(Math.abs(speeds[i] - speeds[i - 1]) < 0.15, 'no jump in speed');
});

check('towers built after the current year wink out on the way: Kråksundsgap Södra (1954) is gone at 1950, Måseskär (1865) and Gäven (1941) stay; eight go in all', () => {
  const gone = row.filter((r) => !standing(r.built, REWIND.toYear)).map((r) => r.name);
  assert.ok(gone.includes('Kråksundsgap Södra'));
  assert.ok(!gone.includes('Måseskär') && !gone.includes('Gäven') && !gone.includes('Hättan'));
  assert.equal(gone.length, 8);
  // and each one vanishes just as the camera passes it: its year is the year the counter shows at its x
  for (const r of row) assert.ok(Math.abs(yearAtX(row, r.x) - r.built) < 1e-9);
  assert.equal(standing(1954, 1954), true); assert.equal(standing(1954, 1953), false);
});

check('dusk looks: every key set in all three looks, blending is exact at the ends and in between, colours blend per channel, CONFIG is only changed by applyLook', () => {
  for (const look of [BLUE_HOUR, STORM_NIGHT, GREY_DAWN]) for (const k of LOOK_KEYS) assert.ok(look[k] !== undefined, `${k} missing`);
  assert.deepEqual(blendLook(BLUE_HOUR, STORM_NIGHT, 0), { ...BLUE_HOUR });
  assert.deepEqual(blendLook(BLUE_HOUR, STORM_NIGHT, 1), { ...STORM_NIGHT });
  const mid = blendLook({ ...BLUE_HOUR, HAZE_COLOR: 0x000000, HEMI_INTENSITY: 0 }, { ...STORM_NIGHT, HAZE_COLOR: 0xff8040, HEMI_INTENSITY: 2 }, 0.5);
  assert.equal(mid.HAZE_COLOR, 0x804020); assert.equal(mid.HEMI_INTENSITY, 1);
  assert.deepEqual(blendLook(BLUE_HOUR, STORM_NIGHT, 7), { ...STORM_NIGHT }, 'k is clamped');
  const before = snapshotLook(), fake = { ...CONFIG };
  assert.deepEqual(blendLook(before, BLUE_HOUR, 0.3) && Object.keys(before), LOOK_KEYS);
  applyLook(STORM_NIGHT, fake); assert.equal(fake.SKY_ZENITH_COLOR, STORM_NIGHT.SKY_ZENITH_COLOR); assert.deepEqual(snapshotLook(), before, 'the real CONFIG is untouched');
  assert.ok(BLUE_HOUR.SUN_INTENSITY < before.SUN_INTENSITY && STORM_NIGHT.HEMI_INTENSITY < BLUE_HOUR.HEMI_INTENSITY, 'darker each step');
});

console.log(`\n${passed} checks passed`);
