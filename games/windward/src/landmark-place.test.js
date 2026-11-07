// node games/windward/src/landmark-place.test.js — the landmark placements (data/landmarks.json) are honest: a known look, a source, a position inside the play region, and NEVER an era the
// landmark did not exist in (derived from its years, not only trusted from its list); and the pure placement maths (headings, the three cameras, the boat's start) is right.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LANDMARK_TYPES } from './landmark-assets.js';
import { FEEL, cameraFeel } from './sail-feel-model.js';
import { lookAheadVector as mainLookAhead } from './sail-feel-fx.js';
import { GAME_WEATHER } from './game-weather.js';
import { CONFIG } from './config.js';
import {
  ERA_IDS, ERA_YEAR, standsIn, expectedEras, placementsFor, placementById, bearingToYaw, yawToBearing, bearingVector, bearingOf, seawardBearing, CAMERA_RIGS, CAMERA_IDS,
  lookAheadVector, rigPose, boatWanted, inRegion, readScaleOf,
} from './landmark-place.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const data = read('../data/landmarks.json');
const region = read('../assets/coast/names.json').region;
const lore = read('../data/island-lore.json');
const CONFPOS = new Set(['exact', 'approx']), CONFFACT = new Set(['high', 'medium', 'low']);
let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }

check('every placement is a known look with an era list, a source and an honest confidence; ids are unique', () => {
  const ids = new Set();
  for (const p of data.placements) {
    assert.ok(!ids.has(p.id), `duplicate id ${p.id}`); ids.add(p.id);
    const type = LANDMARK_TYPES[p.type];
    assert.ok(type, `${p.id}: unknown type ${p.type}`);
    const v = type.variants[p.variant];
    assert.ok(v, `${p.id}: unknown variant ${p.type}/${p.variant}`);
    assert.ok(Array.isArray(p.era) && p.era.length > 0 && p.era.every((e) => ERA_IDS.includes(e)), `${p.id}: era list`);
    for (const e of p.era) assert.ok(v.eras.includes(e), `${p.id}: the look ${p.type}/${p.variant} does not stand in ${e} (it lists ${v.eras.join(', ') || 'none'})`);
    assert.ok(typeof p.source === 'string' && p.source.length > 10, `${p.id}: source`);
    assert.ok(CONFPOS.has(p.confidence), `${p.id}: position confidence ${p.confidence}`);
    assert.ok(CONFFACT.has(p.factConfidence), `${p.id}: fact confidence ${p.factConfidence}`);
    assert.ok(lore.places[p.place], `${p.id}: place ${p.place} is not an island-lore.json key`);
  }
  assert.ok(data.placements.length >= 25, 'a useful number of placements');
});

check('every placement is inside the play region (assets/coast/names.json)', () => {
  for (const p of data.placements) assert.ok(inRegion(region, p.lat, p.lon), `${p.id}: ${p.lat}, ${p.lon} is outside the region`);
});

check('no landmark is placed in an era it did not exist in: derived from built / until', () => {
  for (const p of data.placements) {
    const want = expectedEras(p);
    if (want == null) continue; // undated: the look's own era list is the claim (checked above)
    for (const e of p.era) assert.ok(standsIn(p, e), `${p.id}: listed in ${e} but built ${p.built}${p.until ? ` until ${p.until}` : ''} (${ERA_YEAR[e]})`);
    const missing = want.filter((e) => !p.era.includes(e));
    if (missing.length) assert.ok(p.replacedBy && placementById(data, p.replacedBy), `${p.id}: stands in ${missing.join(', ')} but is not listed there and names no replacement`);
  }
});

check('the brief\'s era table holds: pole and ball only before 2005 (1950 yes), a cone raised after 1978, Gåsö chapel only from 1955, the windmill from 1854, no Grundsund huts in 1703', () => {
  const by = (id) => placementById(data, id);
  assert.deepEqual(by('lm-bonden').era, ['1950', 'today']);
  assert.ok(!by('lm-gaso-chapel').era.includes('1950') && by('lm-gaso-chapel').era.includes('today'), 'the Gåsö chapel (1955) is not in 1950');
  assert.ok(!by('lm-korsholmen').era.includes('1703') && !by('lm-fiskebackskil-windmill').era.includes('1703'));
  assert.ok(!by('lm-grundsund-huts').era.includes('1703'), 'Grundsund as a village in 1703 is doubtful');
  assert.deepEqual(by('lm-maseskar-heap').era, ['1703'], 'the heaped cairn is only 1703 (uncertain)');
  assert.ok(by('lm-stangholmen-iron').era.includes('1950') && !by('lm-stangholmen-iron').era.includes('today'), 'the iron fyrkur was replaced in 1974');
  assert.ok(!by('lm-stangehuvud-dark').era.includes('today') && by('lm-stangehuvud-led').era.includes('today'));
  assert.ok(data.placements.filter((p) => p.era.includes('1703')).every((p) => !['church', 'windmill'].includes(p.type)), 'no church or windmill of ours stood in 1703');
});

