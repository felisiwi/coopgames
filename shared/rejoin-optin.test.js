// node shared/rejoin-optin.test.js: which games opt in to guest rejoin ("rejoin": true in game.json), and that the
// hub's manifest carries the field. will-it-fit must stay OFF: its lockstep cannot resume mid-game (see
// docs/notes/KENNY-GUEST-REJOIN.md). To opt a game in later, add it to OPTED_IN here in the same change.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OPTED_IN = ['archipelago', 'dino-rumble', 'windward'];

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }

const read = (name) => JSON.parse(fs.readFileSync(path.join(root, 'games', name, 'game.json'), 'utf8'));
const games = fs.readdirSync(path.join(root, 'games'), { withFileTypes: true })
  .filter((e) => e.isDirectory() && fs.existsSync(path.join(root, 'games', e.name, 'game.json'))).map((e) => e.name);

check('every game.json that has a "rejoin" field has a real boolean', () => {
  for (const g of games) {
    const j = read(g);
    if ('rejoin' in j) assert.equal(typeof j.rejoin, 'boolean', `${g}: rejoin must be true or false`);
  }
});

check('exactly the agreed games opt in; will-it-fit does not', () => {
  const on = games.filter((g) => g !== '_template' && read(g).rejoin === true).sort();
  assert.deepEqual(on, OPTED_IN);
  assert.notEqual(read('will-it-fit').rejoin, true);
});

check('the template shows the field, switched off', () => {
  assert.equal(read('_template').rejoin, false);
});

check('the generated manifest carries "rejoin" through to the hub', () => {
  const out = execFileSync(process.execPath, [path.join(root, 'scripts', 'manifest.js')], { encoding: 'utf8' });
  assert.match(out, /wrote games\/manifest\.json/);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'games', 'manifest.json'), 'utf8'));
  const byId = Object.fromEntries(manifest.map((m) => [m.id, m]));
  for (const id of OPTED_IN) assert.equal(byId[id].rejoin, true, `${id} in the manifest`);
  assert.notEqual(byId['will-it-fit'].rejoin, true);
});

console.log(`\n${passed} checks passed`);
