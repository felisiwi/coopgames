// node games/windward/src/epochs.test.js — the timeline axis and the integrity of data/epochs.json.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildAxis, epochAt, eraAt, herringAt, lighthousesStanding, marstrandAt, describeYear, KIND_COLOURS } from './epochs.js';

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`ok - ${name}`); };
const data = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../data/epochs.json', import.meta.url)), 'utf8'));
const axis = buildAxis(data.epochs);

check('epoch widths add up to 100 and the epochs are contiguous', () => {
  assert.equal(data.epochs.reduce((n, e) => n + e.weight, 0), 100);
  for (let i = 1; i < data.epochs.length; i++) assert.equal(data.epochs[i].from, data.epochs[i - 1].to + 1, data.epochs[i].name);
});
check('eras are contiguous, cover the same span as the epochs and stay inside one epoch each', () => {
  assert.equal(data.eras[0].from, data.epochs[0].from);
  assert.equal(data.eras.at(-1).to, data.epochs.at(-1).to);
  for (let i = 1; i < data.eras.length; i++) assert.equal(data.eras[i].from, data.eras[i - 1].to + 1, data.eras[i].name);
  for (const r of data.eras) assert.equal(epochAt(data.epochs, r.from).id, epochAt(data.epochs, r.to).id, `${r.name} crosses an epoch border`);
});
check('year <-> position round-trips and is monotonic across the whole range', () => {
  let prev = -1;
  for (let y = 800; y <= 2026; y += 7) {
    const p = axis.toPos(y); assert.ok(p >= prev, `not monotonic at ${y}`); prev = p;
    assert.ok(Math.abs(axis.toYear(p) - y) <= 25, `${y} -> ${p} -> ${axis.toYear(p)}`);   // coarse early epochs: ~21 years per percent
  }
  assert.equal(axis.toPos(800), 0); assert.ok(axis.toPos(2026) > 99.9);
  assert.equal(axis.toYear(100), 2026);
});
check('the axis is by weight, not to scale: the 63-year Silver Sea is wider than the 858-year first epoch', () => {
  const w = (id) => data.epochs.find((e) => e.id === id).weight;
  assert.ok(w('silver-sea') > w('kings'));
  assert.ok(axis.toPos(1809) - axis.toPos(1747) > axis.toPos(1657) - axis.toPos(800));
});
check('markers follow Felix\'s flow (casual today, time warp to 1905, first jump ~1700)', () => {
  assert.deepEqual(data.markers.map((m) => [m.year, m.label]), [[1700, 'first jump lands'], [1905, 'time warp lands'], [2015, 'you start (casual)']]);
});
check('epoch, era, herring and lighthouse lookups', () => {
  assert.equal(epochAt(data.epochs, 1750).id, 'silver-sea');
  assert.equal(epochAt(data.epochs, 800).id, 'kings');
  assert.equal(epochAt(data.epochs, 2025).id, 'today');
  assert.equal(eraAt(data.eras, 1787).name, 'Honour and Life');
  assert.equal(herringAt(data.herringPeriods, 1750).from, 1747);
  assert.equal(herringAt(data.herringPeriods, 1850), null);
  assert.deepEqual(lighthousesStanding(data.lighthouseBuilt, 1781), { n: 0, of: 29 });
  assert.deepEqual(lighthousesStanding(data.lighthouseBuilt, 1782), { n: 1, of: 29 });
  assert.equal(lighthousesStanding(data.lighthouseBuilt, 2025).n, 29);
});
check('every kind used has a colour', () => {
  for (const r of [...data.epochs, ...data.eras]) assert.ok(KIND_COLOURS[r.kind], `${r.name}: kind ${r.kind}`);
});
check('Marstrand status: later, narrower entries override earlier ones', () => {
  const s = [{ from: 1, to: 100, label: 'wide' }, { from: 50, to: 60, label: 'narrow' }];
  assert.equal(marstrandAt(s, 55).label, 'narrow'); assert.equal(marstrandAt(s, 70).label, 'wide'); assert.equal(marstrandAt(s, 101), null);
});
check('describeYear gathers everything the info panel shows', () => {
  const d = describeYear(data, 1787);
  assert.equal(d.era.name, 'Honour and Life'); assert.equal(d.epoch.id, 'silver-sea');
  assert.ok(d.herring && d.lighthouses.n === 1);
  assert.ok(d.events.some((e) => e.year === 1787 && e.on) && d.events.some((e) => e.year === 1794 && !e.on));
});

