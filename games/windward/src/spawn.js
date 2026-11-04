// Spawn pose (Stage 1, 2026-11-04 — design audit check 1 "First 30 seconds").
//
// Before: boats spawned facing due east/west whatever the wind, fully
// sheeted in. ~1 in 8 seeds put a boat inside the no-go zone at 0 kn, and
// every boat started slow until the player discovered trim.
//
// Now: both boats face across the wind (a beam reach, 90° off — the most
// forgiving point of sail) with the sheet already at the ideal trim for it,
// so the first thing a new player sees is their boat moving. Both face the
// same way so the two of you set off alongside each other.
//
// Pure and seed-derived (initialWind is identical on host and guest), so
// both peers compute the same pose with no network traffic.
import { CONFIG } from './config.js';
import { initialWind } from './wind.js';
import { idealTrimRad } from './sail.js';

export function spawnPose(seed, role) {
  const wind = initialWind(seed);
  // Heading convention matches game.js: x += sin(heading), z += cos(heading).
  // wind.dir is where the wind blows FROM; +90° from it is a beam reach.
  const heading = (wind.dir + Math.PI / 2) % (Math.PI * 2);
  return {
    x: role === 'host' ? -CONFIG.BOAT_SPAWN_OFFSET : CONFIG.BOAT_SPAWN_OFFSET,
    z: 0,
    heading,
    trim: idealTrimRad(Math.PI / 2),
  };
}
