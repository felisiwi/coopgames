// The motion of the busy Today coast, as pure maths (no THREE, no clock of its own): where is a boat on its route at time t, which way
// does it point, and when does it give way to the player. Used by src/busy-today.js; tested by src/busy-today.test.js.
//
// Everything is a FUNCTION OF TIME on a fixed route, so both players see the same traffic with no network messages (the clock is the wall
// clock: a second or two of drift between two phones is invisible). The only local state is `lag`: how many seconds this boat has held
// still to give way. Position = the schedule at (t - lag). Holding still = lag grows by dt; catching up = lag shrinks, so the boat runs a
// little faster than its timetable until it is back on it.
//
// Conventions: game metres, x east, z south; heading psi points the way the bow does: forward = (sin psi, cos psi) (src/boats.js, bobBoat).

export const TWO_PI = Math.PI * 2;
export const CATCH_UP = 0.5; // seconds of lag recovered per second: a boat runs at 1.5 x its timetable speed to catch up
export const TURN_DIST_M = 30; // after leaving a quay the heading swings from "bow to the quay" to the travel direction over this distance

// ---- routes -----------------------------------------------------------------------------------------------------------
export function makeRoute(points) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  return { pts: points, cum, length: cum[cum.length - 1] };
}
// Point at distance s (clamped) along the route.
export function routePoint(route, s) {
  const { pts, cum } = route;
  const d = Math.max(0, Math.min(route.length, s));
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= d) lo = m; else hi = m; }
  const seg = cum[hi] - cum[lo] || 1, t = (d - cum[lo]) / seg;
  return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * t, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * t];
}
// Heading of travel at s, looking `span` metres either side so a corner is a gentle swing, not a snap. dir = -1 travels the route backwards.
export function routeHeading(route, s, dir = 1, span = 4) {
  const a = routePoint(route, s - span), b = routePoint(route, s + span);
  const h = Math.atan2(b[0] - a[0], b[1] - a[1]);
  return dir >= 0 ? h : normAngle(h + Math.PI);
}
export const normAngle = (a) => { let x = a % TWO_PI; if (x > Math.PI) x -= TWO_PI; if (x < -Math.PI) x += TWO_PI; return x; };
export const lerpAngle = (a, b, t) => normAngle(a + normAngle(b - a) * t);
const smooth = (t) => { const k = Math.max(0, Math.min(1, t)); return k * k * (3 - 2 * k); };

