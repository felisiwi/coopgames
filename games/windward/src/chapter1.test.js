// node games/windward/src/chapter1.test.js: the end of chapter 1 (stage 1d, batch B): the light glyph, the light log, the chest and the old tower.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LIGHTHOUSES } from './lighthouses.js';
import { lightGlyph, LONG_FLASH_S } from './light-glyph.js';
import { createLightLog, logRows, LOG_KEY } from './light-log.js';
import { createChapter1, CHAPTER_KEY } from './chapter1.js';
import { strangeFrame, fogMoodValues, STRANGE, STRANGE_TRIGGER_M, STRANGE_CARD, STRANGE_FLASH_LEVEL } from './old-tower.js';
import { lightPattern } from './lantern.js';
import { createAudio, LIGHT_CHIME } from './audio.js';
import { buildNameList } from './names.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m }; };
const read = (f) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url), 'utf8'));
const light = (name) => LIGHTHOUSES.find((l) => l.name === name).light;

check('the camera drifts toward the old tower for the flash and is back on the boat before the card', async () => {
  const { strangeFrame, STRANGE_LOOK_BIAS } = await import('./old-tower.js');
  assert.equal(strangeFrame(0).look, 0);
  assert.ok(strangeFrame(2).look > 0.99, 'on the tower by the first flash');
  assert.equal(strangeFrame(9.5).look, 0, 'back on the boat when the card comes');
  assert.ok(STRANGE_LOOK_BIAS > 0 && STRANGE_LOOK_BIAS < 1);
});

check('the glyph: a dot per short flash, a bar per long one, the period after; occulting lights show their darks; steady lights say nothing', () => {
  assert.equal(lightGlyph(light('Hättan')).text, '●● · 6s', 'two flashes every 6 s');
  assert.equal(lightGlyph(light('Gäven')).text, '●●● · 9s');
  assert.equal(lightGlyph(light('Väcker')).text, '●●●● · 12s', 'four flashes every 12 s: the example in the brief');
  assert.equal(lightGlyph(light('Nordkoster')).glyph, '▬▬▬▬', 'four LONG flashes');
  assert.equal(lightGlyph(light('Mjölskär')).text, '● · 3s', 'one flash every 3 s');
  assert.equal(lightGlyph(light('Brandskärsflak')).glyph, '○○', 'occulting twice: two darks');
  assert.equal(lightGlyph(light('Stora Pölsan')).glyph, '▬', '2 s on, 6 s off');
  assert.equal(lightGlyph(null), null);
  assert.equal(lightGlyph({ kind: 'flash', count: 1 }), null, 'no period: nothing to say');
  assert.ok(LONG_FLASH_S > 0.5 && LONG_FLASH_S < 2);
});

check('the glyph and the lantern agree: one glyph mark per flash, at the times the lantern flashes', () => {
  for (const e of LIGHTHOUSES) {
    const g = lightGlyph(e.light);
    if (!g) continue;
    const p = lightPattern(e.light);
    const n = e.light.kind === 'occulting' ? p.dark.length : p.on.length;
    assert.equal([...g.glyph].length, n, `${e.name}: ${g.glyph}`);
    assert.equal(g.flashes.length, n);
    assert.ok(g.flashes.every((f) => f.at >= 0 && f.len > 0 && f.at + f.len <= p.period + 1e-9), `${e.name}: the flashes fit in the period`);
  }
});

