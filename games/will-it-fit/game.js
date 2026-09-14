// Will It Fit? — hub contract entry point.
//
//   start({ canvas, net, seed, role, players })
//
// Per games/README.md this file never imports PeerJS or shared/net.js.
//
// BUILD STAGE 4: two seats, lockstep, solo fallback.
//
// The POURER carries the source along its run and works the cork. The
// CATCHER carries the vessel and, by moving it, makes it lean. They swap
// every stage. Solo, one person drives both and Tab switches between them.
//
// Two-player runs in LOCKSTEP: both peers simulate everything from the same
// integer input stream and only inputs cross the wire. That costs a few
// frames of input delay, which a pouring game absorbs and a fighting game
// could not — the opposite call to Dino Rumble, for the opposite reason.
//
// Solo or networked is decided by a short handshake before anything is
// simulated, so the two peers can never start from different states.
import { STAGE, SPOUT, FP, TABLE_Y, VESSEL } from './src/config.js';
import {
  RESERVE_MAX, SPILL_COST, MILESTONES,
  stageVolume, afterStage, drain, runOver,
} from './src/economy.js';
import { Sim, traceArcFromSpeed } from './src/sim.js';
import { drawScene, drawHud, drawBanner } from './src/draw.js';
import { seatFor, mergeInputs, emptyInput } from './src/seats.js';
import { createLockstep, DEFAULT_DELAY } from './src/lockstep.js';

// Materials cycle on a different period from the four vessel shapes, so
// the pairing keeps changing: clay into a plate one run, water into a wine
// bottle the next.
const MATERIAL_ORDER = ['water', 'milk', 'oil', 'smoothie', 'slush', 'clay'];
const TICKS_PER_FRAME = 1;                     // sim ticks per rendered frame — slow on purpose

const HANDSHAKE_FRAMES = 90;   // ~1.5s to find a peer before going solo

