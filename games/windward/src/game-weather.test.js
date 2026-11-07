// node games/windward/src/game-weather.test.js — the weather in the game (src/game-weather.js): the game clock drives it, co-op needs no wind messages
// (and an old guest page still works), the first errand's scripted wind is an override on the field, and a pause freezes it.
import assert from 'node:assert/strict';
import { createGameWeather, windMessage, oldGuestApply, dayTypeFromParam, startHourFromParam, GAME_WEATHER } from './game-weather.js';
import { createGameClock } from './game-clock.js';
import { createErrandWind, errandWindFor } from './errand-wind.js';
import { createPause } from './pause.js';
import { CONFIG } from './config.js';
import { timeOfHour, hourOf, formatClock, weatherAt } from './weather.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }
const DEG = Math.PI / 180;
const nearWind = (a, b, msg) => { assert.ok(angDiff(a.dir, b.dir) < 1e-5 && Math.abs(a.strength - b.strength) < 1e-5, `${msg ?? ''} ${a.dir},${a.strength} vs ${b.dir},${b.strength}`); }; // the packet rounds the story wind to 1e-6
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))); // directions are angles: -1.15 and 5.13 are the same wind
const BOUNDS = { minX: -1500, minZ: -1500, maxX: 1500, maxZ: 1500 };
const island = (x, z) => (Math.hypot(x - 300, z + 200) < 140 ? 12 : -5);
// a clock we drive by hand: wall seconds
const wallClock = (start = 1_000_000) => { let t = start; const wall = () => t; return { wall, advance: (s) => { t += s; }, clock: createGameClock(wall) }; };
const make = (c, extra = {}) => createGameWeather({ seed: 4242, dayType: 'sea-breeze', heightAt: island, bounds: BOUNDS, center: { x: 0, z: 0 }, clock: c.clock, ...extra });
const wind = (w, x = 100, z = 50) => ({ ...w.update().windAt(x, z) });

check('a new session starts at 11:00 on the game clock, and a game day is 30 real minutes', () => {
  const c = wallClock(); const w = make(c).update();
  assert.equal(w.clockText, '11:00');
  assert.equal(GAME_WEATHER.START_HOUR, 11);
  c.advance(900); // 15 real minutes = half a game day
  assert.equal(make(c).update().clockText, '11:00', 'a new weather starts again at 11:00');
  const a = make(wallClock()); const b = a; // same object: time moves with the clock
  assert.ok(Math.abs(a.update().hour - 11) < 1e-6 && b.hour === a.hour);
});

check('the weather moves with the game clock (1 s of clock = 1 s of weather), and the sea breeze builds from 11:00', () => {
  const c = wallClock(); const w = make(c);
  const at11 = wind(w, 0, 0).baseStrength;
  c.advance(300); // 5 real minutes = 4 game hours: 15:00
  const w2 = w.update();
  assert.equal(w2.clockText, '15:00');
  assert.ok(wind(w, 0, 0).baseStrength > at11, 'the breeze fills in');
  assert.ok(Math.abs(w2.hour - 15) < 1e-6);
});

check('a solo pause freezes the weather with the game clock (and a return does not make it jump); the time lost to the pause is not given back', () => {
  const c = wallClock(); const w = make(c);
  c.advance(60); w.update(); const before = { gt: w.gt, wind: wind(w) };
  const pause = createPause({ clock: c.clock, hasPeer: () => false, doc: null, win: null });
  pause.pause(); c.advance(500); // away for 500 s
  const during = { gt: w.update().gt, wind: wind(w) };
  assert.equal(during.gt, before.gt, 'frozen under the pause card');
  assert.deepEqual(during.wind, before.wind);
  pause.resume(); c.advance(0.001);
  assert.ok(Math.abs(w.update().gt - before.gt) < 0.01, 'the return does not jump');
});