check('the chimes: one soft chime per flash in the same rhythm, quiet, capped, silent until audio is unlocked', () => {
  class P { setValueAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime() {} }
  const node = () => ({ connect: (x) => x, disconnect() {}, start() {}, stop() {}, gain: new P(), frequency: new P(), type: '' });
  const starts = [];
  class Ctx { constructor() { this.currentTime = 100; this.state = 'running'; this.destination = node(); } createGain() { return node(); } createOscillator() { const n = node(); n.start = (t) => starts.push(t); return n; } createBiquadFilter() { return node(); } resume() {} }
  const a = createAudio(Ctx);
  const g = lightGlyph(light('Hättan'));
  a.lightChimes(g.flashes, 1);
  assert.equal(starts.length, 0, 'silent before the first tap');
  a.unlock();
  a.lightChimes(g.flashes, 1);
  assert.equal(starts.length, 2);
  assert.ok(Math.abs((starts[1] - starts[0]) - (g.flashes[1].at - g.flashes[0].at)) < 1e-9, 'the same rhythm as the light');
  assert.ok(LIGHT_CHIME.gain <= 0.06, 'soft');
  starts.length = 0;
  a.lightChimes(Array.from({ length: 20 }, (_, i) => ({ at: i, len: 0.5 })), 0);
  assert.equal(starts.length, LIGHT_CHIME.max, 'at most 8');
  assert.doesNotThrow(() => createAudio(null).lightChimes(g.flashes));
});

check('the light log: lights in the order you heard them, once each, saved on the device, rows from the light data', () => {
  const store = memory();
  let log = createLightLog(store);
  assert.equal(log.count, 0);
  assert.equal(log.add('light:Hättan', 1), true);
  assert.equal(log.add('light:Gäven', 2), true);
  assert.equal(log.add('light:Hättan', 3), false, 'once');
  log = createLightLog(store); // a reload
  assert.deepEqual(log.ids, ['light:Hättan', 'light:Gäven']);
  const rows = logRows(log, (id) => { const e = LIGHTHOUSES.find((l) => `light:${l.name}` === id); return e && { name: e.name, light: e.light }; }, lightGlyph);
  assert.deepEqual(rows.map((r) => `${r.name} ${r.text}`), ['Hättan ●● · 6s', 'Gäven ●●● · 9s']);
  assert.equal(logRows(log, () => null, lightGlyph).length, 0, 'an unknown id is skipped');
  store.setItem(LOG_KEY, 'nope');
  assert.equal(createLightLog(store).count, 0);
  assert.doesNotThrow(() => createLightLog({ getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } }).add('light:X'));
});

check('chapter 1: the chest (and granddad\'s chart with it) is saved; the old tower only counts once the chart is open; complete = seen', () => {
  const store = memory();
  let c = createChapter1(store);
  assert.equal(c.chest, false); assert.equal(c.chartOpen, false); assert.equal(c.complete, false);
  c.markTowerSeen();
  assert.equal(c.towerSeen, false, 'before the chest the tower does not count');
  c.giveChest();
  assert.equal(c.chest, true); assert.equal(c.chartOpen, true);
  c.markTowerSeen();
  assert.equal(c.complete, true);
  c = createChapter1(store);
  assert.equal(c.chest, true); assert.equal(c.complete, true, 'both remembered');
  store.setItem(CHAPTER_KEY, '{"chest":false,"towerSeen":true}');
  assert.equal(createChapter1(store).complete, false, 'a seen tower without the chest is not valid');
  store.setItem(CHAPTER_KEY, 'nope');
  assert.equal(createChapter1(store).chest, false);
  assert.doesNotThrow(() => createChapter1({ getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } }).giveChest());
});

check('the old tower sequence: fog thickens, the faint flash and the bell, the fog thins, then the card; the fog is back to normal at the end', () => {
  assert.deepEqual(strangeFrame(0), { fog: 0, look: 0, flashing: false, bell: false, card: false, done: false });
  const mid = strangeFrame(3);
  assert.ok(mid.fog > 0.9 && mid.flashing && mid.bell && !mid.card);
  assert.ok(strangeFrame(5).fog > 0.99, 'thick while the tower flashes');
  assert.ok(strangeFrame(8.5).fog < strangeFrame(5).fog, 'thinning');
  assert.equal(strangeFrame(STRANGE.cardAtS).card, true);
  assert.equal(strangeFrame(STRANGE.cardAtS).flashing, false, 'the flash is over before the card');
  assert.ok(strangeFrame(STRANGE.endS).fog < 0.001 && strangeFrame(STRANGE.endS).done, 'clear again at the end');
  let last = 0; for (let t = 0; t <= STRANGE.fogUpS; t += 0.1) { const f = strangeFrame(t).fog; assert.ok(f >= last - 1e-9); last = f; }
  assert.ok(STRANGE_FLASH_LEVEL < 0.8, 'faint');
  assert.ok(STRANGE_TRIGGER_M >= 30 && STRANGE_TRIGGER_M <= 90);
  assert.deepEqual(STRANGE_CARD.lines, ['That tower has been dark since 1978.', 'But you saw it.']);
});

