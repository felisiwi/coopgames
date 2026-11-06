// Zoom, and the smooth hand-over from the 3D boat view to the 2D chart (stage 1c). Pure maths, no THREE and no DOM.
//
// `zoom` is the camera-distance multiplier the game already had (1 = the default 125 m). Today it ran 0.5 .. 2.5. Now:
//   ZOOM_MIN .. ZOOM_CHART_START   the 3D view, as before but further out
//   ZOOM_CHART_START .. _FULL      the chart fades in over the 3D view, scale-matched so it is one continuous zoom
//   above ZOOM_CHART_FULL          only the chart (the 3D render is paused: free frame time), zooming on out
//                                  until the whole coast fits (maxZoom).
// The 3D camera looks due north (azimuth 0), so north is up on the screen at every zoom and the chart never turns: it is drawn
// at the start of the blend with the same scale and the same tilt (a vertical squash by sin(elevation)) as the 3D view, and over
// the blend it only un-tilts to a flat map. So the crossfade has almost nothing to hide.
import { CONFIG } from './config.js';

export const ZOOM_MIN = CONFIG.ZOOM_MIN;
export const ZOOM_CHART_START = 4; // 500 m from the boat: the 3D view's last clear zoom (the far sea ring and the terrain LODs hold to here and a bit beyond)
export const ZOOM_CHART_FULL = 6.5;
export const ZOOM_STEP = 1.35; // a +/- button press, as in the Map Lab

const DEG = Math.PI / 180;
const TAN_HALF_FOV = Math.tan((CONFIG.FIXED_CAMERA_FOV_DEG * DEG) / 2);
const SIN_ELEV = Math.sin(CONFIG.FIXED_CAMERA_ELEVATION_DEG * DEG);

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

// 0 in the 3D view, 1 in the chart.
export const chartBlend = (zoom) => smoothstep(ZOOM_CHART_START, ZOOM_CHART_FULL, zoom);

// Screen pixels per game metre along the screen's x axis, at the boat, for a camera `zoom` away (the vertical field of
// view fills viewH pixels). The 3D camera and the chart both use it, which is what keeps them scale-matched.
export const pxPerMetre = (zoom, viewH) => viewH / (2 * CONFIG.FIXED_CAMERA_DISTANCE * zoom * TAN_HALF_FOV);
export const zoomForScale = (scale, viewH) => viewH / (2 * CONFIG.FIXED_CAMERA_DISTANCE * scale * TAN_HALF_FOV);

// The zoom at which a whole picture `metresW` x `metresH` fits the view (the full chart), with a small margin.
export function fitZoom(metresW, metresH, viewW, viewH, margin = 0.94) {
  const scale = Math.min(viewW / metresW, viewH / metresH) * margin;
  return zoomForScale(scale, viewH);
}

// Zoom by a factor (wheel, pinch, buttons), kept inside [ZOOM_MIN, max].
export const stepZoom = (zoom, factor, max) => clamp(zoom * factor, ZOOM_MIN, max);

// Wheel: a notch (deltaY ~ 100) is about a 16% change, the same feel in both directions.
export const wheelFactor = (deltaY) => Math.exp(deltaY * CONFIG.ZOOM_WHEEL_SENSITIVITY);

// The chart's view for this zoom. centre: the world point at the screen centre (the boat, or the lighthouse on a visit);
// pan: extra offset in game metres from dragging, which eases away as the chart fades back into the boat view.
// Returns { cx, cz, scale, sq, t, alpha }: screen = (W/2, H/2) + diag(1, sq) * (p - c) * scale. North is up; there is no turn.
export function chartView(zoom, viewH, centre, pan = { x: 0, z: 0 }) {
  const t = chartBlend(zoom);
  return {
    cx: centre.x + pan.x * t,
    cz: centre.z + pan.z * t,
    scale: pxPerMetre(zoom, viewH),
    sq: lerp(SIN_ELEV, 1, t),
    t,
    alpha: t,
  };
}

// World (x, z) to screen px, and back, for a chartView() and the view size.
export function worldToScreen(v, W, H, x, z) {
  return [W / 2 + (x - v.cx) * v.scale, H / 2 + (z - v.cz) * v.scale * v.sq];
}
export function screenToWorld(v, W, H, sx, sy) {
  return [v.cx + (sx - W / 2) / v.scale, v.cz + (sy - H / 2) / (v.scale * v.sq)];
}

// Where the 3D fixed camera puts a ground point on screen, to compare with the chart at t = 0 (tests): the camera looks due
// north, so screen-right is +x (east) and ground-up is -z (north).
export function cameraGroundToScreen(zoom, viewH, W, H, boat, x, z) {
  const scale = pxPerMetre(zoom, viewH);
  return [W / 2 + (x - boat.x) * scale, H / 2 + (z - boat.z) * scale * SIN_ELEV];
}