check('the arms point where the records say: Hinneskär south-east (135), Pipeskär east (90)', () => {
  assert.equal(placementById(data, 'lm-hinneskar').heading, 135);
  assert.equal(placementById(data, 'lm-pipeskar').heading, 90);
  for (const p of data.placements.filter((x) => x.variant === 'cone-white-arm')) assert.ok(Number.isFinite(p.heading), `${p.id}: an arm needs a heading`);
  for (const p of data.placements) if (p.heading != null) assert.ok(p.heading >= 0 && p.heading < 360);
});

check('bearings and yaws agree: yaw = PI - bearing sends +Z to the bearing (north is -z, east is +x)', () => {
  for (const b of [0, 45, 90, 135, 180, 270, 359]) {
    const yaw = bearingToYaw(b), z = Math.cos(yaw), x = Math.sin(yaw); // where +Z goes after the turn
    const v = bearingVector(b);
    assert.ok(Math.abs(x - v.x) < 1e-9 && Math.abs(z - v.z) < 1e-9, `bearing ${b}`);
    assert.ok(Math.abs(yawToBearing(yaw) - b) < 1e-6 || Math.abs(yawToBearing(yaw) - b) > 359.999, `round trip ${b}`);
    assert.ok(Math.abs(bearingOf(v.x, v.z) - b) < 1e-6 || Math.abs(bearingOf(v.x, v.z) - b) > 359.999);
  }
});

check('seawardBearing finds the open water: lowest ground to the west gives 270, to the north-east 45', () => {
  const west = (x) => x; // ground rises to the east, so the water is west
  assert.equal(seawardBearing((x, z) => west(x), 0, 0), 270);
  assert.equal(seawardBearing((x, z) => x - z, 0, 0), 225, 'low where x is small (west) and z is large (south): south-west');
  const ne = (x, z) => -x + z; // lower toward +x and -z = north-east
  assert.equal(seawardBearing(ne, 0, 0), 45);
});

check('the cameras ARE main\'s: the rigs are derived from the game\'s own exports (HOME_ZOOM, FEEL, cameraFeel), so they cannot drift', () => {
  assert.deepEqual(CAMERA_IDS, ['game', 'weather', 'speed']);
  const full = cameraFeel(1);
  assert.equal(CAMERA_RIGS.game.zoom, 1);
  assert.equal(CAMERA_RIGS.weather.zoom, GAME_WEATHER.HOME_ZOOM, 'the weather camera rests at HOME_ZOOM');
  assert.equal(CAMERA_RIGS.speed.zoom, GAME_WEATHER.HOME_ZOOM);
  assert.equal(CAMERA_RIGS.speed.dipDeg, FEEL.CAM_DIP_DEG); assert.equal(CAMERA_RIGS.speed.dipDeg, full.elevDropDeg);
  assert.ok(Math.abs(1 - CAMERA_RIGS.speed.tight - full.distMul) < 1e-12, 'closer by the same share cameraFeel(1) gives');
  assert.equal(CAMERA_RIGS.speed.lookAheadM, full.lookAheadM);
  // the story, whatever the numbers: resting is further out than the old camera; at speed it dips, tightens and looks ahead
  assert.ok(CAMERA_RIGS.weather.zoom > CAMERA_RIGS.game.zoom);
  assert.ok(CAMERA_RIGS.speed.dipDeg > 0 && CAMERA_RIGS.speed.tight > 0 && CAMERA_RIGS.speed.lookAheadM > 0);
  for (const id of ['game', 'weather']) assert.ok(CAMERA_RIGS[id].dipDeg === 0 && CAMERA_RIGS[id].tight === 0 && CAMERA_RIGS[id].lookAheadM === 0, `${id} rests`);
});

