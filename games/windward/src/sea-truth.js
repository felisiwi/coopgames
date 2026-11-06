// "The water tells the truth" (stage 1d, batch 1): the real shoals as the boat feels them, and the passes carved in the game.
//
//   hard shoals   awash / dry rocks and named shoals (båd, flu) are solid, like land: the boat slides off them (shoal-look.js says
//                 which: shoalLook().blocks). They enter the SAILING height field only, as spikes above BLOCK_H, so the terrain, trees
//                 and names keep the plain coast and every existing shore rule (stepAlongShore, hullHeight, shallowFactor) just works.
//   soft shoals   submerged / unknown rocks, wrecks, obstructions slow the boat (shoalLook().slow), never stop it.
//
// The collision radius is the rock's OWN radius (shoal-look.js); the hull is added by the shore code (hullHeight probes a ring of
// HULL_RADIUS_M round the boat), so a hard shoal stops the boat at collisionRadiusM + hull, exactly as shoalHit() says.
// Pure (no THREE): a grid index so a probe costs a handful of comparisons, not 292.
import { HULL_RADIUS_M } from './shore.js';

// The passes the game carves (passes.json): the ship tier now, and any 'harbour' tier rows (the harbour approaches) the moment they exist.
export const GAME_PASS_TIERS = ['ship', 'harbour'];
export const HARD_SHOAL_HEIGHT = 1.5; // the field value over a hard shoal: well above shore.js BLOCK_H (-0.9), like low land

// list: shoal-look.js buildShoalList() rows { x, z, look }. Returns { hardAt(x, z), slowAt(x, z) }.
export function createShoalIndex(list, { cell = 24, hull = HULL_RADIUS_M } = {}) {
  const hard = new Map();
  const soft = new Map();
  const key = (i, j) => `${i},${j}`;
  const add = (map, item, reach) => {
    const i0 = Math.floor((item.x - reach) / cell), i1 = Math.floor((item.x + reach) / cell);
    const j0 = Math.floor((item.z - reach) / cell), j1 = Math.floor((item.z + reach) / cell);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = key(i, j);
      const a = map.get(k);
      if (a) a.push(item); else map.set(k, [item]);
    }
  };
  for (const item of list) {
    if (item.look.blocks) add(hard, item, item.look.collisionRadiusM);
    else add(soft, item, item.look.collisionRadiusM + hull);
  }
  return {
    hardCount: list.filter((s) => s.look.blocks).length,
    softCount: list.filter((s) => !s.look.blocks).length,
    // is the point inside a solid shoal (its own radius; the hull probes add the boat's width)?
    hardAt(x, z) {
      const a = hard.get(key(Math.floor(x / cell), Math.floor(z / cell)));
      if (!a) return false;
      for (const s of a) if (Math.hypot(x - s.x, z - s.z) < s.look.collisionRadiusM) return true;
      return false;
    },
    // speed multiplier for a hull centred at (x, z): the slowest soft shoal it overlaps, else 1
    slowAt(x, z) {
      const a = soft.get(key(Math.floor(x / cell), Math.floor(z / cell)));
      if (!a) return 1;
      let f = 1;
      for (const s of a) if (Math.hypot(x - s.x, z - s.z) < s.look.collisionRadiusM + hull) f = Math.min(f, s.look.slow);
      return f;
    },
  };
}

// The height field the boat sails on: the coast, plus solid shoals as low land.
export const makeSailHeight = (heightAt, index) => (x, z) => {
  const h = heightAt(x, z);
  return index.hardAt(x, z) ? Math.max(h, HARD_SHOAL_HEIGHT) : h;
};
