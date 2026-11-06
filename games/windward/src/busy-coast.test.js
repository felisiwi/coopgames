// node games/windward/src/busy-coast.test.js — the busy coast: era profiles, kits, motion, giving way, and (on the REAL coast, built the way the game
// builds its collision) that every route point and berth is in water the boat could really be in.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Mesher } from './era-assets.js';
import { getKit, registerKit, kitIds } from './busy-kits.js';
import { profileForYear, validateProfile, vesselFor, berthBoat, berthsToFill, routesFor, boatsFor, frac } from './busy-era.js';
import { makeRoute, routePoint, routeHeading, stopHeading, makeSchedule, makeLoopSchedule, schedulePose, vesselPose, mustYield, stepYield, normAngle, TURN_DIST_M, CATCH_UP } from './busy-route.js';
import { createBusyCoast, RENDER_RADIUS_M } from './busy-coast.js';
import { mulberry32, ambientPath, ambientPathAdaptive, ambientAt, ambientDone, AMBIENT_DEFAULTS } from './busy-ambient.js';
import { placeCoastVillages } from './coast-world.js';
import { loadGameWorld } from '../../../tools/lib/game-world.mjs';
import { makeGrid, clearAt, footprintFree, distToPolyline } from '../../../tools/lib/busy-planner.mjs';

let passed = 0;
async function check(name, fn) { await fn(); passed += 1; console.log(`ok - ${name}`); }
const read = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));
const eras = read('../data/busy-eras.json');
const world = read('../data/busy-world.json');
const osm = read('../../../tools/data/ferry-847-osm.json');
const gw = await loadGameWorld();
const toG = (ll) => gw.toGame(ll[0], ll[1]);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const polyLen = (pts) => pts.reduce((n, p, i) => (i ? n + dist(p, pts[i - 1]) : 0), 0);

// ---------------------------------------------------------------------------------------------------- motion (pure)
await check('a route is arc-length parametrised and its heading follows the way the bow points (sin, cos)', () => {
  const r = makeRoute([[0, 0], [0, 100], [100, 100]]); // south, then east
  assert.equal(r.length, 200);
  assert.deepEqual(routePoint(r, 50), [0, 50]);
  assert.deepEqual(routePoint(r, 150), [50, 100]);
  assert.deepEqual(routePoint(r, -5), [0, 0]); assert.deepEqual(routePoint(r, 999), [100, 100]); // clamped
  assert.ok(Math.abs(routeHeading(r, 20) - 0) < 1e-9, 'south = heading 0');
  assert.ok(Math.abs(routeHeading(r, 180) - Math.PI / 2) < 1e-9, 'east = heading pi/2');
  assert.ok(Math.abs(Math.abs(routeHeading(r, 20, -1)) - Math.PI) < 1e-9, 'travelling backwards flips the bow');
});

await check('a timetable is periodic, continuous, and visits every stop in order (A-M-B-M-A)', () => {
  const r = makeRoute([[0, 0], [0, 300], [0, 340]]);
  const sched = makeSchedule({ stopsAtM: [0, 300, 340], speed: 5, dwellS: [20, 12, 20] });
  assert.equal(Math.round(sched.cycleS), Math.round(20 + 60 + 12 + 8 + 20 + 8 + 12 + 60)); // dwell A, A-M, dwell M, M-B, dwell B, B-M, dwell M, M-A
  const visited = [];
  let prev = null, maxJump = 0;
  for (let t = 0; t < sched.cycleS * 2; t += 0.25) {
    const p = schedulePose(r, sched, t);
    if (!p.moving && (visited.length === 0 || visited.at(-1) !== p.stop)) visited.push(p.stop);
    if (prev) maxJump = Math.max(maxJump, Math.abs(p.s - prev.s));
    prev = p;
  }
  assert.deepEqual(visited.slice(0, 6), [0, 1, 2, 1, 0, 1]);
  assert.ok(maxJump <= 5 * 0.25 + 1e-6, `position jumps ${maxJump} m between samples`);
  const a = schedulePose(r, sched, 7), b = schedulePose(r, sched, 7 + sched.cycleS * 3);
  assert.deepEqual([a.s, a.stop], [b.s, b.stop], 'periodic');
});

await check('leaving a quay the heading swings from "bow to the quay" to the travel direction over TURN_DIST_M, with no snap', () => {
  const r = makeRoute([[0, 0], [0, 200]]);
  const sched = makeSchedule({ stopsAtM: [0, 200], speed: 5, dwellS: [10, 10] });
  const arriveB = schedulePose(r, sched, sched.segs[1].t0 + sched.segs[1].dur - 0.01).heading; // heading 0: south, bow at B
  const dwellB = schedulePose(r, sched, sched.segs[2].t0 + 1).heading;
  assert.ok(Math.abs(normAngle(arriveB - dwellB)) < 1e-6, 'docked with the heading it arrived with');
  const leave = []; // the first TURN_DIST_M of the way back (travel heading = north = pi)
  for (let t = sched.segs[3].t0; t < sched.segs[3].t0 + (TURN_DIST_M / 5) + 1; t += 0.2) leave.push(schedulePose(r, sched, t).heading);
  let maxStep = 0;
  for (let i = 1; i < leave.length; i++) maxStep = Math.max(maxStep, Math.abs(normAngle(leave[i] - leave[i - 1])));
  assert.ok(maxStep < 0.2, `heading snaps by ${maxStep} rad in 0.2 s`);
  assert.ok(Math.abs(Math.abs(normAngle(leave.at(-1))) - Math.PI) < 0.05, 'ends up pointing the way it travels');
});