check('rigPose does what game.js does: distance = FIXED_CAMERA_DISTANCE x zoom x distMul, elevation dropped by the feel, the target slid by lookAheadVector', () => {
  const cfg = { distance: CONFIG.FIXED_CAMERA_DISTANCE, elevationDeg: CONFIG.FIXED_CAMERA_ELEVATION_DEG, azimuthDeg: CONFIG.FIXED_CAMERA_AZIMUTH_DEG };
  const boat = { x: 100, z: 200 };
  for (const heading of [0, Math.PI / 2, Math.PI, 4.2]) {
    const g = rigPose('game', boat, heading, cfg), w = rigPose('weather', boat, heading, cfg), s = rigPose('speed', boat, heading, cfg);
    assert.deepEqual(g.target, boat); assert.deepEqual(w.target, boat);
    assert.ok(Math.abs(g.distance - cfg.distance) < 1e-9 && Math.abs(w.distance - cfg.distance * GAME_WEATHER.HOME_ZOOM) < 1e-9);
    const f = cameraFeel(1), ahead = mainLookAhead(heading, f.lookAheadM, GAME_WEATHER.HOME_ZOOM);
    assert.ok(Math.abs(s.distance - cfg.distance * GAME_WEATHER.HOME_ZOOM * f.distMul) < 1e-9, `speed distance, heading ${heading}`);
    assert.ok(Math.abs(s.elevationDeg - (cfg.elevationDeg - f.elevDropDeg)) < 1e-12);
    assert.ok(Math.abs(s.target.x - (boat.x + ahead.x)) < 1e-9 && Math.abs(s.target.z - (boat.z + ahead.z)) < 1e-9, `speed target, heading ${heading}`);
  }
  const g = rigPose('game', boat, Math.PI, cfg);
  assert.ok(g.position.z > boat.z && g.position.y > 0, 'the camera is south of the boat, above it');
  assert.ok(Math.abs(g.position.y - cfg.distance * Math.sin(cfg.elevationDeg * Math.PI / 180)) < 1e-9);
});

check('the look-ahead IS the game\'s function (sail-feel-fx.js), and north is free', () => {
  for (const zoom of [1, 1.4, 2]) for (const h of [0, 1, Math.PI / 2, 2.5, Math.PI, 5]) assert.deepEqual(lookAheadVector(h, 45, zoom), mainLookAhead(h, 45, zoom), `heading ${h}, zoom ${zoom}`);
  assert.ok(Math.abs(lookAheadVector(Math.PI, 12, 1.4).z + 12) < 1e-9, 'a boat heading north looks the full distance up the screen');
  assert.notEqual(lookAheadVector(Math.PI, 45, 1.4), lookAheadVector(Math.PI, 45, 1.4), 'a fresh object each call (no shared mutable state)');
});

check('every view is complete: a focus inside the region, landmarks that exist, one that stands in the view\'s era; the boat starts on the named side', () => {
  assert.ok(data.views.length >= 3 && data.views.length <= 8);
  const toGame = (lon, lat) => [lon * 70000, -lat * 111320]; // a stand-in projection: +x east, +z south
  for (const v of data.views) {
    assert.ok(inRegion(region, v.focus.lat, v.focus.lon), `${v.id}: focus outside`);
    assert.ok(ERA_IDS.includes(v.era));
    assert.ok(v.landmarks.length >= 1);
    for (const id of v.landmarks) assert.ok(placementById(data, id), `${v.id}: ${id} is not a placement`);
    assert.ok(v.landmarks.some((id) => placementById(data, id).era.includes(v.era)), `${v.id}: no landmark of this view stands in ${v.era}`);
    const b = boatWanted(v, toGame);
    const side = bearingOf(b.x - b.focus.x, b.z - b.focus.z);
    assert.ok(Math.abs(((side - v.from + 540) % 360) - 180) < 1e-6, `${v.id}: the boat is not at bearing ${v.from} from the focus (got ${side})`);
    assert.ok(Math.abs(Math.hypot(b.x - b.focus.x, b.z - b.focus.z) - v.distM) < 1e-6, `${v.id}: distance`);
    assert.ok(Math.abs(Math.cos(b.heading) - (b.focus.z - b.z) / v.distM) < 1e-9, `${v.id}: heading faces the focus`);
  }
});

check('the read scale is data and matches the game: cairn 1.8, pole mark 2.0 (world-year-build.js), everything else 1.0', () => {
  assert.equal(readScaleOf('cairn'), 1.8); assert.equal(readScaleOf('polemark'), 2.0);
  for (const t of ['fyrkur', 'sjobod', 'church', 'windmill', 'darkhouse']) assert.equal(readScaleOf(t), 1.0, t);
  const wyb = readFileSync(new URL('./world-year-build.js', import.meta.url), 'utf8');
  assert.ok(/m\.kind === 'cairn' \? 1\.8 : 2\.0/.test(wyb), 'the game still scales a cairn x1.8 and a rock mark x2.0: update readScale if it changed');
});

check('placementsFor(era) lists exactly the placements that stand in that era', () => {
  for (const e of ERA_IDS) assert.deepEqual(placementsFor(data, e).map((p) => p.id), data.placements.filter((p) => p.era.includes(e)).map((p) => p.id));
  assert.ok(placementsFor(data, '1950').length > placementsFor(data, '1703').length, '1950 has more landmarks than 1703');
});

console.log(`\n${passed} checks passed`);
