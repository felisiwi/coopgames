// The busy coast: moving boats, the ferry, moored boats in the guest harbours and summer houses, DRIVEN BY AN ERA PROFILE (data/busy-eras.json),
// stamped from a KIT (src/busy-kits.js). The engine knows no boat type: the profile says which assets, how many, how fast, how full.
//
//   createBusyCoast({ world, profile, kit?, toGame, seaY, houses, night, clock }) -> { group, update, setNight, stats, dispose, ... }
//   world   data/busy-world.json (era-neutral geometry: routes, ferry crossing, berths)
//   profile one entry of data/busy-eras.json (profileForYear)
//   houses  [{ x, z, y, facing }] the cottages the village placer turned into summer houses (coast-world.js placeCoastVillages)
//
// Draw calls: FOUR meshes however many boats and houses.
//   static  solid + glass: every moored boat and summer house, stamped once in world coordinates.
//   dynamic solid + glass: every moving boat and the ferry, re-written into one buffer each frame (a few thousand vertices), so ten boats
//           cost the same as one. Only boats within RENDER_RADIUS_M of the viewer are written.
// Windows are the only emissive thing: unlit vertex colours that turn warm in setNight(true) (no new lights, so no shader recompiles).
//
// Motion is a function of the wall clock (src/busy-route.js), so two players see the same traffic with no messages. Boats give way to the
// players you pass in update(): they hold still while a player is in their way (stepYield).
import * as THREE from '../vendor/three/three.module.js';
import { CONFIG } from './config.js';
import { Mesher } from './era-assets.js';
import { getKit, buildAsset } from './busy-kits.js';
import { makeRoute, makeSchedule, makeLoopSchedule, vesselPose, mustYield, stepYield } from './busy-route.js';
import { vesselFor, berthBoat, berthsToFill, boatsFor, frac } from './busy-era.js';
import { mulberry32, ambientPathAdaptive, ambientAt, ambientDone } from './busy-ambient.js';

export const RENDER_RADIUS_M = 480; // moving boats further than this from the viewer are not written (and not drawn)
const SOLID = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
const col = (hex) => new THREE.Color(hex);

// Stamp one asset into fresh meshers and keep the raw arrays (a template: moved and merged per frame, or read once for the static mesh).
function template(kit, assetId, opts) {
  const A = kit.assets[assetId];
  if (!A) throw new Error(`busy-coast: kit "${kit.id}" has no asset "${assetId}"`);
  const S = new Mesher(), G = { on: new Mesher(), off: new Mesher() };
  S.peers = [G.on, G.off];
  const look = buildAsset(kit, assetId, opts, S, G); // the boat's look is drawn from opts.seed (src/boat-looks.js)
  const nOn = G.on.pos.length / 3, nOff = G.off.pos.length / 3;
  return {
    assetId, opts, look, halfLen: A.halfLen ? A.halfLen(opts) : 6, solidPos: Float32Array.from(S.pos), solidCol: Float32Array.from(S.col),
    glassPos: Float32Array.from([...G.on.pos, ...G.off.pos]), nOn, nOff, triangles: S.triangles + G.on.triangles + G.off.triangles,
  };
}
// Window colours for a glass buffer of nOn lit-capable then nOff unlit-capable vertices.
function glassColours(nOn, nOff, glass, night, out = new Float32Array((nOn + nOff) * 3)) {
  const day = col(glass.day), lit = col(glass.lit), off = col(glass.off);
  for (let i = 0; i < nOn + nOff; i++) {
    const c = night ? (i < nOn ? lit : off) : day;
    out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b;
  }
  return out;
}
const geometryOf = (pos, colr, dynamic = false) => {
  const g = new THREE.BufferGeometry();
  const p = new THREE.BufferAttribute(pos, 3), c = new THREE.BufferAttribute(colr, 3);
  if (dynamic) { p.setUsage(THREE.DynamicDrawUsage); c.setUsage(THREE.DynamicDrawUsage); }
  g.setAttribute('position', p); g.setAttribute('color', c);
  return g;
};

