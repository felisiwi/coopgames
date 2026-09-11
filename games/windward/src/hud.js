// Minimal DOM HUD: wind arrow + strength, trim hint. Appended next to the
// canvas rather than drawn on it — the canvas is a WebGL context (three.js),
// not 2D, so overlay text goes through the DOM like the rest of the hub.
const DEG = Math.PI / 180;

export function createHud(canvas) {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed', 'top:8px', 'right:8px', 'font:13px monospace',
    'color:#eaf6ff', 'background:rgba(10,26,42,0.55)', 'padding:6px 10px',
    'border-radius:4px', 'pointer-events:none', 'white-space:pre',
  ].join(';');
  (canvas.parentElement || document.body).appendChild(el);
  return el;
}

export function updateHud(el, wind, trimRad, idealTrimRadValue) {
  const windDeg = Math.round(((wind.dir * 180) / Math.PI + 360) % 360);
  const trimDeg = Math.round(trimRad / DEG);
  const idealDeg = Math.round(idealTrimRadValue / DEG);
  const hint = trimDeg < idealDeg - 5 ? 'ease out (S)' : trimDeg > idealDeg + 5 ? 'sheet in (W)' : 'trim OK';
  el.textContent =
    `wind  ${windDeg}°  strength ${(wind.strength * 100).toFixed(0)}%\n` +
    `trim  ${trimDeg}°  ideal ${idealDeg}°  ${hint}`;
}