check('co-op: two phones with the same seed and the same weather time compute the same wind everywhere, with no messages', () => {
  const ca = wallClock(); const cb = wallClock(); // both started at the same wall instant
  const a = make(ca); const b = make(cb);
  for (const [x, z] of [[0, 0], [250, -180], [-700, 400], [1200, 900], [310, -190]]) {
    ca.advance(37); cb.advance(37);
    assert.deepEqual(wind(a, x, z), wind(b, x, z), `at ${x},${z}`);
  }
  const other = createGameWeather({ seed: 9, dayType: 'sea-breeze', heightAt: island, bounds: BOUNDS, center: { x: 0, z: 0 }, clock: wallClock().clock });
  assert.notDeepEqual(wind(a), { ...other.update().windAt(100, 50) }, 'another seed is another day');
});

check('co-op: a guest that joined later (its clock is minutes apart, its wall clock skewed) lines up with the host from ONE message, and then stays in step', () => {
  const host = wallClock(5_000_000); const guest = wallClock(5_000_000 + 190); // the guest's wall clock is 190 s ahead of the host's
  const h = make(host); host.advance(400); h.update(); // the host has been sailing for a while
  const g = make(guest); guest.advance(25); g.update();
  assert.notEqual(Math.round(g.gt), Math.round(h.gt), 'before the message they disagree');
  const msg = windMessage(h, wind(h), 1);
  assert.ok(g.receive(msg.wx), 'the guest understood the weather packet');
  for (let i = 0; i < 6; i++) { host.advance(13); guest.advance(13); h.update(); g.update(); assert.ok(Math.abs(h.gt - g.gt) < 1e-6, 'in step'); assert.deepEqual(wind(h, 80, 60), wind(g, 80, 60)); }
});

check('co-op: a guest follows the host\'s day type and seed (a ?day= on the host\'s URL only)', () => {
  const host = wallClock(); const guest = wallClock();
  const h = make(host, { dayType: 'unsettled' }); const g = make(guest, { dayType: 'sea-breeze' });
  g.receive(h.update().packet());
  assert.equal(g.dayType, 'unsettled');
  assert.deepEqual(wind(h, 10, 10), wind(g, 10, 10));
  assert.ok(g.field.squallPlan.length > 0, 'its squalls came with the day');
});

check('co-op, an OLD guest page: the host\'s message still carries dir, strength, seq; the old handler applies it and ignores wx', () => {
  const c = wallClock(); const h = make(c).update(); const w = wind(h);
  const msg = windMessage(h, w, 7);
  assert.equal(msg.type, 'wind'); assert.equal(msg.dir, w.dir); assert.equal(msg.strength, w.strength); assert.equal(msg.seq, 7);
  assert.ok(msg.wx && msg.wx.v === 1);
  const next = oldGuestApply({ wind: { dir: 0, strength: 0.5 }, windSeq: -1 }, JSON.parse(JSON.stringify(msg))); // through the wire
  assert.deepEqual(next.wind, { dir: w.dir, strength: w.strength });
  assert.equal(next.windSeq, 7);
  assert.ok(JSON.stringify(msg).length < 400, `the message stays small (${JSON.stringify(msg).length} bytes)`);
});

check('co-op, an OLD host: a message without wx is not a weather packet, so a new guest falls back to the old wind', () => {
  const c = wallClock(); const g = make(c);
  assert.equal(g.receive(undefined), false);
  assert.equal(g.receive({}), false);
  assert.equal(g.receive({ v: 2, gt: 5 }), false);
  assert.equal(g.receive({ v: 1, gt: 'x' }), false);
});

check('a friend joining resyncs the game clock: rebase() keeps the host\'s weather time continuous across it', () => {
  const c = wallClock(); const w = make(c);
  const pause = createPause({ clock: c.clock, hasPeer: () => false, doc: null, win: null });
  c.advance(30); pause.pause(); c.advance(200); pause.resume(); c.advance(10); // a solo pause of 200 s: the clock is 200 s behind the wall clock
  const before = w.update().gt;
  w.rebase(() => pause.peerJoined()); // the friend arrives
  assert.ok(Math.abs(w.gt - before) < 1e-6, `no jump (${before} -> ${w.gt})`);
  c.advance(5);
  assert.ok(Math.abs(w.update().gt - (before + 5)) < 1e-6, 'and it carries on at the same rate');
  assert.equal(c.clock.offset, 0, 'the clock itself did rejoin the wall clock');
});