await check('giving way: a boat holds still while a player is in its way, then catches up to its timetable', () => {
  const r = makeRoute([[0, 0], [0, 400]]);
  const sched = makeSchedule({ stopsAtM: [0, 400], speed: 5, dwellS: 5 });
  const v = { lag: 0 };
  const player = { x: 0, z: 150 }; // sitting on the route
  let t = 20, minD = Infinity, stoppedAt = null;
  for (let i = 0; i < 600; i++, t += 0.1) { // 60 s
    const pose = vesselPose(r, sched, t - v.lag);
    stepYield(v, 0.1, mustYield(pose, 4.5, [player]), sched.cycleS);
    const after = vesselPose(r, sched, t + 0.1 - v.lag);
    minD = Math.min(minD, Math.hypot(after.x - player.x, after.z - player.z));
    if (stoppedAt === null && v.lag > 0) stoppedAt = pose.s;
  }
  assert.ok(stoppedAt !== null && stoppedAt < 150, 'it stopped before reaching the player');
  assert.ok(minD > 4.5 + 14 - 1, `closed to ${minD.toFixed(1)} m: inside its own body circle`);
  const held = v.lag;
  assert.ok(held > 20, 'it waited');
  for (let i = 0; i < 40; i++, t += 0.1) { const pose = vesselPose(r, sched, t - v.lag); stepYield(v, 0.1, mustYield(pose, 4.5, [{ x: 500, z: 500 }]), sched.cycleS); }
  assert.ok(Math.abs(v.lag - (held - CATCH_UP * 4)) < 1e-6, 'with the way clear, lag shrinks at CATCH_UP per second');
});

await check('giving way: a player driving straight at a moving boat at 10 m/s never gets it to move closer once the threat starts', () => {
  const r = makeRoute([[0, 0], [0, 600]]);
  const sched = makeSchedule({ stopsAtM: [0, 600], speed: 4, dwellS: 5 });
  for (const halfLen of [3, 4.7, 12]) {
    const v = { lag: 0 };
    let t = 30, px = 0, pz = 500, gap = null;
    for (let i = 0; i < 400; i++, t += 0.1, pz -= 1) { // the player comes down the route toward the boat at 10 m/s
      const pose = vesselPose(r, sched, t - v.lag), yielding = mustYield(pose, halfLen, [{ x: px, z: pz }]);
      stepYield(v, 0.1, yielding, sched.cycleS);
      const after = vesselPose(r, sched, t + 0.1 - v.lag);
      if (yielding) { assert.ok(Math.abs(after.s - pose.s) < 1e-6, `half-length ${halfLen}: it kept moving while it should give way`); if (gap === null) gap = Math.hypot(pose.x - px, pose.z - pz); }
    }
    assert.ok(gap !== null && gap > halfLen + 14, `half-length ${halfLen}: it only reacted at ${gap} m`);
  }
});

// ---------------------------------------------------------------------------------------------------- eras and kits
await check('profileForYear: the three eras tile 1950-2026 with no gap, and nothing before 1950', () => {
  const ids = (y) => profileForYear(eras, y)?.id ?? null;
  assert.equal(ids(1949), null);
  assert.equal(ids(1950), 'summer-guests-1950'); assert.equal(ids(1979), 'summer-guests-1950');
  assert.equal(ids(1980), 'leisure-sailing-1980'); assert.equal(ids(1999), 'leisure-sailing-1980');
  assert.equal(ids(2000), 'today'); assert.equal(ids(2026), 'today'); assert.equal(ids(2027), null);
  for (let y = 1950; y <= 2026; y++) assert.ok(ids(y), `no profile for ${y}`);
  assert.equal(eras.profiles.find((p) => p.id === 'today').placeholderKit, false);
  // an era profile borrowing the modern 'today' kit must say so; one with its own kit (1950) must not claim to be a placeholder
  assert.ok(eras.profiles.filter((p) => p.id !== 'today').every((p) => p.placeholderKit === (p.kit === 'today')), 'placeholderKit must be true exactly when an era profile uses the borrowed today kit');
  assert.equal(eras.profiles.find((p) => p.id === 'summer-guests-1950').kit, '1950', 'the 1950 profile uses the 1950 kit');
});

await check('every profile is complete, names only assets its kit has, and fits the world data', () => {
  for (const p of eras.profiles) assert.deepEqual(validateProfile(p, getKit(p.kit), world), []);
  // and a broken one is caught
  const broken = structuredClone(eras.profiles[0]);
  broken.traffic.classes.sail.assets[0].id = 'junk'; broken.ferry.dwellS = [1]; broken.houses.share = 0.9; broken.traffic.maxBoats = 99; broken.ferry.lengthM = 24;
  const bad = validateProfile(broken, getKit('today'), world);
  assert.ok(bad.length >= 5, bad.join('\n'));
});


await check('the era changes what you see: more boats (more of them out at sea), fuller harbours, more summer houses as the years go on', () => {
  const [a, b, c] = ['summer-guests-1950', 'leisure-sailing-1980', 'today'].map((id) => eras.profiles.find((p) => p.id === id));
  const moored = (p) => world.moorings.reduce((n, m) => n + berthsToFill(p, m.berths.length), 0);
  const [na, nb, nc] = [a, b, c].map((p) => boatsFor(p, world));
  assert.ok(na.length < nb.length && nb.length < nc.length, `${na.length} ${nb.length} ${nc.length}`);
  assert.ok(nc.length >= 30 && nc.length <= 40, `Today runs ${nc.length} moving boats`);
  const sailing = (list) => list.filter((x) => x.route.class === 'sail').length;
  assert.ok(sailing(nc) >= 15 && sailing(nc) <= 25, `${sailing(nc)} sailboats in Today`);
  assert.ok(sailing(na) < sailing(nb) && sailing(nb) < sailing(nc));
  assert.ok(moored(a) < moored(b) && moored(b) < moored(c), `${moored(a)} ${moored(b)} ${moored(c)}`);
  assert.ok(a.houses.share < b.houses.share && b.houses.share < c.houses.share);
  assert.ok(a.ferry.speed < c.ferry.speed, 'a slower ferry in 1950 (placeholder numbers)');
  assert.ok(nc.length <= c.traffic.maxBoats && c.traffic.maxBoats <= 40, 'the boat budget');
  // the boats are round-robin over the routes, so the cap thins every route evenly: boat 0 of every route comes before any boat 1
  assert.ok(nc.slice(0, routesFor(c, world).length).every((x) => x.k === 0));
  // out at sea most of the time: cruising and fishing boats never stop; harbour boats wait only a few seconds at a quay
  for (const p of [a, b, c]) for (const cls of ['sail', 'motor']) assert.ok(p.traffic.classes[cls].dwellS[1] <= 8, `${p.id} ${cls} waits up to ${p.traffic.classes[cls].dwellS[1]} s in harbour`);
  assert.ok(world.traffic.some((r) => r.kind === 'cruise') && world.traffic.some((r) => r.kind === 'fish'), 'offshore routes exist');
});

