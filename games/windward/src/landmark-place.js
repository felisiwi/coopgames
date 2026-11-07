// Landmark placement, the pure parts (no THREE, no DOM): which placements stand in an era, which way they face, where the boat and camera go for a "from the boat" view,
// and the three camera rigs. Testable in node (src/landmark-place.test.js). The data is data/landmarks.json; docs/LANDMARKS.md explains the fields.
//
// Conventions (checked against the game, 2026-11-07):
//  - Game axes: +x east, +z SOUTH (lat = north - z; seamark-place.js makeFromGame). The coast is 1:10 in plan: 1 game metre = 10 real metres.
//  - heading = the COMPASS BEARING (degrees, 0 = north, 90 = east) that the model's +Z side faces: a cairn's arm, a hut's gable, a church's tower end. A model turned by
//    yaw = PI - bearing has its +Z toward that bearing (three.js: yaw t sends +Z to (sin t, cos t) in (x, z); bearing = atan2(x, -z)).
//  - The game's fixed camera sits SOUTH of the boat looking north (azimuth 0, elevation 52 deg, distance 125 x zoom), so a landmark you can see well lies north of the boat.
//  - Landmarks are built at 1:1 real metres; the game enlarges them when it places them (cairns x1.8, marks x2.0, src/world-year-build.js): LANDMARK_TYPES[type].readScale.
import { LANDMARK_TYPES } from './landmark-assets.js';

export const ERA_YEAR = { 1703: 1703, 1950: 1950, today: 2026 };
export const ERA_IDS = Object.keys(ERA_YEAR);
const DEG = Math.PI / 180;

// ---- era rules -------------------------------------------------------------------------------------------------------
// A placement says when it was built / taken away (years, or null when the source gives none). Then the eras it MUST be listed in follow from the years.
export const standsIn = (p, era) => (p.built == null ? null : p.built <= ERA_YEAR[era] && (p.until == null || p.until > ERA_YEAR[era]));
export function expectedEras(p) {
  if (p.built == null) return null; // undated (a heap of stones, a sea hut): the placement's own list is the claim, checked against the variant's
  return ERA_IDS.filter((e) => standsIn(p, e));
}
export const placementsFor = (data, era) => data.placements.filter((p) => p.era.includes(era));
export const placementById = (data, id) => data.placements.find((p) => p.id === id) ?? null;

// ---- geometry ----------------------------------------------------------------------------------------------------------
export const bearingToYaw = (bearingDeg) => Math.PI - bearingDeg * DEG; // a model's +Z to this compass bearing
export const yawToBearing = (yaw) => (((180 - (yaw / DEG)) % 360) + 360) % 360;
export const bearingVector = (bearingDeg) => ({ x: Math.sin(bearingDeg * DEG), z: -Math.cos(bearingDeg * DEG) }); // game x, z of a compass direction
export const bearingOf = (dx, dz) => (((Math.atan2(dx, -dz) / DEG) % 360) + 360) % 360;
// Which way is the open water from (x, z)? The direction (compass bearing) of the lowest ground within r metres: where a hut, a church or a pier should face.
export function seawardBearing(heightAt, x, z, { r = 16, steps = 24 } = {}) {
  let best = null, bestH = Infinity;
  for (let k = 0; k < steps; k++) {
    const b = (k / steps) * 360, v = bearingVector(b);
    let h = 0;
    for (const f of [0.5, 1]) h += heightAt(x + v.x * r * f, z + v.z * r * f);
    if (h < bestH - 1e-9) { bestH = h; best = b; }
  }
  return best;
}
// lon, lat -> game x, z, the inverse of seamark-place.js makeFromGame, through the world's own toGame (passed in)
export const gameOf = (toGame, lon, lat) => toGame(lon, lat);

