// node games/windward/src/minimap.test.js — guards the minimap (src/minimap.js): depth reads as bands, rocks and the coast
// are marked, heading-up puts the bow at the top, the world <-> minimap mapping round-trips, the picture is built a few
// rows per frame and re-centres as you sail, and settings are remembered.
import assert from 'node:assert/strict';
import {
  MINI, RASTER_M, MINI_COLORS, miniColor, isLandHeight, bakeHeights, colorize, headingRotation, arrowAngle, miniToWorld, worldToMini,
  loadMiniSettings, saveMiniSettings, createMinimap, MINI_KEY,
} from './minimap.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

check('depth reads as bands of blue, awash rock is its own colour, low rock and land are told apart', () => {
  const c = (h) => miniColor(h).join();
  assert.equal(c(-20), MINI_COLORS.deep.join());
  assert.notEqual(c(-5), c(-20));
  assert.notEqual(c(-2), c(-5));
  assert.notEqual(c(-0.8), c(-2));
  assert.equal(c(0), MINI_COLORS.awash.join(), 'awash: the hazard');
  assert.equal(c(1), MINI_COLORS.rock.join(), 'low rock / skerry');
  assert.equal(c(4), MINI_COLORS.land.join());
  assert.equal(c(12), MINI_COLORS.high.join());
  assert.ok(isLandHeight(0.3) && !isLandHeight(0.1));
});

check('the picture: a 40 m island in 8 m deep water gets a dark coast line, a hatched shoal ring, and parchment inside', () => {
  const side = 96;
  const island = (x, z) => { const r = Math.hypot(x, z); return r < 40 ? 3 : r < 52 ? -0.1 : r < 70 ? -2 : -9; };
  const heights = bakeHeights(island, 0, 0, 192, side, new Float32Array(side * side)); // 2 m per pixel
  const px = colorize(heights, side);
  const at = (x, z) => { const i = Math.floor((x + 96) / 2); const j = Math.floor((z + 96) / 2); const k = (j * side + i) * 4; return [px[k], px[k + 1], px[k + 2]].join(); };
  assert.equal(at(0, 0), MINI_COLORS.land.join(), 'the middle is land');
  assert.equal(at(39, 1), MINI_COLORS.coast.join(), 'the rim is the coast line');
  assert.equal(at(90, 0), MINI_COLORS.deep.join(), 'far out: deep');
  assert.equal(at(60, 0), MINI_COLORS.shelf.join(), 'the shelf round it');
  let hatch = 0;
  for (let j = 0; j < side; j++) for (let i = 0; i < side; i++) { const x = -96 + i * 2 + 1; const z = -96 + j * 2 + 1; const r = Math.hypot(x, z); if (r > 42 && r < 50) { const k = (j * side + i) * 4; if (px[k] === MINI_COLORS.shallow[0] && px[k + 1] === MINI_COLORS.shallow[1]) hatch++; } }
  assert.ok(hatch > 10, `the awash ring is hatched (${hatch} px)`);
});

check('heading-up: the bow points to the top of the screen, whichever way the boat heads', () => {
  for (const h of [0, 0.7, Math.PI / 2, Math.PI, -2.2, 5]) {
    const size = 132;
    const boat = { x: 100, z: 200 };
    const bow = [boat.x + Math.sin(h) * 50, boat.z + Math.cos(h) * 50]; // 50 m ahead
    const [x, y] = worldToMini(bow[0], bow[1], size, boat, h, 'heading');
    near(x, size / 2, 1e-6);
    assert.ok(y < size / 2, `heading ${h}: ahead is up`);
    const [nx, ny] = worldToMini(bow[0], bow[1], size, boat, h, 'north'); // north-up: ahead is where it really is
    near(nx, size / 2 + Math.sin(h) * 50 * size / MINI.spanM, 1e-6); near(ny, size / 2 + Math.cos(h) * 50 * size / MINI.spanM, 1e-6);
  }
  near(headingRotation(Math.PI), 0, 1e-12); // heading north (bow = -z): no rotation
});

check('north-up: north is up and east is right; the boat arrow turns to the heading', () => {
  const size = 132;
  const boat = { x: 0, z: 0 };
  assert.ok(worldToMini(0, -50, size, boat, 1, 'north')[1] < size / 2, 'north (-z) is up');
  assert.ok(worldToMini(50, 0, size, boat, 1, 'north')[0] > size / 2, 'east (+x) is right');
  near(arrowAngle(Math.PI), 0, 1e-12);
  const a = arrowAngle(Math.PI / 2); // heading east (bow = +x): an up-pointing arrow turned clockwise 90 degrees points right
  near(Math.sin(a), 1, 1e-12);
});