await check('loops: a closed route wraps, a loop boat never stops, and boats of one route are spread evenly round its cycle', () => {
  const r = makeRoute([[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]], { loop: true });
  assert.equal(r.length, 400);
  assert.deepEqual(routePoint(r, 450), [50, 0]); assert.deepEqual(routePoint(r, -50), [0, 50]); // wraps both ways
  const ring = Array.from({ length: 33 }, (_, i) => [Math.sin((i / 32) * Math.PI * 2) * 50, Math.cos((i / 32) * Math.PI * 2) * 50]), circle = makeRoute(ring, { loop: true });
  assert.ok(Math.abs(normAngle(routeHeading(circle, 0.5) - routeHeading(circle, circle.length - 0.5))) < 0.3, 'on a smooth loop the heading is continuous across the seam');
  const sched = makeLoopSchedule({ lengthM: r.length, speed: 4 });
  assert.equal(sched.cycleS, 100);
  for (let t = 0; t < 250; t += 7) { const p = schedulePose(r, sched, t); assert.equal(p.moving, true); assert.ok(p.s >= 0 && p.s < 400); }
  assert.deepEqual([schedulePose(r, sched, 3).s, schedulePose(r, sched, 103).s].map((v) => Math.round(v * 1e6)), [12e6, 12e6], 'periodic');
  const c = eras.profiles.find((p) => p.id === 'today'), two = boatsFor(c, world).filter((x) => x.route.id === 'cruise-gaven');
  assert.equal(two.length, 2); assert.deepEqual(two.map((x) => x.k), [0, 1]); assert.notEqual(two[0].seed, two[1].seed);
});

await check('vessels and berth boats are deterministic from their seed, within the profile ranges, and never longer than their berth', () => {
  const c = eras.profiles.find((p) => p.id === 'today');
  for (const r of world.traffic) {
    const v = vesselFor(c.traffic.classes[r.class], r.seed), w = vesselFor(c.traffic.classes[r.class], r.seed), blk = c.traffic.classes[r.class];
    assert.deepEqual(v, w);
    assert.ok(v.speed >= blk.speed[0] && v.speed <= blk.speed[1] && v.dwellS >= blk.dwellS[0] && v.dwellS <= blk.dwellS[1], r.id);
    assert.ok(v.L >= blk.assets[0].length[0] && v.L <= blk.assets[0].length[1], r.id);
  }
  for (const m of world.moorings) for (const b of m.berths) { const x = berthBoat(c.moorings.classes[b.class], b); assert.ok(x.L <= b.fitL + 1e-9 && x.L >= 4, `${m.id}`); }
  assert.ok(frac(0.25, 1) !== frac(0.26, 1));
});

await check('the engine is era-driven: a second, made-up kit registers and the same engine builds from it (no asset id is hard-wired)', () => {
  assert.ok(!/sailboat|motorboat|summerhouse|addSailboat|addFerry|addSummerHouse/.test(readFileSync(fileURLToPath(new URL('./busy-coast.js', import.meta.url)), 'utf8')), 'busy-coast.js must not name a kit asset');
  const box = (L, h) => (S, G) => { S.box(0, h / 2, 0, L * 0.3, h, L, 0x8a6a4a); G.on.quad([-0.3, 0.5, 0.1], [0.3, 0.5, 0.1], [0.3, 1, 0.1], [-0.3, 1, 0.1], null); };
  registerKit({
    id: 'test-1950', glass: { day: 0x667788, lit: 0xffcc66, off: 0x223344 },
    assets: {
      skiff: { kind: 'vessel', stripes: ['plain'], halfLen: (o) => (o.L ?? 5) / 2, build: (S, G, o) => box(o.L ?? 5, 0.8)(S, G) },
      packet: { kind: 'ferry', nativeLength: 18, halfLen: (o) => 9 * (o.scale ?? 1), build: (S, G) => box(18, 2)(S, G) },
      hut: { kind: 'house', colours: ['tar', 'ochre'], build: (S, G, o) => box(4, 2.4)(S, G) },
    },
  });
  assert.ok(kitIds().includes('test-1950') && kitIds().includes('today'));
  const prof = {
    id: 'test', from: 1900, to: 1949, kit: 'test-1950', placeholderKit: false,
    traffic: { routes: 'all', perRoute: 1, maxBoats: 3, classes: { sail: { assets: [{ id: 'skiff', stripes: ['plain'], length: [4, 5] }], speed: [2, 3], dwellS: [5, 8] }, motor: { assets: [{ id: 'skiff', stripes: ['plain'], length: [4, 5] }], speed: [2, 3], dwellS: [5, 8] }, fish: { assets: [{ id: 'skiff', stripes: ['plain'], length: [4, 5] }], speed: [1, 2], dwellS: [0, 0] } } },
    ferry: { enabled: true, asset: 'packet', lengthM: 10, speed: 3, dwellS: [10, 10] },
    moorings: { fill: 0.2, maxPerHarbour: 2, classes: { sail: { assets: [{ id: 'skiff', stripes: ['plain'], length: [4, 5] }] }, motor: { assets: [{ id: 'skiff', stripes: ['plain'], length: [4, 5] }] } } },
    houses: { share: 0.2, asset: 'hut', colours: ['tar', 'ochre'], scale: 1 },
  };
  assert.deepEqual(validateProfile(prof, getKit('test-1950'), world), []);
  const b = createBusyCoast({ world, profile: prof, toGame: gw.toGame, seaY: () => 0, houses: [{ x: 3300, z: 7400, y: 1, facing: 0 }, { x: 3310, z: 7410, y: 1, facing: 1 }] });
  b.update(0.016, { x: 3335, z: 7462 }, []);
  const s = b.stats();
  assert.equal(s.kit, 'test-1950'); assert.equal(s.vessels, 4); assert.equal(s.houses, 2); assert.ok(s.moored >= 2 && s.moored <= 18);
  assert.equal(s.meshes <= 4, true);
});

