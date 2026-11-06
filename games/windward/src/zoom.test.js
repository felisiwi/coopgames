// node games/windward/src/zoom.test.js — guards zoom and the hand-over to the chart (src/zoom.js) and the fog (src/explored.js).
// The key check: at the start of the blend the chart's pixel positions match a REAL three.js camera's, so the crossfade
// has nothing to hide (a wrong rotation direction or scale would show up here as the chart sliding sideways).
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { CONFIG } from './config.js';
import {
  ZOOM_MIN, ZOOM_CHART_START, ZOOM_CHART_FULL, chartBlend, pxPerMetre, zoomForScale, fitZoom, stepZoom, wheelFactor, chartView,
  worldToScreen, screenToWorld, cameraGroundToScreen, ZOOM_STEP,
} from './zoom.js';
import { autoCentre } from './chart-controller.js';
import { createExplored, EXPLORED_KEY, CELL_M, REVEAL_M } from './explored.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
const W = 390;
const H = 844;

check('the chart fades in only past the 3D view: 0 up to ZOOM_CHART_START, 1 from ZOOM_CHART_FULL, smooth between', () => {
  assert.equal(chartBlend(ZOOM_MIN), 0);
  assert.equal(chartBlend(1), 0);
  assert.equal(chartBlend(ZOOM_CHART_START), 0);
  assert.equal(chartBlend(ZOOM_CHART_FULL), 1);
  assert.equal(chartBlend(50), 1);
  let prev = 0;
  for (let z = ZOOM_CHART_START; z <= ZOOM_CHART_FULL; z += 0.05) { const t = chartBlend(z); assert.ok(t >= prev, 'monotonic'); prev = t; }
  assert.ok(ZOOM_CHART_START > CONFIG.ZOOM_MAX * 1.4, 'zooms out much further than the old limit of 2.5');
});

check('scale: pixels per metre fall as you zoom out, and zoomForScale inverts it', () => {
  assert.ok(pxPerMetre(2, H) < pxPerMetre(1, H));
  near(pxPerMetre(1, H) * 2, pxPerMetre(0.5, H), 1e-9);
  for (const z of [0.5, 1, 4, 20, 200]) near(zoomForScale(pxPerMetre(z, H), H), z, 1e-9 * z);
});

check('the chart view at the start of the blend lines up with a REAL perspective camera near the boat', () => {
  const zoom = 1;
  const boat = { x: 500, z: 800 };
  const cam = new THREE.PerspectiveCamera(CONFIG.FIXED_CAMERA_FOV_DEG, W / H, 1, 5000);
  const el = (CONFIG.FIXED_CAMERA_ELEVATION_DEG * Math.PI) / 180;
  const az = (CONFIG.FIXED_CAMERA_AZIMUTH_DEG * Math.PI) / 180;
  const d = CONFIG.FIXED_CAMERA_DISTANCE * zoom;
  cam.position.set(boat.x + Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, boat.z + Math.cos(az) * Math.cos(el) * d);
  cam.lookAt(boat.x, 0, boat.z);
  cam.updateMatrixWorld(true);
  const v = chartView(zoom, H, boat);
  assert.equal(v.t, 0);
  let worst = 0;
  for (const [dx, dz] of [[20, 0], [-20, 0], [0, 20], [0, -20], [15, 15], [-15, 15], [15, -15], [-15, -15], [30, -10]]) {
    const p = new THREE.Vector3(boat.x + dx, 0, boat.z + dz).project(cam);
    const real = [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H];
    const mine = worldToScreen(v, W, H, boat.x + dx, boat.z + dz);
    const err = Math.hypot(real[0] - mine[0], real[1] - mine[1]);
    const off = Math.hypot(real[0] - W / 2, real[1] - H / 2);
    worst = Math.max(worst, err / Math.max(off, 1));
    assert.ok(err < 0.12 * off + 3, `(${dx},${dz}): real ${real.map(Math.round)} vs chart ${mine.map(Math.round)}`);
    const mirrored = [W - mine[0], mine[1]];
    if (Math.abs(mine[0] - W / 2) > 10) assert.ok(Math.hypot(real[0] - mirrored[0], real[1] - mirrored[1]) > Math.hypot(real[0] - mine[0], real[1] - mine[1]), 'not mirrored');
  }
  assert.ok(worst < 0.12, `worst error ${(worst * 100).toFixed(1)}% of the offset from the boat`);
  const direct = cameraGroundToScreen(zoom, H, W, H, boat, boat.x + 20, boat.z - 10);
  const viaChart = worldToScreen(v, W, H, boat.x + 20, boat.z - 10);
  near(direct[0], viaChart[0], 1e-6); near(direct[1], viaChart[1], 1e-6);
});

