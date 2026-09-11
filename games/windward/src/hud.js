// DOM HUD: wind arrow + strength / trim hint (text, unchanged since W0), plus
// a compass rose canvas added in W0.5 Batch 3 (games/windward/DESIGN.md) —
// the fixed camera (Batch 1) makes bearings meaningful to show at a glance,
// independent of which way the boat happens to be pointed on screen.
//
// Pushed down clear of y=80 (W0.6): the hub's own "waiting for a friend"
// pill (index.html's #waiting-overlay, hub.css) is top:12px right:12px, and
// W0.5 put this HUD at top:8px in the same top-right corner — through the
// hub (not the solo dev entry, which has no such pill) the two overlapped.
// Kept right-anchored rather than moved to top-left, since the solo dev
// entry's own static "back to hub" link already lives top-left.
const DEG = Math.PI / 180;
const ROSE_SIZE = 96;

export function createHud(canvas) {
  const parent = canvas.parentElement || document.body;

  const text = document.createElement('div');
  text.style.cssText = [
    'position:fixed', 'top:80px', 'right:8px', 'font:13px monospace',
    'color:#eaf6ff', 'background:rgba(10,26,42,0.55)', 'padding:6px 10px',
    'border-radius:4px', 'pointer-events:none', 'white-space:pre',
  ].join(';');
  parent.appendChild(text);

  const rose = document.createElement('canvas');
  rose.width = ROSE_SIZE;
  rose.height = ROSE_SIZE;
  rose.style.cssText = [
    // Explicit px width/height: a bare `canvas { width:100%; height:100% }`
    // page rule (index.html had exactly this before it was scoped to #game)
    // stretches any canvas to fill the viewport unless overridden here.
    `width:${ROSE_SIZE}px`, `height:${ROSE_SIZE}px`,
    'position:fixed', 'top:80px', `right:${8 + 130}px`,
    'background:rgba(10,26,42,0.55)', 'border-radius:50%', 'pointer-events:none',
  ].join(';');
  parent.appendChild(rose);

  return { text, rose, roseCtx: rose.getContext('2d') };
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

export function updateHud(hud, wind, trimRad, idealTrimRadValue, headingRad) {
  const windDeg = Math.round(((wind.dir * 180) / Math.PI + 360) % 360);
  const trimDeg = Math.round(trimRad / DEG);
  const idealDeg = Math.round(idealTrimRadValue / DEG);
  const hint = trimDeg < idealDeg - 5 ? 'ease out (S)' : trimDeg > idealDeg + 5 ? 'sheet in (W)' : 'trim OK';
  hud.text.textContent =
    `wind  ${windDeg}°  strength ${(wind.strength * 100).toFixed(0)}%\n` +
    `trim  ${trimDeg}°  ideal ${idealDeg}°  ${hint}`;

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
}
