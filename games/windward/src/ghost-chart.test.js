// node games/windward/src/ghost-chart.test.js — the ghost chart: shore contours, pencil only where the old chart was explored, ink only where
// you have sailed, never any text / marks / harbours, the game's saved chart read but never written, the demo chart, and the ink picture.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shoreSegments, worldShore, exploredBounds, readOnlyStorage, demoExplored, fullExplored, inkRaster, createGhostChart, drawGhostChart, fitView, INK_EXPLORED_KEY, SHEET } from './ghost-chart.js';
import { createExplored, EXPLORED_KEY } from './explored.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }

// a synthetic world: a round island of radius 40 m in a 200 x 200 m window, 2 m cells
const N = 100, PX = 2;
const makeWorld = (radiusM) => {
  const H = new Float32Array(N * N);
  for (let b = 0; b < N; b++) for (let a = 0; a < N; a++) H[b * N + a] = radiusM - Math.hypot((a + 0.5) * PX - 100, (b + 0.5) * PX - 100);
  const heightAt = (x, z) => radiusM - Math.hypot(x - 100, z - 100);
  return { H, nx: N, nz: N, x0: 0, z0: 0, pxM: PX, heightAt };
};
const RECT = { x0: 0, z0: 0, x1: 200, z1: 200 };
const todayW = makeWorld(40), eraW = makeWorld(36); // the sea stands higher: the 1700 island is smaller
// a recording 2D context: counts what is drawn
const stub = () => {
  const calls = { stroke: 0, fill: 0, fillText: 0, strokeText: 0, drawImage: 0, lineTo: 0, fillRect: 0, strokes: [], fills: [] };
  const ctx = {
    set fillStyle(v) { calls.fillStyle = v; }, set strokeStyle(v) { calls.strokeStyle = v; }, set lineWidth(v) {}, set lineCap(v) {}, set lineJoin(v) {}, set imageSmoothingEnabled(v) {},
    fillRect() { calls.fillRect++; }, beginPath() {}, moveTo() {}, lineTo() { calls.lineTo++; }, closePath() {}, save() {}, restore() {}, translate() {}, rotate(a) { calls.rotated = a; },
    stroke() { calls.stroke++; calls.strokes.push(calls.strokeStyle); }, fill() { calls.fill++; }, drawImage() { calls.drawImage++; },
    fillText() { calls.fillText++; }, strokeText() { calls.strokeText++; },
  };
  return { ctx, calls };
};

check('shoreSegments traces the shoreline: a closed ring of about the right length, on the contour', () => {
  const segs = shoreSegments(todayW.H, N, N, 0, 0, PX);
  let len = 0, offContour = 0;
  for (let i = 0; i < segs.length; i += 4) {
    len += Math.hypot(segs[i + 2] - segs[i], segs[i + 3] - segs[i + 1]);
    for (const [x, z] of [[segs[i], segs[i + 1]], [segs[i + 2], segs[i + 3]]]) if (Math.abs(Math.hypot(x - 100, z - 100) - 40) > 1.2) offContour++;
  }
  assert.ok(Math.abs(len - 2 * Math.PI * 40) < 2 * Math.PI * 40 * 0.03, `ring length ${len.toFixed(1)} vs ${(2 * Math.PI * 40).toFixed(1)}`);
  assert.equal(offContour, 0, 'every end point lies on the 40 m circle (within a cell)');
  assert.equal(shoreSegments(new Float32Array(N * N).fill(-3), N, N, 0, 0, PX).length, 0, 'open sea: no shore');
  assert.equal(shoreSegments(new Float32Array(N * N).fill(3), N, N, 0, 0, PX).length, 0, 'all land: no shore');
  assert.equal(worldShore({ ...todayW }).length, segs.length);
});

check('the sea higher: the 1700 ring is inside the Today ring (the pencil and the ink disagree)', () => {
  const t = shoreSegments(todayW.H, N, N, 0, 0, PX), e = shoreSegments(eraW.H, N, N, 0, 0, PX);
  const meanR = (s) => { let r = 0, n = 0; for (let i = 0; i < s.length; i += 2) { r += Math.hypot(s[i] - 100, s[i + 1] - 100); n++; } return r / n; };
  assert.ok(meanR(e) < meanR(t) - 3);
});