// ---------------------------------------------------------------------------------------------------- the engine on real data
const today = eras.profiles.find((p) => p.id === 'today');
const home = gw.toGame(11.4229, 58.27617); // Lysekil's Norra hamnen
const houses = placeCoastVillages(gw.world, gw.settlements, { summerShare: today.houses.share }).summerHouses;
const clockAt = (t) => () => t;

await check('placeCoastVillages: summerShare 0 changes nothing; a share moves cottages (and only cottages) into summerHouses, the same ones every time', () => {
  const none = placeCoastVillages(gw.world, gw.settlements);
  const some = placeCoastVillages(gw.world, gw.settlements, { summerShare: 0.3 }), again = placeCoastVillages(gw.world, gw.settlements, { summerShare: 0.3 });
  assert.deepEqual(none.summerHouses, []);
  assert.equal(some.buildings.length + some.summerHouses.length, none.buildings.length);
  assert.deepEqual(some.summerHouses, again.summerHouses);
  const share = some.summerHouses.length / none.buildings.filter((b) => b.kind === 'cottage').length;
  assert.ok(share > 0.2 && share < 0.4, `share ${share}`);
  assert.ok(some.buildings.some((b) => b.kind === 'boathouse'), 'boathouses stay');
});

await check('engine: four meshes however many boats, a triangle budget, and the windows light up at night without touching the geometry', () => {
  const b = createBusyCoast({ world, profile: today, toGame: gw.toGame, seaY: () => 0, houses, clock: clockAt(1000) });
  b.update(0.016, { x: home[0], z: home[1] }, []);
  const s = b.stats();
  assert.equal(s.meshes, 4, 'static solid + windows, moving solid + windows');
  assert.ok(s.staticTriangles <= 22000, `static ${s.staticTriangles}`);
  assert.ok(s.dynamicTriangles <= 9000 && s.boatsVisible >= 1, `dynamic ${s.dynamicTriangles}, ${s.boatsVisible} boats near Lysekil`);
  assert.equal(s.houses, houses.length); assert.equal(s.vessels, boatsFor(today, world).length + 1, 'the era\'s boats + the ferry');
  assert.equal(s.moored, world.moorings.reduce((n, m) => n + berthsToFill(today, m.berths.length), 0));
  const glass = b.group.children.find((m) => m.name === 'busy-static-windows'), solid = b.group.children.find((m) => m.name === 'busy-static');
  const day = [...glass.geometry.attributes.color.array], pos = [...solid.geometry.attributes.position.array];
  b.setNight(true);
  const night = [...glass.geometry.attributes.color.array];
  assert.notDeepEqual(night, day, 'night colours differ');
  assert.deepEqual([...solid.geometry.attributes.position.array], pos, 'the solid geometry is untouched');
  assert.ok(night.some((v, i) => v !== day[i] && (i % 3 === 0) && v > 0.7), 'some windows glow warm');
  b.setNight(false);
  assert.deepEqual([...glass.geometry.attributes.color.array], day, 'and back to day');
  const none = createBusyCoast({ world, profile: { ...today, ferry: { ...today.ferry, enabled: false }, traffic: { ...today.traffic, maxBoats: 0 } }, toGame: gw.toGame, seaY: () => 0, houses: [], clock: clockAt(0) });
  assert.equal(none.stats().vessels, 0, 'an era with no traffic and no ferry has no moving boats');
});

await check('engine: only boats within RENDER_RADIUS_M of the viewer are written', () => {
  const b = createBusyCoast({ world, profile: today, toGame: gw.toGame, seaY: () => 0, houses: [], clock: clockAt(5000) });
  b.update(0.016, { x: -9999, z: -9999 }, []);
  assert.equal(b.stats().boatsVisible, 0); assert.equal(b.stats().dynamicTriangles, 0);
  b.update(0.016, { x: home[0], z: home[1] }, []);
  for (const v of b.vessels) assert.equal(v.visible, Math.hypot(v.pose.x - home[0], v.pose.z - home[1]) <= RENDER_RADIUS_M);
});


