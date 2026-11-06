// The real coast, built headlessly exactly the way the game builds its collision (no meshes): raster -> world -> carved passes
// (ship + harbour tiers) -> real shoals. Used by tools/plan-busy-today.mjs and by src/busy-today.test.js.
//   const gw = await loadGameWorld();  gw.blocked(x, z)  // true = the boat's centre cannot be there (game collision rule)
//   gw.fromGame(x, z) -> [lon, lat]   gw.toGame(lon, lat) -> [x, z]   (game metres, x east, z south, origin = NW corner of the plane)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCoast } from '../../games/windward/src/coast-data.js';
import { buildCoastWorld, COAST_TILES, COAST_VEX, COAST_SMOOTH } from '../../games/windward/src/coast-world.js';
import { applyPasses } from '../../games/windward/src/passes.js';
import { GAME_PASS_TIERS, createShoalIndex, makeSailHeight } from '../../games/windward/src/sea-truth.js';
import { buildShoalList } from '../../games/windward/src/shoal-look.js';
import { isBlocked } from '../../games/windward/src/shore.js';

export const WINDWARD = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'games', 'windward') + '/';
const json = (rel) => JSON.parse(readFileSync(WINDWARD + rel, 'utf8'));

export async function loadGameWorld() {
  const dir = WINDWARD + 'assets/coast/';
  const io = { json: async (u) => JSON.parse(readFileSync(u, 'utf8')), bytes: async (u) => new Uint8Array(readFileSync(u)) };
  const coast = await loadCoast(dir, io, COAST_TILES);
  const world = buildCoastWorld(coast, { vex: COAST_VEX, smooth: COAST_SMOOTH, skerries: json('assets/coast/skerries.json').skerries });
  applyPasses(world, json('assets/coast/passes.json'), { tiers: GAME_PASS_TIERS });
  const shoalIndex = createShoalIndex(buildShoalList(json('assets/coast/shoals.json').shoals, world.toGame));
  const sailHeightAt = makeSailHeight(world.heightAt, shoalIndex);
  const mpp = coast.meta.metersPerPixelReal, PJ = coast.meta.projection;
  const fromGame = (x, z) => [coast.meta.bbox.w + ((x / world.pxM) * mpp) / PJ.metersPerDegLon, coast.meta.bbox.n - ((z / world.pxM) * mpp) / PJ.metersPerDegLat];
  return {
    coast, world, sailHeightAt, shoalIndex,
    blocked: (x, z) => isBlocked(sailHeightAt, x, z),
    toGame: world.toGame, fromGame,
    names: json('assets/coast/names.json'), seamarks: json('assets/coast/seamarks.json'), settlements: json('data/settlements-history.json').settlements,
  };
}
