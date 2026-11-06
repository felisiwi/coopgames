import test from 'node:test';
import assert from 'node:assert/strict';
import { createNavTarget, formatDistance, edgeSpot, screenDirection, arriveDistance } from './nav-target.js';

const light = { id: 'light:A', kind: 'light', x: 100, z: 0 };

test('one target at a time: a new one replaces the old', () => {
  const n = createNavTarget();
  n.set(light);
  n.set({ id: 'x', kind: 'island', x: 1, z: 1 });
  assert.equal(n.entry.id, 'x');
  n.clear();
  assert.equal(n.entry, null);
});

test('arriving clears the target once and reports it', () => {
  const n = createNavTarget();
  n.set(light);
  assert.equal(n.update(0, 0), null);
  assert.equal(n.entry.id, 'light:A');
  assert.equal(n.update(100 - arriveDistance(light) + 1, 0).id, 'light:A');
  assert.equal(n.entry, null);
  assert.equal(n.update(100, 0), null);
});

test('distances read as the HUD does: metres, then km', () => {
  assert.equal(formatDistance(3), '5 m');
  assert.equal(formatDistance(47), '45 m');
  assert.equal(formatDistance(318), '320 m');
  assert.equal(formatDistance(1440), '1.4 km');
  assert.equal(formatDistance(NaN), '');
});

test('the edge spot lies on the inset border along the direction', () => {
  const [x, y] = edgeSpot(200, 400, 1, 0, 390, 844, 40, 20, 44);
  assert.equal(x, 350);
  assert.equal(y, 400);
  const [x2, y2] = edgeSpot(200, 400, 0, -1, 390, 844, 40, 20, 44);
  assert.equal(y2, 20);
  assert.equal(x2, 200);
  const [x3, y3] = edgeSpot(200, 400, 1, 1, 390, 844, 40, 20, 44); // diagonal: whichever edge comes first
  assert.ok(x3 <= 350 + 1e-9 && y3 <= 844 - 44 - 20 + 1e-9);
  assert.ok(Math.abs(x3 - 200 - (y3 - 400)) < 1e-6);
});

test('screen direction follows the camera axes, so a place behind the view still points the right way', () => {
  // a camera whose right axis is +x and whose up axis leans along +z on the ground (looking toward -z... up is "away")
  const right = [1, 0, 0];
  const up = [0, 0.8, -0.6];
  assert.deepEqual(screenDirection(10, 0, right, up).map((v) => +v.toFixed(6)), [10, 0]);
  const [dx, dy] = screenDirection(0, -10, right, up); // world -z is up the screen
  assert.equal(dx, 0);
  assert.ok(dy < 0);
});