await check('the ferry is play-scaled (about 1.75 x Svalan\'s 8 m) and docks at its two quays, bow to the quay, swinging away as it leaves', () => {
  const b = createBusyCoast({ world, profile: today, toGame: gw.toGame, seaY: () => 0, houses: [], clock: clockAt(0) });
  const ferry = b.vessels.find((v) => v.kind === 'ferry');
  assert.deepEqual(world.ferry.stops.map((st) => st.name), ['Lysekil Södra hamnen', 'Fiskebäckskil brygga']);
  assert.deepEqual(world.ferry.stops.map((st) => st.osm), [osm.relation.stopOrder[0], osm.relation.stopOrder.at(-1)], 'the first and last stop of the OSM relation');
  assert.deepEqual(world.ferry.skippedStops.map((st) => st.name), ['Östersidans färjeläge'], 'the skipped call is on record, with a reason');
  assert.ok(world.ferry.skippedStops[0].why.length > 20);
  // size: 1.5-2 x the player's 8 m boat; the model's own length is 24 m, so the engine scaled it down
  assert.ok(today.ferry.lengthM >= 12 && today.ferry.lengthM <= 16, `ferry length ${today.ferry.lengthM}`);
  assert.ok(today.ferry.lengthM <= world.ferry.maxLengthM, 'within what the docks were planned for');
  assert.ok(Math.abs(ferry.halfLen * 2 - today.ferry.lengthM) < 0.01, `give-way half length ${ferry.halfLen}`);
  const xs = []; for (let i = 0; i < ferry.tmpl.solidPos.length; i += 3) xs.push(ferry.tmpl.solidPos[i + 2]);
  assert.ok(Math.max(...xs) - Math.min(...xs) < today.ferry.lengthM + 1.5, 'the stamped model is the scaled length, not 24 m');
  assert.ok(Math.max(...xs) - Math.min(...xs) > today.ferry.lengthM - 3, 'and not tiny');
  // no other boat is "large": the biggest sailboat / motor boat any profile asks for stays within 1.25 x Svalan
  for (const p of eras.profiles) for (const blk of [...Object.values(p.traffic.classes), ...Object.values(p.moorings.classes)]) for (const a of blk.assets) assert.ok(a.length[1] <= 10, `${p.id}: a boat of ${a.length[1]} m`);
  // docking: dwell at each stop sits within 1 m of the planned dock, heading bow-to-quay
  const seen = new Set();
  for (let t = 0; t < ferry.sched.cycleS; t += 0.5) {
    const p = vesselPose(ferry.route, ferry.sched, t);
    if (p.moving) continue;
    seen.add(p.stop);
    assert.ok(dist([p.x, p.z], toG(world.ferry.stops[p.stop].dock)) < 1, `stop ${p.stop}`);
  }
  assert.deepEqual([...seen].sort(), [0, 1]);
  const cross = ferry.sched.segs.filter((sg) => sg.type === 'move');
  assert.ok(cross[0].dur > 30 && cross[0].dur < 90, `the crossing takes ${cross[0].dur} s`);
  // leaving a quay it swings from "bow to the quay" to "bow the way it goes" with no snap
  const leave = ferry.sched.segs.findIndex((sg) => sg.type === 'move');
  let prevH = null, maxStep = 0;
  for (let t = ferry.sched.segs[leave].t0; t < ferry.sched.segs[leave].t0 + 25; t += 0.25) { const h = schedulePose(ferry.route, ferry.sched, t).heading; if (prevH !== null) maxStep = Math.max(maxStep, Math.abs(normAngle(h - prevH))); prevH = h; }
  assert.ok(maxStep < 0.3, `the ferry heading snaps by ${maxStep.toFixed(2)} rad in a quarter of a second`);
});

// ---------------------------------------------------------------------------------------------------- the data against the real coast
const grid = makeGrid(gw.world, gw.blocked);
const samples = (pts, step = 2) => { const out = []; for (let i = 0; i < pts.length - 1; i++) { const n = Math.max(1, Math.ceil(dist(pts[i], pts[i + 1]) / step)); for (let k = 0; k <= n; k++) out.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k / n, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k / n, i, k === 0 || k === n]); } return out; };


await check('REAL COAST: every route (harbour, cruising loop, fishing circle) stays in water the boat can really be in, end to end', () => {
  const kinds = (k) => world.traffic.filter((r) => r.kind === k);
  assert.equal(kinds('harbour').length, 8); assert.ok(kinds('cruise').length >= 6, 'cruising loops'); assert.ok(kinds('fish').length >= 3, 'fishing circles');
  for (const r of world.traffic) {
    const pts = r.route.map(toG);
    assert.equal(r.shape === 'loop', r.kind !== 'harbour', r.id);
    assert.ok(pts.length >= 2 && polyLen(pts) > (r.shape === 'loop' ? 100 : 150), r.id);
    assert.ok(Math.abs(polyLen(pts) - r.lengthM) < 3, `${r.id}: stored length ${r.lengthM} vs ${polyLen(pts).toFixed(1)}`);
    for (const [x, z] of samples(pts)) assert.equal(gw.blocked(x, z), false, `${r.id} is blocked at ${x.toFixed(1)}, ${z.toFixed(1)}`);
    if (r.shape === 'loop') assert.ok(dist(pts[0], pts.at(-1)) < 0.5, `${r.id} must close on itself`);
    else for (const [end, name] of [[pts[0], r.from], [pts.at(-1), r.to]]) { const h = gw.seamarks.harbours.find((x) => x.name === name); assert.ok(dist(end, gw.toGame(h.lon, h.lat)) < 70, `${r.id} end at ${name}`); }
    assert.ok(['sail', 'motor', 'fish'].includes(r.class), r.id);
  }
  // a loop is something to see: it does not hug one harbour (its centre is at least 40 m from every route end)
});


// ---- the ferry's hull on the real coast: footprint (length x beam + a gap ahead of the bow) must be free water, i.e. a place the boat's centre may be
const hullFree = (p, h, len, bowGap = 0) => footprintFree(grid, p, [Math.sin(h), Math.cos(h)], len / 2, (len * 4.5 / 16) / 2, bowGap);
const gateLanes = gw.seamarks.harbours.filter((h) => h.inventedGate?.mouth).map((h) => {
  const p = gw.toGame(h.inventedGate.mouth.lon, h.inventedGate.mouth.lat), b = (h.inventedGate.enteringBearingDeg * Math.PI) / 180, e = [Math.sin(b), -Math.cos(b)];
  return { name: h.name, p, lane: [[p[0] + e[0] * 12, p[1] + e[1] * 12], [p[0] - e[0] * 45, p[1] - e[1] * 45]] };
});
const wayIns = world.moorings.map((m) => ({ id: m.id, pts: m.wayIn.map(toG) }));
const trimStart = (pts, m) => { let acc = 0; const o = []; for (let i = 0; i < pts.length; i++) { if (i) acc += dist(pts[i], pts[i - 1]); if (acc >= m) o.push(pts[i]); } return o; };