check('saddle cells (two corners of land) give two segments, not a crossing', () => {
  const H = new Float32Array([1, -1, -1, 1]); // 2 x 2: TL and BR land
  assert.equal(shoreSegments(H, 2, 2, 0, 0, 1).length, 8);
});

check('read-only storage: the game\'s saved chart is read, never written', () => {
  const written = [];
  const real = { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { written.push(k); this.store[k] = v; } };
  const game = createExplored(RECT, { storage: real, key: EXPLORED_KEY });
  game.reveal(100, 100, 60); game.save(true);
  assert.ok(written.includes(EXPLORED_KEY));
  written.length = 0;
  const ro = createExplored(RECT, { storage: readOnlyStorage(real), key: EXPLORED_KEY });
  assert.ok(ro.isExplored(100, 100), 'the saved chart is read');
  assert.equal(ro.count(), game.count());
  ro.reveal(10, 10, 50); ro.save(true);
  assert.deepEqual(written, [], 'nothing was written to the game\'s key');
  assert.equal(readOnlyStorage(null), null);
  assert.notEqual(INK_EXPLORED_KEY, EXPLORED_KEY, 'the lab inks into its own key');
});

check('demoExplored lifts discs along the route; fullExplored lifts everything', () => {
  const ex = demoExplored(RECT, [{ x: 20, z: 20 }, { x: 180, z: 20 }], { radius: 30, stepM: 20 });
  assert.ok(ex.isExplored(100, 20) && ex.isExplored(30, 30));
  assert.ok(!ex.isExplored(100, 150), 'far from the route stays unexplored');
  assert.ok(ex.count() > 0 && ex.count() < ex.total);
  const full = fullExplored(RECT);
  assert.equal(full.count(), full.total);
});

check('drawGhostChart: nothing explored = a blank sheet, no lines (a chart you have not earned shows nothing)', () => {
  const model = createGhostChart({ today: { world: todayW }, era: { world: eraW }, todayExplored: createExplored(RECT, { storage: null }), inkExplored: createExplored(RECT, { storage: null }) });
  const { ctx, calls } = stub();
  const s = drawGhostChart(ctx, 400, 400, fitView(RECT, 400, 400), model, null, null);
  assert.deepEqual(s, { pencil: 0, pencilInked: 0, ink: 0 });
  assert.equal(calls.fillStyle, SHEET); assert.equal(calls.fillRect, 1);
  assert.equal(calls.lineTo, 0);
});

