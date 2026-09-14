// Paper cut-out rendering. Everything here is float-friendly — the
// determinism rule applies to the simulation, not to pixels.
import { STAGE, GRID, PALETTE, SPOUT, MATERIAL_BY_ID, TABLE_Y, FP } from './config.js';

const CELL = STAGE.CELL;

export function drawScene(ctx, sim, { aimPreview = [], flowing = false } = {}) {
  drawBackground(ctx, sim);
  drawSpout(ctx, sim);
  drawPreview(ctx, aimPreview);
  // The vessel and everything in it are drawn in the vessel's own frame —
  // the sim already works that way, so rendering just mirrors the same
  // transform: slide along the plinth, then rotate about the base.
  ctx.save();
  const cx = (sim.col0 + ((sim.vessel.minL + sim.vessel.maxR) >> 1)) * CELL;
  const cy = sim.pivotRow * CELL;
  ctx.translate(sim.offset * CELL, 0);
  ctx.translate(cx, cy);
  ctx.rotate((sim.tilt * Math.PI) / 180);
  ctx.translate(-cx, -cy);
  drawVesselBody(ctx, sim);
  drawMaterial(ctx, sim);
  drawVesselRim(ctx, sim);
  ctx.restore();
  drawDrops(ctx, sim);
  if (flowing) drawPourGlow(ctx, sim);
}

function drawBackground(ctx, sim) {
  const sky = ctx.createLinearGradient(0, 0, 0, STAGE.H);
  sky.addColorStop(0, PALETTE.skyTop);
  sky.addColorStop(0.75, PALETTE.skyBottom);
  sky.addColorStop(1, PALETTE.skyTop);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, STAGE.W, STAGE.H);

  // The vessel stands on a narrow plinth, NOT a floor spanning the scene.
  // A full-width table meant anything you missed fell in front of solid
  // ground, which reads as landing, not as loss. With void either side, a
  // miss visibly drops away into nothing — which is the point.
  const px0 = (sim.col0 + sim.vessel.minL + sim.offset) * CELL - 14;
  const px1 = (sim.col0 + sim.vessel.maxR + sim.offset) * CELL + 14;

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(px0 + 4, TABLE_Y + 5, px1 - px0, 9);
  ctx.restore();

  ctx.fillStyle = PALETTE.table;
  ctx.fillRect(px0, TABLE_Y, px1 - px0, 9);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(px0, TABLE_Y, px1 - px0, 2.5);

  // Depth under the plinth, fading out — the abyss grains fall into.
  const void_ = ctx.createLinearGradient(0, TABLE_Y + 9, 0, STAGE.H);
  void_.addColorStop(0, PALETTE.abyss);
  void_.addColorStop(1, 'rgba(57,68,63,0)');
  ctx.fillStyle = void_;
  ctx.fillRect(px0, TABLE_Y + 9, px1 - px0, STAGE.H - TABLE_Y - 9);
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

  // Liquids are translucent, so the vessel reads through them. Drawn as one
  // layer at a single alpha rather than per-cell, or the overlapping edges
  // of adjacent cells would darken into a grid of seams.
  ctx.save();
  ctx.globalAlpha = sim.material.alpha ?? 1;
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
  ctx.restore();
}