await check('REAL COAST: the ferry route keeps its whole hull in clear water except near the two quays, and follows the real 847 crossing', () => {
  const pts = world.ferry.route.map(toG), len = polyLen(pts), L = today.ferry.lengthM;
  assert.ok(Math.abs(len - world.ferry.lengthM) < 3);
  let s = 0, worst = 0;
  const docks = world.ferry.stops.map((st) => toG(st.dock));
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = dist(pts[i], pts[i + 1]), n = Math.max(1, Math.ceil(seg / 3));
    for (let k = 0; k <= n; k++) {
      const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k / n, z = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k / n;
      assert.equal(gw.blocked(x, z), false, `the ferry's centre is blocked at ${(s + seg * k / n).toFixed(0)} m`);
      if (docks.some((d) => dist([x, z], d) < 35)) continue; // near a quay the hull is allowed to be close to the shore
      const h = Math.atan2(pts[Math.min(i + 1, pts.length - 1)][0] - pts[i][0], pts[Math.min(i + 1, pts.length - 1)][1] - pts[i][1]);
      if (!hullFree([x, z], h, L)) worst++;
    }
    s += seg;
  }
  assert.equal(worst, 0, `${worst} places mid-crossing where the ${L} m hull touches shallow water or land`);
  // it follows the real crossing: the OSM way's first three points (the Lysekil quay, just off it, mid-fjord) are within 40 game m of our route (the 4th
  // is the way into Östersidan, a stop the game skips)
  for (const p of osm.ways[0].points.slice(0, 3).map(toG)) assert.ok(Math.min(...samples(pts).map((q) => dist(p, q))) < 40, 'the planned route strays from the real 847 line');
  for (const st of world.ferry.stops) assert.ok(dist(toG(st.dock), gw.toGame(st.lon, st.lat)) < 40, `${st.name}: dock is ${dist(toG(st.dock), gw.toGame(st.lon, st.lat)).toFixed(1)} m from the OSM stop`);
});

await check('REAL COAST: docked, the ferry sits slightly OFF its quay in clear water: whole hull free, bow gap ahead, never across a harbour\'s way in or gate', () => {
  const ferry = createBusyCoast({ world, profile: today, toGame: gw.toGame, seaY: () => 0, houses: [], clock: clockAt(0) }).vessels.find((v) => v.kind === 'ferry');
  const L = today.ferry.lengthM;
  world.ferry.stops.forEach((st, i) => {
    const sp = ferry.sched.stopsAtM[i], pose = vesselPose(ferry.route, ferry.sched, ferry.sched.segs.find((sg) => sg.type === 'dwell' && sg.stop === i).t0 + 1);
    const dir = [Math.sin(pose.heading), Math.cos(pose.heading)], c = [pose.x, pose.z];
    assert.ok(footprintFree(grid, c, dir, L / 2, (L * 4.5 / 16) / 2, 3, 1.5, (x, z) => !gw.dockBlocked(x, z)), `${st.name}: the docked hull (+3 m gap, 1 m margin) is not all in clear water`);
    // bow to the quay: walking on from the bow along the heading reaches the shallows within 10 m (it is at the quay, not floating in the fjord) but not before 3 m (not wedged)
    let reach = null;
    for (let d = L / 2; d <= L / 2 + 40; d += 0.25) if (gw.sailHeightAt(c[0] + dir[0] * d, c[1] + dir[1] * d) > -0.9) { reach = d - L / 2; break; } // the shallows themselves (shore.js BLOCK_H), not the player's wider margin
    assert.ok(reach !== null && reach >= 3 && reach <= 10, `${st.name}: the bow is ${reach} m from the shallows ahead`);
    assert.ok(dist(c, gw.toGame(st.lon, st.lat)) < 30, `${st.name}: ${dist(c, gw.toGame(st.lon, st.lat)).toFixed(0)} m from the real stop`);
    // clear of every harbour's way in (its first 10 m, at its own quay, excluded) and of the story harbour's gate lane: 5 m between the hull axis and the lane
    const axis = [-L / 2, 0, L / 2, L / 2 + 3].map((l) => [c[0] + dir[0] * l, c[1] + dir[1] * l]);
    for (const w of wayIns) { const lane = trimStart(w.pts, 10); if (lane.length >= 2) for (const a of axis) assert.ok(distToPolyline(lane, a[0], a[1]) >= 5, `${st.name}: the docked ferry is ${distToPolyline(lane, a[0], a[1]).toFixed(1)} m from the way into ${w.id}`); }
    for (const g of gateLanes) { for (const a of axis) assert.ok(distToPolyline(g.lane, a[0], a[1]) >= 5, `${st.name}: the docked ferry is across the lane at ${g.name}'s gate`); assert.ok(dist(c, g.p) >= L / 2 + 5, `${st.name}: too near the gate of ${g.name}`); }
    void sp;
  });
});

await check('REAL COAST: every berth is in free water with both ends of the boat in free water, apart from its neighbours and off the ferry route', () => {
  const ferry = world.ferry.route.map(toG), all = [];
  let n = 0;
  for (const m of world.moorings) {
    assert.ok(m.berths.length >= 2, `${m.id} has only ${m.berths.length} berths`);
    for (const b of m.berths) {
      const p = gw.toGame(b.lon, b.lat);
      assert.equal(gw.blocked(p[0], p[1]), false, `${m.id}: berth blocked`);
      const fx = Math.sin(b.heading) * b.fitL / 2, fz = Math.cos(b.heading) * b.fitL / 2;
      if (b.how === 'alongside') for (const sg of [1, -1]) assert.equal(gw.blocked(p[0] + sg * fx, p[1] + sg * fz), false, `${m.id}: a boat's end is on land`);
      assert.ok(['alongside', 'buoy'].includes(b.how) && ['sail', 'motor'].includes(b.class), m.id);
      assert.ok(Math.min(...samples(ferry, 4).map((q) => dist(p, q))) > 9, `${m.id}: a berth sits on the ferry's way`);
      for (const st of world.ferry.stops) { const d0 = toG(st.dock); assert.ok(dist(p, d0) > 9, `${m.id}: a berth is ${dist(p, d0).toFixed(1)} m from a ferry dock`); }
      for (const o of all) assert.ok(dist(p, o) >= 5, `${m.id}: two berths ${dist(p, o).toFixed(1)} m apart`);
      all.push(p); n++;
    }
  }
  assert.equal(n, world.moorings.reduce((k, m) => k + m.berths.length, 0));
  const villages = new Set(world.moorings.map((m) => m.village));
  for (const v of ['Fiskebäckskil', 'Grundsund', 'Käringön', 'Gullholmen', 'Lysekil']) assert.ok(villages.has(v), `no harbour for ${v}`);
});

