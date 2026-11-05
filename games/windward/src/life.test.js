// node games/windward/src/life.test.js — guards the small life (src/life.js): placement is deterministic and
// sits where the animal belongs (eiders over shallows, seals on low rocks, buoys on open water near harbours),
// eiders flee and seals dive from a close boat, and a real scene of it runs with no NaNs, few draw objects
// and gulls that land on buoys.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import {
  hash2, raftInCell, sealRockInCell, placeMarks, perchSpots, fleeOffset, sealDive, createLife,
  RAFT_CELL_M, FLEE_DIST_M, FLEE_MAX_M, SEAL_ALERT_M, LIFE,
} from './life.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

// A synthetic coast: open sea 5 m deep with a few low rocks and a big island to the east.
const rocks = [[400, 400], [1100, 700]];
const heightAt = (x, z) => {
  if (x > 2500) return 12;
  for (const [rx, rz] of rocks) if (Math.hypot(x - rx, z - rz) < 6) return 1.0;
  return -5;
};

check('hash2 is deterministic and in [0, 1)', () => {
  assert.equal(hash2(3, 4, 5), hash2(3, 4, 5));
  assert.notEqual(hash2(3, 4, 5), hash2(4, 3, 5));
  let min = 1; let max = 0;
  for (let i = 0; i < 2000; i++) { const h = hash2(i, i * 7, 1); min = Math.min(min, h); max = Math.max(max, h); }
  assert.ok(min >= 0 && max < 1 && min < 0.05 && max > 0.95, `range ${min}..${max}`);
});

check('eider rafts: deterministic, over 1.5-10 m of open water, about 40% of cells', () => {
  let rafts = 0;
  for (let ix = -20; ix < 20; ix++) {
    for (let iz = -20; iz < 20; iz++) {
      const r = raftInCell(ix, iz, heightAt);
      assert.deepEqual(r, raftInCell(ix, iz, heightAt));
      if (!r) continue;
      rafts++;
      assert.ok(heightAt(r.x, r.z) <= -1.5 && heightAt(r.x, r.z) >= -10);
      assert.equal(Math.floor(r.x / RAFT_CELL_M), ix, 'inside its own cell');
    }
  }
  assert.ok(rafts > 400 && rafts < 700, `${rafts} rafts of 1600 cells`);
  assert.equal(raftInCell(1, 1, () => 5), null, 'none on land');
  assert.equal(raftInCell(1, 1, () => -40), null, 'none over deep water (eiders feed over shallows)');
});

// Low rocks (4 m radius) at the middle of every 100 m cell, in 5 m deep sea.
const rockGrid = (x, z) => (Math.hypot(((x % 100) + 100) % 100 - 50, ((z % 100) + 100) % 100 - 50) < 4 ? 1.0 : -5);

check('seal rocks: found on low rocks only, in roughly a third of the cells, never on hillsides or open sea', () => {
  let found = 0;
  const N = 20;
  for (let ix = 0; ix < N; ix++) {
    for (let iz = 0; iz < N; iz++) {
      const r = sealRockInCell(ix, iz, rockGrid);
      assert.deepEqual(r, sealRockInCell(ix, iz, rockGrid), 'deterministic');
      if (!r) continue;
      found++;
      assert.ok(Math.hypot(r.x - (ix * 100 + 50), r.z - (iz * 100 + 50)) < 8, 'on the rock');
      assert.equal(r.y, 1.0);
      assert.ok(r.count >= 1 && r.count <= 3);
    }
  }
  assert.ok(found > N * N * 0.15 && found < N * N * 0.45, `${found} of ${N * N} cells`);
  for (let ix = 0; ix < 10; ix++) for (let iz = 0; iz < 10; iz++) {
    assert.equal(sealRockInCell(ix, iz, () => -4), null, 'open sea');
    assert.equal(sealRockInCell(ix, iz, () => 9), null, 'a hillside is not a seal rock');
    assert.equal(sealRockInCell(ix, iz, () => 1.0), null, 'a rock with no water about it');
  }
});

check('buoys: two per village / harbour, in water 2-10 m deep, 18-40 m away, apart from each other', () => {
  const places = [
    { id: 'village:A', kind: 'village', x: 1000, z: 1000 },
    { id: 'harbour:B', kind: 'harbour', x: 1500, z: 300 },
    { id: 'osm/1', kind: 'skerry', x: 100, z: 100 },
  ];
  const marks = placeMarks(places, heightAt);
  assert.deepEqual(marks, placeMarks(places, heightAt), 'deterministic');
  assert.equal(marks.length, 4, 'no marks for a skerry');
  for (const m of marks) {
    const p = places.find((q) => q.id === m.place);
    const d = Math.hypot(m.x - p.x, m.z - p.z);
    assert.ok(d >= 18 && d <= 40, `distance ${d}`);
    assert.ok(['red', 'green', 'yellow'].includes(m.kind));
  }
  assert.ok(Math.hypot(marks[0].x - marks[1].x, marks[0].z - marks[1].z) >= 8);
  assert.equal(placeMarks(places, () => 3).length, 0, 'none on land');
  const perches = perchSpots(marks, [{ x: 10, y: 4, z: 20 }]);
  assert.equal(perches.length, 5);
  assert.equal(perches.filter((p) => p.kind === 'light').length, 1);
});

