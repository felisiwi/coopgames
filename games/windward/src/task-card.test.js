// node games/windward/src/task-card.test.js: the 1950 Task card (src/story-1950.js taskCardLines): in EVERY phase a what-and-why description first, the progress line last.
import assert from 'node:assert/strict';
import { taskCardLines, TASK_WHY, OBJECTIVES } from './story-1950.js';
import { PHASES } from './beats-1950.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }

// the keys game.js uses: the beats phases before 'free', then the task phases (src/task-1950.js)
const KEYS = [...PHASES.filter((p) => p !== 'free'), 'gas', 'lights', 'keeper', 'report', 'done'];

check('every phase has a description (non-empty, one or two lines) and no phase is missing from TASK_WHY', () => {
  for (const k of KEYS) {
    assert.ok(Array.isArray(TASK_WHY[k]) && TASK_WHY[k].length >= 1 && TASK_WHY[k].length <= 2, `${k}: one or two lines`);
    for (const line of TASK_WHY[k]) assert.ok(typeof line === 'string' && line.trim().length > 10, `${k}: a real sentence`);
  }
  assert.deepEqual(Object.keys(TASK_WHY).sort(), [...KEYS].sort(), 'exactly the phases the game has');
});

check('each phase: description first, the progress line last, nothing else but the nearest dark light in the lights phase', () => {
  for (const k of KEYS) {
    const progress = k in OBJECTIVES ? OBJECTIVES[k].now : `progress for ${k}`;
    const lines = taskCardLines(k, progress, 'Hättan');
    assert.equal(lines[lines.length - 1], progress, `${k}: progress is last`);
    assert.deepEqual(lines.slice(0, TASK_WHY[k].length), TASK_WHY[k], `${k}: what and why come first`);
    assert.ok(lines.length > 1, `${k}: more than the bare status line (the bug)`);
  }
});

check('the lights phase names the nearest dark light between the description and the progress; other phases never do', () => {
  const lines = taskCardLines('lights', 'Lights restored: 0 of 4', 'Hättan');
  assert.deepEqual(lines, [...TASK_WHY.lights, 'Nearest dark light: Hättan.', 'Lights restored: 0 of 4']);
  assert.deepEqual(taskCardLines('lights', 'Lights restored: 4 of 4', null), [...TASK_WHY.lights, 'Lights restored: 4 of 4'], 'none dark: no name line');
  for (const k of KEYS.filter((x) => x !== 'lights')) assert.ok(!taskCardLines(k, 'p', 'Hättan').some((l) => /Nearest dark/.test(l)), k);
});

console.log(`\n${passed} checks passed`);