await check('REAL COAST: berths leave the way in open: no berth within 7 m of any traffic route except at that route\'s own quay', () => {
  const rt = world.traffic.map((r) => ({ r, pts: r.route.map(toG) }));
  let worst = Infinity;
  for (const m of world.moorings) for (const b of m.berths) {
    const p = gw.toGame(b.lon, b.lat);
    for (const { r, pts } of rt) {
      const ends = r.shape === 'loop' ? [] : [pts[0], pts.at(-1)];
      if (ends.some((e) => dist(p, e) < 25)) continue; // at that route's own quay
      worst = Math.min(worst, Math.min(...samples(pts, 4).map((q) => dist(p, q))));
    }
  }
  assert.ok(worst >= 7, `a berth is ${worst.toFixed(1)} m from a through route`);
});

// ---- is the sea busy where you sail? Open-water points across the coast, sampled over half an hour of the timetable.
const coverage = (profile) => {
  const boats = boatsFor(profile, world).map((b) => {
    const v = vesselFor(profile.traffic.classes[b.route.class], b.seed), loop = b.route.shape === 'loop';
    const route = makeRoute(b.route.route.map(toG), { loop });
    const sched = loop ? makeLoopSchedule({ lengthM: route.length, speed: v.speed }) : makeSchedule({ stopsAtM: [0, route.length], speed: v.speed, dwellS: v.dwellS });
    return { route, sched, phase: ((b.k + b.route.seed) / b.n) * sched.cycleS, cls: b.route.class };
  });
  const pts = [];
  const inset = 150, x1 = grid.x0 + grid.nx * grid.pxM - inset, z1 = grid.z0 + grid.nz * grid.pxM - inset;
  for (let b = 0; b < grid.nz; b += 30) for (let a = 0; a < grid.nx; a += 30) {
    const k = b * grid.nx + a; if (!grid.free[k] || grid.clear[k] < 12) continue;
    const x = grid.x0 + (a + 0.5) * grid.pxM, z = grid.z0 + (b + 0.5) * grid.pxM;
    if (x >= grid.x0 + inset && x <= x1 && z >= grid.z0 + inset && z <= z1) pts.push([x, z]);
  }
  let n = 0, near = 0, two = 0, sailNear = 0, sum = 0, waiting = 0, total = 0;
  for (let t = 0; t < 1800; t += 90) {
    const poses = boats.map((b) => vesselPose(b.route, b.sched, t + b.phase));
    waiting += poses.filter((q) => !q.moving).length; total += poses.length;
    for (const p of pts) {
      let c = 0, sc = 0;
      poses.forEach((q, i) => { if (dist([q.x, q.z], p) <= 250) { c++; if (boats[i].cls === 'sail' && q.moving) sc++; } });
      n++; sum += c; if (c >= 1) near++; if (c >= 2) two++; if (sc >= 1) sailNear++;
    }
  }
  return { boats: boats.length, points: pts.length, mean: sum / n, atLeast1: near / n, atLeast2: two / n, sail1: sailNear / n, waiting: waiting / total };
};
await check('REAL COAST: the sea is busy where you sail: boats near you, most under sail, almost none waiting in harbour; fuller each era', () => {
  const [a, b, c] = ['summer-guests-1950', 'leisure-sailing-1980', 'today'].map((id) => coverage(eras.profiles.find((p) => p.id === id)));
  assert.ok(c.points > 300, `${c.points} sample points`);
  assert.ok(c.waiting <= 0.1, `${(c.waiting * 100).toFixed(0)}% of Today's boats are waiting at a quay`);
  assert.ok(c.atLeast1 >= 0.85, `a boat within 250 m only ${(c.atLeast1 * 100).toFixed(0)}% of the time`);
  assert.ok(c.atLeast2 >= 0.55, `two boats within 250 m only ${(c.atLeast2 * 100).toFixed(0)}% of the time`);
  assert.ok(c.mean >= 2, `${c.mean.toFixed(2)} boats within 250 m on average`);
  assert.ok(c.sail1 >= 0.55, `a sailboat under way within 250 m only ${(c.sail1 * 100).toFixed(0)}% of the time`);
  assert.ok(a.mean < b.mean && b.mean < c.mean, `${a.mean.toFixed(2)} ${b.mean.toFixed(2)} ${c.mean.toFixed(2)}`);
  assert.ok(a.waiting <= 0.1 && b.waiting <= 0.1);
  console.log(`      Today: ${c.boats} boats, mean ${c.mean.toFixed(2)} within 250 m, >=1 ${(c.atLeast1 * 100).toFixed(0)}%, >=2 ${(c.atLeast2 * 100).toFixed(0)}%, sailing >=1 ${(c.sail1 * 100).toFixed(0)}%, waiting ${(c.waiting * 100).toFixed(1)}%`);
});

