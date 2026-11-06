// node games/windward/src/game-imports.test.js: smoke test: game.js (the entry point) loads. Every `import { name } from` in it must name something the module really exports; a bad one is
// a blank page in the browser with nothing to look at, so it is checked here in a second (it was missed once: a mangled import after an edit).
import assert from 'node:assert/strict';

let passed = 0;
const mod = await import('../game.js');
assert.equal(typeof mod.default, 'function', 'game.js default-exports start()'); passed += 1;
console.log('ok - game.js and everything it imports load, and it exports start()');
console.log(`\n${passed} checks passed`);
