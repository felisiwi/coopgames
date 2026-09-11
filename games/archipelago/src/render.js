// Isometric island render. Camera-follow (Stage 2) recentres the view on a
// given grid point (continuous coords OK, for smooth movement); ?debug=1
// keeps the Stage 1 whole-map fit-to-screen view, which is what the Step 0
// audit #2 sign-off process (eyeballing 5 seeds) uses, so eyeballing a
// generator change never depends on player position.
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

export function renderIsland(ctx, canvas, island, images, opts = {}) {
  const { size, grid } = island;
  const { debug = false, camera = null, entities = [] } = opts;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.imageSmoothingEnabled = false;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);

  let originX;
  let originY;

  if (camera && !debug) {
    // Camera-follow: place camera's grid point at screen (0,0) — the
    // translate above puts that at canvas centre — at native 1:1 scale.
    originX = -(camera.x - camera.y) * CONFIG.TILE_STEP_X;
    originY = -(camera.x + camera.y) * CONFIG.TILE_STEP_Y;
  } else {
    // Stage 1 whole-map fit, kept as the ?debug=1 escape hatch.
    const { width: bboxW, height: bboxH } = mapBounds(size);
    const fitPadding = debug ? 0.98 : 0.92;
    const scale = Math.min(1, (canvas.width * fitPadding) / bboxW, (canvas.height * fitPadding) / bboxH);
    ctx.scale(scale, scale);
    originX = 0;
    originY = -((size - 1) * CONFIG.TILE_STEP_Y);
  }

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

  // AGENTS.md depth-sorting rule: ground tiles first, then a single list of
  // movable entities sorted by map y then x (drawn on top, no baked trees
  // to interleave with in this tileset).
  const sortedEntities = entities.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  for (const entity of sortedEntities) {
    const { x: sx, y: sy } = toScreen(entity.x, entity.y, originX, originY);
    ctx.beginPath();
    ctx.arc(sx, sy - CONFIG.TILE_STEP_Y / 2, 10, 0, Math.PI * 2);
    ctx.fillStyle = entity.color || '#ffcc66';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.restore();
}
