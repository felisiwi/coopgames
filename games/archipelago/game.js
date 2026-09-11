// Contract entry point (games/README.md). The hub (or the solo dev entry in
// this folder's index.html) calls this directly; it never imports PeerJS or
// shared/net.js itself — `net` is handed in.
import { CONFIG } from './src/config.js';
import { generateIsland } from './src/island.js';
import { renderIsland, loadTileImages } from './src/render.js';
import { createInputState } from '../../shared/input.js';

const WATER_TYPES = new Set(['deep_water', 'shallow_water']);

function isLandTile(island, x, y) {
  if (x < 0 || y < 0 || x >= island.size || y >= island.size) return false;
  return !WATER_TYPES.has(island.grid[y][x].type);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// net/players are unused this batch — position sync lands in Stage 2
// Batch 3.
export default function start({ canvas, net, seed, role, players }) {
  const ctx = canvas.getContext('2d');
  const island = generateIsland(seed);
  const spawn = role === 'guest' ? island.spawnB : island.spawnA;
  const debug = new URLSearchParams(window.location.search).get('debug') === '1';

  // Player position is a grid tile (x, y) plus an in-flight move: while
  // `t < 1` the render position is lerped from (fromX, fromY) toward
  // (toX, toY); at `t === 1` the player is at rest on (x, y).
  const player = {
    x: spawn.x,
    y: spawn.y,
    fromX: spawn.x,
    fromY: spawn.y,
    toX: spawn.x,
    toY: spawn.y,
    t: 1,
  };

  const input = createInputState();

  function renderPos() {
    return { x: lerp(player.fromX, player.toX, player.t), y: lerp(player.fromY, player.toY, player.t) };
  }

  function tryStartMove(dx, dy) {
    if (player.t < 1) return; // mid-move — no move queuing in v1
    const nx = player.x + dx;
    const ny = player.y + dy;
    if (!isLandTile(island, nx, ny)) return; // water/off-map is a wall
    player.fromX = player.x;
    player.fromY = player.y;
    player.toX = nx;
    player.toY = ny;
    player.t = 0;
  }

  loadTileImages().then((images) => {
    let lastTime = performance.now();

    function frame(now) {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      if (player.t < 1) {
        player.t = Math.min(1, player.t + dt / CONFIG.MOVE_SECONDS_PER_TILE);
        if (player.t >= 1) {
          player.x = player.toX;
          player.y = player.toY;
        }
      } else if (input.up) {
        tryStartMove(0, -1);
      } else if (input.down) {
        tryStartMove(0, 1);
      } else if (input.left) {
        tryStartMove(-1, 0);
      } else if (input.right) {
        tryStartMove(1, 0);
      }

      const pos = renderPos();
      renderIsland(ctx, canvas, island, images, {
        debug,
        camera: pos,
        entities: [{ x: pos.x, y: pos.y, color: '#ffcc66' }],
      });

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  });
}
