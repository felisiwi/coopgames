// Harbour arrival (stage 1b): sailing SLOWLY into a village or a natural harbour triggers a small moment
// (bell, gulls, a wave, a fish on deck). Pure logic, no THREE and no audio, so it is testable headlessly.
//
// A place fires when the boat is inside its reach AND slower than ARRIVAL.maxSpeed. After firing it is
// disarmed until the boat has left (REARM_FACTOR x the reach), and not before ARRIVAL.cooldownS has passed:
// hovering at the quay, or sailing in and out of the mouth, does not give a fish every few seconds.
// A place the boat starts inside is disarmed too, so the spawn (just outside Grundsund) is not a welcome.
// Game metres, 1:10 (so 70 m is 700 m of real water).
export const ARRIVAL = {
  reachM: { village: 70, harbour: 45 }, // how close counts as "in the harbour"
  maxSpeed: 3, // m/s; the boat tops out near 10, typical sailing ~7, so this is "easing in"
  rearmFactor: 1.8, // leave to this x reach to re-arm
  cooldownS: 90,
};

const ARRIVAL_KINDS = new Set(['village', 'harbour']);

// places: the name list (src/names.js buildNameList): { id, name, kind, x, z }. Only villages and harbours count.
export function createArrivals(places, cfg = ARRIVAL) {
  const list = places.filter((p) => ARRIVAL_KINDS.has(p.kind)).map((p) => ({
    place: p, reach: cfg.reachM[p.kind], armed: null, lastAt: -Infinity, // armed: null until the first update
  }));
  return {
    places: list.map((l) => l.place),
    // Call every frame with the boat's position and speed. Returns the places arrived at by THIS call.
    update(x, z, speed, nowS) {
      let arrived = null;
      for (const s of list) {
        const d = Math.hypot(s.place.x - x, s.place.z - z);
        if (s.armed === null) s.armed = d > s.reach * cfg.rearmFactor; // starting inside: wait until we leave
        if (!s.armed) {
          if (d > s.reach * cfg.rearmFactor) s.armed = true;
          continue;
        }
        if (d <= s.reach && speed <= cfg.maxSpeed && nowS - s.lastAt >= cfg.cooldownS) {
          s.armed = false;
          s.lastAt = nowS;
          (arrived ||= []).push(s.place);
        }
      }
      return arrived || [];
    },
  };
}

// Which fish a harbour gives. Deterministic from the place id, so a harbour always has "its" fish.
export const FISH_KINDS = ['mackerel', 'herring', 'cod', 'flounder'];
export function giftFor(place) {
  let h = 2166136261;
  for (const ch of place.id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return { kind: FISH_KINDS[h % FISH_KINDS.length], from: place.id };
}
