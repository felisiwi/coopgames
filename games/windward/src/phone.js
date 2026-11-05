// Phone controls (2026-11-05) — the Control Lab version, in the real game.
// Felix + Hani tested these in the "Windward Control Lab" prototype; see
// DESIGN.md "Phone controls: Control Lab findings".
//
//   first finger   hold on the water where you want to go; the boat turns
//                  towards it (never into the no-go zone). The line to your
//                  finger is coloured by how fast that heading is, with the
//                  knots in a pill ABOVE the finger.
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
    if (steering()) p.role = 'sheet';
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
    // A held finger keeps pointing at the same spot on the water as the boat moves.
    for (const p of pointers.values()) if (p.role === 'steer') aimAt(p.x, p.y);
    if (aimHeading !== null) self.heading = turnTowards(self.heading, avoidNoGo(aimHeading, wind.dir), dt);
    const ideal = idealTrimRad(angleOffWind(self.heading, wind.dir));
    offSince = Math.abs(ideal - self.trim) > TRIM_WINDOW ? offSince + dt : 0;

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
    trace(CONFIG.TRIM_MIN, CONFIG.TRIM_MAX, 3, 'rgba(234,246,255,0.18)'); // where the sail can swing
    trace(Math.max(0, ideal - TRIM_WINDOW * 1.3), Math.min(CONFIG.TRIM_MAX, ideal + TRIM_WINDOW * 1.3), 7, 'rgba(120,220,150,0.85)');
    const [dx, dy] = arcPoint(boomAngle(self.heading, wind.dir, self.trim), R);
    ctx.fillStyle = Math.abs(self.trim - ideal) <= TRIM_WINDOW ? '#78dc96' : GOLD;
    ctx.beginPath();
    ctx.arc(dx, dy, 6, 0, Math.PI * 2);
    ctx.fill();
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
    if (steering() && !sheeting && offSince > 1.2 && need !== 0) {
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
