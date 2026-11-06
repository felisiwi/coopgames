// The real sea-marks in the game (stage 1d, batch 1): seamarks.json rows as 3D marks near the boat, plus what the chart and the
// minimap need to know about them. The mesh kit is src/seamark-meshes.js (the lab shows every variant).
//
// "Same look" rule (Felix, 2026-11-06): an invented harbour-mouth mark (invented: true) is built and drawn exactly like a real one
// in the game. Only the chart tells them apart, and only with ?debug=1 (showInvented). Nothing else here looks at `invented`.
//
// Marks are built lazily the first time the focus comes within RADIUS of them (226 meshes at once would be pointless), kept, and
// shown only while near: a handful of draw calls at a busy harbour.
//
// Night is not built yet. The hook is here: setNight(on) turns lit marks on (they blink their real rhythm), and
// wantsReflectorGlint(spec) says which marks should get a faint glint near the boat at night (unlit spar buoys: real ones carry
// reflectors). TODO(felix, night stage): draw that glint (a small additive sprite within ~40 m of the boat).
import * as THREE from '../vendor/three/three.module.js';
import { createSeamarkMesh } from './seamark-meshes.js';

export const MARK_RADIUS_M = 420; // marks this close to the focus are shown (game metres, the lab's value)
export const GLINT_RADIUS_M = 40; // the night glint of an unlit buoy reaches this far from the boat (hook only)
export const OSM_CREDIT_TEXT = '© OpenStreetMap contributors';

// What the chart and the minimap draw for a mark: a colour word and a shape. Pure.
export function markKind(spec) {
  switch (spec.type) {
    case 'lateral': return { colour: spec.side === 'port' ? 'red' : 'green', shape: spec.side === 'port' ? 'can' : 'cone' }; // IALA A: red cans to port, green cones to starboard
    case 'cardinal': return { colour: 'black', shape: 'cardinal', direction: spec.direction };
    case 'isolated_danger': return { colour: 'black', shape: 'danger' };
    case 'special': return { colour: 'yellow', shape: 'special' };
    case 'light': return { colour: 'light', shape: 'light' };
    default: return { colour: 'white', shape: 'dot' };
  }
}

// Unlit spar buoys carry radar reflectors: at night they would catch the boat's lantern. (hook, night is not built)
export const wantsReflectorGlint = (spec, night) => !!night && spec.form === 'buoy' && !(spec.lights && spec.lights.length);

// marks: seamarks.json `marks`. toGame(lon, lat) -> [x, z]. heightAt: for beacons on land.
export function createSeamarkLayer({ marks, toGame, heightAt, debug = false, night = false, radiusM = MARK_RADIUS_M }) {
  const group = new THREE.Group();
  group.name = 'seamarks';
  const items = marks.map((spec) => {
    const [x, z] = toGame(spec.lon, spec.lat);
    return { spec, x, z, m: null, ring: null, kind: markKind(spec) };
  });
  let isNight = !!night;
  let shown = 0;
  function build(it) {
    it.m = createSeamarkMesh(it.spec, { night: isNight });
    it.baseY = it.m.bobs ? 0 : Math.max(0, heightAt(it.x, it.z));
    it.m.group.position.set(it.x, it.baseY, it.z);
    group.add(it.m.group);
    if (debug && it.spec.invented) { // ?debug=1: a magenta ring on the invented marks (never in a normal game)
      it.ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.3, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3fb8, transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
      it.ring.position.set(it.x, 0.55, it.z);
      it.ring.renderOrder = 3;
      group.add(it.ring);
    }
  }
  return {
    group, items,
    get shown() { return shown; },
    get built() { return items.filter((i) => i.m).length; },
    // Every frame. focus: { x, z }; seaY(x, z): the real wave height for buoys.
    update(t, focus, seaY = null) {
      shown = 0;
      for (const it of items) {
        const near = Math.hypot(it.x - focus.x, it.z - focus.z) <= radiusM;
        if (near && !it.m) build(it);
        if (!it.m) continue;
        it.m.group.visible = near;
        if (it.ring) it.ring.visible = near;
        if (!near) continue;
        shown++;
        it.m.step(t, { seaY: it.m.bobs && seaY ? seaY(it.x, it.z) : null });
        if (!it.m.bobs) it.m.group.position.y = it.baseY;
      }
    },
    setNight(on) { isNight = !!on; for (const it of items) it.m?.setNight(isNight); },
    // buoys and beacons gulls may perch on: real positions only
    perchMarks() { return items.filter((i) => i.spec.type !== 'light').map((i) => ({ x: i.x, z: i.z, kind: i.kind.colour === 'red' ? 'red' : i.kind.colour === 'green' ? 'green' : 'yellow' })); },
    // what the minimap draws: lateral and special marks as coloured dots (cardinals / dangers are drawn black)
    minimapMarks() { return items.filter((i) => ['lateral', 'special', 'cardinal', 'isolated_danger'].includes(i.spec.type)).map((i) => ({ x: i.x, z: i.z, kind: i.kind.colour === 'black' ? 'black' : i.kind.colour })); },
    dispose() { for (const it of items) it.m?.dispose?.(); },
  };
}
