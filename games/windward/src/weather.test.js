// node games/windward/src/weather.test.js — the day's weather (src/weather.js): a fixed function of (daySeed, gameTimeS),
// the day rhythm the grill asked for, the four day types, and the unit helpers.
import assert from 'node:assert/strict';
import { WEATHER, DAY_TYPES, dayTypeFor, weatherAt, hourOf, timeOfHour, formatClock, parseClock, compassToDir, dirToCompass, windMs } from './weather.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }
const at = (seed, hour, type) => weatherAt(seed, timeOfHour(hour), type);
const DEG = Math.PI / 180;

check('same seed + same clock = the same weather (no hidden state, no Date.now)', () => {
  for (const type of DAY_TYPES) for (const h of [0, 7.3, 13, 21.9]) assert.deepEqual(at(5, h, type), at(5, h, type));
  assert.notDeepEqual(at(5, 13, 'sea-breeze'), at(6, 13, 'sea-breeze'), 'another day is another weather');
});

check('every seed gets one of the four day types, and all four turn up', () => {
  const seen = new Set();
  for (let s = 0; s < 200; s++) { const t = dayTypeFor(s); assert.ok(DAY_TYPES.includes(t)); seen.add(t); }
  assert.equal(seen.size, 4);
});

check('sea-breeze day rhythm: light morning, filling in by midday, fresh afternoon, easing evening', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const morning = at(seed, 7, 'sea-breeze').strength;
    const noon = at(seed, 12, 'sea-breeze').strength;
    const afternoon = at(seed, 16, 'sea-breeze').strength;
    const evening = at(seed, 21.5, 'sea-breeze').strength;
    assert.ok(morning < 0.25, `seed ${seed}: calm/light morning (${morning.toFixed(2)})`);
    assert.ok(noon > morning + 0.15, `seed ${seed}: filling in by midday (${morning.toFixed(2)} -> ${noon.toFixed(2)})`);
    assert.ok(afternoon > noon, `seed ${seed}: fresher in the afternoon (${noon.toFixed(2)} -> ${afternoon.toFixed(2)})`);
    assert.ok(afternoon > 0.6, `seed ${seed}: a fresh afternoon (${afternoon.toFixed(2)})`);
    assert.ok(evening < afternoon - 0.2, `seed ${seed}: easing in the evening (${afternoon.toFixed(2)} -> ${evening.toFixed(2)})`);
  }
});

check('sea-breeze direction fills in from the west and veers (clockwise) through the day', () => {
  const noonDir = at(3, 14, 'sea-breeze').dirDeg;
  assert.ok(noonDir > 240 && noonDir < 300, `a westerly by the afternoon (${noonDir.toFixed(0)} deg)`);
  const morning = at(3, 8, 'sea-breeze').dirDeg;
  const late = at(3, 20, 'sea-breeze').dirDeg;
  assert.ok(late > morning, `veering: ${morning.toFixed(0)} -> ${noonDir.toFixed(0)} -> ${late.toFixed(0)}`);
});

check('the day wraps without a jump (midnight to midnight) and no minute-to-minute leap anywhere', () => {
  for (const type of DAY_TYPES) {
    const a = weatherAt(9, 0, type);
    const b = weatherAt(9, WEATHER.GAME_DAY_S - 0.001, type);
    assert.ok(Math.abs(a.strength - b.strength) < 0.02, `${type}: strength wraps (${a.strength.toFixed(3)} vs ${b.strength.toFixed(3)})`);
    let maxD = 0;
    let maxS = 0;
    let prev = weatherAt(9, 0, type);
    for (let t = 1; t <= WEATHER.GAME_DAY_S; t++) {
      const w = weatherAt(9, t, type);
      let dd = Math.abs(w.dirDeg - prev.dirDeg);
      if (dd > 180) dd = 360 - dd;
      maxD = Math.max(maxD, dd);
      maxS = Math.max(maxS, Math.abs(w.strength - prev.strength));
      prev = w;
    }
    assert.ok(maxD < 2, `${type}: direction moves < 2 deg per game-second (max ${maxD.toFixed(2)})`);
    assert.ok(maxS < 0.01, `${type}: strength moves < 0.01 per game-second (max ${maxS.toFixed(4)})`);
  }
});