check('a tap on the minimap maps to the world and back, rotated or not', () => {
  for (const rot of ['north', 'heading']) {
    for (const h of [0, 1.3, -2.5]) {
      const [wx, wz] = miniToWorld(40, 90, 132, { x: 500, z: -300 }, h, rot);
      const [px, py] = worldToMini(wx, wz, 132, { x: 500, z: -300 }, h, rot);
      near(px, 40, 1e-9); near(py, 90, 1e-9);
    }
  }
  assert.ok(RASTER_M >= MINI.spanM * Math.SQRT2 - 1e-9, 'the picture covers the circle at any rotation');
});

check('settings are remembered on the device; junk or blocked storage gives the defaults', () => {
  const m = new Map();
  const store = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) };
  assert.deepEqual(loadMiniSettings(store), { shape: 'round', rot: 'north' });
  saveMiniSettings(store, { shape: 'square', rot: 'heading' });
  assert.deepEqual(loadMiniSettings(store), { shape: 'square', rot: 'heading' });
  store.setItem(MINI_KEY, '{"shape":"triangle","rot":7}');
  assert.deepEqual(loadMiniSettings(store), { shape: 'round', rot: 'north' });
  store.setItem(MINI_KEY, 'nope');
  assert.deepEqual(loadMiniSettings(store), { shape: 'round', rot: 'north' });
  assert.deepEqual(loadMiniSettings({ getItem() { throw new Error('x'); } }), { shape: 'round', rot: 'north' });
  assert.doesNotThrow(() => saveMiniSettings({ setItem() { throw new Error('x'); } }, { shape: 'off', rot: 'north' }));
});

// a fake 2D canvas context that counts what is drawn
function fakeCanvas(w = 264) {
  const calls = { drawImage: 0, putImageData: 0, arc: 0 };
  const ctx = new Proxy({}, {
    get: (t, k) => {
      if (k === 'drawImage') return () => { calls.drawImage++; };
      if (k === 'putImageData') return () => { calls.putImageData++; };
      if (k === 'arc') return () => { calls.arc++; };
      if (k === 'createImageData') return (a, b) => ({ data: new Uint8ClampedArray(a * b * 4) });
      return typeof t[k] === 'undefined' ? () => {} : t[k];
    },
    set: (t, k, v) => { t[k] = v; return true; },
  });
  return { width: w, height: w, style: {}, getContext: () => ctx, calls };
}

check('the picture is built a few rows per frame, re-centred as you sail, and costs one drawImage a frame', () => {
  const canvas = fakeCanvas();
  const made = fakeCanvas(MINI.rasterPx);
  let evals = 0;
  const heightAt = (x, z) => { evals++; return -5 + Math.sin(x / 30) * Math.cos(z / 30) * 3; };
  const mini = createMinimap({ canvas, heightAt, makeCanvas: () => made, marks: [{ x: 10, z: 10, kind: 'red' }], lights: [{ id: 'l', x: 50, z: 0, name: 'L' }], places: [{ kind: 'village', x: 20, z: 20 }] });
  const boat = { x: 0, z: 0 };
  mini.update(boat, 0);
  assert.equal(evals, MINI.rowsPerFrame * MINI.rasterPx, 'first frame: only a few rows of height samples');
  assert.equal(made.calls.putImageData, 0, 'not finished yet');
  const frames = Math.ceil(MINI.rasterPx / MINI.rowsPerFrame);
  for (let f = 1; f < frames; f++) mini.update(boat, 0);
  assert.equal(made.calls.putImageData, 1, `finished after ${frames} frames`);
  assert.equal(evals, MINI.rasterPx * MINI.rasterPx);
  const draws = canvas.calls.drawImage;
  mini.update(boat, 0);
  assert.equal(canvas.calls.drawImage - draws, 1, 'a steady frame: one drawImage, no new height samples');
  assert.equal(evals, MINI.rasterPx * MINI.rasterPx);
  mini.update({ x: MINI.rebuildM + 5, z: 0 }, 0); // sailed on: a new picture starts
  assert.ok(evals > MINI.rasterPx * MINI.rasterPx, 're-centring starts');
  mini.settings.shape = 'off';
  mini.update(boat, 0);
  assert.equal(canvas.style.display, 'none', 'off: hidden');
  mini.settings.shape = 'square';
  mini.update(boat, 0);
  assert.equal(canvas.style.borderRadius, '14px');
  assert.equal(mini.hitLight(132 / 2 + (50 * 132) / MINI.spanM, 132 / 2, 132, boat, 0).id, 'l', 'a tap on the lighthouse finds it');
  assert.equal(mini.hitLight(5, 5, 132, boat, 0), null);
  assert.ok(Array.isArray(mini.marks) && mini.marks.length === 1, 'the buoy list is exposed (the controller adds to it later)');
});

console.log(`${passed} checks passed`);
