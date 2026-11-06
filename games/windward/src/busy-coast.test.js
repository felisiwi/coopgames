// node games/windward/src/busy-coast.test.js — the busy coast: era profiles, kits, motion, giving way, and (on the REAL coast, built the way the game
// builds its collision) that every route point and berth is in water the boat could really be in.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Mesher } from './era-assets.js';
import { getKit, registerKit, kitIds } from './busy-kits.js';
import { profileForYear, validateProfile, vesselFor, berthBoat, berthsToFill, routesFor, frac } from './busy-era.js';
import { makeRoute, routePoint, routeHeading, makeSchedule, schedulePose, vesselPose, mustYield, stepYield, normAngle, TURN_DIST_M, CATCH_UP } from './busy-route.js';
import { createBusyCoast, RENDER_RADIUS_M } from './busy-coast.js';
import { placeCoastVillages } from './coast-world.js';
import { loadGameWorld } from '../../../tools/lib/game-world.mjs';
import { makeGrid, clearAt } from '../../../tools/lib/busy-planner.mjs';

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
  assert.ok(eras.profiles.filter((p) => p.id !== 'today').every((p) => p.placeholderKit === true), 'the 1950-1999 profiles must say they use a placeholder kit');
});

await check('every profile is complete, names only assets its kit has, and fits the world data', () => {
  for (const p of eras.profiles) assert.deepEqual(validateProfile(p, getKit(p.kit), world), []);
  // and a broken one is caught
  const broken = structuredClone(eras.profiles[0]);
  broken.traffic.classes.sail.assets[0].id = 'junk'; broken.ferry.dwellS = [1]; broken.houses.share = 0.9; broken.traffic.maxBoats = 40;
  const bad = validateProfile(broken, getKit('today'), world);
  assert.ok(bad.length >= 4, bad.join('\n'));
});

await check('the era changes what you see: more boats, fuller harbours and more summer houses as the years go on', () => {
  const [a, b, c] = ['summer-guests-1950', 'leisure-sailing-1980', 'today'].map((id) => eras.profiles.find((p) => p.id === id));
  const moored = (p) => world.moorings.reduce((n, m) => n + berthsToFill(p, m.berths.length), 0);
  assert.ok(routesFor(a, world).length < routesFor(b, world).length && routesFor(b, world).length < routesFor(c, world).length);
  assert.ok(moored(a) < moored(b) && moored(b) < moored(c), `${moored(a)} ${moored(b)} ${moored(c)}`);
  assert.ok(a.houses.share < b.houses.share && b.houses.share < c.houses.share);
  assert.ok(a.ferry.speed < c.ferry.speed, 'a slower ferry in 1950 (placeholder numbers)');
  assert.ok(routesFor(c, world).length <= c.traffic.maxBoats && c.traffic.maxBoats <= 12, 'the boat budget');
  assert.equal(routesFor(a, world).every((r) => world.traffic.includes(r)), true);
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
      packet: { kind: 'ferry', halfLen: () => 9, build: (S, G) => box(18, 2)(S, G) },
      hut: { kind: 'house', colours: ['tar', 'ochre'], build: (S, G, o) => box(4, 2.4)(S, G) },
    },
  });
  assert.ok(kitIds().includes('test-1950') && kitIds().includes('today'));
  const prof = {
    id: 'test', from: 1900, to: 1949, kit: 'test-1950', placeholderKit: false,
    traffic: { routes: 'all', maxBoats: 3, classes: { sail: { assets: [{ id: 'skiff', stripes: ['plain'], length: [4, 5] }], speed: [2, 3], dwellS: [5, 8] }, motor: { assets: [{ id: 'skiff', stripes: ['plain'], length: [4, 5] }], speed: [2, 3], dwellS: [5, 8] } } },
    ferry: { enabled: true, asset: 'packet', speed: 3, dwellS: [10, 5, 10] },
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
  assert.ok(s.dynamicTriangles <= 4500 && s.boatsVisible >= 1, `dynamic ${s.dynamicTriangles}, ${s.boatsVisible} boats near Lysekil`);
  assert.equal(s.houses, houses.length); assert.equal(s.vessels, 9, '8 traffic routes + the ferry');
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

await check('the ferry docks at both ends and at Östersidan: at each stop it sits within 1 m of the planned dock, bow to the quay', () => {
  const b = createBusyCoast({ world, profile: today, toGame: gw.toGame, seaY: () => 0, houses: [], clock: clockAt(0) });
  const ferry = b.vessels.find((v) => v.kind === 'ferry');
  assert.deepEqual(world.ferry.stops.map((s) => s.name), ['Lysekil Södra hamnen', 'Östersidans färjeläge', 'Fiskebäckskil brygga']);
  assert.deepEqual(world.ferry.stops.map((s) => s.osm), osm.relation.stopOrder, 'stop order is the OSM relation order');
  const seen = new Set();
  for (let t = 0; t < ferry.sched.cycleS; t += 0.5) {
    const p = vesselPose(ferry.route, ferry.sched, t);
    if (p.moving) continue;
    seen.add(p.stop);
    assert.ok(dist([p.x, p.z], toG(world.ferry.stops[p.stop].dock)) < 1, `stop ${p.stop}`);
  }
  assert.deepEqual([...seen].sort(), [0, 1, 2]);
  const cross = ferry.sched.segs.filter((s) => s.type === 'move');
  assert.ok(cross[0].dur > 40 && cross[0].dur < 90, `the crossing takes ${cross[0].dur} s`);
});

// ---------------------------------------------------------------------------------------------------- the data against the real coast
const grid = makeGrid(gw.world, gw.blocked);
const samples = (pts, step = 2) => { const out = []; for (let i = 0; i < pts.length - 1; i++) { const n = Math.max(1, Math.ceil(dist(pts[i], pts[i + 1]) / step)); for (let k = 0; k <= n; k++) out.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k / n, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k / n, i, k === 0 || k === n]); } return out; };