check('an eider swims away from a close boat (capped), and drifts back when it is gone', () => {
  const [ox, oz] = fleeOffset(0, 0, 10, 0, 0, 0, 1); // boat 10 m west of the eider
  assert.ok(ox > 0 && Math.abs(oz) < 1e-9, 'moves away from the boat');
  let o = [0, 0];
  for (let i = 0; i < 600; i++) o = fleeOffset(o[0], o[1], 5 + o[0], 0, 0, 0, 0.1);
  assert.ok(Math.hypot(...o) <= FLEE_MAX_M + 1e-9, 'never further than FLEE_MAX_M');
  const far = fleeOffset(8, 0, 100, 0, 0, 0, 1);
  assert.ok(far[0] < 8 && far[0] > 0, 'drifts back toward the raft');
  assert.ok(FLEE_DIST_M > 10);
});

check('a seal dives quickly when the boat comes within 30 m, and comes back slowly', () => {
  let d = 0;
  d = sealDive(d, SEAL_ALERT_M - 5, 0.2);
  assert.ok(d > 0.3);
  for (let i = 0; i < 20; i++) d = sealDive(d, 10, 0.1);
  assert.equal(d, 1, 'fully dived');
  const up = sealDive(1, 100, 1);
  assert.ok(up > 0.8 && up < 1, 'surfacing takes several seconds');
  for (let i = 0; i < 100; i++) d = sealDive(d, 100, 0.1);
  assert.equal(d, 0);
});

check('a real scene of it: no NaNs, a handful of objects, gulls perch on buoys, one dinghy drifts', () => {
  const scene = new THREE.Scene();
  const places = [{ id: 'village:A', kind: 'village', x: 300, z: 300 }, { id: 'harbour:B', kind: 'harbour', x: 1300, z: 650 }];
  let cries = 0;
  const life = createLife({ THREE, scene, heightAt, seaY: () => 0.1, places, lights: [], onCry: () => { cries++; } });
  assert.equal(life.marks.length, 4);
  const meshes = scene.children.length;
  assert.ok(meshes <= 7, `${meshes} objects in the scene: 4 instanced kinds + gulls + dinghy`);
  const boat = { x: 300, z: 300, speed: 0 };
  for (let f = 0; f < 60 * 40; f++) {
    boat.x = 300 + Math.min(f, 200) * 0.05; // parked near the village's buoys
    life.update(boat, 1 / 60, f / 60);
    if (f === 60 * 38) {
      for (const child of scene.children) {
        if (child.isInstancedMesh) {
          for (let i = 0; i < child.count; i++) {
            const e = child.instanceMatrix.array.slice(i * 16, i * 16 + 16);
            assert.ok(e.every(Number.isFinite), 'finite matrix');
          }
        }
      }
    }
  }
  assert.ok(life.stats.gullsPerched >= 2, `${life.stats.gullsPerched} gulls perched on the buoys`);
  const dinghy = scene.children.find((c) => c.isGroup);
  assert.ok(dinghy.visible && Number.isFinite(dinghy.position.x), 'a drifting boat is out there');
  assert.ok(Math.hypot(dinghy.position.x - boat.x, dinghy.position.z - boat.z) < 270);
  assert.ok(cries >= 1, 'a gull cried');
});

check('gulls left behind by a jump are placed at the boat at once, and land on the buoys there', () => {
  const scene = new THREE.Scene();
  const places = [{ id: 'village:A', kind: 'village', x: 300, z: 300 }, { id: 'village:B', kind: 'village', x: 9000, z: 9000 }];
  const life = createLife({ THREE, scene, heightAt: (x, z) => (Math.hypot(x - 9000, z - 9000) < 6 ? 1 : -5), seaY: () => 0, places, onCry: () => {} });
  life.update({ x: 300, z: 300, speed: 0 }, 1 / 60, 0);
  for (let f = 0; f < 600; f++) life.update({ x: 9000 + (f % 2), z: 9085, speed: 0 }, 1 / 60, 1 + f / 60); // 12 km away, 85 m from the buoys (not close enough to scare them)
  assert.ok(life.stats.gullsPerched >= 2, `${life.stats.gullsPerched} gulls perched after 10 s at the new place`);
});

check('seals show on their rock, and dive when the boat sails up to it', () => {
  let rock = null; // the first cell of the grid that has seals, then a coast with just that one rock
  for (let ix = 0; ix < 20 && !rock; ix++) for (let iz = 0; iz < 20 && !rock; iz++) rock = sealRockInCell(ix, iz, rockGrid);
  const one = (x, z) => (Math.hypot(x - rock.x, z - rock.z) < 4 ? 1.0 : -5);
  const scene = new THREE.Scene();
  const life = createLife({ THREE, scene, heightAt: one, seaY: () => 0, places: [], onCry: () => {} });
  const far = { x: rock.x + 60, z: rock.z, speed: 0 };
  for (let f = 0; f < 120; f++) life.update(far, 1 / 60, f / 60);
  assert.equal(life.stats.seals, rock.count, `${rock.count} seals on the rock`);
  const at = { x: rock.x + 10, z: rock.z, speed: 3 };
  for (let f = 0; f < 240; f++) life.update(at, 1 / 60, 2 + f / 60);
  assert.equal(life.stats.seals, 0, 'all dived');
  for (let f = 0; f < 60 * 30; f++) life.update(far, 1 / 60, 6 + f / 60);
  assert.equal(life.stats.seals, rock.count, 'and surfaced again once the boat left');
});

console.log(`${passed} checks passed`);
