// Paper cut-out rendering. Everything here is float-friendly — the
// determinism rule applies to the simulation, not to pixels.
import { STAGE, GRID, PALETTE, SPOUT, MATERIAL_BY_ID, TABLE_Y, FP } from './config.js';

const CELL = STAGE.CELL;

export function drawScene(ctx, sim, { aimPreview = [], flowing = false } = {}) {
  drawBackground(ctx);
  drawSpout(ctx, sim);
  drawPreview(ctx, aimPreview);
  drawVesselBody(ctx, sim);
  drawMaterial(ctx, sim);
  drawVesselRim(ctx, sim);
  drawDrops(ctx, sim);
  if (flowing) drawPourGlow(ctx, sim);
}

function drawBackground(ctx) {
  const sky = ctx.createLinearGradient(0, 0, 0, TABLE_Y);
  sky.addColorStop(0, PALETTE.skyTop);
  sky.addColorStop(1, PALETTE.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, STAGE.W, TABLE_Y);

  // The table is a paper strip; below it is the abyss spilled material
  // falls into, so it fades rather than ending in a hard floor.
  ctx.fillStyle = PALETTE.table;
  ctx.fillRect(0, TABLE_Y, STAGE.W, 10);
  const void_ = ctx.createLinearGradient(0, TABLE_Y + 10, 0, STAGE.H);
  void_.addColorStop(0, PALETTE.abyss);
  void_.addColorStop(1, 'rgba(74,68,88,0)');
  ctx.fillStyle = void_;
  ctx.fillRect(0, TABLE_Y + 10, STAGE.W, STAGE.H - TABLE_Y - 10);
}

