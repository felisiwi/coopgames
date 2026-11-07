// node games/windward/src/squall.test.js — squalls (src/squall.js): only on unsettled days, a line that approaches with
// plenty of warning, wind +~60% and a ~30 degree swing at the heart, gone in 1-2 minutes.
import assert from 'node:assert/strict';
import { SQUALL, squallPlanFor, squallAt, nextSquallEtaS, makeSquall } from './squall.js';
import { weatherAt, timeOfHour, DAY_TYPES } from './weather.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }
const DEG = Math.PI / 180;
const C = { x: 0, z: 0 };

check('only unsettled days have squalls; same seed = same plan', () => {
  for (const type of DAY_TYPES) {
    const plan = squallPlanFor(3, type, C);
    assert.equal(plan.length > 0, type === 'unsettled', type);
  }
  assert.deepEqual(squallPlanFor(3, 'unsettled', C), squallPlanFor(3, 'unsettled', C));
  assert.notDeepEqual(squallPlanFor(3, 'unsettled', C).map((e) => e.tArrive), squallPlanFor(4, 'unsettled', C).map((e) => e.tArrive));
});

check('2 to 3 squalls between 10:00 and 20:00, never closer than the minimum gap', () => {
  for (let seed = 0; seed < 40; seed++) {
    const plan = squallPlanFor(seed, 'unsettled', C);
    assert.ok(plan.length >= SQUALL.PER_DAY_MIN && plan.length <= SQUALL.PER_DAY_MAX, `seed ${seed}: ${plan.length}`);
    for (let i = 0; i < plan.length; i++) {
      assert.ok(plan[i].tArrive >= timeOfHour(SQUALL.FROM_HOUR) - 1, `seed ${seed}: not before ${SQUALL.FROM_HOUR}:00`);
      if (i) assert.ok(plan[i].tArrive - plan[i - 1].tArrive >= SQUALL.MIN_GAP_S - 1e-6, `seed ${seed}: gap`);
      assert.ok(plan[i].durationS >= SQUALL.DURATION_MIN_S && plan[i].durationS <= SQUALL.DURATION_MAX_S);
    }
  }
});

check('the line travels downwind: it reaches a point downwind of the arena later than the centre, upwind earlier', () => {
  const e = squallPlanFor(5, 'unsettled', C)[0];
  const down = { x: e.tx * 500, z: e.tz * 500 };
  const up = { x: -e.tx * 500, z: -e.tz * 500 };
  const base = weatherAt(5, e.tArrive, 'unsettled');
  assert.ok(Math.abs(Math.sin(base.dir) + e.tx) < 0.2 && Math.abs(Math.cos(base.dir) + e.tz) < 0.2, 'travel = the wind\'s own downwind direction (+-small)');
  const eta = (p) => nextSquallEtaS([e], p.x, p.z, e.tArrive - 600);
  assert.ok(Math.abs(eta(down) - eta(up) - 1000 / SQUALL.SPEED_MS) < 1e-6, `1000 m apart = ${(1000 / SQUALL.SPEED_MS).toFixed(0)} s apart`);
  assert.ok(Math.abs(e.tx * e.px + e.tz * e.pz) < 1e-9, 'across is perpendicular to travel');
});

check('warning well ahead: the cloud shows from WARNING_M out, growing as the line nears; nothing before that', () => {
  const e = makeSquall(5, 0, 1000, C, 270); // a westerly squall travelling east, crossing the origin at t = 1000
  const probe = (distAhead) => squallAt([e], e.tx * distAhead + e.px * e.lateralM, e.tz * distAhead + e.pz * e.lateralM, 1000);
  assert.equal(probe(SQUALL.WARNING_M + 50).cloud, 0, 'beyond the warning distance: nothing');
  const far = probe(SQUALL.WARNING_M - 50);
  const near = probe(200);
  assert.ok(far.cloud > 0 && far.cloud < near.cloud && near.cloud < 1, `cloud grows as it nears (${far.cloud.toFixed(2)} -> ${near.cloud.toFixed(2)})`);
  assert.ok(near.aheadM > 190 && near.aheadM < 210 && Math.abs(near.etaS - near.aheadM / SQUALL.SPEED_MS) < 1e-9, 'distance and ETA are reported');
  assert.equal(far.intensity, 0, 'no wind change until it arrives');
  assert.ok(SQUALL.WARNING_M / SQUALL.SPEED_MS >= 60, 'the warning is at least a minute of sailing time');
});

check('the calm before: wind dips just ahead of the line', () => {
  const e = makeSquall(5, 0, 1000, C, 270);
  const p = (d) => squallAt([e], e.tx * d + e.px * e.lateralM, e.tz * d + e.pz * e.lateralM, 1000);
  assert.ok(p(5).strengthMul < 0.9 && p(5).strengthMul > 1 - SQUALL.PRELUDE_DIP - 1e-9, `${p(5).strengthMul.toFixed(3)}`);
  assert.equal(p(SQUALL.PRELUDE_M + 10).strengthMul, 1);
});

check('at the heart: wind +~60% and a ~30 degree swing; rain on; the front rises over ~8 s, no step', () => {
  const e = makeSquall(5, 0, 1000, C, 270);
  const at = (behind) => squallAt([e], -e.tx * behind + e.px * e.lateralM, -e.tz * behind + e.pz * e.lateralM, 1000);
  const heart = at(SQUALL.RAMP_M + 5);
  assert.ok(heart.intensity > 0.95, `${heart.intensity.toFixed(2)}`);
  assert.ok(Math.abs(heart.strengthMul - (1 + SQUALL.GAIN)) < 0.05, `x${heart.strengthMul.toFixed(2)}`);
  assert.ok(Math.abs(Math.abs(heart.swingRad) / DEG - SQUALL.SWING_DEG) < 1.5, `${(heart.swingRad / DEG).toFixed(1)} deg`);
  assert.ok(heart.rain > 0.9);
  let prev = at(0).intensity;
  for (let d = 1; d <= 300; d++) { const i = at(d).intensity; assert.ok(Math.abs(i - prev) < 0.06, `no step at ${d} m`); prev = i; }
});

check('it passes in 1 to 2 minutes: fully gone a depth behind the line, and it blew for about that long at a fixed point', () => {
  for (const dur of [SQUALL.DURATION_MIN_S, SQUALL.DURATION_MAX_S]) {
    const e = { ...makeSquall(5, 0, 1000, C, 270), durationS: dur, depthM: SQUALL.SPEED_MS * dur };
    const x = e.px * e.lateralM;
    const z = e.pz * e.lateralM; // a point on the line's centre line, at the arena centre
    let blowing = 0;
    for (let t = 900; t < 1400; t += 0.5) if (squallAt([e], x, z, t).intensity > 0.5) blowing += 0.5;
    assert.ok(blowing > dur * 0.25 && blowing < dur, `${dur}s squall: strong (>50%) for ${blowing}s`);
    assert.equal(squallAt([e], x, z, 1000 + dur + 20).intensity, 0, 'gone');
    assert.equal(squallAt([e], x, z, 1000 + dur + 20).strengthMul, 1);
  }
});

check('the line has ends: far across from its centre there is no squall', () => {
  const e = makeSquall(5, 0, 1000, C, 270);
  const far = squallAt([e], e.px * (SQUALL.WIDTH_M / 2 + 50 + e.lateralM), e.pz * (SQUALL.WIDTH_M / 2 + 50 + e.lateralM), 1030);
  assert.equal(far.intensity, 0);
  assert.equal(far.cloud, 0);
});

console.log(`${passed} squall checks passed`);
