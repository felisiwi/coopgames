// Landmark placement, the parts with no scene and no DOM: which placements stand in an era, which way they face, where the boat and camera go for a "from the boat" view,
// and the three camera rigs (derived from the game's own camera code on main). Testable in node (src/landmark-place.test.js). The data is data/landmarks.json; docs/LANDMARKS.md explains the fields.
//
// Conventions (checked against the game, 2026-11-07):
//  - Game axes: +x east, +z SOUTH (lat = north - z; seamark-place.js makeFromGame). The coast is 1:10 in plan: 1 game metre = 10 real metres.
//  - heading = the COMPASS BEARING (degrees, 0 = north, 90 = east) that the model's +Z side faces: a cairn's arm, a hut's gable, a church's tower end. A model turned by
//    yaw = PI - bearing has its +Z toward that bearing (three.js: yaw t sends +Z to (sin t, cos t) in (x, z); bearing = atan2(x, -z)).
//  - The game's fixed camera sits SOUTH of the boat looking north (azimuth 0, elevation 52 deg, distance 125 x zoom), so a landmark you can see well lies north of the boat.
//  - Landmarks are built at 1:1 real metres; the game enlarges them when it places them (cairns x1.8, marks x2.0, src/world-year-build.js): LANDMARK_TYPES[type].readScale.
import { LANDMARK_TYPES } from './landmark-assets.js';
import { FEEL, cameraFeel } from './sail-feel-model.js';
import { lookAheadVector as gameLookAheadVector } from './sail-feel-fx.js';
import { GAME_WEATHER } from './game-weather.js';
import { CONFIG } from './config.js';

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
// game    the camera as it was before the weather work: zoom 1, elevation 52 deg, nothing else.
// weather the game's camera at rest on main: it rests at zoom GAME_WEATHER.HOME_ZOOM (src/game-weather.js; game.js `zoom = weatherWanted ? HOME_ZOOM : 1`).
// speed   the same at full speed: the camera feel at full speed (game.js: cameraFeel(camShare) with camShare 1), i.e. dipped, tighter and looking ahead of the bow.
// SYNCED 2026-11-07 after felix/windward-weather merged to main: the numbers are IMPORTED from main's modules (sail-feel-model.js FEEL / cameraFeel, game-weather.js GAME_WEATHER,
// sail-feel-fx.js lookAheadVector), no longer copied, so the lab follows the game when agent 2 tunes them. The test compares the rigs with those exports.
const FULL = cameraFeel(1); // { elevDropDeg, distMul, lookAheadM } at full speed, as game.js computes it with the feel fade k = 1 (zoom well under 1.8, not near the chart)
export const CAMERA_RIGS = {
  game: { label: 'Game camera (zoom 1)', zoom: 1, dipDeg: 0, tight: 0, lookAheadM: 0, note: `zoom 1, elevation ${CONFIG.FIXED_CAMERA_ELEVATION_DEG} deg, distance ${CONFIG.FIXED_CAMERA_DISTANCE} (config.js)` },
  weather: { label: `Weather camera (x${GAME_WEATHER.HOME_ZOOM})`, zoom: GAME_WEATHER.HOME_ZOOM, dipDeg: 0, tight: 0, lookAheadM: 0, note: `main: resting zoom ${GAME_WEATHER.HOME_ZOOM} (GAME_WEATHER.HOME_ZOOM)` },
  speed: { label: 'Weather camera at speed', zoom: GAME_WEATHER.HOME_ZOOM, dipDeg: FEEL.CAM_DIP_DEG, tight: FEEL.CAM_TIGHT, lookAheadM: FEEL.CAM_LOOK_AHEAD_M, note: `main: ${FEEL.CAM_DIP_DEG} deg lower, ${Math.round(FEEL.CAM_TIGHT * 100)}% closer, ${FEEL.CAM_LOOK_AHEAD_M} m look-ahead at full speed (cameraFeel(1))` },
};
export const CAMERA_IDS = Object.keys(CAMERA_RIGS);
// the look-ahead offset for a boat with this game heading (radians; 0 = +z = south; PI = north): the game's own function, sail-feel-fx.js lookAheadVector
export const lookAheadVector = (heading, lookM, zoom) => gameLookAheadVector(heading, lookM, zoom, { x: 0, z: 0 });
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