// ---- the first errand ----
const yard = { x: -400, z: 100 }; const grundsund = { x: 500, z: -300 };
check('errand: a game loaded in phase "errand" has the scripted wind from the very first frame, exactly (dir and strength)', () => {
  const c = wallClock(); const w = make(c, { errand: { yard, grundsund } });
  w.setPhase('errand'); const out = wind(w, 123, -45);
  const want = errandWindFor('errand', { yard, grundsund });
  assert.ok(angDiff(out.dir, want.dir) < 1e-9 && Math.abs(out.strength - want.strength) < 1e-9, `${out.dir} ${out.strength} vs ${want.dir} ${want.strength}`);
  assert.equal(out.override, 1);
  assert.equal(CONFIG.ERRAND_WIND_STRENGTH, out.strength);
});

check('errand: errand -> return swings over ERRAND_WIND_SWING_S without a snap; "help" hands back to the weather smoothly and exactly', () => {
  const c = wallClock(); const w = make(c, { errand: { yard, grundsund } }); const twin = make(wallClock());
  w.setPhase('errand'); wind(w); c.advance(20);
  w.update(); w.setPhase('return');
  const a = errandWindFor('errand', { yard, grundsund }); const b = errandWindFor('return', { yard, grundsund });
  let prev = wind(w); let worst = 0;
  for (let t = 0.1; t <= CONFIG.ERRAND_WIND_SWING_S + 1; t += 0.1) {
    c.advance(0.1); const o = wind(w);
    worst = Math.max(worst, Math.abs(Math.atan2(Math.sin(o.dir - prev.dir), Math.cos(o.dir - prev.dir))));
    prev = o;
    if (t > CONFIG.ERRAND_WIND_SWING_S + 0.15) assert.ok(angDiff(o.dir, b.dir) < 1e-6 && Math.abs(o.strength - b.strength) < 1e-6, 'settled on the way-home wind');
  }
  assert.ok(worst < 0.2, `no snap in the swing (largest step ${worst.toFixed(3)} rad per 0.1 s)`);
  assert.ok(angDiff(a.dir, b.dir) > 1, 'the two ends are different winds');
  // hand back at 'help'
  w.update(); w.setPhase('help');
  let prevS = wind(w).strength; let worstS = 0;
  for (let t = 0.1; t <= CONFIG.ERRAND_WIND_SWING_S + 2; t += 0.1) { c.advance(0.1); const s = wind(w).strength; worstS = Math.max(worstS, Math.abs(s - prevS)); prevS = s; }
  assert.ok(worstS < 0.08, `no snap handing back (${worstS.toFixed(3)} per 0.1 s)`);
  const nat = wind(w, 100, 50); twin.update();
  assert.equal(wind(w, 100, 50).override, 0, 'the weather has the wind back');
  assert.ok(nat.strength > 0 && nat.strength <= 1.25);
});

check('errand: the same override as the old errand wind module (src/errand-wind.js) at its two ends (target) and at its middle (swing shape)', () => {
  const c = wallClock(); const w = make(c, { errand: { yard, grundsund } });
  w.setPhase('errand'); wind(w); c.advance(10); w.update(); w.setPhase('return');
  const old = createErrandWind({ yard, grundsund });
  old.step('errand', 0, { dir: 1, strength: 0.4 });
  const startOut = old.step('errand', 10, { dir: 1, strength: 0.4 });
  assert.ok(Math.abs(startOut.strength - CONFIG.ERRAND_WIND_STRENGTH) < 1e-9);
  old.step('return', 10, { dir: 1, strength: 0.4 }); // the swing starts here, as in the game
  c.advance(CONFIG.ERRAND_WIND_SWING_S / 2);
  const mid = wind(w); const oldMid = old.step('return', 10 + CONFIG.ERRAND_WIND_SWING_S / 2, { dir: 1, strength: 0.4 });
  assert.ok(Math.abs(Math.atan2(Math.sin(mid.dir - oldMid.dir), Math.cos(mid.dir - oldMid.dir))) < 1e-6, 'halfway the same direction');
});

