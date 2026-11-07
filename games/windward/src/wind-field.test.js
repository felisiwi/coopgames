// node games/windward/src/wind-field.test.js — the wind at a place and a moment (src/wind-field.js) on a synthetic coast:
// deterministic, shifts within bounds, gust/lull patches that drift downwind, a lee calmer than open water,
// funnelling, the utomskars boost, squalls, and a smooth story-override hand-back.
import assert from 'node:assert/strict';
import { createWindField, WIND_FIELD } from './wind-field.js';
import { WEATHER, timeOfHour, compassToDir, windMs, wrapPi } from './weather.js';
import { SQUALL } from './squall.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }
const DEG = Math.PI / 180;
const NOON = timeOfHour(14); // a sea-breeze afternoon
const BOUNDS = { minX: -1500, minZ: -1500, maxX: 1500, maxZ: 1500 };

// a round island, 150 m radius, 12 m high, at the origin; everything else sea
const islandOnly = (x, z) => (Math.hypot(x, z) < 150 ? 12 : -5);
// two long islands with a 60 m wide sound between them, running east-west (along a westerly wind)
const soundCoast = (x, z) => (Math.abs(x) < 300 && Math.abs(z) > 30 && Math.abs(z) < 130 ? 12 : -5);

const only = (field, ...on) => { for (const k of Object.keys(field.layers)) field.layers[k] = on.includes(k); return field; };
const make = (heightAt, extra = {}) => createWindField({ daySeed: 7, dayType: 'sea-breeze', heightAt, bounds: BOUNDS, ...extra });
const downwind = (field, t) => { const d = field.base(t).dir; return { x: -Math.sin(d), z: -Math.cos(d) }; };

check('same inputs = the same wind, on any phone; no Date.now or Math.random inside', () => {
  const now = Date.now; const rnd = Math.random;
  Date.now = () => { throw new Error('Date.now'); }; Math.random = () => { throw new Error('Math.random'); };
  try {
    const a = make(islandOnly); const b = make(islandOnly);
    for (let i = 0; i < 60; i++) {
      const x = -700 + i * 23; const z = 300 - i * 11; const t = NOON + i * 3.3;
      assert.deepEqual({ ...a.windAt(x, z, t) }, { ...b.windAt(x, z, t) });
    }
    const c = createWindField({ daySeed: 8, dayType: 'sea-breeze', heightAt: islandOnly, bounds: BOUNDS });
    assert.notDeepEqual({ ...a.windAt(100, 100, NOON) }, { ...c.windAt(100, 100, NOON) }, 'another seed, another wind');
    assert.deepEqual({ ...a.windAt(100, 100, NOON) }, { ...a.windAt(100, 100, NOON) }, 'asking twice changes nothing');
  } finally { Date.now = now; Math.random = rnd; }
});

check('with every layer off the wind is exactly the day\'s weather', () => {
  const f = only(make(islandOnly));
  const w = f.windAt(-300, 200, NOON);
  const base = f.base(NOON);
  assert.ok(Math.abs(w.strength - base.strength) < 1e-9 && Math.abs(w.dir - base.dir) < 1e-9);
});

check('shifts: within +-20 degrees of the day\'s direction, big enough to matter (>= 10), and they come every minute or two', () => {
  const f = only(make(null), 'shifts');
  let lo = 0; let hi = 0; let extrema = 0; let prev = 0; let prevD = 0;
  for (let t = 0; t < 1200; t += 0.5) {
    const w = f.windAt(0, 0, NOON + t);
    const dev = wrapPi(w.dir - w.baseDir) / DEG;
    lo = Math.min(lo, dev); hi = Math.max(hi, dev);
    const d = dev - prev;
    if (t > 0 && Math.sign(d) !== Math.sign(prevD) && d !== 0 && prevD !== 0) extrema++;
    prev = dev; prevD = d;
  }
  assert.ok(hi <= WIND_FIELD.SHIFT_MAX_DEG + 1e-9 && lo >= -WIND_FIELD.SHIFT_MAX_DEG - 1e-9, `within the cap (${lo.toFixed(1)} .. ${hi.toFixed(1)})`);
  assert.ok(hi >= 10 && lo <= -10, `lifts and headers of at least 10 degrees each way (${lo.toFixed(1)} .. ${hi.toFixed(1)})`);
  assert.ok(extrema >= 8 && extrema <= 60, `turns every minute or two over 20 min (${extrema} reversals)`);
});

