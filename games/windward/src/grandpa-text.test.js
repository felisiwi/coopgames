// node games/windward/src/grandpa-text.test.js: the game's text says "Grandpa", never "Granddad" (Felix, 2026-11-06). Scans every string literal in the game's source for the word; code names
// (granddad as a variable, a property or an internal id such as kind: 'granddad') are fine, comments are fine, text a player can read is not.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const files = [root + 'game.js', ...readdirSync(root + 'src').filter((f) => f.endsWith('.js') && !f.endsWith('.test.js')).map((f) => root + 'src/' + f)];
const offenders = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  // strip comments (// to end of line, outside strings: good enough, the files use // comments after code, never // inside a string except URLs, which we skip by requiring a space or line start)
  const code = src.split('\n').map((l) => l.replace(/(^|\s)\/\/.*$/, '$1')).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of code.matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)) {
    const lit = m[0].slice(1, -1);
    if (/granddad/i.test(lit) && !/^granddad$/i.test(lit) && !/^\w*granddad\w*$/i.test(lit) && !/^[\w./-]+\.json$/.test(lit)) offenders.push(`${f.replace(root, '')}: ${lit.slice(0, 80)}`);
  }
}
let passed = 0;
assert.deepEqual(offenders, [], `"Granddad" in player-visible text:\n${offenders.join('\n')}`); passed += 1; console.log('ok - no string in the game says Granddad: it is Grandpa everywhere the player reads');
const chart = JSON.parse(readFileSync(root + 'data/granddad-chart.json', 'utf8'));
const visible = JSON.stringify({ ...chart, _about: undefined });
assert.ok(!/granddad/i.test(visible.replace(/"granddad[^"]*"\s*:/gi, '')), 'the chart data has no Granddad in a text field'); passed += 1; console.log('ok - the chart data\'s text fields do not say Granddad');
console.log(`\n${passed} checks passed`);
