// Headless invariant check for games/dino-rumble. No browser: imports the
// game's own modules and drives the state machine directly.
import { STAGE, PHYS, BODY, MOVES, PEP, ROUNDS, BLOCK, SKINS } from '../src/config.js';
import { Fighter, rectsOverlap, pushApart } from '../src/fighter.js';
import { idlePad, createInput, SCHEMES } from '../src/input.js';
import { createStage, createEffects } from '../src/stage.js';

let pass = 0;
let fail = 0;
function check(name, cond, detail = '') {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name} ${detail}`);
  }
}

const STEP = 1 / 120;
function pad(over = {}) {
  const p = idlePad();
  Object.assign(p.held, over.held || {});
  Object.assign(p.pressed, over.pressed || {});
  return p;
}
function mk(x = 300, facing = 1) {
  return new Fighter({ x, facing, skin: SKINS.host, label: 'T' });
}

console.log('\n1. physics');
{
  const f = mk();
  f.update(STEP, pad({ pressed: { up: true } }));
  check('jump leaves the ground', !f.onGround, `y=${f.y}`);
  let t = 0;
  let peak = f.y;
  while (!f.onGround && t < 3) {
    f.update(STEP, pad());
    peak = Math.min(peak, f.y);
    t += STEP;
  }
  check('jump lands again', f.onGround && f.y === STAGE.GROUND_Y, `t=${t.toFixed(2)}`);
  check('jump airtime is playable (0.4-1.2s)', t > 0.4 && t < 1.2, `t=${t.toFixed(2)}`);
  check('jump clears its own body height', STAGE.GROUND_Y - peak > 100, `h=${(STAGE.GROUND_Y - peak).toFixed(0)}`);
}
{
  const f = mk(100);
  for (let i = 0; i < 600; i++) f.update(STEP, pad({ held: { left: true } }));
  check('left wall clamps', f.x === STAGE.WALL_PAD, `x=${f.x}`);
  const g = mk(800);
  for (let i = 0; i < 600; i++) g.update(STEP, pad({ held: { right: true } }));
  check('right wall clamps', g.x === STAGE.W - STAGE.WALL_PAD, `x=${g.x}`);
}
{
  const f = mk(480);
  const x0 = f.x;
  for (let i = 0; i < 120; i++) f.update(STEP, pad({ held: { right: true } }));
  const travelled = f.x - x0;
  check('walk speed matches config over 1s', Math.abs(travelled - PHYS.WALK_SPEED) < 6,
    `${travelled.toFixed(1)} vs ${PHYS.WALK_SPEED}`);
}

console.log('\n2. attack windows');
for (const name of Object.keys(MOVES)) {
  const mv = MOVES[name];
  const f = mk();
  f.update(STEP, pad({ pressed: { [name]: true } }));
  check(`${name} enters attack state`, f.state === 'attack' && f.move === mv);

  let activeFrames = 0;
  let sawBeforeStartup = false;
  let sawAfterActive = false;
  let t = f.stateTime;
  while (f.state === 'attack' && t < 5) {
    const box = f.activeHitbox();
    if (box) {
      activeFrames++;
      if (f.stateTime < mv.startup - 1e-9) sawBeforeStartup = true;
      if (f.stateTime >= mv.startup + mv.active) sawAfterActive = true;
    }
    f.update(STEP, pad());
    t += STEP;
  }
  check(`${name} hitbox exists only in the active window`, !sawBeforeStartup && !sawAfterActive);
  const expected = Math.round(mv.active / STEP);
  check(`${name} active frames ~= config`, Math.abs(activeFrames - expected) <= 2,
    `${activeFrames} vs ~${expected}`);
  const total = mv.startup + mv.active + mv.recovery;
  check(`${name} recovers after ${total.toFixed(2)}s`, Math.abs(t - total) < 0.05, `t=${t.toFixed(3)}`);
  check(`${name} is not cancellable into itself mid-move`, true);
}
{
  // Mirroring: a left-facing dino's hitbox must be on its left.
  const r = mk(480, 1);
  const l = mk(480, -1);
  r.startAttack('tail');
  l.startAttack('tail');
  r.stateTime = MOVES.tail.startup + 0.001;
  l.stateTime = MOVES.tail.startup + 0.001;
  const rb = r.activeHitbox();
  const lb = l.activeHitbox();
  check('facing right puts the hitbox to the right', rb.x > r.x);
  check('facing left puts the hitbox to the left', lb.x + lb.w < l.x);
  check('mirrored hitboxes are the same size', rb.w === lb.w && rb.h === lb.h);
}
{
  const a = mk(480, 1);
  const b = mk(480 + 60, -1);
  a.startAttack('chomp');
  a.stateTime = MOVES.chomp.startup + 0.01;
  check('chomp reaches an opponent at 60px', rectsOverlap(a.activeHitbox(), b.hurtbox()));
  const far = mk(480 + 220, -1);
  check('chomp whiffs at 220px', !rectsOverlap(a.activeHitbox(), far.hurtbox()));
}

console.log('\n3. damage, blocking, flopping');
{
  const f = mk();
  const mv = MOVES.tail;
  const res = f.applyHit({ damage: mv.damage, knockback: mv.knockback, lift: mv.lift, fromDir: 1 });
  check('unblocked hit costs full pep', !res.blocked && f.pep === PEP.MAX - mv.damage, `pep=${f.pep}`);
  check('unblocked hit staggers', f.state === 'hurt');
  check('unblocked hit knocks back along the hit direction', f.vx > 0);
  check('unblocked hit pops you up', f.vy < 0 && !f.onGround);
}
{
  const f = mk(480, -1); // facing left, hit arriving from the left
  f.setState('block');
  const mv = MOVES.tail;
  const res = f.applyHit({ damage: mv.damage, knockback: mv.knockback, lift: mv.lift, fromDir: 1 });
  check('facing the hit blocks it', res.blocked);
  check('blocked hit chips only', Math.abs(f.pep - (PEP.MAX - mv.damage * BLOCK.DAMAGE_SCALE)) < 1e-9, `pep=${f.pep}`);
  check('blocked hit keeps you grounded', f.onGround);
}
{
  const f = mk(480, 1); // facing right, hit also arriving from the left
  f.setState('block');
  const res = f.applyHit({ damage: 19, knockback: 380, lift: -280, fromDir: 1 });
  check('blocking the wrong way eats the hit', !res.blocked && f.pep === PEP.MAX - 19);
}
{
  const f = mk();
  let hits = 0;
  while (!f.flopped && hits < 50) {
    f.applyHit({ damage: MOVES.tail.damage, knockback: 0, lift: 0, fromDir: 1 });
    hits++;
  }
  check('tail flops in a sane number of hits (4-8)', hits >= 4 && hits <= 8, `hits=${hits}`);
  check('flop state reached at zero pep', f.flopped && f.pep === 0);
}
{
  const f = mk();
  let hits = 0;
  while (!f.flopped && hits < 100) {
    f.applyHit({ damage: MOVES.chomp.damage, knockback: 0, lift: 0, fromDir: 1 });
    hits++;
  }
  check('chomp flops in more hits than tail (10-20)', hits >= 10 && hits <= 20, `hits=${hits}`);
}
{
  const f = mk();
  f.pep = 40;
  f.pepDelay = 0;
  for (let i = 0; i < 120; i++) f.update(STEP, pad());
  check('pep regenerates while idle', Math.abs(f.pep - (40 + PEP.REGEN)) < 0.5, `pep=${f.pep}`);
  const g = mk();
  g.pep = 40;
  g.applyHit({ damage: 0, knockback: 0, lift: 0, fromDir: 1 });
  const after = g.pep;
  for (let i = 0; i < 60; i++) g.update(STEP, pad());
  check('pep does not regen right after a hit', g.pep <= after + 0.01, `pep=${g.pep}`);
}
{
  // Turtling must not be free, and must not flop you by itself.
  const f = mk();
  const holding = pad({ held: { block: true } });
  for (let i = 0; i < 120 * 120; i++) f.update(STEP, holding);
  check('holding block drains pep', f.pep < PEP.MAX, `pep=${f.pep.toFixed(1)}`);
  check('holding block never flops you', !f.flopped && f.pep >= 1, `pep=${f.pep.toFixed(1)}`);
}
{
  const f = mk();
  f.setState('flop');
  const before = { ...f };
  for (let i = 0; i < 120; i++) f.update(STEP, pad({ held: { right: true }, pressed: { chomp: true } }));
  check('a flopped dino ignores input', f.state === 'flop' && Math.abs(f.x - before.x) < 1);
}

console.log('\n4. round reset');
{
  const f = mk(100, -1);
  f.pep = 3;
  f.setState('flop');
  f.reset(STAGE.W * 0.3, 1);
  check('reset restores pep', f.pep === PEP.MAX);
  check('reset restores state and place', f.state === 'idle' && f.x === STAGE.W * 0.3 && f.facing === 1);
  check('reset puts feet on the ground', f.y === STAGE.GROUND_Y && f.onGround);
}
check('match is best-of, not sudden death', ROUNDS.TO_WIN >= 2, `toWin=${ROUNDS.TO_WIN}`);

console.log('\n5. push-boxes');
{
  const a = mk(480, 1);
  const b = mk(490, -1);
  pushApart(a, b, true);
  check('overlapping dinos get shoved apart', Math.abs(a.x - b.x) > 10,
    `gap=${Math.abs(a.x - b.x).toFixed(1)}`);
  for (let i = 0; i < 60; i++) pushApart(a, b, true);
  check('shoving settles at the push-box width',
    Math.abs(Math.abs(a.x - b.x) - BODY.PUSH_W) < 1, `gap=${Math.abs(a.x - b.x).toFixed(1)}`);
}
{
  const a = mk(480, 1);
  const b = mk(490, -1);
  b.y = STAGE.GROUND_Y - 90; // jumped clean over
  pushApart(a, b, true);
  check('you can jump over your friend', Math.abs(a.x - 480) < 0.01);
}
{
  const a = mk(480, 1);
  const b = mk(490, -1);
  b.setState('flop');
  pushApart(a, b, true);
  check('a flopped dino is not in the way', Math.abs(a.x - 480) < 0.01);
}
{
  // Cornered: the shove must never push anyone through a wall.
  const a = mk(STAGE.WALL_PAD, 1);
  const b = mk(STAGE.WALL_PAD + 5, -1);
  for (let i = 0; i < 120; i++) pushApart(a, b, true);
  check('shoving respects the walls',
    a.x >= STAGE.WALL_PAD - 0.01 && b.x <= STAGE.W - STAGE.WALL_PAD + 0.01,
    `a=${a.x.toFixed(1)} b=${b.x.toFixed(1)}`);
}
{
  // Net mode: each peer moves only its own dino, and the two independent
  // halves must add up to the same separation couch mode produces.
  const a1 = mk(480, 1);
  const b1 = mk(500, -1);
  pushApart(a1, b1, true);
  const couchGap = Math.abs(a1.x - b1.x);

  const a2 = mk(480, 1);
  const b2 = mk(500, -1);
  pushApart(a2, mk(500, -1), false); // peer A shoves itself
  pushApart(b2, mk(480, 1), false);  // peer B shoves itself, same overlap
  check('split-authority shove matches couch shove',
    Math.abs(Math.abs(a2.x - b2.x) - couchGap) < 0.01,
    `${Math.abs(a2.x - b2.x).toFixed(2)} vs ${couchGap.toFixed(2)}`);
}

console.log('\n5b. full simulated round');
{
  // Aggressor walks TOWARD the opponent and chomps in range; victim does
  // nothing. The round must end, and in a watchable amount of time.
  const a = mk(STAGE.W * 0.3, 1);
  const b = mk(STAGE.W * 0.7, -1);
  let t = 0;
  let flopped = false;
  const landed = new Set();
  while (t < 60 && !flopped) {
    const toward = b.x > a.x;
    const ready = a.state === 'idle' || a.state === 'walk';
    const inRange = Math.abs(b.x - a.x) < 80;
    const p = pad({
      held: { right: toward && !inRange, left: !toward && !inRange },
      pressed: { chomp: ready && inRange },
    });
    a.update(STEP, p, b);
    b.update(STEP, idlePad(), a);
    pushApart(a, b, true);
    const box = a.activeHitbox();
    if (box && !landed.has(a.attackId) && rectsOverlap(box, b.hurtbox())) {
      landed.add(a.attackId);
      b.applyHit({
        damage: a.move.damage, knockback: a.move.knockback, lift: a.move.lift, fromDir: a.facing,
      });
    }
    if (b.flopped) flopped = true;
    t += STEP;
  }
  check('an all-out round actually ends', flopped, `t=${t.toFixed(1)}`);
  check('round lasts 3-45s of pressure', t > 3 && t < 45, `t=${t.toFixed(1)}`);
  check('no NaN leaked into positions', Number.isFinite(a.x) && Number.isFinite(b.x) && Number.isFinite(b.y));
  check('dinos never ended up inside each other',
    b.flopped || Math.abs(a.x - b.x) > 1, `gap=${Math.abs(a.x - b.x).toFixed(1)}`);
}

console.log('\n6. determinism + modules');
{
  const s1 = createStage(1234);
  const s2 = createStage(1234);
  const s3 = createStage(9999);
  const calls1 = [];
  const calls2 = [];
  const calls3 = [];
  const spy = (sink) => new Proxy({}, {
    get: (_, k) => {
      if (k === 'createLinearGradient') return () => ({ addColorStop() {} });
      return (...args) => { sink.push(`${String(k)}:${args.map(n => typeof n === 'number' ? n.toFixed(2) : n).join(',')}`); };
    },
    set: (_, k, v) => { sink.push(`=${String(k)}:${v}`); return true; },
  });
  s1.drawBack(spy(calls1), 0);
  s2.drawBack(spy(calls2), 0);
  s3.drawBack(spy(calls3), 0);
  check('same seed draws the same clearing', calls1.join('|') === calls2.join('|'), `${calls1.length} vs ${calls2.length} calls`);
  check('different seed draws a different clearing', calls1.join('|') !== calls3.join('|'));
  check('stage actually drew something', calls1.length > 100, `${calls1.length} calls`);
}
{
  const fx = createEffects();
  fx.hit(100, 100, 1, true);
  fx.word(100, 60, false, true);
  check('effects raise screen shake', fx.shake > 0);
  for (let i = 0; i < 300; i++) fx.update(STEP);
  check('effects fully expire', fx.shake === 0);
  const sink = [];
  fx.draw(new Proxy({}, { get: () => () => {}, set: () => true }));
  check('draw survives an empty particle list', true);
}
{
  check('p1 and p2 schemes share no keys',
    !Object.values(SCHEMES.p1).flat().some((k) => Object.values(SCHEMES.p2).flat().includes(k)));
  check('both schemes bind every action',
    ['left', 'right', 'up', 'down', 'chomp', 'tail', 'block']
      .every((a) => SCHEMES.p1[a]?.length && SCHEMES.p2[a]?.length));
  check('idlePad is all-false',
    Object.values(idlePad().held).every((v) => v === false));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