check('misty morning: thick at dawn, clear by early afternoon; other types stay clear', () => {
  assert.ok(at(2, 7, 'misty-morning').visibility < 0.3, 'thick mist at 07:00');
  assert.ok(at(2, 14, 'misty-morning').visibility > 0.95, 'clear at 14:00');
  assert.ok(at(2, 9, 'misty-morning').strength < 0.15, 'calm in the mist');
  assert.ok(at(2, 7, 'sea-breeze').visibility > 0.95);
});

check('unsettled: showers come and go (rain > 0 sometimes, 0 sometimes), and it is gustier; others never rain', () => {
  let wet = 0;
  let dry = 0;
  for (let h = 0; h < 24; h += 0.1) (at(4, h, 'unsettled').rain > 0.05 ? wet++ : dry++);
  assert.ok(wet > 10 && dry > 10, `showers (wet ${wet}, dry ${dry})`);
  assert.ok(at(4, 12, 'unsettled').gustiness > at(4, 12, 'sea-breeze').gustiness);
  for (const type of ['sea-breeze', 'grey-westerly', 'misty-morning']) for (let h = 0; h < 24; h += 0.5) assert.equal(at(4, h, type).rain, 0);
});

check('grey westerly: fresh and westerly all day', () => {
  for (let h = 0; h < 24; h += 1) { const w = at(7, h, 'grey-westerly'); assert.ok(w.strength > 0.4, `${h}h: ${w.strength.toFixed(2)}`); assert.ok(w.dirDeg > 235 && w.dirDeg < 315, `${h}h: ${w.dirDeg.toFixed(0)}`); }
});

check('sea state lags the wind: still lumpy in the evening after the afternoon blow, flat in the calm morning', () => {
  const calm = at(1, 7, 'sea-breeze').seaState;
  const blow = at(1, 16, 'sea-breeze').seaState;
  const eveningWind = at(1, 20.5, 'sea-breeze');
  assert.ok(calm < 0.25 && blow > 0.6, `sea ${calm.toFixed(2)} -> ${blow.toFixed(2)}`);
  assert.ok(eveningWind.seaState > eveningWind.strength, `the sea (${eveningWind.seaState.toFixed(2)}) is higher than the easing wind (${eveningWind.strength.toFixed(2)})`);
});

check('the game day is 30 real minutes; the clock helpers agree', () => {
  assert.equal(WEATHER.GAME_DAY_S, 1800);
  assert.equal(hourOf(0), 0);
  assert.ok(Math.abs(hourOf(900) - 12) < 1e-9);
  assert.equal(hourOf(1800 + 450), 6);
  assert.equal(formatClock(timeOfHour(14)), '14:00');
  assert.equal(formatClock(timeOfHour(6.5)), '06:30');
  assert.equal(parseClock('14:00'), 14);
  assert.equal(parseClock('7:30'), 7.5);
  assert.equal(parseClock('14.5'), 14.5);
  assert.equal(parseClock('banana'), null);
  assert.equal(parseClock('25:00'), null);
});

check('a westerly (compass 270) is dir -PI/2 in the game: x = sin(dir) points west, and the conversion round-trips', () => {
  assert.ok(Math.abs(compassToDir(270) - -Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(Math.sin(compassToDir(270)) - -1) < 1e-9, 'blows from -x (west)');
  assert.ok(Math.abs(Math.cos(compassToDir(0)) - -1) < 1e-9, 'a northerly blows from -z (north is up the screen)');
  for (const b of [0, 45, 123, 270, 359]) assert.ok(Math.abs(dirToCompass(compassToDir(b)) - b) < 1e-9);
  assert.equal(windMs(0), WEATHER.WIND_MS_MIN);
  assert.equal(windMs(1), WEATHER.WIND_MS_MAX);
  assert.ok(Math.abs(at(3, 14, 'sea-breeze').dir - compassToDir(at(3, 14, 'sea-breeze').dirDeg)) < 1e-9);
  assert.ok(DEG > 0);
});

check('an unknown day type throws instead of silently returning nonsense', () => {
  assert.throws(() => weatherAt(1, 0, 'tornado'), /unknown day type/);
});

console.log(`${passed} weather checks passed`);
