import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeen } from './seen.js';
import { createExplored } from './explored.js';

const rect = { x0: 0, z0: 0, x1: 960, z1: 960 };
const fresh = () => createExplored(rect, { storage: null });
// an island: land within 100 m of (480, 480)
const land = (x, z) => (Math.hypot(x - 480, z - 480) < 100 ? 5 : -10);
const isle = { id: 'i', x: 480, z: 480, radius: 220 };

test('nothing is seen before the explored grid exists', () => {
  assert.equal(createSeen({ heightAt: land }).isSeen(isle), false);
});

test('a place in full fog is not seen', () => {
  const s = createSeen({ explored: fresh(), heightAt: land });
  assert.equal(s.isSeen(isle), false);
});

test('fog lifted only over open sea, away from the island, does not count', () => {
  const ex = fresh();
  ex.mark(480, 900); // 420 m south of the centre: the lifted fog never touches the island's land
  assert.equal(createSeen({ explored: ex, heightAt: land }).isSeen(isle), false);
});

test('lifting the fog over the shore (not the inland centre) sees a big island', () => {
  const ex = fresh();
  ex.mark(480, 680); // 200 m from the centre: the reveal (168 m) does not reach the centre, but does reach the shore
  assert.equal(ex.isExplored(480, 480), false);
  assert.equal(createSeen({ explored: ex, heightAt: land }).isSeen(isle), true);
});

test('a negative answer is re-checked after the fog changes, a positive one is kept', () => {
  const ex = fresh();
  const s = createSeen({ explored: ex, heightAt: land });
  assert.equal(s.isSeen(isle), false);
  assert.equal(s.isSeen(isle), false); // cached, same version
  ex.mark(480, 560);
  assert.equal(s.isSeen(isle), true);
  ex.reset?.();
  assert.equal(s.isSeen(isle), true); // seen for good (until setExplored)
});