check('over the blend the chart unrolls to a flat north-up map: no turn, no squash', () => {
  const start = chartView(ZOOM_CHART_START, H, { x: 0, z: 0 });
  const full = chartView(ZOOM_CHART_FULL, H, { x: 0, z: 0 });
  near(start.rot, (CONFIG.FIXED_CAMERA_AZIMUTH_DEG * Math.PI) / 180, 1e-9);
  assert.equal(full.rot, 0);
  assert.equal(full.sq, 1);
  assert.ok(start.sq < 0.85);
  const [sx, sy] = worldToScreen(full, W, H, 0, -100); // 100 m north
  near(sx, W / 2, 1e-6); assert.ok(sy < H / 2, 'north is up');
  const [ex] = worldToScreen(full, W, H, 100, 0);
  assert.ok(ex > W / 2, 'east is right');
});

check('world <-> screen is a round trip at every zoom, with a pan', () => {
  for (const z of [0.5, 2, 4, 5, 6.5, 30, 200]) {
    const v = chartView(z, H, { x: 700, z: -300 }, { x: 50, z: -20 });
    for (const [x, zz] of [[700, -300], [900, -100], [100, 400]]) {
      const [sx, sy] = worldToScreen(v, W, H, x, zz);
      const [bx, bz] = screenToWorld(v, W, H, sx, sy);
      near(bx, x, 1e-6 * Math.max(1, Math.abs(x)) + 1e-4); near(bz, zz, 1e-6 * Math.max(1, Math.abs(zz)) + 1e-4);
    }
  }
});

check('a pan eases away as the chart fades back into the boat view (the boat is centred in 3D)', () => {
  assert.equal(chartView(2, H, { x: 100, z: 100 }, { x: 80, z: 80 }).cx, 100, 'no pan in the 3D view');
  assert.equal(chartView(20, H, { x: 100, z: 100 }, { x: 80, z: 80 }).cx, 180, 'full pan in the chart');
  const mid = chartView(5, H, { x: 100, z: 100 }, { x: 80, z: 80 }).cx;
  assert.ok(mid > 100 && mid < 180);
});

check('the whole coast fits at the far end; zoom steps and wheel are symmetric and clamped', () => {
  const zFit = fitZoom(7330, 18012, W, H);
  assert.ok(zFit > 100 && zFit < 600, `full chart at zoom ${zFit.toFixed(0)}`);
  const s = pxPerMetre(zFit, H);
  assert.ok(7330 * s <= W && 18012 * s <= H, 'inside the screen');
  assert.equal(stepZoom(1, 0.0001, zFit), ZOOM_MIN);
  assert.equal(stepZoom(1, 1e9, zFit), zFit);
  near(stepZoom(stepZoom(2, ZOOM_STEP, 999), 1 / ZOOM_STEP, 999), 2, 1e-9);
  near(wheelFactor(100) * wheelFactor(-100), 1, 1e-12);
  assert.ok(wheelFactor(100) > 1.1 && wheelFactor(100) < 1.25, 'a notch is a modest step');
});