check('a shift rolls through: a point 80 m downwind sees the same header ~10 s later', () => {
  const f = only(make(null), 'shifts');
  const dw = downwind(f, NOON);
  for (const t of [NOON, NOON + 77, NOON + 301]) {
    const a = f.windAt(0, 0, t);
    const b = f.windAt(dw.x * 80, dw.z * 80, t + 80 / WIND_FIELD.SHIFT_TRAVEL_MS);
    assert.ok(Math.abs(wrapPi(a.dir - a.baseDir) - wrapPi(b.dir - b.baseDir)) < 1 * DEG, 'same shift, a moment later downwind');
  }
});

check('gusts and lulls: gusts +30..50%, lulls ~-40%, overlaps capped; both kinds occur', () => {
  const f = only(make(null), 'gusts');
  let maxG = -1; let minG = 1; let gustCells = 0; let lullCells = 0; let n = 0;
  for (let t = 0; t < 600; t += 7) for (let x = -400; x <= 400; x += 25) for (let z = -400; z <= 400; z += 25) {
    const g = f.windAt(x, z, NOON + t).gust; // what windAt applies: overlaps summed, then capped
    n++; if (g > 0.25) gustCells++; if (g < -0.25) lullCells++;
    maxG = Math.max(maxG, g); minG = Math.min(minG, g);
  }
  assert.ok(maxG >= 0.30 && maxG <= WIND_FIELD.GUST_SUM_MAX + 1e-9, `gust peaks ${maxG.toFixed(2)}`);
  assert.ok(minG <= -0.30 && minG >= WIND_FIELD.GUST_SUM_MIN - 1e-9, `lull dips ${minG.toFixed(2)}`);
  assert.ok(gustCells / n > 0.04 && lullCells / n > 0.04, `patches cover real area (gust ${(100 * gustCells / n).toFixed(1)}%, lull ${(100 * lullCells / n).toFixed(1)}%)`);
  assert.ok((gustCells + lullCells) / n < 0.5, 'but the sea is not all patches');
});

check('gust patches drift downwind at GUST_DRIFT_FRACTION of the wind speed, and a patch really travels with the air', () => {
  const f = only(make(null), 'gusts');
  const t0 = NOON; const t1 = NOON + 6;
  const D0 = f.drift(t0); const D1 = f.drift(t1);
  const v = Math.hypot(D1.x - D0.x, D1.z - D0.z) / 6;
  const expect = WIND_FIELD.GUST_DRIFT_FRACTION * windMs(f.base(t0 + 3).strength);
  assert.ok(Math.abs(v - expect) / expect < 0.03, `drift ${v.toFixed(2)} m/s vs ${expect.toFixed(2)}`);
  const dw = downwind(f, t0);
  assert.ok(((D1.x - D0.x) * dw.x + (D1.z - D0.z) * dw.z) / (v * 6) > 0.99, 'downwind');
  // follow the strongest patch near the origin: it must be where the drift says it should be, 6 s later
  let found = 0;
  for (let k = 0; k < 40 && found < 3; k++) {
    const ta = t0 + k * 11;
    let best = { g: 0.3, x: 0, z: 0 };
    for (let x = -300; x <= 300; x += 6) for (let z = -300; z <= 300; z += 6) { const g = f.gustAt(x, z, ta); if (g > best.g) best = { g, x, z }; }
    if (best.g <= 0.3) continue;
    const dA = f.drift(ta); const dB = f.drift(ta + 4);
    const ex = best.x + dB.x - dA.x; const ez = best.z + dB.z - dA.z;
    let after = { g: 0, x: 0, z: 0 };
    for (let x = ex - 24; x <= ex + 24; x += 3) for (let z = ez - 24; z <= ez + 24; z += 3) { const g = f.gustAt(x, z, ta + 4); if (g > after.g) after = { g, x, z }; }
    if (after.g < 0.15) continue; // that patch was dying
    found++;
    assert.ok(Math.hypot(after.x - ex, after.z - ez) < 12, `the patch moved with the air (off by ${Math.hypot(after.x - ex, after.z - ez).toFixed(1)} m)`);
  }
  assert.ok(found >= 2, `followed ${found} patches`);
});

