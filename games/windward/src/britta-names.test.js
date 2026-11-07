// node games/windward/src/britta-names.test.js: after Britta's card, the four AGA lights read by name (src/britta-names.js); Måseskär and the rest keep the discovery rule.
import assert from 'node:assert/strict';
import { withBrittaNames, brittaHasSpoken, BRITTA_LIGHT_IDS } from './britta-names.js';
import { createNameBook } from './names.js';
import { lightInfo } from './chart-controller.js';
import { createBeats, PHASES } from './beats-1950.js';
import { LIGHTS_1950 } from './story-1950.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const entry = (name, i, desc = null) => ({ id: `light:${name}`, name, kind: 'light', desc, x: i * 5000, z: 0, radius: 60 }); // far apart: sailing to one discovers only that one
const entries = [...LIGHTS_1950, 'Måseskär', 'Islandsberg'].map((n, i) => entry(n, i, `the lamp near ${n}`));

check('the four ids are exactly the four lights Britta names', () => {
  assert.deepEqual([...BRITTA_LIGHT_IDS].sort(), LIGHTS_1950.map((n) => `light:${n}`).sort());
  assert.equal(BRITTA_LIGHT_IDS.has('light:Måseskär'), false);
});

check('before her card the discovery rule holds; once the beats reach free, the four are known and the rest are not', () => {
  const book = createNameBook(entries, memory());
  for (const phase of PHASES) {
    const wrapped = withBrittaNames(book, () => phase);
    const spoken = PHASES.indexOf(phase) >= PHASES.indexOf('free');
    assert.equal(brittaHasSpoken(phase), spoken);
    for (const n of LIGHTS_1950) assert.equal(wrapped.isKnown(`light:${n}`), spoken, `${n} at ${phase}`);
    assert.equal(wrapped.isKnown('light:Måseskär'), false, `Måseskär at ${phase}`);
    assert.equal(wrapped.isKnown('light:Islandsberg'), false);
  }
});

check('the tag and the visit card then show the real name (lightInfo is what both use)', () => {
  const book = createNameBook(entries, memory());
  const hattan = entries.find((e) => e.name === 'Hättan');
  assert.equal(lightInfo(hattan, withBrittaNames(book, () => 'help').isKnown(hattan.id)).title, 'the lamp near Hättan', 'before: the description');
  assert.equal(lightInfo(hattan, withBrittaNames(book, () => 'free').isKnown(hattan.id)).title, 'Hättan', 'after: the name');
  const mase = entries.find((e) => e.name === 'Måseskär');
  assert.equal(lightInfo(mase, withBrittaNames(book, () => 'free').isKnown(mase.id)).title, 'the lamp near Måseskär', 'Måseskär still waits for discovery');
});

check('a real discovery still counts: a light you sailed to is known in every phase; the real book and its count are untouched', () => {
  const st = memory(); const book = createNameBook(entries, st);
  const mase = entries.find((e) => e.name === 'Måseskär');
  book.update(mase.x, mase.z); // discovered by sailing up to it
  assert.equal(withBrittaNames(book, () => 'find').isKnown(mase.id), true);
  assert.equal(book.isKnown(mase.id), true); assert.equal(book.count(), 1, 'only Måseskär was discovered');
  const before = book.count();
  const wrapped = withBrittaNames(book, () => 'free');
  wrapped.isKnown('light:Hättan');
  assert.equal(book.count(), before, 'asking never saves a name');
  assert.equal(book.isKnown('light:Hättan'), false, 'the real book never learned Hättan from Britta');
  assert.equal(book.isKnown('light:Gäven'), false);
  assert.equal(typeof wrapped.update, 'function', 'the other name-book methods come along');
});

check('a saved beats phase past free (an old save) works from the first frame; the Today game has no beats and keeps the rule', () => {
  const st = memory(); st.setItem('windward.beats1950.v1', JSON.stringify({ v: 1, phase: 'free' }));
  const beats = createBeats({ storage: st, grundsund: { x: 0, z: 0 }, yard: { x: 1, z: 1 } });
  const book = createNameBook(entries, memory());
  assert.equal(withBrittaNames(book, () => beats.phase).isKnown('light:Gäven'), true);
  assert.equal(withBrittaNames(book, () => null).isKnown('light:Gäven'), false, 'no beats (not 1950): unchanged');
});

console.log(`\n${passed} checks passed`);
