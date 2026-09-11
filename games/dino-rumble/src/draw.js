// Procedural dinosaurs. No sprite sheet on purpose: the repo's asset rules
// (games/README.md) say curate and license every pixel you vendor, and a
// dino drawn from canvas paths costs zero files, zero licensing, and poses
// itself from the state machine instead of needing an animator.
//
// Everything is drawn facing RIGHT in a feet-anchored local space (0,0 is
// between the toes, -y is up), then mirrored by the caller for facing left.
import { BODY, PEP, MOVES } from './config.js';

// Turn fighter state into the handful of numbers the body parts read. This
// is the whole animation system — one function, no keyframes.
function poseOf(f) {
  const pose = {
    bob: 0,          // whole-body vertical bounce
    lean: 0,         // forward/back tilt in radians
    squash: 1,       // vertical scale, for crouch and landing
    stretch: 1,      // horizontal scale, inverse-ish of squash
    headX: 0,
    headY: 0,
    mouth: 0,        // 0 shut, 1 wide open
    tail: 0,         // tail sweep angle, radians
    legSwing: 0,
    armRaise: 0,
    bodyRot: 0,      // used only by the flop
    eye: 'open',     // open | squint | x | happy
  };

  const t = f.anim;

  switch (f.state) {
    case 'idle':
      pose.bob = Math.sin(t * 3.1) * 2.5;
      pose.tail = Math.sin(t * 2.3) * 0.18;
      pose.mouth = 0.05 + Math.sin(t * 1.7) * 0.05;
      break;

    case 'walk': {
      pose.bob = Math.abs(Math.sin(t * 9)) * 4.5;
      pose.legSwing = Math.sin(t * 9) * 0.75;
      pose.tail = Math.sin(t * 9 + 1) * 0.3;
      pose.lean = 0.06;
      break;
    }

    case 'crouch':
      pose.squash = 0.66;
      pose.stretch = 1.16;
      pose.lean = 0.18;
      pose.tail = 0.35;
      pose.eye = 'squint';
      break;

    case 'air':
      pose.legSwing = 0.5;
      pose.tail = -0.32;
      pose.lean = f.vy < 0 ? -0.12 : 0.14;
      pose.mouth = 0.35;
      break;

    case 'block':
      pose.lean = -0.16;
      pose.armRaise = 1;
      pose.squash = 0.92;
      pose.stretch = 1.05;
      pose.tail = 0.5;
      pose.eye = 'squint';
      break;

    case 'hurt':
      pose.lean = -0.42;
      pose.mouth = 0.9;
      pose.tail = -0.5;
      pose.legSwing = 0.4;
      pose.eye = 'x';
      break;

    case 'flop':
      // Rolls onto its back over the first third of a second, then lies
      // there wiggling its legs. Play-fighting: nobody is hurt, they are
      // just tuckered out.
      pose.bodyRot = -Math.min(1, f.stateTime / 0.35) * (Math.PI / 2);
      pose.legSwing = Math.sin(t * 11) * 0.9;
      pose.mouth = 0.5 + Math.sin(t * 4) * 0.2;
      pose.tail = Math.sin(t * 5) * 0.25;
      pose.eye = 'x';
      break;

    case 'attack': {
      const ph = f.attackPhase();
      const isChomp = f.move === MOVES.chomp;
      if (!ph) break;
      if (isChomp) {
        // Coil back, then snap the head forward.
        if (ph.phase === 'startup') {
          pose.headX = -10 * ph.t;
          pose.lean = -0.18 * ph.t;
          pose.mouth = ph.t;
        } else if (ph.phase === 'active') {
          pose.headX = 30;
          pose.lean = 0.24;
          pose.mouth = 1;
          pose.eye = 'squint';
        } else {
          pose.headX = 30 * (1 - ph.t);
          pose.lean = 0.24 * (1 - ph.t);
          pose.mouth = 1 - ph.t;
        }
        pose.tail = -0.3;
      } else {
        // Tail swipe: wind the tail back, whip it through, stagger.
        if (ph.phase === 'startup') {
          pose.tail = -1.1 * ph.t;
          pose.lean = -0.2 * ph.t;
          pose.squash = 1 - 0.08 * ph.t;
        } else if (ph.phase === 'active') {
          pose.tail = -1.1 + 2.4 * ph.t;
          pose.lean = 0.3;
          pose.mouth = 0.7;
          pose.eye = 'squint';
        } else {
          pose.tail = 1.3 * (1 - ph.t);
          pose.lean = 0.3 * (1 - ph.t);
          pose.mouth = 0.7 * (1 - ph.t);
        }
        pose.legSwing = 0.3;
      }
      break;
    }

    default:
      break;
  }

  return pose;
}

