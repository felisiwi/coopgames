// Touch controls (2026-11-04) — so Windward plays in a phone browser.
//
// Layout, thumbs-first, landscape:
//   bottom-left   two big steer buttons (hold to turn)
//   bottom-right  a vertical sheet slider: top = sheeted in, bottom = eased
//                 out. Absolute, unlike W/S which nudge — on a phone you
//                 want to SEE where your sheet is, and the slider shows it.
//   above slider  a ping button
//   two fingers   pinch on the water to zoom
//
// Only shown on touch screens ((pointer: coarse)), or with ?touch=1 to try
// it on a laptop. Keyboard still works alongside.
import { CONFIG } from './config.js';

export function wantsTouchControls() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('touch') === '1') return true;
  if (params.get('touch') === '0') return false;
  return window.matchMedia?.('(pointer: coarse)').matches ?? false;
}

// Slider fraction (0 = top) -> trim radians, and back. Exported for tests.
export function sliderToTrim(fraction) {
  const f = Math.min(1, Math.max(0, fraction));
  return CONFIG.TRIM_MIN + f * (CONFIG.TRIM_MAX - CONFIG.TRIM_MIN);
}
export function trimToSlider(trim) {
  return (trim - CONFIG.TRIM_MIN) / (CONFIG.TRIM_MAX - CONFIG.TRIM_MIN);
}

// Pinch: ratio of finger spread now vs at the start -> zoom level. Fingers
// apart = closer in (smaller zoom value, matching the wheel direction).
export function pinchZoom(startZoom, startSpread, spread) {
  if (startSpread <= 0 || spread <= 0) return startZoom;
  const z = startZoom * (startSpread / spread);
  return Math.min(CONFIG.ZOOM_MAX, Math.max(CONFIG.ZOOM_MIN, z));
}

const PANEL = 'rgba(10,26,42,0.55)';
const INK = '#eaf6ff';

function el(tag, css, parent) {
  const e = document.createElement(tag);
  e.style.cssText = css.join(';');
  parent.appendChild(e);
  return e;
}

// opts: { canvas, getTrim(), getZoom(), onPing(), onZoom(z) }
// Returns { left, right, trim (radians or null if untouched), destroy() }.
export function createTouchControls({ canvas, getTrim, getZoom, onPing, onZoom }) {
  const parent = canvas.parentElement || document.body;
  const state = { left: false, right: false, trim: null };
  const cleanups = [];
  const on = (target, type, fn, o) => {
    target.addEventListener(type, fn, o);
    cleanups.push(() => target.removeEventListener(type, fn, o));
  };

  // Stop the page itself scrolling, bouncing or zooming under the game.
  canvas.style.touchAction = 'none';
  document.body.style.overscrollBehavior = 'none';

  const button = (text, left) => { const b = el('div', [
    'position:fixed', `left:${left}px`, 'bottom:16px', 'width:76px', 'height:76px',
    'border-radius:50%', `background:${PANEL}`, `color:${INK}`, 'font:28px sans-serif',
    'display:flex', 'align-items:center', 'justify-content:center',
    'touch-action:none', 'user-select:none', '-webkit-user-select:none', 'z-index:20',
  ], parent); b.textContent = text; return b; };

  const steerL = button('◀', 16);
  const steerR = button('▶', 104);
  for (const [b, key] of [[steerL, 'left'], [steerR, 'right']]) {
    const press = (e) => { e.preventDefault(); state[key] = true; b.style.background = 'rgba(255,204,102,0.45)'; };
    const release = (e) => { e.preventDefault(); state[key] = false; b.style.background = PANEL; };
    on(b, 'pointerdown', press);
    on(b, 'pointerup', release);
    on(b, 'pointercancel', release);
    on(b, 'pointerleave', release);
  }

  // Sheet slider.
  const TRACK_H = 170;
  const track = el('div', [
    'position:fixed', 'right:16px', 'bottom:16px', 'width:64px', `height:${TRACK_H}px`,
    'border-radius:32px', `background:${PANEL}`, 'touch-action:none', 'z-index:20',
  ], parent);
  const thumb = el('div', [
    'position:absolute', 'left:8px', 'width:48px', 'height:48px', 'border-radius:50%',
    'background:#ffcc66', 'pointer-events:none',
  ], track);
  const labelIn = el('div', ['position:absolute', 'top:-18px', 'width:100%', 'text-align:center', `color:${INK}`, 'font:11px monospace', 'pointer-events:none'], track);
  labelIn.textContent = 'sheet in';
  const labelOut = el('div', ['position:absolute', 'bottom:-16px', 'width:100%', 'text-align:center', `color:${INK}`, 'font:11px monospace', 'pointer-events:none'], track);
  labelOut.textContent = 'ease out';

  function placeThumb(fraction) {
    thumb.style.top = `${8 + fraction * (TRACK_H - 64)}px`;
  }
  function fractionFromEvent(e) {
    const r = track.getBoundingClientRect();
    return (e.clientY - r.top - 32) / (r.height - 64);
  }
  let dragging = false;
  on(track, 'pointerdown', (e) => {
    e.preventDefault();
    dragging = true;
    track.setPointerCapture?.(e.pointerId);
    state.trim = sliderToTrim(fractionFromEvent(e));
  });
  on(track, 'pointermove', (e) => {
    if (!dragging) return;
    e.preventDefault();
    state.trim = sliderToTrim(fractionFromEvent(e));
  });
  const endDrag = () => { dragging = false; };
  on(track, 'pointerup', endDrag);
  on(track, 'pointercancel', endDrag);

  // Ping.
  const ping = el('div', [
    'position:fixed', 'right:20px', `bottom:${16 + TRACK_H + 30}px`, 'width:56px', 'height:56px',
    'border-radius:50%', 'background:rgba(255,204,51,0.35)', `color:${INK}`,
    'font:12px monospace', 'display:flex', 'align-items:center', 'justify-content:center',
    'touch-action:none', 'user-select:none', '-webkit-user-select:none', 'z-index:20',
  ], parent);
  ping.textContent = 'ping';
  on(ping, 'pointerdown', (e) => { e.preventDefault(); onPing(); });

  // Pinch to zoom on the water.
  const touches = new Map();
  let pinch = null;
  const spread = () => {
    const [a, b] = [...touches.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  on(canvas, 'pointerdown', (e) => {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) pinch = { zoom: getZoom(), spread: spread() };
  });
  on(canvas, 'pointermove', (e) => {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && touches.size === 2) onZoom(pinchZoom(pinch.zoom, pinch.spread, spread()));
  });
  const lift = (e) => {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinch = null;
  };
  on(canvas, 'pointerup', lift);
  on(canvas, 'pointercancel', lift);

  return {
    get left() { return state.left; },
    get right() { return state.right; },
    get trim() { return state.trim; },
    // Called each frame so the thumb follows the real sheet, including
    // keyboard changes and the ideal-trim start.
    sync() { if (!dragging) placeThumb(trimToSlider(getTrim())); },
    destroy() {
      for (const c of cleanups) c();
      for (const e of [steerL, steerR, track, ping]) e.remove();
    },
  };
}
