// Scaffold stub. Real isometric tile rendering (TILES map, measured
// diamond footprint, back-to-front depth sort) lands in Batch 2/3. For now
// this draws flat-colour diamonds so the pipeline is exercised end-to-end.
import { CONFIG } from './config.js';

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