// ---- ambient boats: the pool that always sails past you
await check('ambient paths: deterministic, start out of view, pass near the viewer, stay in free water and clear of berths', () => {
  const free = (x, z) => Math.hypot(x - 500, z - 500) > 30; // open sea with one rock of radius 30 at (500, 500)
  const v = { x: 500, z: 560 };
  const a1 = ambientPath(mulberry32(7), v, { freeAt: free }), a2 = ambientPath(mulberry32(7), v, { freeAt: free });
  assert.deepEqual(a1, a2, 'same seed, same leg');
  let near = 0, n = 0;
  const rand = mulberry32(99);
  for (let i = 0; i < 300; i++) {
    const p = ambientPath(rand, v, { freeAt: free, avoid: [[540, 600]] });
    assert.ok(p, 'open water always has a leg');
    n++;
    assert.ok(Math.hypot(p.a[0] - v.x, p.a[1] - v.z) >= AMBIENT_DEFAULTS.ring[0] - 1e-6, 'it starts out of the view');
    assert.ok(p.len >= AMBIENT_DEFAULTS.legM[0] && p.len <= AMBIENT_DEFAULTS.legM[1]);
    for (let l = 0; l <= p.len; l += 2) { const q = ambientAt(p, l); assert.ok(free(q.x, q.z), 'in free water'); assert.ok(Math.hypot(q.x - 540, q.z - 600) >= AMBIENT_DEFAULTS.avoidM - 0.5, 'clear of the avoid point (sampled every 1.5 m: a half-step tolerance)'); }
    let closest = Infinity; for (let l = 0; l <= p.len; l += 1) { const q = ambientAt(p, l); closest = Math.min(closest, Math.hypot(q.x - v.x, q.z - v.z)); }
    if (closest <= AMBIENT_DEFAULTS.lateral[1] + 8) near++;
    assert.ok(Math.abs(Math.hypot(p.d[0], p.d[1]) - 1) < 1e-9);
  }
  assert.ok(near / n > 0.8, `${near}/${n} legs pass within ${AMBIENT_DEFAULTS.lateral[1] + 8} m of the viewer`);
  // blocked everywhere: no leg
  assert.equal(ambientPath(mulberry32(1), v, { freeAt: () => false }), null);
  assert.ok(ambientDone({ a: [0, 0], d: [1, 0], len: 100 }, 100, { x: 0, z: 0 }) && !ambientDone({ a: [0, 0], d: [1, 0], len: 100 }, 50, { x: 50, z: 0 }) && ambientDone({ a: [0, 0], d: [1, 0], len: 1000 }, 500, { x: 0, z: 0 }), 'done at the end, or left behind');
});

await check('REAL COAST: ambient legs from 150 viewer positions across the coast are all in water the boat can really be in', () => {
  const rand = mulberry32(2024), avoid = world.moorings.flatMap((m) => m.berths.map((b) => gw.toGame(b.lon, b.lat)));
  let legs = 0, none = 0;
  for (let i = 0; i < 150; i++) {
    const [a, b] = [Math.floor(rand() * grid.nx), Math.floor(rand() * grid.nz)];
    if (!grid.free[b * grid.nx + a]) { i--; continue; }
    const v = { x: grid.x0 + (a + 0.5) * grid.pxM, z: grid.z0 + (b + 0.5) * grid.pxM };
    const p = ambientPathAdaptive(rand, v, { freeAt: (x, z) => !gw.blocked(x, z), avoid });
    if (!p) { none++; continue; }
    legs++;
    for (let l = 0; l <= p.len; l += 1) { const q = ambientAt(p, l); assert.equal(gw.blocked(q.x, q.z), false, `leg ${i} is blocked at ${l.toFixed(0)} m`); }
  }
  assert.ok(legs >= 140, `only ${legs} of 150 viewer positions found a leg (${none} found none: narrow water)`);
});

// a player at rest in open water, and one under way: how many ambient boats are IN VIEW (60 x 140 m: a phone screen at the widest 3D zoom)?
const inView = (b, v) => b.vessels.filter((x) => x.kind === 'ambient' && x.pose && Math.abs(x.pose.x - v.x) <= 40 && Math.abs(x.pose.z - v.z) <= 75).length;
await check('ambient boats keep the screen busy in open water: boats sail through the view, and they never crowd a player who stays put', () => {
  const today2 = eras.profiles.find((p) => p.id === 'today');
  // 10 open-water starts (clearance >= 20 m) spread over the coast: every 1/10 of the sorted list of such cells
  const cells = [];
  for (let b = 0; b < grid.nz; b += 20) for (let a = 0; a < grid.nx; a += 20) { const k = b * grid.nx + a; const x = grid.x0 + (a + 0.5) * grid.pxM, z = grid.z0 + (b + 0.5) * grid.pxM; if (grid.free[k] && grid.clear[k] >= 20 && x > grid.x0 + 200 && x < grid.x0 + grid.nx * grid.pxM - 200 && z > grid.z0 + 200 && z < grid.z0 + grid.nz * grid.pxM - 200) cells.push({ x, z }); }
  const starts = Array.from({ length: 10 }, (_, i) => cells[Math.floor((i + 0.5) * cells.length / 10)]);
  let t = 5000; const clock = () => t;
  let sumAll = 0, withAll = 0, nAll = 0, worstMin = Infinity;
  for (const [i, start] of starts.entries()) {
    const b = createBusyCoast({ world, profile: today2, toGame: gw.toGame, seaY: () => 0, houses: [], blocked: gw.blocked, clock, seed: 11 + i });
    assert.equal(b.vessels.filter((v) => v.kind === 'ambient').length, today2.traffic.ambient.count);
    const v = { ...start };
    for (let f = 0; f < 1200; f++) { // 40 s at 30 fps, the player sitting still
      t += 1 / 30; b.update(1 / 30, v, [v]);
      if (f > 90) { const n = inView(b, v); nAll++; sumAll += n; if (n >= 1) withAll++; for (const x of b.vessels) if (x.kind === 'ambient' && x.pose) worstMin = Math.min(worstMin, Math.hypot(x.pose.x - v.x, x.pose.z - v.z)); }
    }
  }
  assert.ok(worstMin >= 18, `an ambient boat came within ${worstMin.toFixed(1)} m of a player at rest: boats must pass clear of a resting player`);
  assert.ok(sumAll / nAll >= 1.2, `${(sumAll / nAll).toFixed(2)} ambient boats in view on average over 10 open-water starts`);
  assert.ok(withAll / nAll >= 0.7, `a boat in view only ${(withAll / nAll * 100).toFixed(0)}% of the time`);
  console.log(`      10 open-water starts: ${(sumAll / nAll).toFixed(2)} ambient boats in the 60 x 140 m view on average, >=1 ${(withAll / nAll * 100).toFixed(0)}% of the time, nearest ${worstMin.toFixed(0)} m`);
});

await check('REAL COAST: summer houses stand on dry land inside the window', () => {
  assert.ok(houses.length >= 25, `${houses.length} summer houses`);
  for (const h of houses) { assert.ok(gw.world.heightAt(h.x, h.z) > 0.3, 'on land'); assert.ok(gw.world.inside(h.x, h.z, 40), 'inside'); }
});

console.log(`\n${passed} checks passed`);
void Mesher;