check('a patch lives 30 to 60 seconds at a fixed spot in the air', () => {
  const f = only(make(null), 'gusts');
  const lives = [];
  for (let k = 0; k < 60 && lives.length < 6; k++) {
    const ta = NOON + k * 13 + 5;
    let best = { g: 0.35, x: 0, z: 0 };
    for (let x = -300; x <= 300; x += 8) for (let z = -300; z <= 300; z += 8) { const g = f.gustAt(x, z, ta); if (g > best.g) best = { g, x, z }; }
    if (best.g <= 0.35) continue;
    const dA = f.drift(ta);
    const g = (t) => { const d = f.drift(t); return Math.abs(f.gustAt(best.x + d.x - dA.x, best.z + d.z - dA.z, t)); };
    let lo = ta; while (g(lo - 0.5) > 0.02 && ta - lo < 120) lo -= 0.5; // the unbroken run of this one patch, either side of the moment found
    let hi = ta; while (g(hi + 0.5) > 0.02 && hi - ta < 120) hi += 0.5;
    const alive = hi - lo;
    lives.push(alive);
  }
  assert.ok(lives.length >= 3, 'found patches to follow');
  lives.sort((a, b) => a - b);
  const median = lives[Math.floor(lives.length / 2)];
  assert.ok(median >= 24 && median <= 64, `median life ${median}s (${lives.join(', ')})`);
});

check('island shadow: calm in the lee, full wind abeam and upwind, and the lee is smooth', () => {
  const f = only(make(islandOnly), 'shadows');
  const dw = downwind(f, NOON);
  const along = (s) => f.windAt(dw.x * s, dw.z * s, NOON).strength;
  const abeam = f.windAt(-dw.z * 600, dw.x * 600, NOON).strength;
  const base = f.base(NOON).strength;
  assert.ok(Math.abs(abeam - base) < 1e-6, 'abeam, far from land: the day\'s wind');
  assert.ok(along(-300) > 0.97 * base, 'upwind of the island: no shadow');
  assert.ok(along(200) < 0.6 * base, `in the lee, 50 m behind the island: calm (${(along(200) / base).toFixed(2)} of the day's wind)`);
  assert.ok(along(200) < along(300) && along(300) < along(450) + 1e-9, 'the calm eases off the further downwind you go');
  assert.ok(along(700) > 0.97 * base, 'far downwind the wind is back');
  let worst = 0; // smooth across the edge of the lee
  for (let c = -400; c < 400; c += 4) {
    const p = (cc) => f.windAt(dw.x * 220 - dw.z * cc, dw.z * 220 + dw.x * cc, NOON).strength;
    worst = Math.max(worst, Math.abs(p(c + 4) - p(c)) / base);
  }
  assert.ok(worst < 0.1, `no step across the lee's edge (${worst.toFixed(3)} per 4 m)`);
});

check('the lee does not pop when the wind veers across a grid bucket (smooth over ten game minutes)', () => {
  const f = only(make(islandOnly), 'shadows');
  const dw = downwind(f, NOON);
  const p = { x: dw.x * 230, z: dw.z * 230 };
  let prev = f.windAt(p.x, p.z, NOON).strength; let worst = 0;
  for (let t = 0.5; t < 600; t += 0.5) { const s = f.windAt(p.x, p.z, NOON + t).strength; worst = Math.max(worst, Math.abs(s - prev)); prev = s; }
  assert.ok(worst < 0.02, `max change per half second ${worst.toFixed(4)}`);
  assert.ok(f.cachedBuckets() >= 2, 'the direction crossed more than one bucket');
});

check('funnelling: a narrow sound along the wind is stronger than open water at the same moment', () => {
  const f = only(make(soundCoast, { dayType: 'sea-breeze' }), 'funnel');
  // find a time the wind is nearly westerly, so the sound lines up with it
  let t = NOON; while (Math.abs(wrapPi(f.base(t).dir - compassToDir(270))) > 4 * DEG && t < NOON + 600) t += 1;
  const sound = f.windAt(0, 0, t); const open = f.windAt(0, 700, t);
  assert.ok(open.funnel === 1 && sound.funnel > 1.15, `funnel factor ${sound.funnel.toFixed(2)} in the sound vs ${open.funnel.toFixed(2)} outside`);
  assert.ok(sound.strength > open.strength * 1.15, `${sound.strength.toFixed(2)} vs ${open.strength.toFixed(2)}`);
  assert.ok(sound.funnel <= 1 + WIND_FIELD.FUNNEL_BOOST + 1e-9);
});

