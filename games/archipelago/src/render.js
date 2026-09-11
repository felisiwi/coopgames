// Full isometric island render. No camera, no players (Stage 1 scope) —
// the whole map is always centred on the canvas and scaled to fit the
// viewport. ?debug=1 uses tighter fit padding, which is what the Step 0
// audit #2 sign-off process (eyeballing 5 seeds) uses.
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

// Grid (x, y) -> screen centre of the tile's true diamond (not the image's
// top-left — see CONFIG comment for why TILE_STEP_Y != TILE_HEIGHT / 2).
function toScreen(x, y, originX, originY) {
  return {
    x: originX + (x - y) * CONFIG.TILE_STEP_X,
    y: originY + (x + y) * CONFIG.TILE_STEP_Y,
  };
}

function mapBounds(size) {
  const width = 2 * size * CONFIG.TILE_STEP_X;
  const height = 2 * (size - 1) * CONFIG.TILE_STEP_Y + CONFIG.TILE_HEIGHT;
  return { width, height };
}

export function renderIsland(ctx, canvas, island, images, { debug = false } = {}) {
  const { size, grid } = island;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.imageSmoothingEnabled = false;

  // No camera/player yet (Stage 1 scope), so the only way to see the whole
  // island on a normal viewport is to fit it — that's the default, not just
  // ?debug=1. Once camera-follow lands, default becomes 1:1 around the
  // player and debug=1 stays the "see the whole map" escape hatch.
  const { width: bboxW, height: bboxH } = mapBounds(size);
  const fitPadding = debug ? 0.98 : 0.92;
  const scale = Math.min(1, (canvas.width * fitPadding) / bboxW, (canvas.height * fitPadding) / bboxH);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(scale, scale);

  const originX = 0;
  const originY = -((size - 1) * CONFIG.TILE_STEP_Y);

  // Painter's algorithm: draw strictly back-to-front (increasing x + y) so
  // each tile's skirt (the Thick style's extra height below the true
  // diamond) is covered by the tile drawn in front of it.
  for (let d = 0; d <= 2 * (size - 1); d++) {
    const yStart = Math.max(0, d - (size - 1));
    const yEnd = Math.min(d, size - 1);
    for (let y = yStart; y <= yEnd; y++) {
      const x = d - y;
      const tile = grid[y][x];
      const img = images[tile.type];
      if (!img) continue;
      const { x: sx, y: sy } = toScreen(x, y, originX, originY);
      ctx.drawImage(img, sx - CONFIG.TILE_WIDTH / 2, sy - CONFIG.TILE_STEP_Y, CONFIG.TILE_WIDTH, CONFIG.TILE_HEIGHT);
    }
  }

  ctx.restore();
}
