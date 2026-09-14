// Will It Fit? — hub contract entry point.
//
//   start({ canvas, net, seed, role, players })
//
// Per games/README.md this file never imports PeerJS or shared/net.js.
//
// BUILD STAGE 2 (see DESIGN.md build plan): solo, no networking. You play
// the CATCHER, which is the skill seat — move the bowl to intercept a
// stream that will not stay still, without leaning so hard that you slop
// what you have already caught. The source aims itself, sweeping slowly, so
// there is always somewhere to be. Tap to unstop it (Q23).
//
// Tilt is not a separate control: it is induced by how fast you move. A
// free tilt would only ever cost you, so nobody would use it. Lockstep sync
// is stage 4; `net` is accepted and unused for now.
import { STAGE, SPOUT, FP, TABLE_Y, VESSEL } from './src/config.js';
import { Sim, traceArc } from './src/sim.js';
import { drawScene, drawHud, drawBanner } from './src/draw.js';

// Reserve economy. A stage pours SOURCE.VOLUME (~2800) grains, so the
// reserve has to be several stages deep or one bad pour ends the run. At
// 3500 a sloppy stage (~800 spilled) costs about a quarter, and the
// milestone refills at 10/20/40... are real relief. Guesswork until played.
const POOL_MAX = 3500;
const SPILL_COST = 1;                          // reserve drained per grain lost
const MILESTONES = [10, 20, 40, 80, 160, 320]; // doubling, forever (Q14)
const MATERIAL_ORDER = ['water', 'slush', 'magma'];
const TICKS_PER_FRAME = 1;                     // sim ticks per rendered frame — slow on purpose

export default function start({ canvas, net, seed = 1 }) {
  const ctx = canvas.getContext('2d');

  let stage = 1;
  let pool = POOL_MAX;
  let best = 1;
  let phase = 'play'; // play | between | over
  let phaseT = 0;
  let poolShown = POOL_MAX; // eased toward `pool` so the meter glides
  let dryStage = false;     // finished a stage having caught nothing
  let sim = makeSim();
  let running = true;

  function makeSim() {
    const material = MATERIAL_ORDER[(stage - 1) % MATERIAL_ORDER.length];
    return new Sim({ seed, stage, material });
  }

  // ── input ────────────────────────────────────────────────────────────
  // Mouse aims (angle from the spout toward the cursor); wheel or W/S sets
  // pressure; click or space pulls the cork.
  const pointer = { x: STAGE.W * 0.5, y: TABLE_Y - 80 };
  let corkOpen = false;
  let vesselCol = null;   // where the bowl is, in world cells
  let lastVesselCol = null;
  let leanSpeed = 0;      // smoothed travel speed, drives the lean

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
    const raw = traceArc(autoAim(), sim.pourPressure, 220, sim.mouthRow + sim.vessel.height);
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
    pool = Math.max(0, pool - newly * SPILL_COST);
    if (pool === 0) { best = Math.max(best, stage); phase = 'over'; phaseT = 0; }
  }

  function endStage() {
    if (MILESTONES.includes(stage)) pool = POOL_MAX;
    pool = Math.min(POOL_MAX, pool);
    best = Math.max(best, stage);
    // Pouring a whole stage away without catching a single grain ends the
    // run outright, however much reserve is left. There is no recovering
    // from not playing.
    dryStage = sim.caught === 0;
    phase = (pool <= 0 || dryStage) ? 'over' : 'between';
    phaseT = 0;
  }

  function nextStage() {
    stage += 1;
    sim = makeSim();
    countedSpill = 0;
    vesselCol = null;
    phase = 'play';
    phaseT = 0;
  }

  function restart() {
    stage = 1;
    pool = POOL_MAX;
    poolShown = POOL_MAX;
    dryStage = false;
    leanSpeed = 0;
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

    if (phase === 'play') {
      // Where the bowl should be: straight under the pointer, clamped to
      // the plinth's travel. Position is instant (Q2) — only the lean is a
      // consequence.
      const wantCol = Math.max(
        VESSEL.MIN_COL,
        Math.min(VESSEL.MAX_COL, Math.round(pointer.x / STAGE.CELL)),
      );
      if (vesselCol === null) { vesselCol = wantCol; lastVesselCol = wantCol; }
      vesselCol = wantCol;

      // Lean from travel speed. Instant in both directions: stop moving and
      // you are upright on the same frame, so it stays predictable.
      // Smoothed travel speed. A raw per-frame delta is far too noisy to
      // drive a lean — it made the bowl judder.
      const speed = vesselCol - lastVesselCol;
      lastVesselCol = vesselCol;
      leanSpeed += (speed - leanSpeed) / VESSEL.TILT_SMOOTH;
      const lean = Math.max(-1, Math.min(1, leanSpeed / VESSEL.SPEED_FOR_MAX_TILT))
        * VESSEL.MAX_TILT;
      const basePivot = sim.col0 + ((sim.vessel.minL + sim.vessel.maxR) >> 1);
      sim.setVessel(vesselCol - basePivot, lean);

      sim.setAim(autoAim());
      sim.setCork(corkOpen);
      for (let i = 0; i < TICKS_PER_FRAME; i++) sim.tick();
      drainForSpills();
      if (phase === 'play' && sim.done) endStage();
    } else {
      phaseT += dt;
      if (phase === 'between' && phaseT > 1.8) nextStage();
    }

    // Ease the meter toward its true value rather than snapping. Frame-rate
    // independent, so it glides the same on 60Hz and 144Hz.
    poolShown += (pool - poolShown) * (1 - Math.exp(-6 * dt));
    if (Math.abs(pool - poolShown) < 0.5) poolShown = pool;

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
    drawHud(ctx, sim, { stage, pool: poolShown, poolMax: POOL_MAX });

    if (phase === 'between') {
      const kept = Math.round(sim.fillRatio * 100);
      drawBanner(ctx, `${kept}% caught`, `reserve ${Math.round(pool)}`);
    } else if (phase === 'over') {
      drawBanner(ctx,
        dryStage ? 'Not a drop caught' : 'The reserve is empty',
        `reached stage ${best} — press R, or tap, to begin again`);
    } else if (!corkOpen && sim.remaining === sim.startVolume) {
      drawBanner(ctx, 'Move the bowl, then pour',
        'move to place the bowl · hold to pour, it builds the longer you hold · moving fast makes it lean');
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

export { MILESTONES, POOL_MAX, MATERIAL_ORDER, SPILL_COST };
