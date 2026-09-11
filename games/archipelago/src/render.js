// Curated CC0 tile palette (Batch 2) — 10 PNGs in assets/tiles/, each the
// full 128x72 "Thick" cell (diamond top + 8px thickness skirt; see
// CONFIG.TILE_STEP_X/Y for the measured footprint). Batch 3 wires these
// into the real isometric draw; for now renderIsland() below still draws
// flat-colour placeholder diamonds so the pipeline is exercised end-to-end.
import { CONFIG } from './config.js';

export const TILES = {
  deep_water: 'assets/tiles/deep_water.png',
  shallow_water: 'assets/tiles/shallow_water.png',
  sand: 'assets/tiles/sand.png',
  grass_1: 'assets/tiles/grass_1.png',
  grass_2: 'assets/tiles/grass_2.png',
  forest_1: 'assets/tiles/forest_1.png',
  forest_2: 'assets/tiles/forest_2.png',
  forest_3: 'assets/tiles/forest_3.png',
  rock: 'assets/tiles/rock.png',
  landmark: 'assets/tiles/landmark.png',
};

export async function loadTileImages() {
  const entries = await Promise.all(
    Object.entries(TILES).map(
      ([key, src]) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve([key, img]);
          img.onerror = reject;
          img.src = src;
        })
    )
  );
  return Object.fromEntries(entries);
}

const PLACEHOLDER_COLORS = {
  water: '#1b4f72',
  land: '#6b8e4e',
};

export function renderIsland(ctx, canvas, island) {
  const { size, grid } = island;
  const tw = CONFIG.TILE_WIDTH;
  const th = CONFIG.TILE_HEIGHT;
  const halfW = tw / 2;
  const halfH = th / 2;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const originX = canvas.width / 2;
  const originY = canvas.height / 2 - (size * halfH) / 2;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tile = grid[y][x];
      const screenX = originX + (x - y) * halfW;
      const screenY = originY + (x + y) * halfH;

      ctx.fillStyle = PLACEHOLDER_COLORS[tile.type] || '#333';
      ctx.beginPath();
      ctx.moveTo(screenX, screenY - halfH);
      ctx.lineTo(screenX + halfW, screenY);
      ctx.lineTo(screenX, screenY + halfH);
      ctx.lineTo(screenX - halfW, screenY);
      ctx.closePath();
      ctx.fill();
    }
  }
}
