// The harbour moment (stage 1b): someone on the shore waves, tosses a fish that lands on the deck, a bell rings
// (src/audio.js). The fish stay on the deck in a few visible slots, kept on this device (src/deck.js).
// No dialogue UI: the whole thing is a small gesture. THREE lives here; the rules are in arrival.js / deck.js.
import { merge, ellipsoid } from './life.js';

export const MOMENT_S = 9; // the person stays this long
export const TOSS_AT_S = 1.8; // and tosses the fish this long after the bell
// Chosen to read against the varnished-wood deck (0xb58a5a) from the camera above: not browns.
export const FISH_COLORS = { mackerel: 0x2f7d95, herring: 0xe6eef2, cod: 0x8fb08a, flounder: 0xe7d8b0 };
// Where fish lie on the deck, in boat-local metres (+Z is the bow, the cockpit is aft of the mast).
// Where fish lie, in boat-local metres (+Z is the bow), per boat. Koster (src/boats.js, deck at y ~ 0.5): clear of its crate (0, 2.1),
// barrel (0.4, -0.25), chest (0, -2.7), the stern lantern's light pool and the boom. Eka: on the floorboards between its items.
export const DECK_SLOTS = {
  koster: [[-0.7, 0.52, -1.3], [0.85, 0.52, -1.6], [-0.7, 0.52, 0.9], [0.85, 0.52, 0.9]],
  eka: [[-0.3, 0.16, 1.2], [0.3, 0.16, 1.2], [-0.3, 0.16, -0.6], [0.3, 0.16, -0.6]],
};
export const DECK_SLOTS_LOCAL = DECK_SLOTS.koster;
const FISH_SCALE = 1.7; // fish are exaggerated like everything else here (a boat is 6 m, a cottage 10 m): readable from the camera
const PERSON_SCALE = 1.8;

// The land point nearest the boat that a person could stand on (a quay or shore rock), or null.
// Searches rings round the boat 6-60 m out, dry ground 0.8 m or more above the sea.
export function shorePointNear(heightAt, x, z, { from = 6, to = 60, minH = 0.8 } = {}) {
  for (let r = from; r <= to; r += 3) {
    const steps = Math.max(8, Math.round((2 * Math.PI * r) / 4));
    for (let k = 0; k < steps; k++) {
      const a = (k / steps) * 2 * Math.PI;
      const px = x + Math.sin(a) * r;
      const pz = z + Math.cos(a) * r;
      const h = heightAt(px, pz);
      if (h >= minH) return { x: px, z: pz, y: Math.max(0, h), distM: r };
    }
  }
  return null;
}

// Fish position along its throw: a straight line with an arc on top. t in 0..1.
export function tossPosition(from, to, t, arcM = 3) {
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t + 4 * arcM * t * (1 - t), z: from.z + (to.z - from.z) * t };
}

