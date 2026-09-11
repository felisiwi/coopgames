// Dino Rumble — hub contract entry point.
//
//   start({ canvas, net, seed, role, players })
//
// Per games/README.md this file never imports PeerJS or shared/net.js; the
// hub owns the connection and hands us `net`.
//
// NETCODE, and why it looks like this
// ───────────────────────────────────
// Fighting games are the most latency-sensitive genre there is, and the
// usual answers (rollback, lockstep with input delay) are weeks of work and
// assume a connection this repo has not yet verified end-to-end. So this is
// deliberately the latency-TOLERANT design instead:
//
//   * Each peer simulates only its own dino and broadcasts a snapshot at
//     NET.BROADCAST_HZ. Your own inputs are never delayed — your dino is
//     always crisp, which is the half of "feel" that matters most.
//   * The remote dino is not simulated locally at all. It plays back
//     snapshots, eased toward the latest one, so a dropped packet degrades
//     into a small glide instead of a desync.
//   * Hits are ATTACKER-authoritative: if my hitbox overlaps your hurtbox
//     on my screen, I say so and you take it. That means no "I swear that
//     hit" arguments, at the cost of being trivially cheatable — which is
//     the right trade for two friends play-fighting, and the wrong one for
//     anything competitive. If this ever needs to be fair, that is the line
//     to change.
//
// The cost is that a blocked/whiffed call can disagree by one RTT. For
// dinos bonking each other, nobody will ever notice.
import { STAGE, NET, ROUNDS, SKINS, PEP, MOVES } from './src/config.js';
import { Fighter, rectsOverlap, pushApart } from './src/fighter.js';
import { createInput, idlePad } from './src/input.js';
import { drawFighter, drawHud } from './src/draw.js';
import { createStage, createEffects } from './src/stage.js';

const SPAWN = { left: STAGE.W * 0.3, right: STAGE.W * 0.7 };