check('utomskars: open water is stronger and steadier than water with land close upwind', () => {
  const on = make(islandOnly); const off = make(islandOnly);
  only(on, 'gusts', 'boost'); only(off, 'gusts');
  const dw = downwind(on, NOON);
  const open = { x: -dw.x * 1300, z: -dw.z * 1300 }; // far upwind of the island: nothing but sea to windward
  const wOn = on.windAt(open.x, open.z, NOON); const wOff = off.windAt(open.x, open.z, NOON);
  assert.ok(wOn.exposure > 0.95, `fully open (${wOn.exposure.toFixed(2)})`);
  const sheltered = on.windAt(dw.x * 400, dw.z * 400, NOON); // 250 m behind the island: land within 300 m upwind
  assert.ok(sheltered.exposure < 0.1, `sheltered (${sheltered.exposure.toFixed(2)})`);
  const base = on.base(NOON).strength;
  const noGust = (f) => { const c = createWindField({ daySeed: 7, dayType: 'sea-breeze', heightAt: islandOnly, bounds: BOUNDS }); return only(c, ...Object.keys(f.layers).filter((k) => f.layers[k] && k !== 'gusts')); };
  const calm = noGust(on).windAt(open.x, open.z, NOON).strength;
  assert.ok(Math.abs(calm / base - (1 + WIND_FIELD.OPEN_BOOST * wOn.exposure)) < 0.01, `open water +${Math.round(WIND_FIELD.OPEN_BOOST * 100)}% (${(calm / base).toFixed(2)})`);
  let maxOn = 0; let maxOff = 0;
  for (let t = 0; t < 600; t += 1.5) for (let k = 0; k < 6; k++) {
    const x = open.x + k * 40; const z = open.z + k * 25;
    maxOn = Math.max(maxOn, Math.abs(on.windAt(x, z, NOON + t).gust));
    maxOff = Math.max(maxOff, Math.abs(off.windAt(x, z, NOON + t).gust));
  }
  assert.ok(maxOn <= maxOff * (1 - WIND_FIELD.OPEN_STEADY * 0.9) + 1e-9, `gusts outside are smaller (${maxOn.toFixed(2)} vs ${maxOff.toFixed(2)})`);
  assert.ok(wOff.strength > 0);
});

check('squalls: on an unsettled day the wind rises ~60% and swings ~30 degrees as the line passes; off when the layer is off', () => {
  const f = createWindField({ daySeed: 11, dayType: 'unsettled', heightAt: null, bounds: BOUNDS });
  assert.ok(f.squallPlan.length >= 2);
  const e = f.squallPlan[0];
  const t = e.tArrive + (SQUALL.RAMP_M + 15) / e.speed; // just behind the front at the centre
  const withSq = { ...f.windAt(e.center.x, e.center.z, t) };
  only(f, 'shifts', 'gusts');
  const without = { ...f.windAt(e.center.x, e.center.z, t) };
  assert.ok(withSq.squall > 0.9, `inside the squall (${withSq.squall.toFixed(2)})`);
  assert.equal(without.squall, 0);
  assert.ok(withSq.strength > without.strength * 1.3, `${without.strength.toFixed(2)} -> ${withSq.strength.toFixed(2)}`);
  assert.ok(Math.abs(Math.abs(wrapPi(withSq.dir - without.dir)) / DEG - 30) < 3, `swing ${(wrapPi(withSq.dir - without.dir) / DEG).toFixed(1)} deg`);
  const sea = createWindField({ daySeed: 11, dayType: 'sea-breeze', bounds: BOUNDS });
  assert.equal(sea.squallPlan.length, 0);
});

