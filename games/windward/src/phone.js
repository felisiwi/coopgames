// Phone controls (2026-11-05) — the Control Lab version, in the real game.
// Felix + Hani tested these in the "Windward Control Lab" prototype; see
// DESIGN.md "Phone controls: Control Lab findings".
//
//   first finger   hold on the water where you want to go; the boat turns
//                  towards it (never into the no-go zone). The line to your
//                  finger is coloured by how fast that heading is, with the
//                  knots in a pill ABOVE the finger.
//   the rope       bottom-right: swipe it down to pull in, up to let out (see ropeGeom below). The second-finger sheet below is OFF
//                  for now (SECOND_FINGER_SHEET); the notes that follow describe it for when it comes back.
//   second finger  the sheet. CONFIG.PHONE_SHEET picks the take:
//                  'rope' — your thumb holds the end of the sheet: pull away
//                           from the boat to haul in, back towards it to let
//                           out (fully out at a ring just outside the arc).
//                  'dot'  — your thumb moves the dot along the arc.
//   tap the boat   ping your friend.
//
// Wind is read at the boat (streaks on the water + a chevron upwind); trim from
// the sweet-spot arc round the boat. Hints float above the thumb, never
// under it, and the "second thumb" ghost only appears once a first finger is
// steering. All drawn on a 2D layer over the WebGL canvas.
import * as THREE from '../vendor/three/three.module.js';
import { CONFIG } from './config.js';
import { boatSpeed, idealTrimRad, angleOffWind, leewardSign } from './sail.js';

const DEG = Math.PI / 180;
const NO_GO_HALF = 22.5 * DEG;
const TRIM_WINDOW = 8 * DEG; // sail.js TRIM_FULL_WINDOW_DEG
const LIFT = 78; // px: hints float this far above a finger
const GOLD = '#ffcc66';
const PANEL = 'rgba(12,32,54,0.72)';
const INK = '#eaf6ff';

export function wantsPhoneControls() {
  const q = new URLSearchParams(window.location.search).get('touch');
  if (q === '1') return true;
  if (q === '0') return false;
  return window.matchMedia?.('(pointer: coarse)').matches ?? false;
}

// ---------- pure helpers (src/phone.test.js) ----------
export function wrapPi(a) {
  let x = a % (2 * Math.PI);
  if (x > Math.PI) x -= 2 * Math.PI;
  if (x < -Math.PI) x += 2 * Math.PI;
  return x;
}
// Heading convention matches game.js: moving along (sin h, cos h) in (x, z).
export function headingTo(fromX, fromZ, toX, toZ) {
  return Math.atan2(toX - fromX, toZ - fromZ);
}
// Never steer into the no-go zone: pin to just outside its edge instead.
export function avoidNoGo(heading, windFrom, marginRad = 4 * DEG) {
  const rel = wrapPi(heading - windFrom);
  const edge = NO_GO_HALF + marginRad;
  return Math.abs(rel) < edge ? wrapPi(windFrom + Math.sign(rel || 1) * edge) : heading;
}
// One step of turning towards `target` at CONFIG.TURN_RATE.
export function turnTowards(heading, target, dt) {
  const diff = wrapPi(target - heading);
  return wrapPi(heading + Math.sign(diff) * Math.min(Math.abs(diff), CONFIG.TURN_RATE * dt));
}
// Rope: further from the boat = hauled in. Towards the boat, all the
// remaining slack is spread over the distance left to the slack ring, so
// the sail is fully out there however close the thumb started.
export function ropeTrim(trim0, d0, d, slackR) {
  const clamp = (t) => Math.min(CONFIG.TRIM_MAX, Math.max(CONFIG.TRIM_MIN, t));
  if (d < d0) {
    const room = Math.max(24, d0 - slackR);
    return clamp(trim0 + (CONFIG.TRIM_MAX - trim0) * Math.min(1, (d0 - d) / room));
  }
  return clamp(trim0 - (d - d0) * 0.006);
}
// Where to suggest the sheet thumb: on the far side of the boat from the
// steering finger, a comfortable rope's length out, kept on screen and clear
// of the edges. Exported for phone.test.js.
export function ghostSpot(bx, by, steerX, steerY, W, H) {
  let dx = bx - steerX;
  let dy = by - steerY;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  const reach = Math.min(W, H) * 0.34;
  const margin = 56;
  return [
    Math.min(W - margin, Math.max(margin, bx + dx * reach)),
    Math.min(H - margin - 30, Math.max(margin + 70, by + dy * reach)),
  ];
}