// ---- the three cameras (the "from the boat" toggle) --------------------------------------------------------------------
// game    the camera as it is on main: zoom 1, elevation 52 deg, nothing else.
// weather the weather camera at rest: agent 2 (felix/windward-weather, src/game-weather.js HOME_ZOOM) rests it at zoom 1.4.
// speed   the weather camera at full speed (src/sail-feel-model.js FEEL): 12 deg lower, 20% closer, looking 45 m ahead of the bow.
// COPIED, not imported: those files are on agent 2's branch, not on main yet. TODO(agent 4): re-sync when the weather branch is merged.
export const CAMERA_RIGS = {
  game: { label: 'The game today', zoom: 1, dipDeg: 0, tight: 0, lookAheadM: 0, note: 'zoom 1, elevation 52 deg (config.js)' },
  weather: { label: 'Weather camera (x1.4)', zoom: 1.4, dipDeg: 0, tight: 0, lookAheadM: 0, note: 'agent 2: resting zoom 1.4' },
  speed: { label: 'Weather camera at speed', zoom: 1.4, dipDeg: 12, tight: 0.2, lookAheadM: 45, note: 'agent 2: dip 12 deg, 20% closer, 45 m look-ahead, at full speed' },
};
export const CAMERA_IDS = Object.keys(CAMERA_RIGS);
const AHEAD_SIDE_M = 6, AHEAD_DOWN_M = 7; // agent 2's clamps: sideways per unit of zoom, and toward the bottom of the screen
// the look-ahead offset for a boat with this game heading (radians; 0 = +z = south; PI = north), as sail-feel-fx.js lookAheadVector
export function lookAheadVector(heading, lookM, zoom) {
  const lx = Math.max(-AHEAD_SIDE_M * zoom, Math.min(AHEAD_SIDE_M * zoom, Math.sin(heading) * lookM));
  const lzRaw = Math.cos(heading) * lookM;
  return { x: lx, z: lzRaw > AHEAD_DOWN_M * zoom ? AHEAD_DOWN_M * zoom : lzRaw };
}
// Where the camera sits and what it looks at, for a rig, a boat position and the boat's game heading. cfg = { distance, elevationDeg, azimuthDeg } from config.js FIXED_CAMERA_*.
export function rigPose(rig, boat, heading, cfg) {
  const r = typeof rig === 'string' ? CAMERA_RIGS[rig] : rig;
  const el = (cfg.elevationDeg - r.dipDeg) * DEG, az = cfg.azimuthDeg * DEG;
  const dist = cfg.distance * r.zoom * (1 - r.tight);
  const ahead = lookAheadVector(heading, r.lookAheadM, r.zoom);
  const target = { x: boat.x + ahead.x, z: boat.z + ahead.z };
  return { target, position: { x: target.x + Math.sin(az) * Math.cos(el) * dist, y: Math.sin(el) * dist, z: target.z + Math.cos(az) * Math.cos(el) * dist }, distance: dist, elevationDeg: cfg.elevationDeg - r.dipDeg };
}

// ---- a "from the boat" view: where the boat starts --------------------------------------------------------------------
// view = { focus: {lon, lat}, from: bearing the boat is at FROM the focus (deg), distM: game metres }. Returns the wanted game position of the boat and its heading toward the focus
// (the caller moves it to the nearest open water). Heading is the game's (0 = +z = south): atan2(dx, dz).
export function boatWanted(view, toGame) {
  const [fx, fz] = toGame(view.focus.lon, view.focus.lat);
  const v = bearingVector(view.from);
  const x = fx + v.x * view.distM, z = fz + v.z * view.distM;
  return { x, z, focus: { x: fx, z: fz }, heading: Math.atan2(fx - x, fz - z) };
}
// the lowest point of a layout that must sit inside the play region
export const inRegion = (region, lat, lon) => lat >= region.s && lat <= region.n && lon >= region.w && lon <= region.e;
export const readScaleOf = (type) => LANDMARK_TYPES[type]?.readScale ?? 1;
