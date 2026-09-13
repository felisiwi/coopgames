// Will It Fit? — hub contract entry point.
//
//   start({ canvas, net, seed, role, players })
//
// Per games/README.md this file never imports PeerJS or shared/net.js.
//
// BUILD STAGE 1 (see DESIGN.md build plan): solo, no networking, upright
// static vessel. You play the POURER — aim by angle and pressure, pull the
// cork, land the arc in the mouth. Vessel tilt is stage 2, and the grid is
// already bottle-local so that lands as a gravity rotation rather than a
// rewrite. Lockstep sync is stage 4; `net` is accepted and unused for now.
import { STAGE, SPOUT, SOURCE, FP, TABLE_Y } from './src/config.js';
import { Sim, traceArc } from './src/sim.js';
import { drawScene, drawHud, drawBanner } from './src/draw.js';

const POOL_MAX = 600;
const SPILL_COST = 1;                          // pool drained per lost droplet
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
  let sim = makeSim();
  let running = true;

  function makeSim() {
    const material = MATERIAL_ORDER[(stage - 1) % MATERIAL_ORDER.length];
    return new Sim({ seed, stage, material, volume: SOURCE.VOLUME });
  }

  // ── input ────────────────────────────────────────────────────────────
  // Mouse aims (angle from the spout toward the cursor); wheel or W/S sets
  // pressure; click or space pulls the cork.
  const pointer = { x: STAGE.W * 0.6, y: TABLE_Y - 80 };
  let pressure = SPOUT.PRESSURE_DEFAULT;
  let corkOpen = false;

  function toStage(e) {
    const r = canvas.getBoundingClientRect();
    const scale = Math.min(canvas.width / STAGE.W, canvas.height / STAGE.H);
    const ox = (canvas.width - STAGE.W * scale) / 2;
    const oy = (canvas.height - STAGE.H * scale) / 2;
    const cx = ((e.clientX - r.left) * (canvas.width / r.width) - ox) / scale;
    const cy = ((e.clientY - r.top) * (canvas.height / r.height) - oy) / scale;
    return { x: cx, y: cy };
  }

  const onMove = (e) => { const p = toStage(e); pointer.x = p.x; pointer.y = p.y; };
  const onDown = (e) => { e.preventDefault(); corkOpen = true; };
  const onUp = () => { corkOpen = false; };
  const onWheel = (e) => {
    e.preventDefault();
    pressure = clampPressure(pressure - Math.sign(e.deltaY));
  };
  const onKey = (e) => {
    if (e.code === 'Space') { e.preventDefault(); corkOpen = e.type === 'keydown'; }
    if (e.type !== 'keydown') return;
    if (e.code === 'KeyW' || e.code === 'ArrowUp') pressure = clampPressure(pressure + 1);
    if (e.code === 'KeyS' || e.code === 'ArrowDown') pressure = clampPressure(pressure - 1);
    if (e.code === 'KeyR' && phase === 'over') restart();
  };
  const clampPressure = (p) =>
    Math.max(SPOUT.PRESSURE_MIN, Math.min(SPOUT.PRESSURE_MAX, p));

  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mouseup', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  // Angle is derived from the pointer but rounded to whole degrees before
  // it ever reaches the sim — the sim must never see a float.
  function aimAngle() {
    const dx = pointer.x - SPOUT.X;
    const dy = pointer.y - SPOUT.Y;
    const deg = Math.round((-Math.atan2(dy, dx) * 180) / Math.PI);
    return Math.max(SPOUT.ANGLE_MIN, Math.min(SPOUT.ANGLE_MAX, deg));
  }

  // Ghost arc. traceArc runs the sim's own launch and integration code, so
  // the preview cannot promise a trajectory the simulation won't follow.
  function preview() {
    const raw = traceArc(aimAngle(), pressure, 220, sim.mouthRow + sim.vessel.height);
    const pts = [];
    for (let i = 0; i < raw.length; i += 4) {
      pts.push({ x: (raw[i].x / FP) * STAGE.CELL, y: (raw[i].y / FP) * STAGE.CELL });
    }
    return pts;
  }

  // ── round flow ───────────────────────────────────────────────────────
  function endStage() {
    pool -= sim.spilled * SPILL_COST;
    if (MILESTONES.includes(stage)) pool = POOL_MAX;
    pool = Math.min(POOL_MAX, pool);
    best = Math.max(best, stage);
    if (pool <= 0) { pool = 0; phase = 'over'; }
    else { phase = 'between'; }
    phaseT = 0;
  }

  function nextStage() {
    stage += 1;
    sim = makeSim();
    phase = 'play';
    phaseT = 0;
  }

  function restart() {
    stage = 1;
    pool = POOL_MAX;
    sim = makeSim();
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
      sim.setAim(aimAngle(), pressure);
      sim.setCork(corkOpen);
      for (let i = 0; i < TICKS_PER_FRAME; i++) sim.tick();
      if (sim.done) endStage();
    } else {
      phaseT += dt;
      if (phase === 'between' && phaseT > 1.8) nextStage();
    }

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
    drawHud(ctx, sim, { stage, pool, poolMax: POOL_MAX });

    if (phase === 'between') {
      const kept = Math.round(sim.fillRatio * 100);
      drawBanner(ctx, `${kept}% caught`, `spilled ${sim.spilled} — pool ${pool}`);
    } else if (phase === 'over') {
      drawBanner(ctx, 'Out of material', `reached stage ${best} — press R to start again`);
    } else if (!corkOpen && sim.remaining === sim.startVolume) {
      drawBanner(ctx, 'Aim, then hold to pour', 'mouse aims · wheel or W/S sets pressure · hold click or space');
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
