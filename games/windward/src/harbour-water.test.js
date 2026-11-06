// node games/windward/src/harbour-water.test.js: "inside the harbour" as a region (src/harbour-water.js) on a synthetic coast.
import assert from 'node:assert/strict';
import { createHarbourWater, canSail, HARBOUR_STEP_M } from './harbour-water.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }

// A synthetic coast, game metres, z grows southward. Open sea for z < 0; land for z >= 0 except an inlet: a channel `w` wide
// along x = 0 from z = 0 down to z = 70 with a basin at the bottom (z 60..80, x -20..20). The mouth gate sits at z = 0 and boats enter southward.
function coast(w = 6) {
  const blockedAt = (x, z) => {
    if (z < -0.01) return false; // open sea
    const inChannel = Math.abs(x) <= w / 2 && z <= 70;
    const inBasin = Math.abs(x) <= 20 && z >= 60 && z <= 80;
    return !(inChannel || inBasin);
  };
  // the boat's hull is a ring of radius 2.5 (shore.js): the centre needs free water 2.5 m all round
  return (x, z) => { if (blockedAt(x, z)) return true; for (let a = 0; a < 8; a++) if (blockedAt(x + Math.sin(a * 0.785) * 2.5, z + Math.cos(a * 0.785) * 2.5)) return true; return false; };
}
const quay = { x: 0, z: 78 };
const mouth = { x: 0, z: 0 };

check('the harbour water is the sailable water connected to the quay on the harbour side of the mouth, and it reaches the mouth', () => {
  const hw = createHarbourWater({ blocked: coast(10), quay, mouth, bearingDeg: 180 });
  assert.ok(hw && hw.cells > 200, `${hw && hw.cells} cells`);
  assert.equal(hw.reachedMouth, true);
  assert.equal(hw.contains(0, 40), true, 'mid-channel');
  assert.equal(hw.contains(10, 70), true, 'in the basin');
  assert.equal(hw.contains(0, 78 - 3), true, 'by the quay');
  assert.equal(hw.contains(0, -20), false, 'in the open sea outside the mouth: NOT the harbour');
  assert.equal(hw.contains(0, -2), false, 'just seaward of the gate: not yet');
  assert.equal(hw.contains(40, 30), false, 'on the land beside the channel');
  assert.equal(hw.contains(0, 2), true, 'just past the gate: in');
});

check('a channel only 6 m wide (a 1 m free band for the boat\'s centre) is still found, because the grid is fine enough', () => {
  assert.ok(HARBOUR_STEP_M <= 1.5, 'the grid step is fine');
  const blocked = coast(6);
  const free = []; for (let x = -4; x <= 4; x += 0.25) if (!blocked(x, 30)) free.push(x);
  assert.ok(free.length >= 3 && free.length <= 8, `the free band at z=30 is ${free.length * 0.25} m wide`);
  const hw = createHarbourWater({ blocked, quay, mouth, bearingDeg: 180 });
  assert.ok(hw && hw.cells > 60);
  assert.equal(hw.contains(0, 30), true, 'the boat on the centre line is inside');
  assert.equal(hw.reachedMouth, true);
  // a coarse 3 m grid steps over that band and loses the harbour: why the step is 1 m
  const coarse = createHarbourWater({ blocked, quay, mouth, bearingDeg: 180, step: 3 });
  assert.ok(!coarse || coarse.cells < hw.cells / 2, 'a 3 m grid would have missed most of it');
});

check('the entering bearing decides which side of the mouth is the harbour (any compass direction)', () => {
  const blocked = coast(10);
  const north = createHarbourWater({ blocked, quay, mouth, bearingDeg: 0 }); // entering NORTHward: the harbour would be z < 0 (the sea): the quay is on the wrong side
  assert.equal(north, null, 'the quay is not on the harbour side: no harbour');
  const south = createHarbourWater({ blocked, quay, mouth, bearingDeg: 180 });
  assert.ok(south);
});

check('a quay with no water near it gives no harbour; a sealed basin does not reach the mouth', () => {
  assert.equal(createHarbourWater({ blocked: () => true, quay, mouth, bearingDeg: 180 }), null);
  const sealed = (x, z) => !(Math.abs(x) <= 10 && z >= 20 && z <= 80); // a pond with no way out
  const hw = createHarbourWater({ blocked: sealed, quay, mouth, bearingDeg: 180 });
  assert.ok(hw && hw.cells > 100);
  assert.equal(hw.reachedMouth, false, 'a pond is not a harbour you can sail into');
});

check('canSail: the open sea to the quay is reachable through the inlet; blocking the channel makes it unreachable', () => {
  const open = coast(10);
  assert.equal(canSail(open, { x: 0, z: -60 }, { x: 0, z: 75 }, { step: 1, box: { x0: -60, x1: 60, z0: -100, z1: 100 } }).reachable, true);
  const plugged = (x, z) => (z >= 30 && z <= 34 ? true : open(x, z)); // a bar across the channel
  assert.equal(canSail(plugged, { x: 0, z: -60 }, { x: 0, z: 75 }, { step: 1, box: { x0: -60, x1: 60, z0: -100, z1: 100 } }).reachable, false);
});

console.log(`${passed} checks passed`);
