// node games/windward/src/landmark-lab.test.js — the Landmark Lab's pure parts: address parameters round-trip, the shelf shows what stood in an era, the layout does not overlap,
// and the page is wired (no localStorage, loads its module, has the era and dusk controls).
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { LAB_DEFAULTS, LAB_ERAS, parseLabParams, labParamsToSearch, shelfEntries, layoutShelf } from './landmark-lab-params.js';
import { ALL_VARIANTS, LANDMARK_TYPES } from './landmark-assets.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }

check('defaults parse from an empty address and write back as an empty address', () => {
  assert.deepEqual(parseLabParams(''), LAB_DEFAULTS);
  assert.equal(labParamsToSearch('', LAB_DEFAULTS), '');
});
check('parameters round-trip, junk is ignored, other parameters are kept', () => {
  const S = parseLabParams('?era=today&type=cairn&night=1&zoom=1.5&rs=1&panel=1&era2=x');
  assert.equal(S.era, 'today'); assert.equal(S.type, 'cairn'); assert.equal(S.night, 1); assert.equal(S.zoom, 1.5); assert.equal(S.rs, 1);
  const back = labParamsToSearch('?panel=1&other=7', S);
  assert.ok(back.includes('panel=1') && back.includes('other=7') && back.includes('era=today') && back.includes('rs=1'), back);
  assert.equal(parseLabParams('?era=bogus&type=nope&zoom=abc&mode=x').era, '1950');
  assert.equal(parseLabParams('?zoom=999').zoom, 3, 'zoom is clamped');
  assert.equal(parseLabParams('?v=gaven-1835').type, 'polemark', 'a variant implies its type');
});
check('from the boat: the read scale is on by default and survives a round trip; cameras and views parse; there is no all-eras coast', () => {
  const B = parseLabParams('?mode=boat&view=bonden&cam=speed&era=all');
  assert.equal(B.mode, 'boat'); assert.equal(B.rs, 1, 'read scale on from the boat'); assert.equal(B.view, 'bonden'); assert.equal(B.cam, 'speed'); assert.equal(B.era, '1950', 'no "all" from the boat');
  assert.equal(parseLabParams('?mode=boat&rs=0').rs, 0);
  const off = labParamsToSearch('', { ...parseLabParams('?mode=boat'), rs: 0 });
  assert.equal(parseLabParams(off).rs, 0, 'rs=0 from the boat is written to the address, not lost: ' + off);
  assert.equal(labParamsToSearch('', parseLabParams('?mode=boat')), '?mode=boat', 'the boat defaults write only the mode');
  assert.equal(parseLabParams('?lm=0').lm, 0); assert.equal(parseLabParams('?cam=weather').cam, 'weather'); assert.equal(parseLabParams('?cam=nope').cam, 'game');
});
check('the shelf for an era holds exactly the variants that stood then', () => {
  for (const era of ['1703', '1950', 'today']) {
    const keys = shelfEntries({ era }).filter((e) => !e.opts || Object.keys(e.opts).length === 0).map((e) => e.key).sort();
    const want = ALL_VARIANTS.filter((v) => v.eras.includes(era)).map((v) => `${v.type}/${v.variant}`).sort();
    assert.deepEqual(keys, want, `shelf ${era}`);
  }
  assert.ok(!shelfEntries({ era: '1950' }).some((e) => e.variant === 'gaven-1835'), 'the 1835 pole mark stood in none of our eras');
  assert.ok(shelfEntries({ era: 'all' }).some((e) => e.variant === 'gaven-1835'), 'but it is on the all-eras shelf');
  assert.ok(!shelfEntries({ era: '1703' }).some((e) => e.type === 'windmill'), 'no windmill in 1703');
});
check('the shelf has no entry for an era a variant does not list, and every type has something on the all-eras shelf', () => {
  const all = shelfEntries({ era: 'all' });
  for (const t of Object.keys(LANDMARK_TYPES)) assert.ok(all.some((e) => e.type === t), `type ${t} on the all shelf`);
  assert.equal(all.filter((e) => !e.opts || !Object.keys(e.opts).length).length, ALL_VARIANTS.length);
});
check('the layout puts every entry in its own cell: no two cells overlap', () => {
  for (const era of LAB_ERAS) {
    const lay = layoutShelf(shelfEntries({ era }), { perRow: 3 });
    const items = lay.items;
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      const dx = Math.abs(a.x - b.x), dz = Math.abs(a.z - b.z);
      assert.ok(dx >= (a.cell + b.cell) / 2 - 1e-6 || dz >= ((LANDMARK_TYPES[a.type].variants[a.variant]?.frame ?? LANDMARK_TYPES[a.type].frame) + (LANDMARK_TYPES[b.type].variants[b.variant]?.frame ?? LANDMARK_TYPES[b.type].frame)) / 2 * 0.99, `${a.key} and ${b.key} overlap on the ${era} shelf`);
    }
  }
});
check('the lab page is wired: its module, an era switch, a dusk switch, no localStorage anywhere', () => {
  assert.ok(existsSync(new URL('../landmark-lab.html', import.meta.url)), 'landmark-lab.html exists');
  const html = readFileSync(new URL('../landmark-lab.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('./landmark-lab.js', import.meta.url), 'utf8');
  assert.ok(html.includes('./src/landmark-lab.js') && html.includes('id="dusk"') && html.includes('id="eras"'));
  for (const src of [html, js, readFileSync(new URL('./landmark-lab-params.js', import.meta.url), 'utf8'), readFileSync(new URL('./landmark-assets.js', import.meta.url), 'utf8')]) assert.ok(!/localStorage|sessionStorage|indexedDB/.test(src), 'no browser storage');
});
console.log(`\n${passed} checks passed`);
