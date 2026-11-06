// Zoom, and the smooth hand-over from the 3D boat view to the 2D chart (stage 1c). Pure maths, no THREE and no DOM.
//
// `zoom` is the camera-distance multiplier the game already had (1 = the default 125 m). Today it ran 0.5 .. 2.5. Now:
//   ZOOM_MIN .. ZOOM_CHART_START   the 3D view, as before but further out
//   ZOOM_CHART_START .. _FULL      the chart fades in over the 3D view, scale-matched so it is one continuous zoom
//   above ZOOM_CHART_FULL          only the chart (the 3D render is paused: free frame time), zooming on out
//                                  until the whole coast fits (maxZoom).
// The chart is drawn so that at the start of the blend it looks like the 3D view from above: same scale, same
// tilt (a vertical squash by sin(elevation)) and the same turn (the camera looks along a 45 degree bearing), and over
// the blend it unrolls to a flat north-up map. So the crossfade has almost nothing to hide.
import { CONFIG } from './config.js';

export const ZOOM_MIN = CONFIG.ZOOM_MIN;
export const ZOOM_CHART_START = 4; // 500 m from the boat: the 3D view's last clear zoom (the far sea ring and the terrain LODs hold to here and a bit beyond)
export const ZOOM_CHART_FULL = 6.5;
export const ZOOM_STEP = 1.35; // a +/- button press, as in the Map Lab

const DEG = Math.PI / 180;
const TAN_HALF_FOV = Math.tan((CONFIG.FIXED_CAMERA_FOV_DEG * DEG) / 2);
const AZIMUTH = CONFIG.FIXED_CAMERA_AZIMUTH_DEG * DEG;
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
// Returns { cx, cz, scale, rot, sq, t, alpha }: screen = (W/2, H/2) + diag(1, sq) * R(rot) * (p - c) * scale.
export function chartView(zoom, viewH, centre, pan = { x: 0, z: 0 }) {
  const t = chartBlend(zoom);
  return {
    cx: centre.x + pan.x * t,
    cz: centre.z + pan.z * t,
    scale: pxPerMetre(zoom, viewH),
    rot: AZIMUTH * (1 - t),
    sq: lerp(SIN_ELEV, 1, t),
    t,
    alpha: t,
  };
}

// World (x, z) to screen px, and back, for a chartView() and the view size.
export function worldToScreen(v, W, H, x, z) {
  const dx = x - v.cx;
  const dz = z - v.cz;
  const c = Math.cos(v.rot);
  const s = Math.sin(v.rot);
  return [W / 2 + (dx * c - dz * s) * v.scale, H / 2 + (dx * s + dz * c) * v.scale * v.sq];
}
export function screenToWorld(v, W, H, sx, sy) {
  const rx = (sx - W / 2) / v.scale;
  const rz = (sy - H / 2) / (v.scale * v.sq);
  const c = Math.cos(v.rot);
  const s = Math.sin(v.rot);
  return [v.cx + rx * c + rz * s, v.cz - rx * s + rz * c];
}

// Where the 3D fixed camera puts a ground point on screen, to compare with the chart at t = 0 (tests): the camera looks
// along (-sin az, -cos az) on the ground, so screen-right is (cos az, -sin az) and ground-up is (-sin az, -cos az).
export function cameraGroundToScreen(zoom, viewH, W, H, boat, x, z) {
  const scale = pxPerMetre(zoom, viewH);
  const dx = x - boat.x;
  const dz = z - boat.z;
  const right = dx * Math.cos(AZIMUTH) - dz * Math.sin(AZIMUTH);
  const up = -dx * Math.sin(AZIMUTH) - dz * Math.cos(AZIMUTH);
  return [W / 2 + right * scale, H / 2 - up * scale * SIN_ELEV];
}
