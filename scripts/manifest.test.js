// node scripts/manifest.test.js: the manifest builder respects the optional `hidden` flag in game.json (default false).
// Runs a copy of manifest.js inside a throwaway tree, so the real games/manifest.json is never touched.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-test-'));
fs.mkdirSync(path.join(tmp, 'scripts'));
fs.copyFileSync(path.join(here, 'manifest.js'), path.join(tmp, 'scripts', 'manifest.js'));
const game = (name, extra) => {
  fs.mkdirSync(path.join(tmp, 'games', name), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'games', name, 'game.json'), JSON.stringify({ id: name, name, description: 'd', players: { min: 1, max: 2 }, ...extra }));
};
game('plain', {});                 // no field: visible (every existing game)
game('explicit-false', { hidden: false });
game('hidden-one', { hidden: true });
game('not-boolean', { hidden: 'true' }); // only a real boolean true hides; a stray string must not silently remove a game

execFileSync(process.execPath, [path.join(tmp, 'scripts', 'manifest.js')], { stdio: 'pipe' });
const ids = JSON.parse(fs.readFileSync(path.join(tmp, 'games', 'manifest.json'), 'utf8')).map((g) => g.id);
assert.deepEqual(ids, ['explicit-false', 'not-boolean', 'plain']);
fs.rmSync(tmp, { recursive: true, force: true });
console.log('manifest: hidden flag respected');