// ---- the rope control (1c phone test, refined): a small rope bottom-right, swiped like a real sheet ----
// Swipe down on it = pull in (sheet in, trim down), swipe up = let out. Relative: the swipe moves the trim from where it is, so
// nothing jumps on touch. The rope shows the trim by its shape: taut and straight when sheeted in, sagging when eased.
// The sheet control from the first Control Lab (a second finger anywhere) is off for now; flip this to bring it back.
export const SECOND_FINGER_SHEET = false;
export const ROPE_HIT_HALF_W = 42; // px each side of the rope: a thumb-sized target, though the rope is drawn thin
export function ropeGeom(W, H) {
  const len = Math.round(Math.min(190, Math.max(140, H * 0.22)));
  const y1 = H - 74; // clear of the speed line at the bottom
  return { x: W - 42, y0: y1 - len, y1, len };
}
export const ropeHit = (g, x, y) => Math.abs(x - g.x) <= ROPE_HIT_HALF_W && y >= g.y0 - 34 && y <= g.y1 + 34;
// The stripes on the rope run along it as you swipe, as if the rope were sliding through your hand: down when pulling in, up when
// letting out, at the swipe's speed, easing to a stop when you let go. The rope itself stays straight and does not show the trim.
export const ROPE_STRIPE_PERIOD = 9; // px between stripes
export const ROPE_COAST_RATE = 5.5; // 1/s: how fast the run dies away after letting go
// One step of the scroll. offset: px, kept in [0, period); vel: px/s (positive = down); held: a finger is on the rope.
export function ropeScrollStep(offset, vel, dt, held) {
  const v = held ? vel : vel * Math.exp(-ROPE_COAST_RATE * dt);
  const o = (((offset + v * dt) % ROPE_STRIPE_PERIOD) + ROPE_STRIPE_PERIOD) % ROPE_STRIPE_PERIOD;
  return { offset: o, vel: Math.abs(v) < 2 ? 0 : v };
}
// The sheave in the block at the top of the rope turns with the rope: the rope's travel (vel * dt px) over the wheel's radius. Pulling in
// (stripes run down) turns it clockwise, letting out the other way; it stops when the rope does, because it is driven by the same velocity.
export const SHEAVE_R = 8; // px
export const sheaveStep = (angle, vel, dt, radius = SHEAVE_R) => angle + (vel * dt) / radius;
// Which way to trim: +1 = let out (ease, up), -1 = pull in (sheet in, down), 0 = trimmed. Same window the arc by the boat uses.
export const ropeNeed = (trim, ideal, window = TRIM_WINDOW) => (Math.abs(trim - ideal) <= window ? 0 : Math.sign(ideal - trim));
// The guidance chevrons fade out when trimmed and back in when not. guide in [0, 1].
export const ropeGuideStep = (guide, trimmed, dt) => Math.min(1, Math.max(0, guide + (trimmed ? -dt / 0.35 : dt / 0.25)));

// A swipe of dy px (down is positive) from trim0: one rope length is the whole range.
export const swipeTrim = (trim0, dy, g) => Math.min(CONFIG.TRIM_MAX, Math.max(CONFIG.TRIM_MIN, trim0 - (dy * (CONFIG.TRIM_MAX - CONFIG.TRIM_MIN)) / g.len));

// The sail's world angle (heading convention), matching boat.js: the group
// is rotated by heading and the sail pivot by leewardSign * trim, from aft.
export function boomAngle(heading, windFrom, trim) {
  return heading + Math.PI + leewardSign(heading, windFrom) * trim;
}

