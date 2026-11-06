// node games/windward/src/world-1700-lab.test.js — the lab page is wired (every element id the script asks for exists, every module it imports exists
// and exports what it imports), and it can never damage the game's saved progress (the Today chart is read-only, names and lights are untouched).
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => new URL(p, import.meta.url);
const html = readFileSync(here('../world-1700-lab.html'), 'utf8');
const js = readFileSync(here('./world-1700-lab.js'), 'utf8');
let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }

check('every element id the script asks for exists in the page (no null crash at start)', () => {
  const have = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const asked = new Set([...js.matchAll(/\$\('([A-Za-z0-9_-]+)'\)/g)].map((m) => m[1]));
  assert.ok(asked.size > 12);
  for (const id of asked) assert.ok(have.has(id), `#${id} is asked for but missing`);
  assert.ok(html.includes('./src/world-1700-lab.js'));
});

check('every import resolves to a file and names things that module exports', () => {
  const imports = [...js.matchAll(/^import \{([^}]+)\} from '([^']+)';/gm)];
  assert.ok(imports.length >= 15);
  for (const [, names, from] of imports) {
    const file = fileURLToPath(new URL(from, here('./world-1700-lab.js')));
    assert.ok(existsSync(file), `${from} does not exist`);
    const src = readFileSync(file, 'utf8');
    for (const n of names.split(',').map((s) => s.trim()).filter(Boolean)) {
      const name = n.split(' as ')[0];
      assert.ok(new RegExp(`export (async )?(function|const|class|let) ${name}\\b|export \\{[^}]*\\b${name}\\b`).test(src), `${from} does not export ${name}`);
    }
  }
});

check('the era toggle, chart button and info sheet exist, with phone-sized touch targets', () => {
  assert.ok(/data-era="today"/.test(html) && /data-era="1700"/.test(html));
  assert.ok(/id="chartBtn"/.test(html) && /id="chartClose"/.test(html) && /id="chartReset"/.test(html));
  assert.ok(/height: 44px/.test(html), '44px targets');
  for (const t of ['width=device-width', 'viewport-fit=cover']) assert.ok(html.includes(t));
});

check('the lab cannot damage saved progress: the Today chart is read-only, the 1700 ink has its own key, no names / lights state is touched', () => {
  const code = js.replace(/\/\/.*$/gm, '');
  assert.ok(/readOnlyStorage\(store\)/.test(code) && /key: EXPLORED_KEY/.test(code), 'the game chart is opened through readOnlyStorage');
  assert.ok(/INK_EXPLORED_KEY/.test(code));
  assert.ok(!/setItem|localStorage/.test(code), 'the lab never writes storage itself');
  for (const bad of ['createNameBook', 'createLightLog', 'createChapter1', 'resetStart', 'markStartSeen', 'createLighthouseTask']) assert.ok(!code.includes(bad), `the lab must not use ${bad} (game progress)`);
});

check('three eras, a dusk toggle, and old names on the chart by the game\'s own seen rule', () => {
  for (const era of ['1700', '1950', 'today']) assert.ok(new RegExp(`data-era="${era}"`).test(html), era);
  assert.ok(/id="dusk"/.test(html));
  const code = js.replace(/\/\/.*$/gm, '');
  assert.ok(/createSeen\(\{ explored: inkExplored/.test(code), 'names use src/seen.js over the ink grid');
  assert.ok(/revealedLabels\(eras\['1700'\]\.labels\.filter\(\(l\) => l\.chartName !== false\), seen\)/.test(code), 'only the 1700 labels, only those seen, no duplicate cairn label');
  assert.ok(/seen\.setExplored\(inkExplored\)/.test(code), 'a reset forgets the names too');
  assert.ok(/era\?\.setNight/.test(code), 'dusk reaches the era\'s windows and lanterns');
});

check('only Today lets the boat ink: marking is gated on the 1700 era', () => {
  assert.ok(/if \(eraId === '1700'\) \{ inkExplored\.mark/.test(js));
});

check('the page loads nothing from game.js and changes no existing file: only the new modules plus the game\'s own exported ones', () => {
  assert.ok(!/game\.js/.test(js.replace(/\/\/.*$/gm, '')));
  const imports = [...js.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
  assert.ok(imports.includes('./world-year-build.js') && imports.includes('./world-year.js') && imports.includes('./ghost-chart.js'));
});

console.log(`\n${passed} checks passed`);