// ---- timetable --------------------------------------------------------------------------------------------------------
// stopsAtM: ascending distances of the stops along the route (a plain A-B boat: [0, length]). The boat goes A -> ... -> B, then back,
// waiting dwellS[i] seconds at each stop (a number applies to all). Returns { cycleS, segs } with segs = dwell / move pieces in order.
export function makeSchedule({ stopsAtM, speed, dwellS }) {
  const n = stopsAtM.length;
  const dwell = (i) => (Array.isArray(dwellS) ? dwellS[i] : dwellS);
  const segs = [];
  let t = 0;
  const add = (seg) => { segs.push({ ...seg, t0: t }); t += seg.dur; };
  for (let i = 0; i < n; i++) { add({ type: 'dwell', stop: i, dur: dwell(i), dir: i === 0 ? 1 : 1 }); if (i < n - 1) add({ type: 'move', from: stopsAtM[i], to: stopsAtM[i + 1], dir: 1, dur: Math.abs(stopsAtM[i + 1] - stopsAtM[i]) / speed }); }
  for (let i = n - 2; i >= 0; i--) { add({ type: 'move', from: stopsAtM[i + 1], to: stopsAtM[i], dir: -1, dur: Math.abs(stopsAtM[i + 1] - stopsAtM[i]) / speed }); if (i > 0) add({ type: 'dwell', stop: i, dur: dwell(i), dir: -1 }); }
  // the final stop (stop 0 again) is the first segment of the next cycle: its dwell is segs[0]
  return { cycleS: t, segs, stopsAtM, speed };
}
// The heading a boat has on arrival at the stop that segment k (a dwell) belongs to, and the heading it leaves with.
function dwellHeadings(route, sched, k) {
  const { segs } = sched;
  const prev = segs[(k - 1 + segs.length) % segs.length], next = segs[(k + 1) % segs.length];
  const s = sched.stopsAtM[segs[k].stop];
  const arr = prev.type === 'move' ? routeHeading(route, s, prev.dir) : routeHeading(route, s, next.dir);
  const dep = next.type === 'move' ? routeHeading(route, s, next.dir) : arr;
  return { arr, dep };
}
// Where the boat is at schedule time tau (seconds, any size). Returns { s, dir, moving, speed, heading, stop }.
export function schedulePose(route, sched, tau) {
  const T = ((tau % sched.cycleS) + sched.cycleS) % sched.cycleS;
  let k = 0;
  while (k < sched.segs.length - 1 && sched.segs[k + 1].t0 <= T) k++;
  const seg = sched.segs[k], local = T - seg.t0;
  if (seg.type === 'dwell') {
    const { arr } = dwellHeadings(route, sched, k);
    return { s: sched.stopsAtM[seg.stop], dir: seg.dir, moving: false, speed: 0, heading: arr, stop: seg.stop };
  }
  const sgn = Math.sign(seg.to - seg.from) || 1, s = seg.from + sgn * sched.speed * local;
  let heading = routeHeading(route, s, seg.dir);
  // leaving a stop: swing from the heading the boat arrived with (bow to the quay) to the travel heading, over TURN_DIST_M
  const k0 = (k - 1 + sched.segs.length) % sched.segs.length;
  if (sched.segs[k0].type === 'dwell') {
    const away = Math.abs(s - seg.from);
    if (away < TURN_DIST_M) heading = lerpAngle(dwellHeadings(route, sched, k0).arr, heading, smooth(away / TURN_DIST_M));
  }
  return { s, dir: seg.dir, moving: true, speed: sched.speed, heading, stop: -1 };
}
export function vesselPose(route, sched, tau) {
  const p = schedulePose(route, sched, tau);
  const [x, z] = routePoint(route, p.s);
  return { x, z, ...p };
}

// ---- giving way -------------------------------------------------------------------------------------------------------
// A boat holds still while another boat (the player, the friend) is inside its body circle or is near the water just ahead of it.
export const YIELD_BODY_MARGIN_M = 14; // body circle = half length + this
export const YIELD_AHEAD_R_M = 16; // radius of the "water ahead" circle
export const YIELD_AHEAD_BASE_M = 6; // the ahead point starts this far past the bow ...
export const YIELD_AHEAD_SECONDS = 2.5; // ... plus this many seconds of travel
export function mustYield(pose, halfLen, others) {
  const fx = Math.sin(pose.heading), fz = Math.cos(pose.heading);
  const ahead = halfLen + YIELD_AHEAD_BASE_M + pose.speed * YIELD_AHEAD_SECONDS;
  const ax = pose.x + fx * ahead, az = pose.z + fz * ahead;
  for (const o of others) {
    if (!o || o.x == null) continue;
    if (Math.hypot(o.x - pose.x, o.z - pose.z) <= halfLen + YIELD_BODY_MARGIN_M) return true;
    if (pose.moving && Math.hypot(o.x - ax, o.z - az) <= YIELD_AHEAD_R_M) return true;
  }
  return false;
}
// state.lag (seconds) grows while giving way, shrinks (CATCH_UP per second) once clear. The timetable is periodic, so whole cycles of lag
// are the same place: they are dropped on release instead of being "caught up".
export function stepYield(state, dt, yielding, cycleS) {
  if (yielding) { state.lag += dt; return state; }
  if (state.lag > cycleS) state.lag %= cycleS;
  state.lag = Math.max(0, state.lag - CATCH_UP * dt);
  return state;
}