export default function start({ canvas, net, seed = 1, role = 'host' }) {
  const ctx = canvas.getContext('2d');

  let stage = 1;
  let reserve = RESERVE_MAX;
  let best = 1;
  let phase = 'play'; // play | between | over
  let phaseT = 0;
  let reserveShown = RESERVE_MAX; // eased toward `reserve` so the meter glides
  let dryStage = false;     // finished a stage having caught nothing
  let sim = makeSim();
  let running = true;

  // ── solo or networked ────────────────────────────────────────────────
  // Nothing is simulated until this is settled. If one peer started solo
  // and the other in lockstep they would be running different games from
  // frame one, so the handshake gates the whole loop rather than switching
  // mid-run.
  let mode = 'deciding';        // deciding | solo | net
  let handshakeLeft = HANDSHAKE_FRAMES;
  let sawPeer = false;
  let desyncAt = null;

  const lockstep = createLockstep({
    delay: DEFAULT_DELAY,
    send: (m) => net && net.send(m),
    onDesync: (d) => { desyncAt = d; },
  });

  if (net && net.onMessage) {
    net.onMessage((msg) => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 'hello') {
        sawPeer = true;
        // Answer, so a peer that arrived after our first hello still hears
        // one. Cheap, and it makes the handshake order-independent.
        net.send({ t: 'hello' });
        return;
      }
      if (msg.t === 'i' || msg.t === 'c') {
        sawPeer = true;
        lockstep.receive(msg);
      }
    });
  }
  if (net && net.send) net.send({ t: 'hello' });

  function makeSim() {
    const material = MATERIAL_ORDER[(stage - 1) % MATERIAL_ORDER.length];
    // The stage is poured OUT OF the reserve: a full measure if there is
    // one to spare, otherwise whatever is left. This is what makes a bad
    // stage bite — the next one is shorter, and the one after shorter
    // still, until a milestone refills the tank.
    return new Sim({ seed, stage, material, volume: stageVolume(seed, stage, reserve) });
  }

  // ── input ────────────────────────────────────────────────────────────
  // Mouse aims (angle from the spout toward the cursor); wheel or W/S sets
  // pressure; click or space pulls the cork.
  const pointer = { x: STAGE.W * 0.5, y: TABLE_Y - 80 };
  let corkOpen = false;
  // Last known value for each seat, so the seat nobody is driving this
  // frame holds still instead of snapping to zero.
  let heldBowl = (VESSEL.MIN_COL + VESSEL.MAX_COL) >> 1;
  let heldSpout = SPOUT.MIN_COL + 30;
  let heldCork = 0;
  // Which seat the mouse is driving. In two-player these are two people;
  // solo, Tab switches so the pourer's seat can be felt before the netcode
  // exists to give it to somebody else.
  let soloSeat = 'catcher';   // which seat Tab has the solo player in
  const seatNow = () => (mode === 'net' ? seatFor(role, stage) : soloSeat);

  function toStage(e) {
    const r = canvas.getBoundingClientRect();
    const scale = Math.min(canvas.width / STAGE.W, canvas.height / STAGE.H);
    const ox = (canvas.width - STAGE.W * scale) / 2;
    const oy = (canvas.height - STAGE.H * scale) / 2;
    const cx = ((e.clientX - r.left) * (canvas.width / r.width) - ox) / scale;
    const cy = ((e.clientY - r.top) * (canvas.height / r.height) - oy) / scale;
    return { x: cx, y: cy };
  }

  // Pointer events rather than mouse events, so a finger held on a phone
  // behaves exactly like a held mouse button. Pouring is a HOLD throughout:
  // press and it starts as a dribble, keep holding and it builds, let go
  // and it stops and resets.
  const onMove = (e) => { const p = toStage(e); pointer.x = p.x; pointer.y = p.y; };
  const onDown = (e) => {
    e.preventDefault();
    const p = toStage(e);
    pointer.x = p.x;
    pointer.y = p.y;
    if (phase === 'over') { restart(); return; }
    corkOpen = true;
  };
  const onUp = () => { corkOpen = false; };
  const onKey = (e) => {
    if (e.code === 'Space' || e.code === 'KeyP') {
      e.preventDefault();
      corkOpen = e.type === 'keydown' && phase !== 'over';
    }
    if (e.type !== 'keydown') return;
    if (e.code === 'Tab') {
      e.preventDefault();
      // Only meaningful solo: in a two-player game the seats are handed
      // out by role and swap on their own each stage.
      if (mode !== 'net') soloSeat = soloSeat === 'catcher' ? 'pourer' : 'catcher';
    }
    if (e.code === 'KeyR' && phase === 'over') restart();
  };

  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  // The source aims itself, sweeping slowly back and forth so the stream
  // never stays put. That sweep is what forces the catcher to move, and
  // moving is what induces the lean that spills a full bowl — the whole
  // loop of the game hangs off it. Seeded from the stage so both peers
  // (stage 4) see the identical sweep without syncing anything.
  // Fixed. The stream walks outward on its own as the pour builds, so there
  // is no need to wave it about — and the sweep that used to do that is
  // what made the chase feel like it was looping.
  function autoAim() {
    return SPOUT.ANGLE_FIXED;
  }

  // Ghost arc. traceArc runs the sim's own launch and integration code, so
  // the preview cannot promise a trajectory the simulation won't follow.
  function preview() {
    const raw = traceArcFromSpeed(autoAim(), sim.speedFP, 220, sim.mouthRow + sim.vessel.height);
    const pts = [];
    for (let i = 0; i < raw.length; i += 4) {
      pts.push({ x: (raw[i].x / FP) * STAGE.CELL, y: (raw[i].y / FP) * STAGE.CELL });
    }
    return pts;
  }

  // ── round flow ───────────────────────────────────────────────────────
  // The reserve drains LIVE, one unit per grain lost, rather than being
  // reconciled once the stage ends. Settling up afterwards is why it looked
  // like it did nothing: the only meter on screen sat still through the one
  // part of the game where you can affect it.
  let countedSpill = 0;
  function drainForSpills() {
    const newly = sim.spilled - countedSpill;
    if (newly <= 0) return;
    countedSpill = sim.spilled;
    reserve = drain(reserve, newly);
    if (reserve === 0) { best = Math.max(best, stage); phase = 'over'; phaseT = 0; }
  }

  function endStage() {
    reserve = afterStage(reserve, stage);
    best = Math.max(best, stage);
    // Pouring a whole stage away without catching a single grain ends the
    // run outright, however much reserve is left. There is no recovering
    // from not playing.
    dryStage = sim.caught === 0;
    phase = runOver(reserve, sim.caught) ? 'over' : 'between';
    phaseT = 0;
  }

  function nextStage() {
    stage += 1;
    sim = makeSim();
    countedSpill = 0;
    phase = 'play';
    phaseT = 0;
  }

  function restart() {
    stage = 1;
    reserve = RESERVE_MAX;
    reserveShown = RESERVE_MAX;
    dryStage = false;
    sim = makeSim();
    countedSpill = 0;
    phase = 'play';
    phaseT = 0;
  }

  // ── frame ────────────────────────────────────────────────────────────
  let last = performance.now();
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;

    // Settle solo-or-networked before simulating anything at all.
    if (mode === 'deciding') {
      handshakeLeft -= 1;
      if (sawPeer) mode = 'net';
      else if (handshakeLeft <= 0) mode = 'solo';
      else if (handshakeLeft % 30 === 0 && net && net.send) net.send({ t: 'hello' });
      render();
      requestAnimationFrame(frame);
      return;
    }

    if (phase === 'play') {
      const seat = seatNow();
      const pointerCol = Math.round(pointer.x / STAGE.CELL);

      // This peer's intent, for its own seat only. Integers, because this
      // is exactly what goes on the wire.
      const mine = emptyInput();
      if (seat === 'catcher') {
        mine.bowl = Math.max(VESSEL.MIN_COL, Math.min(VESSEL.MAX_COL, pointerCol));
        heldBowl = mine.bowl;
      } else {
        mine.spout = pointerCol;
        mine.cork = corkOpen ? 1 : 0;
        heldSpout = mine.spout;
        heldCork = mine.cork;
      }

      if (mode === 'solo') {
        // One pair of hands: the seat you are not in holds its last value.
        const merged = mergeInputs(
          { spout: seat === 'pourer' ? mine.spout : heldSpout,
            cork: seat === 'pourer' ? mine.cork : heldCork },
          { bowl: seat === 'catcher' ? mine.bowl : heldBowl },
        );
        sim.applyInput(merged);
        for (let i = 0; i < TICKS_PER_FRAME; i++) sim.tick();
        drainForSpills();
        if (phase === 'play' && sim.done) endStage();
      } else {
        lockstep.submitLocal(mine);
        const f = lockstep.step();
        if (f) {
          const iAmCatcher = seat === 'catcher';
          const catcherIn = iAmCatcher ? f.local : f.remote;
          const pourerIn = iAmCatcher ? f.remote : f.local;
          sim.applyInput(mergeInputs(pourerIn, catcherIn));
          for (let i = 0; i < TICKS_PER_FRAME; i++) sim.tick();
          lockstep.checkpoint(sim.checksum());
          drainForSpills();
          if (phase === 'play' && sim.done) endStage();
        }
        // If f is null the other peer's input for this frame has not
        // arrived. Hold the picture exactly where it is rather than
        // simulating ahead and guessing — a wrong guess is a desync.
      }
    } else {
      phaseT += dt;
      if (phase === 'between' && phaseT > 1.8) nextStage();
    }

    // Ease the meter toward its true value rather than snapping. Frame-rate
    // independent, so it glides the same on 60Hz and 144Hz.
    reserveShown += (reserve - reserveShown) * (1 - Math.exp(-6 * dt));
    if (Math.abs(reserve - reserveShown) < 0.5) reserveShown = reserve;

    render();
    requestAnimationFrame(frame);
  }

  function render() {
    const scale = Math.min(canvas.width / STAGE.W, canvas.height / STAGE.H);
    const ox = (canvas.width - STAGE.W * scale) / 2;
    const oy = (canvas.height - STAGE.H * scale) / 2;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#E4D7E6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.rect(0, 0, STAGE.W, STAGE.H);
    ctx.clip();

    drawScene(ctx, sim, {
      aimPreview: phase === 'play' && !corkOpen ? preview() : [],
      flowing: sim.flowing,
    });
    drawHud(ctx, sim, { stage, reserve: reserveShown, reserveMax: RESERVE_MAX });

    if (phase === 'between') {
      const kept = Math.round(sim.fillRatio * 100);
      drawBanner(ctx, `${kept}% caught`, `reserve ${Math.round(reserve)}`);
    } else if (mode === 'deciding') {
      drawBanner(ctx, 'Looking for a partner…', 'starts solo if nobody joins');
    } else if (desyncAt) {
      drawBanner(ctx, 'Out of step',
        `the two sides diverged at frame ${desyncAt.frame} — reload to resync`);
    } else if (mode === 'net' && lockstep.waiting && lockstep.stalledFor > 12) {
      drawBanner(ctx, 'Waiting for your partner…', `${lockstep.stalledFor} frames behind`);
    } else if (phase === 'over') {
      drawBanner(ctx,
        dryStage ? 'Not a drop caught' : 'The reserve is empty',
        `reached stage ${best} — press R, or tap, to begin again`);
    } else if (!corkOpen && sim.remaining === sim.startVolume) {
      drawBanner(ctx, seatNow() === 'catcher' ? 'Catch it' : 'Pour it',
        mode === 'net'
          ? (seatNow() === 'catcher'
            ? 'move to place the bowl — your partner pours'
            : 'move to carry the pot · hold to pour — your partner catches')
          : 'move · hold to pour · Tab to swap seats');
    }
    ctx.restore();
  }
  requestAnimationFrame(frame);

  function destroy() {
    running = false;
    canvas.removeEventListener('mousemove', onMove);
    canvas.removeEventListener('mousedown', onDown);
    window.removeEventListener('mouseup', onUp);
    canvas.removeEventListener('wheel', onWheel);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
  }
  window.addEventListener('beforeunload', destroy);
  return { destroy };
}

export { MATERIAL_ORDER };