check('pencil is Today\'s shore where the old chart was explored; ink is 1700\'s shore where you have sailed; pencil fades under ink', () => {
  const todayExplored = fullExplored(RECT);
  const inkExplored = createExplored(RECT, { storage: null });
  const model = createGhostChart({ today: { world: todayW }, era: { world: eraW }, todayExplored, inkExplored });
  const view = fitView(RECT, 400, 400);
  let { ctx, calls } = stub();
  const a = drawGhostChart(ctx, 400, 400, view, model, { x: 100, z: 60, heading: 0 }, null);
  assert.equal(a.pencil, model.segsToday.length / 4, 'all of Today\'s shore is pencil');
  assert.equal(a.ink, 0, 'nothing sailed yet: no ink');
  assert.equal(a.pencilInked, 0);
  assert.ok(calls.strokes.every((c) => /^rgba\(78,72,66/.test(c)), 'pencil lines are faint graphite');
  // sail the west side of the island: only that shore inks in
  inkExplored.reveal(60, 100, 36);
  ({ ctx, calls } = stub());
  const b = drawGhostChart(ctx, 400, 400, view, model, null, null);
  assert.ok(b.ink > 0 && b.ink < model.segsEra.length / 4, `some of the shore is inked (${b.ink})`);
  assert.ok(b.pencilInked > 0 && b.pencil + b.pencilInked === model.segsToday.length / 4, 'the pencil under the ink is drawn fainter');
  assert.ok(calls.strokes.includes('#3d3226'), 'the ink is the game\'s ink colour');
  // the stats match the model's own count
  assert.equal(model.stats().inkSegments, b.ink); assert.equal(model.stats().pencilSegments, b.pencil + b.pencilInked);
});

check('no names, marks or harbours: drawing never writes text and only strokes lines, fills the sheet and the boat', () => {
  const todayExplored = fullExplored(RECT), inkExplored = fullExplored(RECT);
  const model = createGhostChart({ today: { world: todayW }, era: { world: eraW }, todayExplored, inkExplored });
  const { ctx, calls } = stub();
  drawGhostChart(ctx, 390, 844, fitView(RECT, 390, 844), model, { x: 100, z: 100, heading: 1 }, { fake: 'image' });
  assert.equal(calls.fillText + calls.strokeText, 0, 'no text');
  assert.equal(calls.fill, 1, 'the only filled shape is the boat');
  assert.equal(calls.drawImage, 1, 'the ink picture');
  assert.equal(calls.rotated, -1, 'the boat points the way it heads');
  const src = readFileSync(new URL('./ghost-chart.js', import.meta.url), 'utf8');
  assert.ok(!/fillText|strokeText|\.names|harbour|seamark|lighthouse/i.test(src.replace(/\/\/.*$/gm, '')), 'the module has no text, name, harbour or mark code');
});

check('inkRaster: tint only where explored, land vs sea from the 1700 world, soft edge', () => {
  const ex = createExplored(RECT, { storage: null });
  ex.reveal(100, 100, 90);
  const r = inkRaster(eraW, ex, 4);
  assert.equal(r.w, ex.cols * 4); assert.equal(r.h, ex.rows * 4);
  const px = (x, z) => { const i = Math.floor((x - RECT.x0) / ((RECT.x1 - RECT.x0) / r.w)), j = Math.floor((z - RECT.z0) / ((RECT.z1 - RECT.z0) / r.h)); const k = (j * r.w + i) * 4; return [...r.rgba.slice(k, k + 4)]; };
  const centre = px(100, 100), sea = px(100, 145), far = px(5, 5);
  assert.deepEqual(centre.slice(0, 3), [239, 227, 200], 'land is the chart paper');
  assert.ok(centre[3] > 240);
  assert.deepEqual(sea.slice(0, 3), [212, 226, 224], 'sea is the chart sea paper');
  assert.ok(sea[3] > 200);
  assert.equal(far[3], 0, 'unexplored: no ink picture at all');
  const edge = px(100, 100 + 90);
  assert.ok(edge[3] > 0 && edge[3] < 255, 'the edge of the explored disc fades');
});

check('createGhostChart caches the ink picture until the explored grid grows', () => {
  const inkExplored = createExplored(RECT, { storage: null });
  const model = createGhostChart({ today: { world: todayW }, era: { world: eraW }, todayExplored: fullExplored(RECT), inkExplored });
  const a = model.ink(), b = model.ink();
  assert.equal(a.rgba, b.rgba, 'same picture object while nothing changed');
  inkExplored.reveal(100, 100, 40);
  const c = model.ink();
  assert.notEqual(c.rgba, a.rgba); assert.ok(c.version > a.version);
});

check('fitView fits the whole chart in the box, centred', () => {
  const v = fitView(RECT, 390, 844);
  assert.ok(v.scale > 0 && (RECT.x1 - RECT.x0) * v.scale <= 390 && (RECT.z1 - RECT.z0) * v.scale <= 844);
  assert.equal(v.cx, 100); assert.equal(v.cz, 100);
});

check('exploredBounds: the box round every lifted cell of any grid; null when nothing is explored', () => {
  assert.equal(exploredBounds([createExplored(RECT, { storage: null })]), null);
  const a = createExplored(RECT, { storage: null }); a.reveal(40, 40, 20);
  const b = createExplored(RECT, { storage: null }); b.reveal(150, 160, 20);
  const box = exploredBounds([a, b], 0);
  assert.ok(box.x0 <= 24 && box.x0 >= 0 && box.x1 >= 160 && box.z1 >= 160 && box.z0 <= 30, JSON.stringify(box));
  const one = exploredBounds([a], 0);
  assert.ok(one.x1 < 100, 'only the first grid');
  assert.equal(exploredBounds([a], 50).x0, one.x0 - 50);
});

console.log(`\n${passed} checks passed`);
