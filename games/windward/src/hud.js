// DOM HUD: compass rose, wind/speed text, and a trim bar (games/windward/
// DESIGN.md). All three are stacked in a single right-anchored column
// (W0.8) rather than placed side by side — W0.7's text panel could grow
// wider than the gap to the rose canvas and get visually clipped under it
// (reported after play: "wind 85° strength 64%" clipped by the dial).
// Stacking vertically means no element ever sits beside another, so no
// text-width regression can reintroduce that overlap.
//
// Whole column starts at y=80 (W0.6): the hub's own "waiting for a friend"
// pill (index.html's #waiting-overlay, hub.css) is top:12px right:12px, and
// this HUD used to start at top:8px through the hub (not the solo dev entry,
// which has no such pill) so the two overlapped.
import { TRIM_FULL_WINDOW_DEG } from './sail.js';
import { CONFIG } from './config.js';

const DEG = Math.PI / 180;
const COLUMN_RIGHT = 8;
const COLUMN_TOP = 80;

const ROSE_SIZE = 96;
const ROSE_TOP = COLUMN_TOP;

const TEXT_TOP = ROSE_TOP + ROSE_SIZE + 8;

const BAR_WIDTH = ROSE_SIZE;
const BAR_HEIGHT = 20;
const BAR_TOP = TEXT_TOP + 82; // below the (fixed 4-line) text block, generous line-height margin

// Exported (alongside trimHint below) so hud.test.js can check the pure
// conversion/formatting logic headlessly, without a DOM for the canvas/div
// elements createHud() needs.
export function msToKnots(ms) {
  return ms * CONFIG.MS_TO_KNOTS;
}

export function strengthToMs(strength) {
  return CONFIG.WIND_STRENGTH_MIN_MS + strength * (CONFIG.WIND_STRENGTH_MAX_MS - CONFIG.WIND_STRENGTH_MIN_MS);
}

export function createHud(canvas) {
  const parent = canvas.parentElement || document.body;

  const rose = document.createElement('canvas');
  rose.width = ROSE_SIZE;
  rose.height = ROSE_SIZE;
  rose.style.cssText = [
    // Explicit px width/height: a bare `canvas { width:100%; height:100% }`
    // page rule (index.html had exactly this before it was scoped to #game)
    // stretches any canvas to fill the viewport unless overridden here.
    `width:${ROSE_SIZE}px`, `height:${ROSE_SIZE}px`,
    'position:fixed', `top:${ROSE_TOP}px`, `right:${COLUMN_RIGHT}px`,
    'background:rgba(10,26,42,0.55)', 'border-radius:50%', 'pointer-events:none',
  ].join(';');
  parent.appendChild(rose);

  const text = document.createElement('div');
  text.style.cssText = [
    'position:fixed', `top:${TEXT_TOP}px`, `right:${COLUMN_RIGHT}px`, `width:${ROSE_SIZE}px`,
    'font:12px monospace', 'color:#eaf6ff', 'background:rgba(10,26,42,0.55)',
    'padding:6px 8px', 'border-radius:4px', 'pointer-events:none', 'white-space:pre',
    'box-sizing:content-box',
  ].join(';');
  parent.appendChild(text);

  const bar = document.createElement('canvas');
  bar.width = BAR_WIDTH;
  bar.height = BAR_HEIGHT;
  bar.style.cssText = [
    `width:${BAR_WIDTH}px`, `height:${BAR_HEIGHT}px`,
    'position:fixed', `top:${BAR_TOP}px`, `right:${COLUMN_RIGHT}px`,
    'background:rgba(10,26,42,0.55)', 'border-radius:4px', 'pointer-events:none',
  ].join(';');
  parent.appendChild(bar);

  return { text, rose, roseCtx: rose.getContext('2d'), bar, barCtx: bar.getContext('2d') };
}