// ---- the fact-check: nothing flagged "verify" may remain without a source, and the flags themselves are gone
check('no entry is still flagged "verify" or "(verify)" without being resolved', () => {
  const left = [];
  for (const p of data.herringPeriods) if (p.verify) left.push('herring ' + p.from);
  for (const r of data.eras) { if (r.verify) left.push('era ' + r.name); for (const ev of r.events || []) if (/\(verify\)/i.test(ev[1])) left.push('event ' + ev[0]); }
  assert.deepEqual(left, [], 'unresolved: ' + left.join(', '));
});
check('every source is an https URL; every era and herring period that was fact-checked cites at least one', () => {
  const urls = [];
  for (const p of data.herringPeriods) { for (const u of [].concat(p.source || [], p.sources || [])) urls.push(u); }
  for (const r of data.eras) { for (const u of r.sources || []) urls.push(u); for (const ev of r.events || []) if (ev[2]) urls.push(ev[2]); }
  for (const m of data.marstrandStatus || []) for (const u of [].concat(m.source || [])) urls.push(u);
  assert.ok(urls.length > 20, `${urls.length} urls`);
  for (const u of urls) assert.match(u, /^https:\/\//, u);
  for (const p of data.herringPeriods) assert.ok([].concat(p.source || [], p.sources || []).length > 0, 'herring ' + p.from + ' has no source');
  for (const name of ['Norse coast', 'Border wars', 'Motor and canning', 'Spirits at sea', 'Mines and neutrality', 'Leisure sailing']) {
    const r = data.eras.find((x) => x.name === name);
    assert.ok(r && (r.sources || []).length > 0, `${name} has no source`);
  }
});
check('events checked in the fact-check carry a source of their own', () => {
  const need = [[1308, /Bohus/], [1917, /ration|motbok|alcohol/i], [1960, /Tjörn/]];
  for (const [year, re] of need) {
    const ev = data.eras.flatMap((r) => r.events || []).find((e) => e[0] === year && re.test(e[1]));
    assert.ok(ev, `event ${year} missing`); assert.match(ev[2] || '', /^https:\/\//, `event ${year} has no source`);
  }
});

check('Marstrand status covers every year from 800 to 2026 with no gaps and every entry has a source', () => {
  const st = data.marstrandStatus;
  assert.equal(st[0].from, 800); assert.equal(st.at(-1).to, 2026);
  for (let i = 1; i < st.length; i++) assert.equal(st[i].from, st[i - 1].to + 1, st[i].label);
  for (const s of st) { assert.ok([].concat(s.source || []).length > 0, s.label + ' has no source'); for (const u of [].concat(s.source)) assert.match(u, /^https:\/\//); }
  assert.match(marstrandAt(st, 1700).label, /fortress/i); assert.equal(marstrandAt(st, 1780).label, 'Free port'); assert.match(marstrandAt(st, 1850).label, /bathing/i);
  assert.match(marstrandAt(st, 1500).label, /Norwegian/); assert.doesNotMatch(marstrandAt(st, 2000).label, /^Fortress town/);   // Carlsten was decommissioned in 1882
});
check('wording the fact-check found unsupported does not come back in a summary', () => {
  const text = data.eras.map((r) => r.summary).join(' | ');
  for (const bad of [/longships/i, /chieftains/i, /boats from occupied Norway/i, /feud/i, /fishing villages are first recorded/i]) assert.doesNotMatch(text, bad, String(bad));
  const sg = data.eras.find((r) => r.name === 'Summer guests');
  assert.match(sg.flavour, /feud/); assert.match(sg.flavour, /No source was found/);                // kept, but labelled as flavour
  assert.match(data.eras.find((r) => r.name === 'Leisure sailing').designNote, /design choice/);
  assert.match(data.eras.find((r) => r.name === 'Spirits at sea').designNote, /design choice/);
});

console.log(`\n${passed} passed`);