export function drawFighter(ctx, f) {
  const pose = poseOf(f);
  const s = f.skin;

  ctx.save();
  ctx.translate(f.x, f.y);

  // Contact shadow: shrinks and fades with height, so a jump reads.
  const air = Math.max(0, (430 - f.y) / 220);
  ctx.save();
  ctx.globalAlpha = 0.22 * (1 - air * 0.6);
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(0, 2, 38 * (1 - air * 0.35), 9 * (1 - air * 0.35), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.scale(f.facing, 1);
  ctx.translate(0, -pose.bob);
  if (pose.bodyRot) {
    // Pivot the flop around the hip, not the toes.
    ctx.translate(0, -34);
    ctx.rotate(pose.bodyRot);
    ctx.translate(0, 34);
  }
  ctx.scale(pose.stretch, pose.squash);
  ctx.rotate(pose.lean * 0.35);

  drawTail(ctx, s, pose);
  drawLeg(ctx, s, pose, -1);   // far leg, darker
  drawBody(ctx, s, pose);
  drawLeg(ctx, s, pose, 1);    // near leg
  drawArm(ctx, s, pose);
  drawHead(ctx, s, pose);

  // Hit flash sits on top of every part, clipped to the silhouette.
  if (f.flashTime > 0) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = (f.flashTime / 0.12) * 0.75;
    ctx.fillStyle = '#fff';
    ctx.fillRect(-90, -140, 200, 160);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.restore();
}

function drawTail(ctx, s, pose) {
  ctx.save();
  ctx.translate(-22, -52);
  ctx.rotate(pose.tail);
  ctx.fillStyle = s.dark;
  ctx.beginPath();
  ctx.moveTo(4, -12);
  ctx.quadraticCurveTo(-38, -16, -62, 6);
  ctx.quadraticCurveTo(-36, 4, 4, 12);
  ctx.closePath();
  ctx.fill();
  // Three spines along the top of the tail.
  ctx.fillStyle = s.accent;
  for (let i = 0; i < 3; i++) {
    const px = -8 - i * 16;
    const py = -13 - i * 0.5;
    ctx.beginPath();
    ctx.moveTo(px - 5, py + 3);
    ctx.lineTo(px, py - 7);
    ctx.lineTo(px + 5, py + 3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawBody(ctx, s, pose) {
  ctx.fillStyle = s.body;
  ctx.beginPath();
  ctx.ellipse(0, -52, 34, 32, -0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = s.belly;
  ctx.beginPath();
  ctx.ellipse(6, -44, 22, 20, -0.08, 0, Math.PI * 2);
  ctx.fill();

  // Back spines.
  ctx.fillStyle = s.accent;
  for (let i = 0; i < 3; i++) {
    const px = -14 + i * 13;
    const py = -80 + i * 1.5;
    ctx.beginPath();
    ctx.moveTo(px - 6, py + 5);
    ctx.lineTo(px, py - 8);
    ctx.lineTo(px + 6, py + 5);
    ctx.closePath();
    ctx.fill();
  }
}

function drawLeg(ctx, s, pose, side) {
  const swing = pose.legSwing * side;
  ctx.save();
  ctx.translate(side === 1 ? 6 : -8, -34);
  ctx.rotate(swing * 0.5);
  ctx.fillStyle = side === 1 ? s.body : s.dark;
  // Thigh.
  ctx.beginPath();
  ctx.ellipse(0, 6, 15, 19, 0, 0, Math.PI * 2);
  ctx.fill();
  // Shin + foot.
  ctx.save();
  ctx.translate(0, 18);
  ctx.rotate(-swing * 0.35);
  ctx.fillRect(-6, 0, 12, 17);
  ctx.beginPath();
  ctx.moveTo(-7, 17);
  ctx.lineTo(17, 17);
  ctx.lineTo(17, 11);
  ctx.quadraticCurveTo(4, 9, -7, 11);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawArm(ctx, s, pose) {
  ctx.save();
  ctx.translate(18, -64);
  ctx.rotate(-0.5 - pose.armRaise * 1.1);
  ctx.fillStyle = s.dark;
  ctx.beginPath();
  ctx.ellipse(8, 0, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Two little claws.
  ctx.beginPath();
  ctx.moveTo(18, -3);
  ctx.lineTo(25, -6);
  ctx.lineTo(18, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawHead(ctx, s, pose) {
  ctx.save();
  ctx.translate(20 + pose.headX, -92 + pose.headY);
  ctx.rotate(pose.lean * 0.5);

  // Neck.
  ctx.fillStyle = s.body;
  ctx.beginPath();
  ctx.moveTo(-14, 26);
  ctx.quadraticCurveTo(-8, 6, 2, 2);
  ctx.lineTo(4, 18);
  ctx.quadraticCurveTo(-2, 22, -2, 30);
  ctx.closePath();
  ctx.fill();

  // Skull.
  ctx.beginPath();
  ctx.ellipse(0, 0, 25, 20, -0.06, 0, Math.PI * 2);
  ctx.fill();

  // Lower jaw swings open by `mouth`.
  ctx.save();
  ctx.translate(2, 6);
  ctx.rotate(pose.mouth * 0.5);
  ctx.fillStyle = s.dark;
  ctx.beginPath();
  ctx.moveTo(-4, -4);
  ctx.quadraticCurveTo(16, -2, 26, 4);
  ctx.quadraticCurveTo(14, 10, -4, 8);
  ctx.closePath();
  ctx.fill();
  // Bottom teeth.
  ctx.fillStyle = '#fdfdf6';
  for (let i = 0; i < 3; i++) {
    const px = 4 + i * 7;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px + 3, -6);
    ctx.lineTo(px + 6, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Snout over the jaw.
  ctx.fillStyle = s.body;
  ctx.beginPath();
  ctx.moveTo(6, -10);
  ctx.quadraticCurveTo(26, -10, 30, 0);
  ctx.quadraticCurveTo(20, 4, 6, 4);
  ctx.closePath();
  ctx.fill();
  // Top teeth.
  ctx.fillStyle = '#fdfdf6';
  for (let i = 0; i < 3; i++) {
    const px = 8 + i * 7;
    ctx.beginPath();
    ctx.moveTo(px, 2);
    ctx.lineTo(px + 3, 8);
    ctx.lineTo(px + 6, 2);
    ctx.closePath();
    ctx.fill();
  }
  // Nostril.
  ctx.fillStyle = s.dark;
  ctx.beginPath();
  ctx.ellipse(25, -5, 2.2, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();

  drawEye(ctx, s, pose);

  // Brow ridge.
  ctx.fillStyle = s.accent;
  ctx.beginPath();
  ctx.moveTo(-4, -14);
  ctx.quadraticCurveTo(10, -22, 20, -14);
  ctx.quadraticCurveTo(10, -17, -4, -11);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawEye(ctx, s, pose) {
  const ex = 8;
  const ey = -6;
  if (pose.eye === 'x') {
    ctx.strokeStyle = s.eye;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex - 5, ey - 5);
    ctx.lineTo(ex + 5, ey + 5);
    ctx.moveTo(ex + 5, ey - 5);
    ctx.lineTo(ex - 5, ey + 5);
    ctx.stroke();
    return;
  }
  ctx.fillStyle = '#fdfdf6';
  ctx.beginPath();
  ctx.ellipse(ex, ey, 7, pose.eye === 'squint' ? 2.5 : 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = s.eye;
  ctx.beginPath();
  ctx.ellipse(ex + 2, ey, 3, pose.eye === 'squint' ? 2 : 4, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ── HUD ────────────────────────────────────────────────────────────────
// Pep bars, names, round pips. Street Fighter layout, softer words.

export function drawHud(ctx, { left, right, scores, roundsToWin, banner, w }) {
  drawPepBar(ctx, left, 28, 26, 360, false);
  drawPepBar(ctx, right, w - 28 - 360, 26, 360, true);
  drawPips(ctx, scores.left, roundsToWin, 28, 74, false);
  drawPips(ctx, scores.right, roundsToWin, w - 28, 74, true);

  if (banner) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '700 46px ui-rounded, "Trebuchet MS", system-ui, sans-serif';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(20,16,30,0.85)';
    ctx.fillStyle = '#ffe9a8';
    ctx.strokeText(banner, w / 2, 150);
    ctx.fillText(banner, w / 2, 150);
    ctx.restore();
  }
}

function drawPepBar(ctx, fighter, x, y, w, flip) {
  const h = 22;
  const pct = Math.max(0, fighter.pep) / PEP.MAX;

  ctx.save();
  ctx.fillStyle = 'rgba(20,16,30,0.55)';
  roundRect(ctx, x - 3, y - 3, w + 6, h + 6, 6);
  ctx.fill();
  ctx.fillStyle = '#2b2536';
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();

  const fillW = w * pct;
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, fighter.skin.belly);
  grad.addColorStop(1, fighter.skin.body);
  ctx.fillStyle = grad;
  roundRect(ctx, flip ? x + w - fillW : x, y, fillW, h, 4);
  ctx.fill();

  ctx.font = '600 15px ui-rounded, "Trebuchet MS", system-ui, sans-serif';
  ctx.fillStyle = '#f4efe6';
  ctx.textAlign = flip ? 'right' : 'left';
  ctx.fillText(fighter.label, flip ? x + w : x, y + h + 17);
  ctx.restore();
}

function drawPips(ctx, won, total, x, y, flip) {
  ctx.save();
  for (let i = 0; i < total; i++) {
    const px = flip ? x - 14 - i * 26 : x + 14 + i * 26;
    ctx.beginPath();
    ctx.arc(px, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = i < won ? '#ffd166' : 'rgba(255,255,255,0.18)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(20,16,30,0.6)';
    ctx.stroke();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export { BODY };