// ---------- the controls ----------
// opts: { canvas, camera, onPing }
export function createPhoneControls({ canvas, camera, onPing }) {
  const sheetParam = new URLSearchParams(window.location.search).get('sheet');
  if (sheetParam === 'rope' || sheetParam === 'dot') CONFIG.PHONE_SHEET = sheetParam;
  const parent = canvas.parentElement || document.body;
  const layer = document.createElement('canvas');
  layer.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:3';
  parent.appendChild(layer);
  const ctx = layer.getContext('2d');
  let W = 0;
  let H = 0;
  let dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    layer.width = W * dpr;
    layer.height = H * dpr;
  }
  resize();
  window.addEventListener('resize', resize);

  canvas.style.touchAction = 'none';
  document.body.style.overscrollBehavior = 'none';

  const pointers = new Map(); // id -> { role, x, y, x0, y0, px, py, t0, trim0, d0 }
  const streaks = [];
  let state = null; // { self, wind } snapshot from the last apply()
  let aimHeading = null;
  let offSince = 0;
  let ropeOn = true; // hidden while the chart covers the view
  let ropeOffset = 0; // stripe scroll, px
  let ropeVel = 0; // px/s, positive = down
  let sheaveAngle = 0; // rad, the pulley block's wheel
  let ropeMoveAt = 0; // when the rope finger last moved
  let ropeGuide = 1; // the yellow chevrons: 1 = shown (needs trimming), 0 = gone (trimmed)
  let ropeNeedLast = -1; // the direction they point, kept while they fade out

  // --- projection helpers ---
  const v3 = new THREE.Vector3();
  function toScreen(x, y, z) {
    v3.set(x, y, z).project(camera);
    return [((v3.x + 1) / 2) * W, ((1 - v3.y) / 2) * H, v3.z < 1];
  }
  const raycaster = new THREE.Raycaster();
  const water = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  function toWater(sx, sy) {
    raycaster.setFromCamera(new THREE.Vector2((sx / W) * 2 - 1, -(sy / H) * 2 + 1), camera);
    return raycaster.ray.intersectPlane(water, hit) ? { x: hit.x, z: hit.z } : null;
  }
  const boatScreen = () => toScreen(state.self.x, 0.5, state.self.z);
  const arcR = () => Math.min(W, H) * 0.11;
  const slackR = () => arcR() * 1.55;
  // Screen angle round the boat for a world heading-convention angle.
  function screenAngle(a) {
    const [bx, by] = boatScreen();
    const [px, py] = toScreen(state.self.x + Math.sin(a) * 6, 0.5, state.self.z + Math.cos(a) * 6);
    return Math.atan2(py - by, px - bx);
  }
  const arcPoint = (a, r) => {
    const [bx, by] = boatScreen();
    const s = screenAngle(a);
    return [bx + Math.cos(s) * r, by + Math.sin(s) * r];
  };

  // --- input ---
  const steering = () => [...pointers.values()].some((p) => p.role === 'steer');
  function aimAt(sx, sy) {
    const w = toWater(sx, sy);
    if (!w || !state) return;
    if (Math.hypot(w.x - state.self.x, w.z - state.self.z) < 2) return;
    aimHeading = avoidNoGo(headingTo(state.self.x, state.self.z, w.x, w.z), state.wind.dir);
  }
  function sheetMove(p) {
    const { self, wind } = state;
    const [bx, by] = boatScreen();
    if (CONFIG.PHONE_SHEET === 'rope') {
      const d = Math.hypot(p.x - bx, p.y - by);
      if (p.d0 === undefined) p.d0 = d;
      self.trim = ropeTrim(p.trim0, p.d0, d, slackR());
    } else {
      // dot: project the thumb's movement onto the dot's direction of travel
      const a0 = boomAngle(self.heading, wind.dir, self.trim);
      const a1 = boomAngle(self.heading, wind.dir, self.trim + 0.02);
      const [x0, y0] = arcPoint(a0, arcR());
      const [x1, y1] = arcPoint(a1, arcR());
      const tx = x1 - x0;
      const ty = y1 - y0;
      const tl = Math.hypot(tx, ty) || 1;
      const move = ((p.x - p.px) * tx + (p.y - p.py) * ty) / tl;
      self.trim = Math.min(CONFIG.TRIM_MAX, Math.max(CONFIG.TRIM_MIN, self.trim + move * 0.009));
    }
  }
  function onDown(e) {
    if (!state) return;
    canvas.setPointerCapture?.(e.pointerId);
    const p = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, px: e.clientX, py: e.clientY, t0: performance.now(), trim0: state.self.trim };
    const [bx, by] = boatScreen();
    const rg = ropeGeom(W, H);
    if (ropeOn && ropeHit(rg, p.x, p.y)) {
      for (const [id, q] of pointers) if (q.role === 'rope') pointers.delete(id); // a new finger takes the rope over: a lift that was never seen must not leave it dead
      p.role = 'rope'; // a finger on the rope is the rope: it never steers, so the other hand steers on its own
      p.trim0 = state.self.trim; // a swipe moves the trim from where it is now: nothing jumps on touch
      pointers.set(e.pointerId, p);
      return;
    }
    if (steering()) p.role = SECOND_FINGER_SHEET ? 'sheet' : 'ignore'; // the second-finger sheet is off for now
    else if (Math.hypot(p.x - bx, p.y - by) < 38) p.role = 'boat'; // maybe a ping tap
    else p.role = 'steer';
    if (p.role === 'sheet') p.d0 = Math.hypot(p.x - bx, p.y - by); // rope length when the thumb landed
    pointers.set(e.pointerId, p);
    if (p.role === 'steer') aimAt(p.x, p.y);
  }
  function onMove(e) {
    const p = pointers.get(e.pointerId);
    if (!p || !state) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (p.role === 'boat' && Math.hypot(p.x - p.x0, p.y - p.y0) > 14) p.role = 'steer';
    if (p.role === 'steer') aimAt(p.x, p.y);
    else if (p.role === 'sheet') sheetMove(p);
    else if (p.role === 'rope') {
      const before = state.self.trim;
      state.self.trim = swipeTrim(p.trim0, p.y - p.y0, ropeGeom(W, H));
      const now = performance.now();
      const dtm = Math.max(8, now - (ropeMoveAt || now - 16)) / 1000;
      const inst = state.self.trim === before && (p.y - p.py) !== 0 && (state.self.trim <= CONFIG.TRIM_MIN || state.self.trim >= CONFIG.TRIM_MAX) ? 0 : (p.y - p.py) / dtm; // at the end of the rope it stops running
      ropeVel = ropeVel * 0.55 + inst * 0.45; // smoothed, so a jittery finger gives a steady run
      ropeMoveAt = now;
    }
    p.px = p.x;
    p.py = p.y;
  }
  function onUp(e) {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (!p) return;
    if (p.role === 'steer') aimHeading = null;
    if (p.role === 'boat' && performance.now() - p.t0 < 350) onPing();
  }
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  // --- per frame: steering + bookkeeping (call before the speed update) ---
  function apply(self, wind, dt) {
    state = { self, wind };
    const ropeHeld = [...pointers.values()].some((q) => q.role === 'rope');
    if (ropeHeld && performance.now() - ropeMoveAt > 120) ropeVel *= Math.exp(-14 * dt); // a thumb resting on the rope: the run stops
    ({ offset: ropeOffset, vel: ropeVel } = ropeScrollStep(ropeOffset, ropeVel, dt, ropeHeld));
    sheaveAngle = sheaveStep(sheaveAngle, ropeVel, dt);
    // A held finger keeps pointing at the same spot on the water as the boat moves.
    for (const p of pointers.values()) if (p.role === 'steer') aimAt(p.x, p.y);
    if (aimHeading !== null) self.heading = turnTowards(self.heading, avoidNoGo(aimHeading, wind.dir), dt);
    const ideal = idealTrimRad(angleOffWind(self.heading, wind.dir));
    offSince = Math.abs(ideal - self.trim) > TRIM_WINDOW ? offSince + dt : 0;
    const needNow = ropeNeed(self.trim, ideal);
    if (needNow !== 0) ropeNeedLast = needNow;
    ropeGuide = ropeGuideStep(ropeGuide, needNow === 0, dt);

    // streaks drift downwind across the water round the boat
    while (streaks.length < CONFIG.PHONE_STREAKS) {
      streaks.push({ x: self.x + (Math.random() - 0.5) * 160, z: self.z + (Math.random() - 0.5) * 160, life: 0, max: 1.5 + Math.random() * 2 });
    }
    const down = wind.dir + Math.PI;
    const v = 4 + 10 * wind.strength;
    for (const s of streaks) {
      s.x += Math.sin(down) * v * dt;
      s.z += Math.cos(down) * v * dt;
      s.life += dt;
    }
    for (let i = streaks.length - 1; i >= 0; i--) if (streaks[i].life > streaks[i].max) streaks.splice(i, 1);
  }

  // --- drawing ---
  function pill(text, x, y, color) {
    ctx.font = '800 16px ui-rounded, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 22;
    ctx.fillStyle = PANEL;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - 15, w, 30, 15);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
  function arrowHead(x, y, a, size) {
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * size, y + Math.sin(a) * size);
    ctx.lineTo(x + Math.cos(a + 2.5) * size, y + Math.sin(a + 2.5) * size);
    ctx.lineTo(x + Math.cos(a) * size * 0.25, y + Math.sin(a) * size * 0.25);
    ctx.lineTo(x + Math.cos(a - 2.5) * size, y + Math.sin(a - 2.5) * size);
    ctx.closePath();
    ctx.fill();
  }

  function drawStreaks(wind) {
    const down = wind.dir + Math.PI;
    const len = 2 + 6 * wind.strength;
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.6;
    for (const s of streaks) {
      const [x0, y0, ok] = toScreen(s.x, 0.3, s.z);
      if (!ok) continue;
      const [x1, y1] = toScreen(s.x + Math.sin(down) * len, 0.3, s.z + Math.cos(down) * len);
      ctx.strokeStyle = `rgba(234,246,255,${(Math.sin((s.life / s.max) * Math.PI) * 0.5).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
  }

  // Felix 2026-11-05: no no-go "cake slice" — just a small blue chevron on the
  // upwind side of the boat, pointing the way the wind blows.
  function drawWindMark(self, wind) {
    const [bx, by] = boatScreen();
    const R = arcR() * 1.9;
    const s = screenAngle(wind.dir);
    ctx.fillStyle = '#8fd3ff';
    arrowHead(bx + Math.cos(s) * (R + 10), by + Math.sin(s) * (R + 10), s + Math.PI, 9); // wind blows from here
  }

  function drawArc(self, wind) {
    const R = arcR();
    const side = leewardSign(self.heading, wind.dir);
    const aft = self.heading + Math.PI;
    const ideal = idealTrimRad(angleOffWind(self.heading, wind.dir));
    const trace = (t0, t1, width, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let k = 0; k <= 16; k++) {
        const [x, y] = arcPoint(aft + side * (t0 + ((t1 - t0) * k) / 16), R);
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    };
    const trimmed = Math.abs(self.trim - ideal) <= TRIM_WINDOW;
    trace(CONFIG.TRIM_MIN, CONFIG.TRIM_MAX, 3, 'rgba(234,246,255,0.18)'); // where the sail can swing
    ctx.save();
    if (trimmed) { ctx.shadowColor = 'rgba(120,235,160,0.9)'; ctx.shadowBlur = 14; } // trimmed: the sweet zone glows, steadily
    trace(Math.max(0, ideal - TRIM_WINDOW * 1.3), Math.min(CONFIG.TRIM_MAX, ideal + TRIM_WINDOW * 1.3), trimmed ? 11 : 7, trimmed ? 'rgba(120,235,160,1)' : 'rgba(120,220,150,0.85)');
    ctx.restore();
    const [dx, dy] = arcPoint(boomAngle(self.heading, wind.dir, self.trim), R);
    ctx.fillStyle = trimmed ? '#78dc96' : GOLD;
    ctx.beginPath();
    ctx.arc(dx, dy, trimmed ? 8.5 : 6, 0, Math.PI * 2);
    ctx.fill();
    if (trimmed) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(dx, dy, 8.5, 0, Math.PI * 2);
      ctx.stroke();
      const [bx, by] = boatScreen(); // a small word just outside the dot, away from the boat
      const ox = dx - bx;
      const oy = dy - by;
      const ol = Math.hypot(ox, oy) || 1;
      ctx.font = '800 12px ui-rounded, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(12,32,54,0.75)';
      ctx.fillStyle = '#9af0b4';
      ctx.strokeText('trimmed', dx + (ox / ol) * 34, dy + (oy / ol) * 22);
      ctx.fillText('trimmed', dx + (ox / ol) * 34, dy + (oy / ol) * 22);
    }
  }

  function drawRope(x, y, trim, dashed) {
    const [bx, by] = boatScreen();
    const sag = (trim / CONFIG.TRIM_MAX) * 46;
    ctx.strokeStyle = dashed ? 'rgba(255,240,200,0.7)' : 'rgba(255,240,200,0.85)';
    ctx.lineWidth = 2.2;
    ctx.setLineDash(dashed ? [5, 6] : []);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo((bx + x) / 2, (by + y) / 2 + sag, x, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // "Pull" / "Let out" above the thumb, chevrons sliding along the rope.
  function ropeHint(x, y, need, pulse) {
    const [bx, by] = boatScreen();
    const d = Math.hypot(x - bx, y - by) || 1;
    const ux = (x - bx) / d;
    const uy = (y - by) / d;
    const out = need < 0 ? 1 : -1;
    ctx.fillStyle = GOLD;
    for (let k = 0; k < 3; k++) {
      const along = 46 + k * 18 + pulse * 18 * out;
      ctx.globalAlpha = 0.9 - k * 0.22;
      arrowHead(x - ux * along, y - uy * along, Math.atan2(uy, ux) + (out < 0 ? Math.PI : 0), 9);
    }
    ctx.globalAlpha = 1;
    pill(need < 0 ? 'Pull' : 'Let out', x, y - LIFT, GOLD);
  }

  // Dot take: an arrow above the thumb along the dot's direction of travel.
  function dotHint(x, y, self, wind, need, pulse) {
    const a0 = boomAngle(self.heading, wind.dir, self.trim);
    const a1 = boomAngle(self.heading, wind.dir, self.trim + need * 0.05);
    const [x0, y0] = arcPoint(a0, arcR());
    const [x1, y1] = arcPoint(a1, arcR());
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const cx = x;
    const cy = y - LIFT;
    ctx.fillStyle = PANEL;
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.fillStyle = GOLD;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    const e = 12 + pulse * 6;
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(ang) * 14, cy - Math.sin(ang) * 14);
    ctx.lineTo(cx + Math.cos(ang) * e, cy + Math.sin(ang) * e);
    ctx.stroke();
    arrowHead(cx + Math.cos(ang) * (e + 4), cy + Math.sin(ang) * (e + 4), ang, 11);
  }

  function tick(x, y) {
    ctx.strokeStyle = '#78dc96';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 9, y + 4);
    ctx.lineTo(x - 2, y + 11);
    ctx.lineTo(x + 11, y - 4);
    ctx.stroke();
  }

  // Something off-screen (your friend, a ping): a dot at the screen edge.
  function edgeDot(x, z, color, size) {
    const [sx, sy] = toScreen(x, 0.5, z);
    const m = 26;
    if (sx > m && sx < W - m && sy > m && sy < H - m) return;
    const [bx, by] = boatScreen();
    const a = Math.atan2(sy - by, sx - bx);
    const tx = Math.cos(a) > 0 ? (W - m - bx) / Math.cos(a) : (m - bx) / Math.cos(a);
    const ty = Math.sin(a) > 0 ? (H - m - by) / Math.sin(a) : (m - by) / Math.sin(a);
    const t = Math.min(Math.abs(tx), Math.abs(ty));
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(bx + Math.cos(a) * t, by + Math.sin(a) * t, size, 0, Math.PI * 2);
    ctx.fill();
  }

  // The rope: soft hemp running down into a small flat navy block, tone-on-tone strand lines that run as you swipe, and small
  // yellow chevrons pointing the way to trim; they fade out when trimmed. The chevrons are the only yellow; the dot and arc by the boat
  // are still the main trim readout.
  const HEMP = '#b9ad98';
  const HEMP_STRAND = 'rgba(122,110,92,0.55)';
  const ANCHOR = 'rgba(12,32,54,0.82)';
  function ropeBar(x, w, y0, y1, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.roundRect(x - w / 2, y0, w, y1 - y0, w / 2); ctx.clip();
    ctx.fillStyle = HEMP;
    ctx.fillRect(x - w / 2, y0, w, y1 - y0);
    ctx.strokeStyle = HEMP_STRAND; ctx.lineWidth = 1.8; // the strands: slanted, tone on tone, scrolled by the swipe
    ctx.beginPath();
    for (let y = y0 - ROPE_STRIPE_PERIOD + ropeOffset; y < y1 + ROPE_STRIPE_PERIOD; y += ROPE_STRIPE_PERIOD) { ctx.moveTo(x - w / 2 - 1, y + 4); ctx.lineTo(x + w / 2 + 1, y - 4); }
    ctx.stroke();
    ctx.restore();
  }
  function ropeChevrons(g, nowS) {
    if (ropeGuide <= 0.01) return;
    const dir = ropeNeedLast < 0 ? 1 : -1; // pull in = down the rope, let out = up
    const n = 4;
    const phase = (nowS * 0.8) % 1;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let k = 0; k < n; k++) {
      const t = (k + phase) / n; // 0..1 along the way to trim: they flow in the direction to pull
      const y = dir > 0 ? g.y0 + 36 + t * (g.len - 54) : g.y1 - 14 - t * (g.len - 54); // clear of the block at the top
      const a = Math.sin(Math.PI * t) * ropeGuide;
      const sz = 5.5;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.moveTo(g.x - sz, y - dir * sz * 0.6); ctx.lineTo(g.x, y + dir * sz * 0.6); ctx.lineTo(g.x + sz, y - dir * sz * 0.6);
      ctx.strokeStyle = 'rgba(12,32,54,0.6)'; ctx.lineWidth = 5; ctx.stroke();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2.6; ctx.stroke();
    }
    ctx.restore();
  }
  function drawRopeControl(nowS) {
    const g = ropeGeom(W, H);
    const cy = g.y0 + 13; // the block hangs at the top, as from the boom; the rope comes down from it and you pull the tail
    ctx.save();
    ropeBar(g.x, 8, cy, g.y1);
    ctx.fillStyle = ANCHOR; ctx.beginPath(); ctx.arc(g.x, cy, 13, 0, Math.PI * 2); ctx.fill(); // a round pulley block
    ctx.save();
    ctx.translate(g.x, cy);
    ctx.rotate(sheaveAngle); // the sheave turns with the rope
    ctx.strokeStyle = HEMP; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(0, 0, SHEAVE_R, 0, Math.PI * 2); ctx.stroke(); // the wheel's rim
    ctx.lineWidth = 1.6; ctx.beginPath();
    for (let k = 0; k < 3; k++) { const a = (k * 2 * Math.PI) / 3; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * SHEAVE_R, Math.sin(a) * SHEAVE_R); } // three spokes, so the turning shows
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = HEMP; ctx.beginPath(); ctx.arc(g.x, cy, 2.4, 0, Math.PI * 2); ctx.fill(); // the hub
    ctx.restore();
    ropeChevrons(g, nowS);
  }

  // extras: { partner: {x,z}|null, pings: [{x,z,fromFriend}], foundText }
  function draw(nowS, extras) {
    if (!state) return;
    const { self, wind } = state;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const pulse = (Math.sin(nowS * 6) + 1) / 2;
    const ideal = idealTrimRad(angleOffWind(self.heading, wind.dir));
    const need = Math.abs(ideal - self.trim) <= TRIM_WINDOW ? 0 : Math.sign(ideal - self.trim);
    const [bx, by] = boatScreen();

    drawStreaks(wind);
    drawWindMark(self, wind);
    drawArc(self, wind);

    for (const p of pointers.values()) {
      if (p.role === 'steer' && aimHeading !== null) {
        const sp = boatSpeed(aimHeading, wind.dir, wind.strength);
        const best = CONFIG.BOAT_MAX_SPEED * wind.strength || 1;
        const f = Math.min(1, sp / best);
        const color = sp < 0.5 ? 'rgba(255,110,80,0.95)' : `rgba(${Math.round(255 - 135 * f)},220,${Math.round(110 + 40 * f)},0.95)`;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        pill(`${(sp * 1.94384).toFixed(0)} kn`, p.x, p.y - LIFT, color);
      } else if (p.role === 'sheet') {
        ctx.fillStyle = 'rgba(255,240,200,0.25)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 24, 0, Math.PI * 2);
        ctx.fill();
        if (CONFIG.PHONE_SHEET === 'rope') {
          ctx.strokeStyle = 'rgba(255,240,200,0.22)';
          ctx.lineWidth = 2;
          ctx.setLineDash([3, 6]);
          ctx.beginPath();
          ctx.arc(bx, by, slackR(), 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          drawRope(p.x, p.y, self.trim, false);
        }
        if (need === 0) tick(p.x, p.y - LIFT);
        else if (CONFIG.PHONE_SHEET === 'rope') ropeHint(p.x, p.y, need, pulse);
        else dotHint(p.x, p.y, self, wind, need, pulse);
      }
    }

    // Ghost thumb: only once a first finger is steering, the sail has been
    // off a moment, and no thumb is on the sheet yet.
    const sheeting = [...pointers.values()].some((p) => p.role === 'sheet');
    if (SECOND_FINGER_SHEET && steering() && !sheeting && offSince > 1.2 && need !== 0) {
      // Opposite the steering finger, through the boat: the rope hand and the
      // steering hand never land on each other (Felix 2026-11-05: a fixed spot
      // sat right under the steering finger when sailing south-east).
      const steer = [...pointers.values()].find((q) => q.role === 'steer');
      const [gx, gy] = ghostSpot(bx, by, steer.x, steer.y, W, H);
      ctx.save();
      ctx.globalAlpha = Math.min(1, (offSince - 1.2) * 2) * 0.75;
      ctx.strokeStyle = 'rgba(255,240,200,0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(gx, gy, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = INK;
      ctx.font = '700 12px ui-rounded, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      if (CONFIG.PHONE_SHEET === 'rope') {
        drawRope(gx, gy, self.trim, true);
        ctx.fillText('hold the rope here', gx, gy + 28);
        ropeHint(gx, gy, need, pulse);
      } else {
        ctx.fillText('second thumb', gx, gy + 28);
        dotHint(gx, gy, self, wind, need, pulse);
      }
      ctx.restore();
    }

    if (ropeOn) drawRopeControl(nowS);

    if (extras.partner) edgeDot(extras.partner.x, extras.partner.z, '#66ccff', 7);
    for (const ping of extras.pings) if (ping.fromFriend) edgeDot(ping.x, ping.z, GOLD, 9);

    // Speed and finds, small, bottom-centre — no corner HUD on phones.
    const line = `${(self.speed * 1.94384).toFixed(1)} kn · ${extras.foundText}`;
    ctx.font = '800 15px ui-rounded, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(234,246,255,0.9)';
    ctx.fillText(line, W / 2, H - 16);
  }

  return {
    apply,
    draw,
    // The rope's box (for names to keep clear of) and whether it is shown (hidden while the chart covers the view).
    ropeRect() { const g = ropeGeom(W, H); return ropeOn ? { x: g.x - ROPE_HIT_HALF_W, y: g.y0 - 34, w: ROPE_HIT_HALF_W * 2, h: g.len + 68 } : null; },
    ropeScroll: () => ({ offset: ropeOffset, vel: ropeVel, guide: ropeGuide, sheave: sheaveAngle }), // headless checks
    setRopeVisible(on) { if (on === ropeOn) return; ropeOn = on; if (!on) for (const [id, q] of pointers) if (q.role === 'rope') pointers.delete(id); },
    // Drop every finger the controls are tracking (a pinch-to-zoom began: those two fingers are zooming, not steering).
    interrupt() { pointers.clear(); aimHeading = null; },
    destroy() {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      window.removeEventListener('resize', resize);
      layer.remove();
    },
  };
}
