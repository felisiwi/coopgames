// Small life on today's coast (stage 1b): gulls (flying, and perched on buoys and sea marks), eiders, harbour
// seals on low rocks, a drifting small boat. Nothing modern, nothing that breaks the cosy mood, and cheap:
//   - one InstancedMesh per kind (a handful of draw calls in total, a few hundred triangles),
//   - only near the boat (cells within ~200 m, a dozen gulls that follow the boat), nothing stored,
//   - placement is a pure function of a hash of the world cell, so it is the same for both players and testable.
// THREE is only used in createLife(); everything above it is plain maths.

// ---- pure: hashing and placement ---------------------------------------------------------------------------------

export function hash2(ix, iz, salt = 0) {
  let h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iz | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export const RAFT_CELL_M = 150;
export const RAFT_CHANCE = 0.4;
export const RAFT_SIZE = 4; // eiders per raft
// A raft of eiders in this cell, or null: on sea 1.5-10 m deep (eiders feed over shallows), with open water round it.
export function raftInCell(ix, iz, heightAt) {
  if (hash2(ix, iz, 1) > RAFT_CHANCE) return null;
  const x = (ix + 0.2 + 0.6 * hash2(ix, iz, 2)) * RAFT_CELL_M;
  const z = (iz + 0.2 + 0.6 * hash2(ix, iz, 3)) * RAFT_CELL_M;
  const h = heightAt(x, z);
  if (h > -1.5 || h < -10) return null;
  for (const [dx, dz] of [[14, 0], [-14, 0], [0, 14], [0, -14]]) if (heightAt(x + dx, z + dz) > -0.8) return null;
  return { x, z, key: `${ix},${iz}` };
}

export const SEAL_CELL_M = 100;
export const SEAL_CHANCE = 0.3;
const SEAL_GRID_M = 5;
// A low rock for seals in this cell, or null. Scans the cell on a 5 m grid for ground 0.25-1.6 m above the sea
// with water about it (a skerry or a shore ledge, not a hillside) and takes one of the rockiest (most water
// around); which one, and whether this cell has seals at all, comes from the cell's hash. Cached by the caller.
export function sealRockInCell(ix, iz, heightAt) {
  if (hash2(ix, iz, 11) > SEAL_CHANCE) return null;
  let best = 0;
  let spots = [];
  for (let a = 0; a < SEAL_CELL_M; a += SEAL_GRID_M) {
    for (let b = 0; b < SEAL_CELL_M; b += SEAL_GRID_M) {
      const x = ix * SEAL_CELL_M + a;
      const z = iz * SEAL_CELL_M + b;
      const h = heightAt(x, z);
      if (h < 0.25 || h > 1.6) continue;
      let wet = 0;
      for (const [dx, dz] of [[6, 0], [-6, 0], [0, 6], [0, -6]]) if (heightAt(x + dx, z + dz) < 0) wet++;
      if (wet < 2) continue;
      if (wet > best) { best = wet; spots = []; }
      if (wet === best) spots.push({ x, z, y: h });
    }
  }
  if (!spots.length) return null;
  const pick = spots[Math.floor(hash2(ix, iz, 12) * spots.length)];
  return { ...pick, count: 1 + Math.floor(hash2(ix, iz, 70) * 3), key: `${ix},${iz}` };
}

export const MARKS_PER_PLACE = 2;
// Buoys and sea marks near each village / harbour (where the boat will be anyway): on open water 2-10 m deep,
// 18-40 m from the place. Deterministic; red / green / yellow as west-coast marks are.
export function placeMarks(places, heightAt, inside = () => true) {
  const marks = [];
  const KINDS = ['red', 'green', 'yellow'];
  for (const p of places) {
    if (p.kind !== 'village' && p.kind !== 'harbour') continue;
    const seed = Math.round(p.x) * 31 + Math.round(p.z);
    for (let m = 0; m < MARKS_PER_PLACE; m++) {
      for (let a = 0; a < 24; a++) {
        const ang = hash2(seed, m * 100 + a, 5) * Math.PI * 2;
        const r = 18 + hash2(seed, m * 100 + a, 6) * 22;
        const x = p.x + Math.sin(ang) * r;
        const z = p.z + Math.cos(ang) * r;
        const h = heightAt(x, z);
        if (h < -2 && h > -10 && inside(x, z) && !marks.some((o) => Math.hypot(o.x - x, o.z - z) < 8)) {
          marks.push({ x, z, kind: KINDS[Math.floor(hash2(seed, m, 7) * 3)], place: p.id });
          break;
        }
      }
    }
  }
  return marks;
}

// Where gulls may perch: a buoy's top, or a lighthouse's rock. { x, z, y (above the sea at rest), kind }
export function perchSpots(marks, lights = []) {
  return [
    ...marks.map((m) => ({ x: m.x, z: m.z, y: 1.35, kind: 'mark' })),
    ...lights.map((l) => ({ x: l.x + 2.2, z: l.z + 1.2, y: l.y + 0.5, kind: 'light', onLand: true })),
  ];
}

// An eider that the boat is close to swims away from it: returns the new offset from the raft centre.
export const FLEE_DIST_M = 28;
export const FLEE_MAX_M = 16;
export function fleeOffset(offX, offZ, memberX, memberZ, boatX, boatZ, dt) {
  const dx = memberX - boatX;
  const dz = memberZ - boatZ;
  const d = Math.hypot(dx, dz) || 1;
  if (d < FLEE_DIST_M) {
    const speed = 3.5 * (1 - d / FLEE_DIST_M) + 0.4;
    const nx = offX + (dx / d) * speed * dt;
    const nz = offZ + (dz / d) * speed * dt;
    const len = Math.hypot(nx, nz);
    return len > FLEE_MAX_M ? [(nx / len) * FLEE_MAX_M, (nz / len) * FLEE_MAX_M] : [nx, nz];
  }
  // calm again: drift back toward the raft centre
  const k = Math.max(0, 1 - 0.25 * dt);
  return [offX * k, offZ * k];
}

// How far a seal has slid into the water (0 = resting, 1 = gone) given the boat's distance.
export const SEAL_ALERT_M = 30;
export function sealDive(current, boatDist, dt) {
  const target = boatDist < SEAL_ALERT_M ? 1 : 0;
  const rate = target === 1 ? 2.2 : 0.15; // dives quickly, comes back slowly
  return current + Math.sign(target - current) * Math.min(Math.abs(target - current), rate * dt);
}

// ---- THREE: the animals --------------------------------------------------------------------------------------------

export const LIFE = {
  gulls: 12,
  perchRangeM: 130, // buoys / lighthouses this close to the boat get gulls
  perchScareM: 12, // a gull on a perch flies off when the boat is this close
  catchUpM: 250, // a gull this far from the boat snaps to it (the boat jumped); normal sailing never gets here
  nearM: 200, // cells within this of the boat are alive
  maxEiders: RAFT_SIZE * 8,
  maxSeals: 12,
  cryEveryS: [9, 24], // an ambient gull cry, now and then (quiet)
};

// Merge a few geometries into one non-indexed geometry (so a duck or a seal is one instance).
export function merge(THREE, parts) {
  const pos = [];
  for (const g of parts) {
    const ng = g.index ? g.toNonIndexed() : g;
    pos.push(...ng.getAttribute('position').array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.computeVertexNormals();
  return out;
}

export function ellipsoid(THREE, sx, sy, sz, x = 0, y = 0, z = 0) {
  const g = new THREE.SphereGeometry(1, 7, 5);
  g.scale(sx, sy, sz);
  g.translate(x, y, z);
  return g;
}

// opts: { THREE, scene, heightAt, seaY(x, z), places (name list), lights: [{x, y, z}], inside(x, z), onCry() }
export function createLife({ THREE, scene, heightAt, seaY, places, lights = [], inside = () => true, onCry = () => {} }) {
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const lambert = () => new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, side: THREE.DoubleSide });
  const instanced = (geo, max) => {
    const m = new THREE.InstancedMesh(geo, lambert(), max);
    m.frustumCulled = false; // instances move; the geometry's own bounds say nothing about where they are
    m.count = 0;
    scene.add(m);
    return m;
  };
  const put = (mesh, i, x, y, z, ry, sx, sy, sz, rz = 0, rx = 0) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(rx, ry, rz);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  };

  // -- sea marks (buoys): fixed, found once at load; gulls perch on them
  const marks = placeMarks(places, heightAt, inside);
  const markGeo = new THREE.ConeGeometry(0.45, 1.5, 6);
  markGeo.translate(0, 0.45, 0);
  const markMesh = instanced(markGeo, Math.max(1, marks.length));
  const MARK_COLORS = { red: 0xb5524a, green: 0x4f8f6a, yellow: 0xd6b04c };
  marks.forEach((m, i) => markMesh.setColorAt(i, color.set(MARK_COLORS[m.kind])));
  markMesh.count = marks.length;
  const perches = perchSpots(marks, lights);

  // -- gulls: a V-shaped wing pair; flapping = scaling Y (the wingtips rise and fall)
  const wing = new THREE.BufferGeometry();
  wing.setAttribute('position', new THREE.Float32BufferAttribute([
    0.1, 0, 0.3, 1.2, 0.5, -0.15, 0.1, 0, -0.3, // right wing
    -0.1, 0, 0.3, -0.1, 0, -0.3, -1.2, 0.5, -0.15, // left wing
    0, 0.05, 0.6, -0.13, 0, -0.4, 0.13, 0, -0.4, // body
  ], 3));
  wing.computeVertexNormals();
  const gullMesh = instanced(wing, LIFE.gulls);
  gullMesh.count = LIFE.gulls;
  const GULL_SCALE = 1.5;
  const gulls = Array.from({ length: LIFE.gulls }, (_, i) => ({
    x: 0, z: 0, y: 14, heading: hash2(i, 1, 90) * 6.28, perch: -1, scaredUntil: 0, placed: false,
    phase: hash2(i, 2, 90) * 6.28, orbitR: 25 + hash2(i, 3, 90) * 40, orbitW: 0.25 + hash2(i, 4, 90) * 0.25 * (i % 2 ? 1 : -1),
    alt: 10 + hash2(i, 5, 90) * 12, offX: (hash2(i, 6, 90) - 0.5) * 80, offZ: (hash2(i, 7, 90) - 0.5) * 80,
    flapHz: 2.6 + hash2(i, 8, 90) * 1.4,
  }));
  for (let i = 0; i < gulls.length; i++) gullMesh.setColorAt(i, color.set(i % 3 === 0 ? 0xcfd3d6 : 0xf3f0e8));

  // -- eiders (drake white / duck brown) on rafts; one instance each
  const eiderGeo = merge(THREE, [ellipsoid(THREE, 0.32, 0.22, 0.55, 0, 0.12, 0), ellipsoid(THREE, 0.16, 0.16, 0.2, 0, 0.36, 0.5)]);
  const eiderMesh = instanced(eiderGeo, LIFE.maxEiders);
  const rafts = new Map(); // key -> { x, z, members: [{ offX, offZ, ang, w, tint }] } or { none: true, x, z } (an empty cell)

  // -- seals on low rocks
  const sealGeo = merge(THREE, [ellipsoid(THREE, 0.38, 0.3, 1.0, 0, 0.18, 0), ellipsoid(THREE, 0.26, 0.24, 0.3, 0, 0.42, 0.95)]);
  const sealMesh = instanced(sealGeo, LIFE.maxSeals);
  const rocks = new Map(); // key -> rock | null
  const seals = []; // { rock, id, dx, dz, rot, st: { dive } }
  const sealState = new Map(); // "cell#n" -> { dive }: kept so a seal stays dived while you are close

  // -- the drifting small boat
  const dinghy = new THREE.Group();
  const hullMat = new THREE.MeshLambertMaterial({ color: 0x7f9db3, flatShading: true });
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.36, 0.45, 8), hullMat);
  hull.scale.set(1, 1, 2.7);
  hull.rotation.x = 0;
  hull.position.y = 0.2;
  const inside_ = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.3, 0.1, 8), new THREE.MeshLambertMaterial({ color: 0xe9e2d0, flatShading: true }));
  inside_.scale.set(1, 1, 2.5);
  inside_.position.y = 0.43;
  const fisher = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.7, 6), new THREE.MeshLambertMaterial({ color: 0xd2a94a, flatShading: true }));
  fisher.position.set(0, 0.8, -0.1);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 6, 5), new THREE.MeshLambertMaterial({ color: 0xe0b894, flatShading: true }));
  head.position.set(0, 1.28, -0.1);
  dinghy.add(hull, inside_, fisher, head);
  dinghy.visible = false;
  scene.add(dinghy);
  const boat = { x: 0, z: 0, heading: 0, serial: 0, active: false, bob: 0 };
  function spawnDinghy(bx, bz) {
    for (let n = 0; n < 12; n++) {
      boat.serial += 1;
      const ang = hash2(boat.serial, 3, 200) * Math.PI * 2;
      const r = 90 + hash2(boat.serial, 4, 200) * 80;
      const x = bx + Math.sin(ang) * r;
      const z = bz + Math.cos(ang) * r;
      if (heightAt(x, z) < -3 && inside(x, z)) {
        boat.x = x; boat.z = z; boat.heading = hash2(boat.serial, 5, 200) * 6.28; boat.active = true;
        return;
      }
    }
    boat.active = false;
  }

  let perchTick = 0;
  let nearPerches = [];
  let cryAt = 6;
  let cellTick = 0;
  const stats = { gullsPerched: 0, eiders: 0, seals: 0, marks: marks.length };

  function updateCells(bx, bz) {
    const near = LIFE.nearM;
    // eider rafts
    for (let ix = Math.floor((bx - near) / RAFT_CELL_M); ix <= Math.floor((bx + near) / RAFT_CELL_M); ix++) {
      for (let iz = Math.floor((bz - near) / RAFT_CELL_M); iz <= Math.floor((bz + near) / RAFT_CELL_M); iz++) {
        const key = `${ix},${iz}`;
        if (rafts.has(key)) continue;
        const r = raftInCell(ix, iz, heightAt);
        if (!r || !inside(r.x, r.z)) { rafts.set(key, { none: true, x: (ix + 0.5) * RAFT_CELL_M, z: (iz + 0.5) * RAFT_CELL_M }); continue; }
        rafts.set(key, {
          ...r,
          members: Array.from({ length: RAFT_SIZE }, (_, k) => ({
            offX: (hash2(ix, iz, 300 + k) - 0.5) * 7, offZ: (hash2(ix, iz, 320 + k) - 0.5) * 7,
            ang: hash2(ix, iz, 340 + k) * 6.28, w: (hash2(ix, iz, 360 + k) - 0.5) * 0.2, tint: k === 0 ? 0xefebe0 : (k === 1 ? 0xe3dfd2 : 0x8d7459),
          })),
        });
      }
    }
    for (const [k, r] of rafts) if (Math.hypot(r.x - bx, r.z - bz) > near * 2) rafts.delete(k); // forget far cells
    // seal rocks
    seals.length = 0;
    for (let ix = Math.floor((bx - near) / SEAL_CELL_M); ix <= Math.floor((bx + near) / SEAL_CELL_M); ix++) {
      for (let iz = Math.floor((bz - near) / SEAL_CELL_M); iz <= Math.floor((bz + near) / SEAL_CELL_M); iz++) {
        const key = `${ix},${iz}`;
        if (!rocks.has(key)) { const r = sealRockInCell(ix, iz, heightAt); rocks.set(key, r && inside(r.x, r.z) ? r : null); }
        const rock = rocks.get(key);
        if (!rock || Math.hypot(rock.x - bx, rock.z - bz) > near) continue;
        for (let s = 0; s < rock.count && seals.length < LIFE.maxSeals; s++) {
          const prev = sealState.get(`${key}#${s}`) || { dive: 0 };
          sealState.set(`${key}#${s}`, prev);
          seals.push({ rock, id: `${key}#${s}`, dx: (s - (rock.count - 1) / 2) * 1.5, dz: (hash2(ix, iz, 80 + s) - 0.5) * 1.2, rot: hash2(ix, iz, 90 + s) * 6.28, st: prev });
        }
      }
    }
  }

  return {
    marks, perches, stats,
    // boat: { x, z, speed }. Call once a frame.
    update(boatPos, dt, nowS) {
      const bx = boatPos.x;
      const bz = boatPos.z;
      if (cellTick-- <= 0) { cellTick = 20; updateCells(bx, bz); } // ~3 times a second

      // marks float
      for (let i = 0; i < marks.length; i++) put(markMesh, i, marks[i].x, seaY(marks[i].x, marks[i].z) + 0.15, marks[i].z, 0, 1, 1, 1, Math.sin(nowS * 1.3 + i) * 0.06);
      markMesh.instanceMatrix.needsUpdate = true;

      // gulls
      if (perchTick-- <= 0) {
        perchTick = 30;
        nearPerches = [];
        perches.forEach((p, idx) => { if (Math.hypot(p.x - bx, p.z - bz) < LIFE.perchRangeM) nearPerches.push(idx); });
      }
      stats.gullsPerched = 0;
      gulls.forEach((g, i) => {
        // a perch for this gull: the i-th near perch that is free (the first gulls take the perches)
        let target = -1;
        if (i < nearPerches.length && nowS >= g.scaredUntil) {
          const idx = nearPerches[i];
          const p = perches[idx];
          if (Math.hypot(p.x - bx, p.z - bz) > LIFE.perchScareM) target = idx;
          else g.scaredUntil = nowS + 10;
        }
        let tx, ty, tz;
        if (target >= 0) {
          const p = perches[target];
          tx = p.x; tz = p.z; ty = (p.onLand ? 0 : seaY(p.x, p.z)) + p.y;
        } else {
          const a = nowS * g.orbitW + g.phase;
          tx = bx + g.offX + Math.sin(a) * g.orbitR;
          tz = bz + g.offZ + Math.cos(a) * g.orbitR;
          ty = g.alt + Math.sin(nowS * 0.7 + g.phase) * 1.5;
        }
        // first frame, or the boat jumped far away (reconnect, a test teleport): the gull is placed at once, not flown over
        if (!g.placed || Math.hypot(g.x - bx, g.z - bz) > LIFE.catchUpM) { g.x = tx; g.z = tz; g.y = ty; g.placed = true; }
        const dx = tx - g.x;
        const dz = tz - g.z;
        const dy = ty - g.y;
        const dist = Math.hypot(dx, dz, dy);
        const perched = target >= 0 && dist < 0.4;
        if (perched) {
          g.x = tx; g.y = ty; g.z = tz;
          stats.gullsPerched++;
          put(gullMesh, i, g.x, g.y, g.z, g.heading, 0.28 * GULL_SCALE, 0.12 * GULL_SCALE, GULL_SCALE * 0.8);
        } else {
          const speed = Math.min(14, dist * 0.8 + 6);
          const step = Math.min(dist, speed * dt);
          if (dist > 0.001) { g.x += (dx / dist) * step; g.z += (dz / dist) * step; g.y += (dy / dist) * step; }
          if (Math.hypot(dx, dz) > 0.5) g.heading = Math.atan2(dx, dz);
          // flap, with glides in between
          const glide = 0.5 + 0.5 * Math.sin(nowS * 0.45 + g.phase * 3);
          const flap = Math.sin(nowS * g.flapHz * 6.283 + g.phase) * (glide > 0.55 ? 0.15 : 0.9) + 0.1;
          put(gullMesh, i, g.x, g.y, g.z, g.heading, GULL_SCALE, GULL_SCALE * flap, GULL_SCALE, Math.sin(nowS * 0.5 + g.phase) * 0.15);
        }
      });
      gullMesh.instanceMatrix.needsUpdate = true;

      // an ambient gull cry now and then
      if (nowS >= cryAt) {
        cryAt = nowS + LIFE.cryEveryS[0] + hash2(Math.floor(nowS), 9, 400) * (LIFE.cryEveryS[1] - LIFE.cryEveryS[0]);
        onCry();
      }

      // eiders
      let n = 0;
      for (const r of rafts.values()) {
        if (r.none || Math.hypot(r.x - bx, r.z - bz) > LIFE.nearM) continue;
        for (const m of r.members) {
          if (n >= LIFE.maxEiders) break;
          const cx = r.x + m.offX + Math.sin(nowS * 0.1 + m.ang) * 1.5;
          const cz = r.z + m.offZ + Math.cos(nowS * 0.12 + m.ang) * 1.5;
          [m.offX, m.offZ] = fleeOffset(m.offX, m.offZ, cx, cz, bx, bz, dt);
          const fleeing = Math.hypot(cx - bx, cz - bz) < FLEE_DIST_M;
          const heading = fleeing ? Math.atan2(cx - bx, cz - bz) : m.ang + nowS * m.w;
          put(eiderMesh, n, cx, seaY(cx, cz) + 0.02, cz, heading, 1, 1, 1);
          eiderMesh.setColorAt(n, color.set(m.tint));
          n++;
        }
      }
      eiderMesh.count = n;
      eiderMesh.instanceMatrix.needsUpdate = true;
      if (eiderMesh.instanceColor) eiderMesh.instanceColor.needsUpdate = true;
      stats.eiders = n;

      // seals
      let sn = 0;
      for (const s of seals) {
        s.st.dive = sealDive(s.st.dive, Math.hypot(s.rock.x - bx, s.rock.z - bz), dt);
        const open = 1 - s.st.dive;
        if (open < 0.02) continue;
        put(sealMesh, sn, s.rock.x + s.dx, s.rock.y - 0.35 * s.st.dive, s.rock.z + s.dz, s.rot, open, open, open, 0, -0.1);
        sealMesh.setColorAt(sn, color.set(sn % 2 ? 0x8f949a : 0x7b8087));
        sn++;
      }
      sealMesh.count = sn;
      sealMesh.instanceMatrix.needsUpdate = true;
      if (sealMesh.instanceColor) sealMesh.instanceColor.needsUpdate = true;
      stats.seals = sn;

      // the drifting boat: a slow wander, respawned when far away
      if (!boat.active || Math.hypot(boat.x - bx, boat.z - bz) > 260) spawnDinghy(bx, bz);
      if (boat.active) {
        boat.heading += Math.sin(nowS * 0.07 + boat.serial) * 0.04 * dt;
        const nx = boat.x + Math.sin(boat.heading) * 0.35 * dt;
        const nz = boat.z + Math.cos(boat.heading) * 0.35 * dt;
        if (heightAt(nx, nz) < -1.5) { boat.x = nx; boat.z = nz; } else boat.heading += 1.2; // turn away from the shore
        dinghy.visible = true;
        dinghy.position.set(boat.x, seaY(boat.x, boat.z), boat.z);
        dinghy.rotation.set(Math.sin(nowS * 0.9 + boat.serial) * 0.05, boat.heading, Math.sin(nowS * 0.7) * 0.06);
      } else dinghy.visible = false;
    },
  };
}
