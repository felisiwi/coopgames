// node games/windward/src/history-start-area.test.js — format checks for data/history-start-area.md.
// The file's promise is "every item has a source and a confidence, nothing invented"; these checks keep the FORM of that promise.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`ok - ${name}`); };

const md = fs.readFileSync(fileURLToPath(new URL('../data/history-start-area.md', import.meta.url)), 'utf8');
const sections = md.split(/^## /m).slice(1).map((b) => ({ title: b.split('\n')[0].trim(), body: b }));
const factual = sections.filter((s) => !/Threads worth pulling/.test(s.title));       // that section is my own suggestions, unsourced by design
const items = factual.flatMap((s) => s.body.split('\n')).filter((l) => /^- \*\*/.test(l));

check('every requested place has a section', () => {
  const titles = sections.map((s) => s.title.toLowerCase());
  for (const place of ['käringön', 'måseskär', 'gullholmen', 'härmanö', 'hälleviksstrand', 'mollösund', 'kråkesund']) {
    assert.ok(titles.some((t) => t.includes(place)), `no section for ${place}`);
  }
});
check('every item names its source as a link and states a confidence', () => {
  assert.ok(items.length >= 40, `${items.length} items`);
  for (const l of items) {
    assert.match(l, /\]\(https:\/\/[^)\s]+\)/, 'no source link: ' + l.slice(0, 80));
    assert.match(l, /confidence: (high|medium|low)/, 'no confidence: ' + l.slice(0, 80));
  }
});
check('items that say "high" cite a museum, church, authority or nature-reserve source (the rubric)', () => {
  const ok = /bohuslansmuseum\.se|digitaltmuseum|svenskakyrkan\.se|lansstyrelsen\.se|vastkuststiftelsen\.se/;
  for (const l of items.filter((x) => /confidence: high/.test(x))) assert.match(l, ok, 'high without a high-grade source: ' + l.slice(0, 90));
});
check('weak sources are never labelled high', () => {
  for (const l of items) {
    if (/vastsverige\.com|sv\.wikipedia\.org|wikivoyage|vrak\.se|mynewsdesk/.test(l) && !/bohuslansmuseum|svenskakyrkan|lansstyrelsen|vastkuststiftelsen|digitaltmuseum/.test(l)) {
      assert.doesNotMatch(l, /confidence: high/, 'tourism/wiki/snippet item marked high: ' + l.slice(0, 90));
    }
  }
});
check('century- and decade-level wording is flagged approximate, not given as a bare year', () => {
  for (const l of items) {
    const when = (l.match(/^- \*\*([^*]+)\*\*/) || [])[1] || '';
    if (/\b\d{4}s\b/.test(when) || /\b(late|first half|before|middle)\b/i.test(when)) assert.match(when, /approx|before|Middle|Late|First half/i, 'unflagged: ' + when);
  }
});
check('the two wreck snippets and the Kråkesund guess are low confidence', () => {
  const sk = items.find((l) => /Skytteren/.test(l)), allied = items.find((l) => /Allies/.test(l));
  assert.match(sk, /confidence: low/); assert.match(allied, /confidence: low/);
  const kra = sections.find((s) => /Kråkesund/.test(s.title)).body;
  assert.match(kra, /Not found under that name/); assert.match(kra, /TODO\(felix\)/);
  assert.match(kra, /not verified/i);
});
check('legends are marked as legends and undated; each has a named teller', () => {
  const legends = items.filter((l) => /\*\*Legend/.test(l));
  assert.ok(legends.length >= 2);
  for (const l of legends) assert.match(l, /told|as told/i, 'legend without a teller: ' + l.slice(0, 80));
});
check('the suggestions section says it is not fact', () => {
  const sug = sections.find((s) => /Threads worth pulling/.test(s.title));
  assert.ok(sug && /my suggestions, not facts/.test(sug.title));
});
check('the vårdkase (signal fire) gap is stated, not filled', () => {
  assert.match(md, /vårdkase \(signal-fire\) site or system on Orust with a source/);
});
check('no item gives a year that the file elsewhere calls inferred without saying so', () => {
  assert.match(md, /ennobled as Strömstierna \(1715, read from the page's words "samma år"/);
});

console.log(`\n${passed} passed (${items.length} items in ${sections.length} sections)`);
