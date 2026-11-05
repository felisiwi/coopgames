// node games/windward/src/coast-world.test.js — guards the real-coast trial's data layer
// (src/coast-world.js) on a synthetic coast, so it runs without the 10 MB of coast PNGs:
// the window maps to the right size, land is lifted clear of the sea, the window edge sinks
// into deep sea (no cliff), the depth map has real shore data, the boat spawns in open
// water, and villages land on dry ground inside the window only.
import assert from 'node:assert/strict';
import { DEEP_M } from './depthmap.js';
import { buildCoastWorld, findOpenWater, placeCoastVillages, LAND_LIFT_M, EDGE_FADE_M } from './coast-world.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

// A 300 x 300 px "coast" at 20 m/px: a round island (radius 40 px, class 5 = forest, 12 m high)
// in the middle, with the placeholder depth model (0.5 m + 0.04 per metre from shore).
const MPP = 20;
const C = 150;
const R = 40;
const coast = {
  mpp: MPP,
  meta: { classes: ['water', 'bare_rock', 'heath', 'meadow', 'scrub', 'forest', 'village'].map((name, value) => ({ name, value })) },
  toPx: (lon, lat) => [lon, lat], // window below is given directly in px
  isLand: (i, j) => Math.hypot(i - C, j - C) < R,
  heightM: (i, j) => (Math.hypot(i - C, j - C) < R ? 12 : 0),
  classAt: (i, j) => (Math.hypot(i - C, j - C) < R ? 5 : 0),
  depthM: (i, j) => Math.min(9, 0.5 + 0.04 * (Math.hypot(i - C, j - C) - R) * MPP),
};
const WIN = { w: 20, e: 280, n: 20, s: 280 }; // 260 x 260 px
const world = buildCoastWorld(coast, { scale: 10, window: WIN, vex: 0.5, smooth: 0 });
const cx = (C + 0.5) * world.pxM; // island centre in game metres
const cz = (C + 0.5) * world.pxM;

check('the window is 260 x 260 cells at 2 m (1:10 of 20 m pixels)', () => {
  assert.equal(world.nx, 260);
  assert.equal(world.nz, 260);
  assert.equal(world.pxM, 2);
  assert.equal(world.bounds.maxX - world.bounds.minX, 520);
});

check('land is lifted clear of the sea and scaled by the vertical factor', () => {
  const h = world.heightAt(cx, cz);
  assert.ok(Math.abs(h - (LAND_LIFT_M + 12 * 0.5)) < 0.01, `centre height ${h}`);
  assert.ok(world.heightAt(cx + (R + 6) * 2, cz) < -0.4, 'open water is below the waves');
});

check('the window edge sinks into deep sea (no cliff at the border)', () => {
  assert.ok(Math.abs(world.heightAt(world.bounds.minX + 1, cz) + DEEP_M) < 1.5, 'west edge is deep');
  assert.equal(world.heightAt(world.bounds.minX - 500, cz), -DEEP_M, 'outside the window is deep');
  // a land pixel inside the fade zone is below the sea, not a cliff
  const fadedLand = buildCoastWorld({ ...coast, isLand: () => true, heightM: () => 30, classAt: () => 5 }, { scale: 10, window: WIN, smooth: 0 });
  assert.ok(fadedLand.heightAt(fadedLand.bounds.minX + 4, cz) < 0, 'land at the very edge has sunk below sea level');
  assert.ok(fadedLand.heightAt(fadedLand.bounds.minX + EDGE_FADE_M + 20, cz) > 10, 'land past the fade zone is full height');
});

check('the depth map matches the window and carries shore data for the foam', () => {
  const m = world.depthMap;
  assert.equal(m.nx, world.nx);
  assert.equal(m.nz, world.nz);
  assert.equal(m.depth.length, m.nx * m.nz);
  assert.equal(m.depth[Math.floor(m.nz / 2) * m.nx + Math.floor(m.nx / 2)], 0, 'no depth on land');
  let nearShore = 0;
  for (let i = 0; i < m.shore.length; i++) if (m.shore[i] > 0 && m.shore[i] < DEEP_M) nearShore++;
  assert.ok(nearShore > 200, `expected a ring of shore texels, got ${nearShore}`);
});

check('classNameAt names the land cover on land and is null at sea', () => {
  assert.equal(world.classNameAt(cx, cz), 'forest');
  assert.equal(world.classNameAt(cx + (R + 10) * 2, cz), null);
});

check('findOpenWater returns deep water clear of land, near the start', () => {
  const p = findOpenWater(world, cx, cz);
  assert.ok(p, 'found a spot');
  assert.ok(world.heightAt(p.x, p.z) < -3);
  assert.ok(Math.hypot(p.x - cx, p.z - cz) > R * 2, 'outside the shore');
});

check('villages are placed on dry ground inside the window, and ignored outside it', () => {
  // the fake toPx maps (lon, lat) straight to pixels: the island centre, and a corner outside the window
  const inside = { name: 'Inside', lon: C, lat: C };
  const outside = { name: 'Outside', lon: 5, lat: 5 };
  const { buildings, villages } = placeCoastVillages(world, [inside, outside]);
  assert.equal(villages.length, 1, 'only the village inside the window is placed');
  assert.ok(buildings.length >= 5, `placed ${buildings.length}`);
  for (const b of buildings) {
    assert.ok(world.inside(b.x, b.z), 'house inside the window');
    assert.ok(b.y >= 0 && world.heightAt(b.x, b.z) >= 0.5, 'house on land');
  }
});

console.log(`${passed} checks passed`);
