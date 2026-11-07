// node games/windward/src/sail-feel-params.test.js — the sail-feel lab's URL params (src/sail-feel-params.js).
import assert from 'node:assert/strict';
import { parseParams, toSearch, DEFAULTS, LAYERS, LAYER_IDS } from './sail-feel-params.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }

check('no params = the defaults; the default settings write an empty query', () => {
  assert.deepEqual(parseParams(''), DEFAULTS);
  assert.equal(toSearch(parseParams('')), '');
});

check('the example in the brief: ?day=unsettled&t=14:00', () => {
  const s = parseParams('?day=unsettled&t=14:00');
  assert.equal(s.day, 'unsettled');
  assert.equal(s.t, 14);
  assert.equal(parseParams('?t=7:30').t, 7.5);
  assert.equal(parseParams('?t=18.25').t, 18.25);
});

check('layers: ?off= lists switched-off layers; unknown ids and duplicates are dropped', () => {
  assert.deepEqual(parseParams('?off=gusts,spray,gusts,banana').off, ['gusts', 'spray']);
  assert.deepEqual(parseParams('').off, []);
  assert.equal(new Set(LAYER_IDS).size, LAYER_IDS.length, 'ids are unique');
  for (const need of ['shifts', 'gusts', 'shadows', 'funnel', 'boost', 'swell', 'squalls', 'mist', 'dip', 'spray', 'heel', 'luff', 'arrow']) assert.ok(LAYER_IDS.includes(need), `the brief's toggle: ${need}`);
  assert.ok(LAYERS.every((l) => l.label && l.group));
});

check('bad values fall back to the defaults, good numbers are clamped into range', () => {
  const s = parseParams('?day=tornado&t=banana&seed=abc&zoom=99&drift=-5&era=1066&start=moon&demo=lava&spray=9');
  assert.equal(s.day, DEFAULTS.day); assert.equal(s.t, DEFAULTS.t); assert.equal(s.seed, DEFAULTS.seed);
  assert.equal(s.zoom, 2.5); assert.equal(s.drift, 0.1); assert.equal(s.era, DEFAULTS.era);
  assert.equal(s.start, DEFAULTS.start); assert.equal(s.demo, null); assert.equal(s.spray, 2);
  assert.equal(parseParams('?t=25:00').t, DEFAULTS.t);
});

check('round trip: every setting survives parse -> toSearch -> parse', () => {
  const s = { era: 'today', day: 'misty-morning', seed: 412, t: 6.5, ff: 1, freeze: 1, off: ['gusts', 'arrow'], zoom: 1.4, drift: 0.55, spray: 0.5, heel: 1.5, start: 'outside', demo: 'gust', panel: 1, debug: 1 };
  const text = toSearch(s);
  assert.deepEqual(parseParams(text), s);
  assert.ok(text.includes('t=06%3A30') || text.includes('t=06:30'), text);
});

check('only changed values are written; params the lab does not own (touch, sheet) are kept untouched', () => {
  const text = toSearch({ ...DEFAULTS, day: 'unsettled' }, '?touch=1&sheet=rope&seed=3&day=sea-breeze');
  const q = new URLSearchParams(text);
  assert.equal(q.get('touch'), '1'); assert.equal(q.get('sheet'), 'rope');
  assert.equal(q.get('day'), 'unsettled');
  assert.equal(q.has('seed'), false, 'the old seed was reset to the default, so it is gone');
  assert.equal(q.has('t'), false);
});

check('the layer list in the query keeps the panel order, not the order clicked', () => {
  assert.equal(new URLSearchParams(toSearch({ ...DEFAULTS, off: ['arrow', 'shifts', 'gusts'] })).get('off'), 'shifts,gusts,arrow');
});

console.log(`${passed} sail-feel-params checks passed`);