function drawBearingArrow(ctx, cx, cy, r, bearingRad, color, width) {
  const x = cx + Math.sin(bearingRad) * r;
  const y = cy - Math.cos(bearingRad) * r;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(x, y);
  ctx.stroke();

  const headLen = 7;
  const angle = Math.atan2(y - cy, x - cx);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - headLen * Math.cos(angle - Math.PI / 6), y - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x - headLen * Math.cos(angle + Math.PI / 6), y - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

// Trim delta hint: what the player should actually do, not a bare "ideal"
// number nobody could parse at a glance (W0.8 item 6). Within the same
// forgiving window the speed model itself uses (TRIM_FULL_WINDOW_DEG,
// src/sail.js) counts as trimmed — keeps the HUD's "you're OK" claim
// consistent with what the physics actually rewards.
export function trimHint(trimDeg, idealDeg) {
  // trim is "how much sheet is let out" (0 full in .. 90 full out, sail.js),
  // so trimDeg > idealDeg means over-eased -> sheet in; trimDeg < idealDeg
  // means over-sheeted -> ease out.
  const diff = trimDeg - idealDeg;
  if (Math.abs(diff) <= TRIM_FULL_WINDOW_DEG) return 'trimmed ✓';
  return diff > 0 ? `sheet in ${Math.round(diff)}°` : `ease ${Math.round(-diff)}°`;
}

function drawTrimBar(ctx, trimDeg, idealDeg) {
  const w = BAR_WIDTH;
  const h = BAR_HEIGHT;
  const minDeg = 0;
  const maxDeg = 90;
  const pad = 6;
  const trackY = h / 2;
  const x = (deg) => pad + ((deg - minDeg) / (maxDeg - minDeg)) * (w - pad * 2);

  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(234,246,255,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x(minDeg), trackY);
  ctx.lineTo(x(maxDeg), trackY);
  ctx.stroke();

  // Full-speed window around ideal, so "trimmed" reads as a zone, not a hairline.
  ctx.strokeStyle = 'rgba(120,220,150,0.6)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x(Math.max(minDeg, idealDeg - TRIM_FULL_WINDOW_DEG)), trackY);
  ctx.lineTo(x(Math.min(maxDeg, idealDeg + TRIM_FULL_WINDOW_DEG)), trackY);
  ctx.stroke();

  const inWindow = Math.abs(trimDeg - idealDeg) <= TRIM_FULL_WINDOW_DEG;
  ctx.fillStyle = inWindow ? '#78dc96' : '#ffcc66';
  ctx.beginPath();
  ctx.arc(x(Math.max(minDeg, Math.min(maxDeg, trimDeg))), trackY, 5, 0, Math.PI * 2);
  ctx.fill();
}

export function updateHud(hud, wind, trimRad, idealTrimRadValue, headingRad, boatSpeedMS) {
  const windDeg = Math.round(((wind.dir * 180) / Math.PI + 360) % 360);
  const windMs = strengthToMs(wind.strength);
  const trimDeg = Math.round(trimRad / DEG);
  const idealDeg = Math.round(idealTrimRadValue / DEG);

  hud.text.textContent =
    `wind ${String(windDeg).padStart(3, '0')}°\n` +
    `${windMs.toFixed(1)} m/s / ${msToKnots(windMs).toFixed(1)} kn\n` +
    `speed ${msToKnots(boatSpeedMS).toFixed(1)} kn\n` +
    trimHint(trimDeg, idealDeg);

  const ctx = hud.roseCtx;
  const cx = ROSE_SIZE / 2;
  const cy = ROSE_SIZE / 2;
  const r = ROSE_SIZE / 2 - 8;

  ctx.clearRect(0, 0, ROSE_SIZE, ROSE_SIZE);
  ctx.strokeStyle = 'rgba(234,246,255,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#eaf6ff';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('N', cx, cy - r + 2);

  drawBearingArrow(ctx, cx, cy, r - 6, wind.dir + Math.PI, '#8fd3ff', 2); // wind: blows-to
  drawBearingArrow(ctx, cx, cy, r - 14, headingRad, '#ffcc66', 3); // boat heading

  drawTrimBar(hud.barCtx, trimDeg, idealDeg);
}