await check('REAL COAST: every traffic route stays in water the boat can really be in (game collision), end to end', () => {
  assert.equal(world.traffic.length, 8);
  for (const r of world.traffic) {
    const pts = r.route.map(toG);
    assert.ok(pts.length >= 2 && polyLen(pts) > 150, r.id);
    assert.ok(Math.abs(polyLen(pts) - r.lengthM) < 3, `${r.id}: stored length ${r.lengthM} vs ${polyLen(pts).toFixed(1)}`);
    for (const [x, z] of samples(pts)) assert.equal(gw.blocked(x, z), false, `${r.id} is blocked at ${x.toFixed(1)}, ${z.toFixed(1)}`);
    // it starts and ends at the named harbour's quay water
    for (const [end, name] of [[pts[0], r.from], [pts.at(-1), r.to]]) { const h = gw.seamarks.harbours.find((x) => x.name === name); assert.ok(dist(end, gw.toGame(h.lon, h.lat)) < 70, `${r.id} end at ${name}`); }
  }
});

await check('REAL COAST: the ferry crossing keeps 6+ m of clear water except within 45 m of a quay, and follows the real line 847 crossing', () => {
  const pts = world.ferry.route.map(toG), len = polyLen(pts);
  assert.ok(Math.abs(len - world.ferry.lengthM) < 3);
  let s = 0, minInterior = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const n = Math.max(1, Math.ceil(dist(pts[i], pts[i + 1]) / 2));
    for (let k = 0; k <= n; k++) {
      const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k / n, z = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k / n, at = s + dist(pts[i], pts[i + 1]) * k / n;
      assert.equal(gw.blocked(x, z), false, `ferry blocked at ${at.toFixed(0)} m`);
      const nearStop = world.ferry.stops.some((st) => dist([x, z], toG(st.dock)) < 45);
      if (!nearStop) minInterior = Math.min(minInterior, clearAt(grid, x, z));
    }
    s += dist(pts[i], pts[i + 1]);
  }
  assert.ok(minInterior >= 6, `the ferry gets within ${minInterior.toFixed(1)} m of shore mid-crossing`);
  // it follows the real crossing: every point of the OSM way between the first two stops is within 40 game m (400 m real) of our route
  const way = osm.ways[0].points.slice(0, 4).map(toG);
  for (const p of way) assert.ok(Math.min(...samples(pts).map((q) => dist(p, q))) < 40, 'the planned route strays from the real 847 line');
  for (const st of world.ferry.stops) assert.ok(dist(toG(st.dock), gw.toGame(st.lon, st.lat)) < 30, `${st.name}: dock is ${dist(toG(st.dock), gw.toGame(st.lon, st.lat)).toFixed(1)} m from the OSM stop`);
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
      assert.ok(Math.min(...samples(ferry, 4).map((q) => dist(p, q))) > 12, `${m.id}: a berth sits on the ferry's way`);
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
      const ends = [pts[0], pts.at(-1)];
      if (ends.some((e) => dist(p, e) < 25)) continue; // at that route's own quay
      worst = Math.min(worst, Math.min(...samples(pts, 4).map((q) => dist(p, q))));
    }
  }
  assert.ok(worst >= 7, `a berth is ${worst.toFixed(1)} m from a through route`);
});

await check('REAL COAST: summer houses stand on dry land inside the window', () => {
  assert.ok(houses.length >= 25, `${houses.length} summer houses`);
  for (const h of houses) { assert.ok(gw.world.heightAt(h.x, h.z) > 0.3, 'on land'); assert.ok(gw.world.inside(h.x, h.z, 40), 'inside'); }
});

console.log(`\n${passed} checks passed`);
void Mesher;