check('the fog mood: thicker, closer and colder with k; k = 0 is exactly today\'s haze', () => {
  const base = { HAZE_MESH_NEAR_MUL: 1.18, HAZE_MESH_FAR_MUL: 3.3, HAZE_WATER_NEAR_MUL: 1, HAZE_WATER_FAR_MUL: 3.06, HAZE_WATER_STRENGTH: 0.85, HAZE_COLOR: 0xefe4cf };
  assert.deepEqual(fogMoodValues(base, 0), base);
  const thick = fogMoodValues(base, 1);
  assert.ok(thick.HAZE_MESH_FAR_MUL < base.HAZE_MESH_FAR_MUL * 0.35 && thick.HAZE_WATER_FAR_MUL < base.HAZE_WATER_FAR_MUL * 0.35);
  assert.ok(thick.HAZE_WATER_STRENGTH > base.HAZE_WATER_STRENGTH);
  assert.equal(thick.HAZE_COLOR, 0xaab6c2, 'a cold grey-blue');
  const half = fogMoodValues(base, 0.5);
  assert.ok(half.HAZE_MESH_FAR_MUL < base.HAZE_MESH_FAR_MUL && half.HAZE_MESH_FAR_MUL > thick.HAZE_MESH_FAR_MUL);
});

check('granddad\'s chart data: every favourite is a real name-list entry in the region; the strange mark is Måseskär\'s old tower and its pattern is honestly flagged invented', () => {
  const data = read('../data/granddad-chart.json');
  const names = read('../assets/coast/names.json');
  const settlements = read('../data/settlements-history.json').settlements;
  const placeNames = read('../data/place-names.json');
  const toGame = (lon, lat) => [(lon - 11.25) * 5869.378, -(lat - 58.085) * 11119.5];
  const list = buildNameList({ names, villages: settlements, toGame, inside: () => true, placeNames, lights: LIGHTHOUSES, majorPlaces: read('../assets/coast/places.json').places.filter((p) => p.kind === 'village' || p.kind === 'town') });
  const ids = new Set(list.map((e) => e.id));
  assert.equal(data.favourites.length, 8);
  for (const f of data.favourites) assert.ok(ids.has(f.id), `${f.id} is a place in the game`);
  assert.equal(new Set(data.favourites.map((f) => f.id)).size, 8, 'no duplicates');
  const s = data.strange;
  const tower = LIGHTHOUSES.find((l) => l.name === s.tower);
  const [tx, tz] = toGame(tower.lon, tower.lat), [sx, sz] = toGame(s.lon, s.lat);
  assert.ok(Math.hypot(tx - sx, tz - sz) < 10, 'the mark is on the old tower (within 100 m real)');
  assert.equal(tower.built, 1865);
  assert.equal(tower.lit, false, 'the tower is dark in the light data');
  assert.equal(s.light.invented, true, 'the pattern is not documented: flagged invented');
  assert.ok(/NOT documented/.test(s.inventedWhy) && s.sources.length >= 2 && s.sources.every((u) => /^https:\/\//.test(u)), 'with the reason and the sources');
  assert.equal(s.darkSince, '1978-08-31');
  const g = lightGlyph(s.light);
  assert.equal(g.text, '●● · 15s');
  assert.notEqual(g.text, lightGlyph({ kind: 'flash', count: 3, period: 30, flashSeconds: 1.5 }).text, 'unlike the new tower\'s Fl(3) 30 s');
});

console.log(`${passed} checks passed`);