export function createHarbourMoment({ THREE, scene, boatGroup, heightAt, deck, audio, boatType = 'koster' }) {
  const SLOTS = DECK_SLOTS[boatType] || DECK_SLOTS.koster;
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });

  // the person on the shore
  const person = new THREE.Group();
  const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.95, 6), mat(0xd2a94a)); // oilskin
  coat.position.y = 0.48;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 6, 5), mat(0xe0b894));
  head.position.y = 1.12;
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.19, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x2f4a62));
  hat.position.y = 1.18;
  const armPivot = new THREE.Group();
  armPivot.position.set(0.24, 0.92, 0);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.1), mat(0xd2a94a));
  arm.position.y = 0.27;
  armPivot.add(arm);
  const handLocal = new THREE.Vector3(0.24, 1.55, 0);
  person.add(coat, head, hat, armPivot);
  person.scale.setScalar(PERSON_SCALE);
  person.visible = false;
  scene.add(person);

  // fish: a body and a tail, in one geometry
  const fishGeo = merge(THREE, [
    ellipsoid(THREE, 0.1, 0.075, 0.34),
    (() => { const g = new THREE.ConeGeometry(0.09, 0.2, 4); g.rotateX(-Math.PI / 2); g.translate(0, 0, -0.42); return g; })(),
  ]);
  const makeFish = (kind) => {
    const m = new THREE.Mesh(fishGeo, mat(FISH_COLORS[kind] || 0x8899aa));
    if (kind === 'flounder') m.scale.set(1.6, 0.4, 0.85); // flat
    m.scale.multiplyScalar(FISH_SCALE);
    return m;
  };

  // fish lying on the deck, one per slot, riding with the boat
  const slots = SLOTS.map(([x, y, z], i) => {
    const holder = new THREE.Group();
    holder.position.set(x, y, z);
    holder.rotation.y = (i % 2 ? 0.3 : -0.3) + i * 0.15; // each lies a little differently
    boatGroup.add(holder);
    return { holder, kind: null, mesh: null };
  });
  function renderDeck() {
    deck.fish.forEach((f, i) => {
      const s = slots[i];
      const kind = f ? f.kind : null;
      if (kind === s.kind) return;
      if (s.mesh) { s.holder.remove(s.mesh); s.mesh = null; }
      s.kind = kind;
      if (kind) { s.mesh = makeFish(kind); s.mesh.position.y = 0.1; s.holder.add(s.mesh); }
    });
  }
  renderDeck();

  let momentAt = -Infinity;
  let tossed = true;
  let pending = null; // { gift, slot } waiting to be thrown
  let spot = null; // where the person stands
  const flying = []; // { mesh, from, slot, startS, dur }
  const stats = { personShown: false, flying: 0, moments: 0 };
  const tmp = new THREE.Vector3();

  return {
    stats,
    renderDeck,
    // place: the arrived-at name-list entry; gift: { kind, from } (arrival.giftFor); boat: { x, z }
    trigger(place, gift, boat, nowS) {
      stats.moments++;
      audio.arrival(place.kind);
      spot = shorePointNear(heightAt, boat.x, boat.z) || shorePointNear(heightAt, place.x, place.z, { from: 0, to: 70 });
      momentAt = nowS;
      tossed = false;
      pending = { gift, slot: deck.add(gift) }; // stored now; shown on the deck when it lands
      if (spot) {
        person.position.set(spot.x, spot.y, spot.z);
        person.rotation.y = Math.atan2(boat.x - spot.x, boat.z - spot.z); // faces the boat
      }
    },
    update(dt, nowS) {
      const age = nowS - momentAt;
      const on = !!spot && age >= 0 && age < MOMENT_S;
      person.visible = on;
      stats.personShown = on;
      if (on) {
        const pop = Math.min(1, age / 0.35) * Math.min(1, (MOMENT_S - age) / 0.5);
        person.scale.setScalar(PERSON_SCALE * Math.max(0.001, pop));
        armPivot.rotation.z = Math.PI * 0.8 + Math.sin(age * 7.5) * 0.45; // arm up, waving
      }
      if (!tossed && pending && age >= TOSS_AT_S) {
        tossed = true;
        const from = spot ? { x: spot.x, y: spot.y + handLocal.y * PERSON_SCALE, z: spot.z } : { x: boatGroup.position.x + 6, y: 4, z: boatGroup.position.z + 6 };
        const mesh = makeFish(pending.gift.kind);
        scene.add(mesh);
        const slotWorld = boatGroup.localToWorld(tmp.set(...SLOTS[pending.slot]));
        const dist = Math.hypot(slotWorld.x - from.x, slotWorld.z - from.z);
        flying.push({ mesh, from, slot: pending.slot, startS: nowS, dur: Math.min(2.2, Math.max(0.8, dist / 10)) });
        pending = null;
      }
      for (let i = flying.length - 1; i >= 0; i--) {
        const f = flying[i];
        const t = (nowS - f.startS) / f.dur;
        const target = boatGroup.localToWorld(tmp.set(...SLOTS[f.slot]));
        if (t >= 1) {
          scene.remove(f.mesh);
          flying.splice(i, 1);
          renderDeck();
          audio.plop();
          continue;
        }
        const p = tossPosition(f.from, target, t);
        f.mesh.position.set(p.x, p.y, p.z);
        f.mesh.rotation.set(t * 9, Math.atan2(target.x - f.from.x, target.z - f.from.z), 0); // tumbling through the air
      }
      stats.flying = flying.length;
    },
  };
}
