// Headless invariants for Will It Fit? — no browser, no canvas. Imports
// the game's own modules and drives the simulation directly.
//
//   node games/will-it-fit/test/invariants.mjs
import { FP, GRID, SPOUT, MATERIALS, SOURCE, PHYS, STAGE, TABLE_Y, VESSEL } from '../src/config.js';
import { generateVessel, validate, inside, rng, archetypeFor, ARCHETYPES } from '../src/vessel.js';
import { Sim, traceArc, launchVelocity } from '../src/sim.js';
import {
  RESERVE_MAX, MILESTONES, stageVolume, drain, afterStage, runOver,
} from '../src/economy.js';
import { seatFor, otherSeat, mergeInputs, emptyInput } from '../src/seats.js';
import { createLockstep, DEFAULT_DELAY } from '../src/lockstep.js';

const TABLE_ROW = Math.floor(TABLE_Y / STAGE.CELL);

let pass = 0;
let fail = 0;
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${detail}`); }
}

// The pour ramps from a dribble, so the first grain takes a few ticks to
// appear rather than arriving on tick one.
function firstDrop(sim, cap = 60) {
  for (let i = 0; i < cap; i++) {
    sim.tick();
    if (sim.drops.length) return sim.drops[0];
  }
  return null;
}

// Pour the way a player does: hold, then release before the ramp runs
// away, then hold again. A single unbroken hold overshoots the vessel
// entirely once the stream is at full speed, which is the point of the
// ramp — so a test that holds forever is not testing the game.
// Holds must be long enough for the throttled ramp to walk the stream out
// as far as the vessel. At 80 ticks the speed throttle keeps it landing
// around col 125, short of a centred bowl at ~150-170, so every probe came
// back empty and it looked like no aim worked at all.
function pourPulsed(sim, ticks = 20000, hold = 220, rest = 30) {
  let i = 0;
  while (i < ticks && !sim.done) {
    sim.setCork(true);
    for (let k = 0; k < hold && i < ticks && !sim.done; k++, i++) sim.tick();
    sim.setCork(false);
    for (let k = 0; k < rest && i < ticks && !sim.done; k++, i++) sim.tick();
  }
  sim.setCork(false);
  for (let k = 0; k < 400 && !sim.done; k++) sim.tick();
  return sim;
}

// Fill the vessel directly, bypassing the pour. Tilt behaviour is about
// what settled material does, so driving it through the whole aiming game
// would be testing three systems to check one.
function fillGrid(sim, frac) {
  const want = Math.floor(sim.vessel.capacity * frac);
  let n = 0;
  for (let y = sim.vessel.height - 1; y >= 0 && n < want; y--) {
    const row = sim.vessel.rows[y];
    for (let x = row.l; x < row.r && n < want; x++) {
      sim.grid[y * GRID.W + x] = sim.material.id;
      n++;
    }
  }
  sim.caught = n;
  sim.remaining = 0;
  for (let i = 0; i < 400; i++) sim.tick(); // let it settle flat
  return sim;
}

// Run a sim to completion (or a tick cap), returning it.
function run(sim, { ticks = 20000, aim } = {}) {
  if (aim) sim.setAim(aim.angle);
  sim.setCork(true);
  for (let i = 0; i < ticks && !sim.done; i++) sim.tick();
  return sim;
}

// Search the actual control range for an aim that lands material in the
// vessel. Doubles as proof that the control space contains a solution.
const aimCache = new Map();
// Enough material that the ramp sweeps the landing point THROUGH the
// bowl rather than running dry while the stream is still falling short.
// With the pressure cap the catchable band is narrow, so a small probe
// volume finds nothing and looks like "no aim works".
// The probe must pour the SAME WAY the tests do. Holding unbroken while
// the tests pulse found an aim that only lands at full ramp, so every test
// that used it then caught nothing — the search and the thing being
// searched for have to agree on the technique.
function probeAim(seed, stage, a, volume = 400) {
  const probe = new Sim({ seed, stage, volume });
  probe.setAim(a);
  return pourPulsed(probe, 12000);
}
function findAim(sim) {
  const key = `${sim.seed}/${sim.stage}`;
  if (aimCache.has(key)) return aimCache.get(key);
  // Take the BEST angle, not the first one that clears a threshold. Taking
  // the first meant scanning from the steepest end and settling for a
  // marginal aim, which then left downstream tests catching almost nothing.
  let best = null;
  for (let a = SPOUT.ANGLE_MIN; a <= SPOUT.ANGLE_MAX; a += 3) {
    const probe = probeAim(sim.seed, sim.stage, a);
    if (probe.caught > 15 && (!best || probe.caught > best.caught)) {
      best = { angle: a, caught: probe.caught };
    }
  }
  aimCache.set(key, best);
  return best;
}

// An aim that both lands material AND loses some — needed to exercise the
// rim/shoulder collision. Derived rather than hard-coded: vessel shapes
// change, and a stale constant silently stops testing anything (this test
// already passed vacuously once for exactly that reason). A clip always
// sits near the edge of the landing window, so walk out from a good aim
// rather than searching the whole space.
function findClipAim(seed, stage = 1) {
  const base = findAim(new Sim({ seed, stage }));
  if (!base) return null;
  for (let d = 1; d <= 14; d++) {
    for (const a of [base.angle - d, base.angle + d]) {
      const probe = probeAim(seed, stage, a, 400);
      if (probe.caught > 10 && probe.spilled > 10) return { angle: a };
    }
  }
  return null;
}

console.log('\n1. vessel generation');
{
  let bad = 0;
  const detail = [];
  for (let seed = 1; seed <= 40; seed++) {
    for (const stage of [1, 5, 10, 20, 40, 80]) {
      const v = generateVessel(seed, stage);
      const problems = validate(v, SPOUT.NOZZLE);
      if (problems.length) { bad++; if (detail.length < 3) detail.push(`s${seed}/st${stage}: ${problems[0]}`); }
    }
  }
  check('240 generated vessels all valid', bad === 0, detail.join('; '));
}
{
  const same = generateVessel(7, 3);
  const again = generateVessel(7, 3);
  const other = generateVessel(8, 3);
  check('same seed+stage gives the same vessel',
    JSON.stringify(same) === JSON.stringify(again));
  check('different seed gives a different vessel',
    JSON.stringify(same) !== JSON.stringify(other));
}
{
  // Aperture must tighten as stages climb — that is the stage-1..20 dial.
  const early = [], late = [];
  for (let s = 1; s <= 30; s++) early.push(generateVessel(s, 2).aperture);
  for (let s = 1; s <= 30; s++) late.push(generateVessel(s, 40).aperture);
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  check('later stages have tighter apertures', avg(late) < avg(early),
    `stage2 avg ${avg(early).toFixed(1)} vs stage40 avg ${avg(late).toFixed(1)}`);
  check('aperture never narrows below the nozzle', Math.min(...late) >= SPOUT.NOZZLE,
    `min ${Math.min(...late)}`);
}

console.log('\n1b. the four vessels alternate');
{
  const seen = [1, 2, 3, 4, 5, 6, 7, 8].map((st) => archetypeFor(st));
  check('the shapes rotate stage by stage',
    seen.join(',') === 'bowl,bottle,plate,wine,bowl,bottle,plate,wine', seen.join(','));
  check('every shape appears within any four stages',
    new Set(seen.slice(0, 4)).size === ARCHETYPES.length);

  const of = (kind) => {
    for (let st = 1; st <= 8; st++) {
      if (archetypeFor(st) === kind) return generateVessel(3, st);
    }
    return null;
  };
  const plate = of('plate');
  const bowl = of('bowl');
  const bottle = of('bottle');
  const wine = of('wine');
  const ratio = (v) => v.height / v.aperture;

  // The four are deliberately OPPOSED, so the skill being tested changes
  // from stage to stage rather than just scaling up. A plate is trivial to
  // pour into and impossible to hold; a wine bottle is the reverse. An
  // earlier version of this block asserted every vessel must be wider than
  // deep — true when they were all bowls, and exactly what the rotation is
  // meant to stop being true.
  check('a plate is far wider than it is deep', ratio(plate) < 0.3,
    `ratio ${ratio(plate).toFixed(2)}`);
  check('a bowl is open to its full width', bowl.aperture === bowl.belly,
    `rim ${bowl.aperture}, widest ${bowl.belly}`);
  check('a bottle has a real neck', bottle.aperture < bottle.belly * 0.6,
    `neck ${bottle.aperture} vs belly ${bottle.belly}`);
  check('a wine bottle has the narrowest throat of all',
    wine.aperture < bottle.aperture && wine.aperture < bowl.aperture,
    `wine ${wine.aperture}, bottle ${bottle.aperture}, bowl ${bowl.aperture}`);
  check('and is the deepest relative to its mouth', ratio(wine) > 2,
    `ratio ${ratio(wine).toFixed(2)}`);

  // A shape nobody can fill is not a difficulty curve, it is a dead stage.
  const caps = [plate, bowl, bottle, wine].map((v) => v.capacity);
  check('all four hold enough for a stage', Math.min(...caps) > 400, caps.join(', '));
  check('every archetype admits the stream',
    [plate, bowl, bottle, wine].every((v) => v.aperture >= SPOUT.NOZZLE),
    [plate, bowl, bottle, wine].map((v) => v.aperture).join(', '));
}

console.log('\n1c. the pourer carries the source');
{
  const s = new Sim({ seed: 3, stage: 1 });
  s.setSpout(9999);
  check('the source clamps to the far end of its run', s.spoutCol === SPOUT.MAX_COL,
    `${s.spoutCol}`);
  s.setSpout(-50);
  check('and to the near end', s.spoutCol === SPOUT.MIN_COL, `${s.spoutCol}`);

  // The arc is structural, not a matter of keeping the two travel ranges
  // apart. Even the slowest grain the spout can produce lands well
  // downrange, so the pourer can never park over the bowl and drop
  // material straight in. An earlier version of this test asserted the
  // ranges must not overlap — the wrong invariant. They do overlap, and it
  // does not matter, because a minimum arc of ~46 cells is built in.
  const firstLanding = (col) => {
    const t2 = new Sim({ seed: 3, stage: 1, volume: 40 });
    t2.setSpout(col);
    t2.setAim(SPOUT.ANGLE_FIXED);
    t2.setCork(true);
    const rim = t2.mouthRow;
    const prev = new Map();
    for (let i = 0; i < 900; i++) {
      t2.tick();
      for (const d of t2.drops) {
        const py = prev.get(d);
        const y = d.y / FP | 0;
        if (py !== undefined && py < rim && y >= rim) return d.x / FP | 0;
        prev.set(d, y);
      }
    }
    return null;
  };
  const cols = [SPOUT.MIN_COL, 70, SPOUT.MAX_COL];
  const offsets = cols.map((c) => firstLanding(c) - c);
  check('even the slowest pour arcs well downrange', Math.min(...offsets) > 35,
    `offsets ${offsets.join(', ')} cells`);

  // Carrying the source must actually move where material lands.
  const near = firstLanding(SPOUT.MIN_COL);
  const far = firstLanding(SPOUT.MAX_COL);
  check('carrying it along the run moves the stream', far > near + 50, `${near} -> ${far}`);
}

console.log('\n2. ballistics');
{
  const sim = new Sim({ seed: 1, volume: 1 });
  sim.setAim(-30);
  sim.setCork(true);
  const d = firstDrop(sim);
  check('a droplet is emitted when uncorked', !!d);
  check('emitted moving forward and down-right', d.vx > 0 && d.vy > 0);

  const path = [];
  for (let i = 0; i < 40 && sim.drops.length; i++) { sim.tick(); if (sim.drops[0]) path.push(sim.drops[0].y); }
  const falls = path.every((y, i) => i === 0 || y > path[i - 1]);
  check('trajectory accelerates downward (a real arc)', falls && path.length > 5);
}
{
  // The pour ramps, so holding longer throws further — that walk-away is
  // what makes the catcher chase, and it replaced the old sweep.
  // Measured where the stream crosses the vessel's rim height, not at the
  // screen edge — past full ramp it flies clean off the table and every
  // hold length would saturate at the same cull column.
  const reachAfter = (holdTicks) => {
    const sim = new Sim({ seed: 1, volume: 9000 });
    sim.setAim(-10);
    sim.setCork(true);
    const rimRow = sim.mouthRow;
    // Keyed by the drop object itself — the array is re-built every tick as
    // grains are emitted and culled, so positional indices do not survive.
    const prevY = new Map();
    let landing = 0;
    for (let i = 0; i < holdTicks + 400; i++) {
      // Stop pouring when the hold ends — otherwise every hold length runs
      // the ramp to full and they all land in the same place.
      if (i === holdTicks) sim.setCork(false);
      sim.tick();
      for (const d of sim.drops) {
        const py = prevY.get(d);
        const y = d.y / FP | 0;
        if (py !== undefined && py < rimRow && y >= rimRow) {
          landing = Math.max(landing, d.x / FP | 0);
        }
        prevY.set(d, y);
      }
    }
    return landing;
  };
  const short = reachAfter(30);
  const long = reachAfter(300);
  check('a longer hold throws it further', long > short + 20, `${short} -> ${long}`);
  check('the pour starts as a dribble', (() => {
    const sim = new Sim({ seed: 1, volume: 9000 });
    sim.setAim(-10); sim.setCork(true);
    let early = 0;
    for (let i = 0; i < 60; i++) { const r = sim.remaining; sim.tick(); early += r - sim.remaining; }
    let late = 0;
    for (let i = 0; i < 240; i++) sim.tick();
    for (let i = 0; i < 60; i++) { const r = sim.remaining; sim.tick(); late += r - sim.remaining; }
    return late > early * 4;
  })());
  check('releasing resets the ramp', (() => {
    const sim = new Sim({ seed: 1, volume: 9000 });
    sim.setAim(-10); sim.setCork(true);
    for (let i = 0; i < 300; i++) sim.tick();
    const hot = sim.pourPressure;
    sim.setCork(false);
    sim.setCork(true);
    return sim.pourPressure < hot;
  })());
}
{
  // Convention: POSITIVE angle is above horizontal. y grows downward, so
  // "upward" means a more negative vy.
  const launch = (angle) => {
    const s = new Sim({ seed: 1, volume: 1 });
    s.setAim(angle);
    s.setCork(true);
    return firstDrop(s);
  };
  const lob = launch(SPOUT.ANGLE_MAX);
  const flat = launch(0);
  const down = launch(SPOUT.ANGLE_MIN);
  check('positive angle lobs upward', lob.vy < flat.vy, `${lob.vy} vs ${flat.vy}`);
  check('negative angle pours downward', down.vy > flat.vy, `${down.vy} vs ${flat.vy}`);
  check('the aim range actually reaches above horizontal', lob.vy < 0,
    `vy at max angle = ${lob.vy}`);
}
{
  // A lob must be able to clear height the flat shot cannot — otherwise
  // "making arcs" is cosmetic.
  const apex = (angle) => {
    const s = new Sim({ seed: 1, volume: 1 });
    s.setAim(angle);
    s.setCork(true);
    let top = Infinity;
    firstDrop(s);
    for (let i = 0; i < 400; i++) {
      s.tick();
      for (const d of s.drops) top = Math.min(top, d.y);
    }
    return top;
  };
  check('a lob rises above the spout', apex(SPOUT.ANGLE_MAX) < apex(0),
    `lob apex ${apex(SPOUT.ANGLE_MAX)} vs flat ${apex(0)}`);
}

console.log('\n3. the handoff');
{
  const sim = new Sim({ seed: 3, stage: 1 });
  const aim = findAim(sim);
  check('some aim in the control range fills the vessel', !!aim,
    aim ? '' : 'no (angle,pressure) landed material');
  if (aim) console.log(`       (best probe: angle ${aim.angle}, caught ${aim.caught})`);

  if (aim) {
    const s = new Sim({ seed: 3, stage: 1, volume: 400 });
    s.setAim(aim.angle);
    pourPulsed(s);
    check('material actually lands in the vessel', s.caught > 15, `caught=${s.caught}`);
    check('nothing settles outside the vessel walls', (() => {
      for (let y = 0; y < GRID.H; y++)
        for (let x = 0; x < GRID.W; x++)
          if (s.grid[y * GRID.W + x] && !inside(s.vessel, x, y)) return false;
      return true;
    })());
  }
}
{
  // Aim deliberately short: everything must be lost, nothing caught.
  const s = run(new Sim({ seed: 3, volume: 200 }), { aim: { angle: -70 } });
  check('a hopeless aim catches nothing', s.caught === 0, `caught=${s.caught}`);
  check('and loses everything', s.spilled === 200, `spilled=${s.spilled}`);
}
{
  // The wall test. A grain must KEEP FLYING after it crosses the mouth and
  // only settle where it actually lands — converting it to a cell at the
  // rim is what made the vessel feel like a wall the stream splatted
  // against. If this count ever returns to zero, that bug is back.
  const landing = findAim(new Sim({ seed: 3, stage: 1 })) || { angle: -10 };
  const s = new Sim({ seed: 3, stage: 1, volume: 300 });
  s.setAim(landing.angle);
  let peakInside = 0;
  let sawDescending = false;
  // Pulsed, like every other pour test — an unbroken hold walks the stream
  // straight past the bowl and nothing ever enters it.
  for (let i = 0; i < 20000 && !s.done; i++) {
    s.setCork(i % 250 < 220);
    s.tick();
    const inFlightInside = s.drops.filter((d) => d.inside);
    peakInside = Math.max(peakInside, inFlightInside.length);
    // Somebody should be genuinely travelling down the neck, not hovering.
    if (inFlightInside.some((d) => d.vy > 0)) sawDescending = true;
  }
  check('grains keep flying after entering the vessel', peakInside > 10,
    `peak in-flight inside = ${peakInside}`);
  check('they descend through it rather than sticking at the rim', sawDescending);
  check('and they all eventually settle or spill', s.done && s.drops.length === 0);
}
{
  // The same complaint, the other seam: a grain that MISSES must fall away
  // into the abyss, not blink out of existence in mid-air the instant it
  // is doomed. It stays alive, keeps falling, and is only counted when it
  // actually leaves the frame.
  const s = new Sim({ seed: 3, stage: 1, volume: 200 });
  s.setAim(-40); // deliberately short of the mouth
  s.setCork(true);
  let peakLost = 0;
  let deepest = 0;
  for (let i = 0; i < 20000 && !s.done; i++) {
    s.tick();
    const lost = s.drops.filter((d) => d.lost);
    peakLost = Math.max(peakLost, lost.length);
    for (const d of lost) deepest = Math.max(deepest, d.y / FP | 0);
  }
  check('missed grains keep falling instead of vanishing', peakLost > 5,
    `peak falling-lost = ${peakLost}`);
{
  // Material must GLANCE OFF the bottle, not sail through it. This aim
  // clips the shoulder, so the scenario is real rather than vacuous — an
  // earlier version of this test used an aim that overshot the vessel
  // entirely and passed without the collision code ever running once.
  const t = new Sim({ seed: 3, stage: 1, volume: 300 });
  const orig = t.deflectOffVessel.bind(t);
  let deflections = 0;
  t.deflectOffVessel = (d) => {
    const before = d.vx;
    orig(d);
    if (d.vx !== before) deflections++;
  };
  const clip = findClipAim(3) || { angle: -11 };
  t.setAim(clip.angle); // onto the rim/shoulder
  t.setCork(true);

  let penetrated = false;
  for (let i = 0; i < 30000 && !t.done; i++) {
    t.tick();
    for (const d of t.drops) {
      if (!d.lost) continue;
      const gx = (d.x / FP | 0) - t.col0;
      const gy = (d.y / FP | 0) - t.mouthRow;
      if (gy >= 0 && gy < t.vessel.height && inside(t.vessel, gx, gy)) penetrated = true;
    }
  }
  check('material glances off the vessel', deflections > 3, `${deflections} deflections`);
  check('and never passes through it', !penetrated);
}
  check('they fall past the plinth into the abyss', deepest > TABLE_ROW,
    `deepest row ${deepest} vs plinth ${TABLE_ROW}`);
  check('and are all accounted for once gone', s.done && s.caught + s.spilled === 200,
    `caught ${s.caught} + spilled ${s.spilled}`);
}

console.log('\n4. conservation (the load-bearing invariant)');
{
  const sim = new Sim({ seed: 5, volume: 500 });
  const aim = findAim(sim) || { angle: -18 };
  sim.setAim(aim.angle, aim.pressure);
  sim.setCork(true);
  let worst = null;
  for (let i = 0; i < 20000 && !sim.done; i++) {
    sim.tick();
    const total = sim.caught + sim.spilled + sim.remaining + sim.drops.length;
    if (total !== 500) { worst = `tick ${i}: ${total}`; break; }
  }
  check('no material is created or destroyed, ever', worst === null, worst || '');
  check('the source empties and the stage ends', sim.done, `remaining=${sim.remaining}`);
  check('caught never exceeds vessel capacity', sim.caught <= sim.vessel.capacity,
    `${sim.caught} / ${sim.vessel.capacity}`);
}

console.log('\n5. filling and overflow');
{
  // Pour far more than the vessel holds: it must fill, then reject.
  const sim = new Sim({ seed: 11, stage: 1, volume: 4000 });
  const aim = findAim(sim);
  if (aim) sim.setAim(aim.angle);
  const s = aim ? pourPulsed(sim, 120000) : null;
  if (!s) { check('overflow scenario ran', false, 'no viable aim found'); }
  else {
    check('vessel fills substantially', s.fillRatio > 0.3, `fill=${(s.fillRatio * 100).toFixed(0)}%`);
    check('excess overflows rather than compressing', s.spilled > 0, `spilled=${s.spilled}`);
    check('overfilling never exceeds capacity', s.caught <= s.vessel.capacity,
      `${s.caught} / ${s.vessel.capacity}`);
  }
}

console.log('\n6. determinism (lockstep depends on this)');
{
  const a = new Sim({ seed: 42, stage: 7, volume: 300 });
  const b = new Sim({ seed: 42, stage: 7, volume: 300 });
  a.setAim(-22); b.setAim(-22);
  a.setCork(true); b.setCork(true);
  let diverged = null;
  for (let i = 0; i < 3000 && !a.done; i++) {
    a.tick(); b.tick();
    if (a.checksum() !== b.checksum()) { diverged = `tick ${i}`; break; }
  }
  check('two sims with the same seed stay bit-identical', diverged === null, diverged || '');

  // Both sims must have material actually in play, or they converge on the
  // same empty terminal state and the checksums match for a boring reason.
  const aim42 = findAim(new Sim({ seed: 42, stage: 7 })) || { angle: -22 };
  const c = new Sim({ seed: 43, stage: 7, volume: 300 });
  c.setAim(aim42.angle); c.setCork(true);
  for (let i = 0; i < 300; i++) c.tick();
  const a2 = new Sim({ seed: 42, stage: 7, volume: 300 });
  a2.setAim(aim42.angle); a2.setCork(true);
  for (let i = 0; i < 300; i++) a2.tick();
  check('a different seed produces a different checksum', c.checksum() !== a2.checksum(),
    `caught ${a2.caught}/${c.caught}`);
}
{
  // The sim must not touch Math.random — that would desync peers silently.
  const real = Math.random;
  let called = 0;
  Math.random = () => { called++; return real(); };
  const s = new Sim({ seed: 9, volume: 200 });
  s.setAim(-20); s.setCork(true);
  for (let i = 0; i < 1200 && !s.done; i++) s.tick();
  Math.random = real;
  check('the simulation never calls Math.random()', called === 0, `${called} calls`);
}

console.log('\n7. materials behave differently');
{
  // Spread a fixed pile in a flat box and see how far each runs. Measured
  // in a box rather than a generated vessel: a vessel's own walls force
  // every material into the same shape, which hid the difference entirely.
  // Measured at 30 ticks, before the fluid end finishes levelling — these
  // materials differ in RATE, and given long enough even clay flattens.
  const spread = (key) => {
    const s = new Sim({ seed: 21, stage: 1, material: key, volume: 1 });
    const mid = GRID.W >> 1;
    const l = mid - 30;
    const w = 61;
    const h = 14;
    const rows = [];
    for (let y = 0; y < h; y++) rows.push({ l, r: l + w });
    s.vessel = {
      ...s.vessel, rows, height: h, minL: l, maxR: l + w,
      mouth: { l, r: l + w }, capacity: w * h,
    };
    s.grid.fill(0);
    let n = 0;
    for (let y = 1; y < 12 && n < 66; y++) {
      for (let d = -1; d <= 1 && n < 66; d++) { s.grid[y * GRID.W + mid + d] = s.material.id; n++; }
    }
    s.caught = n;
    s.remaining = 0;
    for (let i = 0; i < 30; i++) s.tick();
    const cols = new Set();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < GRID.W; x++) if (s.grid[y * GRID.W + x]) cols.add(x);
    }
    return cols.size;
  };

  const order = ['water', 'milk', 'oil', 'smoothie', 'slush', 'clay'];
  const widths = order.map(spread);
  check('the clumpiness axis is monotonic',
    widths.every((v, i) => i === 0 || v <= widths[i - 1]),
    order.map((k, i) => `${k} ${widths[i]}`).join(', '));
  check('water runs far further than clay', widths[0] > widths[5] * 3,
    `water ${widths[0]} vs clay ${widths[5]}`);
  check('the thick end genuinely holds a slope', widths[4] < widths[0] - 10,
    `slush ${widths[4]} vs water ${widths[0]}`);
}
{
  const ids = Object.values(MATERIALS).map((m) => m.id);
  check('material ids are unique and non-zero',
    new Set(ids).size === ids.length && !ids.includes(0));
}

console.log('\n7b. tilt (stage 2)');
{
  // Fill a bowl to a given fraction, then lean it and see what runs out.
  const fillTo = (frac) => fillGrid(new Sim({ seed: 3, stage: 1, volume: 1 }), frac);
  const pour = (frac, tilt) => {
    const s = fillTo(frac);
    const before = s.caught;
    s.setVessel(0, tilt);
    for (let i = 0; i < 2000; i++) s.tick();
    return before - s.caught;
  };

  check('upright holds everything, however full', pour(0.95, 0) === 0 && pour(0.4, 0) === 0);
  check('a brimming bowl pours when leaned hard', pour(0.95, VESSEL.MAX_TILT) > 50,
    `${pour(0.95, VESSEL.MAX_TILT)} grains`);
  check('a half-full one pours less than a brimming one',
    pour(0.7, VESSEL.MAX_TILT) < pour(0.95, VESSEL.MAX_TILT),
    `${pour(0.7, VESSEL.MAX_TILT)} vs ${pour(0.95, VESSEL.MAX_TILT)}`);
  check('a nearly-empty one is safe to swing', pour(0.15, VESSEL.MAX_TILT) === 0,
    `${pour(0.15, VESSEL.MAX_TILT)} grains`);
  // The reason MAX_TILT has to clear 45°: below it, the (+1,-1) step that
  // lets liquid climb toward a lowered rim is uphill, so nothing can pour.
  check('the tilt range clears the 45° threshold', VESSEL.MAX_TILT > 45,
    `MAX_TILT ${VESSEL.MAX_TILT}`);
}
{
  // Material that pours out must FALL, not evaporate — the same
  // decide-and-delete trap as the mouth and the misses.
  const s = fillGrid(new Sim({ seed: 3, stage: 1, volume: 1 }), 0.95);
  const held = s.caught;
  const total = s.caught + s.spilled + s.remaining + s.drops.length;
  s.setVessel(0, VESSEL.MAX_TILT);
  let sawFalling = 0;
  let broke = null;
  for (let i = 0; i < 900; i++) {
    s.tick();
    sawFalling = Math.max(sawFalling, s.drops.filter((d) => d.lost).length);
    const now = s.caught + s.spilled + s.remaining + s.drops.length;
    if (now !== total && broke === null) broke = `tick ${i}: ${now} vs ${total}`;
  }
  check('poured material becomes falling grains', sawFalling > 3, `peak ${sawFalling}`);
  check('and pouring conserves material exactly', broke === null, broke || '');
  check('the bowl actually emptied somewhat', s.caught < held, `${held} -> ${s.caught}`);
}

console.log('\n7c. the reserve is the tank');
{
  const full = stageVolume(3, 1, RESERVE_MAX);
  check('a healthy reserve pours a full measure', full > 100, `${full} grains`);
  check('a depleted reserve pours only the remainder',
    stageVolume(3, 1, 90) === 90, `${stageVolume(3, 1, 90)}`);
  check('the tank never pours nothing at all', stageVolume(3, 1, 0) >= 1);

  check('spilling is the only thing that drains it', drain(1000, 0) === 1000);
  check('spilled grains come straight off the reserve', drain(1000, 250) === 750);
  check('it cannot go negative', drain(10, 999) === 0);

  check('an ordinary stage carries the remainder forward', afterStage(1234, 3) === 1234);
  for (const m of [10, 20, 40, 80]) {
    if (afterStage(5, m) !== RESERVE_MAX) { check(`milestone ${m} refills`, false); break; }
  }
  check('milestones refill it', MILESTONES.every((m) => afterStage(5, m) === RESERVE_MAX),
    MILESTONES.join(','));
  check('the refill schedule doubles', MILESTONES.every((m, i) =>
    i === 0 || m === MILESTONES[i - 1] * 2), MILESTONES.join(','));

  check('an empty reserve ends the run', runOver(0, 500));
  check('catching nothing all stage ends the run', runOver(RESERVE_MAX, 0));
  check('otherwise the run continues', !runOver(RESERVE_MAX, 1));
}
{
  // A starving run must actually shorten: each stage gets less than the
  // last once the reserve drops below a full measure.
  let reserve = 500;
  const sizes = [];
  for (let st = 1; st <= 4; st++) {
    const v = stageVolume(3, st, reserve);
    sizes.push(v);
    reserve = drain(reserve, Math.round(v * 0.5)); // spill half, every time
  }
  check('a sloppy run starves itself stage by stage',
    sizes.every((v, i) => i === 0 || v <= sizes[i - 1]), sizes.join(' -> '));
  check('and eventually runs the tank dry', reserve < 200, `reserve ${reserve}`);
}
{
  // The capped ramp: a full-tilt pour must still come down where the bowl
  // can reach it, never off the side of the frame.
  const WORLD_COLS = Math.floor(STAGE.W / STAGE.CELL);
  const s = new Sim({ seed: 1, stage: 1, volume: 9000 });
  s.setAim(SPOUT.ANGLE_FIXED);
  s.setCork(true);
  for (let i = 0; i < 600; i++) s.tick(); // ramp to full
  const rimRow = s.mouthRow;
  const prevY = new Map();
  let landing = 0;
  for (let i = 0; i < 400; i++) {
    s.tick();
    for (const d of s.drops) {
      const py = prevY.get(d);
      const y = d.y / FP | 0;
      if (py !== undefined && py < rimRow && y >= rimRow) landing = Math.max(landing, d.x / FP | 0);
      prevY.set(d, y);
    }
  }
  check('a full-tilt pour still arcs down inside the frame',
    landing > 0 && landing < WORLD_COLS, `lands at col ${landing} of ${WORLD_COLS}`);
  check('and within the bowl\'s reach', landing <= VESSEL.MAX_COL + 6,
    `col ${landing} vs travel limit ${VESSEL.MAX_COL}`);
}

console.log('\n8. the aim preview cannot lie');
{
  // The ghost arc the player aims along must be the path the simulation
  // actually takes. If these ever diverge the game is lying to the player,
  // so this is checked against a real droplet rather than against itself.
  const angle = -12;
  const s = new Sim({ seed: 2, volume: 9000 });
  s.setAim(angle);
  s.setCork(true);
  const emitted = firstDrop(s);
  // The preview must use whatever pressure the pour is at RIGHT NOW.
  const pressure = s.pourPressure;
  const lv = launchVelocity(angle, pressure);
  check('preview and sim launch at the same velocity',
    lv.vx === emitted.vx && lv.vy === emitted.vy - PHYS.GRAVITY,
    `trace (${lv.vx},${lv.vy}) vs emitted pre-gravity (${emitted.vx},${emitted.vy - PHYS.GRAVITY})`);

  // Nozzle jitter offsets x only, so the vertical path must match exactly.
  const arc = traceArc(angle, pressure, 200);
  const realY = [emitted.y];
  for (let i = 0; i < 60 && s.drops.length; i++) { s.tick(); if (s.drops[0]) realY.push(s.drops[0].y); }
  const n = Math.min(realY.length, arc.length);
  let mismatch = -1;
  for (let i = 0; i < n; i++) if (arc[i].y !== realY[i]) { mismatch = i; break; }
  check('preview height matches the real droplet exactly', mismatch === -1 && n > 20,
    mismatch >= 0 ? `diverged at step ${mismatch}: ${arc[mismatch].y} vs ${realY[mismatch]}` : `n=${n}`);

  check('traced arc advances downrange', arc.every((p, i) => i === 0 || p.x > arc[i - 1].x));
  check('traced arc has usable length', arc.length > 20, `${arc.length} points`);
}
{
  // traceArc must not allocate a Sim or it would be re-running vessel
  // generation every frame — it is called on every render.
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 2000; i++) traceArc(-20, 5, 220);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  check('2000 previews cost under 150ms', ms < 150, `${ms.toFixed(1)}ms`);
}

console.log('\n9. two seats');
{
  const host = [1, 2, 3, 4].map((st) => seatFor('host', st));
  const guest = [1, 2, 3, 4].map((st) => seatFor('guest', st));
  check('the seats swap every stage', host.join(',') === 'catcher,pourer,catcher,pourer',
    host.join(','));
  check('the two peers are never in the same seat',
    host.every((h, i) => h !== guest[i]), `${host.join(',')} / ${guest.join(',')}`);
  check('nobody is stuck as the faucet for a whole run',
    new Set(host).size === 2 && new Set(guest).size === 2);
  check('otherSeat is its own inverse',
    otherSeat(otherSeat('catcher')) === 'catcher' && otherSeat('catcher') === 'pourer');

  // Each seat may only touch its own controls. A peer reaching into the
  // other's fields would desync rather than cheat, so the split is kept
  // explicit to make that bug obvious instead of mysterious.
  const merged = mergeInputs({ bowl: 999, spout: 40, cork: 1 }, { bowl: 150, spout: 999, cork: 0 });
  check('the pourer supplies only spout and cork', merged.spout === 40 && merged.cork === 1);
  check('the catcher supplies only the bowl', merged.bowl === 150);
  check('an empty input is all zeroes', Object.values(emptyInput()).every((v) => v === 0));
}

console.log('\n10. lockstep');
{
  const sent = [];
  const ls = createLockstep({ delay: 3, send: (m) => sent.push(m) });
  check('the opening frames need no input', ls.ready());
  ls.submitLocal({ bowl: 5, spout: 6, cork: 1 });
  check('local intent is scheduled ahead by the delay', sent[0].f === 3, `frame ${sent[0].f}`);
  check('and crosses the wire as plain integers',
    typeof sent[0].b === 'number' && typeof sent[0].s === 'number' && typeof sent[0].c === 'number');

  for (let i = 0; i < 3; i++) ls.step();
  check('it stalls rather than guessing past a missing input', ls.step() === null);
  check('and reports how far behind it is', ls.stalledFor > 0);
  ls.receive({ t: 'i', f: 3, b: 1, s: 2, c: 0 });
  const f = ls.step();
  check('and resumes once the peer catches up', f !== null && f.frame === 3);
}
{
  // Two peers, two simulations, a lagged link. They must stay bit-identical
  // and agree on the score — the whole promise of lockstep.
  const runPair = (lag) => {
    const pipe = { a: [], b: [] };
    const A = createLockstep({ delay: 6, send: (m) => pipe.a.push({ m, at: lag }) });
    const B = createLockstep({ delay: 6, send: (m) => pipe.b.push({ m, at: lag }) });
    const simA = new Sim({ seed: 9, stage: 1, volume: 2500 });
    const simB = new Sim({ seed: 9, stage: 1, volume: 2500 });
    simA.setAim(SPOUT.ANGLE_FIXED);
    simB.setAim(SPOUT.ANGLE_FIXED);
    let mismatch = null;
    for (let t = 0; t < 1200; t++) {
      for (const k of ['a', 'b']) {
        const tgt = k === 'a' ? B : A;
        const q = pipe[k];
        while (q.length && q[0].at <= 0) tgt.receive(q.shift().m);
        for (const it of q) it.at -= 1;
      }
      const bowl = 150 + Math.round(50 * Math.sin(t / 40));
      const spout = 55 + (t % 45);
      const cork = t % 300 < 250 ? 1 : 0;
      A.submitLocal({ bowl, spout: 0, cork: 0 });
      B.submitLocal({ bowl: 0, spout, cork });
      for (const [ls2, sim, catcher] of [[A, simA, true], [B, simB, false]]) {
        const fr = ls2.step();
        if (!fr) continue;
        const cin = catcher ? fr.local : fr.remote;
        const pin = catcher ? fr.remote : fr.local;
        sim.applyInput(mergeInputs(pin, cin));
        sim.tick();
        ls2.checkpoint(sim.checksum());
      }
      if (A.frame === B.frame && simA.checksum() !== simB.checksum() && !mismatch) {
        mismatch = `t=${t}`;
      }
    }
    return { mismatch, a: simA, b: simB, A, B };
  };

  for (const lag of [0, 3, 5]) {
    const r = runPair(lag);
    check(`peers stay identical at ${lag} frames of lag`,
      r.mismatch === null && !r.A.desynced && !r.B.desynced, r.mismatch || 'desync flagged');
    check(`and agree on the score at ${lag} frames of lag`,
      r.a.caught === r.b.caught && r.a.spilled === r.b.spilled,
      `caught ${r.a.caught}/${r.b.caught}, spilled ${r.a.spilled}/${r.b.spilled}`);
  }
}
{
  // Divergence must be caught and reported, never left to drift: carrying
  // on silently shows each player a different game while both believe it
  // is shared.
  let flagged = null;
  const A = createLockstep({ delay: 2, send: () => {}, onDesync: (d) => { flagged = d; } });
  A.receive({ t: 'c', f: 60, k: 123456 });
  for (let i = 0; i < 60; i++) {
    A.submitLocal({ bowl: 1, spout: 1, cork: 0 });
    A.receive({ t: 'i', f: i, b: 1, s: 1, c: 0 });
    A.step();
  }
  A.checkpoint(999);
  check('a checksum mismatch is reported loudly', flagged !== null,
    flagged ? '' : 'divergence went unnoticed');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