function drawDrops(ctx, sim) {
  const baseAlpha = sim.material.alpha ?? 1;
  for (const d of sim.drops) {
    const px = (d.x / FP) * CELL;
    const py = (d.y / FP) * CELL;

    // Grains falling past the table are on their way into the abyss, so
    // they fade out over that drop rather than blinking off at the edge.
    // Vanishing abruptly is what made a miss read as a deletion instead of
    // a loss — the same complaint as the wall at the vessel mouth.
    let a = baseAlpha;
    if (py > TABLE_Y) {
      a = baseAlpha * Math.max(0, 1 - (py - TABLE_Y) / (STAGE.H - TABLE_Y));
      if (a <= 0.01) continue;
    }

    // Stretch along travel so a fast stream reads as a stream.
    const speed = Math.hypot(d.vx, d.vy) / FP;
    const r = CELL * 0.5;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = sim.material.color;
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(d.vy, d.vx));
    ctx.beginPath();
    ctx.ellipse(0, 0, r * (1 + Math.min(2.2, speed * 0.5)), r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawSpout(ctx, sim) {
  const px = sim.spoutCol * CELL;
  const py = SPOUT.Y;
  ctx.save();
  ctx.translate(px, py);

  // Nearly twice the size it was. This is the tank — the same material the
  // meter counts — so its level has to be readable at a glance rather than
  // being a detail in the corner. A bigger vessel also means the drop in
  // level as you pour is a real, visible movement.
  const S = 1.85;
  ctx.scale(S, S);

  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-46, -52);
    ctx.lineTo(22, -52);
    ctx.quadraticCurveTo(30, -20, 16, -4);
    ctx.lineTo(-40, -4);
    ctx.quadraticCurveTo(-54, -24, -46, -52);
    ctx.closePath();
  };

  // Paper shadow, so it reads as an object above the table rather than a
  // sticker on the background.
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = PALETTE.ink;
  ctx.translate(3, 4);
  body();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  body();
  ctx.fill();

  const left = sim.startVolume ? sim.remaining / sim.startVolume : 0;
  if (left > 0) {
    ctx.save();
    body();
    ctx.clip();
    ctx.globalAlpha = sim.material.alpha ?? 1;
    ctx.fillStyle = sim.material.color;
    ctx.fillRect(-56, -4 - 48 * left, 92, 48 * left + 2);
    // A lighter band at the surface so the level itself is legible.
    ctx.globalAlpha = 1;
    ctx.fillStyle = sim.material.color;
    ctx.fillRect(-56, -4 - 48 * left, 92, 2);
    ctx.restore();
  }

  ctx.lineWidth = 3.5;
  ctx.strokeStyle = PALETTE.vesselDark;
  ctx.lineJoin = 'round';
  body();
  ctx.stroke();
  ctx.fillStyle = PALETTE.vesselLit;
  ctx.fillRect(-42, -46, 4, 36);

  // The nozzle points where it is aiming.
  ctx.rotate((-sim.angle * Math.PI) / 180);
  ctx.fillStyle = PALETTE.vesselDark;
  ctx.fillRect(0, -6, 28, 12);
  ctx.fillStyle = PALETTE.vesselLit;
  ctx.fillRect(0, -6, 28, 3);

  // Cork, drawn plugged or pulled aside.
  ctx.fillStyle = sim.corked ? PALETTE.ink : 'rgba(46,42,58,0.25)';
  ctx.beginPath();
  ctx.arc(sim.corked ? 28 : 42, sim.corked ? 0 : -14, 6, 0, Math.PI * 2);
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
  ctx.arc(sim.spoutCol * CELL + 40, SPOUT.Y, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ── HUD ────────────────────────────────────────────────────────────────

// ONE meter. There were three, and two of them were saying the same thing
// twice: "spilled" is just the pool inverted, and the vessel's fill level is
// already visible in the vessel. What is left is the only number with a
// consequence — the pool, which now drains live as you spill rather than
// updating once between stages, where it looked like it did nothing.
//
// Everything else is shown diegetically: the source's own level is drawn in
// the source, and how full the vessel is you can simply see.
export function drawHud(ctx, sim, { stage, reserve, reserveMax }) {
  ctx.save();
  ctx.font = '600 15px ui-rounded, "Trebuchet MS", system-ui, sans-serif';
  ctx.fillStyle = PALETTE.ink;

  ctx.textAlign = 'left';
  ctx.fillText(`Stage ${stage} · ${sim.material.name}`, 24, 36);

  ctx.textAlign = 'center';
  bar(ctx, STAGE.W / 2 - 130, 22, 260, 12, reserve / reserveMax, sim.material.color);
  ctx.font = '500 12px ui-rounded, "Trebuchet MS", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(47,55,51,0.65)';
  ctx.fillText('reserve', STAGE.W / 2, 50);
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

// Portrait phones. The world is a fixed 320x200 cells and cannot be
// reshaped to suit a screen — WORLD_COLS is used by the simulation, so two
// peers on different aspect ratios would desync outright. So the honest
// answer to a tall screen is to ask for a wide one.
//
// Drawn in the canvas rather than in the page so it works through the hub
// as well as the solo entry, and deliberately NON-blocking: the simulation
// keeps running underneath, because pausing one peer of a lockstep pair
// would stall the other or desync both.
export function drawRotateHint(ctx, w, h) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'rgba(231, 234, 227, 0.93)';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const s = Math.min(w, h) / 320;

  ctx.translate(cx, cy - 30 * s);
  ctx.scale(s, s);

  // A phone, tipping.
  ctx.rotate(-0.35);
  ctx.lineWidth = 7;
  ctx.strokeStyle = PALETTE.vesselDark;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  roundRect(ctx, -42, -72, 84, 144, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = PALETTE.vesselDark;
  ctx.fillRect(-14, -62, 28, 5);
  ctx.restore();

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.ink;
  const big = Math.max(18, Math.min(34, w / 18));
  ctx.font = `700 ${big}px ui-rounded, "Trebuchet MS", system-ui, sans-serif`;
  ctx.fillText('Turn your phone sideways', cx, cy + 90 * s);
  ctx.font = `500 ${big * 0.55}px ui-rounded, "Trebuchet MS", system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(47,55,51,0.7)';
  ctx.fillText('the table is wider than it is tall', cx, cy + 90 * s + big * 1.3);
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
