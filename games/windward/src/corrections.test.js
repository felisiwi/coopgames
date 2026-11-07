// node games/windward/src/corrections.test.js: the research corrections of 2026-11-07 (docs/CORRECTIONS-TODO.md) stay applied in the light data, and the rewind (which uses build years) is untouched by them.
import assert from 'node:assert/strict';
import { LIGHTHOUSES } from './lighthouses.js';
import { FYRKURAR_1950, KRAKSUNDSGAP_1950, LIGHT_1950 } from './lights-1950.js';
import { layoutRow } from './rewind.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }
const light = (name) => LIGHTHOUSES.find((l) => l.name === name);

check('Stångehuvud: dark since 1940 (fyr.org, stangehuvud.se), not "the 1990s"; its build year is unchanged', () => {
  const s = light('Stångehuvud');
  assert.equal(s.lit, false); assert.match(s.lightNote, /^Dark since 1940/); assert.equal(s.built, 1890);
});

check('Fredagsholmen: a light here since 1883 (the AGA year 1917 is not the first light); the 1942 fyrkur is still its build year', () => {
  const f = FYRKURAR_1950.fredagsholmen;
  assert.equal(f.station, 1883); assert.equal(f.built, 1942); assert.match(f.description, /1883/); assert.match(f.description, /AGA light since 1917/);
});

check('Islandsberg: the old light sat behind upper-floor gable windows, not on the ridge; still dark since 1938, still built 1883', () => {
  const i = light('Islandsberg');
  assert.match(i.description, /row of windows on the upper floor of the seaward gable/); assert.match(i.description, /not a lantern on the ridge/);
  assert.equal(i.built, 1883); assert.equal(i.lit, false); assert.match(i.lightNote, /Dark since 1938/);
});

check('Kråksundsgap: manned 1890-1911, then an automatic light; Måseskär: white LIGHT, red-and-white TOWER', () => {
  assert.match(KRAKSUNDSGAP_1950.description, /manned 1890 to 1911/); assert.match(KRAKSUNDSGAP_1950.description, /automatic AGA light from 1911/);
  assert.match(LIGHT_1950['Måseskär'].note, /LIGHT was white/); assert.match(LIGHT_1950['Måseskär'].note, /TOWER was red and white/);
});

check('the rewind is unaffected: it orders by build year and these lights keep theirs', () => {
  const row = layoutRow(LIGHTHOUSES);
  const built = row.map((r) => r.built);
  assert.deepEqual(built, [...built].sort((a, b) => a - b), 'oldest first');
  const at = (n) => row.find((r) => r.name === n).built;
  assert.equal(at('Islandsberg'), 1883); assert.equal(at('Stångehuvud'), 1890); assert.equal(at('Gäven'), 1941);
});

console.log(`\n${passed} checks passed`);