check('errand: the host\'s override events reach a guest in the message (it blows the same story wind, and hands back the same)', () => {
  const host = wallClock(); const guest = wallClock();
  const h = make(host, { errand: { yard, grundsund } }); const g = make(guest);
  h.update(); h.setPhase('errand'); host.advance(5); guest.advance(5); h.update(); g.receive(h.packet());
  nearWind(wind(g, 33, 77), wind(h, 33, 77));
  assert.equal(wind(g).override, 1, 'the guest is under the story wind too');
  h.setPhase('return'); host.advance(9); guest.advance(9); h.update(); g.receive(h.packet()); g.update();
  nearWind(wind(g, 33, 77), wind(h, 33, 77));
  h.setPhase('help'); host.advance(3); guest.advance(3); h.update(); g.receive(h.packet()); host.advance(6); guest.advance(6);
  nearWind(wind(g, 33, 77), wind(h, 33, 77), 'both handed back');
  assert.equal(wind(g).override, 0);
  g.receive(h.packet()); g.receive(h.packet()); // the same packet again does nothing twice
  nearWind(wind(g, 33, 77), wind(h, 33, 77));
});

check('Today game: no errand (no yard), so the weather is untouched whatever the phase', () => {
  const c = wallClock(); const w = make(c);
  w.setPhase('errand'); assert.equal(wind(w).override, 0);
});

check('the sea follows the DAY\'s wind (smooth), not the gusts: it does not shimmer when a gust passes', () => {
  const c = wallClock(); const w = make(c);
  let worst = 0; let prev = null;
  for (let t = 0; t < 120; t += 0.2) { c.advance(0.2); w.update(); if (prev) worst = Math.max(worst, Math.abs(w.sea.strength - prev.strength), Math.abs(w.sea.dir - prev.dir)); prev = { ...w.sea }; }
  assert.ok(worst < 0.002, `the sea's wind moves slowly (${worst.toFixed(5)} per 0.2 s)`);
  assert.ok(w.sea.strength >= GAME_WEATHER.SEA_MIN);
});

check('params: ?day= accepts the short names and the exact ones; ?t= a clock time; a bad value falls back', () => {
  assert.equal(dayTypeFromParam('misty'), 'misty-morning'); assert.equal(dayTypeFromParam('unsettled'), 'unsettled'); assert.equal(dayTypeFromParam('sea'), 'sea-breeze');
  assert.equal(dayTypeFromParam('grey'), 'grey-westerly'); assert.equal(dayTypeFromParam('sea-breeze'), 'sea-breeze'); assert.equal(dayTypeFromParam('MISTY'), 'misty-morning');
  assert.equal(dayTypeFromParam('banana'), null); assert.equal(dayTypeFromParam(null), null);
  assert.equal(startHourFromParam('07:00'), 7); assert.equal(startHourFromParam(null), 11); assert.equal(startHourFromParam('x'), 11);
  const c = wallClock(); const w = make(c, { startHour: startHourFromParam('07:00') });
  assert.equal(w.update().clockText, '07:00');
  assert.equal(formatClock(timeOfHour(11)), '11:00'); assert.ok(hourOf(0) === 0 && weatherAt);
});

check('the coast grid stays warm: crossing into a new wind direction does not need a cold build (update() prewarms the next buckets)', () => {
  const c = wallClock(); const w = make(c);
  w.update(); const n = w.field.cachedBuckets();
  assert.ok(n >= 2, `${n} buckets warm after the first frame`);
});

check('the message is the same shape every time, small, and JSON-safe (the wire is JSON)', () => {
  const c = wallClock(); const w = make(c, { errand: { yard, grundsund } }); w.update(); w.setPhase('errand'); w.setPhase('return');
  const msg = windMessage(w, wind(w), 3);
  assert.deepEqual(JSON.parse(JSON.stringify(msg)), msg);
  assert.ok(Object.keys(msg).join() === 'type,dir,strength,seq,wx');
  void DEG;
});

console.log(`${passed} game-weather checks passed`);
