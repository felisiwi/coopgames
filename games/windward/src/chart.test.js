// node games/windward/src/chart.test.js — guards the chart (src/chart.js): fog picture, section bands, the discovery rules for
// what the chart writes, label collisions, and a run of the real renderer on a recording canvas.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fogAlpha, boundsRect, sectionBands, sectionAt, chartLabel, placeLabels, createChart, FOG_ALPHA, LABEL_MIN_SCALE } from './chart.js';
import { createExplored } from './explored.js';
import { chartView, worldToScreen } from './zoom.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}
const cfg = JSON.parse(fs.readFileSync(new URL('../assets/chart/chart.json', import.meta.url), 'utf8'));
// the coast's projection, simplified: metres from the overview's corner (10 game metres per overview px of 100 m)
const toGame = (lon, lat) => [(lon - 10.85) * 58693.78 / 10, (58.95 - lat) * 111195 / 10];

check('the chart assets exist: both pictures, with the sizes the config says', () => {
  const png = (f) => { const b = fs.readFileSync(new URL(`../assets/chart/${f}`, import.meta.url)); return [b.readUInt32BE(16), b.readUInt32BE(20), b.length]; };
  const o = png(cfg.overview.file);
  const d = png(cfg.detail.file);
  assert.deepEqual([o[0], o[1]], [cfg.overview.w, cfg.overview.h]);
  assert.deepEqual([d[0], d[1]], [cfg.detail.w, cfg.detail.h]);
  assert.ok(o[2] < 200000 && d[2] < 1.2e6, `small enough: ${o[2]} + ${d[2]} bytes`);
});

check('7 sections, only the start one is granddad\'s, bands stack north to south without gaps', () => {
  assert.equal(cfg.sections.length, 7);
  assert.deepEqual(cfg.sections.filter((s) => s.owned).map((s) => s.id), ['start']);
  assert.equal(cfg.sections.find((s) => s.owned).lore, 'The Shallow Sounds');
  const bands = sectionBands(toGame, cfg);
  for (let i = 1; i < bands.length; i++) assert.ok(Math.abs(bands[i].z0 - bands[i - 1].z1) < 1e-6, 'no gap between bands');
  assert.equal(sectionAt(bands, (bands[3].z0 + bands[3].z1) / 2).id, 'start');
  assert.equal(sectionAt(bands, -1e6), null);
  const r = boundsRect(toGame, cfg.detail);
  assert.ok(r.x1 > r.x0 && r.z1 > r.z0);
});

check('fog: clear where sailed, thick where not, soft at the edge, and the right size', () => {
  const cols = 20; const rows = 20;
  const cells = new Uint8Array(cols * rows);
  for (let j = 5; j < 15; j++) for (let i = 5; i < 15; i++) cells[j * cols + i] = 1;
  const { alpha, w, h } = fogAlpha(cells, cols, rows, 4);
  assert.equal(w, 80); assert.equal(h, 80);
  assert.equal(alpha[40 * w + 40], 0, 'the middle of the sailed square is clear');
  assert.equal(alpha[2 * w + 2], Math.round(FOG_ALPHA * 255), 'far corner: full fog');
  const edge = [];
  for (let x = 0; x < w; x++) edge.push(alpha[40 * w + x]);
  const mid = edge.filter((a) => a > 5 && a < Math.round(FOG_ALPHA * 255) - 5).length;
  assert.ok(mid >= 4 && mid <= 20, `a soft edge, ${mid} px wide (not a hard step, not a smear)`);
  assert.ok(edge.every((a, i) => i === 0 || Math.abs(a - edge[i - 1]) < 120), 'no hard jumps');
});

