// Zoom gestures (stage 1c): mouse wheel / trackpad, and a two-finger pinch on a phone. Pure logic (the pinch tracker) is
// separate from the DOM wiring so it can be tested.
//
// The phone controls already use two fingers: the first steers, the second is the sheet. So a pinch only counts when BOTH
// fingers come down within PINCH_WINDOW_MS of each other (a deliberate pinch); a second finger that lands later is still the
// sheet. The zoom +/- buttons are the other way in.
export const PINCH_WINDOW_MS = 150;

// A tiny state machine over touch pointers. feed events; it says what to do.
export function createPinchTracker(windowMs = PINCH_WINDOW_MS) {
  const down = new Map(); // id -> { x, y, t }
  let pinching = false;
  let lastDist = 0;
  const dist = () => { const [a, b] = [...down.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  return {
    get pinching() { return pinching; },
    // returns 'start' when a pinch has just begun, else null
    pointerDown(id, x, y, t) {
      down.set(id, { x, y, t });
      if (down.size === 2 && !pinching) {
        const [a, b] = [...down.values()];
        if (Math.abs(a.t - b.t) <= windowMs) { pinching = true; lastDist = dist(); return 'start'; }
      }
      return null;
    },
    // returns the zoom factor to apply (> 1 = zoom out) or null
    pointerMove(id, x, y) {
      const p = down.get(id);
      if (!p) return null;
      p.x = x; p.y = y;
      if (!pinching || down.size < 2) return null;
      const d = dist();
      const factor = lastDist / d; // fingers spread apart: d grows: factor < 1: zoom in
      lastDist = d;
      return Number.isFinite(factor) && Math.abs(factor - 1) > 1e-4 ? factor : null;
    },
    pointerUp(id) {
      down.delete(id);
      if (down.size < 2) pinching = false;
    },
    reset() { down.clear(); pinching = false; },
  };
}

// opts: { target, onZoom(factor), onPinchStart(), wheelFactor(deltaY) }. Returns { destroy }.
export function attachZoomInput({ target = window, onZoom, onPinchStart = () => {}, wheelFactor }) {
  const tracker = createPinchTracker();
  const onWheel = (e) => {
    if (e.target && e.target.closest && e.target.closest('[data-no-zoom]')) return; // a scrollable sheet
    e.preventDefault();
    onZoom(wheelFactor(e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY)); // a "line" wheel is ~33 px
  };
  const down = (e) => { if (e.pointerType === 'touch' && tracker.pointerDown(e.pointerId, e.clientX, e.clientY, performance.now()) === 'start') onPinchStart(); };
  const move = (e) => { if (e.pointerType !== 'touch') return; const f = tracker.pointerMove(e.pointerId, e.clientX, e.clientY); if (f) onZoom(f); };
  const up = (e) => { if (e.pointerType === 'touch') tracker.pointerUp(e.pointerId); };
  target.addEventListener('wheel', onWheel, { passive: false });
  target.addEventListener('pointerdown', down, true); // capture: before the phone controls see it
  target.addEventListener('pointermove', move, true);
  target.addEventListener('pointerup', up, true);
  target.addEventListener('pointercancel', up, true);
  return {
    tracker,
    destroy() {
      target.removeEventListener('wheel', onWheel);
      target.removeEventListener('pointerdown', down, true);
      target.removeEventListener('pointermove', move, true);
      target.removeEventListener('pointerup', up, true);
      target.removeEventListener('pointercancel', up, true);
    },
  };
}