check('near the full chart the view settles on the middle of the whole coast; in the boat/sheet range it does not', () => {
  assert.equal(autoCentre(0), 0);
  assert.equal(autoCentre(0.45), 0);
  assert.equal(autoCentre(1), 1);
  assert.equal(autoCentre(2), 1);
  assert.ok(autoCentre(0.7) > 0 && autoCentre(0.7) < 1);
  let prev = 0;
  for (let r = 0; r <= 1; r += 0.02) { const w = autoCentre(r); assert.ok(w >= prev); prev = w; }
});

// ---- fog ----
const memoryStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m }; };
const RECT = { x0: 1000, z0: 2000, x1: 1000 + 24 * 40, z1: 2000 + 24 * 50 }; // 40 x 50 cells

check('sailing lifts the fog in a disc round the boat (150 m), and only there', () => {
  const e = createExplored(RECT, { storage: null });
  assert.equal(e.cols, 40); assert.equal(e.rows, 50);
  assert.equal(e.count(), 0);
  const added = e.mark(1480, 3000);
  assert.ok(added > 100 && added < 200, `${added} cells lifted (a 150 m disc of 24 m cells is ~120)`);
  assert.equal(e.isExplored(1480, 3000), true);
  assert.equal(e.isExplored(1480 + 140, 3000), true, 'inside the reveal');
  assert.equal(e.isExplored(1480 + 200, 3000), false, 'beyond it');
  assert.equal(e.isExplored(0, 0), false, 'outside the chart: never');
  assert.equal(e.count(), added);
  assert.ok(REVEAL_M === 150 && CELL_M === 24);
});

check('marking is cheap when the boat has not moved, counts each cell once, and ignores the edge', () => {
  const e = createExplored(RECT, { storage: null });
  const v0 = e.version;
  e.mark(1400, 2500);
  const v1 = e.version;
  assert.equal(e.mark(1401, 2500), 0, 'moved 1 m: nothing');
  assert.equal(e.version, v1);
  assert.ok(e.mark(1400 + 10, 2500) >= 0);
  const before = e.count();
  e.mark(1400, 2500 + 30);
  assert.ok(e.count() > before && e.count() <= e.total);
  assert.ok(v1 > v0);
  assert.doesNotThrow(() => e.mark(-5000, -5000), 'far outside the chart');
  assert.doesNotThrow(() => e.mark(RECT.x1 + 100, RECT.z1 + 100));
});

check('the fog is remembered on the device; a different grid, corrupt or blocked storage starts fresh and never throws', () => {
  const store = memoryStorage();
  const a = createExplored(RECT, { storage: store });
  a.mark(1480, 3000);
  assert.equal(a.save(), true, 'enough changed: saved');
  assert.ok(store._m.get(EXPLORED_KEY));
  const b = createExplored(RECT, { storage: store });
  assert.equal(b.count(), a.count());
  assert.equal(b.isExplored(1480, 3000), true);
  assert.equal(createExplored({ ...RECT, x1: RECT.x1 + 240 }, { storage: store }).count(), 0, 'a different grid is not trusted');
  store.setItem(EXPLORED_KEY, '{nope'); assert.equal(createExplored(RECT, { storage: store }).count(), 0);
  const blocked = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  const c = createExplored(RECT, { storage: blocked });
  c.mark(1480, 3000);
  assert.doesNotThrow(() => c.save(true));
});

check('saving waits for enough new cells (no write every frame), reset forgets everything', () => {
  const store = memoryStorage();
  const e = createExplored(RECT, { storage: store, radius: 30 });
  e.mark(1480, 3000);
  assert.equal(e.save(), false, 'a few cells: not yet');
  assert.equal(store._m.size, 0);
  assert.equal(e.save(true), true, 'forced (page hide)');
  e.reset();
  assert.equal(e.count(), 0);
  assert.equal(createExplored(RECT, { storage: store }).count(), 0);
});

console.log(`${passed} checks passed`);