export default function start({ canvas, net, seed = 1, role = 'host', local = null }) {
  const ctx = canvas.getContext('2d');
  const stage = createStage(seed);
  const fx = createEffects();

  // `local: 'versus'` is the couch mode the dev entry uses: both dinos are
  // driven by this keyboard and nothing is sent. The hub never passes it.
  const couch = local === 'versus';

  const left = new Fighter({
    x: SPAWN.left,
    facing: 1,
    skin: SKINS.host,
    label: couch ? 'Rex (WASD + JKL)' : SKINS.host.name + (role === 'host' ? ' — you' : ''),
  });
  const right = new Fighter({
    x: SPAWN.right,
    facing: -1,
    skin: SKINS.guest,
    label: couch ? 'Tri (arrows + ,./)' : SKINS.guest.name + (role === 'guest' ? ' — you' : ''),
  });

  const mine = role === 'host' ? left : right;
  const theirs = role === 'host' ? right : left;

  const input = createInput(couch ? ['p1', 'p2'] : ['p1']);
  const myPad = () => input.pad('p1');
  const theirPad = () => (couch ? input.pad('p2') : idlePad());

  // Remote playback target. Null until the first snapshot arrives, so an
  // unconnected guest just stands still rather than snapping around.
  let remoteTarget = null;
  const landedAttacks = new Set(); // attackId values that already connected

  const scores = { left: 0, right: 0 };
  let banner = 'ROMP!';
  let bannerTime = 1.4;
  let phase = 'fight'; // fight | flopped | matchover
  let phaseTime = 0;
  let matchOverBy = null;
  let running = true;

  // ── Networking ───────────────────────────────────────────────────────

  net.onMessage((msg) => {
    if (!msg || typeof msg !== 'object') return;
    switch (msg.t) {
      case 's':
        remoteTarget = msg;
        break;
      case 'h':
        applyIncomingHit(msg);
        break;
      case 'flop':
        // They flopped: the point is mine.
        onFlop(theirs, mine);
        break;
      case 'round':
        // Host is the tiebreaker on round bookkeeping, so a guest whose
        // own hit detection disagreed still lands on the same scoreline.
        if (role === 'guest') {
          scores.left = msg.l;
          scores.right = msg.r;
        }
        break;
      default:
        break;
    }
  });

  const broadcast = setInterval(() => {
    if (couch) return;
    net.send({
      t: 's',
      x: Math.round(mine.x * 10) / 10,
      y: Math.round(mine.y * 10) / 10,
      f: mine.facing,
      st: mine.state,
      sf: Math.round(mine.stateTime * 1000) / 1000,
      mv: mine.move ? mine.move.name : null,
      p: Math.round(mine.pep * 10) / 10,
      g: mine.onGround ? 1 : 0,
    });
  }, 1000 / NET.BROADCAST_HZ);

  function applyIncomingHit(msg) {
    if (mine.flopped || phase !== 'fight') return;
    const res = mine.applyHit({
      damage: msg.d,
      knockback: msg.k,
      lift: msg.lf,
      fromDir: msg.dir,
    });
    spark(mine, msg.dir, msg.big, res.blocked);
    if (mine.flopped) {
      net.send({ t: 'flop' });
      onFlop(mine, theirs);
    }
  }

  function spark(target, dir, big, blocked) {
    const x = target.x - dir * 18;
    const y = target.y - target.height * 0.62;
    fx.hit(x, y, dir, big && !blocked);
    fx.word(x, y - 34, blocked, big);
  }

  // ── Hit detection (attacker side only) ───────────────────────────────

  function checkMyHits(attacker, defender, isLocalPair) {
    const box = attacker.activeHitbox();
    if (!box) return;
    const key = `${attacker === left ? 'L' : 'R'}:${attacker.attackId}`;
    if (landedAttacks.has(key)) return;
    if (defender.flopped || phase !== 'fight') return;
    if (!rectsOverlap(box, defender.hurtbox())) return;

    landedAttacks.add(key);
    const mv = attacker.move;
    const dir = attacker.facing;
    const big = mv === MOVES.tail;

    if (isLocalPair) {
      // Couch mode: resolve immediately, both dinos are right here.
      const res = defender.applyHit({
        damage: mv.damage,
        knockback: mv.knockback,
        lift: mv.lift,
        fromDir: dir,
      });
      spark(defender, dir, big, res.blocked);
      if (defender.flopped) onFlop(defender, attacker);
      return;
    }

    // Online: tell them, and optimistically show it here so the hit feels
    // instant. Their next snapshot is authoritative on the actual pep.
    net.send({ t: 'h', d: mv.damage, k: mv.knockback, lf: mv.lift, dir, big });
    const blockedGuess = theirs.state === 'block' && theirs.facing === -dir;
    theirs.pep = Math.max(0, theirs.pep - mv.damage * (blockedGuess ? 0.2 : 1));
    spark(theirs, dir, big, blockedGuess);
  }

  // ── Round flow ───────────────────────────────────────────────────────

  function onFlop(loser, winner) {
    if (phase !== 'fight') return;
    if (!loser.flopped) loser.setState('flop');
    if (winner === left) scores.left += 1;
    else scores.right += 1;

    fx.dust(loser.x, loser.y, 18, 220);
    phase = 'flopped';
    phaseTime = 0;

    const done = scores.left >= ROUNDS.TO_WIN || scores.right >= ROUNDS.TO_WIN;
    if (done) {
      matchOverBy = winner;
      setBanner(`${winner.skin.name} wins the romp!`, 3.2);
    } else {
      setBanner(`${loser.skin.name} is tuckered out!`, 1.8);
    }

    if (role === 'host' && !couch) {
      net.send({ t: 'round', l: scores.left, r: scores.right });
    }
  }

  function setBanner(text, time) {
    banner = text;
    bannerTime = time;
  }

  function resetRound(fullMatch) {
    if (fullMatch) {
      scores.left = 0;
      scores.right = 0;
      matchOverBy = null;
    }
    left.reset(SPAWN.left, 1);
    right.reset(SPAWN.right, -1);
    landedAttacks.clear();
    remoteTarget = null;
    phase = 'fight';
    phaseTime = 0;
    setBanner('ROMP!', 1.1);
  }

  // ── Frame ────────────────────────────────────────────────────────────

  function step(dt) {
    input.pad('p1'); // (no-op read; kept for symmetry with couch mode)

    if (phase === 'fight') {
      mine.update(dt, myPad(), theirs);
      if (couch) {
        theirs.update(dt, theirPad(), mine);
      } else {
        playbackRemote(dt);
      }
      // Resolve bodies before hits, so a shove never leaves a hitbox
      // resolving against a position the dino is about to be pushed out of.
      pushApart(mine, theirs, couch);

      checkMyHits(mine, theirs, couch);
      if (couch) checkMyHits(theirs, mine, true);

      if (mine.flopped) {
        if (!couch) net.send({ t: 'flop' });
        onFlop(mine, theirs);
      }
    } else {
      // Still animate the flop and let the dust settle.
      mine.update(dt, idlePad(), null);
      if (couch) theirs.update(dt, idlePad(), null);
      else playbackRemote(dt);

      phaseTime += dt;
      const wait = ROUNDS.FLOP_TIME + ROUNDS.RESET_PAUSE;
      if (phase === 'flopped' && phaseTime > wait) {
        resetRound(matchOverBy !== null);
      }
    }

    if (mine.dustBurst > 0.92) fx.dust(mine.x, mine.y, 6, 120);
    if (theirs.dustBurst > 0.92) fx.dust(theirs.x, theirs.y, 6, 120);

    fx.update(dt);
    bannerTime = Math.max(0, bannerTime - dt);
    input.clearPressed();
  }

  // The remote dino replays snapshots. Position eases (so 30Hz does not
  // look like 30fps); state is applied verbatim so its animation is right.
  function playbackRemote(dt) {
    theirs.anim += dt;
    theirs.flashTime = Math.max(0, theirs.flashTime - dt);
    theirs.dustBurst = Math.max(0, theirs.dustBurst - dt * 3);
    theirs.stateTime += dt;
    if (!remoteTarget) return;

    const k = 1 - Math.exp(-NET.LERP_RATE * dt);
    theirs.x += (remoteTarget.x - theirs.x) * k;
    theirs.y += (remoteTarget.y - theirs.y) * k;
    theirs.facing = remoteTarget.f;
    theirs.onGround = !!remoteTarget.g;
    theirs.pep = remoteTarget.p;
    if (theirs.state !== remoteTarget.st) {
      theirs.state = remoteTarget.st;
      theirs.stateTime = remoteTarget.sf;
      theirs.move = remoteTarget.mv ? MOVES[remoteTarget.mv] : null;
    }
  }

  function render() {
    // Letterbox the 960x540 logical stage into whatever canvas we got.
    const scale = Math.min(canvas.width / STAGE.W, canvas.height / STAGE.H);
    const ox = (canvas.width - STAGE.W * scale) / 2;
    const oy = (canvas.height - STAGE.H * scale) / 2;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#12101c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.rect(0, 0, STAGE.W, STAGE.H);
    ctx.clip();

    const t = performance.now() / 1000;
    const sh = fx.shake;
    if (sh > 0) {
      ctx.translate((Math.random() - 0.5) * 14 * sh, (Math.random() - 0.5) * 10 * sh);
    }

    stage.drawBack(ctx, t);

    // Back-to-front by feet, so whoever is nearer the camera overlaps.
    const order = left.y <= right.y ? [left, right] : [right, left];
    for (const f of order) drawFighter(ctx, f);

    fx.draw(ctx);
    stage.drawFront(ctx, t);

    drawHud(ctx, {
      left,
      right,
      scores,
      roundsToWin: ROUNDS.TO_WIN,
      banner: bannerTime > 0 ? banner : null,
      w: STAGE.W,
    });

    if (!couch && !remoteTarget) {
      waitingNote(ctx);
    }

    ctx.restore();
  }

  function waitingNote(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '600 18px ui-rounded, "Trebuchet MS", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('waiting for the other dino…', STAGE.W / 2, STAGE.H - 26);
    ctx.restore();
  }

  // Fixed-step accumulator: the state machine's frame windows are in real
  // seconds, and a 144Hz monitor must not make chomp startup shorter than
  // a 60Hz one.
  const STEP = 1 / 120;
  let acc = 0;
  let last = performance.now();

  function frame(now) {
    if (!running) return;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25; // tab was hidden; do not simulate the gap
    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard++ < 8) {
      step(STEP);
      acc -= STEP;
    }
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function destroy() {
    running = false;
    clearInterval(broadcast);
    input.destroy();
  }
  window.addEventListener('beforeunload', destroy);

  return { destroy };
}

export { PEP };
