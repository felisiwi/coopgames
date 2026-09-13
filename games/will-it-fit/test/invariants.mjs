// Headless invariants for Will It Fit? — no browser, no canvas. Imports
// the game's own modules and drives the simulation directly.
//
//   node games/will-it-fit/test/invariants.mjs
import { FP, GRID, SPOUT, MATERIALS, SOURCE, PHYS } from '../src/config.js';
import { generateVessel, validate, inside, rng } from '../src/vessel.js';
import { Sim, traceArc, launchVelocity } from '../src/sim.js';

let pass = 0;
let fail = 0;
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${detail}`); }
}

// Run a sim to completion (or a tick cap), returning it.
function run(sim, { ticks = 20000, aim } = {}) {
  if (aim) sim.setAim(aim.angle, aim.pressure);
  sim.setCork(true);
  for (let i = 0; i < ticks && !sim.done; i++) sim.tick();
  return sim;
}

// Search the actual control range for an aim that lands material in the
// vessel. Doubles as proof that the control space contains a solution.
function findAim(sim) {
  for (let p = SPOUT.PRESSURE_MIN; p <= SPOUT.PRESSURE_MAX; p++) {
    for (let a = SPOUT.ANGLE_MIN; a <= SPOUT.ANGLE_MAX; a++) {
      const probe = new Sim({ seed: sim.seed, stage: sim.stage, volume: 60 });
      probe.setAim(a, p);
      probe.setCork(true);
      for (let i = 0; i < 4000 && !probe.done; i++) probe.tick();
      if (probe.caught > 30) return { angle: a, pressure: p, caught: probe.caught };
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

console.log('\n2. ballistics');
{
  const sim = new Sim({ seed: 1, volume: 1 });
  sim.setAim(-30, 8);
  sim.setCork(true);
  sim.tick();
  const d = sim.drops[0];
  check('a droplet is emitted when uncorked', !!d);
  check('emitted moving forward and down-right', d.vx > 0 && d.vy > 0);

  const path = [];
  for (let i = 0; i < 30 && sim.drops.length; i++) { sim.tick(); if (sim.drops[0]) path.push(sim.drops[0].y); }
  const falls = path.every((y, i) => i === 0 || y > path[i - 1]);
  check('trajectory accelerates downward (a real arc)', falls && path.length > 5);
}
{
  const reach = (pressure) => {
    const sim = new Sim({ seed: 1, volume: 1 });
    sim.setAim(-10, pressure);
    sim.setCork(true);
    let maxCol = 0;
    for (let i = 0; i < 400 && (sim.drops.length || i === 0); i++) {
      sim.tick();
      for (const d of sim.drops) maxCol = Math.max(maxCol, d.x / FP | 0);
    }
    return maxCol;
  };
  check('more pressure throws it further', reach(9) > reach(3), `${reach(3)} -> ${reach(9)}`);
}
{
  // Convention: POSITIVE angle is above horizontal. y grows downward, so
  // "upward" means a more negative vy.
  const launch = (angle) => {
    const s = new Sim({ seed: 1, volume: 1 });
    s.setAim(angle, 9);
    s.setCork(true);
    s.tick();
    return s.drops[0];
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
    s.setAim(angle, 9);
    s.setCork(true);
    let top = Infinity;
    for (let i = 0; i < 300 && (s.drops.length || i === 0); i++) {
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
  if (aim) console.log(`       (best probe: angle ${aim.angle}, pressure ${aim.pressure}, caught ${aim.caught})`);

  if (aim) {
    const s = run(new Sim({ seed: 3, stage: 1, volume: 400 }), { aim });
    check('material actually lands in the vessel', s.caught > 100, `caught=${s.caught}`);
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
  const s = run(new Sim({ seed: 3, volume: 200 }), { aim: { angle: -70, pressure: 1 } });
  check('a hopeless aim catches nothing', s.caught === 0, `caught=${s.caught}`);
  check('and loses everything', s.spilled === 200, `spilled=${s.spilled}`);
}
{
  // The wall test. A grain must KEEP FLYING after it crosses the mouth and
  // only settle where it actually lands — converting it to a cell at the
  // rim is what made the vessel feel like a wall the stream splatted
  // against. If this count ever returns to zero, that bug is back.
  const s = new Sim({ seed: 3, stage: 1, volume: 300 });
  s.setAim(-10, 3);
  s.setCork(true);
  let peakInside = 0;
  let sawDescending = false;
  for (let i = 0; i < 20000 && !s.done; i++) {
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

console.log('\n4. conservation (the load-bearing invariant)');
{
  const sim = new Sim({ seed: 5, volume: 500 });
  const aim = findAim(sim) || { angle: -18, pressure: 5 };
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
  const s = aim ? run(sim, { aim, ticks: 60000 }) : null;
  if (!s) { check('overflow scenario ran', false, 'no viable aim found'); }
  else {
    check('vessel fills substantially', s.fillRatio > 0.5, `fill=${(s.fillRatio * 100).toFixed(0)}%`);
    check('excess overflows rather than compressing', s.spilled > 0, `spilled=${s.spilled}`);
    check('overfilling never exceeds capacity', s.caught <= s.vessel.capacity,
      `${s.caught} / ${s.vessel.capacity}`);
  }
}

console.log('\n6. determinism (lockstep depends on this)');
{
  const a = new Sim({ seed: 42, stage: 7, volume: 300 });
  const b = new Sim({ seed: 42, stage: 7, volume: 300 });
  a.setAim(-22, 6); b.setAim(-22, 6);
  a.setCork(true); b.setCork(true);
  let diverged = null;
  for (let i = 0; i < 3000 && !a.done; i++) {
    a.tick(); b.tick();
    if (a.checksum() !== b.checksum()) { diverged = `tick ${i}`; break; }
  }
  check('two sims with the same seed stay bit-identical', diverged === null, diverged || '');

  const c = new Sim({ seed: 43, stage: 7, volume: 300 });
  c.setAim(-22, 6); c.setCork(true);
  for (let i = 0; i < 300; i++) c.tick();
  const a2 = new Sim({ seed: 42, stage: 7, volume: 300 });
  a2.setAim(-22, 6); a2.setCork(true);
  for (let i = 0; i < 300; i++) a2.tick();
  check('a different seed produces a different checksum', c.checksum() !== a2.checksum());
}
{
  // The sim must not touch Math.random — that would desync peers silently.
  const real = Math.random;
  let called = 0;
  Math.random = () => { called++; return real(); };
  const s = new Sim({ seed: 9, volume: 200 });
  s.setAim(-20, 6); s.setCork(true);
  for (let i = 0; i < 1200 && !s.done; i++) s.tick();
  Math.random = real;
  check('the simulation never calls Math.random()', called === 0, `${called} calls`);
}

console.log('\n7. materials behave differently');
{
  const flatness = (key) => {
    const sim = new Sim({ seed: 21, stage: 1, material: key, volume: 700 });
    const aim = findAim(sim) || { angle: -18, pressure: 5 };
    const s = run(sim, { aim, ticks: 40000 });
    // `done` only means the source is empty and nothing is still airborne
    // — grains are still streaming down the neck at that moment. Surface
    // shape is a property of the material AT REST, so settle first.
    for (let i = 0; i < 600; i++) s.tick();
    const surf = [...s.surface()].filter((v) => v >= 0);
    if (surf.length < 4) return null;
    const avg = surf.reduce((a, b) => a + b, 0) / surf.length;
    const varc = surf.reduce((a, b) => a + (b - avg) ** 2, 0) / surf.length;
    return { rough: Math.sqrt(varc), n: surf.length };
  };
  const w = flatness('water');
  const m = flatness('magma');
  check('water settles to a flat surface', w && w.rough < 1.5, w ? `rough=${w.rough.toFixed(2)}` : 'no data');
  check('magma settles rougher than water', w && m && m.rough > w.rough,
    w && m ? `water ${w.rough.toFixed(2)} vs magma ${m.rough.toFixed(2)}` : 'no data');
}
{
  const ids = Object.values(MATERIALS).map((m) => m.id);
  check('material ids are unique and non-zero',
    new Set(ids).size === ids.length && !ids.includes(0));
}

console.log('\n8. the aim preview cannot lie');
{
  // The ghost arc the player aims along must be the path the simulation
  // actually takes. If these ever diverge the game is lying to the player,
  // so this is checked against a real droplet rather than against itself.
  const angle = -12;
  const pressure = 6;

  const lv = launchVelocity(angle, pressure);
  const s = new Sim({ seed: 2, volume: 1 });
  s.setAim(angle, pressure);
  s.setCork(true);
  s.tick();
  const emitted = s.drops[0];
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

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
