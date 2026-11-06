// Ambient boats: a small pool that always sails PAST YOU. The scheduled boats (routes, loops, the ferry) are the shared big picture; but a phone shows only
// about 60 x 140 game metres, a few hundredths of a square kilometre, so fixed routes alone leave the screen empty most of the time. An ambient boat spawns out
// of sight (ring: 90-150 m from the player) on a straight leg of open water that passes 10-55 m from where the player is, sails through the view, and
// respawns when it has finished its leg or the player has left it behind. Local to each player (not synced): fill traffic, not a shared event.
// Pure (no THREE): the engine (busy-coast.js) draws them and gives way to the players like every other boat.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const lerp = (a, b, t) => a + (b - a) * t;

export const AMBIENT_DEFAULTS = { ring: [90, 150], legM: [170, 270], lateral: [22, 60], despawnM: 280, tries: 16, stepM: 1.5, avoidM: 8 };

// A straight leg of free water for an ambient boat around `viewer` ({ x, z }), or null if this try found none.
//   freeAt(x, z): may a boat's centre be here?   avoid: [[x, z]...] places to stay avoidM away from (moored boats, ferry docks)
// Returns { a, b, d (unit direction), len, heading } (heading: forward = (sin, cos), as everywhere).
export function ambientPath(rand, viewer, { freeAt, avoid = [], ring = AMBIENT_DEFAULTS.ring, legM = AMBIENT_DEFAULTS.legM, lateral = AMBIENT_DEFAULTS.lateral, tries = AMBIENT_DEFAULTS.tries, stepM = AMBIENT_DEFAULTS.stepM, avoidM = AMBIENT_DEFAULTS.avoidM } = {}) {
  const avoid2 = avoidM * avoidM;
  for (let t = 0; t < tries; t++) {
    const th = rand() * Math.PI * 2, r = lerp(ring[0], ring[1], rand());
    const a = [viewer.x + Math.sin(th) * r, viewer.z + Math.cos(th) * r];
    if (!freeAt(a[0], a[1])) continue;
    const side = rand() < 0.5 ? 1 : -1, lat = lerp(lateral[0], lateral[1], rand());
    const dl = Math.hypot(viewer.x - a[0], viewer.z - a[1]) || 1, u = [(viewer.x - a[0]) / dl, (viewer.z - a[1]) / dl];
    const aim = [viewer.x - u[1] * lat * side, viewer.z + u[0] * lat * side]; // past the viewer, `lat` metres to one side
    const dx = aim[0] - a[0], dz = aim[1] - a[1], dd = Math.hypot(dx, dz) || 1, d = [dx / dd, dz / dd];
    const len = lerp(legM[0], legM[1], rand());
    let ok = true;
    for (let l = 0; l <= len && ok; l += stepM) {
      const x = a[0] + d[0] * l, z = a[1] + d[1] * l;
      if (!freeAt(x, z)) { ok = false; break; }
      for (const p of avoid) if ((x - p[0]) ** 2 + (z - p[1]) ** 2 < avoid2) { ok = false; break; }
    }
    if (ok) return { a, b: [a[0] + d[0] * len, a[1] + d[1] * len], d, len, heading: Math.atan2(d[0], d[1]) };
  }
  return null;
}

// Where an ambient boat is: progress s metres along its leg.
export const ambientAt = (path, s) => ({ x: path.a[0] + path.d[0] * s, z: path.a[1] + path.d[1] * s, heading: path.heading });
// Has this boat finished its leg, or been left too far behind the viewer to matter?
export const ambientDone = (path, s, viewer, despawnM = AMBIENT_DEFAULTS.despawnM) => s >= path.len || Math.hypot(path.a[0] + path.d[0] * s - viewer.x, path.a[1] + path.d[1] * s - viewer.z) > despawnM;

// In tight water (a narrow sound, a harbour mouth) there is no straight leg of the normal size: fall back to shorter legs that start a little closer in
// (still out of the ~70 m half-height of the view), so a boat sails past even there. The era's ring / legM / lateral are the first, widest try.
export function ambientPathAdaptive(rand, viewer, opts = {}) {
  const ring = opts.ring ?? AMBIENT_DEFAULTS.ring, legM = opts.legM ?? AMBIENT_DEFAULTS.legM;
  const levels = [
    { ring, legM },
    { ring: [Math.max(70, ring[0] - 20), Math.max(90, ring[1] - 40)], legM: [Math.max(90, legM[0] * 0.6), Math.max(130, legM[1] * 0.6)] },
    { ring: [64, 85], legM: [75, 125] },
  ];
  for (const lv of levels) { const p = ambientPath(rand, viewer, { ...opts, ring: lv.ring, legM: lv.legM }); if (p) return p; }
  return null;
}