// Vessel outline as a single polygon, walked down the left edge and back
// up the right. Rows are the source of truth, so bellies and necks need no
// special cases.
function vesselPath(ctx, sim) {
  const v = sim.vessel;
  const x0 = sim.col0 * CELL;
  const y0 = sim.mouthRow * CELL;
  ctx.beginPath();
  for (let y = 0; y < v.height; y++) {
    const r = v.rows[y];
    const px = x0 + r.l * CELL;
    const py = y0 + y * CELL;
    if (y === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
    ctx.lineTo(px, py + CELL);
  }
  for (let y = v.height - 1; y >= 0; y--) {
    const r = v.rows[y];
    const px = x0 + r.r * CELL;
    const py = y0 + y * CELL;
    ctx.lineTo(px, py + CELL);
    ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawVesselBody(ctx, sim) {
  ctx.save();
  // Paper drop shadow.
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = PALETTE.ink;
  ctx.translate(5, 6);
  vesselPath(ctx, sim);
  ctx.fill();
  ctx.restore();

  // Interior: the hollow the material lives in.
  ctx.save();
  vesselPath(ctx, sim);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
  ctx.restore();
}

// Walls drawn after the material so the material reads as behind glass.
function drawVesselRim(ctx, sim) {
  const v = sim.vessel;
  const x0 = sim.col0 * CELL;
  const y0 = sim.mouthRow * CELL;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 5;
  ctx.strokeStyle = PALETTE.vesselDark;
  vesselPath(ctx, sim);
  ctx.stroke();

  // Two-toned paper: a lit facet down the left wall.
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = PALETTE.vesselLit;
  ctx.beginPath();
  for (let y = 0; y < v.height; y++) {
    const r = v.rows[y];
    const px = x0 + r.l * CELL + 4;
    const py = y0 + y * CELL;
    if (y === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Mouth lip, so the aperture reads clearly — it is the thing you aim at.
  const m = v.mouth;
  ctx.lineWidth = 6;
  ctx.strokeStyle = PALETTE.vesselDark;
  ctx.beginPath();
  ctx.moveTo(x0 + m.l * CELL - 7, y0);
  ctx.lineTo(x0 + m.l * CELL, y0);
  ctx.moveTo(x0 + m.r * CELL, y0);
  ctx.lineTo(x0 + m.r * CELL + 7, y0);
  ctx.stroke();
  ctx.restore();
}

function drawMaterial(ctx, sim) {
  const x0 = sim.col0 * CELL;
  const y0 = sim.mouthRow * CELL;
  const g = sim.grid;
  const surf = sim.surface();

  for (let y = 0; y < sim.vessel.height; y++) {
    for (let x = 0; x < GRID.W; x++) {
      const id = g[y * GRID.W + x];
      if (!id) continue;
      const mat = MATERIAL_BY_ID[id];
      // Top-of-column cells get the lighter tone, which is what makes the
      // surface legible as a surface rather than a solid block.
      ctx.fillStyle = surf[x] === y ? mat.color : mat.shade;
      ctx.fillRect(x0 + x * CELL, y0 + y * CELL, CELL + 0.5, CELL + 0.5);
    }
  }
}

function drawDrops(ctx, sim) {
  ctx.fillStyle = sim.material.color;
  for (const d of sim.drops) {
    const px = (d.x / FP) * CELL;
    const py = (d.y / FP) * CELL;
    // Stretch along travel so a fast stream reads as a stream.
    const speed = Math.hypot(d.vx, d.vy) / FP;
    const r = CELL * 0.5;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(d.vy, d.vx));
    ctx.beginPath();
    ctx.ellipse(0, 0, r * (1 + Math.min(2.2, speed * 0.5)), r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawSpout(ctx, sim) {
  const px = SPOUT.X;
  const py = SPOUT.Y;
  ctx.save();
  ctx.translate(px, py);

  // Vessel body of the source, hanging above.
  ctx.fillStyle = PALETTE.vesselDark;
  ctx.beginPath();
  ctx.moveTo(-46, -52);
  ctx.lineTo(22, -52);
  ctx.quadraticCurveTo(30, -20, 16, -4);
  ctx.lineTo(-40, -4);
  ctx.quadraticCurveTo(-54, -24, -46, -52);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.vesselLit;
  ctx.fillRect(-40, -46, 10, 36);

  // The nozzle points where you're aiming.
  ctx.rotate((-sim.angle * Math.PI) / 180);
  ctx.fillStyle = PALETTE.vesselDark;
  ctx.fillRect(0, -7, 30, 14);
  ctx.fillStyle = PALETTE.vesselLit;
  ctx.fillRect(0, -7, 30, 4);

  // Cork, drawn plugged or pulled aside.
  ctx.fillStyle = sim.corked ? PALETTE.ink : 'rgba(46,42,58,0.25)';
  ctx.beginPath();
  ctx.arc(sim.corked ? 30 : 46, sim.corked ? 0 : -16, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Ghost arc. Runs the SAME integer maths as the sim so the preview cannot
// promise a path the simulation won't take.
function drawPreview(ctx, pts) {
  if (!pts.length) return;
  ctx.save();
  for (let i = 0; i < pts.length; i++) {
    const t = 1 - i / pts.length;
    ctx.globalAlpha = 0.10 + t * 0.30;
    ctx.fillStyle = PALETTE.vesselDark;
    ctx.beginPath();
    ctx.arc(pts[i].x, pts[i].y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPourGlow(ctx, sim) {
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = sim.material.color;
  ctx.beginPath();
  ctx.arc(SPOUT.X + 28, SPOUT.Y, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ── HUD ────────────────────────────────────────────────────────────────

export function drawHud(ctx, sim, { stage, pool, poolMax }) {
  ctx.save();
  ctx.font = '600 15px ui-rounded, "Trebuchet MS", system-ui, sans-serif';
  ctx.fillStyle = PALETTE.ink;

  ctx.textAlign = 'left';
  ctx.fillText(`Stage ${stage}`, 24, 34);
  ctx.fillText(`${sim.material.name}`, 24, 54);

  // Source remaining.
  bar(ctx, 24, 64, 150, 10, sim.remaining / sim.startVolume, sim.material.color);
  ctx.fillText('source', 24, 90);

  // Fill level of the vessel.
  ctx.textAlign = 'right';
  const pct = Math.round(sim.fillRatio * 100);
  ctx.fillText(`${pct}% full`, STAGE.W - 24, 34);
  bar(ctx, STAGE.W - 174, 44, 150, 10, sim.fillRatio, PALETTE.vesselDark);

  ctx.fillText(`spilled ${sim.spilled}`, STAGE.W - 24, 78);

  // The pool — the only real stake.
  ctx.textAlign = 'center';
  ctx.fillText('pool', STAGE.W / 2, 34);
  bar(ctx, STAGE.W / 2 - 110, 44, 220, 12, pool / poolMax, '#C2410C');
  ctx.restore();
}

function bar(ctx, x, y, w, h, ratio, color) {
  const k = Math.max(0, Math.min(1, ratio || 0));
  ctx.save();
  ctx.fillStyle = 'rgba(74,68,88,0.15)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * k, h);
  ctx.strokeStyle = 'rgba(74,68,88,0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.restore();
}

export function drawBanner(ctx, text, sub) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(246,233,220,0.88)';
  ctx.fillRect(0, STAGE.H / 2 - 62, STAGE.W, 118);
  ctx.fillStyle = PALETTE.ink;
  ctx.font = '700 40px ui-rounded, "Trebuchet MS", system-ui, sans-serif';
  ctx.fillText(text, STAGE.W / 2, STAGE.H / 2 - 8);
  if (sub) {
    ctx.font = '500 17px ui-rounded, "Trebuchet MS", system-ui, sans-serif';
    ctx.fillText(sub, STAGE.W / 2, STAGE.H / 2 + 26);
  }
  ctx.restore();
}