check('what the chart writes follows the discovery rules (and a lighthouse is always there)', () => {
  const hood = { id: 'a', name: 'Hättan', kind: 'light', desc: 'the Hood' };
  assert.deepEqual(chartLabel(hood, true, true), { title: 'Hättan', sub: 'the Hood', marker: true });
  assert.deepEqual(chartLabel(hood, false, true), { title: 'the Hood', sub: null, marker: true, faded: true });
  assert.deepEqual(chartLabel(hood, false, false), { title: null, sub: null, marker: true }, 'unseen: the lighthouse is on the chart, unnamed');
  const skerry = { id: 'b', name: 'Svartskär', kind: 'skerry', desc: null };
  assert.equal(chartLabel(skerry, false, true), null, 'an undescribed skerry stays off the chart until discovered');
  assert.equal(chartLabel(skerry, false, false), null);
  assert.equal(chartLabel(skerry, true, false).title, 'Svartskär');
  const gaso = { id: 'c', name: 'Gåsö', kind: 'island', desc: 'Goose Isle' };
  assert.equal(chartLabel(gaso, false, false), null, 'fog still over it: nothing');
  assert.equal(chartLabel(gaso, false, true).title, 'Goose Isle', 'fog lifted: the description');
});

check('labels never overlap and stay on the screen', () => {
  const items = [
    { sx: 200, sy: 300, w: 80, h: 17, id: 1 }, { sx: 210, sy: 302, w: 90, h: 17, id: 2 }, { sx: 205, sy: 400, w: 70, h: 30, id: 3 },
    { sx: 2, sy: 300, w: 80, h: 17, id: 4 }, { sx: 200, sy: 5, w: 60, h: 17, id: 5 },
  ];
  const out = placeLabels(items, 390, 844);
  assert.deepEqual(out.map((o) => o.id), [1, 3], 'the overlapping one, and the two off the edge, are dropped');
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
    const a = out[i].rect; const b = out[j].rect;
    assert.ok(!(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h));
  }
});

// A recording 2D context: counts calls and remembers the text drawn.
function recorder() {
  const rec = { texts: [], images: 0, fillRects: 0 };
  const ctx = new Proxy({ measureText: (t) => ({ width: t.length * 7 }) }, {
    get: (t, k) => {
      if (k in t) return t[k];
      if (k === 'fillText' || k === 'strokeText') return (s) => { if (k === 'fillText') rec.texts.push(s); };
      if (k === 'drawImage') return () => { rec.images++; };
      if (k === 'fillRect') return () => { rec.fillRects++; };
      if (k === 'createImageData') return (a, b) => ({ data: new Uint8ClampedArray(a * b * 4) });
      return () => {};
    },
    set: (t, k, v) => { t[k] = v; return true; },
  });
  return { rec, canvas: { width: 0, height: 0, style: {}, getContext: () => ctx } };
}