check('addSquall (the lab\'s "squall now"): a line that crosses the given point at the given time', () => {
  const f = only(make(null), 'squalls');
  assert.equal(f.windAt(0, 0, NOON).squall, 0);
  const e = f.addSquall(NOON + 60, { x: 0, z: 0 });
  const heart = f.windAt(0, 0, NOON + 60 + 12).squall;
  assert.ok(heart > 0.8, `the squall arrives on schedule (${heart.toFixed(2)})`);
  assert.equal(f.windAt(0, 0, NOON + 60 + e.durationS + 40).squall, 0, 'and passes');
});

check('story override blends in over blendS, and clearing hands back smoothly to the natural wind (no snap anywhere)', () => {
  const f = make(null); const ref = make(null);
  const t0 = NOON;
  const nat = f.windAt(0, 0, t0 + 100);
  const target = { dir: nat.dir + 1, strength: 0.95 };
  f.setOverride(target, 10, t0 + 100);
  f.clearOverride(10, t0 + 200);
  assert.equal(f.overrideWeight(t0 + 99), 0);
  assert.ok(Math.abs(f.overrideWeight(t0 + 105) - 0.5) < 1e-9, 'halfway through the blend');
  const full = f.windAt(0, 0, t0 + 150);
  assert.ok(Math.abs(full.strength - 0.95) < 1e-9 && Math.abs(wrapPi(full.dir - target.dir)) < 1e-9, 'fully the story\'s wind in the middle');
  assert.ok(Math.abs(f.windAt(0, 0, t0 + 230).strength - ref.windAt(0, 0, t0 + 230).strength) < 1e-12, 'fully the natural wind again after the hand-back');
  let worstS = 0; let worstD = 0; let prev = f.windAt(0, 0, t0);
  for (let t = 0.1; t <= 300; t += 0.1) {
    const w = f.windAt(0, 0, t0 + t);
    worstS = Math.max(worstS, Math.abs(w.strength - prev.strength)); worstD = Math.max(worstD, Math.abs(wrapPi(w.dir - prev.dir)));
    prev = w;
  }
  assert.ok(worstS < 0.02, `strength never steps (max ${worstS.toFixed(4)} per 0.1 s)`);
  assert.ok(worstD < 0.03, `direction never steps (max ${worstD.toFixed(4)} rad per 0.1 s)`);
});

check('replacing an override cross-fades (the story\'s wind never jumps from one target to another)', () => {
  const f = make(null);
  f.setOverride({ dir: 0.5, strength: 0.9 }, 5, NOON);
  f.setOverride({ dir: 2.0, strength: 0.2 }, 10, NOON + 50);
  const a = f.windAt(0, 0, NOON + 50); const b = f.windAt(0, 0, NOON + 70);
  assert.ok(Math.abs(a.strength - 0.9) < 1e-9 && Math.abs(b.strength - 0.2) < 1e-9);
  let prev = a; let worst = 0;
  for (let t = 50.1; t <= 70; t += 0.1) { const w = f.windAt(0, 0, NOON + t); worst = Math.max(worst, Math.abs(w.strength - prev.strength)); prev = w; }
  assert.ok(worst < 0.03, `max step ${worst.toFixed(4)}`);
});

check('strength is always within 0..STRENGTH_MAX, whatever the layers pile up', () => {
  for (const type of ['sea-breeze', 'grey-westerly', 'misty-morning', 'unsettled']) {
    const f = createWindField({ daySeed: 3, dayType: type, heightAt: islandOnly, bounds: BOUNDS });
    for (let t = 0; t < WEATHER.GAME_DAY_S; t += 41) for (let x = -900; x <= 900; x += 300) for (let z = -900; z <= 900; z += 300) {
      const w = f.windAt(x, z, t);
      assert.ok(w.strength >= 0 && w.strength <= WIND_FIELD.STRENGTH_MAX + 1e-9 && Number.isFinite(w.dir), `${type} ${t} ${x},${z}: ${w.strength}`);
    }
  }
});

check('a second day repeats the first day\'s drift table + whole-day offsets (weather is periodic, so the drift stays continuous across midnight)', () => {
  const f = only(make(null), 'gusts');
  const a = f.drift(WEATHER.GAME_DAY_S - 0.01); const b = f.drift(WEATHER.GAME_DAY_S + 0.01);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 0.5, 'no jump at midnight');
});

console.log(`${passed} wind-field checks passed`);
