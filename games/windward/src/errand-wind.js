// The first errand's scripted wind (Next run, batch 2b): easy and quick. Pure: no DOM, no THREE.
//
// While beats.phase is 'errand' (yard -> Grundsund) the wind blows from straight behind that line; once the fittings are aboard ('return') it swings, over a few
// seconds, to blow from straight behind the way home (Grundsund -> yard). When the yard is reached the beats move on to 'help' (the sail to Britta's jetty), and the
// wind eases back to whatever the normal host wind controller (src/wind.js) is doing, with no snap. Everything is DERIVED from beats.phase, which is already
// saved: no new save key, and a game loaded at any phase gets the right wind from its first frame (no blend from a random wind nobody has seen).
//
// It lives on the HOST, as a wrapper around the normal wind controller: game.js feeds the result into the same `wind` it broadcasts, so the guest still just applies
// incoming 'wind' messages and both phones agree. `blending` tells the host to broadcast at the fast transition cadence while the wind is swinging.
//
// wind.dir is the direction the wind blows FROM (src/sail.js angleOffWind). Sailing a heading h with the wind from behind means dir = h + PI, which is 180 deg
// off the wind: dead downwind (speed factor 0.80, 13% below a broad reach at 135 deg: see the numbers in the batch-2 report). CONFIG.ERRAND_WIND_OFF_STERN_DEG
// moves it off dead astern if a broad reach is ever wanted.
import { CONFIG } from './config.js';
import { interpolateWind } from './wind.js';

const TAU = Math.PI * 2;
const norm = (a) => ((a % TAU) + TAU) % TAU;
export const bearing = (a, b) => Math.atan2(b.x - a.x, b.z - a.z); // the game's heading convention: 0 = +z, x = sin(heading)

// The scripted wind for a beats phase, or null when the normal wind applies. yard / grundsund: { x, z }.
export function errandWindFor(phase, { yard, grundsund }) {
  if ((phase !== 'errand' && phase !== 'return') || !yard || !grundsund) return null;
  const heading = phase === 'errand' ? bearing(yard, grundsund) : bearing(grundsund, yard);
  return { dir: norm(heading + Math.PI + (CONFIG.ERRAND_WIND_OFF_STERN_DEG * Math.PI) / 180), strength: CONFIG.ERRAND_WIND_STRENGTH };
}

// step(phase, nowS, normalWind) -> the wind to use now. nowS is the GAME clock (src/game-clock.js), so a pause does not eat the swing.
export function createErrandWind({ yard, grundsund }) {
  let first = true;
  let key = null;     // 'errand' | 'return' | null (normal): what the wind is following now
  let from = null;    // the wind when the key last changed: the swing starts here
  let out = null;     // the wind returned last time
  let startS = -Infinity;
  let blending = false;
  return {
    get blending() { return blending; },
    step(phase, nowS, normal) {
      const k = phase === 'errand' || phase === 'return' ? phase : null;
      const desired = k ? errandWindFor(k, { yard, grundsund }) : normal;
      if (first) { first = false; key = k; from = out = desired; blending = false; return out; } // a game loaded at any phase: right from frame 1
      if (k !== key) { key = k; from = out; startS = nowS; } // a phase change: start swinging from wherever the wind is now
      const t = (nowS - startS) / CONFIG.ERRAND_WIND_SWING_S;
      blending = t < 1;
      out = t >= 1 ? desired : interpolateWind(from, desired, t);
      return out;
    },
  };
}