(async () => {
  const exp = createExplored(boundsRect(toGame, cfg.detail), { storage: null });
  const gx = (boundsRect(toGame, cfg.detail).x0 + boundsRect(toGame, cfg.detail).x1) / 2;
  const gz = (boundsRect(toGame, cfg.detail).z0 + boundsRect(toGame, cfg.detail).z1) / 2;
  exp.mark(gx, gz);
  const entries = [
    { id: 'v', name: 'Grundsund', kind: 'village', desc: 'the shallow sound', x: gx, z: gz },
    { id: 's', name: 'Svartskär', kind: 'skerry', desc: null, x: gx + 20, z: gz + 20 },
    { id: 'l', name: 'Hättan', kind: 'light', desc: 'the Hood', x: gx + 100, z: gz - 80 },
  ];
  const known = new Set(['v']);
  const { rec, canvas } = recorder();
  const img = { width: 10, height: 10 };
  const chart = createChart({
    canvas, cfg, toGame, entries, isKnown: (id) => known.has(id), explored: exp, baseUrl: '',
    makeCanvas: () => recorder().canvas, loadImage: async () => img,
  });
  const state = { boat: { x: gx, z: gz, heading: 0 }, visitId: null };
  chart.draw(chartView(2, 844, { x: gx, z: gz }), 390, 844, 2, state);
  assert.equal(canvas.style.display, 'none', 'zoomed in: the chart is not shown');
  assert.equal(rec.images, 0);
  await chart.ensureLoaded();
  const full = chartView(250, 844, { x: gx, z: gz });
  chart.draw(full, 390, 844, 2, state);
  assert.equal(canvas.style.display, 'block');
  assert.ok(rec.texts.some((t) => /Shallow Sounds/.test(t)), 'the owned section is named');
  assert.ok(rec.texts.some((t) => /Uncharted|uncharted/.test(t)), 'the others are uncharted');
  assert.ok(!rec.texts.includes('Grundsund'), 'no place names at the full chart');
  rec.texts.length = 0;
  const near = chartView(20, 844, { x: gx, z: gz });
  assert.ok(near.scale > LABEL_MIN_SCALE);
  chart.draw(near, 390, 844, 2, state);
  assert.ok(rec.texts.includes('Grundsund'), 'zoomed in: a discovered place is named');
  assert.ok(rec.texts.includes('the shallow sound'), 'with its description underneath');
  assert.ok(!rec.texts.includes('Svartskär') && !rec.texts.includes('Hättan'), 'an undiscovered skerry, and an undiscovered light, are not named');
  assert.ok(rec.texts.includes('the Hood'), 'a lighthouse the fog has lifted over shows its description');
  // the pictures and the markers must share one scale: the transform in effect when a picture is drawn maps a world point to the
  // same pixel worldToScreen gives the markers
  {
    const log = [];
    const probe = { canvas: { width: 0, height: 0, style: {}, getContext: () => new Proxy({}, { get: (t, k) => {
      if (k === 'drawImage') return (im, x, z) => { if (im === img) log.push(['draw', x, z, { ...cur }]); };
      if (k === 'translate') return (x, y) => { cur.tx += cur.sx * x; cur.ty += cur.sy * y; };
      if (k === 'scale') return (a, b) => { cur.sx *= a; cur.sy *= b; };
      if (k === 'save') return () => stack.push({ ...cur });
      if (k === 'restore') return () => { Object.assign(cur, stack.pop()); };
      if (k === 'setTransform') return (a, b, c, d, e, f) => { Object.assign(cur, { sx: a, sy: d, tx: e, ty: f }); };
      if (k === 'measureText') return (t2) => ({ width: t2.length * 7 });
      if (k === 'createImageData') return (a, b) => ({ data: new Uint8ClampedArray(a * b * 4) });
      return t[k] ?? (() => {});
    }, set: (t, k, v) => { t[k] = v; return true; } }) } };
    const cur = { sx: 1, sy: 1, tx: 0, ty: 0 };
    const stack = [];
    const c2 = createChart({ canvas: probe.canvas, cfg, toGame, entries: [], isKnown: () => false, explored: exp, baseUrl: '', makeCanvas: () => recorder().canvas, loadImage: async () => img });
    await c2.ensureLoaded();
    const v = chartView(20, 844, { x: gx, z: gz });
    c2.draw(v, 390, 844, 1, state);
    const overDraw = log.find((l) => l[0] === 'draw');
    assert.ok(overDraw, 'the overview picture was drawn');
    // a picture's corner (world) lands where worldToScreen says: the picture scale IS the zoom scale (the 1 px/m bug)
    const rect = c2.overRect;
    const px = overDraw[3].tx + overDraw[3].sx * rect.x0;
    const [sx0] = worldToScreen(v, 390, 844, rect.x0, rect.z0);
    assert.ok(Math.abs(px - sx0) < 1e-6, `picture corner at ${px}, marker maths say ${sx0}`);
    assert.ok(Math.abs(overDraw[3].sx - v.scale) < 1e-9, 'one world metre = scale px, for the pictures too');
  }
  const light = chart.hits.find((h) => h.type === 'light');
  assert.ok(light, 'the lighthouse can be tapped');
  assert.equal(chart.hit(light.x + 3, light.y - 2, near, 390, 844).entry.id, 'l');
  assert.equal(chart.hit(10, 10, near, 390, 844), null);
  const secHit = chart.hit(195, 422, full, 390, 844);
  assert.ok(secHit && secHit.type === 'section', 'at the full chart a tap lands on a section');
  passed += 1;
  console.log('ok - the renderer: names sections at the full chart, places when zoomed in, by the discovery rules; lights are tappable');
  console.log(`${passed} checks passed`);
})();