// blocked(x, z): true where a boat's centre cannot be (shore.js isBlocked on the game's collision): the ambient boats use it to stay in water. Without it there are none.
export function createBusyCoast({ world, profile, kit = null, toGame, seaY, houses = [], night = false, clock = () => Date.now() / 1000, blocked = null, seed = 0x5ea }) {
  kit = kit ?? getKit(profile.kit);
  if (!kit) throw new Error(`busy-coast: kit "${profile.kit}" is not registered`);
  const group = new THREE.Group();
  group.name = `busy-coast-${profile.id}`;
  let isNight = !!night;

  // ---- static: moored boats and summer houses, stamped into one mesher pair in world coordinates -------------------------------
  const S = new Mesher(), G = { on: new Mesher(), off: new Mesher() };
  S.peers = [G.on, G.off];
  const stampAt = (assetId, opts, place) => { S.at(place, () => buildAsset(kit, assetId, opts, S, G)); };
  let moored = 0;
  for (const m of world.moorings) {
    const n = m.berths.length, take = berthsToFill(profile, n);
    for (const b of m.berths.slice(0, take)) {
      const [x, z] = toGame(b.lon, b.lat);
      const boat = berthBoat(profile.moorings.classes[b.class], b);
      stampAt(boat.asset, { L: boat.L, stripe: boat.stripe, sailsUp: false, lod: true, lit: boat.lit, seed: boat.seed, role: boat.role }, { p: [x, 0, z], ry: b.heading });
      if (b.how === 'buoy' && kit.buoy != null) { const d = boat.L / 2 + 1.6; S.drum(x + Math.sin(b.heading) * d, -0.15, z + Math.cos(b.heading) * d, 0.35, 0.6, 5, kit.buoy); } // the kit's mooring buoy colour
      moored++;
    }
  }
  const hp = profile.houses;
  houses.forEach((h, i) => {
    const colour = hp.colours[Math.floor(frac((i * 0.6180339887) % 1, 7) * hp.colours.length)];
    stampAt(hp.asset, { colour, lit: frac((i * 0.6180339887) % 1, 8) < (hp.litShare ?? 0.5) }, { p: [h.x, Math.max(0, h.y ?? 0), h.z], ry: h.facing, s: hp.scale ?? 1 });
  });
  const nOn = G.on.pos.length / 3, nOff = G.off.pos.length / 3;
  const solidMesh = new THREE.Mesh(geometryOf(Float32Array.from(S.pos), Float32Array.from(S.col)), SOLID);
  solidMesh.geometry.computeVertexNormals(); solidMesh.geometry.computeBoundingSphere();
  solidMesh.castShadow = true; solidMesh.receiveShadow = true; solidMesh.name = 'busy-static';
  const staticGlassCol = new Float32Array((nOn + nOff) * 3);
  const glassMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const glassMesh = new THREE.Mesh(geometryOf(Float32Array.from([...G.on.pos, ...G.off.pos]), glassColours(nOn, nOff, kit.glass, isNight, staticGlassCol)), glassMat);
  glassMesh.geometry.computeBoundingSphere(); glassMesh.name = 'busy-static-windows';
  group.add(solidMesh);
  if (nOn + nOff) group.add(glassMesh);
  const staticTriangles = S.triangles + G.on.triangles + G.off.triangles;

  // ---- dynamic: traffic and the ferry -----------------------------------------------------------------------------------------
  const vessels = [];
  const addVessel = (o) => vessels.push({ ...o, lag: 0, pose: null, visible: false });
  const stopsOf = (route) => [0, route.length];
  for (const b of boatsFor(profile, world)) { // boat k of n on a route; a loop route (cruising, fishing) never stops, a line route goes between its two harbours
    const r = b.route, v = vesselFor(profile.traffic.classes[r.class], b.seed), loop = r.shape === 'loop';
    const route = makeRoute(r.route.map(([lon, lat]) => toGame(lon, lat)), { loop });
    const sched = loop ? makeLoopSchedule({ lengthM: route.length, speed: v.speed }) : makeSchedule({ stopsAtM: stopsOf(route), speed: v.speed, dwellS: v.dwellS });
    const tmpl = template(kit, v.asset, { L: v.L, stripe: v.stripe, sailsUp: true, lit: true, seed: v.seed, role: v.role });
    addVessel({ id: `${r.id}#${b.k}`, kind: 'traffic', route, sched, tmpl, halfLen: tmpl.halfLen, phase: ((b.k + frac(r.seed, 9)) / b.n) * sched.cycleS, tilt: 1 }); // the n boats of a route are spread evenly round its cycle
  }
  if (profile.ferry.enabled) {
    const f = world.ferry;
    const route = makeRoute(f.route.map(([lon, lat]) => toGame(lon, lat)));
    const sched = makeSchedule({ stopsAtM: f.stops.map((s) => s.atM), speed: profile.ferry.speed, dwellS: profile.ferry.dwellS });
    const fa = kit.assets[profile.ferry.asset];
    const tmpl = template(kit, profile.ferry.asset, { lit: true, scale: fa.nativeLength ? profile.ferry.lengthM / fa.nativeLength : 1 }); // the era sets the ferry's length (a play scale: ~1.75 x the player's boat)
    addVessel({ id: 'ferry-847', kind: 'ferry', route, sched, tmpl, halfLen: tmpl.halfLen, phase: 0, tilt: 0.4 });
  }
  // Ambient boats: a small pool that always sails past the viewer (src/busy-ambient.js). The era says how many and how sail / motor they are.
  const ambientCfg = profile.traffic.ambient;
  const rand = mulberry32(seed);
  const avoidPts = [];
  for (const m of world.moorings) for (const b of m.berths.slice(0, berthsToFill(profile, m.berths.length))) avoidPts.push(toGame(b.lon, b.lat));
  for (const st of world.ferry.stops) avoidPts.push(toGame(st.dock[0], st.dock[1]));
  if (ambientCfg && ambientCfg.count > 0 && blocked) {
    for (let i = 0; i < ambientCfg.count; i++) {
      const cls = rand() < (ambientCfg.mix?.sail ?? 0.7) ? 'sail' : 'motor', sd = (0.137 + i * 0.6180339887) % 1;
      const v = vesselFor(profile.traffic.classes[cls], sd);
      const tmpl = template(kit, v.asset, { L: v.L, stripe: v.stripe, sailsUp: true, lit: true, seed: v.seed, role: v.role });
      addVessel({ id: `ambient#${i}`, kind: 'ambient', cls, tmpl, halfLen: tmpl.halfLen, speed: v.speed, path: null, s: 0, nextTry: 0, tilt: 1 });
    }
  }
  let capSolid = 0, capGlass = 0;
  for (const v of vessels) { capSolid += v.tmpl.solidPos.length; capGlass += v.tmpl.glassPos.length; }
  const dynSolidPos = new Float32Array(capSolid), dynSolidCol = new Float32Array(capSolid);
  const dynGlassPos = new Float32Array(capGlass);
  let dynGlassCol = new Float32Array(capGlass);
  for (const v of vessels) { v.glassCol = [glassColours(v.tmpl.nOn, v.tmpl.nOff, kit.glass, false), glassColours(v.tmpl.nOn, v.tmpl.nOff, kit.glass, true)]; }
  const dynSolid = new THREE.Mesh(geometryOf(dynSolidPos, dynSolidCol, true), SOLID);
  const dynGlass = new THREE.Mesh(geometryOf(dynGlassPos, dynGlassCol, true), glassMat);
  for (const m of [dynSolid, dynGlass]) { m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; m.geometry.setDrawRange(0, 0); }
  dynSolid.name = 'busy-moving'; dynGlass.name = 'busy-moving-windows';
  if (vessels.length) group.add(dynSolid, dynGlass);
  const mat = new THREE.Matrix4(), quat = new THREE.Quaternion(), eul = new THREE.Euler(), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

  // ---- per frame --------------------------------------------------------------------------------------------------------------
  let boatsVisible = 0, dynamicTriangles = 0, lastT = null;
  function update(dt, viewer, others = []) {
    const t = clock();
    const eps = CONFIG.BOAT_TILT_GRADIENT_EPS, max = CONFIG.BOAT_TILT_MAX, gain = CONFIG.BOAT_TILT_GAIN;
    let sv = 0, gv = 0;
    boatsVisible = 0; dynamicTriangles = 0;
    for (const v of vessels) {
      let pose;
      if (v.kind === 'ambient') { // a boat on its own straight leg past the viewer; it respawns when done (at most one try per boat per half second)
        if (!v.path || ambientDone(v.path, v.s, viewer, ambientCfg.despawnM)) {
          if (t >= v.nextTry) {
            v.nextTry = t + 0.5;
            const path = ambientPathAdaptive(rand, viewer, { freeAt: (x, z) => !blocked(x, z), avoid: avoidPts, ring: ambientCfg.ring, legM: ambientCfg.legM, lateral: ambientCfg.lateral });
            v.path = path; v.s = path ? (v.fresh === undefined ? rand() * path.len * 0.45 : 0) : 0; v.fresh = false;
          }
          if (!v.path) { v.pose = null; v.visible = false; continue; }
        }
        const at = ambientAt(v.path, v.s);
        pose = { x: at.x, z: at.z, heading: at.heading, speed: v.speed, moving: true };
        if (!mustYield(pose, v.halfLen, others)) v.s += v.speed * dt; // holds still while a player is in its way
      } else {
        pose = vesselPose(v.route, v.sched, t + v.phase - v.lag);
        stepYield(v, dt, mustYield(pose, v.halfLen, others), v.sched.cycleS);
        pose = vesselPose(v.route, v.sched, t + v.phase - v.lag);
      }
      v.pose = pose;
      v.visible = Math.hypot(pose.x - viewer.x, pose.z - viewer.z) <= RENDER_RADIUS_M;
      if (!v.visible) continue;
      boatsVisible++;
      const fx = Math.sin(pose.heading), fz = Math.cos(pose.heading), y = seaY(pose.x, pose.z);
      const slopeF = (seaY(pose.x + fx * eps, pose.z + fz * eps) - y) / eps, slopeR = (seaY(pose.x + fz * eps, pose.z - fx * eps) - y) / eps;
      eul.set(clamp(-slopeF * gain, -max, max) * v.tilt, pose.heading, clamp(slopeR * gain, -max, max) * v.tilt, 'XYZ');
      quat.setFromEuler(eul); pos.set(pose.x, y, pose.z); mat.compose(pos, quat, one);
      const e = mat.elements, T = v.tmpl;
      for (let i = 0; i < T.solidPos.length; i += 3) {
        const x = T.solidPos[i], yy = T.solidPos[i + 1], zz = T.solidPos[i + 2];
        dynSolidPos[sv + i] = e[0] * x + e[4] * yy + e[8] * zz + e[12];
        dynSolidPos[sv + i + 1] = e[1] * x + e[5] * yy + e[9] * zz + e[13];
        dynSolidPos[sv + i + 2] = e[2] * x + e[6] * yy + e[10] * zz + e[14];
      }
      dynSolidCol.set(T.solidCol, sv); sv += T.solidPos.length;
      for (let i = 0; i < T.glassPos.length; i += 3) {
        const x = T.glassPos[i], yy = T.glassPos[i + 1], zz = T.glassPos[i + 2];
        dynGlassPos[gv + i] = e[0] * x + e[4] * yy + e[8] * zz + e[12];
        dynGlassPos[gv + i + 1] = e[1] * x + e[5] * yy + e[9] * zz + e[13];
        dynGlassPos[gv + i + 2] = e[2] * x + e[6] * yy + e[10] * zz + e[14];
      }
      dynGlassCol.set(v.glassCol[isNight ? 1 : 0], gv); gv += T.glassPos.length;
      dynamicTriangles += T.triangles;
    }
    dynSolid.geometry.setDrawRange(0, sv / 3); dynGlass.geometry.setDrawRange(0, gv / 3);
    for (const g of [dynSolid.geometry, dynGlass.geometry]) { g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; }
    lastT = t;
  }

  function setNight(on) {
    isNight = !!on;
    glassColours(nOn, nOff, kit.glass, isNight, staticGlassCol);
    glassMesh.geometry.attributes.color.needsUpdate = true;
  }

  const stats = () => ({
    profile: profile.id, kit: kit.id, placeholderKit: !!profile.placeholderKit,
    meshes: group.children.length, moored, houses: houses.length, vessels: vessels.length, boatsVisible, ambient: vessels.filter((v) => v.kind === 'ambient' && v.pose).length,
    staticTriangles, dynamicTriangles, ferry: vessels.find((v) => v.kind === 'ferry')?.pose ?? null, night: isNight, clock: lastT,
  });
  const dispose = () => { group.traverse((o) => o.geometry?.dispose()); glassMat.dispose(); };
  return { group, update, setNight, stats, dispose, vessels, profile, kit };
}
