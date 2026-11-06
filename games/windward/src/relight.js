// The relight sequence (stage 1d): what happens from the moment the boat moors at a dark lighthouse until the camera goes back to the boat.
// Pure timeline, no THREE and no DOM: chart-controller.js runs it, game.js and the lantern fx read what it says.
//
//   glide   the camera glides to the lighthouse (the visit view, zoomed in)
//   circle  one slow turn round it (yaw 0 to 2 pi, eased); the light comes back on MID-circle and the lamp warms up
//   reveal  a little after the light is on, the fog on the chart lifts in a wide circle (grows from nothing to the full radius)
//   hold    the camera rests a moment on the lit lighthouse, then the visit ends and the camera returns to the boat
// The turn ends at yaw 2 pi, which is the same view as 0 (the camera is north-up again), so nothing has to unwind.
export const RELIGHT = {
  glideS: 1.6,
  circleS: 10,
  igniteAt: 0.5, // fraction of the circle: mid-circle
  rampS: 1.4, // the lamp warms up over this long
  revealDelayS: 0.5, // the fog starts lifting this long after the light is on
  revealS: 2.6,
  holdS: 2.2,
};
export const REVEAL_RADIUS_M = 600; // game metres (6 km real): "a wide circle". TODO(felix): tune by feel
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const smoother = (x) => { const t = clamp01(x); return t * t * t * (t * (t * 6 - 15) + 10); };

export const igniteTime = (c = RELIGHT) => c.glideS + c.circleS * c.igniteAt;
export const relightDuration = (c = RELIGHT) => c.glideS + c.circleS + c.holdS;

// t: seconds since the boat moored. Returns { phase, yaw (rad), lamp (0..1), ignited, revealFrac (0..1), done }.
export function relightFrame(t, c = RELIGHT) {
  const ti = igniteTime(c);
  const s = clamp01((t - c.glideS) / c.circleS);
  return {
    phase: t < c.glideS ? 'glide' : t < c.glideS + c.circleS ? 'circle' : t < relightDuration(c) ? 'hold' : 'done',
    yaw: 2 * Math.PI * smoother(s),
    lamp: smooth((t - ti) / c.rampS),
    ignited: t >= ti,
    revealFrac: smooth((t - ti - c.revealDelayS) / c.revealS),
    done: t >= relightDuration(c),
  };
}
